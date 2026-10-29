// =========================================================================
// MÓDULO PRINCIPAL: CONTROLADOR DE LA APLICACIÓN Y COMUNICACIÓN CON WORKER
// =========================================================================

import {
  MODELOS,
  obtenerModeloPorId,
  registrarModeloDinamico,
  eliminarModeloDinamicoDelRegistro,
  cargarModelosDinamicosEnRegistro
} from "./models/index.js";
import {
  guardarConfiguracion,
  cargarConfiguracion,
  cargarModelosDinamicos,
  guardarUnModeloDinamico,
  eliminarModeloDinamico,
  cargarPresets,
  guardarUnPreset,
  eliminarPreset,
  guardarPreferenciaTema,
  cargarPreferenciaTema
} from "./storage.js";
import {
  mostrarAlerta,
  mostrarToast,
  aplicarTemaColor,
  actualizarToolbarAcciones,
  construirFormularioModelo,
  obtenerDatosEntradaModelo,
  obtenerParametrosMotor,
  dibujarGraficoFitness,
  obtenerPuntoParetoCercano,
  actualizarLeyendaGrafico,
  actualizarBotonesControl,
  abrirModalConstructor,
  cerrarModalConstructor,
  agregarFilaVariableConstructor,
  extraerDefinicionModeloDesdeUI,
  abrirModalRenombrar,
  cerrarModalRenombrar,
  abrirModalImportar,
  cerrarModalImportar,
  abrirModalGuardarPreset,
  cerrarModalGuardarPreset,
  abrirModalBiblioteca,
  cerrarModalBiblioteca
} from "./ui.js";
import {
  compilarModeloDinamico,
  validarDefinicionModelo,
  clonarModeloDinamico,
  renombrarModeloDinamico,
  exportarSimulacionJSON,
  importarSimulacionJSON
} from "./builder.js";
import { Motor } from "./core/motor.js";

// Instancia activa del Web Worker para cómputo en segundo plano.
let workerOptimizacion = null;

// Modelo actualmente seleccionado en la interfaz.
let modeloActual = MODELOS[0];

// Últimos datos de entrada validados para el modelo en ejecución.
let ultimaEntradaModelo = null;

// Estado del gráfico de convergencia en Canvas para redibujado responsivo.
let datosGraficoActuales = {
  historiaMejor: [],
  historiaPromedio: [],
  totalGeneraciones: 200
};

// Estado multiobjetivo activo para renderizado interactivo y selección de soluciones en el Frente de Pareto.
let datosMultiobjetivoActuales = null;
let individuoParetoSeleccionado = null;

// Motor de respaldo en el hilo principal si el entorno bloquea Web Workers (p. ej. protocolo file://).
let motorFallbackLocal = null;

// Referencias a los elementos interactivos del DOM principal.
const elementosDOM = {
  selectorModelo: document.getElementById("selector-modelo"),
  descripcionModelo: document.getElementById("descripcion-modelo"),
  contenedorFormularioModelo: document.getElementById("contenedor-formulario-modelo"),
  contenedorDibujoModelo: document.getElementById("contenedor-dibujo-modelo"),
  textoDescribirModelo: document.getElementById("texto-describir-modelo"),
  contenedorAlerta: document.getElementById("contenedor-alerta"),
  btnAbrirConstructor: document.getElementById("btn-abrir-constructor"),
  btnEditarModelo: document.getElementById("btn-editar-modelo"),
  btnCopiarModelo: document.getElementById("btn-copiar-modelo"),
  btnRenombrarModelo: document.getElementById("btn-renombrar-modelo"),
  btnGuardarPreset: document.getElementById("btn-guardar-preset"),
  btnExportarModelo: document.getElementById("btn-exportar-modelo"),
  btnImportarModelo: document.getElementById("btn-importar-modelo"),
  btnEliminarModelo: document.getElementById("btn-eliminar-modelo"),
  btnAbrirBiblioteca: document.getElementById("btn-abrir-biblioteca"),
  btnTemaClaro: document.getElementById("btn-tema-claro"),
  btnTemaOscuro: document.getElementById("btn-tema-oscuro"),
  btnTemaAuto: document.getElementById("btn-tema-auto"),
  inputPoblacion: document.getElementById("param-poblacion"),
  inputGeneraciones: document.getElementById("param-generaciones"),
  inputMutacion: document.getElementById("param-mutacion"),
  inputElitismo: document.getElementById("param-elitismo"),
  inputTorneo: document.getElementById("param-torneo"),
  inputReplicasRuido: document.getElementById("param-replicas-ruido"),
  inputSemilla: document.getElementById("param-semilla"),
  btnNuevaSemilla: document.getElementById("btn-nueva-semilla"),
  btnCorrer: document.getElementById("btn-correr"),
  btnPausar: document.getElementById("btn-pausar"),
  btnDetener: document.getElementById("btn-detener"),
  barraProgreso: document.getElementById("barra-progreso"),
  textoEstado: document.getElementById("texto-estado"),
  textoGeneracion: document.getElementById("texto-generacion"),
  etiquetaMejorFitness: document.getElementById("etiqueta-mejor-fitness"),
  tituloGrafico: document.getElementById("titulo-grafico"),
  canvasFitness: document.getElementById("canvas-fitness")
};

// Referencias a los elementos interactivos del modal del constructor low-code.
const elementosModal = {
  modal: document.getElementById("modal-constructor-modelo"),
  alerta: document.getElementById("alerta-constructor"),
  inputNombre: document.getElementById("input-nombre-modelo"),
  inputDesc: document.getElementById("input-desc-modelo"),
  tbody: document.getElementById("tbody-variables-constructor"),
  textareaCodigo: document.getElementById("textarea-codigo-evaluacion"),
  btnCerrar: document.getElementById("btn-cerrar-modal"),
  btnCancelar: document.getElementById("btn-cancelar-modelo"),
  btnGuardar: document.getElementById("btn-guardar-modelo"),
  btnAgregarVar: document.getElementById("btn-agregar-variable")
};

