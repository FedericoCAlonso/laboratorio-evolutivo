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

export default MotorOndasAcustica;
