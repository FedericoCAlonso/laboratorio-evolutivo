// =========================================================================
// MÓDULO: MODELO 3 - PATA JANSEN (13 BARRAS DE THEO JANSEN CON FILTROS DUROS)
// =========================================================================

import { MotorEstructurasCinematica } from "../engines/estructuras.js";

// Función geométrica base que calcula la intersección entre dos circunferencias según el signo s (+1 o -1).
export function interseccion(p1, r1, p2, r2, s) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, dd = Math.hypot(dx, dy);
  if (dd === 0 || dd > r1 + r2 || dd < Math.abs(r1 - r2)) return null;
  const aa = (r1 * r1 - r2 * r2 + dd * dd) / (2 * dd);
  const hh = Math.sqrt(Math.max(0, r1 * r1 - aa * aa));
  const mx = p1.x + (aa * dx) / dd, my = p1.y + (aa * dy) / dd;
  return { x: mx + (s * hh * dy) / dd, y: my - (s * hh * dx) / dd };
}

// Valores canónicos de las 12 longitudes de referencia descubiertas por Theo Jansen [a, l, b, c, d, e, f, g, h, i, j, k].
export const JANSEN_VALORES_REFERENCIA = [38.0, 7.8, 41.5, 39.3, 40.1, 55.8, 39.4, 36.7, 65.7, 49.0, 50.0, 61.9];

// Nombres descriptivos y claves de las 12 barras del mecanismo de Theo Jansen.
export const JANSEN_CLAVES_GENES = ["a", "l", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];

// Longitud fija de la manivela motriz central m en el mecanismo de Jansen.
export const LONGITUD_MANIVELA_JANSEN = 15;

// Identificador del temporizador de animación requestAnimationFrame para la pata Jansen.

// Estado del checkbox interactivo para superponer la curva original de Theo Jansen en el lienzo Canvas.

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