// Referencias a los elementos del modal de renombrado rápido.
const elementosRenombrar = {
  modal: document.getElementById("modal-renombrar-simulacion"),
  inputNombre: document.getElementById("input-nuevo-nombre"),
  inputDesc: document.getElementById("input-nueva-desc"),
  btnCerrar: document.getElementById("btn-cerrar-renombrar"),
  btnCancelar: document.getElementById("btn-cancelar-renombrar"),
  btnConfirmar: document.getElementById("btn-confirmar-renombrar")
};

// Referencias a los elementos del modal de importación JSON.
const elementosImportar = {
  modal: document.getElementById("modal-importar-simulacion"),
  alerta: document.getElementById("alerta-importar"),
  inputArchivo: document.getElementById("input-archivo-importar"),
  textarea: document.getElementById("textarea-json-importar"),
  btnCerrar: document.getElementById("btn-cerrar-importar"),
  btnCancelar: document.getElementById("btn-cancelar-importar"),
  btnConfirmar: document.getElementById("btn-confirmar-importar")
};

// Referencias a los elementos del modal de guardado de presets.
const elementosPreset = {
  modal: document.getElementById("modal-guardar-preset"),
  inputNombre: document.getElementById("input-nombre-preset"),
  btnCerrar: document.getElementById("btn-cerrar-guardar-preset"),
  btnCancelar: document.getElementById("btn-cancelar-guardar-preset"),
  btnConfirmar: document.getElementById("btn-confirmar-guardar-preset")
};

// Referencias a los elementos del modal de la biblioteca general.
const elementosBiblioteca = {
  modal: document.getElementById("modal-biblioteca-simulaciones"),
  contenedor: document.getElementById("contenedor-items-biblioteca"),
  inputBuscar: document.getElementById("input-buscar-biblioteca"),
  btnCerrar: document.getElementById("btn-cerrar-biblioteca"),
  btnCerrarPie: document.getElementById("btn-cerrar-biblioteca-pie"),
  btnNuevoDesdeBiblioteca: document.getElementById("btn-nuevo-desde-biblioteca"),
  btnImportarDesdeBiblioteca: document.getElementById("btn-importar-desde-biblioteca")
};

// Inicializa el Web Worker con soporte para ES Modules y gestiona el canal postMessage.
function inicializarWebWorker() {
  try {
    const workerUrl = new URL("./core/worker.js", import.meta.url);
    workerOptimizacion = new Worker(workerUrl, { type: "module" });
    workerOptimizacion.addEventListener("message", procesarMensajeWorker);
    workerOptimizacion.addEventListener("error", (error) => {
      console.warn("[Main] Error capturado en Web Worker:", error.message);
    });

    // Inyecta los modelos dinámicos persistidos en el registro del Worker al arrancar.
    const dinamicos = cargarModelosDinamicos();
    dinamicos.forEach(def => {
      workerOptimizacion.postMessage({
        comando: "registrarModeloDinamico",
        definicion: def
      });
    });
  } catch (error) {
    console.warn("[Main] Web Worker no soportado en este contexto (posible protocolo file://). Fallback activo en hilo principal.");
    workerOptimizacion = null;
  }
}

// Procesa las notificaciones de progreso y finalización emitidas por el Web Worker o motor local.
function procesarMensajeWorker(evento) {
  const datos = evento.data;
  if (!datos) return;

  if (datos.tipo === "progreso") {
    const porcentaje = Math.min(100, (datos.generacion / datos.totalGeneraciones) * 100);
    elementosDOM.barraProgreso.style.width = `${porcentaje}%`;
    elementosDOM.textoGeneracion.textContent = `Gen ${datos.generacion} / ${datos.totalGeneraciones}`;

    if (datos.esMultiobjetivo) {
      // Modo Multiobjetivo (Frente de Pareto NSGA-II).
      if (elementosDOM.tituloGrafico) {
        elementosDOM.tituloGrafico.textContent = "📈 Frente de Pareto Multiobjetivo (Haz clic en un punto para ver su mecanismo)";
      }
      const numSoluciones = datos.frentePareto ? datos.frentePareto.length : 0;
      elementosDOM.etiquetaMejorFitness.textContent = `Frente Pareto: ${numSoluciones} sol. (${datos.motorTipo || "NSGA-II"})`;

      // Si aún no se fijó una selección manual, se toma por defecto la primera solución del frente.
      if (!individuoParetoSeleccionado && datos.frentePareto && datos.frentePareto.length > 0) {
        individuoParetoSeleccionado = datos.frentePareto[0];
      }

      datosMultiobjetivoActuales = {
        esMultiobjetivo: true,
        frentePareto: datos.frentePareto,
        poblacion: datos.poblacion,
        nombresObjetivos: datos.nombresObjetivos,
        individuoSeleccionado: individuoParetoSeleccionado
      };

      datosGraficoActuales = {
        historiaMejor: [],
        historiaPromedio: [],
        totalGeneraciones: datos.totalGeneraciones
      };

      actualizarLeyendaGrafico(true);

      dibujarGraficoFitness(
        elementosDOM.canvasFitness,
        null,
        null,
        datos.totalGeneraciones,
        datosMultiobjetivoActuales
      );

      // El dibujo del modelo se ejecuta de forma segura en el hilo principal.
      const genomaADibujar = individuoParetoSeleccionado ? individuoParetoSeleccionado.genoma : datos.mejorGenoma;
      if (genomaADibujar && ultimaEntradaModelo !== null && modeloActual.dibujar) {
        modeloActual.dibujar(
          genomaADibujar,
          ultimaEntradaModelo,
          elementosDOM.contenedorDibujoModelo,
          {
            fitnessInicialAzar: datos.fitnessInicialAzar,
            genomaInicialAzar: datos.genomaInicialAzar
          }
        );
        elementosDOM.textoDescribirModelo.textContent = modeloActual.describir(
          genomaADibujar,
          ultimaEntradaModelo
        );
      }

      if (datos.completado) {
        actualizarBotonesControl("DETENIDO", elementosDOM, elementosDOM.textoEstado);
        elementosDOM.textoEstado.textContent = `✓ Optimización finalizada con éxito (${numSoluciones} soluciones en el Frente de Pareto)`;
      }
    } else {
      // Modo Monobjetivo tradicional con gráfico de convergencia escalar.
      if (elementosDOM.tituloGrafico) {
        elementosDOM.tituloGrafico.textContent = "📈 Curva de Convergencia del Fitness (Menor = Mejor)";
      }
      elementosDOM.etiquetaMejorFitness.textContent = `Fitness: ${typeof datos.mejorFitness === "number" ? datos.mejorFitness.toFixed(4) : datos.mejorFitness} (${datos.motorTipo || "Auto"})`;

      datosMultiobjetivoActuales = null;
      individuoParetoSeleccionado = null;
      actualizarLeyendaGrafico(false);

      datosGraficoActuales = {
        historiaMejor: datos.historiaMejor,
        historiaPromedio: datos.historiaPromedio,
        totalGeneraciones: datos.totalGeneraciones
      };

      dibujarGraficoFitness(
        elementosDOM.canvasFitness,
        datos.historiaMejor,
        datos.historiaPromedio,
        datos.totalGeneraciones
      );

      // El dibujo del modelo se ejecuta de forma segura en el hilo principal.
      if (datos.mejorGenoma && ultimaEntradaModelo !== null && modeloActual.dibujar) {
        modeloActual.dibujar(
          datos.mejorGenoma,
          ultimaEntradaModelo,
          elementosDOM.contenedorDibujoModelo,
          {
            fitnessInicialAzar: datos.fitnessInicialAzar,
            genomaInicialAzar: datos.genomaInicialAzar
          }
        );
        elementosDOM.textoDescribirModelo.textContent = modeloActual.describir(
          datos.mejorGenoma,
          ultimaEntradaModelo
        );
      }

      if (datos.completado) {
        actualizarBotonesControl("DETENIDO", elementosDOM, elementosDOM.textoEstado);
        elementosDOM.textoEstado.textContent = `✓ Optimización finalizada con éxito (${datos.motorTipo || "Completado"})`;
      }
    }
  } else if (datos.tipo === "estado") {
    actualizarBotonesControl(datos.estado, elementosDOM, elementosDOM.textoEstado);
  }
}

