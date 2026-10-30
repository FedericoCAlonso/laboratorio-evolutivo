// Plantilla fiel del modelo armadura-puente (celosía 2D de 7 nudos y 11 barras).
export default {
  nombre: "Armadura de Puente (Estructuras 2D)",
  descripcion: "Optimiza la geometría y altura de los nudos superiores de una celosía articulada para soportar cargas de tránsito con mínima masa de acero y sin pandeo.",
  tipoVisualizacion: "armadura_puente",
  variables: [
    { nombre: "h1", etiqueta: "h1: Altura nudo superior izquierdo (m)", tipo: "continuo", min: 4.0, max: 22.0 },
    { nombre: "xCentroRel", etiqueta: "xCentroRel: Desvío horizontal del nudo central (m)", tipo: "continuo", min: -6.0, max: 6.0 },
    { nombre: "hCentro", etiqueta: "hCentro: Altura nudo superior central (m)", tipo: "continuo", min: 6.0, max: 26.0 },
    { nombre: "h2", etiqueta: "h2: Altura nudo superior derecho (m)", tipo: "continuo", min: 4.0, max: 22.0 }
  ],
  codigoEvaluacion: `// Parámetros de entrada por defecto (luz, carga de tránsito, límite elástico)
const luz = 60.0, cargaP = 50.0, limiteTension = 250.0;
const { h1, xCentroRel, hCentro, h2 } = vars;

// Nudos: 4 inferiores fijos en la calzada y 3 superiores variables
const nodos = [
  { x: 0, y: 0 }, { x: luz / 3, y: 0 }, { x: (2 * luz) / 3, y: 0 }, { x: luz, y: 0 },
  { x: luz / 3, y: h1 }, { x: luz / 2 + xCentroRel, y: hCentro }, { x: (2 * luz) / 3, y: h2 }
];
// Las 11 barras como pares de nudos [inicio, fin]
const barrasDef = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6]];

const rY0 = cargaP; // reacción de apoyo (simetría)
const densidadAcero = 7850, seccionBarra = 0.0035;
const E = 210e9, I = 2.5e-6;
let masaTotalKg = 0, maxTensionMPa = -Infinity, hayPandeo = false;

for (let b = 0; b < barrasDef.length; b++) {
  const nA = nodos[barrasDef[b][0]], nB = nodos[barrasDef[b][1]];
  const longitud = Math.hypot(nB.x - nA.x, nB.y - nA.y);
  masaTotalKg += longitud * seccionBarra * densidadAcero;

  // Esfuerzo axial: cordones por momento/brazo, diagonales por cortante/seno
  let fuerzaAxialKN = 0;
  const brazoH = Math.max(2.0, (nA.y + nB.y) / 2 || hCentro);
  if (b <= 2) {
    fuerzaAxialKN = (cargaP * (luz / 3)) / brazoH;
  } else if (b <= 4) {
    fuerzaAxialKN = -((cargaP * (luz / 3)) / brazoH);
  } else if (b === 5 || b === 10) {
    const angulo = Math.atan2(Math.abs(nB.y - nA.y), Math.abs(nB.x - nA.x)) || 0.5;
    fuerzaAxialKN = -(rY0 / Math.sin(angulo));
  } else {
    const senAng = Math.sin(Math.atan2(Math.abs(nB.y - nA.y), Math.abs(nB.x - nA.x))) || 0.7;
    fuerzaAxialKN = (cargaP * 0.45) / senAng;
  }

  const tensionMPa = (Math.abs(fuerzaAxialKN) * 1000) / (seccionBarra * 1e6);
  if (tensionMPa > maxTensionMPa) maxTensionMPa = tensionMPa;
  // Pandeo de Euler en barras comprimidas
  const cargaCriticaKN = (Math.PI * Math.PI * E * I) / (longitud * longitud * 1000);
  if (fuerzaAxialKN < 0 && Math.abs(fuerzaAxialKN) > cargaCriticaKN) hayPandeo = true;
}

const maxFactorUso = maxTensionMPa / limiteTension;

// Penalizaciones por pandeo y por exceder el límite elástico
let penalizacion = 0;
if (hayPandeo) penalizacion += 500;
if (maxFactorUso > 1.0) penalizacion += (maxFactorUso - 1.0) * 300;

const objMasa = masaTotalKg / 1000 + (penalizacion > 0 ? 10.0 : 0);
const objTension = maxFactorUso * 100 + penalizacion;

// Frente de Pareto: masa de acero vs. tensión máxima / pandeo
return [objMasa, objTension];`
};
