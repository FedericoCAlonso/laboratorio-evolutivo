// =========================================================================
// MODELO: ANTENA EVOLUTIVA NASA ST5 (SPACE TECHNOLOGY 5)
// Optimización de forma de hilo 3D con simetría rotacional de 4 cuadrantes (C4)
// y parametrización polar relativa para comunicaciones satelitales en Banda X.
// =========================================================================

export function calcularGeometriaAntenaNasa(vars = {}) {
  const L1 = vars.L1 !== undefined ? Number(vars.L1) : 14.2;
  const dTheta1 = vars.dTheta1 !== undefined ? Number(vars.dTheta1) : 38.0;
  const L2 = vars.L2 !== undefined ? Number(vars.L2) : 17.5;
  const dTheta2 = vars.dTheta2 !== undefined ? Number(vars.dTheta2) : -48.0;
  const L3 = vars.L3 !== undefined ? Number(vars.L3) : 15.0;
  const dTheta3 = vars.dTheta3 !== undefined ? Number(vars.dTheta3) : 42.0;
  const elevacion = vars.elevacion !== undefined ? Number(vars.elevacion) : 20.0;
  const frecuencia = vars.frecuencia !== undefined ? Number(vars.frecuencia) : 8.4;

  const toRad = Math.PI / 180;
  const angElev1 = elevacion * 0.5 * toRad;
  const angElev2 = elevacion * toRad;
  const angElev3 = elevacion * 0.7 * toRad;

  // Ángulos polares acumulativos relativos para el brazo maestro (Cuadrante 1)
  const theta1 = (45.0 + dTheta1 * 0.4) * toRad;
  const theta2 = theta1 + dTheta1 * toRad;
  const theta3 = theta2 + dTheta2 * toRad;

  // Nodos del brazo 0
  const p0 = { x: 0.0, y: 0.0, z: 0.0 };
  const p1 = {
    x: p0.x + L1 * Math.cos(theta1) * Math.cos(angElev1),
    y: p0.y + L1 * Math.sin(theta1) * Math.cos(angElev1),
    z: p0.z + L1 * Math.sin(angElev1)
  };
  const p2 = {
    x: p1.x + L2 * Math.cos(theta2) * Math.cos(angElev2),
    y: p1.y + L2 * Math.sin(theta2) * Math.cos(angElev2),
    z: p1.z + L2 * Math.sin(angElev2)
  };
  const p3 = {
    x: p2.x + L3 * Math.cos(theta3) * Math.cos(angElev3),
    y: p2.y + L3 * Math.sin(theta3) * Math.cos(angElev3),
    z: p2.z + L3 * Math.sin(angElev3)
  };

  const brazoBase = [p0, p1, p2, p3];

  // 4 brazos con simetría rotacional de 90° (C4)
  const brazos = [];
  for (let b = 0; b < 4; b++) {
    const angRot = b * (Math.PI / 2);
    const cosR = Math.cos(angRot);
    const sinR = Math.sin(angRot);

    const brazoRotado = brazoBase.map(pt => ({
      x: pt.x * cosR - pt.y * sinR,
      y: pt.x * sinR + pt.y * cosR,
      z: pt.z
    }));
    brazos.push(brazoRotado);
  }

  const longitudArm = L1 + L2 + L3;
  const longitudTotal = longitudArm * 4;
  const lambda = 300.0 / Math.max(1.0, frecuencia); // mm

  return {
    brazos,
    longitudArm,
    longitudTotal,
    lambda,
    frecuencia,
    L1, dTheta1, L2, dTheta2, L3, dTheta3, elevacion
  };
}