// Inicia una corrida de optimización enviando la configuración al Worker o ejecutando el fallback local.
function iniciarCorrida() {
  try {
    mostrarAlerta(null, elementosDOM.contenedorAlerta);
    const configMotor = obtenerParametrosMotor();
    const entradaModelo = obtenerDatosEntradaModelo(modeloActual);
    ultimaEntradaModelo = entradaModelo;

    // Limpieza de selecciones e histórico multiobjetivo previo.
    individuoParetoSeleccionado = null;
    datosMultiobjetivoActuales = null;

    // Persistencia automática de la última configuración válida.
    guardarEstadoApp();

    actualizarBotonesControl("CORRIENDO", elementosDOM, elementosDOM.textoEstado);
    elementosDOM.barraProgreso.style.width = "0%";
    elementosDOM.textoGeneracion.textContent = `Gen 0 / ${configMotor.generaciones}`;
    elementosDOM.etiquetaMejorFitness.textContent = "Calculando...";

    const definicionDinamica = modeloActual.esDinamico ? modeloActual.definicionCruda : null;

    if (workerOptimizacion) {
      workerOptimizacion.postMessage({
        comando: "iniciar",
        config: configMotor,
        modeloId: modeloActual.id,
        entrada: entradaModelo,
        definicionModeloDinamico: definicionDinamica
      });
    } else {
      // Fallback local en hilo principal si el navegador restringe workers.
      motorFallbackLocal = new Motor(configMotor);
      motorFallbackLocal.correr(modeloActual, entradaModelo, (progreso) => {
        procesarMensajeWorker({
          data: {
            tipo: "progreso",
            motorTipo: "JavaScript (Hilo Principal)",
            ...progreso
          }
        });
      });
    }
  } catch (error) {
    mostrarAlerta(error.message, elementosDOM.contenedorAlerta);
    actualizarBotonesControl("DETENIDO", elementosDOM, elementosDOM.textoEstado);
  }
}

// Pausa o reanuda la simulación según el estado actual.
function alternarPausa() {
  const estaPausado = elementosDOM.btnPausar.textContent.includes("Reanudar");
  const comando = estaPausado ? "reanudar" : "pausar";

  if (workerOptimizacion) {
    workerOptimizacion.postMessage({ comando });
  } else if (motorFallbackLocal) {
    if (estaPausado) motorFallbackLocal.reanudar();
    else motorFallbackLocal.pausar();
    actualizarBotonesControl(estaPausado ? "CORRIENDO" : "PAUSADO", elementosDOM, elementosDOM.textoEstado);
  }
}

// Detiene la optimización evolutiva en progreso.
function detenerCorrida() {
  if (workerOptimizacion) {
    workerOptimizacion.postMessage({ comando: "detener" });
  } else if (motorFallbackLocal) {
    motorFallbackLocal.detener();
  }
  actualizarBotonesControl("DETENIDO", elementosDOM, elementosDOM.textoEstado);
  elementosDOM.textoEstado.textContent = "Simulación detenida por el usuario";
}

// Genera y asigna una nueva semilla pseudoaleatoria reproducible.
function generarNuevaSemilla() {
  const semilla = Math.floor(Math.random() * 900000) + 100000;
  elementosDOM.inputSemilla.value = semilla;
}

// Guarda la configuración actual de parámetros y modelo en localStorage.
function guardarEstadoApp() {
  try {
    const datosEntrada = obtenerDatosEntradaModelo(modeloActual);
    const config = {
      modeloId: modeloActual.id,
      poblacion: elementosDOM.inputPoblacion.value,
      generaciones: elementosDOM.inputGeneraciones.value,
      mutacion: elementosDOM.inputMutacion.value,
      elitismo: elementosDOM.inputElitismo.value,
      torneo: elementosDOM.inputTorneo.value,
      replicas: elementosDOM.inputReplicasRuido.value,
      semilla: elementosDOM.inputSemilla.value,
      entradasModelos: {}
    };
    config.entradasModelos[modeloActual.id] = datosEntrada;
    guardarConfiguracion(config);
  } catch (error) {
    // Si la entrada aún no es válida no se persiste.
  }
}

