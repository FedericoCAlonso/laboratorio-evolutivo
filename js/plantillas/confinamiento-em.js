// Plantilla fiel del modelo confinamiento-em (equivale a js/models/electromagnetismo.js).
export default {
  nombre: "Trampa Electromagnética (Fuerza de Lorentz)",
  descripcion: "Sintoniza las corrientes de 4 electroimanes y la tensión de placas deflectoras para confinar y enfocar un haz de partículas cargadas mediante la fuerza de Lorentz F = q(E + v × B).",
  tipoVisualizacion: "electromagnetismo_lorentz",
  variables: [
    { nombre: "i1", etiqueta: "I1 Bobina Sup-Izq (A)", tipo: "continuo", min: -12.0, max: 12.0 },
    { nombre: "i2", etiqueta: "I2 Bobina Sup-Der (A)", tipo: "continuo", min: -12.0, max: 12.0 },
    { nombre: "i3", etiqueta: "I3 Bobina Inf-Izq (A)", tipo: "continuo", min: -12.0, max: 12.0 },
    { nombre: "i4", etiqueta: "I4 Bobina Inf-Der (A)", tipo: "continuo", min: -12.0, max: 12.0 },
    { nombre: "vSup", etiqueta: "V placa superior (V)", tipo: "continuo", min: -250.0, max: 250.0 },
    { nombre: "vInf", etiqueta: "V placa inferior (V)", tipo: "continuo", min: -250.0, max: 250.0 }
  ],
  codigoEvaluacion: `// Parámetros del entorno (valores por defecto del modelo nativo)
const q = 1.0, m = 1.0;
const vInyeccion = 24.0;
const yObjetivo = 6.0;
const dispersionHaz = 2.5;
const { i1, i2, i3, i4, vSup, vInf } = vars;

// Posiciones de los 4 electroimanes en la cámara de vacío
const bobinas = [
  { x: -18.0, y: 16.0, corriente: i1 },
  { x: 18.0, y: 16.0, corriente: i2 },
  { x: -18.0, y: -16.0, corriente: i3 },
  { x: 18.0, y: -16.0, corriente: i4 }
];

// Campo magnético Bz por superposición de las 4 bobinas
const campoBz = (x, y) => {
  let bz = 0.0;
  for (const b of bobinas) {
    const dx = x - b.x, dy = y - b.y;
    bz += (b.corriente * 40.0) / Math.pow(dx * dx + dy * dy + 4.0, 1.25);
  }
  return bz;
};

// Campo eléctrico de las placas deflectoras con decaimiento en los bordes
const campoE = (x) => {
  const amort = 1.0 / (1.0 + Math.pow(x / 30.0, 4));
  return {
    ex: -((vSup + vInf) * 0.015 * (x / 30.0)) * amort,
    ey: ((vInf - vSup) / 32.0) * amort
  };
};

// Haz de 5 partículas integrado con Euler-Cromer bajo la fuerza de Lorentz
const numParticulas = 5, dt = 0.035, maxPasos = 180;
const xMin = -45.0, yLimite = 24.0, xSalida = 38.0;
let transmitidas = 0, sumaError = 0.0, colisiones = 0;

for (let p = 0; p < numParticulas; p++) {
  const factor = (p / (numParticulas - 1) - 0.5) * 2.0;
  const ang = (factor * dispersionHaz * Math.PI) / 180.0;
  let x = -40.0, y = factor * 1.5;
  let vx = vInyeccion * Math.cos(ang), vy = vInyeccion * Math.sin(ang);
  let colision = false, salio = false;

  for (let paso = 1; paso <= maxPasos; paso++) {
    const bz = campoBz(x, y);
    const { ex, ey } = campoE(x);
    const ax = (q / m) * (ex + vy * bz);
    const ay = (q / m) * (ey - vx * bz);
    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;

    // Choque contra las paredes de la cámara
    if (Math.abs(y) >= yLimite || x < xMin) { colision = true; colisiones++; break; }
    // Llegada al detector de salida
    if (x >= xSalida) {
      const errorY = Math.abs(y - yObjetivo);
      if (errorY <= 4.0) { salio = true; transmitidas++; }
      sumaError += errorY;
      break;
    }
  }
  if (!salio && !colision) sumaError += Math.abs(y - yObjetivo) + 12.0;
}

const tasaTransmision = (transmitidas / numParticulas) * 100.0;
const errorPromedio = sumaError / numParticulas;
const potencia = (i1 * i1 + i2 * i2 + i3 * i3 + i4 * i4) * 0.8 + (vSup * vSup + vInf * vInf) * 0.0012;

// Objetivo 1: error de colimación + penalización por choques; objetivo 2: potencia eléctrica
const objColimacion = errorPromedio * 3.5 + (100.0 - tasaTransmision) * 1.5 + colisiones * 35.0;
return [Math.max(0.01, objColimacion), Math.max(0.1, potencia)];`
};
