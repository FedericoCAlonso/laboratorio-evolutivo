// =========================================================================
// TEST UNITARIO: VERIFICACIÓN DEL ESTUDIO DE MODELADO A PANTALLA COMPLETA
// ARQUITECTURA MVVM - VALIDACIÓN DE WORKSPACE LOW-CODE, TABS Y LIVE PREVIEW
// =========================================================================

import assert from "node:assert";
import { EstudioView } from "./js/views/estudio-view.js";

console.log("=== INICIANDO PRUEBAS DEL ESTUDIO DE MODELADO (FULL-VIEW) ===");

// 1. Mock mínimo de entorno DOM para pruebas Headless
class MockElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList._classes.has(c)) this.classList._classes.delete(c);
          else this.classList._classes.add(c);
        } else if (force) {
          this.classList._classes.add(c);
        } else {
          this.classList._classes.delete(c);
        }
      },
      contains: (c) => this.classList._classes.has(c)
    };
    this.value = "";
    this.textContent = "";
    this._listeners = {};
    this._attributes = {};
  }

  setAttribute(name, val) {
    this._attributes[name] = String(val);
  }

  getAttribute(name) {
    return this._attributes[name] || null;
  }

  set className(names) {
    this.classList._classes.clear();
    (names || "").split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
  }

  get className() {
    return Array.from(this.classList._classes).join(" ");
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }

  remove() {
    // No-op en mock
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  dispatchEvent(event) {
    const list = this._listeners[event.type || event] || [];
    list.forEach(h => h(event));
  }

  querySelector(sel) {
    if (sel.startsWith("#")) {
      const id = sel.slice(1);
      return this._findById(id);
    }
    if (sel.startsWith(".")) {
      const cls = sel.slice(1);
      return this._findByClass(cls);
    }
    return this.children[0] || null;
  }

  querySelectorAll(sel) {
    if (sel === "tr") {
      return this.children.filter(c => c.tagName === "TR");
    }
    return this.children;
  }

  _findByClass(cls) {
    if (this.classList.contains(cls)) return this;
    for (const c of this.children) {
      if (c._findByClass) {
        const found = c._findByClass(cls);
        if (found) return found;
      }
    }
    return null;
  }

  _findById(id) {
    if (this.id === id) return this;
    for (const c of this.children) {
      if (c._findById) {
        const found = c._findById(id);
        if (found) return found;
      }
    }
    return null;
  }

  scrollIntoView() {}
  focus() {}
}

// Configuración de mock en globalThis si document no existe
if (typeof document === "undefined") {
  const elementsById = {
    "vista-laboratorio": new MockElement("main"),
    "vista-estudio": new MockElement("main"),
    "contenedor-principal": new MockElement("div"),
    "btn-estudio-volver": new MockElement("button"),
    "btn-estudio-guardar": new MockElement("button"),
    "btn-estudio-probar": new MockElement("button"),
    "estudio-titulo": new MockElement("h2"),
    "estudio-subtitulo": new MockElement("div"),
    "alerta-estudio": new MockElement("div"),
    "select-plantilla-constructor": new MockElement("select"),
    "tab-btn-vars": new MockElement("button"),
    "tab-btn-codigo": new MockElement("button"),
    "tab-btn-meta": new MockElement("button"),
    "tab-panel-vars": new MockElement("div"),
    "tab-panel-codigo": new MockElement("div"),
    "tab-panel-meta": new MockElement("div"),
    "tabs-estudio-contenedor": new MockElement("div"),
    "btn-etapa-siguiente-vars": new MockElement("button"),
    "btn-etapa-anterior-codigo": new MockElement("button"),
    "btn-etapa-siguiente-codigo": new MockElement("button"),
    "btn-etapa-anterior-meta": new MockElement("button"),
    "btn-etapa-guardar-meta": new MockElement("button"),
    "tbody-variables-constructor": new MockElement("tbody"),
    "btn-agregar-variable": new MockElement("button"),
    "textarea-codigo-evaluacion": new MockElement("textarea"),
    "estudio-status-codigo": new MockElement("div"),
    "estudio-barra-snippets": new MockElement("div"),
    "input-nombre-modelo": new MockElement("input"),
    "input-desc-modelo": new MockElement("input"),
    "select-tipo-visualizacion": new MockElement("select"),
    "hint-tipo-visualizacion": new MockElement("span"),
    "estudio-contenedor-canvas": new MockElement("div"),
    "canvas-preview-estudio": new MockElement("canvas"),
    "btn-estudio-random-probe": new MockElement("button"),
    "estudio-sliders-genes": new MockElement("div"),
    "estudio-hud-fitness": new MockElement("span"),
    "estudio-hud-tiempo": new MockElement("span"),
    "estudio-preview-describir": new MockElement("pre")
  };

  globalThis.document = {
    getElementById: (id) => elementsById[id] || null,
    createElement: (tag) => new MockElement(tag),
    querySelector: () => null,
    querySelectorAll: () => []
  };

  globalThis.performance = {
    now: () => Date.now()
  };
}

