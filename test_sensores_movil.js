// =========================================================================
// TEST: VERIFICACIÓN DEL APAGADO Y DESCONEXIÓN TOTAL DEL ACELERÓMETRO
// =========================================================================

import assert from "assert";

// Mock del entorno de navegador para Node.js
const storageMap = new Map();
global.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

class MockElement {
  constructor(tag = "div", id = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.options = [];
    this._value = "";
    this.textContent = "";
    this.className = "";
    this.style = {};
    this.dataset = {};
    this.listeners = new Map();
    this.classList = {
      toggle: (cls, force) => {
        if (force === undefined) {
          if (this.className.includes(cls)) this.className = this.className.replace(cls, "").trim();
          else this.className = `${this.className} ${cls}`.trim();
        } else if (force) {
          if (!this.className.includes(cls)) this.className = `${this.className} ${cls}`.trim();
        } else {
          this.className = this.className.replace(cls, "").trim();
        }
      },
      add: (cls) => {
        if (!this.className.includes(cls)) this.className = `${this.className} ${cls}`.trim();
      },
      remove: (cls) => {
        this.className = this.className.replace(cls, "").trim();
      },
      contains: (cls) => this.className.includes(cls)
    };
  }

  get value() { return this._value; }
  set value(v) { this._value = v; }

  appendChild(el) {
    this.children.push(el);
    if (el.tagName === "OPTION") this.options.push(el);
  }

  set innerHTML(html) {
    this.children = [];
    this.options = [];
  }

  addEventListener(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(fn);
  }

  removeEventListener(evt, fn) {
    if (!this.listeners.has(evt)) return;
    this.listeners.set(evt, this.listeners.get(evt).filter(f => f !== fn));
  }

  click() {
    const list = this.listeners.get("click") || [];
    list.forEach(fn => fn({ type: "click" }));
  }

  setAttribute() {}
  getAttribute() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getContext() {
    return {
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      arc: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      save: () => {},
      restore: () => {},
      setLineDash: () => {},
      resetTransform: () => {},
      scale: () => {}
    };
  }
}

const windowListeners = new Map();
global.window = {
  addEventListener: (evt, fn) => {
    if (!windowListeners.has(evt)) windowListeners.set(evt, []);
    windowListeners.get(evt).push(fn);
  },
  removeEventListener: (evt, fn) => {
    if (!windowListeners.has(evt)) return;
    windowListeners.set(evt, windowListeners.get(evt).filter(f => f !== fn));
  }
};

const docListeners = new Map();
global.document = {
  hidden: false,
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => new MockElement("div", id),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (evt, fn) => {
    if (!docListeners.has(evt)) docListeners.set(evt, []);
    docListeners.get(evt).push(fn);
  },
  removeEventListener: (evt, fn) => {
    if (!docListeners.has(evt)) return;
    docListeners.set(evt, docListeners.get(evt).filter(f => f !== fn));
  }
};

import { AppViewModel } from "./js/viewmodels/app-viewmodel.js";
import { AppView } from "./js/views/app-view.js";

console.log("=== INICIANDO PRUEBAS DE APAGADO Y DESCONEXIÓN DE SENSORES HARDWARE ===");

const vm = new AppViewModel();
const view = new AppView(vm);

// Simular DOM con panel y botones
view.dom.panelSensoresMovil = new MockElement("div", "panel-sensores-movil");
view.dom.panelSensoresMovil.style.display = "none";
view.dom.badgeEstadoSensores = new MockElement("span", "badge-estado-sensores");
view.dom.btnActivarGiroscopio = new MockElement("button", "btn-activar-giroscopio");
view.dom.btnCerrarSensoresMovil = new MockElement("button", "btn-cerrar-sensores-movil");
view.dom.lecturaSensoresMovil = new MockElement("span", "lectura-sensores-movil");

view._registrarEventosDOM();

// 1. Verificación de activación
console.log("\n[1] Probando activación de sensores...");
await view._activarSensoresHardwareMovil();

assert.strictEqual(view.sensoresMovilActivos, true, "sensoresMovilActivos debe ser true");
assert.ok(windowListeners.get("deviceorientation")?.length > 0, "Debe registrar listener deviceorientation en window");
assert.ok(windowListeners.get("devicemotion")?.length > 0, "Debe registrar listener devicemotion en window");
assert.strictEqual(view.dom.badgeEstadoSensores.className, "badge-sensor-on");
assert.ok(view.dom.btnActivarGiroscopio.textContent.includes("Apagar"), "Botón debe ofrecer Apagar");
console.log("    ✓ Giroscopio y acelerómetro activados correctamente en window | OK");

// 2. Verificación de apagado y desconexión total
console.log("\n[2] Probando apagado y desconexión completa (removeEventListener)...");
view._desactivarSensoresHardwareMovil(false);

assert.strictEqual(view.sensoresMovilActivos, false, "sensoresMovilActivos debe ser false");
assert.strictEqual(windowListeners.get("deviceorientation")?.length, 0, "deviceorientation DEBE ser removido de window");
assert.strictEqual(windowListeners.get("devicemotion")?.length, 0, "devicemotion DEBE ser removido de window");
assert.strictEqual(view.dom.badgeEstadoSensores.className, "badge-sensor-off");
assert.strictEqual(view.dom.badgeEstadoSensores.textContent, "Apagado");
assert.ok(view.dom.btnActivarGiroscopio.textContent.includes("Activar"), "Botón debe volver al estado Activar");
assert.strictEqual(view.dom.lecturaSensoresMovil.textContent, "γ: 0° · β: 0° · θ: 0°");
console.log("    ✓ Listeners completamente desvinculados de window (acelerómetro apagado) | OK");

// 3. Verificación de conmutación vía botón
console.log("\n[3] Probando conmutación mediante el botón...");
await view._conmutarSensoresHardwareMovil();
assert.strictEqual(view.sensoresMovilActivos, true, "Debe encender al conmutar");
assert.strictEqual(windowListeners.get("devicemotion")?.length, 1, "Debe agregar listener");

await view._conmutarSensoresHardwareMovil();
assert.strictEqual(view.sensoresMovilActivos, false, "Debe apagar al volver a conmutar");
assert.strictEqual(windowListeners.get("devicemotion")?.length, 0, "Debe remover listener");
console.log("    ✓ Botón conmuta y apaga exitosamente | OK");

// 4. Verificación de cierre del panel
console.log("\n[4] Probando apagado automático al cerrar panel...");
await view._activarSensoresHardwareMovil();
assert.strictEqual(view.sensoresMovilActivos, true);
view.dom.panelSensoresMovil.style.display = "flex"; // panel abierto

view._alternarPanelSensoresMovil(); // debe cerrarlo y apagar sensores
assert.strictEqual(view.dom.panelSensoresMovil.style.display, "none", "Panel debe quedar oculto");
assert.strictEqual(view.sensoresMovilActivos, false, "Sensores deben apagarse al cerrar el panel");
assert.strictEqual(windowListeners.get("devicemotion")?.length, 0, "Listeners de acelerómetro deben ser removidos");
console.log("    ✓ Cierre del panel desconecta y apaga el acelerómetro de inmediato | OK");

console.log("\n=== ¡TODAS LAS PRUEBAS DE APAGADO DE SENSORES PASARON EXITOSAMENTE (4/4)! ===");