// Restaura la configuración guardada desde localStorage al iniciar la aplicación.
function restaurarEstadoApp() {
  const guardado = cargarConfiguracion();
  if (!guardado) {
    construirFormularioModelo(modeloActual, elementosDOM.contenedorFormularioModelo, null, elementosDOM.contenedorAlerta);
    return;
  }

  if (guardado.poblacion) elementosDOM.inputPoblacion.value = guardado.poblacion;
  if (guardado.generaciones) elementosDOM.inputGeneraciones.value = guardado.generaciones;
  if (guardado.mutacion) elementosDOM.inputMutacion.value = guardado.mutacion;
  if (guardado.elitismo) elementosDOM.inputElitismo.value = guardado.elitismo;
  if (guardado.torneo) elementosDOM.inputTorneo.value = guardado.torneo;
  if (guardado.replicas) elementosDOM.inputReplicasRuido.value = guardado.replicas;
  if (guardado.semilla) elementosDOM.inputSemilla.value = guardado.semilla;

  if (guardado.modeloId) {
    const encontrado = obtenerModeloPorId(guardado.modeloId);
    if (encontrado) {
      modeloActual = encontrado;
      window.__modeloActualId = modeloActual.id;
      elementosDOM.selectorModelo.value = modeloActual.id;
      elementosDOM.descripcionModelo.textContent = modeloActual.descripcion;
      actualizarToolbar();
    }
  }

  const valoresModelo = guardado.entradasModelos ? guardado.entradasModelos[modeloActual.id] : null;
  construirFormularioModelo(modeloActual, elementosDOM.contenedorFormularioModelo, valoresModelo, elementosDOM.contenedorAlerta);
}

// Sincroniza la visibilidad de las acciones de la barra de herramientas de simulación.
function actualizarToolbar() {
  actualizarToolbarAcciones(modeloActual, {
    btnEditar: elementosDOM.btnEditarModelo,
    btnRenombrar: elementosDOM.btnRenombrarModelo,
    btnEliminar: elementosDOM.btnEliminarModelo,
    btnCopiar: elementosDOM.btnCopiarModelo,
    btnExportar: elementosDOM.btnExportarModelo,
    btnGuardarPreset: elementosDOM.btnGuardarPreset
  });
}

// Rellena el selector desplegable con la lista actualizada de modelos y opcionalmente selecciona uno.
function actualizarSelectorModelos(idSeleccionar = null) {
  elementosDOM.selectorModelo.innerHTML = "";
  MODELOS.forEach((mod) => {
    const opcion = document.createElement("option");
    opcion.value = mod.id;
    opcion.textContent = mod.esDinamico ? `✨ ${mod.nombre} (Dinámico)` : mod.nombre;
    elementosDOM.selectorModelo.appendChild(opcion);
  });

  if (idSeleccionar) {
    const encontrado = obtenerModeloPorId(idSeleccionar);
    if (encontrado) modeloActual = encontrado;
  }

  elementosDOM.selectorModelo.value = modeloActual.id;
  window.__modeloActualId = modeloActual.id;
  elementosDOM.descripcionModelo.textContent = modeloActual.descripcion;
  actualizarToolbar();
  datosMultiobjetivoActuales = null;
  individuoParetoSeleccionado = null;
  if (elementosDOM.tituloGrafico) {
    elementosDOM.tituloGrafico.textContent = "📈 Curva de Convergencia del Fitness (Menor = Mejor)";
  }
  actualizarLeyendaGrafico(false);
  dibujarGraficoFitness(elementosDOM.canvasFitness, [], [], 200);
  construirFormularioModelo(modeloActual, elementosDOM.contenedorFormularioModelo, null, elementosDOM.contenedorAlerta);
  mostrarSolucionInicialModelo();
}

// Inicializa el selector desplegable con los modelos registrados y sus eventos de cambio.
function inicializarSelectorModelos() {
  actualizarSelectorModelos(modeloActual.id);

  elementosDOM.selectorModelo.addEventListener("change", (e) => {
    modeloActual = obtenerModeloPorId(e.target.value);
    window.__modeloActualId = modeloActual.id;
    elementosDOM.descripcionModelo.textContent = modeloActual.descripcion;
    actualizarToolbar();
    construirFormularioModelo(modeloActual, elementosDOM.contenedorFormularioModelo, null, elementosDOM.contenedorAlerta);
    mostrarSolucionInicialModelo();
  });
}

// Renderiza una solución inicial o canónica en el contenedor visual para previsualizar inmediatamente el modelo.
function mostrarSolucionInicialModelo() {
  try {
    const entrada = obtenerDatosEntradaModelo(modeloActual);
    ultimaEntradaModelo = entrada;
    let genomaInicial = null;

    if (modeloActual.esDinamico) {
      // Para modelos dinámicos, el genoma inicial se fija en el punto medio de cada variable.
      const defGenes = modeloActual.crearGenoma();
      genomaInicial = defGenes.map(g => (g.min + g.max) / 2);
    } else if (modeloActual.id === "pata-jansen") {
      genomaInicial = [38.0, 7.8, 41.5, 39.3, 40.1, 55.8, 39.4, 36.7, 65.7, 49.0, 50.0, 61.9];
    } else if (modeloActual.id === "brazo-robotico") {
      genomaInicial = [30.0, -45.0, 30.0];
    } else if (modeloActual.id === "cohete-landing") {
      genomaInicial = [12000, 10000, 8000, 6000, -2.0, 0.0, 2.0, 0.0];
    } else if (modeloActual.id === "controlador-pid") {
      genomaInicial = [6.0, 2.5, 1.2];
    } else if (modeloActual.id === "pata-caminante") {
      genomaInicial = [-1.8, 0.5, 3.0, 2.5, 3.0, 0.0];
    } else if (modeloActual.id === "balanceo-fases-trifasico") {
      const lineas = entrada.circuitos || [];
      genomaInicial = lineas.map(() => 0);
    }

    if (genomaInicial && modeloActual.dibujar) {
      modeloActual.dibujar(genomaInicial, entrada, elementosDOM.contenedorDibujoModelo);
      elementosDOM.textoDescribirModelo.textContent = modeloActual.describir(genomaInicial, entrada);
    }
  } catch (error) {
    // Si los campos de entrada aún están en construcción se omite silenciosamente.
  }
}