console.log("[1] Probando instanciación y enlace del EstudioView...");
let guardadoInvocado = false;
let defGuardada = null;

const estudio = new EstudioView({
  onGuardar: (def) => {
    guardadoInvocado = true;
    defGuardada = def;
  }
});
assert.ok(estudio, "EstudioView debe instanciarse correctamente");
console.log("    ✓ EstudioView inicializado correctamente | OK");

console.log("[2] Probando apertura a pantalla completa y cambio de pestañas M3...");
estudio.abrir(null, false);
assert.strictEqual(estudio.dom.vistaLaboratorio.style.display, "none", "El laboratorio debe ocultarse");
assert.strictEqual(estudio.dom.vistaEstudio.style.display, "flex", "El estudio debe mostrarse en pantalla completa");
assert.ok(estudio.dom.contenedorPrincipal.classList.contains("modo-estudio"), "Debe activarse la clase modo-estudio");

// Cambio de pestaña a Código
estudio.cambiarTab("codigo");
assert.strictEqual(estudio.tabActiva, "codigo", "La pestaña activa debe ser 'codigo'");
assert.strictEqual(estudio.dom.tabPanelCodigo.style.display, "flex", "El panel de código debe ser visible");

// Cambio de pestaña a Metadatos
estudio.cambiarTab("meta");
assert.strictEqual(estudio.tabActiva, "meta", "La pestaña activa debe ser 'meta'");

// Navegación guiada entre etapas con botones Anterior / Siguiente
estudio.dom.btnEtapaAnteriorMeta.dispatchEvent({ type: "click" });
assert.strictEqual(estudio.tabActiva, "codigo", "El botón anterior debe retroceder a 'codigo'");
estudio.dom.btnEtapaAnteriorCodigo.dispatchEvent({ type: "click" });
assert.strictEqual(estudio.tabActiva, "vars", "El botón anterior debe retroceder a 'vars'");
estudio.dom.btnEtapaSiguienteVars.dispatchEvent({ type: "click" });
assert.strictEqual(estudio.tabActiva, "codigo", "El botón siguiente debe avanzar a 'codigo'");
estudio.dom.btnEtapaSiguienteCodigo.dispatchEvent({ type: "click" });
assert.strictEqual(estudio.tabActiva, "meta", "El botón siguiente debe avanzar a 'meta'");

console.log("    ✓ Apertura y navegación fluida entre pestañas M3 y etapas verificadas | OK");

console.log("[3] Probando carga de plantilla y validación de sintaxis...");
estudio.dom.inputNombre.value = "Filtro RLC Optimizado";
estudio.dom.inputDesc.value = "Minimiza la oscilación transitoria";
estudio.dom.selectTipoVisualizacion.value = "serie_temporal";
estudio.dom.textareaCodigo.value = "const err = Math.abs(vars.ancho - 10); return err;";

const sintaxisValida = estudio._validarSintaxisCodigo();
assert.strictEqual(sintaxisValida, true, "El código JavaScript debe ser sintácticamente válido");
console.log("    ✓ Validación de sintaxis JS en tiempo real | OK");

console.log("[4] Probando extracción de datos y persistencia...");
const datosExtraidos = estudio.extraerDatos();
assert.strictEqual(datosExtraidos.nombre, "Filtro RLC Optimizado");
assert.strictEqual(datosExtraidos.tipoVisualizacion, "serie_temporal");
assert.ok(Array.isArray(datosExtraidos.variables));
console.log("    ✓ Extracción de definición cruda de simulación | OK");

console.log("[5] Probando cierre y retorno al Laboratorio...");
estudio.cerrar();
assert.strictEqual(estudio.dom.vistaEstudio.style.display, "none", "El estudio debe ocultarse");
assert.strictEqual(estudio.dom.vistaLaboratorio.style.display, "flex", "El laboratorio debe restaurarse");
assert.strictEqual(estudio.dom.contenedorPrincipal.classList.contains("modo-estudio"), false, "La clase modo-estudio debe quitarse");
console.log("    ✓ Transición fluida de vuelta al Laboratorio | OK");

console.log("\n=== ¡TODAS LAS PRUEBAS DEL ESTUDIO DE MODELADO PASARON CON ÉXITO (5/5)! ===");
