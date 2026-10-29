// =========================================================================
// MÓDULO: WEB WORKER DE COMPUTACIÓN EVOLUTIVA (JS Y WEBASSEMBLY)
// =========================================================================

import { Motor } from "./motor.js";
import { obtenerModeloPorId, registrarModeloDinamico } from "../models/index.js";
import { compilarModeloDinamico } from "../builder.js";

// Instancia activa del motor JavaScript en caso de fallback o modelos sin WASM.
let motorJsActivo = null;

// Instancia compilada de WebAssembly si el binario sim_core.wasm está disponible.
let wasmInstance = null;

// Estado operativo actual del Web Worker ('DETENIDO', 'CORRIENDO', 'PAUSADO').
let estadoSimulacion = "DETENIDO";

// Identificador del temporizador de tandas asíncronas para el bucle de trabajo en WASM.
let idTimerTanda = null;

// Memoria y variables de estado persistentes durante una corrida acelerada con WASM.
let estadoWasmActivo = null;

// Intenta cargar e instanciar el binario autónomo sim_core.wasm desde el servidor.
async function cargarWasmSiExiste() {
  if (wasmInstance) return wasmInstance;
  try {
    const url = new URL("./sim_core.wasm", import.meta.url);
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error(`Código de estado HTTP: ${respuesta.status}`);
    }
    const buffer = await respuesta.arrayBuffer();
    const modulo = await WebAssembly.instantiate(buffer, {});
    wasmInstance = modulo.instance || modulo;
    console.info("[Web Worker] ✓ Módulo sim_core.wasm cargado con éxito. Aceleración nativa habilitada.");
    return wasmInstance;
  } catch (error) {
    console.warn(`[Web Worker] ℹ sim_core.wasm no disponible (${error.message}). Utilizando fallback transparente con Motor en JavaScript.`);
    return null;
  }
}

// Inicia la optimización evolutiva utilizando el motor JavaScript o el núcleo WebAssembly según disponibilidad.
async function iniciarOptimizacion(datos) {
  const { config, modeloId, entrada, definicionModeloDinamico } = datos;

  // Si se adjunta una definición de modelo dinámico se compila e inyecta en el registro del Worker.
  if (definicionModeloDinamico) {
    try {
      const modeloCompilado = compilarModeloDinamico(definicionModeloDinamico);
      registrarModeloDinamico(modeloCompilado);
    } catch (error) {
      console.warn("[Web Worker] Error compilando modelo dinámico:", error.message);
    }
  }

  const modelo = obtenerModeloPorId(modeloId);
  estadoSimulacion = "CORRIENDO";

  // Verificamos si el modelo admite WASM y si el binario está compilado.
  let instanciaWasm = null;
  if (modelo.usaWasm) {
    instanciaWasm = await cargarWasmSiExiste();
  }

  if (instanciaWasm && instanciaWasm.exports && (instanciaWasm.exports.correr_tanda_jansen_c || instanciaWasm.exports._correr_tanda_jansen_c)) {
    // Modo 1: Aceleración en WebAssembly (WASM).
    ejecutarConWasm(instanciaWasm, modelo, config, entrada);
  } else {
    // Modo 2: Motor genético estándar en JavaScript (Fallback transparente).
    ejecutarConJs(modelo, config, entrada);
  }
}

// Ejecuta el proceso evolutivo utilizando la clase Motor de JavaScript.
function ejecutarConJs(modelo, config, entrada) {
  motorJsActivo = new Motor({
    tamanoPoblacion: config.tamanoPoblacion,
    generaciones: config.generaciones,
    tasaMutacion: config.tasaMutacion,
    elitismo: config.elitismo,
    tamanoTorneo: config.tamanoTorneo,
    semilla: config.semilla,
    tandaGeneraciones: config.tandaGeneraciones || 5,
    nReplicasRuido: config.nReplicasRuido || 5
  });

  motorJsActivo.correr(modelo, entrada, (progreso) => {
    postMessage({
      tipo: "progreso",
      motorTipo: "JavaScript (Fallback)",
      ...progreso
    });

    if (progreso.completado) {
      estadoSimulacion = "DETENIDO";
    }
  });
}

