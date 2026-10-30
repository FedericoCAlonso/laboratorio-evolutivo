// =========================================================================
// CAPA VISTA: VISTA PRINCIPAL DE LA APLICACIÓN (ENLAZADOR DE VISTAS Y DOM)
// ARQUITECTURA MVVM - ENLACE BIDIRECCIONAL ENTRE EL VIEWMODEL Y EL DOM
// =========================================================================

import { GraficoView } from "./grafico-view.js";
import { ModalesView } from "./modales-view.js";
import { EstudioView } from "./estudio-view.js";
import { obtenerVisualizador, detenerTodosLosVisualizadores } from "./visualizers.js";
import {
  construirFormularioModelo,
  obtenerDatosEntradaModelo,
  obtenerParametrosMotor,
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
      leyendaGrafico: document.querySelector(".leyenda-grafico"),
      contenedorDibujoModelo: document.getElementById("contenedor-dibujo-modelo"),
      textoDescribirModelo: document.getElementById("texto-describir-modelo")
    };

    // Subvista de gráficos (Canvas 2D para convergencia y Pareto).
    this.graficoView = new GraficoView(this.dom.canvasFitness, this.dom.leyendaGrafico);

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
          this.modalesView.notificar(`💾 Simulación '${compilado.nombre}' guardada y activada con éxito`);
        } catch (err) {
          if (this.estudioView.dom.alerta) {
            this.modalesView.alerta(err.message, this.estudioView.dom.alerta);
          }
        }
      },
      onCerrar: () => {}
    });

    // Enlaza la vista de Estudio al controlador modal para retrocompatibilidad
    this.modalesView.asignarEstudioView(this.estudioView);

    // Estado local para recordar datos de dibujo de Pareto.
    this.ultimoDatosMulti = null;
  }

  // Inicializa la vista enlazando suscripciones del ViewModel y escuchadores del DOM.
  inicializar() {
    this._suscribirEventosViewModel();
    this._registrarEventosDOM();
    this.vm.restaurarEstadoInicial();
  }

  // Suscribe la vista a las notificaciones y cambios de estado emitidos por el ViewModel.
  _suscribirEventosViewModel() {
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

      // Reinicia el gráfico y la leyenda.
      this.ultimoDatosMulti = null;
      if (this.dom.tituloGrafico) {
        this.dom.tituloGrafico.textContent = "📈 Curva de Convergencia del Fitness (Menor = Mejor)";
      }
      this.graficoView.actualizarLeyenda(false);
      this.graficoView.render({
        historiaMejor: [],
        historiaPromedio: [],
        totalGeneraciones: this.vm.configMotor.generaciones
      });

      // Renderiza la previsualización del modelo con su solución inicial.
      if (genomaInicial && this.dom.contenedorDibujoModelo) {
        const visualizador = obtenerVisualizador(modelo.id);
        visualizador.render(this.dom.contenedorDibujoModelo, genomaInicial, this.vm.entradasModelo, {
          modelo,
          fitness: null
        });
        this.dom.textoDescribirModelo.textContent = modelo.describir(genomaInicial, this.vm.entradasModelo);
      }
    });

    // 2. Notificaciones de progreso del motor evolutivo
    this.vm.on("progreso", (datos) => {
      const porcentaje = Math.min(100, (datos.generacion / datos.totalGeneraciones) * 100);
      this.dom.barraProgreso.style.width = `${porcentaje}%`;
      this.dom.textoGeneracion.textContent = `Gen ${datos.generacion} / ${datos.totalGeneraciones}`;

      if (datos.esMultiobjetivo) {
        if (this.dom.tituloGrafico) {
          this.dom.tituloGrafico.textContent = "📈 Frente de Pareto Multiobjetivo (Haz clic en un punto para ver su mecanismo)";
        }
        const numSol = datos.frentePareto ? datos.frentePareto.length : 0;
        this.dom.etiquetaMejorFitness.textContent = `Frente Pareto: ${numSol} sol. (${datos.motorTipo})`;

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
          this.dom.tituloGrafico.textContent = "📈 Curva de Convergencia del Fitness (Menor = Mejor)";
        }
        const fitTexto = typeof datos.mejorSolucion?.fitness === "number"
          ? datos.mejorSolucion.fitness.toFixed(4)
          : datos.mejorSolucion?.fitness;
        this.dom.etiquetaMejorFitness.textContent = `Fitness: ${fitTexto} (${datos.motorTipo})`;

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
      const visualizador = obtenerVisualizador(modelo.id);
      visualizador.render(this.dom.contenedorDibujoModelo, individuo.genoma, entrada, {
        modelo,
        fitness: individuo.fitness
      });
      this.dom.textoDescribirModelo.textContent = modelo.describir(individuo.genoma, entrada);
    });

    // 4. Cambios de estado operativo de la simulación
    this.vm.on("estadoCambiado", (estado) => {
      actualizarBotonesControl(estado, this.dom, this.dom.textoEstado);
    });

    // 5. Finalización con éxito de la corrida
    this.vm.on("finalizado", ({ esMultiobjetivo, frentePareto, motorTipo }) => {
      if (esMultiobjetivo) {
        this.dom.textoEstado.textContent = `✓ Optimización finalizada (${frentePareto.length} soluciones en Frente de Pareto)`;
      } else {
        this.dom.textoEstado.textContent = `✓ Optimización finalizada con éxito (${motorTipo})`;
      }
    });

    // 6. Actualización de modelos en el registro (por clonación, importación o eliminación)
    this.vm.on("modelosActualizados", (modelos) => {
      this.dom.selectorModelo.innerHTML = "";
      modelos.forEach((mod) => {
        const opcion = document.createElement("option");
        opcion.value = mod.id;
        opcion.textContent = mod.esDinamico ? `✨ ${mod.nombre} (Dinámico)` : mod.nombre;
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
        if (preset.configMotor.tamPoblacion) this.dom.inputPoblacion.value = preset.configMotor.tamPoblacion;
        if (preset.configMotor.generaciones) this.dom.inputGeneraciones.value = preset.configMotor.generaciones;
        if (preset.configMotor.probMutacion) this.dom.inputMutacion.value = preset.configMotor.probMutacion;
        if (preset.configMotor.elitismo) this.dom.inputElitismo.value = preset.configMotor.elitismo;
        if (preset.configMotor.torneoK) this.dom.inputTorneo.value = preset.configMotor.torneoK;
        if (preset.configMotor.replicasRuido) this.dom.inputReplicasRuido.value = preset.configMotor.replicasRuido;
        if (preset.configMotor.semilla) this.dom.inputSemilla.value = preset.configMotor.semilla;
      }
      this.modalesView.notificar(`⭐ Preset '${preset.nombre}' aplicado con éxito`);
    });

    // 9. Cambio de tema y color
    this.vm.on("temaCambiado", ({ modo, acento }) => {
      this.modalesView.aplicarTema(modo, acento);
    });

    // 10. Errores
    this.vm.on("error", ({ mensaje }) => {
      this.modalesView.alerta(mensaje, this.dom.contenedorAlerta);
      this.modalesView.notificar(`⚠️ Error: ${mensaje}`, 4000);
    });
  }

  // Registra los eventos del DOM (botones, inputs, clics del Canvas y modales) conectándolos con comandos del ViewModel.
  _registrarEventosDOM() {
    // Selector desplegable de modelos
    this.dom.selectorModelo.addEventListener("change", (e) => {
      this.vm.seleccionarModelo(e.target.value);
    });

    // Botones de ejecución
    this.dom.btnCorrer.addEventListener("click", () => {
      this.modalesView.alerta(null, this.dom.contenedorAlerta);
      const config = obtenerParametrosMotor();
      const entradas = obtenerDatosEntradaModelo(this.vm.modeloActual);
      this.vm.actualizarConfigMotor(config);
      this.vm.actualizarEntradasModelo(entradas);
      this.vm.iniciar();
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

    // Tooltip interactivo con cursor pointer
    this.dom.canvasFitness.addEventListener("mousemove", (e) => {
      if (!this.vm.esMultiobjetivo) return;
      const punto = this.graficoView.obtenerPuntoParetoCercano(e.clientX, e.clientY);
      this.dom.canvasFitness.style.cursor = punto ? "pointer" : "default";
    });

    // Acciones de Toolbar
    this.dom.btnAbrirConstructor.addEventListener("click", () => {
      this.estudioView.abrir(null, false);
    });

    this.dom.btnEditarModelo.addEventListener("click", () => {
      if (!this.vm.modeloActual.esDinamico) return;
      this.estudioView.abrir(this.vm.modeloActual.definicionCruda, true);
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

    this.dom.btnEliminarModelo.addEventListener("click", () => {
      if (!confirm(`¿Deseas eliminar definitivamente la simulación '${this.vm.modeloActual.nombre}'?`)) return;
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
        alert(err.message);
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
        alert(err.message);
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
      (accion, id) => {
        try {
          if (accion === "cargar") {
            this.vm.seleccionarModelo(id);
            this.modalesView.cerrarBiblioteca();
            this.modalesView.notificar(`▶ Simulación cargada`);
          } else if (accion === "copiar") {
            const clon = this.vm.clonarModelo(id);
            this.modalesView.cerrarBiblioteca();
            this.modalesView.notificar(`📑 Simulación copiada como '${clon.nombre}'`);
          } else if (accion === "editar") {
            const mod = this.vm.obtenerModelos().find(m => m.id === id);
            this.modalesView.cerrarBiblioteca();
            if (mod?.esDinamico) this.estudioView.abrir(mod.definicionCruda, true);
          } else if (accion === "renombrar") {
            const mod = this.vm.obtenerModelos().find(m => m.id === id);
            this.modalesView.cerrarBiblioteca();
            if (mod?.esDinamico) this.modalesView.abrirRenombrar(mod);
          } else if (accion === "exportar") {
            const datos = this.vm.generarExportacionSimulacion(id);
            descargarArchivoJSON(`${id}_simulacion.json`, datos);
            this.modalesView.notificar(`📤 Archivo descargado`);
          } else if (accion === "eliminar") {
            if (confirm("¿Estás seguro de que deseas eliminar esta simulación?")) {
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
            if (confirm("¿Deseas eliminar este preset?")) {
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
}

export default AppView;
