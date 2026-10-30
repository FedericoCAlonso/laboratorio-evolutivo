// =========================================================================
// CAPA VIEWMODEL: GESTOR DE ESTADO REACTIVO Y COMANDOS DE SIMULACIÓN
// ARQUITECTURA MVVM - INTERMEDIARIO ENTRE MODELOS MATEMÁTICOS Y VISTAS UI
// =========================================================================

import { Motor } from "../core/motor.js";
import { MODELOS, obtenerModeloPorId, registrarModeloDinamico, eliminarModeloDinamicoDelRegistro, cargarModelosDinamicosEnRegistro } from "../models/index.js";
import { compilarModeloDinamico, validarDefinicionModelo, clonarModeloExistente } from "../builder.js";
import {
  guardarConfiguracion,
  cargarConfiguracion,
  cargarModelosDinamicos,
  guardarUnModeloDinamico,
  eliminarModeloDinamico,
  cargarPresets,
  guardarUnPreset,
  eliminarPreset as eliminarPresetStorage,
  guardarPreferenciaTema,
  cargarPreferenciaTema
} from "../storage.js";

// ViewModel principal de la aplicación que administra el ciclo de vida, la computación asíncrona y los eventos reactivos.
export class AppViewModel {
  // Inicializa el estado del ViewModel, sus escuchadores de eventos y el canal de Web Worker.
  constructor() {
    // Registro de escuchadores reactivos por nombre de evento.
    this.oyentes = new Map();

    // 1. Carga inicial de modelos dinámicos persistidos.
    const dinamicosPersistidos = cargarModelosDinamicos();
    cargarModelosDinamicosEnRegistro(dinamicosPersistidos);

    // 2. Modelo activo inicial (primer modelo registrado en el catálogo).
    this.modeloActual = MODELOS[0];

    // 3. Estado de la corrida de optimización.
    this.estadoSimulacion = "DETENIDO"; // 'DETENIDO' | 'CORRIENDO' | 'PAUSADO'
    this.progresoGeneracion = 0;
    this.totalGeneraciones = 100;
    this.tiempoInicio = null;
    this.mejorSolucion = null;
    this.frentePareto = [];
    this.poblacionActual = [];
    this.solucionParetoSeleccionada = null;
    this.historiaMejor = [];
    this.historiaPromedio = [];
    this.esMultiobjetivo = false;
    this.nombresObjetivos = [];
    this.motorTipo = "Auto";

    // 4. Parámetros de entrada actuales del modelo.
    this.entradasModelo = {};

    // 5. Configuración del motor genético (claves unificadas para Motor, Worker y Vistas).
    this.configMotor = {
      tamPoblacion: 80,
      tamanoPoblacion: 80,
      generaciones: 100,
      probCruzamiento: 0.85,
      probMutacion: 0.12,
      tasaMutacion: 0.12,
      elitismo: 2,
      esquemaSeleccion: "torneo",
      torneoK: 3,
      tamanoTorneo: 3,
      crossover: "sbx",
      sigmaMutacion: 0.1,
      semilla: 123456,
      replicasRuido: 3,
      nReplicasRuido: 3
    };

    // 6. Preferencias de interfaz Material 3.
    const temaGuardado = cargarPreferenciaTema();
    this.temaModo = temaGuardado?.modo || "auto";
    this.temaAcento = temaGuardado?.acento || "ocean";

    // 7. Instancias de cómputo en segundo plano.
    this.worker = null;
    this.motorFallbackLocal = null;

    // Inicializa el Worker o fallback.
    this._inicializarWorker();
  }

  // Registra una función de devolución de llamada para un evento específico.
  on(evento, callback) {
    if (!this.oyentes.has(evento)) {
      this.oyentes.set(evento, []);
    }
    this.oyentes.get(evento).push(callback);
  }

  // Desregistra un callback de un evento.
  off(evento, callback) {
    if (!this.oyentes.has(evento)) return;
    const lista = this.oyentes.get(evento).filter(cb => cb !== callback);
    this.oyentes.set(evento, lista);
  }

