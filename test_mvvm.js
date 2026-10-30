// =========================================================================
// TEST DE INTEGRACIÓN: VERIFICACIÓN ARQUITECTURA MVVM
// =========================================================================

import { MODELOS, obtenerModeloPorId } from "./js/models/index.js";
import { compilarModeloDinamico, clonarModeloExistente } from "./js/builder.js";
import {
  VisualizadorJansen,
  VisualizadorBrazo,
  VisualizadorCohete,
  VisualizadorPID,
  VisualizadorCaminante,
  VisualizadorFases,
  VisualizadorPotencial,
  VisualizadorOrbita,
  VisualizadorFiltro,
  VisualizadorArmadura,
  VisualizadorTermico,
  VisualizadorAcustica,
  VisualizadorElectromagnetismo,
  VisualizadorFonoabsorbente,
  VisualizadorLineaRF,
  VisualizadorNesting,
  VisualizadorDinamico,
  obtenerVisualizador
} from "./js/views/visualizers.js";
import { GraficoView } from "./js/views/grafico-view.js";

console.log("=== INICIANDO PRUEBAS DE ARQUITECTURA MVVM ===");

// 1. Verificación de pureza de los modelos (Headless, sin DOM ni Canvas)
console.log("\n[1] Verificando modelos matemáticos en modo Headless...");
MODELOS.forEach(m => {
  console.log(` -> Probando modelo: ${m.nombre} (${m.id})`);
  if (!m.id || !m.nombre || !m.crearGenoma || !m.evaluar || !m.describir) {
    throw new Error(`El modelo ${m.id} no cumple el contrato de dominio puro.`);
  }

  // Prueba de creación de genoma
  const genomaDef = m.crearGenoma();
  const genomaValores = genomaDef.map(g => (g.min + g.max) / 2);

  // Prueba de evaluación matemática
  const fit = m.evaluar(genomaValores, {});
  if (fit === undefined || fit === null) {
    throw new Error(`evaluar() retornó indefinido para el modelo ${m.id}`);
  }

  // Prueba de descripción textual
  const desc = m.describir(genomaValores, {});
  if (typeof desc !== "string" || desc.length === 0) {
    throw new Error(`describir() no generó texto para el modelo ${m.id}`);
  }

  console.log(`    ✓ Genoma (${genomaValores.length} genes) | Fitness: ${JSON.stringify(fit)} | OK`);
});

// 2. Verificación de compilación dinámica y clonación
console.log("\n[2] Verificando compilador dinámico y clonación de modelos...");
const defPrueba = {
  nombre: "Optimización Esfera",
  descripcion: "Minimizar x^2 + y^2",
  variables: [
    { nombre: "x", tipo: "continuo", min: -10, max: 10 },
    { nombre: "y", tipo: "continuo", min: -10, max: 10 }
  ],
  codigoEvaluacion: "return vars.x * vars.x + vars.y * vars.y;"
};

const modeloCompilado = compilarModeloDinamico(defPrueba);
const genomaPrueba = [3, 4];
const fitCompilado = modeloCompilado.evaluar(genomaPrueba);
if (fitCompilado !== 25) {
  throw new Error(`Error en evaluación dinámica: esperado 25, obtenido ${fitCompilado}`);
}
console.log(`    ✓ Modelo dinámico compilado y evaluado: fitness = ${fitCompilado} (esperado 25) | OK`);

const defClonada = clonarModeloExistente(modeloCompilado);
const clonCompilado = compilarModeloDinamico(defClonada);
if (!clonCompilado.id || !clonCompilado.nombre.includes("Copia")) {
  throw new Error("Error en clonación de modelo dinámico.");
}
console.log(`    ✓ Modelo clonado exitosamente: '${clonCompilado.nombre}' | OK`);

// 3. Verificación de capa de Vista y Visualizadores
console.log("\n[3] Verificando clases de la capa Vista y visualizadores...");
const visualizadores = [
  new VisualizadorJansen(),
  new VisualizadorBrazo(),
  new VisualizadorCohete(),
  new VisualizadorPID(),
  new VisualizadorCaminante(),
  new VisualizadorFases(),
  new VisualizadorPotencial(),
  new VisualizadorOrbita(),
  new VisualizadorFiltro(),
  new VisualizadorArmadura(),
  new VisualizadorTermico(),
  new VisualizadorAcustica(),
  new VisualizadorElectromagnetismo(),
  new VisualizadorFonoabsorbente(),
  new VisualizadorLineaRF(),
  new VisualizadorNesting(),
  new VisualizadorDinamico()
];

visualizadores.forEach(v => {
  if (typeof v.render !== "function" || typeof v.detener !== "function") {
    throw new Error(`El visualizador ${v.constructor.name} no implementa render() o detener()`);
  }
  v.detener(); // Debe ejecutarse limpiamente sin arrojar errores
});
console.log(`    ✓ Todos los ${visualizadores.length} visualizadores implementan render() y detener() | OK`);

MODELOS.forEach(m => {
  const vis = obtenerVisualizador(m.id);
  if (!vis) throw new Error(`No se encontró visualizador para ${m.id}`);
});
console.log("    ✓ Factory obtenerVisualizador mapea correctamente todos los modelos | OK");

// 4. Verificación de GraficoView
const fakeTooltip = {
  innerHTML: "",
  style: {},
  classList: {
    add: function() { this.visible = true; },
    remove: function() { this.visible = false; }
  }
};
const fakeCanvas = {
  getContext: () => ({
    resetTransform: () => {},
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    arc: () => {},
    fill: () => {}
  }),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 220 }),
  clientWidth: 800,
  clientHeight: 220,
  style: {}
};
const fakeLeyenda = { innerHTML: "" };
const graficoView = new GraficoView(fakeCanvas, fakeLeyenda, fakeTooltip);
graficoView.actualizarLeyenda(true);
if (!fakeLeyenda.innerHTML.includes("Pareto")) {
  throw new Error("GraficoView.actualizarLeyenda multiobjetivo falló.");
}
graficoView.actualizarLeyenda(false);
if (!fakeLeyenda.innerHTML.includes("Mejor Individuo")) {
  throw new Error("GraficoView.actualizarLeyenda monobjetivo falló.");
}
graficoView.render({ historiaMejor: [10, 5, 2], historiaPromedio: [15, 8, 4], totalGeneraciones: 2 });
graficoView.actualizarHover(400, 100);
if (!fakeTooltip.innerHTML.includes("Generación") || !fakeTooltip.classList.visible) {
  throw new Error("GraficoView.actualizarHover no activó el tooltip M3 en modo convergencia.");
}
graficoView.ocultarHover();
if (fakeTooltip.classList.visible) {
  throw new Error("GraficoView.ocultarHover no ocultó el tooltip M3.");
}
console.log("    ✓ GraficoView render, crosshair interactivo, tooltip M3 y leyendas | OK");

console.log("\n=== TODAS LAS PRUEBAS DE ARQUITECTURA MVVM PASARON EXITOSAMENTE (6/6) ===");
