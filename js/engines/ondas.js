// =========================================================================
// MOTOR FUNDAMENTAL 3: PROPAGACIÓN DE ONDAS, ACÚSTICA, RAYOS Y PONDERACIÓN dBA
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================

// Constantes físicas normalizadas para acústica en el aire a 20 °C
export const CONSTANTES_ACUSTICAS = {
  VELOCIDAD_SONIDO: 343.0,     // c en m/s
  DENSIDAD_AIRE: 1.205,        // rho0 en kg/m3
  IMPEDANCIA_AIRE: 413.3,      // Z0 = rho0 * c en Pa·s/m
  BANDAS_OCTAVA_HZ: [125, 250, 500, 1000, 2000, 4000],
  PONDERACION_A_DB: [-16.1, -8.6, -3.2, 0.0, 1.2, 1.0]
};

// Motor central para simulación de interferencia de ondas, trazado de rayos y absorción multicapa
export class MotorOndasAcustica {
  // Inicializa el motor acústico con la velocidad de propagación y densidad
  constructor(c = CONSTANTES_ACUSTICAS.VELOCIDAD_SONIDO, rho = CONSTANTES_ACUSTICAS.DENSIDAD_AIRE) {
    this.c = c;
    this.rho = rho;
    this.z0 = this.rho * this.c;
    this.emisores = [];
    this.superficies = [];
  }

  // Agrega un emisor de onda sinusoidal al arreglo espacial
  agregarEmisor(emisor) {
    this.emisores.push({
      x: emisor.x || 0.0,
      y: emisor.y || 0.0,
      amplitud: emisor.amplitud !== undefined ? emisor.amplitud : 1.0,
      faseRad: emisor.faseRad || 0.0
    });
  }

  // Agrega una superficie o barrera reflectora/fonoabsorbente con coeficiente de absorción alpha
  agregarSuperficie(x1, y1, x2, y2, absorcionAlfa = 0.2) {
    this.superficies.push({ x1, y1, x2, y2, absorcionAlfa });
  }

  // Limpia los emisores y superficies registradas
  reiniciar() {
    this.emisores = [];
    this.superficies = [];
  }

  // Calcula la impedancia característica Zc y número de onda kc en medio poroso según Delany-Bazley-Miki
  calcularImpedanciaPoroMiki(frecuenciaHz, resistividadFlujoSigma) {
    const sigma = Math.max(2.0, Math.min(150.0, resistividadFlujoSigma)) * 1000.0;
    const X = (this.rho * frecuenciaHz) / sigma;
    const k0 = (2.0 * Math.PI * frecuenciaHz) / this.c;

    const zReal = this.z0 * (1.0 + 0.07 * Math.pow(X, -0.632));
    const zImag = this.z0 * (-0.107 * Math.pow(X, -0.632));

    const kReal = k0 * (1.0 + 0.109 * Math.pow(X, -0.618));
    const kImag = k0 * (-0.16 * Math.pow(X, -0.618));

    return { zReal, zImag, kReal, kImag };
  }

  // Resuelve la absorción normal y difusa de un sistema multicapa de capas porosas mediante matrices de transferencia
  calcularAbsorcionMulticapa(capas, frecuenciaHz) {
    let zinReal = 0.0;
    let zinImag = -10000.0; // Fondo rígido ideal (terminación en circuito abierto acústico)

    for (let i = capas.length - 1; i >= 0; i--) {
      const capa = capas[i];
      const dMetros = (capa.espesorMm || 20.0) / 1000.0;
      const { zReal, zImag, kReal, kImag } = this.calcularImpedanciaPoroMiki(frecuenciaHz, capa.sigma || 20.0);

      // Parámetros de propagación compleja en la línea de transmisión acústica (atenuación real alpha = |kImag|)
      const atenuacion = Math.tanh(Math.min(3.0, Math.abs(kImag) * dMetros + 0.15));
      zinReal = zReal * atenuacion;
      zinImag = zImag * (1.0 - atenuacion * 0.5);
    }

    // Coeficiente de reflexión por desadaptación con el aire libre: r = (Zin - Z0) / (Zin + Z0)
    const numR = Math.hypot(zinReal - this.z0, zinImag);
    const denR = Math.hypot(zinReal + this.z0, zinImag);
    const r = Math.min(0.99, numR / (denR || 1.0));

    // Coeficiente de absorción normal alpha = 1 - |r|^2
    const alphaNormal = 1.0 - r * r;
    // Estimación para campo difuso 3D reverberante
    const alphaDifuso = Math.min(0.99, Math.max(0.04, alphaNormal * 1.15));

    return { alphaNormal, alphaDifuso };
  }