  // Emite una notificación reactiva a todos los suscriptores registrados para el evento.
  emit(evento, datos) {
    if (!this.oyentes.has(evento)) return;
    const lista = this.oyentes.get(evento);
    for (let i = 0; i < lista.length; i++) {
      try {
        lista[i](datos);
      } catch (err) {
        console.error(`[ViewModel] Error en listener del evento '${evento}':`, err);
      }
    }
  }

  // Configura el Web Worker con soporte de ES Modules y gestiona el canal postMessage.
  _inicializarWorker() {
    try {
      const workerUrl = new URL("../core/worker.js", import.meta.url);
      this.worker = new Worker(workerUrl, { type: "module" });

      this.worker.addEventListener("message", (evento) => {
        this._procesarMensajeWorker(evento.data);
      });

      this.worker.addEventListener("error", (error) => {
        console.warn("[ViewModel] Error capturado en Web Worker:", error.message);
        this.emit("error", { mensaje: error.message });
      });

      // Sincroniza los modelos dinámicos persistidos con el Web Worker.
      const dinamicos = cargarModelosDinamicos();
      dinamicos.forEach(def => {
        this.worker.postMessage({
          comando: "registrarModeloDinamico",
          definicion: def
        });
      });
    } catch (error) {
      console.warn("[ViewModel] Web Worker no disponible (posible protocolo file://). Fallback activo en hilo principal.");
      this.worker = null;
    }
  }

  // Procesa las notificaciones emitidas por el Web Worker o motor local y actualiza las propiedades del ViewModel.
  _procesarMensajeWorker(datos) {
    if (!datos) return;

    if (datos.tipo === "progreso") {
      this.progresoGeneracion = datos.generacion;
      this.totalGeneraciones = datos.totalGeneraciones;
      this.esMultiobjetivo = Boolean(datos.esMultiobjetivo);
      this.motorTipo = datos.motorTipo || (this.esMultiobjetivo ? "NSGA-II" : "Auto");

      if (this.esMultiobjetivo) {
        this.frentePareto = datos.frentePareto || [];
        this.poblacionActual = datos.poblacion || [];
        this.nombresObjetivos = datos.nombresObjetivos || this.modeloActual.nombresObjetivos || ["Objetivo 1", "Objetivo 2"];

        // Si no hay solución seleccionada fijada manualmente, se selecciona por defecto la primera del frente.
        if (!this.solucionParetoSeleccionada && this.frentePareto.length > 0) {
          this.solucionParetoSeleccionada = this.frentePareto[0];
        }

        const genomaActivo = this.solucionParetoSeleccionada ? this.solucionParetoSeleccionada.genoma : datos.mejorGenoma;
        this.mejorSolucion = {
          genoma: genomaActivo,
          fitness: this.solucionParetoSeleccionada ? this.solucionParetoSeleccionada.fitness : datos.mejorFitness,
          generacion: datos.generacion
        };
      } else {
        this.historiaMejor = datos.historiaMejor || [];
        this.historiaPromedio = datos.historiaPromedio || [];
        this.solucionParetoSeleccionada = null;
        this.frentePareto = [];
        this.poblacionActual = [];

        this.mejorSolucion = {
          genoma: datos.mejorGenoma,
          fitness: datos.mejorFitness,
          generacion: datos.generacion
        };
      }

      this.emit("progreso", {
        generacion: datos.generacion,
        totalGeneraciones: datos.totalGeneraciones,
        esMultiobjetivo: this.esMultiobjetivo,
        motorTipo: this.motorTipo,
        mejorSolucion: this.mejorSolucion,
        frentePareto: this.frentePareto,
        poblacion: this.poblacionActual,
        nombresObjetivos: this.nombresObjetivos,
        solucionParetoSeleccionada: this.solucionParetoSeleccionada,
        historiaMejor: this.historiaMejor,
        historiaPromedio: this.historiaPromedio,
        completado: Boolean(datos.completado)
      });

      if (datos.completado) {
        this.estadoSimulacion = "DETENIDO";
        this.emit("estadoCambiado", "DETENIDO");
        this.emit("finalizado", {
          esMultiobjetivo: this.esMultiobjetivo,
          mejorSolucion: this.mejorSolucion,
          frentePareto: this.frentePareto,
          motorTipo: this.motorTipo
        });
      }
    } else if (datos.tipo === "estado") {
      this.estadoSimulacion = datos.estado;
      this.emit("estadoCambiado", datos.estado);
    }
  }