// Ejecuta el proceso evolutivo acelerado en memoria C++ mediante WebAssembly.
function ejecutarConWasm(instancia, modelo, config, entrada) {
  const exports = instancia.exports;
  const fnCorrerTanda = exports.correr_tanda_jansen_c || exports._correr_tanda_jansen_c;
  const memoria = exports.memory;

  const N = config.tamanoPoblacion || 60;
  const totalGeneraciones = config.generaciones || 200;
  const tandaGen = config.tandaGeneraciones || 5;
  const tasaMut = config.tasaMutacion !== undefined ? config.tasaMutacion : 0.05;
  const elitismo = config.elitismo !== undefined ? config.elitismo : 2;
  const torneo = config.tamanoTorneo || 3;
  let semilla = (config.semilla || 123456) >>> 0;

  const amplitud = Number(entrada?.amplitud !== undefined ? entrada.amplitud : 0.30);
  const zancadaObj = Number(entrada?.zancadaObjetivo !== undefined ? entrada.zancadaObjetivo : 4.0);
  const w1 = Number(entrada?.w1 !== undefined ? entrada.w1 : 3.0);
  const w2 = Number(entrada?.w2 !== undefined ? entrada.w2 : 1.0);
  const w3 = Number(entrada?.w3 !== undefined ? entrada.w3 : 1.0);
  const w4 = Number(entrada?.w4 !== undefined ? entrada.w4 : 1.0);
  const w5 = Number(entrada?.w5 !== undefined ? entrada.w5 : 0.5);
  // Ponderación w7 de verticalidad de ataque y cuadratura del paso.
  const w7 = Number(entrada?.w7 !== undefined ? entrada.w7 : 1.0);
  // Ponderación w9 de aprovechamiento horizontal y eficiencia espacial.
  const w9 = Number(entrada?.w9 !== undefined ? entrada.w9 : 1.0);
  const criterio = (entrada?.criterioSuavidad || "pico").toString().toLowerCase().trim() === "variacion" ? 1 : 0;
  const limitePico = Number(entrada?.limitePico !== undefined ? entrada.limitePico : 30);

  // Espacio en memoria lineal de WebAssembly para población y fitness.
  const bytesPoblacion = N * 12 * 8;
  const bytesFitness = N * 8;
  const bytesMejorGenoma = 12 * 8;
  const bytesPromedio = 8;
  const totalBytes = bytesPoblacion + bytesFitness + bytesMejorGenoma + bytesPromedio;

  // Si la memoria es insuficiente se solicita crecimiento de páginas de 64KB.
  const paginasNecesarias = Math.ceil(totalBytes / 65536) + 1;
  if (memoria.buffer.byteLength < totalBytes) {
    memoria.grow(paginasNecesarias);
  }

  const ptrPoblacion = 1024;
  const ptrFitness = ptrPoblacion + bytesPoblacion;
  const ptrMejorGenoma = ptrFitness + bytesFitness;
  const ptrPromedio = ptrMejorGenoma + bytesMejorGenoma;

  let generacionActual = 0;
  let inicializar = 1;
  const historiaMejor = [];
  const historiaPromedio = [];
  let genomaInicialAzar = null;
  let fitnessInicialAzar = null;

  estadoWasmActivo = {
    correrPaso: () => {
      if (estadoSimulacion !== "CORRIENDO") return;

      const gensPorLote = Math.min(tandaGen, totalGeneraciones - generacionActual);
      if (gensPorLote <= 0) {
        estadoSimulacion = "DETENIDO";
        return;
      }

      // Llamada directa a C++ exportado en WebAssembly.
      const mejorFitness = fnCorrerTanda(
        gensPorLote,
        N,
        tasaMut,
        elitismo,
        torneo,
        semilla,
        amplitud,
        w1, w2, w3, w4, w5, w7, w9,
        zancadaObj,
        criterio,
        limitePico,
        inicializar,
        ptrPoblacion,
        ptrFitness,
        ptrMejorGenoma,
        ptrPromedio
      );

      inicializar = 0;
      semilla = (semilla + gensPorLote * 997) >>> 0;
      generacionActual += gensPorLote;

      // Lectura del mejor genoma y estadísticas de la memoria de WASM.
      const viewFloat64 = new Float64Array(memoria.buffer);
      const mejorGenoma = Array.from(viewFloat64.subarray(ptrMejorGenoma / 8, (ptrMejorGenoma / 8) + 12));
      const promedioFitness = viewFloat64[ptrPromedio / 8];

      if (genomaInicialAzar === null) {
        genomaInicialAzar = [...mejorGenoma];
        fitnessInicialAzar = mejorFitness;
      }

      historiaMejor.push(mejorFitness);
      historiaPromedio.push(promedioFitness);

      const completado = generacionActual >= totalGeneraciones;

      postMessage({
        tipo: "progreso",
        motorTipo: "C++ (WebAssembly)",
        generacion: generacionActual,
        totalGeneraciones: totalGeneraciones,
        mejorFitness: mejorFitness,
        promedioFitness: promedioFitness,
        mejorGenoma: mejorGenoma,
        genomaInicialAzar: genomaInicialAzar,
        fitnessInicialAzar: fitnessInicialAzar,
        historiaMejor: historiaMejor,
        historiaPromedio: historiaPromedio,
        completado: completado
      });

      if (completado) {
        estadoSimulacion = "DETENIDO";
      } else if (estadoSimulacion === "CORRIENDO") {
        idTimerTanda = setTimeout(estadoWasmActivo.correrPaso, 0);
      }
    }
  };

  // Inicia la primera tanda de cómputo en WASM.
  estadoWasmActivo.correrPaso();
}

