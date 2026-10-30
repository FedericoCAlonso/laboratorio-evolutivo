// =========================================================================
// TEST: VERIFICACIÓN DEL SELECTOR DE MODELOS / SIMULACIONES ACTIVAS
// =========================================================================

// Mock de localStorage y DOM para Node.js
const storageMap = new Map();
global.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

// Mock mínimo del DOM para select y option
class MockElement {
  constructor(tag = "div", id = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.options = [];
    this._value = "";
    this.textContent = "";
    this.style = {};
    this.dataset = {};
    this.classList = {
      toggle: () => {},
      add: () => {},
      remove: () => {},
      contains: () => false
    };
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = v;
  }

  appendChild(el) {
    this.children.push(el);
    if (el.tagName === "OPTION") {
      this.options.push(el);
    }
  }

  set innerHTML(html) {
    this.children = [];
    this.options = [];
    if (!html) return;
  }

  addEventListener() {}
  removeEventListener() {}
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

global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => new MockElement("div", id),
  querySelector: () => null,
  querySelectorAll: () => []
};

import { AppViewModel } from "./js/viewmodels/app-viewmodel.js";
import { AppView } from "./js/views/app-view.js";

console.log("=== INICIANDO PRUEBAS DEL SELECTOR DE MODELOS ===");

const vm = new AppViewModel();
let eventoModelosRecibido = false;
let modelosEnEvento = [];

vm.on("modelosActualizados", (modelos) => {
  eventoModelosRecibido = true;
  modelosEnEvento = modelos;
});

// 1. Verificación de emisión de modelosActualizados en restaurarEstadoInicial
console.log("\n[1] Verificando evento 'modelosActualizados' en restaurarEstadoInicial()...");
vm.restaurarEstadoInicial();

if (!eventoModelosRecibido) {
  throw new Error("restaurarEstadoInicial() no emitió 'modelosActualizados'.");
}
if (!Array.isArray(modelosEnEvento) || modelosEnEvento.length < 15) {
  throw new Error(`Se esperaban al menos 15 modelos en 'modelosActualizados', se recibieron ${modelosEnEvento?.length}`);
}
console.log(`    ✓ Evento 'modelosActualizados' emitido con éxito con ${modelosEnEvento.length} modelos | OK`);

// 2. Verificación de AppView._poblarSelectorModelos
console.log("\n[2] Verificando que AppView puebla selectorModelo correctamente...");
const mockSelect = new MockElement("select", "selector-modelo");
const view = new AppView(vm);
view.dom.selectorModelo = mockSelect;
view._suscribirEventosViewModel();

view._poblarSelectorModelos(vm.obtenerModelos());

if (mockSelect.options.length < 15) {
  throw new Error(`El selectorModelo tiene ${mockSelect.options.length} opciones (esperadas >= 15)`);
}
if (mockSelect.value !== vm.modeloActual.id) {
  throw new Error(`El valor del selector (${mockSelect.value}) no coincide con el modelo actual (${vm.modeloActual.id})`);
}
console.log(`    ✓ Selector poblado con ${mockSelect.options.length} opciones. Valor seleccionado: '${mockSelect.value}' | OK`);

// 3. Verificación de cambio reactivo al seleccionar otro modelo
console.log("\n[3] Verificando sincronización de cambio de modelo en selectorModelo...");
vm.seleccionarModelo("armadura-puente");
if (mockSelect.value !== "armadura-puente") {
  throw new Error(`El selector no se sincronizó a 'armadura-puente' (actual: ${mockSelect.value})`);
}
console.log(`    ✓ Sincronización exitosa: nuevo modelo '${mockSelect.value}' reflejado en el selector | OK`);

// 4. Verificación de inserción de modelo dinámico con ícono ✨
console.log("\n[4] Verificando actualización reactiva al crear un modelo dinámico...");
const modDinamico = vm.guardarModeloDinamico({
  nombre: "Optimización Viga I",
  descripcion: "Modelo dinámico de prueba",
  tipoVisualizacion: "calibracion",
  variables: [{ nombre: "espesor", tipo: "continuo", min: 1, max: 20 }],
  codigoEvaluacion: "return vars.espesor * 2;"
});

const opcionDinamica = mockSelect.options.find(opt => opt.value === modDinamico.id);
if (!opcionDinamica) {
  throw new Error(`El modelo dinámico '${modDinamico.id}' no se añadió a las opciones del selector.`);
}
if (!opcionDinamica.textContent.includes("✨")) {
  throw new Error(`El modelo dinámico no muestra el emoji ✨ en el selector: '${opcionDinamica.textContent}'`);
}
console.log(`    ✓ Modelo dinámico añadido correctamente: '${opcionDinamica.textContent}' | OK`);

console.log("\n=== ¡TODAS LAS PRUEBAS DEL SELECTOR DE MODELOS PASARON EXITOSAMENTE (4/4)! ===");
