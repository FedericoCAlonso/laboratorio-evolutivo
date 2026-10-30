// Plantilla fiel del modelo distribucion-termica (4 chips en placa PCB 2D).
export default {
  nombre: "Disipación Térmica en Placa 2D",
  descripcion: "Optimiza la disposición de 4 chips generadores de calor en una placa PCB con disipador perimetral para minimizar el punto caliente máximo (Tmax).",
  tipoVisualizacion: "distribucion_termica",
  variables: [
    { nombre: "xCPU", etiqueta: "xCPU: CPU X (mm)", tipo: "continuo", min: -38, max: 38 },
    { nombre: "yCPU", etiqueta: "yCPU: CPU Y (mm)", tipo: "continuo", min: -28, max: 28 },
    { nombre: "xGPU", etiqueta: "xGPU: GPU X (mm)", tipo: "continuo", min: -38, max: 38 },
    { nombre: "yGPU", etiqueta: "yGPU: GPU Y (mm)", tipo: "continuo", min: -28, max: 28 },
    { nombre: "xVRM", etiqueta: "xVRM: VRM X (mm)", tipo: "continuo", min: -38, max: 38 },
    { nombre: "yVRM", etiqueta: "yVRM: VRM Y (mm)", tipo: "continuo", min: -28, max: 28 },
    { nombre: "xMEM", etiqueta: "xMEM: MEM X (mm)", tipo: "continuo", min: -38, max: 38 },
    { nombre: "yMEM", etiqueta: "yMEM: MEM Y (mm)", tipo: "continuo", min: -28, max: 28 }
  ],
  codigoEvaluacion: `// Entorno térmico por defecto y geometría de la placa
const tAmbiente = 25.0, k = 1.5;
const anchoPlaca = 100.0, altoPlaca = 80.0;

// Potencia (W) y radio (mm) de cada chip: CPU, GPU, VRM, MEM
const chips = [
  { x: vars.xCPU, y: vars.yCPU, q: 25.0, r: 9.0 },
  { x: vars.xGPU, y: vars.yGPU, q: 18.0, r: 7.5 },
  { x: vars.xVRM, y: vars.yVRM, q: 12.0, r: 6.5 },
  { x: vars.xMEM, y: vars.yMEM, q: 10.0, r: 6.0 }
];

// Solapamiento entre chips (separación mínima 3 mm) y desborde de bordes
let solapamientoMm = 0;
for (let i = 0; i < chips.length; i++) {
  for (let j = i + 1; j < chips.length; j++) {
    const dist = Math.hypot(chips[i].x - chips[j].x, chips[i].y - chips[j].y);
    const radioMinimo = chips[i].r + chips[j].r + 3.0;
    if (dist < radioMinimo) solapamientoMm += (radioMinimo - dist);
  }
  const margenX = (anchoPlaca / 2) - Math.abs(chips[i].x);
  const margenY = (altoPlaca / 2) - Math.abs(chips[i].y);
  if (margenX < chips[i].r) solapamientoMm += (chips[i].r - margenX) * 2;
  if (margenY < chips[i].r) solapamientoMm += (chips[i].r - margenY) * 2;
}

// Temperatura en (x, y): suma de gaussianas atenuada por la cercanía al borde
const temperaturaEn = (x, y) => {
  let t = tAmbiente;
  const enfriamiento = Math.min((anchoPlaca / 2) - Math.abs(x), (altoPlaca / 2) - Math.abs(y)) / 15.0;
  const conveccion = Math.max(0.2, Math.min(1.0, enfriamiento));
  for (const c of chips) {
    const d = Math.hypot(x - c.x, y - c.y);
    t += (c.q / (k * 0.45)) * Math.exp(-(d * d) / 380.0) * conveccion;
  }
  return t;
};

// Muestreo en grilla de 32x26 puntos: Tmax y temperatura media
const nx = 32, ny = 26;
let tMax = tAmbiente, sumaT = 0, cant = 0;
for (let iy = 0; iy < ny; iy++) {
  const y = -(altoPlaca / 2) + (iy / (ny - 1)) * altoPlaca;
  for (let ix = 0; ix < nx; ix++) {
    const x = -(anchoPlaca / 2) + (ix / (nx - 1)) * anchoPlaca;
    const t = temperaturaEn(x, y);
    if (t > tMax) tMax = t;
    sumaT += t; cant++;
  }
}
const tPromedio = sumaT / (cant || 1);

// Penalización por solapamiento físico
let penalizacion = 0;
if (solapamientoMm > 0) penalizacion += 100 + solapamientoMm * 15;

const objHotspot = tMax + penalizacion;
const objHomogeneidad = tMax - tPromedio + (penalizacion > 0 ? 30.0 : 0);

// Frente de Pareto: punto caliente vs. homogeneidad/separación
return [objHotspot, objHomogeneidad];`
};
