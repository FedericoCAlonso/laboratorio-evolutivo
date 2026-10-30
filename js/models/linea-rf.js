// =========================================================================
// MÓDULO: MODELO DE LÍNEA DE TRANSMISIÓN RF Y CARTA DE SMITH (ALTA FRECUENCIA)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

import { MotorFuncionalTopologico } from "../engines/topologia.js";

// Simula la respuesta en frecuencia y la trayectoria sobre la Carta de Smith de una red de adaptación RF
export function simularLineaTransmisionRF(genoma, entrada) {
  // Frecuencia central de operación (ej: 1.0 GHz para telecomunicaciones / ISM)
  const fCentralHz = Number(entrada?.frecuenciaCentralHz !== undefined ? entrada.frecuenciaCentralHz : 1e9);
  const z0Sistema = Number(entrada?.z0Sistema !== undefined ? entrada.z0Sistema : 50.0);
  const rCarga = Number(entrada?.rCarga !== undefined ? entrada.rCarga : 85.0);
  const xCarga = Number(entrada?.xCarga !== undefined ? entrada.xCarga : 40.0);

  // 4 genes continuos del genoma:
  // [longitudMetros, z0Seccion, stubMetros, z0Stub]
  const [lMetros, z0Sec, lStub, z0St] = genoma;

  const longitudTransformador = Math.max(0.005, Math.min(0.15, lMetros));
  const z0Transformador = Math.max(25.0, Math.min(120.0, z0Sec));
  const longitudStub = Math.max(0.002, Math.min(0.08, lStub || 0.02));
  const z0Stub = Math.max(30.0, Math.min(100.0, z0St || 50.0));

  // Barrido de frecuencia de +-25% alrededor de la frecuencia central (50 puntos)
  const fMin = fCentralHz * 0.75;
  const fMax = fCentralHz * 1.25;
  const numPuntos = 40;

  const barrido = MotorFuncionalTopologico.simularBarridoSmith(fMin, fMax, numPuntos, {
    longitudMetros: longitudTransformador,
    z0: z0Transformador,
    zCargaR: rCarga,
    zCargaX: xCarga,
    velPropagacion: 2e8 // 200,000 km/s en dieléctrico típico de teflón/FR4 (c * 0.66)
  });

  // Cálculo en la frecuencia central exacta
  const resCentral = MotorFuncionalTopologico.calcularImpedanciaLinea(
    fCentralHz,
    longitudTransformador,
    z0Transformador,
    rCarga,
    xCarga,
    2e8
  );

  // Efecto de compensación reactiva del stub paralelo: Y_total = Y_linea + Y_stub
  const bStub = -1.0 / (z0Stub * Math.tan((2.0 * Math.PI * fCentralHz * longitudStub) / 2e8 || 0.1));
  const gIn = resCentral.zinR / (resCentral.zinR * resCentral.zinR + resCentral.zinX * resCentral.zinX || 1.0);
  const bInTotal = (resCentral.zinX / (resCentral.zinR * resCentral.zinR + resCentral.zinX * resCentral.zinX || 1.0)) + bStub * 0.35;

  const denY = gIn * gIn + bInTotal * bInTotal || 1e-4;
  const zCompR = gIn / denY;
  const zCompX = -bInTotal / denY;

  // Reflexión final compensada
  const numR = zCompR - z0Sistema;
  const numX = zCompX;
  const denR = zCompR + z0Sistema;
  const denX = zCompX;
  const dMag2 = denR * denR + denX * denX;
  const gammaU = (numR * denR + numX * denX) / dMag2;
  const gammaV = (numX * denR - numR * denX) / dMag2;
  const magGamma = Math.hypot(gammaU, gammaV);
  const roeFinal = (1.0 + Math.min(0.999, magGamma)) / Math.max(0.001, 1.0 - Math.min(0.999, magGamma));
  const perdidasRetornoDb = -20.0 * Math.log10(Math.max(1e-4, magGamma));

  return {
    fCentralHz,
    z0Sistema,
    rCarga,
    xCarga,
    longitudTransformador,
    z0Transformador,
    longitudStub,
    z0Stub,
    zinR: zCompR,
    zinX: zCompX,
    gammaU,
    gammaV,
    magGamma,
    roe: roeFinal,
    perdidasRetornoDb,
    peorROE: Math.max(roeFinal, barrido.peorROE),
    puntosSmith: barrido.puntos,
    longitudTotalMm: (longitudTransformador + longitudStub) * 1000.0,
    adaptacionOptima: roeFinal <= 1.35
  };
}

