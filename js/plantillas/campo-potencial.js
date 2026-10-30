// Plantilla fiel del modelo campo-potencial (electrodos deflectores en campo 2D).
export default {
  nombre: "Campo de Potencial y Deflexión 2D",
  descripcion: "Optimiza la ubicación y polaridad de electrodos deflectores para guiar partículas a través de un campo de potencial V(x,y) evitando barreras de sobrepotencial.",
  tipoVisualizacion: "campo_potencial_2d",
  variables: [
    { nombre: "x1", etiqueta: "x1: Electrodo 1 X (mm)", tipo: "continuo", min: -35, max: 35 },
    { nombre: "y1", etiqueta: "y1: Electrodo 1 Y (mm)", tipo: "continuo", min: -30, max: 30 },
    { nombre: "q1", etiqueta: "q1: Electrodo 1 carga (polaridad y magnitud)", tipo: "continuo", min: -3.0, max: 3.0 },
    { nombre: "x2", etiqueta: "x2: Electrodo 2 X (mm)", tipo: "continuo", min: -35, max: 35 },
    { nombre: "y2", etiqueta: "y2: Electrodo 2 Y (mm)", tipo: "continuo", min: -30, max: 30 },
    { nombre: "q2", etiqueta: "q2: Electrodo 2 carga (polaridad y magnitud)", tipo: "continuo", min: -3.0, max: 3.0 }
  ],
  codigoEvaluacion: `// Parámetros por defecto del haz
const emisorX = -45, emisorY = 0, colectorX = 45, colectorY = 0;
const vInicial = 14.0, cargaParticula = 1.0;

const electrodos = [
  { x: vars.x1, y: vars.y1, q: vars.q1 },
  { x: vars.x2, y: vars.y2, q: vars.q2 }
];
// Barrera central repulsora, emisor y colector atractor
const cargasFijas = [
  { x: 0, y: 0, q: 1.8 },
  { x: emisorX, y: emisorY, q: 0.5 },
  { x: colectorX, y: colectorY, q: -1.2 }
];

// Potencial en (x, y) con suavizado para evitar la singularidad en r = 0
const potencial = (x, y) => {
  const eps = 1.5;
  let v = 0;
  for (const c of cargasFijas) v += (c.q * 100) / Math.sqrt(Math.hypot(x - c.x, y - c.y) ** 2 + eps * eps);
  for (const e of electrodos) v += (e.q * 100) / Math.sqrt(Math.hypot(x - e.x, y - e.y) ** 2 + eps * eps);
  return v;
};
// Campo E = -grad V por diferencias centradas
const campo = (x, y) => {
  const h = 0.5;
  return {
    ex: -(potencial(x + h, y) - potencial(x - h, y)) / (2 * h),
    ey: -(potencial(x, y + h) - potencial(x, y - h)) / (2 * h)
  };
};

// Integración de la trayectoria de la partícula (Euler semi-implícito)
let x = emisorX, y = emisorY, vx = vInicial, vy = 0.0;
const dt = 0.05, masa = 1.0;
let distanciaMinimaColector = Infinity, energiaCinematicaTotal = 0, colisionObstaculo = false;

for (let paso = 0; paso < 200; paso++) {
  const distColector = Math.hypot(x - colectorX, y - colectorY);
  if (distColector < distanciaMinimaColector) distanciaMinimaColector = distColector;
  if (Math.hypot(x, y) < 6.0) colisionObstaculo = true;
  if (distColector < 3.5) break;

  const { ex, ey } = campo(x, y);
  vx += (cargaParticula * ex / masa) * dt;
  vy += (cargaParticula * ey / masa) * dt;
  x += vx * dt;
  y += vy * dt;
  energiaCinematicaTotal += 0.5 * masa * (vx * vx + vy * vy) * dt;
  if (Math.abs(x) > 65 || Math.abs(y) > 45) break;
}

// Penalización por chocar con la barrera central
const penalizacionColision = colisionObstaculo ? 250 : 0;
const objDistancia = distanciaMinimaColector + penalizacionColision;
const esfuerzoCargas = Math.abs(vars.q1) + Math.abs(vars.q2);
const objEnergia = (energiaCinematicaTotal * 0.05) + (esfuerzoCargas * 2.0) + (penalizacionColision > 0 ? 5.0 : 0);

// Frente de Pareto: distancia al colector vs. energía de campo
return [objDistancia, objEnergia];`
};