  // Obtiene la lista completa de modelos registrados (nativos y dinámicos).
  obtenerModelos() {
    return [...MODELOS];
  }

  // Obtiene la lista de presets guardados en almacenamiento.
  obtenerPresets() {
    return cargarPresets();
  }

  // Cambia el modelo de optimización activo y notifica a las vistas.
  seleccionarModelo(modeloId) {
    const encontrado = obtenerModeloPorId(modeloId);
    if (!encontrado) return;

    this.modeloActual = encontrado;
    this.solucionParetoSeleccionada = null;
    this.frentePareto = [];
    this.poblacionActual = [];
    this.historiaMejor = [];
    this.historiaPromedio = [];

    // Guarda en storage la selección de modelo.
    this._guardarConfiguracionApp();

    this.emit("modeloCambiado", {
      modelo: this.modeloActual,
      genomaInicial: this.obtenerGenomaInicial(this.modeloActual, this.entradasModelo)
    });
  }

  // Devuelve un genoma inicial basado en el contrato del modelo (valores nominales o punto medio del dominio).
  obtenerGenomaInicial(modelo, entrada = {}) {
    if (!modelo) return null;

    if (typeof modelo.obtenerGenomaInicial === "function") {
      return modelo.obtenerGenomaInicial(entrada);
    }
    if (Array.isArray(modelo.genomaInicial)) {
      return [...modelo.genomaInicial];
    }

    const defGenes = typeof modelo.crearGenoma === "function"
      ? modelo.crearGenoma(entrada)
      : (modelo.variables || []);
    if (!Array.isArray(defGenes) || defGenes.length === 0) return null;

    return defGenes.map((g) => {
      if (g.valorNominal !== undefined && Number.isFinite(Number(g.valorNominal))) {
        return Number(g.valorNominal);
      }
      const min = Number(g.min ?? 0);
      const max = Number(g.max ?? 100);
      const medio = (min + max) / 2;
      return (g.tipo === "entero" || g.tipo === "categorico") ? Math.round(medio) : medio;
    });
  }

  // Actualiza los parámetros de entrada específicos del modelo activo.
  actualizarEntradasModelo(nuevasEntradas) {
    this.entradasModelo = { ...this.entradasModelo, ...nuevasEntradas };
    this._guardarConfiguracionApp();
    this.emit("entradasActualizadas", this.entradasModelo);
  }

  // Actualiza la configuración de parámetros del motor genético sincronizando alias de propiedades.
  actualizarConfigMotor(nuevaConfig = {}) {
    const fusion = { ...this.configMotor, ...nuevaConfig };
    const pob = nuevaConfig.tamanoPoblacion ?? nuevaConfig.tamPoblacion ?? fusion.tamPoblacion ?? 80;
    const mut = nuevaConfig.tasaMutacion ?? nuevaConfig.probMutacion ?? fusion.probMutacion ?? 0.12;
    const tor = nuevaConfig.tamanoTorneo ?? nuevaConfig.torneoK ?? fusion.torneoK ?? 3;
    const rep = nuevaConfig.nReplicasRuido ?? nuevaConfig.replicasRuido ?? fusion.replicasRuido ?? 3;

    this.configMotor = {
      ...fusion,
      tamPoblacion: pob,
      tamanoPoblacion: pob,
      probMutacion: mut,
      tasaMutacion: mut,
      torneoK: tor,
      tamanoTorneo: tor,
      replicasRuido: rep,
      nReplicasRuido: rep
    };
    this._guardarConfiguracionApp();
    this.emit("configMotorActualizada", this.configMotor);
  }

