// =========================================================================
// MÓDULO: MODELO 2 - PATA CAMINANTE (MECANISMO DE CUATRO BARRAS)
// =========================================================================

// Objeto que implementa el contrato del Modelo 2: Mecanismo de cuatro barras para pata caminante.
export const ModeloPataCaminante = {
  // Identificador único del modelo.
  id: "pata-caminante",
  // Nombre legible para mostrar en el selector de la interfaz.
  nombre: "Pata caminante (cuatro barras)",
  // Descripción técnica del objetivo de optimización del mecanismo.
  descripcion: "Optimiza un mecanismo de cuatro barras para que el pie describa una marcha con apoyo horizontal plano y retorno elevado.",
  // No utiliza aceleración WebAssembly.
  usaWasm: false,
  // Declara si la función de evaluación utiliza ruido estocástico.
  usaRuido: false,

  // Parámetros de ponderación para la función de aptitud multiobjetivo.
  parametrosEntrada: [
    { clave: "w1", etiqueta: "Peso w1 (Planitud del apoyo)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 3.0 },
    { clave: "w2", etiqueta: "Peso w2 (Zancada)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w3", etiqueta: "Peso w3 (Despeje de retorno)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w4", etiqueta: "Peso w4 (Uniformidad de velocidad)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 }
  ],

  // Define los rangos continuos de búsqueda de los 6 genes cinemáticos del mecanismo.
  crearGenoma(entrada) {
    return [
      { tipo: "continuo", min: -3.0, max: 3.0 }, // dx (Pivote O2 en X)
      { tipo: "continuo", min: -3.0, max: 3.0 }, // dy (Pivote O2 en Y)
      { tipo: "continuo", min: 1.0, max: 6.0 },  // L (Largo del acoplador)
      { tipo: "continuo", min: 1.0, max: 6.0 },  // r3 (Largo del balancín)
      { tipo: "continuo", min: 0.5, max: 6.0 },  // p (Extensión hacia el pie)
      { tipo: "continuo", min: -Math.PI, max: Math.PI } // alpha (Ángulo del pie)
    ];
  },

  // Resuelve analíticamente la cinemática de posición para un ángulo theta dado de la manivela.
  resolverCinematica(theta, genoma) {
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
  },

  // Evalúa la marcha con 180 muestras de theta calculando penalizaciones y ponderación f1..f4.
  evaluar(genoma, entrada) {
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
      const res = this.resolverCinematica(theta, genoma);
      if (!res) {
        pasosInvalidos++;
      } else {
        pasos.push({ idx: s, ...res });
      }
    }

    if (pasosInvalidos > 0) {
      return 1000 + 10 * pasosInvalidos;
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

    for (let s = 0; s < N; s++) {
      const pAct = pasos[s].P;
      const pSig = pasos[(s + 1) % N].P;
      const distSalto = Math.hypot(pSig.x - pAct.x, pSig.y - pAct.y);
      if (distSalto > 0.25 * diagCaja) {
        return 500;
      }
    }

    if (alturaTotal <= 1e-6) {
      return 800;
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
      return 800;
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

    return w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4;
  },

  // Extrae métricas geométricas completas para su graficación en Canvas y reporte descriptivo.
  obtenerMetricasDetalladas(genoma, entrada) {
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
      const res = this.resolverCinematica(theta, genoma);
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
  },

  // Detiene el ciclo continuo de animación en requestAnimationFrame.
  detenerAnimacion() {
    if (idAnimacionPata !== null) {
      cancelAnimationFrame(idAnimacionPata);
      idAnimacionPata = null;
    }
  },

  // Dibuja en el Canvas interactivo las 4 barras articuladas y la trayectoria animada del pie.
  // Genera el informe textual con los parámetros cinemáticos encontrados y el desglose de métricas.
  describir(genoma, entrada) {
    const [dx, dy, L, r3, p, alpha] = genoma;
    const m = this.obtenerMetricasDetalladas(genoma, entrada);
    const alphaGrados = ((alpha * 180) / Math.PI).toFixed(1);

    let texto = `MECANISMO DE CUATRO BARRAS - PATA CAMINANTE\n`;
    texto += `========================================================\n`;
    texto += `PARÁMETROS DEL GENOMA (6 VARIABLES):\n`;
    texto += `  • Pivote O1 (fijo)        : (0.000, 0.000)\n`;
    texto += `  • Manivela O1-A (largo r1): 1.000 (fijo, unidad de escala)\n`;
    texto += `  • Pivote O2 (fijo dx, dy) : (${dx.toFixed(3)}, ${dy.toFixed(3)})\n`;
    texto += `  • Acoplador A-B (largo L) : ${L.toFixed(3)}\n`;
    texto += `  • Balancín r3             : ${r3.toFixed(3)}\n`;
    texto += `  • Extensión pie p         : ${p.toFixed(3)}\n`;
    texto += `  • Ángulo pie alpha        : ${alpha.toFixed(3)} rad (${alphaGrados}°)\n\n`;

    texto += `MÉTRICAS DE RENDIMIENTO DE LA MARCHA:\n`;
    texto += `  • Pasos cinemáticos válidos : ${m.pctValidos.toFixed(1)}%\n`;
    if (!m.valido) {
      texto += `  • Estado : Mecanismo inválido o discontinuo (Fitness: ${m.fitness.toFixed(1)})\n`;
    } else {
      texto += `  • f1 (Planitud del apoyo)   : ${m.f1.toFixed(4)} (más bajo = más recto)\n`;
      texto += `  • f2 (Zancada horizontal)  : ${m.f2.toFixed(4)} (más bajo = paso más amplio)\n`;
      texto += `  • f3 (Despeje de retorno)   : ${m.f3.toFixed(4)} (0 = altura de retorno óptima)\n`;
      texto += `  • f4 (Uniformidad veloc.)   : ${m.f4.toFixed(4)} (más bajo = velocidad más constante)\n\n`;
      texto += `FITNESS PONDERADO TOTAL       : ${m.fitness.toFixed(4)}\n`;
      texto += `  • Ancho útil de zancada     : ${m.anchoApoyo.toFixed(2)} unidades\n`;
      texto += `  • Altura total de la curva  : ${m.alturaTotal.toFixed(2)} unidades\n`;
    }
    texto += `========================================================\n`;

    return texto;
  }
};

export default ModeloPataCaminante;
