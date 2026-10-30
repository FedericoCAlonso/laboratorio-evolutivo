// =========================================================================
// MÓDULO: MODELO DE SUPERFICIE FONOABSORBENTE (CUÑAS Y MULTIMATERIAL dBA)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Bandas de frecuencia de octava normalizadas (Hz) según norma ISO 266
export const BANDAS_OCTAVA_HZ = [125, 250, 500, 1000, 2000, 4000];

// Factores de corrección de ponderación A (dB) según IEC 61672-1
export const PONDERACION_A_DB = [-16.1, -8.6, -3.2, 0.0, 1.2, 1.0];

// Espectros de ruido acústico incidente de referencia (Nivel dB sin ponderar en cada banda)
export const ESPECTROS_RUIDO = {
  conversacion: [62.0, 70.0, 76.0, 78.0, 72.0, 62.0], // Ruido de oficinas / voz humana
  transito: [80.0, 77.0, 74.0, 70.0, 64.0, 56.0],     // Tránsito vehicular / motores
  ruido_rosa: [75.0, 75.0, 75.0, 75.0, 75.0, 75.0],   // Ruido de prueba con energía 1/f constante
  industrial: [74.0, 78.0, 84.0, 86.0, 81.0, 75.0]    // Maquinaria y ventilación industrial
};

// Calcula la impedancia característica Zc y número de onda kc en medio poroso según Delany-Bazley-Miki.
export function calcularImpedanciaPoro(frecuencia, resistividadFlujoSigma) {
  const rho0 = 1.205; // Densidad del aire a 20 °C (kg/m3)
  const c0 = 343.0;   // Velocidad del sonido (m/s)
  const z0 = rho0 * c0; // Impedancia acústica del aire libre (~413.3 Pa·s/m)
  const k0 = (2.0 * Math.PI * frecuencia) / c0;

  // Parámetro adimensional X = rho0 * f / sigma
  const sigma = Math.max(2.0, Math.min(150.0, resistividadFlujoSigma)) * 1000.0; // Conversión a Pa·s/m2
  const X = (rho0 * frecuencia) / sigma;

  // Ecuaciones empíricas de Delany-Bazley modificadas por Miki
  const parteRealZ = 1.0 + 0.07 * Math.pow(X, -0.632);
  const parteImagZ = -0.107 * Math.pow(X, -0.632);

  const parteRealK = 1.0 + 0.109 * Math.pow(X, -0.618);
  const parteImagK = -0.16 * Math.pow(X, -0.618);

  return {
    zcReal: z0 * parteRealZ,
    zcImag: z0 * parteImagZ,
    kcReal: k0 * parteRealK,
    kcImag: k0 * parteImagK,
    z0
  };
}

