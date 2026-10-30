// =========================================================================
// CAPA VISTA: ESTUDIO DE MODELADO DE SIMULACIONES (WORKSPACE COMPLETO)
// ARQUITECTURA MVVM - VISTA DEDICADA DE EDICIÓN LOW-CODE CON PREVIEW EN VIVO
// =========================================================================

import { VisualizadorDinamico } from "./visualizers.js";
import { obtenerPlantillaSimulacion } from "../builder.js";
import { HINTS_VISUALIZACION, mostrarAlerta } from "../ui.js";

// Vista de pantalla completa para el diseño, edición y prueba interactiva de simulaciones evolutivas.
export class EstudioView {
  // Inicializa la vista del Estudio de Modelado asociando referencias DOM y callbacks de ciclo de vida.
  constructor(opciones = {}) {
    this.dom = {
      vistaLaboratorio: document.getElementById("vista-laboratorio"),
      vistaEstudio: document.getElementById("vista-estudio"),
      contenedorPrincipal: document.getElementById("contenedor-principal") || document.querySelector(".app-contenedor"),

      // Acciones del encabezado
      btnVolver: document.getElementById("btn-estudio-volver"),
      btnGuardar: document.getElementById("btn-estudio-guardar"),
      btnProbar: document.getElementById("btn-estudio-probar"),
      tituloEstudio: document.getElementById("estudio-titulo"),
      subtituloEstudio: document.getElementById("estudio-subtitulo"),
      alerta: document.getElementById("alerta-estudio"),
      selectPlantilla: document.getElementById("select-plantilla-constructor"),

      // Pestañas (Tabs) Material 3
      tabBtnVars: document.getElementById("tab-btn-vars"),
      tabBtnCodigo: document.getElementById("tab-btn-codigo"),
      tabBtnMeta: document.getElementById("tab-btn-meta"),
      tabPanelVars: document.getElementById("tab-panel-vars"),
      tabPanelCodigo: document.getElementById("tab-panel-codigo"),
      tabPanelMeta: document.getElementById("tab-panel-meta"),

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

    this.onGuardar = opciones.onGuardar || null;
    this.onCerrar = opciones.onCerrar || null;

    // Instancia del visualizador dinámico para la previsualización en vivo
    this.visualizador = new VisualizadorDinamico();

    // Estado interno del estudio
    this.modo = "creacion"; // 'creacion' | 'edicion'
    this.modeloIdActual = null;
    this.tabActiva = "vars"; // 'vars' | 'codigo' | 'meta'
    this.valoresGenesPrueba = {};

    this._registrarEventos();
  }

  // Registra todos los escuchadores de eventos para interactividad, tabs, snippets y sliders.
  _registrarEventos() {
    // 1. Acciones de navegación
    this.dom.btnVolver?.addEventListener("click", () => this.cerrar());
    this.dom.btnGuardar?.addEventListener("click", () => this._ejecutarGuardado());
    this.dom.btnProbar?.addEventListener("click", () => this.ejecutarPruebaEnVivo());
    this.dom.btnRandomProbe?.addEventListener("click", () => this._generarValoresAleatorios());

    // 2. Cambio de pestañas Material 3
    this.dom.tabBtnVars?.addEventListener("click", () => this.cambiarTab("vars"));
    this.dom.tabBtnCodigo?.addEventListener("click", () => this.cambiarTab("codigo"));
    this.dom.tabBtnMeta?.addEventListener("click", () => this.cambiarTab("meta"));

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

  // Cambia la pestaña activa en el editor del Estudio de Modelado.
  cambiarTab(tab) {
    this.tabActiva = tab;

    // Actualiza botones de pestañas
    const botones = [
      { id: "vars", el: this.dom.tabBtnVars, panel: this.dom.tabPanelVars },
      { id: "codigo", el: this.dom.tabBtnCodigo, panel: this.dom.tabPanelCodigo },
      { id: "meta", el: this.dom.tabBtnMeta, panel: this.dom.tabPanelMeta }
    ];

    botones.forEach(({ id, el, panel }) => {
      const esActivo = id === tab;
      if (el) el.classList.toggle("activo", esActivo);
      if (panel) panel.style.display = esActivo ? "flex" : "none";
    });

    if (tab === "codigo" && this.dom.textareaCodigo) {
      this.dom.textareaCodigo.focus();
    }
  }

  // Abre el Estudio de Modelado a pantalla completa inicializando o precargando los datos del modelo.
  abrir(datosIniciales = null, esEdicion = false) {
    this.modo = esEdicion ? "edicion" : "creacion";
    this.modeloIdActual = datosIniciales?.id || null;

    if (this.dom.alerta) mostrarAlerta(null, this.dom.alerta);

    // Ajusta títulos de cabecera
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

    // Transición de vistas en el DOM
    if (this.dom.vistaLaboratorio) this.dom.vistaLaboratorio.style.display = "none";
    if (this.dom.vistaEstudio) {
      this.dom.vistaEstudio.style.display = "flex";
      this.dom.vistaEstudio.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (this.dom.contenedorPrincipal) {
      this.dom.contenedorPrincipal.classList.add("modo-estudio");
    }

    // Carga los datos iniciales o una plantilla por omisión
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
    this.ejecutarPruebaEnVivo();
  }

  // Cierra el Estudio de Modelado y retorna a la vista principal del Laboratorio.
  cerrar() {
    this.visualizador.detener();

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

    // Limpia y reconstruye la tabla de variables
    if (this.dom.tbodyVariables) {
      this.dom.tbodyVariables.innerHTML = "";
      const vars = def.variables || [];
      vars.forEach((v) => this.agregarVariable(v));
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

    // Columna 1: Nombre de la variable
    const tdNom = document.createElement("td");
    const inpNom = document.createElement("input");
    inpNom.type = "text";
    inpNom.className = "var-nombre input-m3-campo";
    inpNom.placeholder = "ej: radio";
    inpNom.value = v.nombre || "";
    inpNom.addEventListener("input", () => this.sincronizarSlidersGenes());
    tdNom.appendChild(inpNom);

    // Columna 2: Tipo de variable (continuo / entero)
    const tdTipo = document.createElement("td");
    const selTipo = document.createElement("select");
    selTipo.className = "var-tipo select-m3-campo";
    const optCont = document.createElement("option");
    optCont.value = "continuo";
    optCont.textContent = "Continuo";
    const optEnt = document.createElement("option");
    optEnt.value = "entero";
    optEnt.textContent = "Entero";
    if (v.tipo === "entero") optEnt.selected = true;
    else optCont.selected = true;
    selTipo.appendChild(optCont);
    selTipo.appendChild(optEnt);
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

      const nom = inpNom ? inpNom.value.trim() : "";
      if (nom) {
        variables.push({
          nombre: nom,
          tipo: selTipo ? selTipo.value : "continuo",
          min: inpMin ? parseFloat(inpMin.value) : 0,
          max: inpMax ? parseFloat(inpMax.value) : 100
        });
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
      codigoEvaluacion
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

      const item = document.createElement("div");
      item.className = "item-slider-gen";

      const header = document.createElement("div");
      header.className = "header-slider-gen";
      header.innerHTML = `
        <span class="gen-nombre">${nombre}</span>
        <span class="gen-valor" id="val-gen-${nombre}">${valActual.toFixed(esEntero ? 0 : 2)}</span>
      `;

      const inputSlider = document.createElement("input");
      inputSlider.type = "range";
      inputSlider.className = "slider-m3";
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
      new Function("vars", "rng", codigo);
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
      const fnEval = new Function("vars", "rng", def.codigoEvaluacion);

      // Arma el objeto vars con los valores de prueba activos
      const vars = {};
      const genoma = [];
      def.variables.forEach((v) => {
        let val = this.valoresGenesPrueba[v.nombre];
        if (val === undefined) {
          val = (v.min + v.max) / 2;
          if (v.tipo === "entero") val = Math.round(val);
          this.valoresGenesPrueba[v.nombre] = val;
        }
        vars[v.nombre] = val;
        genoma.push(val);
      });

      // Medición de rendimiento de la función
      const t0 = performance.now();
      const resultadoFitness = fnEval(vars, Math.random);
      const t1 = performance.now();
      const tiempoMs = (t1 - t0).toFixed(2);

      // Actualiza indicadores del HUD
      if (this.dom.hudTiempo) {
        this.dom.hudTiempo.textContent = `${tiempoMs} ms`;
      }

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
            fitness: resultadoFitness
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
