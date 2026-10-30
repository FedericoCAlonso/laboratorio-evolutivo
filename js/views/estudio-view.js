// =========================================================================
// CAPA VISTA: ESTUDIO DE MODELADO DE SIMULACIONES (WORKSPACE COMPLETO)
// ARQUITECTURA MVVM - VISTA DEDICADA DE EDICIÓN LOW-CODE CON PREVIEW EN VIVO
// =========================================================================

import { VisualizadorDinamico } from "./visualizers.js?v=2.4";
import { obtenerPlantillaSimulacion } from "../builder.js?v=2.4";
import { HINTS_VISUALIZACION, mostrarAlerta } from "../ui.js?v=2.4";
import { MotorCamposUnificados } from "../engines/campos.js?v=2.4";
import { MotorEstructurasCinematica } from "../engines/estructuras.js?v=2.4";
import { MotorOndasAcustica } from "../engines/ondas.js?v=2.4";
import { MotorFuncionalTopologico } from "../engines/topologia.js?v=2.4";
import { EditorGraficoView } from "./editor-grafico-view.js?v=2.5";
import {
  GrafoMecanismoMultifisica,
  crearGrafoPataJansen,
  crearGrafoBrazoRobotico,
  crearGrafoPataCaminante
} from "../engines/mecanismos.js?v=2.5";

// Vista de pantalla completa para el diseño, edición y prueba interactiva de simulaciones evolutivas.
export class EstudioView {
  // Inicializa la vista del Estudio de Modelado asociando referencias DOM y callbacks de ciclo de vida.
  constructor(opciones = {}) {
    this.onGuardar = opciones.onGuardar || null;
    this.onCerrar = opciones.onCerrar || null;

    // Instancia del visualizador dinámico para la previsualización en vivo
    this.visualizador = new VisualizadorDinamico();

    // Editor Gráfico CAD de Mecanismos Multicuerpo y Multifísica 2D
    this.editorGrafico = new EditorGraficoView({
      onGrafoModificado: (grafo) => {
        this.sincronizarVariablesDesdeGrafo(grafo);
        this.ejecutarPruebaEnVivo();
      },
      onVariableVinculada: (variable) => {
        this._asegurarVariableEnTabla(variable);
      },
      onVariableModificada: ({ nombre, valor }) => {
        this._actualizarValorVariableDesdeCAD(nombre, valor);
      }
    });

    // Estado interno del estudio
    this.modo = "creacion"; // 'creacion' | 'edicion'
    this.modeloIdActual = null;
    this.tabActiva = "vars"; // 'vars' | 'codigo' | 'meta'
    this.valoresGenesPrueba = {};
    this._eventosRegistrados = false;

    this._mapearDom();
    this._registrarEventos();
  }

  // Mapea y actualiza las referencias a los elementos del DOM del Estudio de Modelado.
  _mapearDom() {
    this.dom = {
      vistaLaboratorio: document.getElementById("vista-laboratorio"),
      vistaEstudio: document.getElementById("vista-estudio"),
      contenedorPrincipal: document.getElementById("contenedor-principal") || document.querySelector(".app-contenedor"),

      // Acciones del encabezado
      btnVolver: document.getElementById("btn-estudio-volver") || document.getElementById("btn-cancelar-modelo"),
      btnGuardar: document.getElementById("btn-guardar-modelo") || document.getElementById("btn-estudio-guardar"),
      btnProbar: document.getElementById("btn-estudio-probar"),
      tituloEstudio: document.getElementById("estudio-titulo"),
      subtituloEstudio: document.getElementById("estudio-subtitulo"),
      alerta: document.getElementById("alerta-estudio"),
      selectPlantilla: document.getElementById("select-plantilla-constructor"),

      // Pestañas (Tabs) Material 3 y Navegación de Etapas
      tabsEstudio: document.getElementById("tabs-estudio-contenedor") || document.querySelector(".tabs-estudio"),
      tabBtnVars: document.getElementById("tab-btn-vars"),
      tabBtnMecanismo: document.getElementById("tab-btn-mecanismo"),
      tabBtnCodigo: document.getElementById("tab-btn-codigo"),
      tabBtnMeta: document.getElementById("tab-btn-meta"),
      tabPanelVars: document.getElementById("tab-panel-vars"),
      tabPanelMecanismo: document.getElementById("tab-panel-mecanismo"),
      tabPanelCodigo: document.getElementById("tab-panel-codigo"),
      tabPanelMeta: document.getElementById("tab-panel-meta"),
      panelEditor: document.querySelector(".panel-editor-estudio"),
      gridEstudio: document.querySelector(".grid-estudio"),
      contenedorCad: document.getElementById("contenedor-editor-grafico-cad"),

      // Botones de navegación secuencial entre etapas (Workflow por pasos)
      btnEtapaSiguienteVars: document.getElementById("btn-etapa-siguiente-vars"),
      btnEtapaAnteriorMecanismo: document.getElementById("btn-etapa-anterior-mecanismo"),
      btnEtapaSiguienteMecanismo: document.getElementById("btn-etapa-siguiente-mecanismo"),
      btnEtapaAnteriorCodigo: document.getElementById("btn-etapa-anterior-codigo"),
      btnEtapaSiguienteCodigo: document.getElementById("btn-etapa-siguiente-codigo"),
      btnEtapaAnteriorMeta: document.getElementById("btn-etapa-anterior-meta"),
      btnEtapaGuardarMeta: document.getElementById("btn-etapa-guardar-meta"),

      // Tab 1: Variables
      tbodyVariables: document.getElementById("tbody-variables-constructor"),
      btnAgregarVariable: document.getElementById("btn-agregar-variable"),

      // Tab 2: Código
      textareaCodigo: document.getElementById("textarea-codigo-evaluacion"),
      statusCodigo: document.getElementById("estudio-status-codigo"),
      barraSnippets: document.getElementById("estudio-barra-snippets"),

      // Tab 3: Metadatos
      inputNombre: document.getElementById("input-nombre-modelo"),
      inputDesc: document.getElementById("input-desc-modelo"),
      selectTipoVisualizacion: document.getElementById("select-tipo-visualizacion"),
      hintTipoVisualizacion: document.getElementById("hint-tipo-visualizacion"),

      // Panel derecho: Preview en tiempo real y HUD
      contenedorCanvas: document.getElementById("estudio-contenedor-canvas"),
      canvasPreview: document.getElementById("canvas-preview-estudio"),
      btnRandomProbe: document.getElementById("btn-estudio-random-probe"),
      slidersGenesContenedor: document.getElementById("estudio-sliders-genes"),
      hudFitness: document.getElementById("estudio-hud-fitness"),
      hudTiempo: document.getElementById("estudio-hud-tiempo"),
      hudDescribir: document.getElementById("estudio-preview-describir")
    };
  }