  // Genera un resumen estructurado de los genes del individuo activo para renderizar chips en la Vista.
  obtenerResumenGenomaActual(genomaExplicito = null) {
    const genoma = genomaExplicito || this.mejorSolucion?.genoma || this.obtenerGenomaInicial(this.modeloActual, this.entradasModelo);
    if (!Array.isArray(genoma) || !this.modeloActual) return [];

    const defs = typeof this.modeloActual.crearGenoma === "function"
      ? this.modeloActual.crearGenoma(this.entradasModelo)
      : (this.modeloActual.variables || []);

    return genoma.map((valor, idx) => {
      const def = defs[idx] || {};
      const nombre = def.nombre || `g${idx + 1}`;
      const etiqueta = def.etiqueta || nombre;
      const tipo = def.tipo || "continuo";
      const numVal = Number(valor);
      const valorFormateado = Number.isFinite(numVal)
        ? (tipo === "entero" || Number.isInteger(numVal) ? String(numVal) : numVal.toFixed(2))
        : String(valor);

      return {
        indice: idx,
        nombre,
        etiqueta,
        valor: numVal,
        valorFormateado,
        min: def.min,
        max: def.max,
        tipo
      };
    });
  }

  // Genera un número pseudoaleatorio entero nuevo para usar como semilla de simulación.
  generarNuevaSemilla() {
    const semilla = Math.floor(Math.random() * 900000) + 100000;
    this.configMotor.semilla = semilla;
    this._guardarConfiguracionApp();
    this.emit("semillaGenerada", semilla);
    return semilla;
  }

  // Inicia la ejecución de una corrida de optimización.
  iniciar() {
    try {
      this.estadoSimulacion = "CORRIENDO";
      this.solucionParetoSeleccionada = null;
      this.frentePareto = [];
      this.poblacionActual = [];
      this.historiaMejor = [];
      this.historiaPromedio = [];
      this.tiempoInicio = Date.now();

      this._guardarConfiguracionApp();
      this.emit("estadoCambiado", "CORRIENDO");

      const definicionDinamica = this.modeloActual.esDinamico ? this.modeloActual.definicionCruda : null;

      if (this.worker) {
        this.worker.postMessage({
          comando: "iniciar",
          config: this.configMotor,
          modeloId: this.modeloActual.id,
          entrada: this.entradasModelo,
          definicionModeloDinamico: definicionDinamica
        });
      } else {
        // Fallback en hilo principal si no hay Worker disponible.
        this.motorFallbackLocal = new Motor(this.configMotor);
        this.motorFallbackLocal.correr(this.modeloActual, this.entradasModelo, (progreso) => {
          this._procesarMensajeWorker({
            tipo: "progreso",
            motorTipo: "JavaScript (Hilo Principal)",
            ...progreso
          });
        });
      }
    } catch (error) {
      this.estadoSimulacion = "DETENIDO";
      this.emit("estadoCambiado", "DETENIDO");
      this.emit("error", { mensaje: error.message });
    }
  }

  // Pausa o reanuda la simulación en ejecución.
  alternarPausa() {
    const estaPausado = this.estadoSimulacion === "PAUSADO";
    const nuevoEstado = estaPausado ? "CORRIENDO" : "PAUSADO";
    const comando = estaPausado ? "reanudar" : "pausar";

    this.estadoSimulacion = nuevoEstado;

    if (this.worker) {
      this.worker.postMessage({ comando });
    } else if (this.motorFallbackLocal) {
      if (estaPausado) this.motorFallbackLocal.reanudar();
      else this.motorFallbackLocal.pausar();
    }

    this.emit("estadoCambiado", nuevoEstado);
  }