// Procesa el guardado del modelo creado o modificado en el constructor low-code y lo persiste.
function procesarGuardadoModeloDinamico() {
  try {
    mostrarAlerta(null, elementosModal.alerta);
    const defCruda = extraerDefinicionModeloDesdeUI(elementosModal);
    validarDefinicionModelo(defCruda);

    const esEdicion = elementosModal.modal.dataset.modo === "edicion";
    if (esEdicion && elementosModal.modal.dataset.modeloId) {
      defCruda.id = elementosModal.modal.dataset.modeloId;
    }

    const modeloCompilado = compilarModeloDinamico(defCruda);
    guardarUnModeloDinamico(modeloCompilado.definicionCruda);
    registrarModeloDinamico(modeloCompilado);

    // Notifica al Web Worker para que registre el nuevo evaluador compilado.
    if (workerOptimizacion) {
      workerOptimizacion.postMessage({
        comando: "registrarModeloDinamico",
        definicion: modeloCompilado.definicionCruda
      });
    }

    // Actualiza la lista desplegable y selecciona el modelo recién guardado.
    actualizarSelectorModelos(modeloCompilado.id);
    cerrarModalConstructor(elementosModal);
    mostrarToast(esEdicion ? `✓ Simulación '${modeloCompilado.nombre}' actualizada` : `✓ Simulación '${modeloCompilado.nombre}' creada`);
  } catch (error) {
    mostrarAlerta(error.message, elementosModal.alerta);
  }
}

// Duplica una simulación existente (nativa o dinámica) y genera una nueva variante modificable.
function procesarCopiarSimulacion(idModeloACopiar = null) {
  const objetivo = idModeloACopiar ? obtenerModeloPorId(idModeloACopiar) : modeloActual;
  if (!objetivo) return;

  let defNueva;
  if (objetivo.esDinamico && objetivo.definicionCruda) {
    defNueva = clonarModeloDinamico(objetivo.definicionCruda);
  } else {
    // Convierte el modelo nativo a una definición dinámica clonada para permitir experimentación.
    const genes = objetivo.crearGenoma ? objetivo.crearGenoma() : [];
    defNueva = {
      nombre: `${objetivo.nombre} (Copia)`,
      descripcion: `Variante personalizada basada en ${objetivo.nombre}. Modifique las variables y función de evaluación.`,
      variables: genes.map((g, i) => ({
        nombre: g.nombre || `var${i + 1}`,
        tipo: g.tipo || "continuo",
        min: g.min !== undefined ? g.min : 0,
        max: g.max !== undefined ? g.max : 100
      })),
      codigoEvaluacion: `// Definición basada en ${objetivo.nombre}\n// Variables disponibles en 'vars':\nlet coste = 0;\nfor (const k in vars) {\n  coste += Math.pow(vars[k], 2);\n}\nreturn Math.sqrt(coste);`
    };
    defNueva.id = `dinamico-${objetivo.id}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  const compilado = compilarModeloDinamico(defNueva);
  guardarUnModeloDinamico(compilado.definicionCruda);
  registrarModeloDinamico(compilado);

  if (workerOptimizacion) {
    workerOptimizacion.postMessage({
      comando: "registrarModeloDinamico",
      definicion: compilado.definicionCruda
    });
  }

  actualizarSelectorModelos(compilado.id);
  mostrarToast(`📑 Simulación '${compilado.nombre}' creada con éxito`);
}

// Procesa el renombrado de un modelo dinámico activo.
function procesarRenombrarConfirmacion() {
  const id = elementosRenombrar.modal.dataset.modeloId || modeloActual.id;
  const modelo = obtenerModeloPorId(id);
  if (!modelo || !modelo.esDinamico) return;

  const nuevoNombre = elementosRenombrar.inputNombre.value.trim();
  const nuevaDesc = elementosRenombrar.inputDesc.value.trim();
  if (!nuevoNombre) {
    alert("El nombre de la simulación no puede estar vacío.");
    return;
  }

  const defActualizada = renombrarModeloDinamico(modelo.definicionCruda, nuevoNombre, nuevaDesc);
  const compilado = compilarModeloDinamico(defActualizada);
  guardarUnModeloDinamico(compilado.definicionCruda);
  registrarModeloDinamico(compilado);

  if (workerOptimizacion) {
    workerOptimizacion.postMessage({
      comando: "registrarModeloDinamico",
      definicion: compilado.definicionCruda
    });
  }

  actualizarSelectorModelos(compilado.id);
  cerrarModalRenombrar(elementosRenombrar);
  mostrarToast(`🏷️ Simulación renombrada a '${compilado.nombre}'`);
}

// Descarga un archivo JSON en el navegador del usuario a partir de un objeto serializable.
function descargarArchivoJSON(nombreArchivo, objetoDatos) {
  const json = exportarSimulacionJSON(objetoDatos);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith(".json") ? nombreArchivo : `${nombreArchivo}.json`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

// Exporta la definición de la simulación actualmente activa a un archivo JSON descargable.
function procesarExportarSimulacionActual() {
  if (!modeloActual) return;
  const objeto = modeloActual.esDinamico
    ? modeloActual.definicionCruda
    : {
        tipo: "modelo-nativo",
        id: modeloActual.id,
        nombre: modeloActual.nombre,
        descripcion: modeloActual.descripcion,
        variables: (modeloActual.crearGenoma ? modeloActual.crearGenoma() : []).map((g, i) => ({
          nombre: g.nombre || `var${i + 1}`,
          tipo: g.tipo || "continuo",
          min: g.min,
          max: g.max
        }))
      };
  descargarArchivoJSON(`${modeloActual.id}-export.json`, objeto);
  mostrarToast(`📤 '${modeloActual.nombre}' exportado correctamente`);
}

// Procesa la importación de una simulación o preset desde archivo JSON o texto pegado.
function procesarImportarConfirmacion() {
  const archivo = elementosImportar.inputArchivo.files[0];
  const textoPegado = elementosImportar.textarea.value.trim();

  const procesarContenidoJSON = (jsonString) => {
    try {
      mostrarAlerta(null, elementosImportar.alerta);
      const resultado = importarSimulacionJSON(jsonString);

      if (resultado.tipo === "modelo") {
        const modeloCompilado = compilarModeloDinamico(resultado.datos);
        guardarUnModeloDinamico(modeloCompilado.definicionCruda);
        registrarModeloDinamico(modeloCompilado);

        if (workerOptimizacion) {
          workerOptimizacion.postMessage({
            comando: "registrarModeloDinamico",
            definicion: modeloCompilado.definicionCruda
          });
        }

        actualizarSelectorModelos(modeloCompilado.id);
        cerrarModalImportar(elementosImportar);
        mostrarToast(`📥 Modelo '${modeloCompilado.nombre}' importado con éxito`);
      } else if (resultado.tipo === "preset") {
        guardarUnPreset(resultado.datos);
        aplicarPreset(resultado.datos);
        cerrarModalImportar(elementosImportar);
        mostrarToast(`📥 Preset '${resultado.datos.nombre}' importado y aplicado`);
      }
    } catch (error) {
      mostrarAlerta(error.message, elementosImportar.alerta);
    }
  };

  if (archivo) {
    const lector = new FileReader();
    lector.onload = (e) => procesarContenidoJSON(e.target.result);
    lector.onerror = () => mostrarAlerta("Error al leer el archivo seleccionado.", elementosImportar.alerta);
    lector.readAsText(archivo);
  } else if (textoPegado) {
    procesarContenidoJSON(textoPegado);
  } else {
    mostrarAlerta("Seleccione un archivo .json o pegue el contenido JSON para importar.", elementosImportar.alerta);
  }
}

// Procesa el guardado del estado actual del modelo y motor como un Preset con nombre.
function procesarGuardarPresetConfirmacion() {
  const nombre = elementosPreset.inputNombre.value.trim() || `Preset ${modeloActual.nombre} (${new Date().toLocaleTimeString()})`;
  try {
    const nuevoPreset = {
      id: `preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nombre,
      fechaCreacion: Date.now(),
      modeloId: modeloActual.id,
      entradasModelo: obtenerDatosEntradaModelo(modeloActual),
      parametrosMotor: obtenerParametrosMotor()
    };
    guardarUnPreset(nuevoPreset);
    cerrarModalGuardarPreset(elementosPreset);
    mostrarToast(`⭐ Preset '${nombre}' guardado`);
  } catch (error) {
    alert(`Error al guardar el preset: ${error.message}`);
  }
}

