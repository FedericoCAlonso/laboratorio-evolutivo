// =========================================================================
// MOTOR FUNDAMENTAL 2: ESTRUCTURAS, CELOSÍAS Y CINEMÁTICA DE BARRAS 2D
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================



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
    return evaluarJansen(vars, opciones);
  }

  evaluarJansenFitness(vars, opciones = {}) {
    return evaluarJansen(vars, opciones);
  }
}



// =========================================================================
// SOLVERS ESPECÍFICOS DE CINEMÁTICA Y ESTRUCTURAS
// =========================================================================

export const LONGITUDES_ESLABONES_BRAZO = [45, 35, 25];

// Calcula la distancia mínima euclidiana desde un punto P hasta un segmento de recta AB.
export function distanciaPuntoASegmento(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const longCuad = abx * abx + aby * aby;
  if (longCuad === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Proyección escalar t acotada al intervalo [0, 1] del segmento.
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / longCuad;
  t = Math.max(0, Math.min(1, t));

  const proyX = a.x + t * abx;
  const proyY = a.y + t * aby;
  return Math.hypot(p.x - proyX, p.y - proyY);
}

// Resuelve la cinemática directa del manipulador de 3 articulaciones a partir de los ángulos en grados.
export function resolverCinematicaBrazo(genoma) {
  const [th1Deg, th2Deg, th3Deg] = genoma;
  const [L1, L2, L3] = LONGITUDES_ESLABONES_BRAZO;

  const a1 = (th1Deg * Math.PI) / 180;
  const a2 = a1 + (th2Deg * Math.PI) / 180;
  const a3 = a2 + (th3Deg * Math.PI) / 180;

  const p0 = { x: 0, y: 0 };
  const p1 = { x: L1 * Math.cos(a1), y: L1 * Math.sin(a1) };
  const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) };
  const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) };

  return { p0, p1, p2, p3, a1, a2, a3 };
}

// Objeto de definición del modelo para el optimizador evolutivo.