  // Detiene inmediatamente la optimización en progreso.
  detener() {
    this.estadoSimulacion = "DETENIDO";

    if (this.worker) {
      this.worker.postMessage({ comando: "detener" });
    } else if (this.motorFallbackLocal) {
      this.motorFallbackLocal.detener();
    }

    this.emit("estadoCambiado", "DETENIDO");
  }

  // Selecciona un punto o individuo específico dentro de la frontera de Pareto para inspeccionar su mecanismo.
  seleccionarSolucionPareto(individuo) {
    if (!individuo) return;
    this.solucionParetoSeleccionada = individuo;
    this.mejorSolucion = {
      genoma: individuo.genoma,
      fitness: individuo.fitness,
      generacion: this.progresoGeneracion
    };
    this.emit("solucionParetoSeleccionada", {
      individuo,
      modelo: this.modeloActual,
      entrada: this.entradasModelo
    });
  }

  // Guarda o actualiza un modelo dinámico creado desde el diseñador low-code.
  guardarModeloDinamico(defCruda, esEdicion = false, idExistente = null) {
    validarDefinicionModelo(defCruda);

    if (esEdicion && idExistente) {
      defCruda.id = idExistente;
    }

    const compilado = compilarModeloDinamico(defCruda);
    guardarUnModeloDinamico(compilado.definicionCruda);
    registrarModeloDinamico(compilado);

    // Sincroniza el nuevo modelo compilado con el Web Worker.
    if (this.worker) {
      this.worker.postMessage({
        comando: "registrarModeloDinamico",
        definicion: compilado.definicionCruda
      });
    }

    this.emit("modelosActualizados", this.obtenerModelos());
    this.seleccionarModelo(compilado.id);
    return compilado;
  }

  // Clona una simulación nativa o dinámica creando una nueva simulación editable.
  clonarModelo(idModeloACopiar = null) {
    const idACopiar = idModeloACopiar || this.modeloActual.id;
    const modeloOriginal = obtenerModeloPorId(idACopiar);
    if (!modeloOriginal) throw new Error("Modelo no encontrado.");

    const defClonada = clonarModeloExistente(modeloOriginal);
    const compilado = compilarModeloDinamico(defClonada);
    guardarUnModeloDinamico(compilado.definicionCruda);
    registrarModeloDinamico(compilado);

    if (this.worker) {
      this.worker.postMessage({
        comando: "registrarModeloDinamico",
        definicion: compilado.definicionCruda
      });
    }

    this.emit("modelosActualizados", this.obtenerModelos());
    this.seleccionarModelo(compilado.id);
    return compilado;
  }

  // Modifica el título y la descripción de un modelo dinámico persistido.
  renombrarModelo(idModelo, nuevoNombre, nuevaDescripcion) {
    const id = idModelo || this.modeloActual.id;
    const modelo = obtenerModeloPorId(id);
    if (!modelo || !modelo.esDinamico) {
      throw new Error("Solo las simulaciones dinámicas pueden ser renombradas.");
    }

    const dinamicos = cargarModelosDinamicos();
    const item = dinamicos.find(m => m.id === id);
    if (!item) throw new Error("Definición no encontrada en el almacenamiento.");

    item.nombre = nuevoNombre;
    item.descripcion = nuevaDescripcion;

    const compilado = compilarModeloDinamico(item);
    guardarUnModeloDinamico(compilado.definicionCruda);
    registrarModeloDinamico(compilado);

    if (this.worker) {
      this.worker.postMessage({
        comando: "registrarModeloDinamico",
        definicion: compilado.definicionCruda
      });
    }

    this.emit("modelosActualizados", this.obtenerModelos());
    this.seleccionarModelo(compilado.id);
    return compilado;
  }