// Aplica los parámetros de motor y entradas de simulación contenidas en un Preset guardado.
function aplicarPreset(preset) {
  if (!preset || !preset.modeloId) return;
  actualizarSelectorModelos(preset.modeloId);

  // Restaurar parámetros del motor
  if (preset.parametrosMotor) {
    const p = preset.parametrosMotor;
    if (p.tamanoPoblacion !== undefined) elementosDOM.inputPoblacion.value = p.tamanoPoblacion;
    if (p.generaciones !== undefined) elementosDOM.inputGeneraciones.value = p.generaciones;
    if (p.tasaMutacion !== undefined) elementosDOM.inputMutacion.value = p.tasaMutacion;
    if (p.elitismo !== undefined) elementosDOM.inputElitismo.value = p.elitismo;
    if (p.tamanoTorneo !== undefined) elementosDOM.inputTorneo.value = p.tamanoTorneo;
    if (p.replicasRuido !== undefined) elementosDOM.inputReplicasRuido.value = p.replicasRuido;
    if (p.semilla !== undefined) elementosDOM.inputSemilla.value = p.semilla;
  }

  // Restaurar formulario de entradas del modelo
  if (preset.entradasModelo) {
    construirFormularioModelo(modeloActual, elementosDOM.contenedorFormularioModelo, preset.entradasModelo, elementosDOM.contenedorAlerta);
  }

  mostrarSolucionInicialModelo();
  mostrarToast(`⭐ Preset '${preset.nombre}' cargado`);
}

// Abre la biblioteca general de simulaciones permitiendo cargar, editar, copiar o eliminar elementos.
function abrirBibliotecaSimulaciones() {
  const presets = cargarPresets();
  abrirModalBiblioteca(elementosBiblioteca, MODELOS, presets, (accion, id) => {
    if (accion === "cargar") {
      actualizarSelectorModelos(id);
      cerrarModalBiblioteca(elementosBiblioteca);
      mostrarToast(`✓ Modelo seleccionado`);
    } else if (accion === "copiar") {
      procesarCopiarSimulacion(id);
      cerrarModalBiblioteca(elementosBiblioteca);
    } else if (accion === "editar") {
      const mod = obtenerModeloPorId(id);
      if (mod && mod.esDinamico) {
        cerrarModalBiblioteca(elementosBiblioteca);
        abrirModalConstructor(elementosModal, mod.definicionCruda, true);
      }
    } else if (accion === "renombrar") {
      const mod = obtenerModeloPorId(id);
      if (mod && mod.esDinamico) {
        cerrarModalBiblioteca(elementosBiblioteca);
        abrirModalRenombrar(elementosRenombrar, mod);
      }
    } else if (accion === "exportar") {
      const mod = obtenerModeloPorId(id);
      if (mod) {
        const obj = mod.esDinamico ? mod.definicionCruda : { tipo: "modelo-nativo", id: mod.id, nombre: mod.nombre, descripcion: mod.descripcion };
        descargarArchivoJSON(`${mod.id}-export.json`, obj);
        mostrarToast(`📤 Modelo exportado`);
      }
    } else if (accion === "eliminar") {
      const mod = obtenerModeloPorId(id);
      if (mod && mod.esDinamico && window.confirm(`¿Eliminar la simulación '${mod.nombre}'?`)) {
        eliminarModeloDinamico(id);
        eliminarModeloDinamicoDelRegistro(id);
        if (modeloActual.id === id) {
          actualizarSelectorModelos(MODELOS[0].id);
        }
        mostrarToast(`🗑️ Simulación eliminada`);
        abrirBibliotecaSimulaciones();
      }
    } else if (accion === "cargarPreset") {
      const pres = presets.find(p => p.id === id);
      if (pres) {
        cerrarModalBiblioteca(elementosBiblioteca);
        aplicarPreset(pres);
      }
    } else if (accion === "exportarPreset") {
      const pres = presets.find(p => p.id === id);
      if (pres) {
        descargarArchivoJSON(`${pres.nombre.replace(/\s+/g, "_")}-preset.json`, pres);
        mostrarToast(`📤 Preset exportado`);
      }
    } else if (accion === "eliminarPreset") {
      if (window.confirm("¿Eliminar este preset de escenario?")) {
        eliminarPreset(id);
        mostrarToast("🗑️ Preset eliminado");
        abrirBibliotecaSimulaciones();
      }
    }
  });
}

