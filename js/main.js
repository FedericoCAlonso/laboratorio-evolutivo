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
  eliminarModeloDinamico
} from "./storage.js";
import {
  mostrarAlerta,
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
  extraerDefinicionModeloDesdeUI
} from "./ui.js";
import { compilarModeloDinamico, validarDefinicionModelo } from "./builder.js";
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
  btnEliminarModelo: document.getElementById("btn-eliminar-modelo"),
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
      if (genomaADibujar && ultimaEntradaModelo !== null) {
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
      if (datos.mejorGenoma && ultimaEntradaModelo !== null) {
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
      actualizarBotonEliminarModelo();
    }
  }

  const valoresModelo = guardado.entradasModelos ? guardado.entradasModelos[modeloActual.id] : null;
  construirFormularioModelo(modeloActual, elementosDOM.contenedorFormularioModelo, valoresModelo, elementosDOM.contenedorAlerta);
}

// Actualiza la visibilidad del botón de eliminar según si el modelo seleccionado es dinámico o integrado.
function actualizarBotonEliminarModelo() {
  if (elementosDOM.btnEliminarModelo) {
    elementosDOM.btnEliminarModelo.style.display = modeloActual.esDinamico ? "inline-block" : "none";
  }
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
  actualizarBotonEliminarModelo();
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
    actualizarBotonEliminarModelo();
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

// Procesa el guardado del modelo creado en el constructor low-code y lo persiste.
function procesarGuardadoModeloDinamico() {
  try {
    mostrarAlerta(null, elementosModal.alerta);
    const defCruda = extraerDefinicionModeloDesdeUI(elementosModal);
    validarDefinicionModelo(defCruda);

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
  } catch (error) {
    mostrarAlerta(error.message, elementosModal.alerta);
  }
}

// Solicita confirmación y elimina un modelo dinámico del almacenamiento y del registro activo.
function procesarEliminacionModeloDinamico() {
  if (!modeloActual || !modeloActual.esDinamico) return;

  const confirmar = window.confirm(`¿Está seguro de que desea eliminar el modelo '${modeloActual.nombre}'?`);
  if (!confirmar) return;

  eliminarModeloDinamico(modeloActual.id);
  eliminarModeloDinamicoDelRegistro(modeloActual.id);
  actualizarSelectorModelos(MODELOS[0].id);
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

// Registra todos los escuchadores de eventos interactivos del DOM principal y modal.
function registrarEventos() {
  elementosDOM.btnCorrer.addEventListener("click", iniciarCorrida);
  elementosDOM.btnPausar.addEventListener("click", alternarPausa);
  elementosDOM.btnDetener.addEventListener("click", detenerCorrida);
  elementosDOM.btnNuevaSemilla.addEventListener("click", generarNuevaSemilla);

  // Interacción táctil y de clic sobre el Canvas de convergencia/Pareto:
  elementosDOM.canvasFitness.addEventListener("click", manejarClickCanvasFitness);
  elementosDOM.canvasFitness.addEventListener("mousemove", manejarMouseMoveCanvasFitness);

  // Eventos del constructor de modelos low-code:
  elementosDOM.btnAbrirConstructor.addEventListener("click", () => abrirModalConstructor(elementosModal));
  elementosDOM.btnEliminarModelo.addEventListener("click", procesarEliminacionModeloDinamico);

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

  // Cerrar modal al presionar Escape o hacer clic fuera del diálogo
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elementosModal.modal.style.display !== "none") {
      cerrarModalConstructor(elementosModal);
    }
  });

  elementosModal.modal.addEventListener("click", (e) => {
    if (e.target === elementosModal.modal) {
      cerrarModalConstructor(elementosModal);
    }
  });

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
  // 1. Carga y registro de modelos dinámicos guardados en localStorage.
  const modelosGuardados = cargarModelosDinamicos();
  cargarModelosDinamicosEnRegistro(modelosGuardados);

  // 2. Inicialización del Web Worker y sincronización de modelos.
  inicializarWebWorker();

  // 3. Inicialización de interfaz y restauración de estado.
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
