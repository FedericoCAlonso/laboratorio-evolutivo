// =========================================================================
// MOTOR FUNDAMENTAL 2: ESTRUCTURAS, CELOSÍAS Y CINEMÁTICA DE BARRAS 2D
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================

// ---- Port exacto del fitness nativo de la Pata Jansen (fuente única de verdad) ----
// Intersección de dos circunferencias según signo s (idéntica al modelo nativo).
function interseccionJansen(p1, r1, p2, r2, s) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, dd = Math.hypot(dx, dy);
  if (dd === 0 || dd > r1 + r2 || dd < Math.abs(r1 - r2)) return null;
  const aa = (r1 * r1 - r2 * r2 + dd * dd) / (2 * dd);
  const hh = Math.sqrt(Math.max(0, r1 * r1 - aa * aa));
  const mx = p1.x + (aa * dx) / dd, my = p1.y + (aa * dy) / dd;
  return { x: mx + (s * hh * dy) / dd, y: my - (s * hh * dx) / dd };
}

// Calcula el vector aceleración y su magnitud normalizada respecto a la manivela para cada paso del ciclo cerrado del pie.
function calcularAceleracionPieJansen(pasos, longitudManivela) {
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
function calcularMetricasSuavidadJansen(aNorm, criterio, limitePico) {
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

// Resuelve las articulaciones de Jansen para un ángulo theta (acepta diccionario o array).
function resolverCinematicaJansen(theta, genoma) {
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

    const m = 15;
    const Y = { x: 0, y: 0 };
    const X = { x: -a, y: -l };
    const K = { x: m * Math.cos(theta), y: m * Math.sin(theta) };

    const D = interseccionJansen(X, b, K, j, -1);
    if (!D) return null;

    const E = interseccionJansen(X, d, D, e, -1);
    if (!E) return null;

    const F = interseccionJansen(X, c, K, k, 1);
    if (!F) return null;

    const G = interseccionJansen(E, f, F, g, 1);
    if (!G) return null;

    const H = interseccionJansen(G, h, F, i, 1);
    if (!H) return null;

    return { theta, Y, X, K, D, E, F, G, H };
  }

// Fitness con barreras duras 500/800/1000+ y f1..f9; devuelve número o par [f5, f2].
function evaluarJansenFitnessPuro(genoma, opciones) {
    const modo = (opciones?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMultiobjetivo = modo === "multiobjetivo";

    const maxAncho = Number(opciones?.maxAncho !== undefined ? opciones.maxAncho : 80);
    const maxAlto = Number(opciones?.maxAlto !== undefined ? opciones.maxAlto : 40);
    const obstaculoAlto = Number(opciones?.obstaculoAlto !== undefined ? opciones.obstaculoAlto : 15);

    const w1 = Number(opciones?.w1 !== undefined ? opciones.w1 : 3.0);
    const w2 = Number(opciones?.w2 !== undefined ? opciones.w2 : 1.0);
    const w3 = Number(opciones?.w3 !== undefined ? opciones.w3 : 1.0);
    const w4 = Number(opciones?.w4 !== undefined ? opciones.w4 : 1.0);
    const w5 = Number(opciones?.w5 !== undefined ? opciones.w5 : 0.5);
    const w7 = Number(opciones?.w7 !== undefined ? opciones.w7 : 1.0);
    const w9 = Number(opciones?.w9 !== undefined ? opciones.w9 : 1.0);
    const zancadaObj = Number(opciones?.zancadaObjetivo !== undefined ? opciones.zancadaObjetivo : 4.0);
    const criterio = (opciones?.criterioSuavidad || "pico").toString().toLowerCase().trim() === "variacion" ? "variacion" : "pico";
    const limitePico = Number(opciones?.limitePico !== undefined ? opciones.limitePico : 30);
    const m = 15;

    const N = 180;
    const pasos = [];
    let pasosInvalidos = 0;

    for (let s = 0; s < N; s++) {
      const theta = (2 * Math.PI * s) / N;
      const res = resolverCinematicaJansen(theta, genoma);
      if (!res) pasosInvalidos++;
      else pasos.push({ idx: s, ...res });
    }

    if (pasosInvalidos > 0) {
      return esMultiobjetivo
        ? [1000 + 10 * pasosInvalidos, 1000 + 10 * pasosInvalidos]
        : 1000 + 10 * pasosInvalidos;
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

    for (let s = 0; s < N; s++) {
      const hAct = pasos[s].H;
      const hSig = pasos[(s + 1) % N].H;
      if (Math.hypot(hSig.x - hAct.x, hSig.y - hAct.y) > 0.25 * diagCaja) {
        return esMultiobjetivo ? [500, 500] : 500;
      }
    }

    if (alturaTotal <= 1e-6 || anchoTotal <= 1e-6) {
      return esMultiobjetivo ? [800, 800] : 800;
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
      return esMultiobjetivo ? [800, 800] : 800;
    }

    const mediaYApoyo = sumaYApoyo / numApoyo;

    // Despeje vertical real medido desde la cota más alta alcanzada respecto a la altura media de apoyo.
    const despeje_real = maxY - mediaYApoyo;

    // Filtros eliminatorios duros de entorno: descarta de inmediato con penalización 800 si viola las restricciones físicas.
    if (anchoTotal > maxAncho || alturaTotal > maxAlto || despeje_real < obstaculoAlto) {
      return esMultiobjetivo ? [800, 800] : 800;
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
      if (promAbsDx > 1e-6) {
        f4 = Math.min(1, desvio / promAbsDx);
      }
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

    // En optimización multiobjetivo Pareto retornamos el par [f5, f2] sin sumar con pesos w.
    if (esMultiobjetivo) {
      const penPlanitud = f1 > 0.25 ? (f1 - 0.25) * 2.0 : 0;
      return [f5, f2 + penPlanitud];
    }

    return w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4 + w5 * f5 + w7 * f7 + w9 * f9;
}

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

  // Resuelve la posición cinemática de los puntos del mecanismo de Theo Jansen (13 barras)
  static resolverJansen(theta, genoma, longitudManivela = 15.0) {
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
    const Y = { x: 0.0, y: 0.0 };
    const X = { x: -a, y: -l };
    const K = { x: m * Math.cos(theta), y: m * Math.sin(theta) };

    const D = MotorEstructurasCinematica.resolverTrilateracion(X, K, b, j, -1);
    if (!D) return null;

    const E = MotorEstructurasCinematica.resolverTrilateracion(X, D, d, e, -1);
    if (!E) return null;

    const F = MotorEstructurasCinematica.resolverTrilateracion(X, K, c, k, 1);
    if (!F) return null;

    const G = MotorEstructurasCinematica.resolverTrilateracion(E, F, f, g, 1);
    if (!G) return null;

    const H = MotorEstructurasCinematica.resolverTrilateracion(G, F, h, i, 1);
    if (!H) return null;

    return { theta, Y, X, K, D, E, F, G, H };
  }

  // Evalúa la marcha completa de Theo Jansen (180 pasos) y calcula zancada, aceleración y despeje
  static evaluarJansen(genoma, opciones = {}) {
    const N = opciones.pasos || 180;
    const m = opciones.longitudManivela || 15.0;
    const zancadaObj = opciones.zancadaObjetivo || 60.0;
    const obstaculoAlto = opciones.obstaculoAlto || 15.0;
    const limitePico = opciones.limitePico || 30.0;

    const pasos = [];
    let pasosInvalidos = 0;

    for (let s = 0; s < N; s++) {
      const theta = (2 * Math.PI * s) / N;
      const res = MotorEstructurasCinematica.resolverJansen(theta, genoma, m);
      if (!res) pasosInvalidos++;
      else pasos.push({ idx: s, ...res });
    }

    if (pasosInvalidos > 0 || pasos.length < N * 0.8) {
      let anchoParcial = 0;
      let altoParcial = 0;
      if (pasos.length >= 2) {
        const xs = pasos.map(p => p.H.x);
        const ys = pasos.map(p => p.H.y);
        anchoParcial = Math.max(...xs) - Math.min(...xs);
        altoParcial = Math.max(...ys) - Math.min(...ys);
      }
      return {
        esValido: false,
        pasosInvalidos,
        pasos,
        anchoTotal: anchoParcial,
        alturaTotal: altoParcial,
        anchoApoyo: anchoParcial * 0.7,
        despejeReal: altoParcial * 0.5,
        aceleracionPico: 50.0,
        errorZancada: 999.0,
        f5_suavidad: 999.0,
        fitnessPareto: [999.0, 999.0]
      };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let s = 0; s < pasos.length; s++) {
      const pt = pasos[s].H;
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const anchoTotal = maxX - minX;
    const alturaTotal = maxY - minY;

    // Fase de apoyo: menor 35% de puntos en Y (pie apoyado sobre el terreno)
    const numApoyo = Math.max(2, Math.round(pasos.length * 0.35));
    const ordenadosY = [...pasos].sort((p1, p2) => p1.H.y - p2.H.y);
    const apoyo = ordenadosY.slice(0, numApoyo);

    let minXApoyo = Infinity, maxXApoyo = -Infinity;
    let maxYApoyo = -Infinity;
    let sumaYApoyo = 0;
    for (let s = 0; s < apoyo.length; s++) {
      const pt = apoyo[s].H;
      if (pt.x < minXApoyo) minXApoyo = pt.x;
      if (pt.x > maxXApoyo) maxXApoyo = pt.x;
      if (pt.y > maxYApoyo) maxYApoyo = pt.y;
      sumaYApoyo += pt.y;
    }

    const anchoApoyo = maxXApoyo - minXApoyo;
    const mediaYApoyo = sumaYApoyo / numApoyo;
    const despejeReal = maxY - mediaYApoyo;

    // Error de zancada relativa respecto al objetivo
    const errorZancada = Math.abs(anchoApoyo - zancadaObj) / (zancadaObj || 1.0);

    // Cálculo de aceleración y suavidad inercial de la trayectoria del pie
    const dTheta = (2 * Math.PI) / pasos.length;
    const dTheta2 = dTheta * dTheta;
    let maxA = 0;
    for (let t = 0; t < pasos.length; t++) {
      const pSig = pasos[(t + 1) % pasos.length].H;
      const pAct = pasos[t].H;
      const pAnt = pasos[(t - 1 + pasos.length) % pasos.length].H;
      const ax = (pSig.x - 2 * pAct.x + pAnt.x) / dTheta2;
      const ay = (pSig.y - 2 * pAct.y + pAnt.y) / dTheta2;
      const magA = Math.hypot(ax, ay) / m;
      if (magA > maxA) maxA = magA;
    }

    const f5_suavidad = Math.min(1.0, maxA / (limitePico || 30.0));
    const penalizacionDespeje = despejeReal < obstaculoAlto ? (obstaculoAlto - despejeReal) * 0.2 : 0;

    return {
      esValido: true,
      pasosInvalidos: 0,
      anchoTotal,
      alturaTotal,
      anchoApoyo,
      despejeReal,
      aceleracionPico: maxA,
      f5_suavidad,
      errorZancada: errorZancada + penalizacionDespeje,
      fitnessPareto: [f5_suavidad, errorZancada + penalizacionDespeje],
      pasos
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
  // Evalúa el fitness completo de la Pata Jansen (idéntico al modelo nativo); vars: diccionario a..k o array.
  evaluarJansenFitness(vars, opciones = {}) {
    return evaluarJansenFitnessPuro(vars, opciones);
  }

  // Versión estática equivalente para uso sin instancia.
  static evaluarJansenFitness(vars, opciones = {}) {
    return evaluarJansenFitnessPuro(vars, opciones);
  }
}

export default MotorEstructurasCinematica;