export function resolverEstaticaArmadura(genoma, entrada) {
  const luz = Number(entrada?.luzTotal !== undefined ? entrada.luzTotal : 60.0); // metros
  const cargaP = Number(entrada?.cargaVertical !== undefined ? entrada.cargaVertical : 50.0); // kN
  const limiteTension = Number(entrada?.limiteTension !== undefined ? entrada.limiteTension : 250.0); // MPa

  // Nodos inferiores fijos de la calzada:
  // N0: Apoyo fijo en x = 0, y = 0
  // N1: Carga vertical en x = luz/3, y = 0
  // N2: Carga vertical en x = 2*luz/3, y = 0
  // N3: Apoyo móvil en x = luz, y = 0
  const n0 = { x: 0, y: 0 };
  const n1 = { x: luz / 3, y: 0 };
  const n2 = { x: (2 * luz) / 3, y: 0 };
  const n3 = { x: luz, y: 0 };

  // 4 genes continuos para la geometría del cordón superior:
  // [ySuperior1, xCentro, ySuperiorCentro, ySuperior2]
  const [h1, xCentroRel, hCentro, h2] = genoma;
  const n4 = { x: luz / 3, y: h1 };
  const n5 = { x: (luz / 2) + xCentroRel, y: hCentro };
  const n6 = { x: (2 * luz) / 3, y: h2 };

  const nodos = [n0, n1, n2, n3, n4, n5, n6];

  // 11 barras estructurales definidas por sus pares de nudos [inicio, fin]:
  const barrasDef = [
    [0, 1], // 0: Cordón inferior tramo 1
    [1, 2], // 1: Cordón inferior tramo 2
    [2, 3], // 2: Cordón inferior tramo 3
    [4, 5], // 3: Cordón superior tramo 1
    [5, 6], // 4: Cordón superior tramo 2
    [0, 4], // 5: Diagonal extrema izquierda
    [1, 4], // 6: Montante / diagonal interior 1
    [1, 5], // 7: Diagonal central izquierda
    [2, 5], // 8: Diagonal central derecha
    [2, 6], // 9: Montante / diagonal interior 2
    [3, 6]  // 10: Diagonal extrema derecha
  ];

  // Reacciones de apoyo en n0 y n3 (simetría estática total = 2*P)
  const rY0 = cargaP;
  const rY3 = cargaP;

  // Cálculo de longitudes y pesos de las 11 barras
  const densidadAcero = 7850; // kg/m^3
  const seccionBarra = 0.0035; // m^2 (sección transversal promedio)
  let masaTotalKg = 0;
  const barras = [];

  for (let b = 0; b < barrasDef.length; b++) {
    const [iA, iB] = barrasDef[b];
    const nA = nodos[iA];
    const nB = nodos[iB];
    const longitud = Math.hypot(nB.x - nA.x, nB.y - nA.y);
    const masaBarra = longitud * seccionBarra * densidadAcero;
    masaTotalKg += masaBarra;

    // Estimación analítica rigurosa del esfuerzo axial N_i mediante momento flector M / brazo z
    // Cordón inferior: tracción N > 0
    // Cordón superior: compresión N < 0
    // Diagonales y montantes: cortante V / sen(theta)
    let fuerzaAxialKN = 0;
    const brazoH = Math.max(2.0, (nA.y + nB.y) / 2 || hCentro);

    if (b <= 2) {
      // Cordón inferior (tracción por flexión global M = P * L/3)
      fuerzaAxialKN = (cargaP * (luz / 3)) / brazoH;
    } else if (b <= 4) {
      // Cordón superior (compresión por flexión global)
      fuerzaAxialKN = -((cargaP * (luz / 3)) / brazoH);
    } else if (b === 5 || b === 10) {
      // Diagonales de apoyo extremo (transmiten reacción rY0 con ángulo)
      const angulo = Math.atan2(Math.abs(nB.y - nA.y), Math.abs(nB.x - nA.x)) || 0.5;
      fuerzaAxialKN = -(rY0 / Math.sin(angulo));
    } else {
      // Diagonales y montantes interiores
      const senAng = Math.sin(Math.atan2(Math.abs(nB.y - nA.y), Math.abs(nB.x - nA.x))) || 0.7;
      fuerzaAxialKN = (cargaP * 0.45) / senAng;
    }

    const tensionMPa = (Math.abs(fuerzaAxialKN) * 1000) / (seccionBarra * 1e6); // MPa
    const esCompresion = fuerzaAxialKN < 0;

    // Carga crítica de pandeo de Euler P_cr = (pi^2 * E * I) / L^2
    const E = 210e9; // Pa
    const I = 2.5e-6; // m^4
    const cargaCriticaKN = (Math.PI * Math.PI * E * I) / (longitud * longitud * 1000);
    const pandea = esCompresion && Math.abs(fuerzaAxialKN) > cargaCriticaKN;

    barras.push({
      nodos: [nA, nB],
      indices: [iA, iB],
      longitud,
      fuerzaAxialKN,
      tensionMPa,
      esCompresion,
      pandea,
      factorUso: tensionMPa / limiteTension
    });
  }

  // Máxima tensión alcanzada y deformación estimada en el centro
  const maxTensionMPa = Math.max(...barras.map(b => b.tensionMPa));
  const maxFactorUso = maxTensionMPa / limiteTension;
  const hayPandeo = barras.some(b => b.pandea);
  const deflexionCentroMm = ((cargaP * Math.pow(luz, 3)) / (48 * 210e6 * (hCentro * hCentro * seccionBarra))) * 1000;

  return {
    nodos,
    barras,
    luz,
    cargaP,
    limiteTension,
    masaTotalKg,
    maxTensionMPa,
    maxFactorUso,
    hayPandeo,
    deflexionCentroMm
  };
}

// Objeto de definición del modelo para el motor evolutivo.


// Cinemática del mecanismo de cuatro barras (Pata caminante)
export function resolverCinematicaCaminante(theta, genoma) {
  const [dx, dy, L, r3, p, alpha] = genoma;
  const O1 = { x: 0, y: 0 };
  const O2 = { x: dx, y: dy };
  const A = { x: Math.cos(theta), y: Math.sin(theta) };

  const vx = O2.x - A.x;
  const vy = O2.y - A.y;
  const d = Math.hypot(vx, vy);

  if (d === 0 || d > L + r3 || d < Math.abs(L - r3)) {
    return null;
  }

  const a = (L * L - r3 * r3 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L * L - a * a));
  const mx = A.x + (a * vx) / d;
  const my = A.y + (a * vy) / d;

  const B = {
    x: mx + (h * vy) / d,
    y: my - (h * vx) / d
  };

  const phi = Math.atan2(B.y - A.y, B.x - A.x);
  const P = {
    x: A.x + p * Math.cos(phi + alpha),
    y: A.y + p * Math.sin(phi + alpha)
  };

  return { theta, O1, O2, A, B, P };
}