// Aplica y persiste el modo de tema (light, dark, auto).
function cambiarModoTema(modo) {
  const temaActual = cargarPreferenciaTema();
  temaActual.modo = modo;
  guardarPreferenciaTema(temaActual);
  aplicarTemaColor(temaActual.modo, temaActual.acento);
}

// Aplica y persiste la paleta tonal de acento de Material 3.
function cambiarAcentoColor(acento) {
  const temaActual = cargarPreferenciaTema();
  temaActual.acento = acento;
  guardarPreferenciaTema(temaActual);
  aplicarTemaColor(temaActual.modo, temaActual.acento);
}

// Solicita confirmación y elimina un modelo dinámico del almacenamiento y del registro activo.
function procesarEliminacionModeloDinamico() {
  if (!modeloActual || !modeloActual.esDinamico) return;

  const confirmar = window.confirm(`¿Está seguro de que desea eliminar el modelo '${modeloActual.nombre}'?`);
  if (!confirmar) return;

  eliminarModeloDinamico(modeloActual.id);
  eliminarModeloDinamicoDelRegistro(modeloActual.id);
  actualizarSelectorModelos(MODELOS[0].id);
  mostrarToast(`🗑️ Modelo '${modeloActual.nombre}' eliminado`);
}

// Permite al usuario hacer clic en cualquier punto del Frente de Pareto para previsualizar instantáneamente ese mecanismo.
function manejarClickCanvasFitness(e) {
  if (!datosMultiobjetivoActuales || !datosMultiobjetivoActuales.esMultiobjetivo) return;

  const seleccionado = obtenerPuntoParetoCercano(elementosDOM.canvasFitness, e.clientX, e.clientY);
  if (seleccionado) {
    individuoParetoSeleccionado = seleccionado;
    datosMultiobjetivoActuales.individuoSeleccionado = seleccionado;

    dibujarGraficoFitness(
      elementosDOM.canvasFitness,
      null,
      null,
      datosGraficoActuales.totalGeneraciones,
      datosMultiobjetivoActuales
    );

    if (ultimaEntradaModelo !== null && modeloActual.dibujar) {
      modeloActual.dibujar(
        seleccionado.genoma,
        ultimaEntradaModelo,
        elementosDOM.contenedorDibujoModelo
      );
      elementosDOM.textoDescribirModelo.textContent = modeloActual.describir(
        seleccionado.genoma,
        ultimaEntradaModelo
      );
    }

    const fit0 = Array.isArray(seleccionado.fitness) ? seleccionado.fitness[0].toFixed(3) : seleccionado.fitness;
    const fit1 = Array.isArray(seleccionado.fitness) && seleccionado.fitness.length > 1 ? seleccionado.fitness[1].toFixed(3) : "";
    elementosDOM.etiquetaMejorFitness.textContent = `★ Solución: [${fit0}, ${fit1}]`;
  }
}

// Actualiza el puntero del mouse sobre el canvas de Pareto al aproximarse a una solución óptima.
function manejarMouseMoveCanvasFitness(e) {
  if (!datosMultiobjetivoActuales || !datosMultiobjetivoActuales.esMultiobjetivo) return;
  const cercano = obtenerPuntoParetoCercano(elementosDOM.canvasFitness, e.clientX, e.clientY);
  elementosDOM.canvasFitness.style.cursor = cercano ? "pointer" : "crosshair";
}

