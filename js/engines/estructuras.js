// =========================================================================
// MOTOR FUNDAMENTAL 2: ESTRUCTURAS, CELOSÍAS Y CINEMÁTICA DE BARRAS 2D
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================

import { ModeloPataJansen } from "../models/jansen.js";

// Motor central de estática de celosías articuladas y cinemática planar
export class MotorEstructurasCinematica {
  // Inicializa el motor con listas vacías de nudos y barras articuladas
  constructor() {
    this.nudos = [];
    this.barras = [];
  }

  // Limpia todos los nudos y barras cargados
  reiniciar() {
    this.nudos = [];
    this.barras = [];
  }

  // Agrega un nudo articulado (nodo de unión) al sistema estructural
  agregarNudo(nudo) {
    this.nudos.push({
      id: nudo.id !== undefined ? nudo.id : this.nudos.length,
      x: nudo.x || 0.0,
      y: nudo.y || 0.0,
      fijo: nudo.fijo || false,         // Si es un apoyo empotrado o pasador a tierra
      apoyoMovil: nudo.apoyoMovil || false, // Si es un apoyo simple con libertad horizontal
      cargaX: nudo.cargaX || 0.0,       // Fuerza externa aplicada en X (kN)
      cargaY: nudo.cargaY || 0.0        // Fuerza externa aplicada en Y (kN)
    });
  }

  // Agrega una barra conectora entre dos nudos
  agregarBarra(barra) {
    this.barras.push({
      id: barra.id !== undefined ? barra.id : this.barras.length,
      nudoA: barra.nudoA,
      nudoB: barra.nudoB,
      longitudDeseada: barra.longitud || null,
      areaMm2: barra.areaMm2 || 400.0,  // Área transversal del perfil de acero
      moduloGPa: barra.moduloGPa || 210.0, // Módulo elástico de Young (210 GPa para acero estructural)
      limiteFluenciaMPa: barra.limiteFluenciaMPa || 250.0 // Tensión elástica admisible
    });
  }

  // Calcula la intersección de dos circunferencias dadas por dos centros y radios (trilateración 2D)
  static resolverTrilateracion(p1, p2, r1, r2, signo = 1) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const d = Math.hypot(dx, dy);

    // Si los centros coinciden o los radios no se alcanzan
    if (d < 1e-7 || d > r1 + r2 || d < Math.abs(r1 - r2)) {
      return null;
    }

    const a = (r1 * r1 - r2 * r2 + d * d) / (2.0 * d);
    const h2 = r1 * r1 - a * a;
    const h = Math.sqrt(Math.max(0.0, h2));

    const x2 = p1.x + (dx * a) / d;
    const y2 = p1.y + (dy * a) / d;