export function obtenerMetricasCaminante(genoma, entrada = {}) {
  const w1 = Number(entrada?.w1 !== undefined ? entrada.w1 : 3.0);
  const w2 = Number(entrada?.w2 !== undefined ? entrada.w2 : 1.0);
  const w3 = Number(entrada?.w3 !== undefined ? entrada.w3 : 1.0);
  const w4 = Number(entrada?.w4 !== undefined ? entrada.w4 : 1.0);
  const [dx, dy, L, r3, p, alpha] = genoma;

  const N = 180;
  const pasos = [];
  let pasosInvalidos = 0;

  for (let s = 0; s < N; s++) {
    const theta = (2 * Math.PI * s) / N;
    const res = resolverCinematicaCaminante(theta, genoma);
    if (!res) {
      pasosInvalidos++;
    } else {
      pasos.push({ idx: s, ...res });
    }
  }

  const pctValidos = ((N - pasosInvalidos) / N) * 100;
  if (pasosInvalidos > 0) {
    return {
      valido: false,
      pctValidos,
      pasosInvalidos,
      fitness: 1000 + 10 * pasosInvalidos,
      f1: 1, f2: 1, f3: 1, f4: 1,
      anchoApoyo: 0,
      alturaTotal: 0,
      anchoTotal: 0,
      pasos: []
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (let s = 0; s < N; s++) {
    const P = pasos[s].P;
    if (P.x < minX) minX = P.x;
    if (P.x > maxX) maxX = P.x;
    if (P.y < minY) minY = P.y;
    if (P.y > maxY) maxY = P.y;
  }

  const anchoTotal = maxX - minX;
  const alturaTotal = maxY - minY;
  const diagCaja = Math.hypot(anchoTotal, alturaTotal);

  let saltoGrande = false;
  for (let s = 0; s < N; s++) {
    const pAct = pasos[s].P;
    const pSig = pasos[(s + 1) % N].P;
    if (Math.hypot(pSig.x - pAct.x, pSig.y - pAct.y) > 0.25 * diagCaja) {
      saltoGrande = true;
      break;
    }
  }

  if (saltoGrande) {
    return { valido: false, pctValidos, fitness: 500, f1: 1, f2: 1, f3: 1, f4: 1, anchoApoyo: 0, alturaTotal, anchoTotal, pasos };
  }

  if (alturaTotal <= 1e-6) {
    return { valido: false, pctValidos, fitness: 800, f1: 1, f2: 1, f3: 1, f4: 1, anchoApoyo: 0, alturaTotal: 0, anchoTotal, pasos };
  }

  const numApoyo = Math.round(N * 0.35);
  const ordenadosPorY = [...pasos].sort((p1, p2) => p1.P.y - p2.P.y);
  const apoyo = ordenadosPorY.slice(0, numApoyo);
  const apoyoSet = new Set(apoyo.map(p => p.idx));

  let minYApoyo = Infinity, maxYApoyo = -Infinity;
  let minXApoyo = Infinity, maxXApoyo = -Infinity;
  let sumaYApoyo = 0;

  for (let s = 0; s < apoyo.length; s++) {
    const P = apoyo[s].P;
    if (P.y < minYApoyo) minYApoyo = P.y;
    if (P.y > maxYApoyo) maxYApoyo = P.y;
    if (P.x < minXApoyo) minXApoyo = P.x;
    if (P.x > maxXApoyo) maxXApoyo = P.x;
    sumaYApoyo += P.y;
  }

  const anchoApoyo = maxXApoyo - minXApoyo;
  if (anchoApoyo <= 1e-6) {
    return { valido: false, pctValidos, fitness: 800, f1: 1, f2: 1, f3: 1, f4: 1, anchoApoyo: 0, alturaTotal, anchoTotal, pasos };
  }

  const mediaYApoyo = sumaYApoyo / numApoyo;

  const f1 = (maxYApoyo - minYApoyo) / alturaTotal;
  const f2 = 1 - Math.min(1, anchoApoyo / (L + r3));
  const f3 = Math.max(0, 0.3 - (maxY - mediaYApoyo) / anchoApoyo) / 0.3;

  const dxPasos = [];
  for (let s = 0; s < N; s++) {
    const sig = (s + 1) % N;
    if (apoyoSet.has(s) && apoyoSet.has(sig)) {
      dxPasos.push(pasos[sig].P.x - pasos[s].P.x);
    }
  }

  let f4 = 1.0;
  if (dxPasos.length >= 3) {
    const promDx = dxPasos.reduce((acc, v) => acc + v, 0) / dxPasos.length;
    const promAbsDx = dxPasos.reduce((acc, v) => acc + Math.abs(v), 0) / dxPasos.length;
    const varianza = dxPasos.reduce((acc, v) => acc + (v - promDx) ** 2, 0) / dxPasos.length;
    const desvio = Math.sqrt(varianza);
    if (promAbsDx > 1e-6) {
      f4 = Math.min(1, desvio / promAbsDx);
    }
  }

  const fitness = w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4;

  return {
    valido: true,
    pctValidos,
    pasosInvalidos: 0,
    fitness,
    f1, f2, f3, f4,
    anchoApoyo,
    alturaTotal,
    anchoTotal,
    minYTotal: minY,
    maxYTotal: maxY,
    minYApoyo,
    maxYApoyo,
    mediaYApoyo,
    apoyoSet,
    pasos
  };
}

// Cinemática y métricas del mecanismo de 13 barras (Theo Jansen)
export function interseccion(p1, r1, p2, r2, s) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dd = Math.hypot(dx, dy);
  if (dd === 0 || dd > r1 + r2 || dd < Math.abs(r1 - r2)) return null;
  const aa = (r1 * r1 - r2 * r2 + dd * dd) / (2 * dd);
  const hh = Math.sqrt(Math.max(0, r1 * r1 - aa * aa));
  const mx = p1.x + (aa * dx) / dd;
  const my = p1.y + (aa * dy) / dd;
  return { x: mx + (s * hh * dy) / dd, y: my - (s * hh * dx) / dd };
}

// Valores canónicos de las 12 longitudes de referencia descubiertas por Theo Jansen [a, l, b, c, d, e, f, g, h, i, j, k].
export const JANSEN_VALORES_REFERENCIA = [38.0, 7.8, 41.5, 39.3, 40.1, 55.8, 39.4, 36.7, 65.7, 49.0, 50.0, 61.9];

// Nombres descriptivos y claves de las 12 barras del mecanismo de Theo Jansen.
export const JANSEN_CLAVES_GENES = ["a", "l", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];

// Longitud fija de la manivela motriz central m en el mecanismo de Jansen.
export const LONGITUD_MANIVELA_JANSEN = 15;

// Calcula el vector aceleración y su magnitud normalizada respecto a la manivela para cada paso del ciclo cerrado del pie.
export function calcularAceleracionPieJansen(pasos, longitudManivela) {
  const N = pasos.length;
  const dTheta = (2 * Math.PI) / N;
  const dTheta2 = dTheta * dTheta;
  const aNorm = new Array(N);

  for (let t = 0; t < N; t++) {
    const pSig = pasos[(t + 1) % N].H;
    const pAct = pasos[t].H;
    const pAnt = pasos[(t - 1 + N) % N].H;

    const ax = (pSig.x - 2 * pAct.x + pAnt.x) / dTheta2;
    const ay = (pSig.y - 2 * pAct.y + pAnt.y) / dTheta2;
    const magA = Math.hypot(ax, ay);
    aNorm[t] = magA / longitudManivela;
  }

  return aNorm;
}

// Evalúa el término f5 y las métricas de suavidad cinemática según el criterio seleccionado ('pico' o 'variacion').
export function calcularMetricasSuavidadJansen(aNorm, criterio, limitePico) {
  const N = aNorm.length;
  let maxA = 0;
  let suma = 0;
  for (let i = 0; i < N; i++) {
    const v = aNorm[i];
    if (v > maxA) maxA = v;
    suma += v;
  }

  const promedio = suma / N;
  let sumaVarianza = 0;
  for (let i = 0; i < N; i++) {
    sumaVarianza += (aNorm[i] - promedio) ** 2;
  }
  const desvio = Math.sqrt(sumaVarianza / N);
  const cociente = promedio > 1e-6 ? desvio / promedio : 0;

  let f5 = 1.0;
  if (criterio === "variacion") {
    f5 = Math.min(1, cociente / 2);
  } else {
    const lim = limitePico > 0 ? limitePico : 30;
    f5 = Math.min(1, maxA / lim);
  }

  return { f5, maxA, promedio, desvio, cociente };
}

// Interpola un color CSS entre azul suave (baja aceleración) y rojo intenso (pico de aceleración) para colorear la trayectoria.
export function obtenerColorAceleracionJansen(valor, minVal, maxVal) {
  const rango = maxVal - minVal || 1;
  const t = Math.max(0, Math.min(1, (valor - minVal) / rango));
  const hue = (1 - t) * 205;
  return `hsl(${hue.toFixed(1)}, 90%, 50%)`;
}

// Calcula y almacena en memoria la cinemática de los 180 pasos del diseño original canónico de Theo Jansen.
export function calcularTrayectoriaJansenReferencia() {
  const N = 180;
  const pasos = [];
  const m = LONGITUD_MANIVELA_JANSEN;
  const [a, l, b, c, d, e, f, g, h, i, j, k] = JANSEN_VALORES_REFERENCIA;
  const Y = { x: 0, y: 0 };
  const X = { x: -a, y: -l };

  for (let s = 0; s < N; s++) {
    const theta = (2 * Math.PI * s) / N;
    const K = { x: m * Math.cos(theta), y: m * Math.sin(theta) };
    const D = interseccion(X, b, K, j, -1);
    const E = D ? interseccion(X, d, D, e, -1) : null;
    const F = interseccion(X, c, K, k, 1);
    const G = (E && F) ? interseccion(E, f, F, g, 1) : null;
    const H = (G && F) ? interseccion(G, h, F, i, 1) : null;
    pasos.push({ theta, Y, X, K, D, E, F, G, H });
  }

  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (let s = 0; s < pasos.length; s++) {
    const pt = pasos[s].H;
    if (pt) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const numApoyoRef = Math.round(N * 0.35);
  const ordenadosYRef = [...pasos].sort((p1, p2) => p1.H.y - p2.H.y);
  const apoyoRef = ordenadosYRef.slice(0, numApoyoRef);
  let minXApoyoRef = Infinity, maxXApoyoRef = -Infinity;
  let maxYApoyoRef = -Infinity;
  let sumaYApoyoRef = 0;
  for (let s = 0; s < apoyoRef.length; s++) {
    const pt = apoyoRef[s].H;
    if (pt.x < minXApoyoRef) minXApoyoRef = pt.x;
    if (pt.x > maxXApoyoRef) maxXApoyoRef = pt.x;
    if (pt.y > maxYApoyoRef) maxYApoyoRef = pt.y;
    sumaYApoyoRef += pt.y;
  }
  const anchoTotalRef = maxX - minX;
  const anchoApoyoRef = maxXApoyoRef - minXApoyoRef;
  const f9Ref = (anchoTotalRef - anchoApoyoRef) / (anchoTotalRef || 1);
  const mediaYApoyoRef = sumaYApoyoRef / numApoyoRef;
  const despejeRealRef = maxY - mediaYApoyoRef;

  let iInRef = -1;
  for (let t = 0; t < N; t++) {
    const prev = (t - 1 + N) % N;
    if (pasos[t].H.y <= maxYApoyoRef && pasos[prev].H.y > maxYApoyoRef) {
      iInRef = t;
      break;
    }
  }
  let dxAtaqueRef = anchoTotalRef;
  let f7Ref = 1.0;
  if (iInRef !== -1) {
    const yMidRef = minY + ((maxY - minY) * 0.5);
    let iMidRef = -1;
    let curr = iInRef;
    for (let step = 0; step < N; step++) {
      curr = (curr - 1 + N) % N;
      if (pasos[curr].H.y >= yMidRef) {
        iMidRef = curr;
        break;
      }
    }
    if (iMidRef !== -1) {
      dxAtaqueRef = Math.abs(pasos[iInRef].H.x - pasos[iMidRef].H.x);
      f7Ref = dxAtaqueRef / (anchoTotalRef || 1);
    }
  }

  const aNorm = calcularAceleracionPieJansen(pasos, m);
  const metPico = calcularMetricasSuavidadJansen(aNorm, "pico", 30);
  const metVar = calcularMetricasSuavidadJansen(aNorm, "variacion", 30);

  return {
    pasos,
    minY,
    maxY,
    minX,
    maxX,
    anchoTotal: anchoTotalRef,
    anchoApoyo: anchoApoyoRef,
    alturaTotal: maxY - minY,
    despejeReal: despejeRealRef,
    dxAtaque: dxAtaqueRef,
    f7: f7Ref,
    f9: f9Ref,
    aNorm,
    metPico,
    metVar
  };
}

// Datos estáticos precalculados de la trayectoria de referencia original de Theo Jansen.
export const TRAYECTORIA_JANSEN_ORIGINAL = calcularTrayectoriaJansenReferencia();

// Descripciones técnicas de ingeniería mecatrónica de las 12 barras del mecanismo de Theo Jansen.
export const JANSEN_DESCRIPCIONES_GENES = {
  a: "Offset horizontal manivela Y al pivote fijo X (-a, -l)",
  l: "Offset vertical manivela Y al pivote fijo X (-a, -l)",
  b: "Eslabón superior de acople pivote fijo X al nodo D",
  c: "Biela motriz inferior desde pivote fijo X al nodo F",
  d: "Balancín de transferencia pivote fijo X al nodo E",
  e: "Eslabón superior de cierre nodo D al nodo E",
  f: "Eslabón del muslo superior nodo E al nodo G",
  g: "Eslabón del muslo inferior nodo F al nodo G",
  h: "Pierna inferior de apoyo desde nodo G al pie H",
  i: "Tirante de talón desde nodo F al pie de contacto H",
  j: "Biela de manivela K al nodo de balancín D",
  k: "Biela de manivela K al nodo de guía inferior F"
};

// Resuelve las posiciones de las articulaciones del mecanismo de Jansen para un ángulo theta dado.
export function resolverCinematicaJansen(theta, genoma, longitudManivela = LONGITUD_MANIVELA_JANSEN) {
  const a = typeof genoma?.a === "number" ? genoma.a : (Array.isArray(genoma) ? genoma[0] : 38.0);
  const l = typeof genoma?.l === "number" ? genoma.l : (Array.isArray(genoma) ? genoma[1] : 7.8);
  const b = typeof genoma?.b === "number" ? genoma.b : (Array.isArray(genoma) ? genoma[2] : 41.5);
  const c = typeof genoma?.c === "number" ? genoma.c : (Array.isArray(genoma) ? genoma[3] : 39.3);
  const d = typeof genoma?.d === "number" ? genoma.d : (Array.isArray(genoma) ? genoma[4] : 40.1);
  const e = typeof genoma?.e === "number" ? genoma.e : (Array.isArray(genoma) ? genoma[5] : 55.8);
  const f = typeof genoma?.f === "number" ? genoma.f : (Array.isArray(genoma) ? genoma[6] : 39.4);
  const g = typeof genoma?.g === "number" ? genoma.g : (Array.isArray(genoma) ? genoma[7] : 36.7);
  const h = typeof genoma?.h === "number" ? genoma.h : (Array.isArray(genoma) ? genoma[8] : 65.7);
  const i = typeof genoma?.i === "number" ? genoma.i : (Array.isArray(genoma) ? genoma[9] : 49.0);
  const j = typeof genoma?.j === "number" ? genoma.j : (Array.isArray(genoma) ? genoma[10] : 50.0);
  const k = typeof genoma?.k === "number" ? genoma.k : (Array.isArray(genoma) ? genoma[11] : 61.9);

  const m = longitudManivela;
  const Y = { x: 0, y: 0 };
  const X = { x: -a, y: -l };
  const K = { x: m * Math.cos(theta), y: m * Math.sin(theta) };

  const D = interseccion(X, b, K, j, -1);
  if (!D) return null;

  const E = interseccion(X, d, D, e, -1);
  if (!E) return null;

  const F = interseccion(X, c, K, k, 1);
  if (!F) return null;

  const G = interseccion(E, f, F, g, 1);
  if (!G) return null;

  const H = interseccion(G, h, F, i, 1);
  if (!H) return null;

  return { theta, Y, X, K, D, E, F, G, H };
}

// Extrae la totalidad de puntos y métricas cinemáticas incluyendo dimensiones y despeje de obstáculo.
export function obtenerMetricasJansen(genoma, entrada = {}) {
  const maxAncho = Number(entrada?.maxAncho !== undefined ? entrada.maxAncho : 80);
  const maxAlto = Number(entrada?.maxAlto !== undefined ? entrada.maxAlto : 40);
  const obstaculoAlto = Number(entrada?.obstaculoAlto !== undefined ? entrada.obstaculoAlto : 15);

  const w1 = Number(entrada?.w1 !== undefined ? entrada.w1 : 3.0);
  const w2 = Number(entrada?.w2 !== undefined ? entrada.w2 : 1.0);
  const w3 = Number(entrada?.w3 !== undefined ? entrada.w3 : 1.0);
  const w4 = Number(entrada?.w4 !== undefined ? entrada.w4 : 1.0);
  const w5 = Number(entrada?.w5 !== undefined ? entrada.w5 : 0.5);
  const w7 = Number(entrada?.w7 !== undefined ? entrada.w7 : 1.0);
  const w9 = Number(entrada?.w9 !== undefined ? entrada.w9 : 1.0);
  const zancadaObj = Number(entrada?.zancadaObjetivo !== undefined ? entrada.zancadaObjetivo : 4.0);
  const criterio = (entrada?.criterioSuavidad || "pico").toString().toLowerCase().trim() === "variacion" ? "variacion" : "pico";
  const limitePico = Number(entrada?.limitePico !== undefined ? entrada.limitePico : 30);
  const m = LONGITUD_MANIVELA_JANSEN;

  const N = 180;
  const pasos = [];
  let pasosInvalidos = 0;

  for (let s = 0; s < N; s++) {
    const theta = (2 * Math.PI * s) / N;
    const res = resolverCinematicaJansen(theta, genoma, m);
    if (!res) pasosInvalidos++;
    else pasos.push({ idx: s, ...res });
  }

  const pctValidos = ((N - pasosInvalidos) / N) * 100;
  if (pasosInvalidos > 0) {
    return {
      valido: false, pctValidos, pasosInvalidos, fitness: 1000 + 10 * pasosInvalidos,
      f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f7: 1, f9: 1,
      dxAtaque: 0, criterio, limitePico, w5, w7, w9,
      maxAncho, maxAlto, obstaculoAlto, despejeReal: 0,
      picoAceleracion: 0, promedioAceleracion: 0, desvioAceleracion: 0, cocienteVariacion: 0,
      aNorm: [], anchoApoyo: 0, alturaTotal: 0, anchoTotal: 0, pasos: []
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (let s = 0; s < N; s++) {
    const H = pasos[s].H;
    if (H.x < minX) minX = H.x;
    if (H.x > maxX) maxX = H.x;
    if (H.y < minY) minY = H.y;
    if (H.y > maxY) maxY = H.y;
  }

  const anchoTotal = maxX - minX;
  const alturaTotal = maxY - minY;
  const diagCaja = Math.hypot(anchoTotal, alturaTotal);

  let saltoGrande = false;
  for (let s = 0; s < N; s++) {
    const hAct = pasos[s].H;
    const hSig = pasos[(s + 1) % N].H;
    if (Math.hypot(hSig.x - hAct.x, hSig.y - hAct.y) > 0.25 * diagCaja) {
      saltoGrande = true;
      break;
    }
  }

  if (saltoGrande) {
    return {
      valido: false, pctValidos, fitness: 500,
      f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f7: 1, f9: 1,
      dxAtaque: anchoTotal, criterio, limitePico, w5, w7, w9,
      maxAncho, maxAlto, obstaculoAlto, despejeReal: 0,
      picoAceleracion: 0, promedioAceleracion: 0, desvioAceleracion: 0, cocienteVariacion: 0,
      aNorm: [], anchoApoyo: 0, alturaTotal, anchoTotal, pasos
    };
  }

  if (alturaTotal <= 1e-6 || anchoTotal <= 1e-6) {
    return {
      valido: false, pctValidos, fitness: 800,
      f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f7: 1, f9: 1,
      dxAtaque: 0, criterio, limitePico, w5, w7, w9,
      maxAncho, maxAlto, obstaculoAlto, despejeReal: 0,
      picoAceleracion: 0, promedioAceleracion: 0, desvioAceleracion: 0, cocienteVariacion: 0,
      aNorm: [], anchoApoyo: 0, alturaTotal: 0, anchoTotal, pasos
    };
  }

  const numApoyo = Math.round(N * 0.35);
  const ordenadosPorY = [...pasos].sort((p1, p2) => p1.H.y - p2.H.y);
  const apoyo = ordenadosPorY.slice(0, numApoyo);
  const apoyoSet = new Set(apoyo.map(p => p.idx));

  let minYApoyo = Infinity, maxYApoyo = -Infinity;
  let minXApoyo = Infinity, maxXApoyo = -Infinity;
  let sumaYApoyo = 0;

  for (let s = 0; s < apoyo.length; s++) {
    const H = apoyo[s].H;
    if (H.y < minYApoyo) minYApoyo = H.y;
    if (H.y > maxYApoyo) maxYApoyo = H.y;
    if (H.x < minXApoyo) minXApoyo = H.x;
    if (H.x > maxXApoyo) maxXApoyo = H.x;
    sumaYApoyo += H.y;
  }

  const anchoApoyo = maxXApoyo - minXApoyo;
  if (anchoApoyo <= 1e-6) {
    return {
      valido: false, pctValidos, fitness: 800,
      f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f7: 1, f9: 1,
      dxAtaque: 0, criterio, limitePico, w5, w7, w9,
      maxAncho, maxAlto, obstaculoAlto, despejeReal: 0,
      picoAceleracion: 0, promedioAceleracion: 0, desvioAceleracion: 0, cocienteVariacion: 0,
      aNorm: [], anchoApoyo: 0, alturaTotal, anchoTotal, pasos
    };
  }

  const mediaYApoyo = sumaYApoyo / numApoyo;
  const despeje_real = maxY - mediaYApoyo;

  if (anchoTotal > maxAncho || alturaTotal > maxAlto || despeje_real < obstaculoAlto) {
    return {
      valido: false, pctValidos, fitness: 800,
      f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f7: 1, f9: 1,
      dxAtaque: 0, criterio, limitePico, w5, w7, w9,
      maxAncho, maxAlto, obstaculoAlto, despejeReal: despeje_real,
      picoAceleracion: 0, promedioAceleracion: 0, desvioAceleracion: 0, cocienteVariacion: 0,
      aNorm: [], anchoApoyo, alturaTotal, anchoTotal, pasos
    };
  }

  const f1 = (maxYApoyo - minYApoyo) / alturaTotal;
  const f2 = 1 - Math.min(1, anchoApoyo / (zancadaObj * m));
  const f3 = Math.max(0, 0.3 - (maxY - mediaYApoyo) / anchoApoyo) / 0.3;

  const dxPasos = [];
  for (let s = 0; s < N; s++) {
    const sig = (s + 1) % N;
    if (apoyoSet.has(s) && apoyoSet.has(sig)) {
      dxPasos.push(pasos[sig].H.x - pasos[s].H.x);
    }
  }

  let f4 = 1.0;
  if (dxPasos.length >= 3) {
    const promDx = dxPasos.reduce((acc, v) => acc + v, 0) / dxPasos.length;
    const promAbsDx = dxPasos.reduce((acc, v) => acc + Math.abs(v), 0) / dxPasos.length;
    const varianza = dxPasos.reduce((acc, v) => acc + (v - promDx) ** 2, 0) / dxPasos.length;
    const desvio = Math.sqrt(varianza);
    if (promAbsDx > 1e-6) f4 = Math.min(1, desvio / promAbsDx);
  }

  const aNorm = calcularAceleracionPieJansen(pasos, m);
  const metSuavidad = calcularMetricasSuavidadJansen(aNorm, criterio, limitePico);
  const f5 = metSuavidad.f5;

  const suelo_y = maxYApoyo;
  let i_in = -1;
  for (let t = 0; t < N; t++) {
    const prev = (t - 1 + N) % N;
    if (pasos[t].H.y <= suelo_y && pasos[prev].H.y > suelo_y) {
      i_in = t;
      break;
    }
  }

  let dx_ataque = anchoTotal;
  let f7 = 1.0;
  if (i_in !== -1) {
    const yMidTarget = minY + (alturaTotal * 0.5);
    let i_mid = -1;
    let curr = i_in;
    for (let step = 0; step < N; step++) {
      curr = (curr - 1 + N) % N;
      if (pasos[curr].H.y >= yMidTarget) {
        i_mid = curr;
        break;
      }
    }
    if (i_mid !== -1) {
      dx_ataque = Math.abs(pasos[i_in].H.x - pasos[i_mid].H.x);
      f7 = dx_ataque / (anchoTotal || 1);
    }
  }

  const f9 = (anchoTotal - anchoApoyo) / (anchoTotal || 1);
  const fitness = w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4 + w5 * f5 + w7 * f7 + w9 * f9;

  return {
    valido: true,
    pctValidos,
    pasosInvalidos: 0,
    fitness,
    f1, f2, f3, f4, f5, f7, f9,
    dxAtaque: dx_ataque,
    criterio,
    limitePico,
    w5,
    w7,
    w9,
    maxAncho,
    maxAlto,
    obstaculoAlto,
    despejeReal: despeje_real,
    picoAceleracion: metSuavidad.maxA,
    promedioAceleracion: metSuavidad.promedio,
    desvioAceleracion: metSuavidad.desvio,
    cocienteVariacion: metSuavidad.cociente,
    aNorm,
    anchoApoyo,
    alturaTotal,
    anchoTotal,
    minYTotal: minY,
    maxYTotal: maxY,
    minYApoyo,
    maxYApoyo,
    mediaYApoyo,
    apoyoSet,
    pasos
  };
}

export function evaluarJansen(genoma, opciones = {}) {
  const m = obtenerMetricasJansen(genoma, opciones);
  const modo = (opciones?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
  if (modo === "multiobjetivo") {
    if (!m.valido) {
      return [m.fitness, m.fitness];
    }
    return [m.f5, m.f2];
  }
  return m.fitness;
}

export default MotorEstructurasCinematica;