  // Registra todos los escuchadores de eventos para interactividad, tabs, snippets y sliders.
  _registrarEventos() {
    if (this._eventosRegistrados) return;
    this._eventosRegistrados = true;

    // 1. Acciones de navegación
    this.dom.btnVolver?.addEventListener("click", () => this.cerrar());
    this.dom.btnGuardar?.addEventListener("click", () => this._ejecutarGuardado());
    this.dom.btnProbar?.addEventListener("click", () => this.ejecutarPruebaEnVivo());
    this.dom.btnRandomProbe?.addEventListener("click", () => this._generarValoresAleatorios());

    // 2. Cambio de pestañas Material 3 y navegación por etapas
    const manejarClickTab = (nombreTab) => {
      this.cambiarTab(nombreTab);
    };

    this.dom.tabBtnVars?.addEventListener("click", () => manejarClickTab("vars"));
    this.dom.tabBtnMecanismo?.addEventListener("click", () => manejarClickTab("mecanismo"));
    this.dom.tabBtnCodigo?.addEventListener("click", () => manejarClickTab("codigo"));
    this.dom.tabBtnMeta?.addEventListener("click", () => manejarClickTab("meta"));

    // Delegación sobre el contenedor de pestañas para máxima robustez ante clics e interacciones táctiles
    this.dom.tabsEstudio?.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-estudio-btn");
      if (!btn) return;
      const tabTarget = btn.dataset.tab || (
        btn.id === "tab-btn-vars" ? "vars" :
        btn.id === "tab-btn-mecanismo" ? "mecanismo" :
        btn.id === "tab-btn-codigo" ? "codigo" : "meta"
      );
      manejarClickTab(tabTarget);
    });

    // Accesibilidad por teclado en la barra de pestañas (Flechas Izquierda / Derecha)
    this.dom.tabsEstudio?.addEventListener("keydown", (e) => {
      const orden = ["vars", "mecanismo", "codigo", "meta"];
      const idx = orden.indexOf(this.tabActiva);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const prox = orden[(idx + 1) % orden.length];
        this.cambiarTab(prox);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = orden[(idx - 1 + orden.length) % orden.length];
        this.cambiarTab(prev);
      }
    });

    // Botones de navegación secuencial entre etapas (Flujo guiado tipo Wizard de 4 pasos)
    this.dom.btnEtapaSiguienteVars?.addEventListener("click", () => this.cambiarTab("mecanismo"));
    this.dom.btnEtapaAnteriorMecanismo?.addEventListener("click", () => this.cambiarTab("vars"));
    this.dom.btnEtapaSiguienteMecanismo?.addEventListener("click", () => this.cambiarTab("codigo"));
    this.dom.btnEtapaAnteriorCodigo?.addEventListener("click", () => this.cambiarTab("mecanismo"));
    this.dom.btnEtapaSiguienteCodigo?.addEventListener("click", () => this.cambiarTab("meta"));
    this.dom.btnEtapaAnteriorMeta?.addEventListener("click", () => this.cambiarTab("codigo"));
    this.dom.btnEtapaGuardarMeta?.addEventListener("click", () => this._ejecutarGuardado());

    // 3. Tab 1: Agregar variable
    this.dom.btnAgregarVariable?.addEventListener("click", () => {
      const idx = (this.dom.tbodyVariables?.children.length || 0) + 1;
      this.agregarVariable({
        nombre: `var${idx}`,
        tipo: "continuo",
        min: 0,
        max: 100
      });
      this.sincronizarSlidersGenes();
      this.ejecutarPruebaEnVivo();
    });

    // 4. Selector de plantillas
    this.dom.selectPlantilla?.addEventListener("change", (e) => {
      const clave = e.target.value;
      if (!clave) return;
      const plantilla = obtenerPlantillaSimulacion(clave);
      if (!plantilla) return;

      this.cargarDesdeDefinicion(plantilla, false);
      this.ejecutarPruebaEnVivo();
    });

    // 5. Selector de tipo de visualización
    this.dom.selectTipoVisualizacion?.addEventListener("change", (e) => {
      const tipo = e.target.value;
      if (this.dom.hintTipoVisualizacion) {
        this.dom.hintTipoVisualizacion.textContent = HINTS_VISUALIZACION[tipo] || "";
      }
      this.ejecutarPruebaEnVivo();
    });

    // 6. Editor de código: validación de sintaxis en tiempo real al escribir
    this.dom.textareaCodigo?.addEventListener("input", () => {
      this._validarSintaxisCodigo();
    });

    // Soporte para tecla Tab en el textarea de código
    this.dom.textareaCodigo?.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = this.dom.textareaCodigo.selectionStart;
        const end = this.dom.textareaCodigo.selectionEnd;
        this.dom.textareaCodigo.value =
          this.dom.textareaCodigo.value.substring(0, start) +
          "  " +
          this.dom.textareaCodigo.value.substring(end);
        this.dom.textareaCodigo.selectionStart = this.dom.textareaCodigo.selectionEnd = start + 2;
        this._validarSintaxisCodigo();
      }
    });

    // 7. Botones de snippets de código
    if (this.dom.barraSnippets) {
      this.dom.barraSnippets.querySelectorAll(".btn-snippet").forEach((btn) => {
        btn.addEventListener("click", () => {
          const snippetTipo = btn.dataset.snippet;
          this._insertarSnippet(snippetTipo);
        });
      });
    }
  }

  // Cambia la pestaña activa en el editor del Estudio de Modelado garantizando accesibilidad y foco.
  cambiarTab(tab) {
    this.tabActiva = tab;

    const btnVars = this.dom?.tabBtnVars || document.getElementById("tab-btn-vars");
    const btnMecanismo = this.dom?.tabBtnMecanismo || document.getElementById("tab-btn-mecanismo");
    const btnCodigo = this.dom?.tabBtnCodigo || document.getElementById("tab-btn-codigo");
    const btnMeta = this.dom?.tabBtnMeta || document.getElementById("tab-btn-meta");
    const panelVars = this.dom?.tabPanelVars || document.getElementById("tab-panel-vars");
    const panelMecanismo = this.dom?.tabPanelMecanismo || document.getElementById("tab-panel-mecanismo");
    const panelCodigo = this.dom?.tabPanelCodigo || document.getElementById("tab-panel-codigo");
    const panelMeta = this.dom?.tabPanelMeta || document.getElementById("tab-panel-meta");
    const grid = this.dom?.gridEstudio || document.querySelector(".grid-estudio");

    // En la etapa de mecanismo gráfico, se activa el modo pantalla completa para el editor CAD
    if (grid) {
      grid.classList.toggle("modo-lienzo-completo", tab === "mecanismo");
    }

    // Actualiza botones de pestañas y accesibilidad WAI-ARIA
    const botones = [
      { id: "vars", el: btnVars, panel: panelVars },
      { id: "mecanismo", el: btnMecanismo, panel: panelMecanismo },
      { id: "codigo", el: btnCodigo, panel: panelCodigo },
      { id: "meta", el: btnMeta, panel: panelMeta }
    ];

    botones.forEach(({ id, el, panel }) => {
      const esActivo = id === tab;
      if (el) {
        el.classList.toggle("activo", esActivo);
        if (typeof el.setAttribute === "function") {
          el.setAttribute("aria-selected", esActivo ? "true" : "false");
          el.setAttribute("tabindex", esActivo ? "0" : "-1");
        }
      }
      if (panel) {
        panel.style.display = esActivo ? "flex" : "none";
      }
    });

    // Si se activa la pestaña de mecanismo, asegurar que el canvas CAD esté montado y renderizado
    if (tab === "mecanismo") {
      const contCad = this.dom?.contenedorCad || document.getElementById("contenedor-editor-grafico-cad");
      if (this.editorGrafico && contCad) {
        if (!this.editorGrafico.contenedor || this.editorGrafico.contenedor !== contCad) {
          this.editorGrafico.inicializar(contCad);
        }
        this.editorGrafico.actualizarValoresVariables(this.valoresGenesPrueba);
        this.editorGrafico.redibujar();
      }
    }

    // Enfocar automáticamente el textarea si se pasa a la etapa de código
    const textarea = this.dom?.textareaCodigo || document.getElementById("textarea-codigo-evaluacion");
    if (tab === "codigo" && textarea) {
      setTimeout(() => textarea?.focus(), 60);
    }

    // Desplazar el panel hacia arriba para orientar visualmente al usuario al inicio de la etapa
    const panelEditor = this.dom?.panelEditor || document.querySelector(".panel-editor-estudio");
    if (panelEditor) {
      try {
        panelEditor.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {}
    }
  }

  // Ejecuta la validación y guardado de la simulación activa.
  ejecutarGuardado() {
    this._ejecutarGuardado();
  }

  // Abre el Estudio de Modelado a pantalla completa inicializando o precargando los datos del modelo.
  abrir(datosIniciales = null, esEdicion = false) {
    try {
      this._mapearDom();
      this._registrarEventos();
      this.modo = esEdicion ? "edicion" : "creacion";
      this.modeloIdActual = datosIniciales?.id || null;

      // 1. Transición de vistas en el DOM: garantiza que el editor sea visible inmediatamente
      if (this.dom.vistaLaboratorio) this.dom.vistaLaboratorio.style.display = "none";
      if (this.dom.vistaEstudio) {
        this.dom.vistaEstudio.style.display = "flex";
        try { this.dom.vistaEstudio.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) {}
      }
      if (this.dom.contenedorPrincipal) {
        this.dom.contenedorPrincipal.classList.add("modo-estudio");
      }

      if (this.dom.alerta) mostrarAlerta(null, this.dom.alerta);

      // 2. Ajusta títulos de cabecera
      if (this.dom.tituloEstudio) {
        this.dom.tituloEstudio.textContent = esEdicion
          ? `✏️ Editando: ${datosIniciales?.nombre || "Simulación"}`
          : "🛠️ Estudio de Modelado de Simulaciones";
      }
      if (this.dom.subtituloEstudio) {
        this.dom.subtituloEstudio.textContent = esEdicion
          ? "Modo Edición Low-Code (Tiempo Real)"
          : "Nuevo Modelo Matemático";
      }

      // 3. Montar editor CAD en su contenedor si está disponible
      if (this.dom.contenedorCad && this.editorGrafico) {
        if (!this.editorGrafico.contenedor || this.editorGrafico.contenedor !== this.dom.contenedorCad) {
          this.editorGrafico.inicializar(this.dom.contenedorCad);
        }
      }

      // 4. Carga los datos iniciales o una plantilla por omisión
      if (datosIniciales) {
        this.cargarDesdeDefinicion(datosIniciales, esEdicion);
      } else {
        const plantillaBase = obtenerPlantillaSimulacion("campo_potencial");
        if (plantillaBase) {
          this.cargarDesdeDefinicion(plantillaBase, false);
        } else {
          this._cargarPorDefecto();
        }
      }

      this.cambiarTab("vars");
      this.sincronizarSlidersGenes();

      // 5. Intenta ejecutar la prueba en vivo sin bloquear si ocurre alguna excepción
      try {
        this.ejecutarPruebaEnVivo();
      } catch (errPrueba) {
        console.warn("[EstudioView] Advertencia en evaluación inicial:", errPrueba);
      }
    } catch (errGlobal) {
      console.error("[EstudioView] Error en apertura:", errGlobal);
      // Asegurar que las vistas queden en estado de estudio aunque haya habido error de datos
      if (this.dom.vistaEstudio) this.dom.vistaEstudio.style.display = "flex";
      if (this.dom.vistaLaboratorio) this.dom.vistaLaboratorio.style.display = "none";
      if (this.dom.alerta) mostrarAlerta(`Error al abrir editor: ${errGlobal.message}`, this.dom.alerta);
    }
  }

  // Cierra el Estudio de Modelado y retorna a la vista principal del Laboratorio.
  cerrar() {
    this.visualizador.detener();
    if (this.editorGrafico) {
      this.editorGrafico.detener();
    }

    if (this.dom.vistaEstudio) this.dom.vistaEstudio.style.display = "none";
    if (this.dom.vistaLaboratorio) this.dom.vistaLaboratorio.style.display = "flex";
    if (this.dom.contenedorPrincipal) {
      this.dom.contenedorPrincipal.classList.remove("modo-estudio");
    }

    if (typeof this.onCerrar === "function") {
      this.onCerrar();
    }
  }

  // Carga una definición completa en los formularios del Estudio.
  cargarDesdeDefinicion(def, esEdicion = false) {
    if (this.dom.inputNombre) this.dom.inputNombre.value = def.nombre || "";
    if (this.dom.inputDesc) this.dom.inputDesc.value = def.descripcion || "";

    const tipoVis = def.tipoVisualizacion || "calibracion";
    if (this.dom.selectTipoVisualizacion) {
      this.dom.selectTipoVisualizacion.value = tipoVis;
    }
    if (this.dom.hintTipoVisualizacion) {
      this.dom.hintTipoVisualizacion.textContent = HINTS_VISUALIZACION[tipoVis] || "";
    }

    if (this.dom.textareaCodigo) {
      this.dom.textareaCodigo.value = def.codigoEvaluacion || "";
    }

    // Limpia y reconstruye la tabla de variables e inicializa sus valores nominales de prueba
    this.valoresGenesPrueba = {};
    if (this.dom.tbodyVariables) {
      this.dom.tbodyVariables.innerHTML = "";
      const vars = def.variables || [];
      vars.forEach((v) => {
        this.agregarVariable(v);
        if (v.nombre) {
          let valInit = v.valorNominal !== undefined ? Number(v.valorNominal) : (Number(v.min || 0) + Number(v.max || 100)) / 2;
          if (v.tipo === "entero" || v.tipo === "categorico") valInit = Math.round(valInit);
          this.valoresGenesPrueba[v.nombre] = valInit;
        }
      });
    }

    // Carga o genera el grafo de mecanismo multicuerpo en el editor CAD
    if (this.editorGrafico) {
      if (def.grafo) {
        this.editorGrafico.cargarGrafo(def.grafo);
      } else if (def.id === "pata-jansen" || def.id === "jansen" || def.nombre?.toLowerCase().includes("jansen")) {
        this.editorGrafico.cargarGrafo(crearGrafoPataJansen(this.valoresGenesPrueba));
      } else if (def.id === "pata-caminante" || def.nombre?.toLowerCase().includes("caminante")) {
        this.editorGrafico.cargarGrafo(crearGrafoPataCaminante(this.valoresGenesPrueba));
      } else if (def.id === "brazo-robotico" || def.id === "brazo" || def.nombre?.toLowerCase().includes("brazo")) {
        this.editorGrafico.cargarGrafo(crearGrafoBrazoRobotico(this.valoresGenesPrueba));
      } else {
        this.editorGrafico.cargarGrafo(new GrafoMecanismoMultifisica());
      }
      this.editorGrafico.actualizarValoresVariables(this.valoresGenesPrueba);
    }

    this._validarSintaxisCodigo();
    this.sincronizarSlidersGenes();
  }

  // Carga una configuración por defecto en caso de no proveer plantilla ni datos iniciales.
  _cargarPorDefecto() {
    if (this.dom.inputNombre) this.dom.inputNombre.value = "Mi Simulación Dinámica";
    if (this.dom.inputDesc) this.dom.inputDesc.value = "Optimización geométrica y de volumen 2D";
    if (this.dom.selectTipoVisualizacion) this.dom.selectTipoVisualizacion.value = "calibracion";
    if (this.dom.hintTipoVisualizacion) {
      this.dom.hintTipoVisualizacion.textContent = HINTS_VISUALIZACION["calibracion"];
    }

    if (this.dom.textareaCodigo) {
      this.dom.textareaCodigo.value = `// Minimizar desviación respecto a un área objetivo de 100 m²\nconst area = vars.ancho * vars.alto;\nconst perimetro = 2 * (vars.ancho + vars.alto);\n\n// Retorna [errorArea, perimetro] para Frente de Pareto NSGA-II\nreturn [Math.abs(area - 100), perimetro];`;
    }

    if (this.dom.tbodyVariables) {
      this.dom.tbodyVariables.innerHTML = "";
      this.agregarVariable({ nombre: "ancho", tipo: "continuo", min: 1, max: 20 });
      this.agregarVariable({ nombre: "alto", tipo: "continuo", min: 1, max: 20 });
    }

    this._validarSintaxisCodigo();
    this.sincronizarSlidersGenes();
  }

  // Agrega una fila de configuración de variable a la tabla del Estudio.
  agregarVariable(v = {}) {
    if (!this.dom.tbodyVariables) return;

    const tr = document.createElement("tr");
    if (v.etiqueta) tr.dataset.etiqueta = v.etiqueta;
    if (v.opciones) tr.dataset.opciones = JSON.stringify(v.opciones);

    // Columna 1: Nombre de la variable y su valor nominal / actual en vivo
    const tdNom = document.createElement("td");
    const filaSupNom = document.createElement("div");
    filaSupNom.style.display = "flex";
    filaSupNom.style.alignItems = "center";
    filaSupNom.style.gap = "6px";

    const inpNom = document.createElement("input");
    inpNom.type = "text";
    inpNom.className = "var-nombre input-m3-campo";
    inpNom.placeholder = "ej: radio";
    inpNom.value = v.nombre || "";
    inpNom.style.flex = "1";
    inpNom.addEventListener("input", () => this.sincronizarSlidersGenes());
    filaSupNom.appendChild(inpNom);

    const valNominalInicial = v.valorNominal !== undefined
      ? v.valorNominal
      : ((v.min !== undefined && v.max !== undefined) ? parseFloat(((Number(v.min) + Number(v.max)) / 2).toFixed(2)) : 50);

    const badgeNominalWrap = document.createElement("div");
    badgeNominalWrap.style.display = "inline-flex";
    badgeNominalWrap.style.alignItems = "center";
    badgeNominalWrap.style.gap = "3px";
    badgeNominalWrap.style.background = "rgba(59, 130, 246, 0.12)";
    badgeNominalWrap.style.border = "1px solid rgba(59, 130, 246, 0.35)";
    badgeNominalWrap.style.borderRadius = "6px";
    badgeNominalWrap.style.padding = "2px 6px";
    badgeNominalWrap.title = "Valor actual / nominal (se actualiza en vivo al arrastrar nodos en el CAD)";

    const lblNom = document.createElement("span");
    lblNom.style.fontSize = "0.68rem";
    lblNom.style.fontWeight = "600";
    lblNom.style.color = "var(--md-sys-color-primary, #60a5fa)";
    lblNom.textContent = "Actual:";

    const inpNominal = document.createElement("input");
    inpNominal.type = "number";
    inpNominal.step = "any";
    inpNominal.className = "var-nominal input-m3-campo";
    inpNominal.style.width = "68px";
    inpNominal.style.padding = "2px 4px";
    inpNominal.style.fontSize = "0.75rem";
    inpNominal.style.fontFamily = "monospace";
    inpNominal.value = valNominalInicial;
    inpNominal.addEventListener("input", (e) => {
      const nv = parseFloat(e.target.value);
      const nomAct = inpNom.value.trim();
      if (!isNaN(nv) && nomAct) {
        this.valoresGenesPrueba[nomAct] = nv;
        const hintEl = tr.querySelector(".var-etiqueta-hint");
        if (hintEl) {
          const baseEt = tr.dataset.etiqueta || nomAct;
          hintEl.textContent = `${baseEt} [Actual: ${nv}]`;
        }
        this.sincronizarSlidersGenes();
        this.ejecutarPruebaEnVivo();
      }
    });

    badgeNominalWrap.appendChild(lblNom);
    badgeNominalWrap.appendChild(inpNominal);
    filaSupNom.appendChild(badgeNominalWrap);
    tdNom.appendChild(filaSupNom);

    const hint = document.createElement("div");
    hint.className = "var-etiqueta-hint";
    hint.style.fontSize = "0.72rem";
    hint.style.color = "var(--md-sys-color-on-surface-variant)";
    hint.style.marginTop = "3px";
    hint.style.opacity = "0.85";
    const textoNominal = valNominalInicial !== undefined ? ` [Actual: ${valNominalInicial}]` : "";
    hint.textContent = (v.etiqueta || v.nombre || "Variable") + textoNominal;
    tdNom.appendChild(hint);

    // Columna 2: Tipo de variable (continuo / entero / categorico)
    const tdTipo = document.createElement("td");
    const selTipo = document.createElement("select");
    selTipo.className = "var-tipo select-m3-campo";
    const optCont = document.createElement("option");
    optCont.value = "continuo";
    optCont.textContent = "Continuo";
    const optEnt = document.createElement("option");
    optEnt.value = "entero";
    optEnt.textContent = "Entero";
    const optCat = document.createElement("option");
    optCat.value = "categorico";
    optCat.textContent = "Categórico";
    if (v.tipo === "entero") optEnt.selected = true;
    else if (v.tipo === "categorico") optCat.selected = true;
    else optCont.selected = true;
    selTipo.appendChild(optCont);
    selTipo.appendChild(optEnt);
    selTipo.appendChild(optCat);
    selTipo.addEventListener("change", () => this.sincronizarSlidersGenes());
    tdTipo.appendChild(selTipo);

    // Columna 3: Mínimo
    const tdMin = document.createElement("td");
    const inpMin = document.createElement("input");
    inpMin.type = "number";
    inpMin.className = "var-min input-m3-campo";
    inpMin.step = "any";
    inpMin.value = v.min !== undefined ? v.min : 0;
    inpMin.addEventListener("input", () => this.sincronizarSlidersGenes());
    tdMin.appendChild(inpMin);

    // Columna 4: Máximo
    const tdMax = document.createElement("td");
    const inpMax = document.createElement("input");
    inpMax.type = "number";
    inpMax.className = "var-max input-m3-campo";
    inpMax.step = "any";
    inpMax.value = v.max !== undefined ? v.max : 100;
    inpMax.addEventListener("input", () => this.sincronizarSlidersGenes());
    tdMax.appendChild(inpMax);

    // Columna 5: Botón eliminar
    const tdAccion = document.createElement("td");
    const btnBorrar = document.createElement("button");
    btnBorrar.type = "button";
    btnBorrar.className = "btn-fila-borrar";
    btnBorrar.textContent = "✕";
    btnBorrar.title = "Eliminar variable";
    btnBorrar.addEventListener("click", () => {
      tr.remove();
      this.sincronizarSlidersGenes();
      this.ejecutarPruebaEnVivo();
    });
    tdAccion.appendChild(btnBorrar);

    tr.appendChild(tdNom);
    tr.appendChild(tdTipo);
    tr.appendChild(tdMin);
    tr.appendChild(tdMax);
    tr.appendChild(tdAccion);

    this.dom.tbodyVariables.appendChild(tr);
  }

  // Extrae y valida la definición completa del modelo desde la UI del Estudio.
  extraerDatos() {
    const nombre = this.dom.inputNombre ? this.dom.inputNombre.value.trim() : "";
    const descripcion = this.dom.inputDesc ? this.dom.inputDesc.value.trim() : "";
    const tipoVisualizacion = this.dom.selectTipoVisualizacion ? this.dom.selectTipoVisualizacion.value : "calibracion";
    const codigoEvaluacion = this.dom.textareaCodigo ? this.dom.textareaCodigo.value.trim() : "";

    const variables = [];
    const filas = this.dom.tbodyVariables ? this.dom.tbodyVariables.querySelectorAll("tr") : [];
    filas.forEach((tr) => {
      const inpNom = tr.querySelector(".var-nombre");
      const selTipo = tr.querySelector(".var-tipo");
      const inpMin = tr.querySelector(".var-min");
      const inpMax = tr.querySelector(".var-max");
      const inpNominal = tr.querySelector(".var-nominal");

      const nom = inpNom ? inpNom.value.trim() : "";
      if (nom) {
        const minVal = inpMin ? parseFloat(inpMin.value) : 0;
        const maxVal = inpMax ? parseFloat(inpMax.value) : 100;
        const nomVal = inpNominal && inpNominal.value !== ""
          ? parseFloat(inpNominal.value)
          : (this.valoresGenesPrueba[nom] !== undefined ? this.valoresGenesPrueba[nom] : (minVal + maxVal) / 2);

        const objVar = {
          nombre: nom,
          etiqueta: tr.dataset.etiqueta || nom,
          tipo: selTipo ? selTipo.value : "continuo",
          min: minVal,
          max: maxVal,
          valorNominal: nomVal
        };
        if (tr.dataset.opciones) {
          try { objVar.opciones = JSON.parse(tr.dataset.opciones); } catch (_) {}
        }
        variables.push(objVar);
      }
    });

    if (!nombre) throw new Error("Debe ingresar un nombre para la simulación.");
    if (variables.length === 0) throw new Error("Debe definir al menos una variable de decisión.");
    if (!codigoEvaluacion) throw new Error("La función de evaluación no puede estar vacía.");

    return {
      nombre,
      descripcion,
      tipoVisualizacion,
      variables,
      codigoEvaluacion,
      grafo: this.editorGrafico?.grafo ? this.editorGrafico.grafo.exportarJSON() : null
    };
  }

  // Reconstruye los sliders interactivos en el panel de pruebas derecho según las variables activas.
  sincronizarSlidersGenes() {
    const contenedor = this.dom.slidersGenesContenedor;
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const filas = this.dom.tbodyVariables ? this.dom.tbodyVariables.querySelectorAll("tr") : [];
    filas.forEach((tr) => {
      const inpNom = tr.querySelector(".var-nombre");
      const selTipo = tr.querySelector(".var-tipo");
      const inpMin = tr.querySelector(".var-min");
      const inpMax = tr.querySelector(".var-max");
      const hintEl = tr.querySelector(".var-etiqueta-hint");

      const nombre = inpNom ? inpNom.value.trim() : "";
      if (!nombre) return;

      const min = inpMin ? parseFloat(inpMin.value) || 0 : 0;
      const max = inpMax ? parseFloat(inpMax.value) || 100 : 100;
      const esEntero = selTipo ? selTipo.value === "entero" : false;

      // Obtiene o inicializa el valor de prueba
      let valActual = this.valoresGenesPrueba[nombre];
      if (valActual === undefined || valActual < min || valActual > max) {
        valActual = (min + max) / 2;
        if (esEntero) valActual = Math.round(valActual);
        this.valoresGenesPrueba[nombre] = valActual;
      }

      let etiquetaLimpia = "";
      if (hintEl) {
        etiquetaLimpia = hintEl.textContent.replace(/^.*?:\s*/, "").replace(/\s*\[Nominal:.*?\]/, "");
      }

      const item = document.createElement("div");
      item.className = "item-slider-gen";

      const header = document.createElement("div");
      header.className = "header-slider-gen";
      const subtitulo = etiquetaLimpia ? `<span style="font-size: 0.72rem; opacity: 0.75; font-weight: normal; margin-left: 4px;">(${etiquetaLimpia})</span>` : "";
      header.innerHTML = `
        <span class="gen-nombre" title="${nombre}">${nombre}${subtitulo}</span>
        <span class="gen-valor" id="val-gen-${nombre}">${valActual.toFixed(esEntero ? 0 : 2)}</span>
      `;

      const inputSlider = document.createElement("input");
      inputSlider.type = "range";
      inputSlider.className = "slider-m3";
      inputSlider.dataset.gen = nombre;
      inputSlider.min = min;
      inputSlider.max = max;
      inputSlider.step = esEntero ? "1" : ((max - min) / 200).toString();
      inputSlider.value = valActual;

      inputSlider.addEventListener("input", (e) => {
        const nuevoVal = parseFloat(e.target.value);
        this.valoresGenesPrueba[nombre] = nuevoVal;
        const spanVal = item.querySelector(`#val-gen-${nombre}`);
        if (spanVal) spanVal.textContent = nuevoVal.toFixed(esEntero ? 0 : 2);
        this.ejecutarPruebaEnVivo();
      });

      item.appendChild(header);
      item.appendChild(inputSlider);
      contenedor.appendChild(item);
    });
  }

  // Genera valores aleatorios válidos para cada variable y dispara una nueva evaluación en vivo.
  _generarValoresAleatorios() {
    const filas = this.dom.tbodyVariables ? this.dom.tbodyVariables.querySelectorAll("tr") : [];
    filas.forEach((tr) => {
      const inpNom = tr.querySelector(".var-nombre");
      const selTipo = tr.querySelector(".var-tipo");
      const inpMin = tr.querySelector(".var-min");
      const inpMax = tr.querySelector(".var-max");

      const nombre = inpNom ? inpNom.value.trim() : "";
      if (!nombre) return;

      const min = inpMin ? parseFloat(inpMin.value) || 0 : 0;
      const max = inpMax ? parseFloat(inpMax.value) || 100 : 100;
      const esEntero = selTipo ? selTipo.value === "entero" : false;

      let aleat = min + Math.random() * (max - min);
      if (esEntero) aleat = Math.round(aleat);

      this.valoresGenesPrueba[nombre] = aleat;
    });

    this.sincronizarSlidersGenes();
    this.ejecutarPruebaEnVivo();
  }

  // Valida en tiempo real la sintaxis del código de evaluación JavaScript en el textarea.
  _validarSintaxisCodigo() {
    if (!this.dom.statusCodigo) return true;
    const codigo = this.dom.textareaCodigo ? this.dom.textareaCodigo.value : "";

    try {
      // eslint-disable-next-line no-new-func
      new Function("vars", "rng", "estructuras", "cinematica", "campos", "ondas", "topologia", "sensores", "mecanismo", codigo);
      this.dom.statusCodigo.textContent = "✓ Sintaxis JavaScript válida";
      this.dom.statusCodigo.className = "status-codigo status-valido";
      return true;
    } catch (err) {
      this.dom.statusCodigo.textContent = `⚠️ Error de sintaxis: ${err.message}`;
      this.dom.statusCodigo.className = "status-codigo status-error";
      return false;
    }
  }

  // Ejecuta la función de evaluación con los valores actuales y renderiza la previsualización en vivo.
  ejecutarPruebaEnVivo() {
    if (this.dom.alerta) mostrarAlerta(null, this.dom.alerta);

    try {
      const def = this.extraerDatos();
      const fnEval = new Function("vars", "rng", "estructuras", "cinematica", "campos", "ondas", "topologia", "sensores", "mecanismo", def.codigoEvaluacion);

      // Arma el objeto vars con los valores de prueba activos
      const vars = {};
      const genoma = [];
      def.variables.forEach((v) => {
        let val = this.valoresGenesPrueba[v.nombre];
        if (val === undefined) {
          val = v.valorNominal !== undefined ? v.valorNominal : (v.min + v.max) / 2;
          if (v.tipo === "entero") val = Math.round(val);
          this.valoresGenesPrueba[v.nombre] = val;
        }
        vars[v.nombre] = val;
        genoma.push(val);
      });

      // Actualizar variables en el editor CAD interactivo
      this.editorGrafico?.actualizarValoresVariables(vars);

      // Obtener telemetría de sensores calculada desde el ciclo cinemático CAD
      const telemetriaSensores = this.editorGrafico
        ? this.editorGrafico.obtenerTelemetriaSensores(vars)
        : {};

      // Medición de rendimiento de la función
      const t0 = performance.now();
      const resultadoFitness = fnEval(
        vars,
        Math.random,
        MotorEstructurasCinematica,
        MotorEstructurasCinematica,
        MotorCamposUnificados,
        MotorOndasAcustica,
        MotorFuncionalTopologico,
        telemetriaSensores,
        this.editorGrafico?.grafo
      );
      const t1 = performance.now();
      const tiempoMs = (t1 - t0).toFixed(2);

      // Actualiza indicadores del HUD
      if (this.dom.hudTiempo) {
        this.dom.hudTiempo.textContent = `${tiempoMs} ms`;
      }

      // Actualiza la píldora de Fitness en vivo dentro del Editor CAD 2D
      this.editorGrafico?.actualizarFitnessEnVivo(resultadoFitness);

      if (this.dom.hudFitness) {
        if (Array.isArray(resultadoFitness)) {
          const f1 = typeof resultadoFitness[0] === "number" ? resultadoFitness[0].toFixed(3) : resultadoFitness[0];
          const f2 = typeof resultadoFitness[1] === "number" ? resultadoFitness[1].toFixed(3) : resultadoFitness[1];
          this.dom.hudFitness.textContent = `[f₁: ${f1}, f₂: ${f2}] (Pareto)`;
          this.dom.hudFitness.style.color = "var(--md-sys-color-primary)";
        } else if (typeof resultadoFitness === "number") {
          this.dom.hudFitness.textContent = isFinite(resultadoFitness) ? resultadoFitness.toFixed(4) : "Infinito (Inválido)";
          this.dom.hudFitness.style.color = isFinite(resultadoFitness) ? "var(--md-sys-color-success)" : "var(--md-sys-color-error)";
        } else {
          this.dom.hudFitness.textContent = String(resultadoFitness);
        }
      }

      // Renderiza la vista previa interactiva en el Canvas del Estudio
      if (this.dom.contenedorCanvas) {
        const modeloMock = {
          id: this.modeloIdActual || "modelo_estudio_preview",
          nombre: def.nombre,
          descripcion: def.descripcion,
          tipoVisualizacion: def.tipoVisualizacion,
          grafo: def.grafo,
          variables: def.variables,
          crearGenoma() { return def.variables; },
          describir(g) {
            return `[Estudio Preview] ${def.nombre}\nVisualización: ${def.tipoVisualizacion}\nGenes: ${JSON.stringify(vars, null, 2)}\nFitness: ${JSON.stringify(resultadoFitness)}`;
          }
        };

        this.visualizador.render(
          this.dom.contenedorCanvas,
          genoma,
          {},
          {
            modelo: modeloMock,
            fitness: resultadoFitness,
            esEstudio: true,
            onParamChange: (nuevosValores) => {
              for (const [k, v] of Object.entries(nuevosValores)) {
                this.valoresGenesPrueba[k] = v;
                const spanVal = document.getElementById(`val-gen-${k}`);
                if (spanVal) spanVal.textContent = v.toFixed(2);
                const slider = this.dom.slidersGenesContenedor?.querySelector(`input[data-gen="${k}"]`);
                if (slider) slider.value = v;
              }
              this.ejecutarPruebaEnVivo();
            }
          }
        );

        if (this.dom.hudDescribir) {
          this.dom.hudDescribir.textContent = modeloMock.describir(genoma);
        }
      }
    } catch (err) {
      if (this.dom.hudFitness) {
        this.dom.hudFitness.textContent = `Error: ${err.message}`;
        this.dom.hudFitness.style.color = "var(--md-sys-color-error)";
      }
      if (this.dom.alerta) {
        mostrarAlerta(`Error al evaluar en vivo: ${err.message}`, this.dom.alerta);
      }
    }
  }

  // Inserta un fragmento de código predefinido en la posición del cursor en el editor.
  _insertarSnippet(tipo) {
    if (!this.dom.textareaCodigo) return;

    let snippet = "";
    switch (tipo) {
      case "sensores":
        snippet = `\n// Telemetría en tiempo real desde sensores del lienzo CAD:
const sensorPie = sensores?.pie || {};
const zancada = sensorPie.zancada || 60;
const suavidad = sensorPie.aceleracionPico || 1.0;
const errZancada = Math.abs(zancada - 60);
// Frente de Pareto [Inercia / Suavidad, Error de Zancada]:
return [suavidad, errZancada];`;
        break;
      case "escalar":
        snippet = `\n// Monobjetivo: minimizar error respecto a valor ideal\nconst costo = vars.ancho * vars.alto;\nreturn Math.abs(costo - 100);`;
        break;
      case "pareto":
        snippet = `\n// Multiobjetivo NSGA-II: minimizar f1 y f2 simultáneamente\nconst f1_desempeno = Math.abs(vars.ancho - 15);\nconst f2_costo = vars.alto * 2.5;\nreturn [f1_desempeno, f2_costo];`;
        break;
      case "campos":
        snippet = `\n// Motor de Campos: potencial y deflexión de partículas\nconst dist = Math.hypot(vars.x1 - 20, vars.y1 - 10);\nconst fuerza = (vars.q1 * 50) / Math.max(1, dist * dist);\nreturn [dist, Math.abs(fuerza)];`;
        break;
      case "estructuras":
        snippet = `\n// Motor de Estructuras: cinemática y esfuerzo mecánico\nconst radioTotal = vars.longitud1 + vars.longitud2;\nconst errorAlcance = Math.abs(radioTotal - 60);\nreturn [errorAlcance, vars.longitud1 * 0.1];`;
        break;
      case "jansen":
        snippet = `\n// Simulación cinemática cerrada de Theo Jansen (180 pasos con criterios completos)\nreturn estructuras.evaluarJansenFitness(vars, { modoOptimizacion: "multiobjetivo", maxAncho: 80, maxAlto: 40, obstaculoAlto: 15, zancadaObjetivo: 4.0 });`;
        break;
      case "ondas":
        snippet = `\n// Motor de Ondas: absorción acústica y directividad\nconst absorcion = Math.sin((vars.frecuencia || 1000) * 0.001);\nreturn 1.0 - Math.min(1.0, Math.max(0.0, absorcion));`;
        break;
      case "topologia":
        snippet = `\n// Motor Funcional: Carta de Smith y ROE\nconst roe = 1.0 + Math.abs((vars.zReal - 50) / (vars.zReal + 50));\nreturn roe;`;
        break;
      default:
        break;
    }

    if (!snippet) return;

    const start = this.dom.textareaCodigo.selectionStart;
    const end = this.dom.textareaCodigo.selectionEnd;
    const val = this.dom.textareaCodigo.value;
    this.dom.textareaCodigo.value = val.substring(0, start) + snippet + val.substring(end);
    this.dom.textareaCodigo.selectionStart = this.dom.textareaCodigo.selectionEnd = start + snippet.length;
    this.dom.textareaCodigo.focus();
    this._validarSintaxisCodigo();
    this.ejecutarPruebaEnVivo();
  }

  // Asegura que una variable vinculada en el CAD figure en la tabla de variables del Estudio.
  _asegurarVariableEnTabla(variable) {
    if (!variable || !variable.nombre) return;
    const filas = this.dom.tbodyVariables ? Array.from(this.dom.tbodyVariables.querySelectorAll("tr")) : [];
    const existe = filas.some(tr => {
      const inp = tr.querySelector(".var-nombre");
      return inp && inp.value.trim() === variable.nombre.trim();
    });

    if (!existe) {
      const val = variable.valor !== undefined ? variable.valor : 10;
      this.agregarVariable({
        nombre: variable.nombre.trim(),
        tipo: variable.tipo || "continuo",
        min: variable.min !== undefined ? variable.min : Math.max(0.1, Number((val * 0.7).toFixed(1))),
        max: variable.max !== undefined ? variable.max : Number((val * 1.3).toFixed(1)),
        valorNominal: val
      });
      this.sincronizarSlidersGenes();
    }
  }

  // Sincroniza variables de todas las barras, nodos y motores del grafo CAD
  sincronizarVariablesDesdeGrafo(grafo) {
    if (!grafo) return;
    // 1. Barras articuladas
    grafo.barras?.forEach(b => {
      const varNom = b.variableAsociada || b.longitudVinculada;
      if (varNom) {
        this._asegurarVariableEnTabla({
          nombre: varNom,
          valor: b.longitud,
          min: Math.max(0.1, Number((b.longitud * 0.7).toFixed(1))),
          max: Number((b.longitud * 1.3).toFixed(1))
        });
      }
    });

    // 2. Nodos con variables de posición (como a y l en X_fijo)
    grafo.nodos?.forEach(n => {
      if (n.variableX) {
        const valX = parseFloat(Math.abs(n.x).toFixed(1));
        this._asegurarVariableEnTabla({
          nombre: n.variableX,
          valor: valX,
          min: Math.max(0.1, Number((valX * 0.7).toFixed(1))),
          max: Number((valX * 1.3).toFixed(1))
        });
      }
      if (n.variableY) {
        const valY = parseFloat(Math.abs(n.y).toFixed(1));
        this._asegurarVariableEnTabla({
          nombre: n.variableY,
          valor: valY,
          min: Math.max(0.1, Number((valY * 0.7).toFixed(1))),
          max: Number((valY * 1.3).toFixed(1))
        });
      }
    });

    // 3. Motores y actuadores
    grafo.motores?.forEach(m => {
      const varNom = m.variableAsociada || m.amplitudVinculada;
      if (varNom) {
        this._asegurarVariableEnTabla({
          nombre: varNom,
          valor: m.longitudManivela || m.amplitud || 15,
          min: 1,
          max: 100
        });
      }
    });
  }

  // Actualiza en tiempo real los valores de variables modificadas arrastrando en el lienzo CAD
  _actualizarValorVariableDesdeCAD(nombre, valor) {
    if (!nombre || valor === undefined) return;
    const numVal = Number(valor);
    if (isNaN(numVal)) return;

    this.valoresGenesPrueba[nombre] = numVal;

    // 1. Actualizar el slider y el texto numérico en el HUD de pruebas
    const slider = this.dom.slidersGenesContenedor?.querySelector(`input[data-gen="${nombre}"]`);
    const spanVal = this.dom.slidersGenesContenedor?.querySelector(`#val-gen-${nombre}`);

    if (slider) {
      if (numVal < parseFloat(slider.min)) {
        slider.min = (numVal * 0.8).toFixed(1);
      }
      if (numVal > parseFloat(slider.max)) {
        slider.max = (numVal * 1.2).toFixed(1);
      }
      slider.value = numVal;
    }
    if (spanVal) {
      spanVal.textContent = numVal.toFixed(2);
    }

    // 2. Actualizar la tabla de variables (Etapa 1)
    if (this.dom.tbodyVariables) {
      const filas = Array.from(this.dom.tbodyVariables.querySelectorAll("tr"));
      const fila = filas.find(tr => {
        const inp = tr.querySelector(".var-nombre");
        return inp && inp.value.trim() === nombre;
      });

      if (fila) {
        const inpMin = fila.querySelector(".var-min");
        const inpMax = fila.querySelector(".var-max");
        const inpNominal = fila.querySelector(".var-nominal");
        const hintEl = fila.querySelector(".var-etiqueta-hint");
        if (inpMin && numVal < parseFloat(inpMin.value)) {
          inpMin.value = Math.max(0.1, Number((numVal * 0.7).toFixed(1)));
        }
        if (inpMax && numVal > parseFloat(inpMax.value)) {
          inpMax.value = Number((numVal * 1.3).toFixed(1));
        }
        if (inpNominal) {
          inpNominal.value = numVal;
        }
        if (hintEl) {
          const baseEt = fila.dataset.etiqueta || nombre;
          hintEl.textContent = `${baseEt} [Actual: ${numVal}]`;
        }
      } else {
        this._asegurarVariableEnTabla({
          nombre,
          valor: numVal,
          min: Math.max(0.1, Number((numVal * 0.7).toFixed(1))),
          max: Number((numVal * 1.3).toFixed(1))
        });
      }
    }

    // 3. Ejecución en vivo debounced para sincronía visual en tiempo real
    if (this._debouncePruebaCadTimer) clearTimeout(this._debouncePruebaCadTimer);
    this._debouncePruebaCadTimer = setTimeout(() => {
      this.ejecutarPruebaEnVivo();
      this._debouncePruebaCadTimer = null;
    }, 40);
  }

  // Ejecuta la validación final y despacha el callback onGuardar hacia el ViewModel.
  _ejecutarGuardado() {
    try {
      if (this.dom.alerta) mostrarAlerta(null, this.dom.alerta);
      const def = this.extraerDatos();
      const esEdicion = this.modo === "edicion";
      const idExistente = this.modeloIdActual;

      if (typeof this.onGuardar === "function") {
        this.onGuardar(def, esEdicion, idExistente);
      }
    } catch (err) {
      if (this.dom.alerta) {
        mostrarAlerta(err.message, this.dom.alerta);
      }
    }
  }
}

export default EstudioView;