// Simula la respuesta electromagnética completa de la antena ST5: diagrama de radiación polar y ROE
export function simularAntenaNasa(genoma, entrada = {}) {
  const vars = Array.isArray(genoma)
    ? {
        L1: genoma[0],
        dTheta1: genoma[1],
        L2: genoma[2],
        dTheta2: genoma[3],
        L3: genoma[4],
        dTheta3: genoma[5],
        elevacion: genoma[6],
        frecuencia: genoma[7]
      }
    : (genoma || {});

  const geom = calcularGeometriaAntenaNasa(vars);
  const { longitudArm, lambda, brazos, frecuencia } = geom;

  // 1. Cálculo de Impedancia de Entrada y ROE / VSWR a la frecuencia de diseño
  const factorResonancia = longitudArm / (lambda * 0.25); // Resonancia típica en cuarto de onda
  const desvioRes = Math.abs(factorResonancia - 1.0);
  const curvaturaTotal = Math.abs(vars.dTheta1 || 0) + Math.abs(vars.dTheta2 || 0) + Math.abs(vars.dTheta3 || 0);

  // Resistencia de radiación y reactancia mutua
  const R_in = 50.0 + 38.0 * (factorResonancia - 1.0) - 0.08 * curvaturaTotal;
  const X_in = 65.0 * (factorResonancia - 1.0) + 18.0 * Math.sin(((vars.dTheta2 || 0) * Math.PI) / 180);

  const numGamma = (R_in - 50.0) * (R_in - 50.0) + X_in * X_in;
  const denGamma = (R_in + 50.0) * (R_in + 50.0) + X_in * X_in;
  const coefReflexion = Math.sqrt(numGamma / Math.max(1e-4, denGamma));
  const vswr = (1.0 + coefReflexion) / Math.max(1e-3, 1.0 - Math.min(0.96, coefReflexion));

  // 2. Muestreo del diagrama de radiación polar hemisférico (elevación 0° a 90°, azimut 0° a 360°)
  const numPuntosElev = 16;
  const gananciaMuestras = [];
  let gananciaPico = -10.0;
  let gananciaCono = []; // Región crítica 40° <= theta <= 80°

  for (let i = 0; i < numPuntosElev; i++) {
    const thetaGrados = (i / (numPuntosElev - 1)) * 90.0; // 0° = cenit, 90° = horizonte
    const thetaRad = thetaGrados * (Math.PI / 180);

    // Factor de haz sintético de antena de hilo C4 en cuadratura
    const factorElev = Math.sin(thetaRad) * (1.0 + 0.35 * Math.sin(thetaRad * 2.5));
    const factorSimetria = 1.0 - 0.15 * Math.abs(Math.cos(thetaRad * 4.0));
    const efecCurva = 1.0 - 0.0018 * Math.min(180, curvaturaTotal);

    // Ganancia en dBi
    const gDBi = -1.2 + 5.2 * factorElev * factorSimetria * efecCurva - 1.8 * desvioRes;
    gananciaMuestras.push({ theta: thetaGrados, ganancia: gDBi });

    if (gDBi > gananciaPico) gananciaPico = gDBi;
    if (thetaGrados >= 35.0 && thetaGrados <= 82.0) {
      gananciaCono.push(gDBi);
    }
  }

  // Ondulación de ganancia (desviación estándar en el cono hemisférico útil)
  const mediaCono = gananciaCono.reduce((acc, v) => acc + v, 0) / Math.max(1, gananciaCono.length);
  const varianzaCono = gananciaCono.reduce((acc, v) => acc + Math.pow(v - mediaCono, 2), 0) / Math.max(1, gananciaCono.length);
  const ondulacion = Math.sqrt(varianzaCono);

  // Relación axial de polarización circular (AR ~ 1.0 para polarización circular pura RHCP)
  const axialRatio = 1.1 + 0.9 * desvioRes + 0.003 * Math.abs(vars.dTheta1 || 0);

  // Objetivos de optimización multiobjetivo (NSGA-II):
  // Obj 1: Minimizar ondulación hemisférica y maximizar ganancia media en el cono
  const objPatron = ondulacion * 2.4 + Math.max(0.0, 1.8 - mediaCono) * 1.6 + Math.max(0.0, axialRatio - 2.0);
  // Obj 2: Minimizar desadaptación ROE/VSWR (ideal VSWR = 1.0)
  const objVswr = Math.max(0.01, vswr - 1.0);

  return {
    geom,
    R_in,
    X_in,
    coefReflexion,
    vswr,
    gananciaPico,
    mediaCono,
    ondulacion,
    axialRatio,
    gananciaMuestras,
    fitness: [parseFloat(Math.max(0.01, objPatron).toFixed(4)), parseFloat(Math.max(0.01, objVswr).toFixed(4))]
  };
}

export const ModeloAntenaNasa = {
  id: "antena-nasa",
  nombre: "Antena Evolutiva NASA ST5",
  descripcion: "Diseño y síntesis de la célebre antena de hilo evolucionada por algoritmos genéticos para la misión satelital Space Technology 5 (ST5) de la NASA. Optimiza longitudes y ángulos polares relativos con simetría rotacional de 4 cuadrantes (C4) para maximizar cobertura hemisférica y minimizar ROE/VSWR en Banda X (8.4 GHz).",
  tipoVisualizacion: "antena_3d_polar",
  esMultiobjetivo: true,

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

  crearGenoma() {
    return this.variables.map(v => ({ ...v }));
  },

  evaluar(genoma, entrada = {}) {
    const res = simularAntenaNasa(genoma, entrada);
    return res.fitness;
  },

  describir(genoma) {
    const sim = simularAntenaNasa(genoma);
    return `[Antena Evolutiva NASA ST5 - Banda X]
Frecuencia Central: ${sim.geom.frecuencia.toFixed(2)} GHz (λ = ${sim.geom.lambda.toFixed(1)} mm)
Longitud de cada brazo: ${sim.geom.longitudArm.toFixed(1)} mm (Total 4 brazos: ${sim.geom.longitudTotal.toFixed(1)} mm)
Impedancia de entrada: ${sim.R_in.toFixed(1)} + j${sim.X_in >= 0 ? "+" : ""}${sim.X_in.toFixed(1)} Ω
ROE / VSWR: ${sim.vswr.toFixed(2)} : 1
Ganancia Pico: ${sim.gananciaPico.toFixed(2)} dBi (Media en cono útil: ${sim.mediaCono.toFixed(2)} dBi)
Ondulación Hemisférica: ±${sim.ondulacion.toFixed(2)} dB | Relación Axial: ${sim.axialRatio.toFixed(2)}
Fitness [f1: Ondulación/Ganancia, f2: Desadaptación ROE]: [${sim.fitness[0]}, ${sim.fitness[1]}]`;
  }
};

export default ModeloAntenaNasa;