// Simula el comportamiento acústico y la atenuación espectral dBA del cuerpo fonoabsorbente.
export function simularAbsorbenteAcustico(genoma, entrada) {
  const tipoEstructura = (entrada?.tipoEstructura || "cuña_prismatica").toString().toLowerCase().trim();
  const tipoRuido = (entrada?.tipoRuido || "conversacion").toString().toLowerCase().trim();
  const atenuacionObjetivoDba = Number(entrada?.atenuacionObjetivoDba !== undefined ? entrada.atenuacionObjetivoDba : 18.0);
  const modo3D = (entrada?.modoExtrapolacion3D || "extrusion_lineal").toString().toLowerCase().trim();
  const limiteEspesorMaxMm = Number(entrada?.limiteEspesorMaxMm !== undefined ? entrada.limiteEspesorMaxMm : 180.0);

  const espectroBase = ESPECTROS_RUIDO[tipoRuido] || ESPECTROS_RUIDO.conversacion;

  let espesorTotalMm = 0;
  let volumenRelativo = 1.0;
  let datosCapas = [];
  let perfilGeometria = {};

  if (tipoEstructura === "superficie_lisa") {
    // Modo: Superficie exterior lisa pero heterogénea internamente (3 capas estratificadas)
    // [d1, d2, d3]: Espesores de capa en mm
    // [sigma1, sigma2, sigma3]: Resistividades al flujo (kPa·s/m2)
    const [d1, d2, d3, s1, s2, s3] = genoma;
    espesorTotalMm = Math.max(15, d1) + Math.max(15, d2) + Math.max(15, d3);
    volumenRelativo = 1.0; // Relleno al 100% (cuerpo sólido plano)

    datosCapas = [
      { nombre: "Capa Frontal (Adaptación)", espesorMm: Math.max(10, d1), sigma: Math.max(3, s1), color: "#38bdf8" },
      { nombre: "Capa Media (Disipación)", espesorMm: Math.max(10, d2), sigma: Math.max(10, s2), color: "#6366f1" },
      { nombre: "Capa Posterior (Frenado)", espesorMm: Math.max(10, d3), sigma: Math.max(25, s3), color: "#1e1b4b" }
    ];
  } else {
    // Modo: Cuñas geométricas perfiladas (extrusión 2.5D o pirámides 3D)
    // [hCuña, hBase, wPeriodo, exponentePerfil, sigmaMaterial, camaraAireMm]
    const [hCuna, hBase, wPeriodo, expPerfil, sigmaMat, camaraAire] = genoma;
    const hCuñaVal = Math.max(20, Math.min(180, hCuna));
    const hBaseVal = Math.max(10, Math.min(80, hBase));
    const camaraAireVal = Math.max(0, Math.min(60, camaraAire || 0));

    espesorTotalMm = hCuñaVal + hBaseVal + camaraAireVal;

    // Fracción de volumen ocupado por el material poroso respecto a un bloque macizo
    // Para cuña lineal (p=1), el volumen de la cuña es 50% (0.5); para pirámide 3D (p=2) es 33.3% (0.33)
    const factorPunta = modo3D === "piramidal_3d" ? 0.333 : 0.5;
    volumenRelativo = (hBaseVal + hCuñaVal * factorPunta) / Math.max(1, espesorTotalMm);

    perfilGeometria = {
      hCuñaMm: hCuñaVal,
      hBaseMm: hBaseVal,
      wPeriodoMm: Math.max(25, Math.min(100, wPeriodo)),
      exponentePerfil: Math.max(0.6, Math.min(2.5, expPerfil)),
      sigma: Math.max(5, Math.min(60, sigmaMat)),
      camaraAireMm: camaraAireVal,
      modo3D
    };
  }

  // 1. Cálculo de absorción espectral banda por banda (125 Hz a 4000 Hz)
  const coeficientesAbsorcion = [];
  const nivelesIncidentesA = [];
  const nivelesReflejadosA = [];

  for (let b = 0; b < BANDAS_OCTAVA_HZ.length; b++) {
    const freq = BANDAS_OCTAVA_HZ[b];
    const ponderacionA = PONDERACION_A_DB[b];
    const splIncidente = espectroBase[b];

    let alphaBanda = 0.05;

    if (tipoEstructura === "superficie_lisa") {
      // Cálculo multicapa mediante suma iterativa de impedancias acústicas superficiales
      let zinReal = 0.0;
      let zinImag = -10000.0; // Fondo rígido ideal (Z -> infinito)

      for (let i = datosCapas.length - 1; i >= 0; i--) {
        const capa = datosCapas[i];
        const dMetros = capa.espesorMm / 1000.0;
        const imp = calcularImpedanciaPoro(freq, capa.sigma);

        // Aproximación de línea de transmisión para capa porosa disipativa
        const gammaLReal = imp.kcImag * dMetros;
        const gammaLImag = imp.kcReal * dMetros;
        const tanhMag = Math.tanh(Math.min(3.0, gammaLReal + 0.1));

        // Transformación de impedancia característica hacia la superficie
        zinReal = imp.zcReal * tanhMag;
        zinImag = imp.zcImag * (1.0 - tanhMag * 0.5);
      }

      // Coeficiente de reflexión en la superficie frontal libre
      const z0 = 413.3;
      const numR = Math.hypot(zinReal - z0, zinImag);
      const denR = Math.hypot(zinReal + z0, zinImag);
      const r = Math.min(0.99, numR / (denR || 1.0));
      alphaBanda = 1.0 - r * r;

    } else {
      // Modo Cuña: modelo de transición gradual de impedancia + rebotes múltiples
      const hTotalMetros = (perfilGeometria.hCuñaMm + perfilGeometria.hBaseMm) / 1000.0;
      const imp = calcularImpedanciaPoro(freq, perfilGeometria.sigma);

      // La absorción de base plana normal para el espesor total
      const kBase = imp.kcReal * hTotalMetros;
      const alphaNormal = Math.min(0.96, Math.max(0.04, (1.0 - Math.exp(-kBase * 1.6)) * (imp.zcReal / (imp.zcReal + imp.z0))));

      // Ganancia por efecto cuña: rebotes acústicos múltiples entre caras inclinadas
      const anguloPuntaRad = Math.atan2(perfilGeometria.wPeriodoMm / 2.0, perfilGeometria.hCuñaMm);
      const numRebotes = Math.max(1.0, Math.min(4.0, (Math.PI / 2.0) / (anguloPuntaRad || 0.5)));

      // En 3D piramidal, la punta dispersa en ambos ejes ortogonales
      const factor3D = perfilGeometria.modo3D === "piramidal_3d" ? 1.25 : 1.0;
      alphaBanda = 1.0 - Math.pow(Math.max(0.02, 1.0 - alphaNormal), numRebotes * factor3D * 0.7);

      // Efecto sintonizador de cámara de aire trasera (si existe)
      if (perfilGeometria.camaraAireMm > 0 && freq <= 500) {
        alphaBanda = Math.min(0.98, alphaBanda * 1.35);
      }
    }

    // Corrección para campo difuso tridimensional de sala
    alphaBanda = Math.min(0.99, Math.max(0.05, alphaBanda));
    coeficientesAbsorcion.push(alphaBanda);

    // 2. Aplicación del balance de energía acústica y ponderación dBA
    const nivelIncA = splIncidente + ponderacionA;
    // La energía acústica residual no absorbida (reflejada) es (1 - alpha)
    const factorReflexion = Math.max(0.001, 1.0 - alphaBanda);
    const splReflejado = splIncidente + 10.0 * Math.log10(factorReflexion);
    const nivelRefA = splReflejado + ponderacionA;

    nivelesIncidentesA.push(nivelIncA);
    nivelesReflejadosA.push(nivelRefA);
  }

  // 3. Suma logarítmica total en dBA (Presión sonora cuadrática integrada)
  let sumaIncLineal = 0.0;
  let sumaRefLineal = 0.0;

  for (let i = 0; i < BANDAS_OCTAVA_HZ.length; i++) {
    sumaIncLineal += Math.pow(10.0, nivelesIncidentesA[i] / 10.0);
    sumaRefLineal += Math.pow(10.0, nivelesReflejadosA[i] / 10.0);
  }

  const nivelTotalIncidenteDba = 10.0 * Math.log10(Math.max(1.0, sumaIncLineal));
  const nivelTotalReflejadoDba = 10.0 * Math.log10(Math.max(1.0, sumaRefLineal));

  // Atenuación neta alcanzada por el absorbente
  const atenuacionLogradaDba = Math.max(0.0, nivelTotalIncidenteDba - nivelTotalReflejadoDba);

  // Coeficiente de reducción de ruido global (NRC)
  const nrcMedio = (coeficientesAbsorcion[1] + coeficientesAbsorcion[2] + coeficientesAbsorcion[3] + coeficientesAbsorcion[4]) / 4.0;

  // Porcentaje de ahorro de material respecto a un bloque plano macizo del mismo espesor
  const ahorroMaterialPorcentaje = Math.max(0.0, (1.0 - volumenRelativo) * 100.0);

  // Cumplimiento del requerimiento
  const cumpleObjetivo = atenuacionLogradaDba >= atenuacionObjetivoDba;
  const deficitAtenuacion = Math.max(0.0, atenuacionObjetivoDba - atenuacionLogradaDba);
  const excesoEspesor = Math.max(0.0, espesorTotalMm - limiteEspesorMaxMm);

  return {
    tipoEstructura,
    tipoRuido,
    atenuacionObjetivoDba,
    atenuacionLogradaDba,
    nivelTotalIncidenteDba,
    nivelTotalReflejadoDba,
    cumpleObjetivo,
    deficitAtenuacion,
    excesoEspesor,
    espesorTotalMm,
    limiteEspesorMaxMm,
    volumenRelativo,
    ahorroMaterialPorcentaje,
    nrcMedio,
    bandasHz: BANDAS_OCTAVA_HZ,
    ponderacionAdB: PONDERACION_A_DB,
    coeficientesAbsorcion,
    nivelesIncidentesA,
    nivelesReflejadosA,
    datosCapas,
    perfilGeometria
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloSuperficieFonoabsorbente = {
  id: "superficie-fonoabsorbente",
  nombre: "Superficie Fonoabsorbente (Cuñas y Multimaterial dBA)",
  descripcion: "Optimiza la geometría transversal de cuñas acústicas o la estratificación de un panel plano multimaterial para alcanzar una atenuación objetivo en dBA con espesor y material mínimos.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Déficit de Atenuación (dBA)", "Espesor Total y Volumen (mm)"],

  // Parámetros de entorno acústico seleccionables por el usuario.
  parametrosEntrada: [
    {
      clave: "tipoEstructura",
      etiqueta: "Tipo de Estructura Fonoabsorbente",
      tipo: "selector",
      opciones: [
        { valor: "cuña_prismatica", etiqueta: "Cuñas Geométricas Perfiladas (Tradicional)" },
        { valor: "superficie_lisa", etiqueta: "Superficie Lisa Multimaterial (Estratificación interna)" }
      ],
      valorDefecto: "cuña_prismatica"
    },
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Atenuación dBA vs. Espesor Mínimo)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Espesor mínimo garantizando objetivo)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    {
      clave: "atenuacionObjetivoDba",
      etiqueta: "Atenuación Requerida (dBA)",
      tipo: "numero",
      min: 6,
      max: 30,
      paso: 1,
      valorDefecto: 16
    },
    {
      clave: "tipoRuido",
      etiqueta: "Espectro de Ruido de Prueba",
      tipo: "selector",
      opciones: [
        { valor: "conversacion", etiqueta: "Voz humana y conversación (500 - 2000 Hz)" },
        { valor: "transito", etiqueta: "Tránsito vehicular (Predominio 125 - 500 Hz)" },
        { valor: "ruido_rosa", etiqueta: "Ruido Rosa equilibrado (1/f)" },
        { valor: "industrial", etiqueta: "Maquinaria Industrial (Media-Alta frecuencia)" }
      ],
      valorDefecto: "conversacion"
    },
    {
      clave: "modoExtrapolacion3D",
      etiqueta: "Extrapolación 3D del Perfil",
      tipo: "selector",
      opciones: [
        { valor: "extrusion_lineal", etiqueta: "Extrusión Longitudinal 2.5D (Bafles prismáticos)" },
        { valor: "piramidal_3d", etiqueta: "Mosaico de Pirámides 3D (Base cuadrada)" }
      ],
      valorDefecto: "extrusion_lineal"
    },
    {
      clave: "limiteEspesorMaxMm",
      etiqueta: "Espesor Límite Permitido (mm)",
      tipo: "numero",
      min: 60,
      max: 260,
      paso: 10,
      valorDefecto: 160
    }
  ],

  // 6 genes continuos que parametrizan la geometría o la estratificación según el modo.
  crearGenoma() {
    return [
      { tipo: "continuo", min: 25.0, max: 140.0 }, // Gene 0: hCuña (o espesor capa 1)
      { tipo: "continuo", min: 15.0, max: 70.0 },  // Gene 1: hBase (o espesor capa 2)
      { tipo: "continuo", min: 25.0, max: 90.0 },  // Gene 2: wPeriodo (o espesor capa 3)
      { tipo: "continuo", min: 0.6, max: 2.2 },    // Gene 3: Curvatura cuña (o sigma 1)
      { tipo: "continuo", min: 6.0, max: 55.0 },   // Gene 4: Sigma material (o sigma 2)
      { tipo: "continuo", min: 0.0, max: 50.0 }    // Gene 5: Cámara de aire trasera (o sigma 3)
    ];
  },

  // Evalúa el cumplimiento estricto del umbral dBA y penaliza espesor y volumen excesivo.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularAbsorbenteAcustico(genoma, entrada);

    // Objetivo 1: Penalización por no alcanzar los dBA objetivo + penalización por violar límite de espesor
    const penalizacionDeficit = sim.deficitAtenuacion * sim.deficitAtenuacion * 5.0;
    const penalizacionExceso = sim.excesoEspesor * 4.0;
    const objAtenuacion = sim.deficitAtenuacion * 12.0 + penalizacionDeficit + penalizacionExceso;

    // Objetivo 2: Espesor total y volumen de material relativo (a minimizar para reducir costo y espacio)
    const objMaterial = sim.espesorTotalMm * (0.5 + sim.volumenRelativo * 0.5);

    if (esMulti) {
      return [Math.max(0.01, objAtenuacion), Math.max(10.0, objMaterial)];
    }

    return objAtenuacion * 0.75 + objMaterial * 0.25;
  },

  // Genera un resumen técnico legible de la solución fonoabsorbente evaluada.
  describir(genoma, entrada) {
    const sim = simularAbsorbenteAcustico(genoma, entrada);
    const estado = sim.cumpleObjetivo ? "✓ CUMPLE OBJETIVO" : `✕ FALTAN ${sim.deficitAtenuacion.toFixed(1)} dBA`;
    return `🔇 ${sim.tipoEstructura === "superficie_lisa" ? "Superficie Lisa Multicapa" : "Cuñas Acústicas"}: ${sim.atenuacionLogradaDba.toFixed(1)} dBA (Obj: ${sim.atenuacionObjetivoDba} dBA) | ${estado} | Espesor: ${sim.espesorTotalMm.toFixed(0)} mm | NRC: ${sim.nrcMedio.toFixed(2)}`;
  }
};

export default ModeloSuperficieFonoabsorbente;