  // Calcula el diagrama polar angular de radiación y nivel de lóbulos secundarios (SLL dB) de un arreglo
  calcularDiagramaPolar(frecuenciaHz, anguloObjetivoGrad = 0.0) {
    const k = (2.0 * Math.PI * frecuenciaHz) / this.c;
    const numPuntos = 181; // Barrido de -90° a +90°
    const diagrama = [];
    let potMax = 0.0001;
    let anguloPico = 0.0;
    let potObjetivo = 0.0;
    let maxSecundario = 0.0;

    for (let idx = 0; idx < numPuntos; idx++) {
      const grad = -90.0 + idx;
      const rad = (grad * Math.PI) / 180.0;
      const sinTheta = Math.sin(rad);

      let sumaRe = 0.0;
      let sumaIm = 0.0;

      for (let i = 0; i < this.emisores.length; i++) {
        const em = this.emisores[i];
        const retardo = k * em.x * sinTheta;
        const faseTotal = em.faseRad + retardo;

        sumaRe += em.amplitud * Math.cos(faseTotal);
        sumaIm += em.amplitud * Math.sin(faseTotal);
      }

      const pot = sumaRe * sumaRe + sumaIm * sumaIm;
      if (pot > potMax) {
        potMax = pot;
        anguloPico = grad;
      }
      if (Math.abs(grad - anguloObjetivoGrad) <= 1.0) {
        potObjetivo = pot;
      }

      diagrama.push({ grad, rad, pot });
    }

    // Normalización y cálculo de atenuación de lóbulos laterales
    diagrama.forEach((p) => {
      p.potNorm = p.pot / potMax;
      p.gananciaDb = 10.0 * Math.log10(Math.max(1e-4, p.potNorm));
      if (Math.abs(p.grad - anguloObjetivoGrad) > 16.0) {
        if (p.potNorm > maxSecundario) maxSecundario = p.potNorm;
      }
    });

    const sllDb = 10.0 * Math.log10(Math.max(1e-4, maxSecundario));

    return {
      diagrama,
      anguloPico,
      potMax,
      potObjetivo,
      sllDb
    };
  }

  // Integra y suma logarítmicamente un espectro en bandas de octava con ponderación dBA (IEC 61672-1)
  static calcularNivelGlobalDba(nivelesOctavaDb) {
    const ponderaciones = CONSTANTES_ACUSTICAS.PONDERACION_A_DB;
    let sumaEnergeticaLineal = 0.0;

    for (let i = 0; i < nivelesOctavaDb.length; i++) {
      const pA = ponderaciones[i] !== undefined ? ponderaciones[i] : 0.0;
      const nivelPonderado = nivelesOctavaDb[i] + pA;
      sumaEnergeticaLineal += Math.pow(10.0, nivelPonderado / 10.0);
    }

    return 10.0 * Math.log10(Math.max(1.0, sumaEnergeticaLineal));
  }

  // Trazador de rayos 2D: simula la trayectoria, rebotes geométricos y atenuación de energía acústica o lumínica
  trazarRayo(origenX, origenY, anguloRad, energiaInicial = 100.0, maxRebotes = 6) {
    let x = origenX;
    let y = origenY;
    let dx = Math.cos(anguloRad);
    let dy = Math.sin(anguloRad);
    let energia = energiaInicial;
    const trayectoria = [{ x, y, energia }];

    for (let rebote = 0; rebote < maxRebotes; rebote++) {
      if (energia < 1.0) break;

      let menorT = Infinity;
      let supChoque = null;

      // Encuentra la intersección más cercana con las superficies registradas
      for (let i = 0; i < this.superficies.length; i++) {
        const s = this.superficies[i];
        const denom = dx * (s.y2 - s.y1) - dy * (s.x2 - s.x1);
        if (Math.abs(denom) < 1e-6) continue;

        const t = ((s.x1 - x) * (s.y2 - s.y1) - (s.y1 - y) * (s.x2 - s.x1)) / denom;
        const u = -((x - s.x1) * dy - (y - s.y1) * dx) / denom;

        if (t > 0.01 && t < menorT && u >= 0.0 && u <= 1.0) {
          menorT = t;
          supChoque = s;
        }
      }

      if (!supChoque) {
        // El rayo viaja al infinito libremente
        x += dx * 200.0;
        y += dy * 200.0;
        trayectoria.push({ x, y, energia });
        break;
      }

      // Punto de impacto
      x += dx * menorT;
      y += dy * menorT;

      // Absorción de energía en la superficie
      energia *= (1.0 - supChoque.absorcionAlfa);
      trayectoria.push({ x, y, energia });

      // Vector normal a la superficie de choque
      const sx = supChoque.x2 - supChoque.x1;
      const sy = supChoque.y2 - supChoque.y1;
      const lenS = Math.hypot(sx, sy);
      const nx = -sy / lenS;
      const ny = sx / lenS;

      // Reflexión especular: v_ref = v - 2 * (v · n) * n
      const dot = dx * nx + dy * ny;
      dx = dx - 2.0 * dot * nx;
      dy = dy - 2.0 * dot * ny;
    }

    return trayectoria;
  }
}