  // Elimina una simulación dinámica del registro y del almacenamiento.
  eliminarModelo(idModelo) {
    const id = idModelo || this.modeloActual.id;
    const modelo = obtenerModeloPorId(id);
    if (!modelo || !modelo.esDinamico) {
      throw new Error("Solo se pueden borrar simulaciones dinámicas creadas por el usuario.");
    }

    eliminarModeloDinamico(id);
    eliminarModeloDinamicoDelRegistro(id);

    this.emit("modelosActualizados", this.obtenerModelos());
    // Regresa al primer modelo estándar.
    this.seleccionarModelo(MODELOS[0].id);
  }

  // Guarda la instantánea actual de simulación como un preset reutilizable.
  guardarPreset(nombrePreset) {
    if (!nombrePreset || !nombrePreset.trim()) {
      throw new Error("Debes indicar un nombre para el preset.");
    }

    const preset = {
      id: "preset_" + Date.now(),
      nombre: nombrePreset.trim(),
      fechaCreacion: Date.now(),
      modeloId: this.modeloActual.id,
      esDinamico: Boolean(this.modeloActual.esDinamico),
      configMotor: { ...this.configMotor },
      entradasModelo: { ...this.entradasModelo }
    };

    guardarUnPreset(preset);
    this.emit("presetsActualizados", this.obtenerPresets());
    return preset;
  }

  // Aplica un preset cargando su modelo, entradas y configuración de motor.
  aplicarPreset(presetId) {
    const presets = this.obtenerPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) throw new Error("Preset no encontrado.");

    if (preset.configMotor) {
      this.configMotor = { ...this.configMotor, ...preset.configMotor };
    }
    if (preset.entradasModelo) {
      this.entradasModelo = { ...this.entradasModelo, ...preset.entradasModelo };
    }

