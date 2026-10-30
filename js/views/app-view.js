// =========================================================================
// CAPA VISTA: VISTA PRINCIPAL DE LA APLICACIÓN (ENLAZADOR DE VISTAS Y DOM)
// ARQUITECTURA MVVM - ENLACE BIDIRECCIONAL ENTRE EL VIEWMODEL Y EL DOM
// =========================================================================

import { GraficoView } from "./grafico-view.js?v=2.8";
import { ModalesView } from "./modales-view.js?v=2.8";
import { EstudioView } from "./estudio-view.js?v=2.8";
import { obtenerVisualizador, detenerTodosLosVisualizadores } from "./visualizers.js?v=2.8";
import { obtenerPlantillaSimulacion } from "../builder.js?v=2.8";
import {
  construirFormularioModelo,
  obtenerDatosEntradaModelo,
  obtenerParametrosMotor,
  sincronizarFormularioMotor,
  actualizarBotonesControl,
  actualizarToolbarAcciones
} from "../ui.js";

// Descarga un objeto de datos como archivo JSON en el navegador del usuario.
function descargarArchivoJSON(nombreArchivo, objetoDatos) {
  const blob = new Blob([JSON.stringify(objetoDatos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Vista central de la aplicación que administra el DOM, delega gráficos/modales y despacha comandos al ViewModel.
export class AppView {
  // Inicializa la vista principal capturando el ViewModel y vinculando las subvistas especializadas.
  constructor(viewModel) {
    this.vm = viewModel;

    // Cache de elementos de la interfaz en el DOM.
    this.dom = {
      contenedorAlerta: document.getElementById("contenedor-alerta"),
      btnAbrirConfiguracion: document.getElementById("btn-abrir-configuracion"),
      btnAbrirBiblioteca: document.getElementById("btn-abrir-biblioteca"),
      selectorModelo: document.getElementById("selector-modelo"),
      descripcionModelo: document.getElementById("descripcion-modelo"),
      contenedorFormularioModelo: document.getElementById("contenedor-formulario-modelo"),

      // Botones de acción del modelo activo (Toolbar).
      btnAbrirConstructor: document.getElementById("btn-abrir-constructor"),
      btnEditarModelo: document.getElementById("btn-editar-modelo"),
      btnCopiarModelo: document.getElementById("btn-copiar-modelo"),
      btnRenombrarModelo: document.getElementById("btn-renombrar-modelo"),
      btnGuardarPreset: document.getElementById("btn-guardar-preset"),
      btnExportarModelo: document.getElementById("btn-exportar-modelo"),
      btnImportarModelo: document.getElementById("btn-importar-modelo"),
      btnEliminarModelo: document.getElementById("btn-eliminar-modelo"),

      // Parámetros del motor genético.
      inputPoblacion: document.getElementById("param-poblacion"),
      inputGeneraciones: document.getElementById("param-generaciones"),
      inputMutacion: document.getElementById("param-mutacion"),
      inputElitismo: document.getElementById("param-elitismo"),
      inputTorneo: document.getElementById("param-torneo"),
      inputReplicasRuido: document.getElementById("param-replicas-ruido"),
      inputSemilla: document.getElementById("param-semilla"),
      btnNuevaSemilla: document.getElementById("btn-nueva-semilla"),

      // Controles de ejecución.
      btnCorrer: document.getElementById("btn-correr"),
      btnPausar: document.getElementById("btn-pausar"),
      btnDetener: document.getElementById("btn-detener"),
      barraProgreso: document.getElementById("barra-progreso"),
      textoEstado: document.getElementById("texto-estado"),
      textoGeneracion: document.getElementById("texto-generacion"),

      // Área gráfica y resultados.
      tituloGrafico: document.getElementById("titulo-grafico"),
      etiquetaMejorFitness: document.getElementById("etiqueta-mejor-fitness"),
      canvasFitness: document.getElementById("canvas-fitness"),
      tooltipGrafico: document.getElementById("tooltip-grafico-m3"),
      leyendaGrafico: document.querySelector(".leyenda-grafico"),
      contenedorDibujoModelo: document.getElementById("contenedor-dibujo-modelo"),
      chipsGenomaOptimo: document.getElementById("chips-genoma-optimo"),
      btnCopiarReporte: document.getElementById("btn-copiar-reporte"),
      textoDescribirModelo: document.getElementById("texto-describir-modelo"),
      kpiMejorFitness: document.getElementById("kpi-mejor-fitness"),
      kpiModoOptimizacion: document.getElementById("kpi-modo-optimizacion"),
      badgeMotorActivo: document.getElementById("badge-motor-activo"),
      btnNavLaboratorio: document.getElementById("btn-nav-laboratorio"),
      btnNavEstudio: document.getElementById("btn-nav-estudio"),
      btnQuickTheme: document.getElementById("btn-quick-theme"),

      // Sensores móviles (Giroscopio / Inclinación / Shake) y Navegación Inferior Móvil
      btnAbrirSensoresMovil: document.getElementById("btn-abrir-sensores-movil"),
      panelSensoresMovil: document.getElementById("panel-sensores-movil"),
      badgeEstadoSensores: document.getElementById("badge-estado-sensores"),
      btnActivarGiroscopio: document.getElementById("btn-activar-giroscopio"),
      btnShakeMutar: document.getElementById("btn-shake-mutar"),
      selectModoSensorMovil: document.getElementById("select-modo-sensor-movil"),
      sliderInclinacionMovil: document.getElementById("slider-inclinacion-movil"),
      lecturaSensoresMovil: document.getElementById("lectura-sensores-movil"),
      btnBnavLaboratorio: document.getElementById("btn-bnav-laboratorio"),
      btnBnavEstudio: document.getElementById("btn-bnav-estudio"),
      btnBnavSensores: document.getElementById("btn-bnav-sensores"),
      btnBnavBiblioteca: document.getElementById("btn-bnav-biblioteca")
    };

    // Estado de sensores físicos del dispositivo móvil
    this.sensoresMovilActivos = false;
    this.ultimoShakeMs = 0;

    // Subvista de gráficos (Canvas 2D para convergencia y Pareto con Crosshair Tooltip).
    this.graficoView = new GraficoView(this.dom.canvasFitness, this.dom.leyendaGrafico, this.dom.tooltipGrafico);

    // Subvista de modales (Biblioteca, Configuración, Renombrar, etc.).
    this.modalesView = new ModalesView({
      constructor: {
        modal: document.getElementById("modal-constructor-modelo"),
        alerta: document.getElementById("alerta-constructor"),
        inputNombre: document.getElementById("input-nombre-modelo"),
        inputDesc: document.getElementById("input-desc-modelo"),
        tbody: document.getElementById("tbody-variables-constructor"),
        textareaCodigo: document.getElementById("textarea-codigo-evaluacion"),
        selectTipoVisualizacion: document.getElementById("select-tipo-visualizacion"),
        selectPlantilla: document.getElementById("select-plantilla-constructor"),
        hintTipoVisualizacion: document.getElementById("hint-tipo-visualizacion")
      },
      biblioteca: {
        modal: document.getElementById("modal-biblioteca-simulaciones"),
        contenedor: document.getElementById("contenedor-items-biblioteca"),
        inputBuscar: document.getElementById("input-buscar-biblioteca")
      },
      renombrar: {
        modal: document.getElementById("modal-renombrar-simulacion"),
        inputNombre: document.getElementById("input-nuevo-nombre"),
        inputDesc: document.getElementById("input-nueva-desc")
      },
      importar: {
        modal: document.getElementById("modal-importar-simulacion"),
        alerta: document.getElementById("alerta-importar"),
        textarea: document.getElementById("textarea-json-importar"),
        inputArchivo: document.getElementById("input-archivo-importar")
      },
      preset: {
        modal: document.getElementById("modal-guardar-preset"),
        inputNombre: document.getElementById("input-nombre-preset")
      },
      configuracion: {
        modal: document.getElementById("modal-configuracion")
      }
    });

    // Subvista de Estudio de Modelado (Workspace a pantalla completa)
    this.estudioView = new EstudioView({
      onGuardar: (def, esEdicion, idExistente) => {
        try {
          const compilado = this.vm.guardarModeloDinamico(def, esEdicion, idExistente);
          this.estudioView.cerrar();
          this._sincronizarNavSegmentada("laboratorio");
          this.modalesView.notificar(`💾 Simulación '${compilado.nombre}' guardada y activada con éxito`);
        } catch (err) {
          if (this.estudioView.dom.alerta) {
            this.modalesView.alerta(err.message, this.estudioView.dom.alerta);
          }
        }
      },
      onCerrar: () => {
        this._sincronizarNavSegmentada("laboratorio");
      }
    });

    // Enlaza la vista de Estudio al controlador modal para retrocompatibilidad
    this.modalesView.asignarEstudioView(this.estudioView);
    if (typeof window !== "undefined") {
      window.estudioView = this.estudioView;
    }

    // Estado local para recordar datos de dibujo de Pareto.
    this.ultimoDatosMulti = null;
  }

  // Inicializa la vista enlazando suscripciones del ViewModel y escuchadores del DOM.
  inicializar() {
    this._suscribirEventosViewModel();
    this._registrarEventosDOM();
    this.vm.restaurarEstadoInicial();
  }

  // Sincroniza el estado activo del conmutador de navegación segmentado Material 3 y la barra inferior móvil.
  _sincronizarNavSegmentada(vistaActiva = "laboratorio") {
    this.dom.btnNavLaboratorio?.classList.toggle("activo", vistaActiva === "laboratorio");
    this.dom.btnNavEstudio?.classList.toggle("activo", vistaActiva === "estudio");
    this.dom.btnBnavLaboratorio?.classList.toggle("activo", vistaActiva === "laboratorio");
    this.dom.btnBnavEstudio?.classList.toggle("activo", vistaActiva === "estudio");
  }

  // Alterna la visibilidad del panel de control por sensores físicos del celular y activa el giroscopio si se abre.
  _alternarPanelSensoresMovil() {
    if (!this.dom.panelSensoresMovil) return;
    const oculto = this.dom.panelSensoresMovil.style.display === "none";
    this.dom.panelSensoresMovil.style.display = oculto ? "flex" : "none";
    this.dom.btnBnavSensores?.classList.toggle("activo", oculto);
    if (oculto && !this.sensoresMovilActivos) {
      this._activarSensoresHardwareMovil();
    }
  }

  // Solicita permisos (iOS 13+) y enlaza DeviceOrientationEvent y DeviceMotionEvent del celular.
  async _activarSensoresHardwareMovil() {
    if (this.sensoresMovilActivos) {
      this.sensoresMovilActivos = false;
      if (this.dom.badgeEstadoSensores) {
        this.dom.badgeEstadoSensores.textContent = "Pausado";
        this.dom.badgeEstadoSensores.className = "badge-sensor-off";
      }
      if (this.dom.btnActivarGiroscopio) {
        this.dom.btnActivarGiroscopio.textContent = "🧭 Activar Giroscopio / Acelerómetro";
      }
      return;
    }

    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== "granted") {
          this.modalesView.notificar("⚠️ Permiso de giroscopio denegado en el navegador");
          return;
        }
      }
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        try { await DeviceMotionEvent.requestPermission(); } catch (_) {}
      }
    } catch (_) {}

    this.sensoresMovilActivos = true;
    try { if (navigator.vibrate) navigator.vibrate(18); } catch (_) {}

    if (this.dom.badgeEstadoSensores) {
      this.dom.badgeEstadoSensores.textContent = "En Vivo (Giroscopio + Shake)";
      this.dom.badgeEstadoSensores.className = "badge-sensor-on";
    }
    if (this.dom.btnActivarGiroscopio) {
      this.dom.btnActivarGiroscopio.textContent = "⏸ Pausar Giroscopio";
    }

    if (!this._listenersSensoresRegistrados && typeof window !== "undefined") {
      this._listenersSensoresRegistrados = true;

      window.addEventListener("deviceorientation", (e) => {
        if (!this.sensoresMovilActivos) return;
        const gamma = typeof e.gamma === "number" ? e.gamma : 0; // Inclinación Izq/Der (-90 a 90)
        const beta = typeof e.beta === "number" ? e.beta : 0;   // Inclinación Adelante/Atrás (-180 a 180)
        // Mapea la inclinación del teléfono a un ángulo continuo de 0° a 359°
        const normGamma = Math.max(-60, Math.min(60, gamma));
        const angGrados = Math.round(((normGamma + 60) / 120) * 359) % 360;
        this._aplicarAnguloInclinacion(angGrados, Math.round(gamma), Math.round(beta));
      }, { passive: true });

      window.addEventListener("devicemotion", (e) => {
        if (!this.sensoresMovilActivos) return;
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;
        const mag = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
        if (mag > 21.5) {
          const ahora = Date.now();
          if (ahora - this.ultimoShakeMs > 1200) {
            this.ultimoShakeMs = ahora;
            this._ejecutarAccionShake();
          }
        }
      }, { passive: true });
    }

    this.modalesView.notificar("📡 Giroscopio activo: inclina el celular para mover el mecanismo o agítalo para mutar");
  }

  // Aplica el ángulo proveniente del giroscopio o del control deslizante táctil al mecanismo activo y a las variables.
  _aplicarAnguloInclinacion(angGrados, gamma = 0, beta = 0) {
    if (this.dom.sliderInclinacionMovil) {
      this.dom.sliderInclinacionMovil.value = String(angGrados);
    }
    if (this.dom.lecturaSensoresMovil) {
      this.dom.lecturaSensoresMovil.textContent = `γ: ${gamma}° · β: ${beta}° · θ: ${angGrados}°`;
    }

    const modo = this.dom.selectModoSensorMovil?.value || "angulo_mecanismo";

    if (modo === "angulo_mecanismo") {
      // 1. Actualiza el control deslizante de ángulo en el visualizador del Laboratorio si está presente
      const sliderMecanismo = document.querySelector("#contenedor-dibujo-modelo input[type='range']");
      if (sliderMecanismo) {
        sliderMecanismo.value = String(angGrados);
        sliderMecanismo.dispatchEvent(new Event("input"));
      }
      // 2. Actualiza en vivo el ángulo del motor en el Editor CAD 2D del Estudio
      const thetaRad = (angGrados * Math.PI) / 180;
      this.estudioView?.editorGrafico?.establecerAnguloExterno(thetaRad);
    } else if (modo === "variables_modelo") {
      // Ajusta interactivamente los sliders de genes del Estudio o re-renderiza la solución con variación por inclinación
      const slidersEstudio = document.querySelectorAll("#estudio-contenedor-sliders input.slider-m3");
      if (slidersEstudio.length > 0) {
        const s0 = slidersEstudio[0];
        const min = parseFloat(s0.min) || 0;
        const max = parseFloat(s0.max) || 100;
        const val = min + (angGrados / 359) * (max - min);
        s0.value = String(val);
        s0.dispatchEvent(new Event("input"));
      }
    }
  }

  // Ejecuta la acción de agitar el dispositivo (Shake): vibración háptica, nueva semilla y mutación/evolución.
  _ejecutarAccionShake() {
    try { if (navigator.vibrate) navigator.vibrate([25, 40, 25]); } catch (_) {}
    this.vm.generarNuevaSemilla();
    this.modalesView.notificar("📳 ¡Agitación detectada! Nueva semilla generada y lista para evolucionar");
  }

  // Renderiza la tira de chips M3 con los valores actuales de las variables del genoma activo.
  _renderizarChipsGenoma(genoma = null) {
    if (!this.dom.chipsGenomaOptimo) return;
    const resumen = this.vm.obtenerResumenGenomaActual(genoma);
    if (!resumen || resumen.length === 0) {
      this.dom.chipsGenomaOptimo.innerHTML = "";
      return;
    }

    this.dom.chipsGenomaOptimo.innerHTML = resumen.map((item) => `
      <div class="m3-genome-chip" title="${item.etiqueta} [Rango: ${item.min ?? "--"} a ${item.max ?? "--"}]">
        <span class="chip-key">${item.nombre}:</span>
        <span class="chip-val">${item.valorFormateado}</span>
      </div>
    `).join("");
  }

  // Suscribe la vista a las notificaciones y cambios de estado emitidos por el ViewModel.
  _suscribirEventosViewModel() {
    // 0. Sincronización inicial completa de configMotor y vista
    this.vm.on("estado:inicializado", ({ configMotor }) => {
      sincronizarFormularioMotor(configMotor);
      if (this.dom.textoGeneracion && configMotor?.generaciones) {
        this.dom.textoGeneracion.textContent = `Gen 0 / ${configMotor.generaciones}`;
      }
    });

    this.vm.on("configMotorActualizada", (configMotor) => {
      sincronizarFormularioMotor(configMotor);
    });

    // 1. Cambio de modelo activo
    this.vm.on("modeloCambiado", ({ modelo, genomaInicial }) => {
      detenerTodosLosVisualizadores();
      this.dom.selectorModelo.value = modelo.id;
      this.dom.descripcionModelo.textContent = modelo.descripcion;

      // Actualiza visibilidad de botones del toolbar.
      actualizarToolbarAcciones(modelo, {
        btnEditar: this.dom.btnEditarModelo,
        btnRenombrar: this.dom.btnRenombrarModelo,
        btnEliminar: this.dom.btnEliminarModelo,
        btnCopiar: this.dom.btnCopiarModelo,
        btnExportar: this.dom.btnExportarModelo,
        btnGuardarPreset: this.dom.btnGuardarPreset
      });

      // Reconstruye el formulario interactivo de parámetros de entrada del modelo.
      construirFormularioModelo(
        modelo,
        this.dom.contenedorFormularioModelo,
        this.vm.entradasModelo,
        this.dom.contenedorAlerta
      );

      // Reinicia el gráfico, KPIs y leyenda.
      this.ultimoDatosMulti = null;
      if (this.dom.tituloGrafico) {
        this.dom.tituloGrafico.textContent = "📈 Curva de Convergencia del Fitness (Menor = Mejor)";
      }
      if (this.dom.kpiMejorFitness) {
        this.dom.kpiMejorFitness.textContent = "--";
      }
      if (this.dom.kpiModoOptimizacion) {
        this.dom.kpiModoOptimizacion.textContent = "Listo";
      }
      this.graficoView.actualizarLeyenda(false);
      this.graficoView.render({
        historiaMejor: [],
        historiaPromedio: [],
        totalGeneraciones: this.vm.configMotor.generaciones
      });

      // Renderiza la previsualización del modelo con su solución inicial y chips de genoma.
      if (genomaInicial && this.dom.contenedorDibujoModelo) {
        const visualizador = obtenerVisualizador(modelo.id);
        visualizador.render(this.dom.contenedorDibujoModelo, genomaInicial, this.vm.entradasModelo, {
          modelo,
          fitness: null
        });
        this.dom.textoDescribirModelo.textContent = modelo.describir(genomaInicial, this.vm.entradasModelo);
        this._renderizarChipsGenoma(genomaInicial);
      }
    });

    // 2. Notificaciones de progreso del motor evolutivo
    this.vm.on("progreso", (datos) => {
      const porcentaje = Math.min(100, (datos.generacion / datos.totalGeneraciones) * 100);
      this.dom.barraProgreso.style.width = `${porcentaje}%`;
      this.dom.textoGeneracion.textContent = `Gen ${datos.generacion} / ${datos.totalGeneraciones}`;

      if (datos.esMultiobjetivo) {
        if (this.dom.tituloGrafico) {
          this.dom.tituloGrafico.textContent = "📈 Frente de Pareto (Toque un punto para inspeccionar)";
        }
        const numSol = datos.frentePareto ? datos.frentePareto.length : 0;
        this.dom.etiquetaMejorFitness.textContent = `Frente Pareto: ${numSol} sol.`;
        if (this.dom.kpiMejorFitness) {
          const fitSel = datos.solucionParetoSeleccionada?.fitness;
          this.dom.kpiMejorFitness.textContent = Array.isArray(fitSel)
            ? `[${fitSel[0].toFixed(2)}, ${fitSel[1].toFixed(2)}]`
            : `${numSol} sol. F₀`;
        }
        if (this.dom.kpiModoOptimizacion) {
          this.dom.kpiModoOptimizacion.textContent = "NSGA-II Pareto";
        }

        this.ultimoDatosMulti = {
          esMultiobjetivo: true,
          frentePareto: datos.frentePareto,
          poblacion: datos.poblacion,
          nombresObjetivos: datos.nombresObjetivos,
          individuoSeleccionado: datos.solucionParetoSeleccionada
        };

        this.graficoView.actualizarLeyenda(true);
        this.graficoView.render({
          totalGeneraciones: datos.totalGeneraciones,
          datosMulti: this.ultimoDatosMulti
        });
      } else {
        if (this.dom.tituloGrafico) {
          this.dom.tituloGrafico.textContent = "📈 Convergencia del Fitness";
        }
        const fitTexto = typeof datos.mejorSolucion?.fitness === "number"
          ? datos.mejorSolucion.fitness.toFixed(4)
          : datos.mejorSolucion?.fitness;
        this.dom.etiquetaMejorFitness.textContent = `Fitness: ${fitTexto}`;
        if (this.dom.kpiMejorFitness) {
          this.dom.kpiMejorFitness.textContent = fitTexto ?? "--";
        }
        if (this.dom.kpiModoOptimizacion) {
          this.dom.kpiModoOptimizacion.textContent = "Monoobjetivo";
        }

        this.ultimoDatosMulti = null;
        this.graficoView.actualizarLeyenda(false);
        this.graficoView.render({
          historiaMejor: datos.historiaMejor,
          historiaPromedio: datos.historiaPromedio,
          totalGeneraciones: datos.totalGeneraciones
        });
      }

      // Renderiza la animación cinemática en Canvas/DOM utilizando el visualizador especializado.
      const genomaADibujar = datos.mejorSolucion?.genoma;
      if (genomaADibujar && this.dom.contenedorDibujoModelo) {
        const visualizador = obtenerVisualizador(this.vm.modeloActual.id);
        visualizador.render(this.dom.contenedorDibujoModelo, genomaADibujar, this.vm.entradasModelo, {
          modelo: this.vm.modeloActual,
          fitness: datos.mejorSolucion?.fitness
        });
        this.dom.textoDescribirModelo.textContent = this.vm.modeloActual.describir(genomaADibujar, this.vm.entradasModelo);
        this._renderizarChipsGenoma(genomaADibujar);
      }
    });

    // 3. Selección de un punto del frente de Pareto
    this.vm.on("solucionParetoSeleccionada", ({ individuo, modelo, entrada }) => {
      if (this.ultimoDatosMulti) {
        this.ultimoDatosMulti.individuoSeleccionado = individuo;
        this.graficoView.render({
          totalGeneraciones: this.vm.totalGeneraciones,
          datosMulti: this.ultimoDatosMulti
        });
      }
      if (this.dom.kpiMejorFitness && Array.isArray(individuo.fitness)) {
        this.dom.kpiMejorFitness.textContent = `[${individuo.fitness[0].toFixed(2)}, ${individuo.fitness[1].toFixed(2)}]`;
      }
      const visualizador = obtenerVisualizador(modelo.id);
      visualizador.render(this.dom.contenedorDibujoModelo, individuo.genoma, entrada, {
        modelo,
        fitness: individuo.fitness
      });
      this.dom.textoDescribirModelo.textContent = modelo.describir(individuo.genoma, entrada);
      this._renderizarChipsGenoma(individuo.genoma);
    });

    // 4. Cambios de estado operativo de la simulación
    this.vm.on("estadoCambiado", (estado) => {
      actualizarBotonesControl(estado, this.dom, this.dom.textoEstado);
    });

    // 5. Finalización con éxito de la corrida
    this.vm.on("finalizado", ({ esMultiobjetivo, frentePareto }) => {
      if (esMultiobjetivo) {
        this.dom.textoEstado.textContent = `✓ Optimización completada (${frentePareto.length} soluciones)`;
      } else {
        this.dom.textoEstado.textContent = "✓ Optimización completada";
      }
    });

    // 6. Actualización de modelos en el registro (por clonación, importación o eliminación)
    this.vm.on("modelosActualizados", (modelos) => {
      this.dom.selectorModelo.innerHTML = "";
      modelos.forEach((mod) => {
        const opcion = document.createElement("option");
        opcion.value = mod.id;
        opcion.textContent = mod.esDinamico ? `✨ ${mod.nombre}` : mod.nombre;
        this.dom.selectorModelo.appendChild(opcion);
      });
      this.dom.selectorModelo.value = this.vm.modeloActual.id;
    });

    // 7. Generación de nueva semilla reproducible
    this.vm.on("semillaGenerada", (semilla) => {
      this.dom.inputSemilla.value = semilla;
    });

    // 8. Aplicación de preset
    this.vm.on("presetAplicado", (preset) => {
      if (preset.configMotor) {
        sincronizarFormularioMotor(preset.configMotor);
      }
      this.modalesView.notificar(`⭐ Preset '${preset.nombre}' aplicado con éxito`);
    });

    // 9. Cambio de tema y color
    this.vm.on("temaCambiado", ({ modo, acento }) => {
      this.modalesView.aplicarTema(modo, acento);
      if (this.dom.btnQuickTheme) {
        const icono = modo === "light" ? "☀️ Claro" : (modo === "dark" ? "🌙 Oscuro" : "🌓 Auto");
        this.dom.btnQuickTheme.textContent = icono;
      }
      if (this.graficoView?.ultimoRenderArgs) {
        this.graficoView.render(this.graficoView.ultimoRenderArgs);
      }
    });

    // 10. Errores
    this.vm.on("error", ({ mensaje }) => {
      this.modalesView.alerta(mensaje, this.dom.contenedorAlerta);
      this.modalesView.notificar(`⚠️ Error: ${mensaje}`, 4000);
    });
  }

  // Registra los eventos del DOM (botones, inputs, clics del Canvas y modales) conectándolos con comandos del ViewModel.
  _registrarEventosDOM() {
    // Conmutador de Espacio de Trabajo en la Barra Superior M3 y Barra Inferior Móvil
    const irALaboratorio = () => {
      if (this.estudioView) this.estudioView.cerrar();
      this._sincronizarNavSegmentada("laboratorio");
    };
    const irAEstudio = () => {
      const { def, esEdicion } = this._obtenerDefinicionEditable(this.vm.modeloActual);
      this._sincronizarNavSegmentada("estudio");
      this.estudioView.abrir(def, esEdicion);
    };

    this.dom.btnNavLaboratorio?.addEventListener("click", irALaboratorio);
    this.dom.btnBnavLaboratorio?.addEventListener("click", irALaboratorio);

    this.dom.btnNavEstudio?.addEventListener("click", () => {
      irAEstudio();
      if (typeof window !== "undefined" && window.innerWidth <= 768 && this.estudioView) {
        this.estudioView.cambiarTab("mecanismo");
      }
    });
    this.dom.btnBnavEstudio?.addEventListener("click", () => {
      irAEstudio();
      if (this.estudioView) {
        this.estudioView.cambiarTab("mecanismo");
      }
    });

    // Controles de Sensores Móviles (Giroscopio, Inclinación y Agitar/Shake)
    this.dom.btnAbrirSensoresMovil?.addEventListener("click", () => this._alternarPanelSensoresMovil());
    this.dom.btnBnavSensores?.addEventListener("click", () => this._alternarPanelSensoresMovil());
    this.dom.btnActivarGiroscopio?.addEventListener("click", () => this._activarSensoresHardwareMovil());
    this.dom.btnShakeMutar?.addEventListener("click", () => this._ejecutarAccionShake());
    this.dom.sliderInclinacionMovil?.addEventListener("input", (e) => {
      const ang = parseInt(e.target.value, 10) || 0;
      const gammaSim = Math.round(((ang / 359) * 120) - 60);
      this._aplicarAnguloInclinacion(ang, gammaSim, 0);
    });

    this.dom.btnBnavBiblioteca?.addEventListener("click", () => {
      this._abrirBiblioteca();
    });

    // Conmutador rápido de Tema (Claro -> Oscuro -> Auto)
    this.dom.btnQuickTheme?.addEventListener("click", () => {
      const orden = ["light", "dark", "auto"];
      const actual = this.vm.temaModo || "auto";
      const sig = orden[(orden.indexOf(actual) + 1) % orden.length];
      this.vm.cambiarModoTema(sig);
    });

    // Botón para copiar la solución óptima y el informe al portapapeles
    this.dom.btnCopiarReporte?.addEventListener("click", async () => {
      const texto = this.dom.textoDescribirModelo?.textContent || "";
      const resumen = this.vm.obtenerResumenGenomaActual();
      const varsStr = resumen.map(r => `${r.nombre}=${r.valorFormateado}`).join(", ");
      const payload = `=== ${this.vm.modeloActual?.nombre || "Simulación"} ===\nVariables: ${varsStr}\n\n${texto}`;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(payload);
        }
        this.modalesView.notificar("📋 Solución e informe técnico copiados al portapapeles");
      } catch (_) {
        this.modalesView.notificar("📋 Solución lista en el inspector");
      }
    });

    // Selector desplegable de modelos
    this.dom.selectorModelo.addEventListener("change", (e) => {
      this.vm.seleccionarModelo(e.target.value);
    });

    // Botones de ejecución
    this.dom.btnCorrer.addEventListener("click", () => {
      this.modalesView.alerta(null, this.dom.contenedorAlerta);
      try {
        const config = obtenerParametrosMotor();
        const entradas = obtenerDatosEntradaModelo(this.vm.modeloActual);
        this.vm.actualizarConfigMotor(config);
        this.vm.actualizarEntradasModelo(entradas);
        this.vm.iniciar();
      } catch (err) {
        this.modalesView.alerta(err.message, this.dom.contenedorAlerta);
      }
    });

    this.dom.btnPausar.addEventListener("click", () => {
      this.vm.alternarPausa();
    });

    this.dom.btnDetener.addEventListener("click", () => {
      this.vm.detener();
    });

    this.dom.btnNuevaSemilla.addEventListener("click", () => {
      this.vm.generarNuevaSemilla();
    });

    // Clic en el Canvas de fitness para interactuar con el frente de Pareto
    this.dom.canvasFitness.addEventListener("click", (e) => {
      if (!this.vm.esMultiobjetivo) return;
      const punto = this.graficoView.obtenerPuntoParetoCercano(e.clientX, e.clientY);
      if (punto) {
        this.vm.seleccionarSolucionPareto(punto);
      }
    });

    // Tooltip interactivo M3 y guía crosshair en el gráfico (Monobjetivo y Pareto) + soporte táctil móvil
    this.dom.canvasFitness.addEventListener("mousemove", (e) => {
      this.graficoView.actualizarHover(e.clientX, e.clientY);
    });

    this.dom.canvasFitness.addEventListener("mouseleave", () => {
      this.graficoView.ocultarHover();
    });

    this.dom.canvasFitness.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length === 1) {
        const t = e.touches[0];
        this.graficoView.actualizarHover(t.clientX, t.clientY);
        if (this.vm.esMultiobjetivo) {
          const punto = this.graficoView.obtenerPuntoParetoCercano(t.clientX, t.clientY);
          if (punto) this.vm.seleccionarSolucionPareto(punto);
        }
      }
    }, { passive: true });

    this.dom.canvasFitness.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length === 1) {
        const t = e.touches[0];
        this.graficoView.actualizarHover(t.clientX, t.clientY);
      }
    }, { passive: true });

    // Acciones de Toolbar
    this.dom.btnAbrirConstructor.addEventListener("click", () => {
      this._sincronizarNavSegmentada("estudio");
      this.estudioView.abrir(null, false);
    });

    this.dom.btnEditarModelo.addEventListener("click", () => {
      const { def, esEdicion } = this._obtenerDefinicionEditable(this.vm.modeloActual);
      this._sincronizarNavSegmentada("estudio");
      this.estudioView.abrir(def, esEdicion);
    });

    document.getElementById("btn-header-estudio")?.addEventListener("click", () => {
      const { def, esEdicion } = this._obtenerDefinicionEditable(this.vm.modeloActual);
      this._sincronizarNavSegmentada("estudio");
      this.estudioView.abrir(def, esEdicion);
    });

    this.dom.btnCopiarModelo.addEventListener("click", () => {
      try {
        const clonado = this.vm.clonarModelo();
        this.modalesView.notificar(`📑 Simulación copiada como '${clonado.nombre}'`);
      } catch (err) {
        this.modalesView.notificar(`⚠️ ${err.message}`);
      }
    });

    this.dom.btnRenombrarModelo.addEventListener("click", () => {
      this.modalesView.abrirRenombrar(this.vm.modeloActual);
    });

    this.dom.btnEliminarModelo.addEventListener("click", async () => {
      const confirmado = await this.modalesView.confirmar({
        titulo: "🗑️ Eliminar Simulación",
        mensaje: `¿Deseas eliminar definitivamente la simulación '${this.vm.modeloActual.nombre}'? Esta acción no se puede deshacer.`,
        textoConfirmar: "Eliminar",
        peligro: true
      });
      if (!confirmado) return;
      try {
        this.vm.eliminarModelo();
        this.modalesView.notificar("🗑️ Simulación eliminada con éxito");
      } catch (err) {
        this.modalesView.notificar(`⚠️ ${err.message}`);
      }
    });

    this.dom.btnExportarModelo.addEventListener("click", () => {
      try {
        const datos = this.vm.generarExportacionSimulacion();
        const archivo = `${this.vm.modeloActual.id}_simulacion.json`;
        descargarArchivoJSON(archivo, datos);
        this.modalesView.notificar(`📤 Archivo '${archivo}' descargado`);
      } catch (err) {
        this.modalesView.notificar(`⚠️ ${err.message}`);
      }
    });

    this.dom.btnImportarModelo.addEventListener("click", () => {
      this.modalesView.abrirImportar();
    });

    this.dom.btnGuardarPreset.addEventListener("click", () => {
      const sugerencia = `${this.vm.modeloActual.nombre} - ${new Date().toLocaleDateString()}`;
      this.modalesView.abrirGuardarPreset(sugerencia);
    });

    this.dom.btnAbrirBiblioteca.addEventListener("click", () => {
      this._abrirBiblioteca();
    });

    this.dom.btnAbrirConfiguracion.addEventListener("click", () => {
      this.modalesView.abrirConfiguracion();
    });

    // Configuración Modal: botones de modo y acentos
    document.getElementById("btn-cerrar-configuracion")?.addEventListener("click", () => this.modalesView.cerrarConfiguracion());
    document.getElementById("btn-cerrar-config-pie")?.addEventListener("click", () => this.modalesView.cerrarConfiguracion());

    document.getElementById("btn-tema-claro")?.addEventListener("click", () => this.vm.cambiarModoTema("light"));
    document.getElementById("btn-tema-oscuro")?.addEventListener("click", () => this.vm.cambiarModoTema("dark"));
    document.getElementById("btn-tema-auto")?.addEventListener("click", () => this.vm.cambiarModoTema("auto"));

    document.querySelectorAll(".btn-dot-paleta").forEach(btn => {
      btn.addEventListener("click", () => {
        const color = btn.dataset.color || "ocean";
        this.vm.cambiarAcentoTema(color);
      });
    });

    // Modales: Constructor
    document.getElementById("btn-cerrar-modal")?.addEventListener("click", () => this.modalesView.cerrarConstructor());
    document.getElementById("btn-cancelar-modelo")?.addEventListener("click", () => this.modalesView.cerrarConstructor());
    document.getElementById("btn-agregar-variable")?.addEventListener("click", () => this.modalesView.agregarVariableConstructor());

    document.getElementById("btn-guardar-modelo")?.addEventListener("click", () => {
      try {
        const modal = document.getElementById("modal-constructor-modelo");
        const alerta = document.getElementById("alerta-constructor");
        this.modalesView.alerta(null, alerta);
        const def = this.modalesView.extraerDatosConstructor();
        const esEdicion = modal?.dataset.modo === "edicion";
        const idExistente = modal?.dataset.modeloId;

        const compilado = this.vm.guardarModeloDinamico(def, esEdicion, idExistente);
        this.modalesView.cerrarConstructor();
        this._sincronizarNavSegmentada("laboratorio");
        this.modalesView.notificar(`💾 Simulación '${compilado.nombre}' guardada con éxito`);
      } catch (err) {
        this.modalesView.alerta(err.message, document.getElementById("alerta-constructor"));
      }
    });

    // Modales: Renombrar
    document.getElementById("btn-cerrar-renombrar")?.addEventListener("click", () => this.modalesView.cerrarRenombrar());
    document.getElementById("btn-cancelar-renombrar")?.addEventListener("click", () => this.modalesView.cerrarRenombrar());
    document.getElementById("btn-confirmar-renombrar")?.addEventListener("click", () => {
      try {
        const nuevoNombre = document.getElementById("input-nuevo-nombre").value.trim();
        const nuevaDesc = document.getElementById("input-nueva-desc").value.trim();
        if (!nuevoNombre) throw new Error("El nombre no puede estar vacío.");

        const id = document.getElementById("modal-renombrar-simulacion").dataset.modeloId;
        const mod = this.vm.renombrarModelo(id, nuevoNombre, nuevaDesc);
        this.modalesView.cerrarRenombrar();
        this.modalesView.notificar(`🏷️ Renombrado a '${mod.nombre}'`);
      } catch (err) {
        this.modalesView.notificar(`⚠️ ${err.message}`);
      }
    });

    // Modales: Preset
    document.getElementById("btn-cerrar-guardar-preset")?.addEventListener("click", () => this.modalesView.cerrarGuardarPreset());
    document.getElementById("btn-cancelar-guardar-preset")?.addEventListener("click", () => this.modalesView.cerrarGuardarPreset());
    document.getElementById("btn-confirmar-guardar-preset")?.addEventListener("click", () => {
      try {
        const nombre = document.getElementById("input-nombre-preset").value;
        const p = this.vm.guardarPreset(nombre);
        this.modalesView.cerrarGuardarPreset();
        this.modalesView.notificar(`⭐ Preset '${p.nombre}' guardado`);
      } catch (err) {
        this.modalesView.notificar(`⚠️ ${err.message}`);
      }
    });

    // Modales: Importar
    document.getElementById("btn-cerrar-importar")?.addEventListener("click", () => this.modalesView.cerrarImportar());
    document.getElementById("btn-cancelar-importar")?.addEventListener("click", () => this.modalesView.cerrarImportar());

    const inputArchivo = document.getElementById("input-archivo-importar");
    const textareaJSON = document.getElementById("textarea-json-importar");
    inputArchivo?.addEventListener("change", (e) => {
      const archivo = e.target.files[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = (ev) => {
        if (textareaJSON) textareaJSON.value = ev.target.result;
      };
      lector.readAsText(archivo);
    });

    document.getElementById("btn-confirmar-importar")?.addEventListener("click", () => {
      try {
        const jsonStr = textareaJSON?.value?.trim();
        if (!jsonStr) throw new Error("Por favor, ingresa o carga un archivo JSON.");
        const res = this.vm.importarDesdeJSON(jsonStr);
        this.modalesView.cerrarImportar();
        this.modalesView.notificar(`✓ Importado exitosamente: ${res.tipo}`);
      } catch (err) {
        this.modalesView.alerta(err.message, document.getElementById("alerta-importar"));
      }
    });

    // Modales: Biblioteca
    document.getElementById("btn-cerrar-biblioteca")?.addEventListener("click", () => this.modalesView.cerrarBiblioteca());
    document.getElementById("btn-cerrar-biblioteca-pie")?.addEventListener("click", () => this.modalesView.cerrarBiblioteca());
    document.getElementById("btn-nuevo-desde-biblioteca")?.addEventListener("click", () => {
      this.modalesView.cerrarBiblioteca();
      this._sincronizarNavSegmentada("estudio");
      this.estudioView.abrir(null, false);
    });
    document.getElementById("btn-importar-desde-biblioteca")?.addEventListener("click", () => {
      this.modalesView.cerrarBiblioteca();
      this.modalesView.abrirImportar();
    });
  }

  // Despliega la biblioteca de simulaciones conectada con el ViewModel.
  _abrirBiblioteca() {
    this.modalesView.abrirBiblioteca(
      this.vm.obtenerModelos(),
      this.vm.obtenerPresets(),
      async (accion, id) => {
        try {
          if (accion === "cargar") {
            this.vm.seleccionarModelo(id);
            this.modalesView.cerrarBiblioteca();
            this._sincronizarNavSegmentada("laboratorio");
            this.modalesView.notificar(`▶ Simulación cargada`);
          } else if (accion === "copiar") {
            const clon = this.vm.clonarModelo(id);
            this.modalesView.cerrarBiblioteca();
            this.modalesView.notificar(`📑 Simulación copiada como '${clon.nombre}'`);
          } else if (accion === "editar") {
            const mod = this.vm.obtenerModelos().find(m => m.id === id);
            this.modalesView.cerrarBiblioteca();
            if (mod) {
              const { def, esEdicion } = this._obtenerDefinicionEditable(mod);
              this._sincronizarNavSegmentada("estudio");
              this.estudioView.abrir(def, esEdicion);
            }
          } else if (accion === "renombrar") {
            const mod = this.vm.obtenerModelos().find(m => m.id === id);
            this.modalesView.cerrarBiblioteca();
            if (mod?.esDinamico) this.modalesView.abrirRenombrar(mod);
          } else if (accion === "exportar") {
            const datos = this.vm.generarExportacionSimulacion(id);
            descargarArchivoJSON(`${id}_simulacion.json`, datos);
            this.modalesView.notificar(`📤 Archivo descargado`);
          } else if (accion === "eliminar") {
            const ok = await this.modalesView.confirmar({
              titulo: "🗑️ Eliminar Simulación",
              mensaje: "¿Estás seguro de que deseas eliminar esta simulación de la biblioteca?",
              textoConfirmar: "Eliminar",
              peligro: true
            });
            if (ok) {
              this.vm.eliminarModelo(id);
              this._abrirBiblioteca();
              this.modalesView.notificar("🗑️ Simulación eliminada");
            }
          } else if (accion === "cargarPreset") {
            this.vm.aplicarPreset(id);
            this.modalesView.cerrarBiblioteca();
          } else if (accion === "exportarPreset") {
            const datos = this.vm.generarExportacionPreset(id);
            descargarArchivoJSON(`${id}.json`, datos);
            this.modalesView.notificar(`📤 Preset exportado`);
          } else if (accion === "eliminarPreset") {
            const ok = await this.modalesView.confirmar({
              titulo: "🗑️ Eliminar Preset",
              mensaje: "¿Deseas eliminar este preset de escenario?",
              textoConfirmar: "Eliminar",
              peligro: true
            });
            if (ok) {
              this.vm.eliminarPreset(id);
              this._abrirBiblioteca();
              this.modalesView.notificar("🗑️ Preset eliminado");
            }
          }
        } catch (err) {
          this.modalesView.notificar(`⚠️ ${err.message}`);
        }
      }
    );
  }

  // Convierte cualquier modelo nativo o dinámico a una definición lista para ser editada o adaptada en el Estudio.
  _obtenerDefinicionEditable(modelo) {
    if (!modelo) return { def: null, esEdicion: false };
    if (modelo.esDinamico && modelo.definicionCruda) {
      return { def: modelo.definicionCruda, esEdicion: true };
    }

    const plantilla = obtenerPlantillaSimulacion(modelo.id) || {};
    const genomaCrudo = modelo.variables || (modelo.crearGenoma ? modelo.crearGenoma() : []);

    const varsLista = (plantilla.variables && plantilla.variables.length > 0)
      ? plantilla.variables
      : genomaCrudo.map((v, i) => ({
          nombre: v.nombre || `var${i + 1}`,
          etiqueta: v.etiqueta || v.nombre || `Variable ${i + 1}`,
          tipo: v.tipo || "continuo",
          min: v.min !== undefined ? v.min : 0,
          max: v.max !== undefined ? v.max : 100,
          valorNominal: v.valorNominal !== undefined ? v.valorNominal : undefined
        }));

    const def = {
      id: modelo.id,
      nombre: plantilla.nombre || modelo.nombre || `${modelo.id} (Editable)`,
      descripcion: plantilla.descripcion || modelo.descripcion,
      tipoVisualizacion: plantilla.tipoVisualizacion || modelo.tipoVisualizacion || "calibracion",
      grafo: plantilla.grafo || modelo.grafo || (modelo.definicionCruda?.grafo) || null,
      variables: varsLista.length > 0 ? varsLista : [
        { nombre: "var1", tipo: "continuo", min: 0, max: 100 }
      ],
      codigoEvaluacion: plantilla.codigoEvaluacion || `// Función de aptitud para ${modelo.nombre}\n// Variables disponibles: ${varsLista.map(v => 'vars.' + v.nombre).join(', ')}\nreturn Math.abs(vars.${varsLista[0]?.nombre || 'var1'} - 50);`
    };

    return { def, esEdicion: true };
  }
}

export default AppView;