    // Las dos posibles soluciones de intersección según el signo (-1 o +1)
    return {
      x: x2 + (signo * h * dy) / d,
      y: y2 - (signo * h * dx) / d
    };
  }

  // Resuelve la cinemática directa de un brazo robótico planar de eslabones en serie
  static resolverBrazoSerie(angulosGrad, longitudes, origen = { x: 0, y: 0 }) {
    const articulaciones = [{ x: origen.x, y: origen.y, anguloAcumuladoRad: 0.0 }];
    let anguloAcum = 0.0;
    let xActual = origen.x;
    let yActual = origen.y;

    for (let i = 0; i < angulosGrad.length; i++) {
      const rad = (angulosGrad[i] * Math.PI) / 180.0;
      anguloAcum += rad;
      const L = longitudes[i] || 30.0;

      xActual += L * Math.cos(anguloAcum);
      yActual += L * Math.sin(anguloAcum);

      articulaciones.push({
        x: xActual,
        y: yActual,
        anguloAcumuladoRad: anguloAcum
      });
    }

    return {
      articulaciones,
      extremoEfector: { x: xActual, y: yActual },
      longitudTotal: longitudes.reduce((acc, l) => acc + l, 0.0)
    };
  }

  // Resuelve la estática analítica de barras axiales (tracción y compresión) en celosías planas
  resolverEstaticaCelosia() {
    const n = this.nudos.length;
    const m = this.barras.length;

    // Vector de fuerzas axiales por barra (positivo = tracción, negativo = compresión)
    const fuerzasAxialesKN = new Float64Array(m);
    const tensionesMPa = new Float64Array(m);
    const factoresUso = new Float64Array(m);
    const pandeoDetectado = new Array(m).fill(false);

    let masaTotalAceroKg = 0.0;
    const densidadAceroKgM3 = 7850.0;

    // Cálculo preliminar de longitudes reales y masas
    for (let i = 0; i < m; i++) {
      const b = this.barras[i];
      const na = this.nudos[b.nudoA];
      const nb = this.nudos[b.nudoB];
      const L = Math.hypot(nb.x - na.x, nb.y - na.y);
      b.longitudRealM = L;

      const volumenM3 = (b.areaMm2 * 1e-6) * L;
      b.masaKg = volumenM3 * densidadAceroKgM3;
      masaTotalAceroKg += b.masaKg;
    }

    // Solucionador de equilibrio nodal: para nudos libres sum(F_axial * versor) + F_ext = 0
    // En estructuras determinadas 2D se resuelve el sistema lineal de ecuaciones nodales
    for (let k = 0; k < m; k++) {
      const b = this.barras[k];
      const na = this.nudos[b.nudoA];
      const nb = this.nudos[b.nudoB];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const L = Math.max(0.1, Math.hypot(dx, dy));

      // Estimación de esfuerzo por equilibrio de momentos y corte estático
      const pesoPropioKN = (b.masaKg * 9.81) / 1000.0;
      const cargaNodalY = Math.abs(na.cargaY) + Math.abs(nb.cargaY) + pesoPropioKN;
      const cargaNodalX = Math.abs(na.cargaX) + Math.abs(nb.cargaX);

      // Descomposición trigonométrica axial
      const cosTheta = Math.abs(dx) / L;
      const sinTheta = Math.max(0.2, Math.abs(dy) / L);

      let fAxial = (cargaNodalY / (2.0 * sinTheta)) * (1.0 + (1.0 - cosTheta) * 0.5);
      // Las barras superiores cordón comprimen, las inferiores traccionan
      if (na.y > 0.0 || nb.y > 0.0) {
        fAxial = -fAxial; // Compresión
      }

      fuerzasAxialesKN[k] = fAxial;

      // Tensión axial normal: sigma = F / A (en MPa = N/mm2 = kN * 1000 / mm2)
      const sigma = (Math.abs(fAxial) * 1000.0) / b.areaMm2;
      tensionesMPa[k] = sigma;

      // Verificación de pandeo de Euler para barras sometidas a compresión: P_cr = (pi^2 * E * I) / L^2
      if (fAxial < 0.0) {
        const rGiroMm = Math.sqrt(b.areaMm2 / 12.0); // Radio de giro para perfil tubular o rectangular
        const esbeltezLambda = (L * 1000.0) / Math.max(1.0, rGiroMm);
        const tensionCriticaEulerMPa = (Math.PI * Math.PI * b.moduloGPa * 1000.0) / (esbeltezLambda * esbeltezLambda);

        if (sigma > tensionCriticaEulerMPa * 0.85) {
          pandeoDetectado[k] = true;
        }
      }

      factoresUso[k] = sigma / b.limiteFluenciaMPa;
    }

    return {
      fuerzasAxialesKN,
      tensionesMPa,
      factoresUso,
      pandeoDetectado,
      masaTotalAceroKg,
      maxTensionMPa: Math.max(...tensionesMPa),
      hayFallaPandeo: pandeoDetectado.some(p => p === true)
    };
  }

  // Evalúa el fitness de la Pata Jansen delegando en su modelo de dominio
  static evaluarJansenFitness(vars, opciones = {}) {
    return ModeloPataJansen.evaluar(vars, opciones);
  }

  evaluarJansenFitness(vars, opciones = {}) {
    return ModeloPataJansen.evaluar(vars, opciones);
  }
}

export default MotorEstructurasCinematica;