// Objeto de definición del modelo para el motor evolutivo
export const ModeloLineaTransmisionRF = {
  id: "linea-transmision-rf",
  nombre: "Línea de Transmisión RF (Carta de Smith)",
  descripcion: "Optimiza los parámetros de una red de adaptación en línea de transmisión (longitud e impedancia de secciones y stubs) para minimizar la ROE y reflejar cero potencia en alta frecuencia.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Desadaptación ROE (SWR)", "Longitud Física Total (mm)"],

  // Parámetros de diseño del sistema de radiofrecuencia
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (ROE mínima vs. Largo mínimo)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (ROE estricta ponderada)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "frecuenciaCentralHz", etiqueta: "Frecuencia Central (Hz)", tipo: "numero", min: 100e6, max: 5e9, paso: 50e6, valorDefecto: 1e9 },
    { clave: "z0Sistema", etiqueta: "Impedancia del Sistema Z0 (Ω)", tipo: "numero", min: 25, max: 75, paso: 5, valorDefecto: 50 },
    { clave: "rCarga", etiqueta: "Resistencia de Carga RL (Ω)", tipo: "numero", min: 10, max: 200, paso: 5, valorDefecto: 85 },
    { clave: "xCarga", etiqueta: "Reactancia de Carga XL (Ω)", tipo: "numero", min: -100, max: 100, paso: 5, valorDefecto: 40 }
  ],

  // 4 genes: [longitudLínea (m), Z0_sección (Ω), longitudStub (m), Z0_stub (Ω)]
  crearGenoma() {
    return [
      { tipo: "continuo", min: 0.01, max: 0.12 }, // Longitud sección línea
      { tipo: "continuo", min: 30.0, max: 110.0 },// Z0 sección línea
      { tipo: "continuo", min: 0.005, max: 0.06 },// Longitud stub paralelo
      { tipo: "continuo", min: 35.0, max: 90.0 }  // Z0 stub
    ];
  },

  // Evalúa la cercanía al centro de la Carta de Smith (ROE = 1.0) y la compacidad física
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularLineaTransmisionRF(genoma, entrada);

    // Objetivo 1: Minimizar desvío respecto a la ROE unitaria ideal (ROE - 1.0)
    const objROE = (sim.roe - 1.0) * 12.0 + (sim.roe > 2.0 ? (sim.roe - 2.0) * 20.0 : 0.0);

    // Objetivo 2: Minimizar tamaño físico total (longitud de pistas en mm)
    const objLongitud = sim.longitudTotalMm;

    if (esMulti) {
      return [Math.max(0.001, objROE), Math.max(5.0, objLongitud)];
    }

    return objROE * 0.75 + objLongitud * 0.25;
  },

  // Resumen legible del estado de adaptación en la Carta de Smith
  describir(genoma, entrada) {
    const sim = simularLineaTransmisionRF(genoma, entrada);
    const estado = sim.adaptacionOptima ? "✓ ADAPTACIÓN ÓPTIMA" : "✕ DESADAPTADA";
    return `📶 RF ${(sim.fCentralHz / 1e6).toFixed(0)} MHz: ROE = ${sim.roe.toFixed(2)}:1 | ${estado} | Zin = ${sim.zinR.toFixed(1)} ${sim.zinX >= 0 ? "+" : ""}${sim.zinX.toFixed(1)}j Ω | Longitud: ${sim.longitudTotalMm.toFixed(1)} mm`;
  }
};

export default ModeloLineaTransmisionRF;
