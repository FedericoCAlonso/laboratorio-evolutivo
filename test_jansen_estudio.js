// =========================================================================
// TEST UNITARIO: VERIFICACIÓN DE MODELADO Y EDICIÓN DE PATA JANSEN EN ESTUDIO
// =========================================================================

import assert from "node:assert";
import { ModeloPataJansen, JANSEN_VALORES_REFERENCIA } from "./js/models/jansen.js";
import { PLANTILLAS_SIMULACION, obtenerPlantillaSimulacion, compilarModeloDinamico, validarDefinicionModelo, clonarModeloExistente } from "./js/builder.js";
import AppView from "./js/views/app-view.js";
import { VisualizadorDinamico, VisualizadorJansen } from "./js/views/visualizers.js";

console.log("=== INICIANDO PRUEBAS DE MODELADO DE PATA JANSEN EN EL ESTUDIO ===");

// 1. Verificación del contrato del modelo nativo
console.log("[1] Verificando metadatos y genes canónicos de ModeloPataJansen...");
assert.strictEqual(ModeloPataJansen.tipoVisualizacion, "mecanismo_jansen", "Debe tener tipoVisualizacion mecanismo_jansen");
const genes = ModeloPataJansen.crearGenoma();
assert.strictEqual(genes.length, 12, "Debe tener 12 genes");
const clavesEsperadas = ["a", "l", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
genes.forEach((g, idx) => {
  assert.strictEqual(g.nombre, clavesEsperadas[idx], `Gen ${idx} debe llamarse ${clavesEsperadas[idx]}`);
  assert.ok(g.etiqueta && g.etiqueta.includes(clavesEsperadas[idx]), `Debe tener etiqueta descriptiva para ${clavesEsperadas[idx]}`);
  assert.strictEqual(g.valorNominal, JANSEN_VALORES_REFERENCIA[idx], `Valor nominal debe coincidir con referencia de Jansen`);
});
console.log("    ✓ Los 12 genes canónicos (a..k) poseen nombres reales, etiquetas y valores nominales | OK");

// 2. Verificación de la plantilla en builder.js
console.log("[2] Verificando plantilla pata_jansen y resolución de aliases...");
const plantSub = obtenerPlantillaSimulacion("pata_jansen");
const plantGuion = obtenerPlantillaSimulacion("pata-jansen");
assert.ok(plantSub, "obtenerPlantillaSimulacion('pata_jansen') debe retornar la plantilla");
assert.ok(plantGuion, "obtenerPlantillaSimulacion('pata-jansen') debe retornar la plantilla");
assert.strictEqual(plantSub.variables.length, 12, "Debe tener 12 variables");
assert.strictEqual(plantSub.tipoVisualizacion, "mecanismo_jansen", "Visualizador debe ser mecanismo_jansen");
assert.ok(plantSub.codigoEvaluacion.includes("estructuras.evaluarJansen"), "Código debe llamar a estructuras.evaluarJansen");
console.log("    ✓ Plantilla y resolución de aliases verificadas con cinemática real | OK");

// 3. Verificación de _obtenerDefinicionEditable en AppView
console.log("[3] Verificando conversión de ModeloPataJansen a definición editable en Estudio...");
const { def } = AppView.prototype._obtenerDefinicionEditable.call({}, ModeloPataJansen);
assert.ok(def, "Debe retornar una definición editable");
assert.strictEqual(def.tipoVisualizacion, "mecanismo_jansen");
assert.strictEqual(def.variables.length, 12);
def.variables.forEach((v, i) => {
  assert.notStrictEqual(v.nombre, `var${i + 1}`, `La variable ${i} no debe llamarse var${i + 1}`);
  assert.strictEqual(v.nombre, clavesEsperadas[i]);
});
assert.ok(def.codigoEvaluacion.includes("estructuras.evaluarJansen"), "El código debe evaluar cinemática real de Jansen");
console.log("    ✓ Definición editable generada sin variables genéricas y con código cinemático real | OK");

// 4. Verificación de compilación dinámica y evaluación matemática
console.log("[4] Verificando compilación y evaluación del modelo dinámico compilado...");
validarDefinicionModelo(def);
const modeloCompilado = compilarModeloDinamico(def);
assert.ok(modeloCompilado, "El modelo debe compilar exitosamente");

// Evalúa con los valores nominales canónicos
const fitnessCalculado = modeloCompilado.evaluar(JANSEN_VALORES_REFERENCIA);
assert.ok(Array.isArray(fitnessCalculado), "Debe retornar arreglo de Pareto");
assert.strictEqual(fitnessCalculado.length, 2, "Debe ser de longitud 2");
assert.ok(Math.abs(fitnessCalculado[0] - 0.5212) < 0.005, `f1 debe ser cercano a 0.5212, obtenido: ${fitnessCalculado[0]}`);
assert.ok(Math.abs(fitnessCalculado[1] - 0.2067) < 0.005, `f2 debe ser cercano a 0.2067, obtenido: ${fitnessCalculado[1]}`);
console.log(`    ✓ Compilación dinámica evaluada con éxito: Fitness Pareto = [${fitnessCalculado[0].toFixed(4)}, ${fitnessCalculado[1].toFixed(4)}] | OK`);

// 5. Verificación de delegación de visualizador en VisualizadorDinamico
console.log("[5] Verificando delegación del VisualizadorDinamico hacia VisualizadorJansen...");
const visDinamico = new VisualizadorDinamico();
const fakeContainer = {
  innerHTML: "",
  querySelector: () => ({
    getContext: () => ({
      resetTransform: () => {},
      scale: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      setLineDash: () => {},
      fillText: () => {},
      measureText: () => ({ width: 30 }),
      roundRect: () => {},
      closePath: () => {}
    }),
    clientWidth: 800,
    clientHeight: 400,
    width: 800,
    height: 400,
    isConnected: true,
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 })
  })
};

visDinamico.render(fakeContainer, JANSEN_VALORES_REFERENCIA, {}, { modelo: modeloCompilado });
assert.ok(visDinamico.subVisualizadorActivo instanceof VisualizadorJansen, "Debe delegar a VisualizadorJansen");
visDinamico.detener();
assert.strictEqual(visDinamico.subVisualizadorActivo, null, "detener() debe limpiar el subvisualizador");
console.log("    ✓ Delegación y ciclo de vida de VisualizadorJansen en VisualizadorDinamico verificados | OK");

// 6. Verificación de clonación de modelo existente
console.log("[6] Verificando clonación de Jansen con clonarModeloExistente...");
const clonJansen = clonarModeloExistente(ModeloPataJansen, "Pata Jansen Optimizada");
assert.strictEqual(clonJansen.variables.length, 12);
assert.strictEqual(clonJansen.variables[0].nombre, "a");
assert.strictEqual(clonJansen.tipoVisualizacion, "mecanismo_jansen");
assert.ok(clonJansen.codigoEvaluacion.includes("estructuras.evaluarJansen"));
console.log("    ✓ Clonación de modelo existente preserva semántica canónica y cinemática | OK");

console.log("\n=== ¡TODAS LAS PRUEBAS DE MODELADO DE JANSEN PASARON CON ÉXITO TOTAL (6/6)! ===");
