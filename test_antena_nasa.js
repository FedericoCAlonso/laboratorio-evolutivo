// =========================================================================
// TEST: MODELO DE ANTENA EVOLUTIVA NASA ST5 Y VISUALIZADOR 3D / POLAR
// =========================================================================

import { ModeloAntenaNasa, calcularGeometriaAntenaNasa, simularAntenaNasa } from "./js/models/antena.js";
import plantillaAntenaNASA from "./js/plantillas/antena-nasa.js";
import { crearGrafoAntenaNASA } from "./js/engines/mecanismos.js";
import { VisualizadorAntena } from "./js/views/visualizers.js";

console.log("=== INICIANDO PRUEBAS DEL MODELO ANTENA EVOLUTIVA NASA ST5 ===");

// 1. Verificación de cálculo geométrico y simetría C4
console.log("\n[1] Verificando cálculo geométrico y simetría cuádruple C4...");
const genomaPrueba = [32.0, 45.0, 28.0, -30.0, 24.0, 60.0, 35.0, 8.4];
const geom = calcularGeometriaAntenaNasa(genomaPrueba);

if (geom.brazos.length !== 4) {
  throw new Error(`Se esperaban 4 brazos con simetría C4, pero se obtuvieron ${geom.brazos.length}`);
}

// Verificar que cada brazo tiene 4 nodos (base + 3 segmentos)
geom.brazos.forEach((brazo, idx) => {
  if (brazo.length !== 4) {
    throw new Error(`El brazo ${idx} debe contener 4 puntos, tiene ${brazo.length}`);
  }
});

// Comprobar la rotación de 90° entre brazos
const b0_p3 = geom.brazos[0][3];
const b1_p3 = geom.brazos[1][3];
// Rotación 90°: (x, y) -> (-y, x)
const rotX = -b0_p3.y;
const rotY = b0_p3.x;
if (Math.abs(b1_p3.x - rotX) > 1e-4 || Math.abs(b1_p3.y - rotY) > 1e-4) {
  throw new Error(`Falla en simetría C4: esperado (${rotX.toFixed(2)}, ${rotY.toFixed(2)}), obtenido (${b1_p3.x.toFixed(2)}, ${b1_p3.y.toFixed(2)})`);
}
console.log(`    ✓ 4 brazos generados con simetría C4 exacta (rotación 90° en plano z) | OK`);
console.log(`    ✓ Longitud total de hilo: ${geom.longitudTotal.toFixed(1)} mm | OK`);

// 2. Verificación de simulación electromagnética (Ganancia y ROE/VSWR)
console.log("\n[2] Verificando simulación electromagnética en Banda X (8.4 GHz)...");
const sim = simularAntenaNasa(genomaPrueba);

if (sim.vswr < 1.0) {
  throw new Error(`ROE (VSWR) físicamente imposible: ${sim.vswr} < 1.0`);
}
if (sim.gananciaMuestras.length < 16) {
  throw new Error(`El lóbulo de elevación debe tener al menos 16 puntos, tiene ${sim.gananciaMuestras.length}`);
}
console.log(`    ✓ ROE calculada: ${sim.vswr.toFixed(3)}:1 | Impedancia Zin: ${sim.R_in.toFixed(1)} + j${sim.X_in.toFixed(1)} Ω | OK`);
console.log(`    ✓ Ganancia pico: ${sim.gananciaPico.toFixed(2)} dBi | Ganancia media en cono (40°-80°): ${sim.mediaCono.toFixed(2)} dBi | OK`);
console.log(`    ✓ Ondulación en zona cónica: ${sim.ondulacion.toFixed(2)} dB | Axial Ratio: ${sim.axialRatio.toFixed(2)} | OK`);

// 3. Verificación de pureza del Modelo (evaluar y describir)
console.log("\n[3] Verificando contrato de dominio en ModeloAntenaNasa...");
const fit = ModeloAntenaNasa.evaluar(genomaPrueba, {});
if (!Array.isArray(fit) || fit.length !== 2) {
  throw new Error(`El fitness de antena debe ser un vector biobjetivo [fitRizado, fitROE], recibido: ${JSON.stringify(fit)}`);
}
const desc = ModeloAntenaNasa.describir(genomaPrueba, {});
if (!desc.includes("NASA ST5") || !desc.includes("ROE")) {
  throw new Error(`La descripción del modelo no contiene la información esperada: ${desc}`);
}
console.log(`    ✓ Fitness bi-objetivo: [Rizado/Ganancia: ${fit[0].toFixed(3)}, ROE: ${fit[1].toFixed(3)}] | OK`);
console.log(`    ✓ Descripción: "${desc}" | OK`);

// 4. Verificación de plantilla exportada
console.log("\n[4] Verificando plantilla de simulación para el Estudio...");
if (!plantillaAntenaNASA.nombre.includes("NASA ST5") || plantillaAntenaNASA.variables.length !== 8) {
  throw new Error("Plantilla antena-nasa no cumple el esquema requerido");
}
console.log(`    ✓ Plantilla cargada con 8 variables y ${plantillaAntenaNASA.codigoEvaluacion.length} bytes de código de evaluación | OK`);

// 5. Verificación de Grafo CAD de antena
console.log("\n[5] Verificando Grafo CAD (GrafoMecanismoMultifisica) de la antena...");
const grafo = crearGrafoAntenaNASA({ L1: 35, dTheta1: 40, L2: 30, dTheta2: -25, L3: 25, dTheta3: 50, elevacion: 30, frecuencia: 8.4 });
if (grafo.nodos.length < 13 || grafo.barras.length < 12) {
  throw new Error(`El grafo CAD de antena no contiene los nodos o barras esperados (${grafo.nodos.length} nodos, ${grafo.barras.length} barras)`);
}
console.log(`    ✓ Grafo CAD generado con ${grafo.nodos.length} nodos y ${grafo.barras.length} barras (hilos conductores) | OK`);

// 6. Verificación de VisualizadorAntena
console.log("\n[6] Verificando VisualizadorAntena...");
const vis = new VisualizadorAntena();
if (typeof vis.render !== "function" || typeof vis.detener !== "function") {
  throw new Error("VisualizadorAntena no implementa render() o detener()");
}
vis.detener();
console.log(`    ✓ Visualizador instanciado y ciclo de vida detenido correctamente | OK`);

console.log("\n=== ¡TODAS LAS PRUEBAS DE LA ANTENA NASA ST5 PASARON CON ÉXITO! ===");