// Registra todos los escuchadores de eventos interactivos del DOM principal, modales y temas.
function registrarEventos() {
  elementosDOM.btnCorrer.addEventListener("click", iniciarCorrida);
  elementosDOM.btnPausar.addEventListener("click", alternarPausa);
  elementosDOM.btnDetener.addEventListener("click", detenerCorrida);
  elementosDOM.btnNuevaSemilla.addEventListener("click", generarNuevaSemilla);

  // Interacción táctil y de clic sobre el Canvas de convergencia/Pareto:
  elementosDOM.canvasFitness.addEventListener("click", manejarClickCanvasFitness);
  elementosDOM.canvasFitness.addEventListener("mousemove", manejarMouseMoveCanvasFitness);

  // Controles de Modo de Color y Paletas de Acento Material 3:
  if (elementosDOM.btnTemaClaro) elementosDOM.btnTemaClaro.addEventListener("click", () => cambiarModoTema("light"));
  if (elementosDOM.btnTemaOscuro) elementosDOM.btnTemaOscuro.addEventListener("click", () => cambiarModoTema("dark"));
  if (elementosDOM.btnTemaAuto) elementosDOM.btnTemaAuto.addEventListener("click", () => cambiarModoTema("auto"));

  document.querySelectorAll(".btn-dot-paleta").forEach(btn => {
    btn.addEventListener("click", () => cambiarAcentoColor(btn.dataset.color));
  });

  // Barra de herramientas de simulación (CRUD):
  elementosDOM.btnAbrirConstructor.addEventListener("click", () => abrirModalConstructor(elementosModal, null, false));
  if (elementosDOM.btnEditarModelo) {
    elementosDOM.btnEditarModelo.addEventListener("click", () => {
      if (modeloActual.esDinamico) abrirModalConstructor(elementosModal, modeloActual.definicionCruda, true);
    });
  }
  if (elementosDOM.btnCopiarModelo) {
    elementosDOM.btnCopiarModelo.addEventListener("click", () => procesarCopiarSimulacion());
  }
  if (elementosDOM.btnRenombrarModelo) {
    elementosDOM.btnRenombrarModelo.addEventListener("click", () => {
      if (modeloActual.esDinamico) abrirModalRenombrar(elementosRenombrar, modeloActual);
    });
  }
  if (elementosDOM.btnGuardarPreset) {
    elementosDOM.btnGuardarPreset.addEventListener("click", () => abrirModalGuardarPreset(elementosPreset, `Preset ${modeloActual.nombre}`));
  }
  if (elementosDOM.btnExportarModelo) {
    elementosDOM.btnExportarModelo.addEventListener("click", procesarExportarSimulacionActual);
  }
  if (elementosDOM.btnImportarModelo) {
    elementosDOM.btnImportarModelo.addEventListener("click", () => abrirModalImportar(elementosImportar));
  }
  if (elementosDOM.btnEliminarModelo) {
    elementosDOM.btnEliminarModelo.addEventListener("click", procesarEliminacionModeloDinamico);
  }
  if (elementosDOM.btnAbrirBiblioteca) {
    elementosDOM.btnAbrirBiblioteca.addEventListener("click", abrirBibliotecaSimulaciones);
  }

  // Modal Constructor:
  elementosModal.btnCerrar.addEventListener("click", () => cerrarModalConstructor(elementosModal));
  elementosModal.btnCancelar.addEventListener("click", () => cerrarModalConstructor(elementosModal));
  elementosModal.btnGuardar.addEventListener("click", procesarGuardadoModeloDinamico);
  elementosModal.btnAgregarVar.addEventListener("click", () => {
    agregarFilaVariableConstructor(elementosModal.tbody, {
      nombre: `var${elementosModal.tbody.children.length + 1}`,
      tipo: "continuo",
      min: 0,
      max: 100
    });
  });

  // Modal Renombrar:
  if (elementosRenombrar.btnCerrar) elementosRenombrar.btnCerrar.addEventListener("click", () => cerrarModalRenombrar(elementosRenombrar));
  if (elementosRenombrar.btnCancelar) elementosRenombrar.btnCancelar.addEventListener("click", () => cerrarModalRenombrar(elementosRenombrar));
  if (elementosRenombrar.btnConfirmar) elementosRenombrar.btnConfirmar.addEventListener("click", procesarRenombrarConfirmacion);

  // Modal Importar:
  if (elementosImportar.btnCerrar) elementosImportar.btnCerrar.addEventListener("click", () => cerrarModalImportar(elementosImportar));
  if (elementosImportar.btnCancelar) elementosImportar.btnCancelar.addEventListener("click", () => cerrarModalImportar(elementosImportar));
  if (elementosImportar.btnConfirmar) elementosImportar.btnConfirmar.addEventListener("click", procesarImportarConfirmacion);

  // Modal Guardar Preset:
  if (elementosPreset.btnCerrar) elementosPreset.btnCerrar.addEventListener("click", () => cerrarModalGuardarPreset(elementosPreset));
  if (elementosPreset.btnCancelar) elementosPreset.btnCancelar.addEventListener("click", () => cerrarModalGuardarPreset(elementosPreset));
  if (elementosPreset.btnConfirmar) elementosPreset.btnConfirmar.addEventListener("click", procesarGuardarPresetConfirmacion);

  // Modal Biblioteca:
  if (elementosBiblioteca.btnCerrar) elementosBiblioteca.btnCerrar.addEventListener("click", () => cerrarModalBiblioteca(elementosBiblioteca));
  if (elementosBiblioteca.btnCerrarPie) elementosBiblioteca.btnCerrarPie.addEventListener("click", () => cerrarModalBiblioteca(elementosBiblioteca));
  if (elementosBiblioteca.btnNuevoDesdeBiblioteca) {
    elementosBiblioteca.btnNuevoDesdeBiblioteca.addEventListener("click", () => {
      cerrarModalBiblioteca(elementosBiblioteca);
      abrirModalConstructor(elementosModal, null, false);
    });
  }
  if (elementosBiblioteca.btnImportarDesdeBiblioteca) {
    elementosBiblioteca.btnImportarDesdeBiblioteca.addEventListener("click", () => {
      cerrarModalBiblioteca(elementosBiblioteca);
      abrirModalImportar(elementosImportar);
    });
  }

  // Cierre de modales con Escape y clic en el telón de fondo (backdrop)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarModalConstructor(elementosModal);
      cerrarModalRenombrar(elementosRenombrar);
      cerrarModalImportar(elementosImportar);
      cerrarModalGuardarPreset(elementosPreset);
      cerrarModalBiblioteca(elementosBiblioteca);
    }
  });

  const modales = [
    elementosModal.modal,
    elementosRenombrar.modal,
    elementosImportar.modal,
    elementosPreset.modal,
    elementosBiblioteca.modal
  ];
  modales.forEach(m => {
    if (m) {
      m.addEventListener("click", (e) => {
        if (e.target === m) {
          m.style.display = "none";
        }
      });
    }
  });

  // Redibujado responsivo del gráfico Canvas ante cambios de tamaño de ventana:
  window.addEventListener("resize", () => {
    if (datosMultiobjetivoActuales && datosMultiobjetivoActuales.esMultiobjetivo) {
      dibujarGraficoFitness(
        elementosDOM.canvasFitness,
        null,
        null,
        datosGraficoActuales.totalGeneraciones,
        datosMultiobjetivoActuales
      );
    } else {
      dibujarGraficoFitness(
        elementosDOM.canvasFitness,
        datosGraficoActuales.historiaMejor,
        datosGraficoActuales.historiaPromedio,
        datosGraficoActuales.totalGeneraciones
      );
    }
  });
}

// Inicialización de la aplicación al cargar el script.
function inicializarApp() {
  // 1. Carga de preferencias de tema y paleta Material 3
  const temaPreferido = cargarPreferenciaTema();
  aplicarTemaColor(temaPreferido.modo, temaPreferido.acento);

  // 2. Carga y registro de modelos dinámicos guardados en localStorage.
  const modelosGuardados = cargarModelosDinamicos();
  cargarModelosDinamicosEnRegistro(modelosGuardados);

  // 3. Inicialización del Web Worker y sincronización de modelos.
  inicializarWebWorker();

  // 4. Inicialización de interfaz y restauración de estado.
  inicializarSelectorModelos();
  restaurarEstadoApp();
  registrarEventos();
  dibujarGraficoFitness(elementosDOM.canvasFitness, [], [], 200);
  mostrarSolucionInicialModelo();
}

// Arranca la aplicación cuando el documento HTML está completamente parseado.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarApp);
} else {
  inicializarApp();
}