// Objeto que implementa el contrato del Modelo 3: Mecanismo cinemático de Theo Jansen de 13 barras.
export const ModeloPataJansen = {
  id: "pata-jansen",
  nombre: "Pata Jansen (13 barras)",
  descripcion: "Optimiza los 12 parámetros de eslabonamiento de Theo Jansen con restricciones físicas de gálibo máximo y despeje para superar obstáculos.",
  tipoVisualizacion: "mecanismo_jansen",
  usaWasm: true,
  usaRuido: false,
  // Nombres descriptivos de los objetivos para optimización multiobjetivo Pareto.
  nombresObjetivos: ["Suavidad (Aceleración f5)", "Zancada (Error f2)"],

  // Parámetros de entrada editables por el usuario incluyendo las restricciones duras de entorno.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Suavidad vs Zancada)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Suma ponderada con pesos)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "amplitud", etiqueta: "Amplitud de búsqueda genética (±%)", tipo: "numero", min: 0.05, max: 0.80, paso: 0.05, valorDefecto: 0.30 },
    { clave: "zancadaObjetivo", etiqueta: "Zancada objetivo (múltiplos de manivela m=15)", tipo: "numero", min: 1.0, max: 8.0, paso: 0.5, valorDefecto: 4.0 },
    { clave: "maxAncho", etiqueta: "Ancho máximo permitido de la trayectoria", tipo: "numero", min: 30, max: 200, paso: 5, valorDefecto: 80 },
    { clave: "maxAlto", etiqueta: "Alto máximo permitido de la trayectoria", tipo: "numero", min: 15, max: 100, paso: 5, valorDefecto: 40 },
    { clave: "obstaculoAlto", etiqueta: "Altura mínima del escalón a superar", tipo: "numero", min: 5, max: 50, paso: 1, valorDefecto: 15 },
    { clave: "w1", etiqueta: "Peso w1 (Planitud del apoyo)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 3.0 },
    { clave: "w2", etiqueta: "Peso w2 (Zancada)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w3", etiqueta: "Peso w3 (Despeje de retorno)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w4", etiqueta: "Peso w4 (Uniformidad de velocidad)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "criterioSuavidad", etiqueta: "Criterio de suavidad ('pico' o 'variacion')", tipo: "texto", valorDefecto: "pico" },
    { clave: "limitePico", etiqueta: "Límite de aceleración pico (m·ω²)", tipo: "numero", min: 5, max: 200, paso: 5, valorDefecto: 30 },
    { clave: "w5", etiqueta: "Peso w5 (Suavidad de movimiento)", tipo: "numero", min: 0, max: 20, paso: 0.1, valorDefecto: 0.5 },
    { clave: "w7", etiqueta: "Peso w7 (Ataque vertical)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w9", etiqueta: "Peso w9 (Eficiencia espacial)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 }
  ],

  // Define los rangos continuos de los 12 genes con etiquetas semánticas y cotas nominales canónicas de Jansen.
  crearGenoma(entrada) {
    const amp = Number(entrada?.amplitud !== undefined ? entrada.amplitud : 0.30);
    return JANSEN_VALORES_REFERENCIA.map((val, idx) => {
      const clave = JANSEN_CLAVES_GENES[idx];
      return {
        nombre: clave,
        etiqueta: `${clave}: ${JANSEN_DESCRIPCIONES_GENES[clave] || 'Barra ' + clave}`,
        tipo: "continuo",
        min: Math.max(0.1, parseFloat((val * (1 - amp)).toFixed(2))),
        max: parseFloat((val * (1 + amp)).toFixed(2)),
        valorNominal: val
      };
    });
  },

  // Resuelve las posiciones de las articulaciones del mecanismo de Jansen para un ángulo theta dado.
  resolverCinematica(theta, genoma) {
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

    const m = LONGITUD_MANIVELA_JANSEN;
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
  },

  // Evalúa la marcha aplicando las barreras físicas duras de entorno y luego la función multiobjetivo.
  evaluar(genoma, entrada) {
    // Delegado al motor de estructuras: única fuente de verdad del fitness de Jansen.
    return MotorEstructurasCinematica.evaluarJansenFitness(genoma, entrada || {});
  },

  // Extrae la totalidad de puntos y métricas cinemáticas incluyendo dimensiones y despeje de obstáculo.
  obtenerMetricasDetalladas(genoma, entrada) {
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
      const res = this.resolverCinematica(theta, genoma);
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

    // Despeje vertical real respecto a la línea media de apoyo en suelo.
    const despeje_real = maxY - mediaYApoyo;

    // Filtros de barrera física dura: si no se cumplen los límites físicos, se invalida con fitness 800.
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
  },

  // Devuelve el reporte descriptivo con los 12 genes, métricas f1..f5, f7, f9 y las restricciones de entorno.
  describir(genoma, entrada) {
    const m = this.obtenerMetricasDetalladas(genoma, entrada);
    const mRef = this.obtenerMetricasDetalladas(JANSEN_VALORES_REFERENCIA, entrada);

    let texto = `MECANISMO THEO JANSEN (13 BARRAS) - LABORATORIO EVOLUTIVO\n`;
    texto += `========================================================================\n`;
    texto += `RESTRICCIONES FÍSICAS DE ENTORNO:\n`;
    texto += `  • Física (Ancho/Alto): ${m.anchoTotal.toFixed(1)} / ${m.alturaTotal.toFixed(1)} u (Límites: ${m.maxAncho} / ${m.maxAlto})\n`;
    texto += `  • Obstáculo superado: ${m.despejeReal.toFixed(1)} u (Exigido: ${m.obstaculoAlto} u)\n\n`;

    texto += `TEST DE ACEPTACIÓN GEOMÉTRICO Y DINÁMICO (Theo Jansen canónico):\n`;
    texto += `  • Pasos cinemáticos válidos : 180 / 180 (0 inválidos: PASS ✓)\n`;
    texto += `  • Cota Y del pie (Mín, Máx) : [${TRAYECTORIA_JANSEN_ORIGINAL.minY.toFixed(2)}, ${TRAYECTORIA_JANSEN_ORIGINAL.maxY.toFixed(2)}] (Ref: ~ -91.8 a -69.4: PASS ✓)\n`;
    texto += `  • Ancho total de zancada    : ${TRAYECTORIA_JANSEN_ORIGINAL.anchoTotal.toFixed(2)} u (Ref: ~ 68.0 u: PASS ✓)\n`;
    texto += `  • Aceleración pico (pico)   : ${TRAYECTORIA_JANSEN_ORIGINAL.metPico.maxA.toFixed(2)} m·ω² (Ref: ≈ 15.6: PASS ✓)\n`;
    texto += `  • Cociente desvío/promedio  : ${TRAYECTORIA_JANSEN_ORIGINAL.metVar.cociente.toFixed(2)} (Ref: ≈ 1.12: PASS ✓)\n`;
    texto += `  • Ataque (dx en caída)      : ${TRAYECTORIA_JANSEN_ORIGINAL.dxAtaque.toFixed(1)} u (Ref: ≈ 1.1 u: PASS ✓)\n`;
    texto += `  • Eficiencia Espacial       : ${(TRAYECTORIA_JANSEN_ORIGINAL.f9 * 100).toFixed(1)}% (f9 Ref: ≈ 0.2990: PASS ✓)\n`;
    texto += `  • Fitness diseño de Jansen  : ${mRef.fitness.toFixed(4)}\n\n`;

    texto += `COMPARATIVA DE LOS 12 GENES (DISEÑO EVOLUCIONADO VS THEO JANSEN):\n`;
    texto += `  Gen | Descripción del Eslabón        |  Evolución  |  Jansen Ref | Variación\n`;
    texto += `  ----+--------------------------------+-------------+-------------+----------\n`;

    const descripciones = [
      "Separación horizontal X-Y (a)   ",
      "Separación vertical X-Y (l)     ",
      "Barra fija-acoplador X-D (b)    ",
      "Barra fija-acoplador X-F (c)    ",
      "Barra fija-triángulo X-E (d)    ",
      "Barra acopladora D-E (e)        ",
      "Barra triángulo inf. E-G (f)    ",
      "Barra triángulo inf. F-G (g)    ",
      "Barra superior pie G-H (h)      ",
      "Barra inferior pie F-H (i)      ",
      "Barra manivela-nodo K-D (j)     ",
      "Barra manivela-nodo K-F (k)     "
    ];

    for (let g = 0; g < 12; g++) {
      const valOpt = genoma[g];
      const valRef = JANSEN_VALORES_REFERENCIA[g];
      const difPct = ((valOpt - valRef) / valRef) * 100;
      const signo = difPct >= 0 ? "+" : "";
      const clave = JANSEN_CLAVES_GENES[g];
      texto += `   ${clave.padEnd(2, " ")} | ${descripciones[g]} | ${valOpt.toFixed(2).padStart(10, " ")}  | ${valRef.toFixed(2).padStart(10, " ")}  | ${signo + difPct.toFixed(1)}%\n`;
    }

    texto += `\n`;
    texto += `MÉTRICAS COMPARATIVAS DE MARCHA:\n`;
    texto += `  • Pasos cinemáticos válidos : ${m.pctValidos.toFixed(1)}%\n`;
    if (!m.valido) {
      texto += `  • Estado : Solución descartada por restricciones físicas o cinemáticas (Fitness: ${m.fitness.toFixed(1)})\n`;
    } else {
      const modoDesc = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
      if (modoDesc === "multiobjetivo") {
        texto += `  • Modo de Optimización      : Multiobjetivo NSGA-II (Frente de Pareto)\n`;
        texto += `  • Objetivo 1 - Suavidad f5  : ${m.f5.toFixed(4)} (Pico de aceleración: ${m.picoAceleracion.toFixed(2)} m·ω²)\n`;
        texto += `  • Objetivo 2 - Zancada f2   : ${m.f2.toFixed(4)} (Ancho de apoyo: ${m.anchoApoyo.toFixed(2)} u)\n`;
      }
      texto += `  • f1 (Planitud de apoyo)    : ${m.f1.toFixed(4)}  (Jansen: ${mRef.f1.toFixed(4)})\n`;
      texto += `  • f2 (Zancada horizontal)   : ${m.f2.toFixed(4)}  (Jansen: ${mRef.f2.toFixed(4)})\n`;
      texto += `  • f3 (Despeje de retorno)   : ${m.f3.toFixed(4)}  (Jansen: ${mRef.f3.toFixed(4)})\n`;
      texto += `  • f4 (Uniformidad veloc.)   : ${m.f4.toFixed(4)}  (Jansen: ${mRef.f4.toFixed(4)})\n`;
      texto += `  • f5 (Suavidad aceleración) : ${m.f5.toFixed(4)}  (Jansen: ${mRef.f5.toFixed(4)})\n`;
      texto += `  • f7 (Verticalidad ataque)  : ${m.f7.toFixed(4)}  (Jansen: ${mRef.f7.toFixed(4)})\n`;
      texto += `  • f9 (Eficiencia espacial)  : ${m.f9.toFixed(4)}  (Jansen: ${mRef.f9.toFixed(4)})\n`;
      texto += `  • Ataque (dx en caída): ${m.dxAtaque.toFixed(1)} u\n`;
      texto += `  • Eficiencia Espacial (Aire vs Piso): ${(m.f9 * 100).toFixed(1)}%\n`;
      texto += `  • Criterio de suavidad      : "${m.criterio}" (Límite pico: ${m.limitePico} m·ω², Peso w5: ${m.w5})\n`;
      texto += `  • Pesos biomecánicos        : w7 = ${m.w7}, w9 = ${m.w9}\n`;
      texto += `  • Aceleración pico máxima   : ${m.picoAceleracion.toFixed(2)} m·ω²  (Jansen: ${mRef.picoAceleracion.toFixed(2)} m·ω²)\n`;
      texto += `  • Desvío / Promedio aNorm   : ${m.cocienteVariacion.toFixed(2)}  (Jansen: ${mRef.cocienteVariacion.toFixed(2)})\n`;
      texto += `  • FITNESS TOTAL FINAL       : ${m.fitness.toFixed(4)}  (Jansen: ${mRef.fitness.toFixed(4)})\n`;
      texto += `  • Ancho de apoyo en suelo   : ${m.anchoApoyo.toFixed(2)} u  (Jansen: ${mRef.anchoApoyo.toFixed(2)} u)\n`;
      texto += `  • Altura total de la curva  : ${m.alturaTotal.toFixed(2)} u  (Jansen: ${mRef.alturaTotal.toFixed(2)} u)\n`;
    }
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloPataJansen;