// Escucha de mensajes entrantes desde el hilo principal de la aplicación.
self.addEventListener("message", (evento) => {
  const datos = evento.data;
  if (!datos || !datos.comando) return;

  switch (datos.comando) {
    case "iniciar":
      iniciarOptimizacion(datos);
      break;

    case "registrarModeloDinamico":
      if (datos.definicion) {
        try {
          const modeloCompilado = compilarModeloDinamico(datos.definicion);
          registrarModeloDinamico(modeloCompilado);
        } catch (error) {
          console.warn("[Web Worker] Error registrando modelo dinámico:", error.message);
        }
      }
      break;

    case "pausar":
      estadoSimulacion = "PAUSADO";
      if (motorJsActivo) motorJsActivo.pausar();
      if (idTimerTanda) {
        clearTimeout(idTimerTanda);
        idTimerTanda = null;
      }
      postMessage({ tipo: "estado", estado: "PAUSADO" });
      break;

    case "reanudar":
      if (estadoSimulacion === "PAUSADO") {
        estadoSimulacion = "CORRIENDO";
        if (motorJsActivo) motorJsActivo.reanudar();
        if (estadoWasmActivo) estadoWasmActivo.correrPaso();
        postMessage({ tipo: "estado", estado: "CORRIENDO" });
      }
      break;

    case "detener":
      estadoSimulacion = "DETENIDO";
      if (motorJsActivo) motorJsActivo.detener();
      if (idTimerTanda) {
        clearTimeout(idTimerTanda);
        idTimerTanda = null;
      }
      estadoWasmActivo = null;
      postMessage({ tipo: "estado", estado: "DETENIDO" });
      break;

    default:
      console.warn("[Web Worker] Comando no reconocido:", datos.comando);
      break;
  }
});