    this.seleccionarModelo(preset.modeloId);
    this.emit("presetAplicado", preset);
    return preset;
  }

  // Elimina un preset de la biblioteca.
  eliminarPreset(presetId) {
    eliminarPresetStorage(presetId);
    this.emit("presetsActualizados", this.obtenerPresets());
  }

  // Cambia el modo de tema Material 3 (light, dark, auto) y lo persiste.
  cambiarModoTema(modo) {
    this.temaModo = modo;
    guardarPreferenciaTema({ modo: this.temaModo, acento: this.temaAcento });
    this.emit("temaCambiado", { modo: this.temaModo, acento: this.temaAcento });
  }

  // Cambia la paleta tonal de acento Material 3 (ocean, emerald, amethyst, terracotta) y la persiste.
  cambiarAcentoTema(acento) {
    this.temaAcento = acento;
    guardarPreferenciaTema({ modo: this.temaModo, acento: this.temaAcento });
    this.emit("temaCambiado", { modo: this.temaModo, acento: this.temaAcento });
  }

  // Genera el objeto serializable para exportar una simulación o preset en formato JSON.
  generarExportacionSimulacion(idModelo = null) {
    const id = idModelo || this.modeloActual.id;
    const modelo = obtenerModeloPorId(id);
    if (!modelo) throw new Error("Modelo no encontrado.");

    if (modelo.esDinamico) {
      return {
        tipo: "simulacion_laboratorio_evolutivo",
        version: "1.0",
        fechaExportacion: new Date().toISOString(),
        modelo: modelo.definicionCruda
      };
    }

    return {
      tipo: "simulacion_laboratorio_evolutivo",
      version: "1.0",
      fechaExportacion: new Date().toISOString(),
      modelo: {
        id: modelo.id,
        nombre: modelo.nombre,
        descripcion: modelo.descripcion,
        esDinamico: false
      },
      configuracionSugerida: {
        configMotor: this.configMotor,
        entradasModelo: this.entradasModelo
      }
    };
  }

  // Genera el objeto serializable para exportar un preset.
  generarExportacionPreset(presetId) {
    const presets = this.obtenerPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) throw new Error("Preset no encontrado.");

    return {
      tipo: "preset_laboratorio_evolutivo",
      version: "1.0",
      fechaExportacion: new Date().toISOString(),
      preset
    };
  }

  // Importa y valida una definición de modelo o preset desde una cadena JSON.
  importarDesdeJSON(jsonString) {
    let datos = null;
    try {
      datos = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("El archivo o texto ingresado no es un JSON válido.");
    }

    // 1. Detección de Preset
    if (datos.tipo === "preset_laboratorio_evolutivo" && datos.preset) {
      const p = datos.preset;
      p.id = "preset_" + Date.now();
      guardarUnPreset(p);
      this.emit("presetsActualizados", this.obtenerPresets());
      this.aplicarPreset(p.id);
      return { tipo: "preset", item: p };
    }

    // 2. Detección de Modelo Dinámico
    if (datos.tipo === "simulacion_laboratorio_evolutivo" && datos.modelo) {
      const def = datos.modelo;
      if (def.codigoEvaluacion && def.variables) {
        def.id = "dinamico_" + Date.now();
        def.nombre = (def.nombre || "Modelo Importado") + " (Importado)";
        const compilado = this.guardarModeloDinamico(def);
        return { tipo: "modelo", item: compilado };
      }
      if (def.id && !def.esDinamico) {
        this.seleccionarModelo(def.id);
        if (datos.configuracionSugerida) {
          if (datos.configuracionSugerida.configMotor) {
            this.actualizarConfigMotor(datos.configuracionSugerida.configMotor);
          }
          if (datos.configuracionSugerida.entradasModelo) {
            this.actualizarEntradasModelo(datos.configuracionSugerida.entradasModelo);
          }
        }
        return { tipo: "modelo_nativo", item: this.modeloActual };
      }
    }

    // 3. Objeto crudo de definición directa de modelo dinámico
    if (datos.variables && (datos.codigoEvaluacion || datos.codigo)) {
      datos.id = "dinamico_" + Date.now();
      datos.nombre = (datos.nombre || "Modelo Importado") + " (Importado)";
      if (!datos.codigoEvaluacion && datos.codigo) datos.codigoEvaluacion = datos.codigo;
      const compilado = this.guardarModeloDinamico(datos);
      return { tipo: "modelo", item: compilado };
    }

    throw new Error("El JSON provisto no coincide con el formato esperado de simulación o preset.");
  }

  // Persiste la configuración del motor y entradas del modelo en localStorage.
  _guardarConfiguracionApp() {
    try {
      const config = {
        modeloId: this.modeloActual.id,
        configMotor: this.configMotor,
        entradasModelos: {}
      };
      config.entradasModelos[this.modeloActual.id] = this.entradasModelo;
      guardarConfiguracion(config);
    } catch (e) {
      // Ignorar errores transitorios de almacenamiento
    }
  }

  // Restaura la configuración guardada desde localStorage al iniciar la aplicación.
  restaurarEstadoInicial() {
    const guardado = cargarConfiguracion();
    if (guardado) {
      if (guardado.configMotor) {
        this.configMotor = { ...this.configMotor, ...guardado.configMotor };
      }
      if (guardado.modeloId) {
        const mod = obtenerModeloPorId(guardado.modeloId);
        if (mod) this.modeloActual = mod;
      }
      if (guardado.entradasModelos && guardado.entradasModelos[this.modeloActual.id]) {
        this.entradasModelo = guardado.entradasModelos[this.modeloActual.id];
      }
    }

    this.emit("temaCambiado", { modo: this.temaModo, acento: this.temaAcento });
    this.emit("configMotorActualizada", this.configMotor);
    this.emit("estado:inicializado", {
      configMotor: this.configMotor,
      modelo: this.modeloActual,
      entradasModelo: this.entradasModelo,
      tema: { modo: this.temaModo, acento: this.temaAcento }
    });
    this.emit("modeloCambiado", {
      modelo: this.modeloActual,
      genomaInicial: this.obtenerGenomaInicial(this.modeloActual, this.entradasModelo)
    });
  }
}

export default AppViewModel;
