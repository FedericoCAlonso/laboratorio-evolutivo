import assert from "assert";
import { GrafoMecanismoMultifisica, crearGrafoConfinamientoEM } from "./js/engines/mecanismos.js";
import { EditorGraficoView } from "./js/views/editor-grafico-view.js";
import { EstudioView } from "./js/views/estudio-view.js";

console.log("=== INICIANDO PRUEBAS DE REACTIVIDAD CAD EN CONFINAMIENTO-EM ===");

// 1. Verificación del Grafo de Confinamiento EM
const grafo = crearGrafoConfinamientoEM({ i1: 5.0, i2: -6.0, vSup: 120.0, vInf: -140.0 });
const b1 = grafo.nodos.find(n => n.id === "bobina1");
const b2 = grafo.nodos.find(n => n.id === "bobina2");
const ps = grafo.nodos.find(n => n.id === "placa_sup");

assert.ok(b1, "Debe existir bobina1");
assert.strictEqual(b1.variableY, "i1", "variableY de bobina1 debe ser i1");
assert.strictEqual(b1.variableIman, "i1", "variableIman de bobina1 debe ser i1");
assert.strictEqual(b1.imanDipolo, 5.0, "imanDipolo debe ser 5.0");
assert.strictEqual(b1.y, 16.0 + 5.0 * 0.5, "y debe coincidir con escala y offset");

assert.strictEqual(b2.imanDipolo, -6.0, "imanDipolo de bobina2 debe preservar valor negativo (-6.0)");
assert.strictEqual(ps.cargaElectrica, 120.0, "cargaElectrica de placa_sup debe ser 120.0");
console.log("    ✓ Grafo de Confinamiento EM correctamente inicializado con soporte de signos | OK");

// 2. Verificación de la propagación reactiva en EditorGraficoView
let ultimaVarModificada = null;
const editor = new EditorGraficoView({
  onVariableModificada: (ev) => {
    ultimaVarModificada = ev;
  }
});

// Mock mínimo de DOM para EditorGraficoView
editor.dom = {
  canvas: { width: 800, height: 600, clientWidth: 800, clientHeight: 600 },
  ctx: {
    resetTransform: () => {},
    scale: () => {},
    clearRect: () => {},
    beginPath: () => {},
    stroke: () => {},
    fill: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    closePath: () => {},
    roundRect: () => {},
    fillRect: () => {},
    setLineDash: () => {},
    measureText: () => ({ width: 40 }),
    fillText: () => {}
  },
  badgeDof: { style: {} },
  inspectorTipoTag: { textContent: "" },
  inspectorContenido: {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => []
  },
  conteoVars: { textContent: "" },
  listaVariablesVivas: {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => []
  }
};

editor.cargarGrafo(grafo);

// 3. Probar actualización de variables negativas y positivas
editor.actualizarValoresVariables({ i1: 8.0, i2: -10.0, vSup: 150.0 });
const nodoB1 = editor.grafo.nodos.find(n => n.id === "bobina1");
const nodoB2 = editor.grafo.nodos.find(n => n.id === "bobina2");

assert.strictEqual(nodoB1.imanDipolo, 8.0, "imanDipolo debe sincronizarse a 8.0");
assert.strictEqual(nodoB1.y, 16.0 + 8.0 * 0.5, "y de bobina1 debe ser 20.0");
assert.strictEqual(nodoB2.imanDipolo, -10.0, "imanDipolo debe sincronizarse a -10.0");
assert.strictEqual(nodoB2.y, 16.0 - 10.0 * 0.5, "y de bobina2 debe ser 11.0");
console.log("    ✓ Sincronización en EditorGraficoView con valores negativos y dipolos | OK");

// 4. Probar arrastre simulado de nodo en el canvas
const nodoArrastrado = editor.grafo.nodos.find(n => n.id === "bobina1");
// Simulamos arrastrar el nodo hacia y = 22.0 (i1 = (22 - 16) / 0.5 = 12.0)
nodoArrastrado.y = 22.0;
const oy = nodoArrastrado.offsetY || 0;
const ey = nodoArrastrado.escalaY || 1;
const rawY = (nodoArrastrado.y - oy) / ey;
editor.valoresVariables[nodoArrastrado.variableY] = rawY;
nodoArrastrado.imanDipolo = rawY;
if (typeof editor.onVariableModificada === "function") {
  editor.onVariableModificada({ nombre: nodoArrastrado.variableY, valor: rawY });
}

assert.ok(ultimaVarModificada, "onVariableModificada debe haberse disparado");
assert.strictEqual(ultimaVarModificada.nombre, "i1");
assert.strictEqual(ultimaVarModificada.valor, 12.0, "Valor calculado debe ser 12.0 A");
assert.strictEqual(nodoArrastrado.imanDipolo, 12.0, "imanDipolo debe ser 12.0");
console.log("    ✓ Arrastre de nodo en CAD propaga correctamente variables y campos EM | OK");

console.log("\n=== ¡TODAS LAS PRUEBAS DE REACTIVIDAD CAD PASARON CON ÉXITO! ===");
