// =========================================================================
// MÓDULO: WEB WORKER DE COMPUTACIÓN EVOLUTIVA
// =========================================================================

import { Motor } from "./motor.js";
import { obtenerModeloPorId, registrarModeloDinamico } from "../../catalogo/index.js";
import { compilarModeloDinamico } from "../builder.js";

// Instancia activa del motor evolutivo.
let motorJsActivo = null;

// Estado operativo actual del Web Worker ('DETENIDO', 'CORRIENDO', 'PAUSADO').
let estadoSimulacion = "DETENIDO";

// Inicia la optimización evolutiva utilizando el motor genético.
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
  ejecutarConJs(modelo, config, entrada);
}

// Ejecuta el proceso evolutivo utilizando la clase Motor.
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
      motorTipo: progreso.esMultiobjetivo ? "NSGA-II Pareto" : "Motor Evolutivo",
      ...progreso
    });

    if (progreso.completado) {
      estadoSimulacion = "DETENIDO";
    }
  });
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
      postMessage({ tipo: "estado", estado: "PAUSADO" });
      break;

    case "reanudar":
      if (estadoSimulacion === "PAUSADO") {
        estadoSimulacion = "CORRIENDO";
        if (motorJsActivo) motorJsActivo.reanudar();
        postMessage({ tipo: "estado", estado: "CORRIENDO" });
      }
      break;

    case "detener":
      estadoSimulacion = "DETENIDO";
      if (motorJsActivo) motorJsActivo.detener();
      postMessage({ tipo: "estado", estado: "DETENIDO" });
      break;

    default:
      console.warn("[Web Worker] Comando no reconocido:", datos.comando);
      break;
  }
});