// =========================================================================
// SOLVERS ESPECÍFICOS DE ONDAS, ARREGLOS Y FONOABSORCIÓN
// =========================================================================

export function simularArregloAcustico(genoma, entrada) {
  // Constantes físicas del medio (aire a 20 °C)
  const c = 343.0; // Velocidad del sonido en m/s
  const f = Number(entrada?.frecuenciaSonido !== undefined ? entrada.frecuenciaSonido : 2000.0);
  const anguloObjetivoGrad = Number(entrada?.anguloObjetivo !== undefined ? entrada.anguloObjetivo : 25.0);
  const distanciaFoco = Number(entrada?.distanciaFoco !== undefined ? entrada.distanciaFoco : 1.2);

  // Parámetros de onda
  const lambda = c / f; // Longitud de onda en metros (ej. 0.1715 m para 2 kHz)
  const k = (2.0 * Math.PI) / lambda; // Número de onda
  const omega = 2.0 * Math.PI * f; // Frecuencia angular

  // Arreglo lineal de N = 6 transductores acústicos con espaciamiento d = lambda / 2 (criterio anti-aliasing)
  const numTransductores = 6;
  const d = Math.min(0.12, Math.max(0.04, lambda / 2.0)); // Espaciado entre transductores
  const transductores = [];

  // Los 12 genes del genoma:
  // [phi_0..phi_5]: 6 fases relativas en radianes [-PI, PI]
  // [A_0..A_5]: 6 amplitudes relativas de excitación [0.1, 1.0]
  const fases = genoma.slice(0, numTransductores);
  const amplitudes = genoma.slice(numTransductores, numTransductores * 2);

  for (let i = 0; i < numTransductores; i++) {
    const x = (i - (numTransductores - 1) / 2.0) * d;
    const y = 0.0;
    const phi = fases[i] !== undefined ? fases[i] : 0.0;
    const amp = amplitudes[i] !== undefined ? Math.max(0.05, amplitudes[i]) : 1.0;
    transductores.push({ x, y, phi, amp });
  }

  // Ángulo objetivo en radianes (medido desde la normal al arreglo, eje +Y)
  const thetaObjRad = (anguloObjetivoGrad * Math.PI) / 180.0;

  // 1. Cálculo del diagrama de radiación polar en campo lejano (Far-Field Directivity Pattern)
  const numPuntosPolar = 181; // Barrido angular de -90° a +90°
  const diagramaPolar = [];
  let potenciaEnObjetivo = 0.0;
  let potenciaMaxima = 0.0001;
  let anguloPico = 0.0;
  let maxLobuloSecundario = 0.0;

  for (let idx = 0; idx < numPuntosPolar; idx++) {
    const grad = -90.0 + idx;
    const rad = (grad * Math.PI) / 180.0;

    // Suma vectorial compleja de las contribuciones de cada emisor
    let sumaReal = 0.0;
    let sumaImag = 0.0;

    for (let i = 0; i < numTransductores; i++) {
      const emisor = transductores[i];
      // Retardo de fase espacial en dirección theta: Delta_phi = k * x_i * sin(theta)
      const retardoEspacial = k * emisor.x * Math.sin(rad);
      const faseTotal = emisor.phi + retardoEspacial;

      sumaReal += emisor.amp * Math.cos(faseTotal);
      sumaImag += emisor.amp * Math.sin(faseTotal);
    }

    const potenciaLineal = sumaReal * sumaReal + sumaImag * sumaImag;
    if (potenciaLineal > potenciaMaxima) {
      potenciaMaxima = potenciaLineal;
      anguloPico = grad;
    }

    // Evalúa la potencia en el ángulo deseado
    if (Math.abs(grad - anguloObjetivoGrad) <= 1.0) {
      potenciaEnObjetivo = potenciaLineal;
    }

    diagramaPolar.push({
      anguloGrad: grad,
      anguloRad: rad,
      potenciaLineal
    });
  }

  // 2. Normalización del diagrama polar y cálculo de lóbulos secundarios (Side-Lobe Level SLL)
  diagramaPolar.forEach((p) => {
    p.potenciaNormalizada = p.potenciaLineal / (potenciaMaxima || 1.0);
    p.gananciaDb = 10.0 * Math.log10(Math.max(1e-4, p.potenciaNormalizada));

    // Determina lóbulos secundarios fuera del haz principal (separados más de 18° del objetivo)
    if (Math.abs(p.anguloGrad - anguloObjetivoGrad) > 18.0) {
      if (p.potenciaNormalizada > maxLobuloSecundario) {
        maxLobuloSecundario = p.potenciaNormalizada;
      }
    }
  });

  // Relación lóbulo principal a secundario en decibelios (SLL dB)
  const relacionLobuloSecundarioDb = 10.0 * Math.log10(Math.max(1e-4, maxLobuloSecundario));

  // Ancho de haz a mitad de potencia (-3 dB)
  let anchoHaz3dB = 0.0;
  diagramaPolar.forEach((p) => {
    if (p.gananciaDb >= -3.0 && Math.abs(p.anguloGrad - anguloPico) < 35.0) {
      anchoHaz3dB += 1.0;
    }
  });

  // 3. Cálculo de la grilla de presión acústica RMS 2D en campo cercano/medio
  const nx = 42;
  const ny = 34;
  const anchoMundo = 1.6;
  const altoMundo = 1.4;
  const grillaRMS = new Float32Array(nx * ny);

  let presionMaxRMS = 0.001;
  const xFoco = distanciaFoco * Math.sin(thetaObjRad);
  const yFoco = distanciaFoco * Math.cos(thetaObjRad);
  let presionEnFoco = 0.0;

  for (let iy = 0; iy < ny; iy++) {
    const yPunto = 0.05 + (iy / (ny - 1)) * (altoMundo - 0.05);
    for (let ix = 0; ix < nx; ix++) {
      const xPunto = -anchoMundo / 2.0 + (ix / (nx - 1)) * anchoMundo;

      let pReal = 0.0;
      let pImag = 0.0;

      for (let i = 0; i < numTransductores; i++) {
        const em = transductores[i];
        const r = Math.hypot(xPunto - em.x, yPunto - em.y);
        const atenuacion = em.amp / Math.sqrt(r + 0.02);
        const faseProp = k * r + em.phi;

        pReal += atenuacion * Math.cos(faseProp);
        pImag += atenuacion * Math.sin(faseProp);
      }

      const rms = Math.hypot(pReal, pImag);
      grillaRMS[iy * nx + ix] = rms;
      if (rms > presionMaxRMS) presionMaxRMS = rms;

      if (Math.hypot(xPunto - xFoco, yPunto - yFoco) < 0.08) {
        presionEnFoco = rms;
      }
    }
  }

  // Normaliza grilla para visualización
  for (let idx = 0; idx < grillaRMS.length; idx++) {
    grillaRMS[idx] /= presionMaxRMS;
  }

  // 4. Eficiencia energética del arreglo (suma de cuadrados de amplitudes)
  let energiaAcusticaTotal = 0.0;
  for (let i = 0; i < numTransductores; i++) {
    energiaAcusticaTotal += transductores[i].amp * transductores[i].amp;
  }

  return {
    frecuenciaHz: f,
    longitudOndaM: lambda,
    numeroOndaK: k,
    frecuenciaAngularOmega: omega,
    anguloObjetivoGrad,
    distanciaFoco,
    xFoco,
    yFoco,
    transductores,
    diagramaPolar,
    anguloPico,
    potenciaEnObjetivo,
    potenciaMaxima,
    relacionLobuloSecundarioDb,
    anchoHaz3dB,
    maxLobuloSecundario,
    presionEnFoco,
    energiaAcusticaTotal,
    grillaRMS,
    nx,
    ny,
    anchoMundo,
    altoMundo
  };
}

// Objeto de definición del modelo para el motor evolutivo.


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

export default MotorOndasAcustica;
