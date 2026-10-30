// Plantilla fiel del modelo pata-caminante (cuatro barras con pie en el acoplador).
import { GrafoMecanismoMultifisica } from "../engines/mecanismos.js";

// Grafo del cuatro barras: manivela unitaria O1-A, acoplador A-B (L) y balancín B-O2 (r3).
const grafo = new GrafoMecanismoMultifisica();
grafo.agregarNodo({ id: "O1", nombre: "O1: Pivote de la manivela", x: 0, y: 0, tipo: "fijo" });
grafo.agregarNodo({ id: "O2", nombre: "O2: Pivote del balancín", x: 2, y: 0, tipo: "fijo" });
grafo.agregarNodo({ id: "A", nombre: "A: Extremo de la manivela", x: 1, y: 0, tipo: "libre" });
grafo.agregarNodo({ id: "B", nombre: "B: Unión acoplador-balancín", x: 2, y: 2, tipo: "libre" });
grafo.agregarMotor({ id: "motor_manivela", nombre: "Manivela (radio 1)", tipo: "rotativo", nodoPivote: "O1", nodoExtremo: "A", longitudManivela: 1.0, velocidadAngular: 1.0 });
grafo.agregarBarra({ id: "acoplador", nombre: "Acoplador L", nodoA: "A", nodoB: "B", longitud: 3.5, variableAsociada: "L" });
grafo.agregarBarra({ id: "balancin", nombre: "Balancín r3", nodoA: "B", nodoB: "O2", longitud: 3.0, variableAsociada: "r3" });

export default {
  nombre: "Pata caminante (cuatro barras)",
  descripcion: "Optimiza un mecanismo de cuatro barras para que el pie describa una marcha con apoyo horizontal plano y retorno elevado.",
  tipoVisualizacion: "mecanismo_barras_2d",
  grafo: grafo.exportarJSON(),
  variables: [
    { nombre: "dx", etiqueta: "dx: Pivote O2 en X", tipo: "continuo", min: -3.0, max: 3.0 },
    { nombre: "dy", etiqueta: "dy: Pivote O2 en Y", tipo: "continuo", min: -3.0, max: 3.0 },
    { nombre: "L", etiqueta: "L: Largo del acoplador", tipo: "continuo", min: 1.0, max: 6.0 },
    { nombre: "r3", etiqueta: "r3: Largo del balancín", tipo: "continuo", min: 1.0, max: 6.0 },
    { nombre: "p", etiqueta: "p: Extensión hacia el pie", tipo: "continuo", min: 0.5, max: 6.0 },
    { nombre: "alpha", etiqueta: "alpha: Ángulo del pie (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI }
  ],
  codigoEvaluacion: `// Pesos por defecto: planitud, zancada, despeje y uniformidad de velocidad
const w1 = 3.0, w2 = 1.0, w3 = 1.0, w4 = 1.0;
const { dx, dy, L, r3, p, alpha } = vars;

// Cinemática: posición del pie para un ángulo de manivela (null si no ensambla)
const resolver = (theta) => {
  const A = { x: Math.cos(theta), y: Math.sin(theta) };
  const vx = dx - A.x, vy = dy - A.y;
  const d = Math.hypot(vx, vy);
  if (d === 0 || d > L + r3 || d < Math.abs(L - r3)) return null;
  const a = (L * L - r3 * r3 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L * L - a * a));
  const mx = A.x + (a * vx) / d, my = A.y + (a * vy) / d;
  const B = { x: mx + (h * vy) / d, y: my - (h * vx) / d };
  const phi = Math.atan2(B.y - A.y, B.x - A.x);
  return { x: A.x + p * Math.cos(phi + alpha), y: A.y + p * Math.sin(phi + alpha) };
};

// Barrido de 180 pasos de la manivela; penaliza si no ensambla en algún paso
const N = 180;
const pasos = [];
let pasosInvalidos = 0;
for (let s = 0; s < N; s++) {
  const P = resolver((2 * Math.PI * s) / N);
  if (!P) pasosInvalidos++; else pasos.push({ idx: s, P });
}
if (pasosInvalidos > 0) return 1000 + 10 * pasosInvalidos;

// Caja envolvente de la trayectoria del pie
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const { P } of pasos) {
  if (P.x < minX) minX = P.x;
  if (P.x > maxX) maxX = P.x;
  if (P.y < minY) minY = P.y;
  if (P.y > maxY) maxY = P.y;
}
const alturaTotal = maxY - minY;
const diagCaja = Math.hypot(maxX - minX, alturaTotal);

// Penaliza saltos bruscos entre pasos consecutivos
for (let s = 0; s < N; s++) {
  const pAct = pasos[s].P, pSig = pasos[(s + 1) % N].P;
  if (Math.hypot(pSig.x - pAct.x, pSig.y - pAct.y) > 0.25 * diagCaja) return 500;
}
if (alturaTotal <= 1e-6) return 800;

// Fase de apoyo: el 35% de pasos con el pie más bajo
const numApoyo = Math.round(N * 0.35);
const apoyo = [...pasos].sort((p1, p2) => p1.P.y - p2.P.y).slice(0, numApoyo);
const apoyoSet = new Set(apoyo.map(q => q.idx));

let minYApoyo = Infinity, maxYApoyo = -Infinity, minXApoyo = Infinity, maxXApoyo = -Infinity, sumaYApoyo = 0;
for (const { P } of apoyo) {
  if (P.y < minYApoyo) minYApoyo = P.y;
  if (P.y > maxYApoyo) maxYApoyo = P.y;
  if (P.x < minXApoyo) minXApoyo = P.x;
  if (P.x > maxXApoyo) maxXApoyo = P.x;
  sumaYApoyo += P.y;
}
const anchoApoyo = maxXApoyo - minXApoyo;
if (anchoApoyo <= 1e-6) return 800;
const mediaYApoyo = sumaYApoyo / numApoyo;

// f1: planitud, f2: zancada, f3: despeje del retorno
const f1 = (maxYApoyo - minYApoyo) / alturaTotal;
const f2 = 1 - Math.min(1, anchoApoyo / (L + r3));
const f3 = Math.max(0, 0.3 - (maxY - mediaYApoyo) / anchoApoyo) / 0.3;

// f4: uniformidad de la velocidad horizontal durante el apoyo
const dxPasos = [];
for (let s = 0; s < N; s++) {
  const sig = (s + 1) % N;
  if (apoyoSet.has(s) && apoyoSet.has(sig)) dxPasos.push(pasos[sig].P.x - pasos[s].P.x);
}
let f4 = 1.0;
if (dxPasos.length >= 3) {
  const promDx = dxPasos.reduce((acc, v) => acc + v, 0) / dxPasos.length;
  const promAbsDx = dxPasos.reduce((acc, v) => acc + Math.abs(v), 0) / dxPasos.length;
  const varianza = dxPasos.reduce((acc, v) => acc + (v - promDx) ** 2, 0) / dxPasos.length;
  if (promAbsDx > 1e-6) f4 = Math.min(1, Math.sqrt(varianza) / promAbsDx);
}

return w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4;`
};
