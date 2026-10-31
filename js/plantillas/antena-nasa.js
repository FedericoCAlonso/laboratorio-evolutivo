// =========================================================================
// PLANTILLA FIEL: ANTENA EVOLUTIVA NASA ST5 (BANDA X)
// =========================================================================

import { crearGrafoAntenaNASA } from "../engines/mecanismos.js";

export default {
  nombre: "Antena Evolutiva NASA ST5",
  descripcion: "Diseño y síntesis de la célebre antena de hilo evolucionada para la misión Space Technology 5 (ST5) de la NASA. Optimiza longitudes y ángulos polares relativos con simetría rotacional de 4 cuadrantes (C4) para maximizar cobertura hemisférica y minimizar ROE/VSWR en Banda X (8.4 GHz).",
  tipoVisualizacion: "antena_3d_polar",
  grafo: crearGrafoAntenaNASA().exportarJSON(),
  variables: [
    { nombre: "L1", etiqueta: "L1: Tramo Base (mm)", tipo: "continuo", min: 6.0, max: 24.0, valorNominal: 14.2 },
    { nombre: "dTheta1", etiqueta: "Δθ1: Codo 1 Azimut (°) [Polar]", tipo: "continuo", min: -90.0, max: 90.0, valorNominal: 38.0 },
    { nombre: "L2", etiqueta: "L2: Tramo Medio (mm)", tipo: "continuo", min: 8.0, max: 28.0, valorNominal: 17.5 },
    { nombre: "dTheta2", etiqueta: "Δθ2: Codo 2 Azimut (°) [Polar]", tipo: "continuo", min: -120.0, max: 120.0, valorNominal: -48.0 },
    { nombre: "L3", etiqueta: "L3: Tramo Extremo (mm)", tipo: "continuo", min: 6.0, max: 26.0, valorNominal: 15.0 },
    { nombre: "dTheta3", etiqueta: "Δθ3: Codo 3 Azimut (°) [Polar]", tipo: "continuo", min: -90.0, max: 90.0, valorNominal: 42.0 },
    { nombre: "elevacion", etiqueta: "Inclinación Elevación Z (°)", tipo: "continuo", min: 5.0, max: 40.0, valorNominal: 20.0 },
    { nombre: "frecuencia", etiqueta: "Frecuencia Central (GHz)", tipo: "continuo", min: 7.2, max: 8.8, valorNominal: 8.4 }
  ],
  codigoEvaluacion: `// Geometría y parámetros
const L1 = vars.L1 !== undefined ? Number(vars.L1) : 14.2;
const dTheta1 = vars.dTheta1 !== undefined ? Number(vars.dTheta1) : 38.0;
const L2 = vars.L2 !== undefined ? Number(vars.L2) : 17.5;
const dTheta2 = vars.dTheta2 !== undefined ? Number(vars.dTheta2) : -48.0;
const L3 = vars.L3 !== undefined ? Number(vars.L3) : 15.0;
const dTheta3 = vars.dTheta3 !== undefined ? Number(vars.dTheta3) : 42.0;
const elevacion = vars.elevacion !== undefined ? Number(vars.elevacion) : 20.0;
const frecuencia = vars.frecuencia !== undefined ? Number(vars.frecuencia) : 8.4;

const longitudArm = L1 + L2 + L3;
const lambda = 300.0 / Math.max(1.0, frecuencia);
const factorResonancia = longitudArm / (lambda * 0.25);
const desvioRes = Math.abs(factorResonancia - 1.0);
const curvaturaTotal = Math.abs(dTheta1) + Math.abs(dTheta2) + Math.abs(dTheta3);

const R_in = 50.0 + 38.0 * (factorResonancia - 1.0) - 0.08 * curvaturaTotal;
const X_in = 65.0 * (factorResonancia - 1.0) + 18.0 * Math.sin((dTheta2 * Math.PI) / 180);

const numGamma = (R_in - 50.0) * (R_in - 50.0) + X_in * X_in;
const denGamma = (R_in + 50.0) * (R_in + 50.0) + X_in * X_in;
const coefReflexion = Math.sqrt(numGamma / Math.max(1e-4, denGamma));
const vswr = (1.0 + coefReflexion) / Math.max(1e-3, 1.0 - Math.min(0.96, coefReflexion));

const numPuntosElev = 16;
let gananciaCono = [];
for (let i = 0; i < numPuntosElev; i++) {
  const thetaGrados = (i / (numPuntosElev - 1)) * 90.0;
  const thetaRad = thetaGrados * (Math.PI / 180);
  const factorElev = Math.sin(thetaRad) * (1.0 + 0.35 * Math.sin(thetaRad * 2.5));
  const factorSimetria = 1.0 - 0.15 * Math.abs(Math.cos(thetaRad * 4.0));
  const efecCurva = 1.0 - 0.0018 * Math.min(180, curvaturaTotal);
  const gDBi = -1.2 + 5.2 * factorElev * factorSimetria * efecCurva - 1.8 * desvioRes;
  if (thetaGrados >= 35.0 && thetaGrados <= 82.0) {
    gananciaCono.push(gDBi);
  }
}

const mediaCono = gananciaCono.reduce((acc, v) => acc + v, 0) / Math.max(1, gananciaCono.length);
const varianzaCono = gananciaCono.reduce((acc, v) => acc + Math.pow(v - mediaCono, 2), 0) / Math.max(1, gananciaCono.length);
const ondulacion = Math.sqrt(varianzaCono);
const axialRatio = 1.1 + 0.9 * desvioRes + 0.003 * Math.abs(dTheta1);

const objPatron = ondulacion * 2.4 + Math.max(0.0, 1.8 - mediaCono) * 1.6 + Math.max(0.0, axialRatio - 2.0);
const objVswr = Math.max(0.01, vswr - 1.0);
return [parseFloat(Math.max(0.01, objPatron).toFixed(4)), parseFloat(Math.max(0.01, objVswr).toFixed(4))];`
};
