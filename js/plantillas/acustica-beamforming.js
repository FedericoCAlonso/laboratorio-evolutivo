// Plantilla fiel del modelo acustica-beamforming (equivale a js/models/acustica.js).
export default {
  nombre: "Arreglo Acústico y Beamforming (Ondas 2D)",
  descripcion: "Sintetiza la dirección de un haz ultrasónico/acústico mediante interferencia constructiva de transductores (Phased Array), maximizando ganancia en el ángulo deseado y eliminando lóbulos parásitos.",
  tipoVisualizacion: "acustica_ondas_2d",
  variables: [
    { nombre: "fase0", etiqueta: "Fase transductor 0 (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI },
    { nombre: "fase1", etiqueta: "Fase transductor 1 (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI },
    { nombre: "fase2", etiqueta: "Fase transductor 2 (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI },
    { nombre: "fase3", etiqueta: "Fase transductor 3 (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI },
    { nombre: "fase4", etiqueta: "Fase transductor 4 (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI },
    { nombre: "fase5", etiqueta: "Fase transductor 5 (rad)", tipo: "continuo", min: -Math.PI, max: Math.PI },
    { nombre: "amp0", etiqueta: "Amplitud transductor 0", tipo: "continuo", min: 0.15, max: 1.0 },
    { nombre: "amp1", etiqueta: "Amplitud transductor 1", tipo: "continuo", min: 0.15, max: 1.0 },
    { nombre: "amp2", etiqueta: "Amplitud transductor 2", tipo: "continuo", min: 0.15, max: 1.0 },
    { nombre: "amp3", etiqueta: "Amplitud transductor 3", tipo: "continuo", min: 0.15, max: 1.0 },
    { nombre: "amp4", etiqueta: "Amplitud transductor 4", tipo: "continuo", min: 0.15, max: 1.0 },
    { nombre: "amp5", etiqueta: "Amplitud transductor 5", tipo: "continuo", min: 0.15, max: 1.0 }
  ],
  codigoEvaluacion: `// Parámetros del entorno (valores por defecto del modelo nativo)
const c = 343.0;
const f = 2000.0;
const anguloObjetivo = 25.0;
const lambda = c / f;
const k = (2.0 * Math.PI) / lambda;

// Arreglo lineal de 6 transductores con separación ~ lambda/2
const N = 6;
const d = Math.min(0.12, Math.max(0.04, lambda / 2.0));
const fases = [vars.fase0, vars.fase1, vars.fase2, vars.fase3, vars.fase4, vars.fase5];
const amps = [vars.amp0, vars.amp1, vars.amp2, vars.amp3, vars.amp4, vars.amp5];
const em = [];
for (let i = 0; i < N; i++) {
  em.push({ x: (i - (N - 1) / 2.0) * d, phi: fases[i], amp: Math.max(0.05, amps[i]) });
}

// Diagrama polar en campo lejano de -90° a +90°
const diagrama = [];
let potenciaEnObjetivo = 0.0;
let potenciaMaxima = 0.0001;
let anguloPico = 0.0;
for (let idx = 0; idx < 181; idx++) {
  const grad = -90.0 + idx;
  const rad = (grad * Math.PI) / 180.0;
  let re = 0.0, im = 0.0;
  for (let i = 0; i < N; i++) {
    const fase = em[i].phi + k * em[i].x * Math.sin(rad);
    re += em[i].amp * Math.cos(fase);
    im += em[i].amp * Math.sin(fase);
  }
  const pot = re * re + im * im;
  if (pot > potenciaMaxima) { potenciaMaxima = pot; anguloPico = grad; }
  if (Math.abs(grad - anguloObjetivo) <= 1.0) potenciaEnObjetivo = pot;
  diagrama.push({ grad, pot });
}

// Normaliza y obtiene lóbulo secundario máximo y ancho de haz a -3 dB
let maxLobulo = 0.0;
let anchoHaz = 0.0;
diagrama.forEach(p => {
  const norm = p.pot / (potenciaMaxima || 1.0);
  const db = 10.0 * Math.log10(Math.max(1e-4, norm));
  if (db >= -3.0 && Math.abs(p.grad - anguloPico) < 35.0) anchoHaz += 1.0;
  if (Math.abs(p.grad - anguloObjetivo) > 18.0 && norm > maxLobulo) maxLobulo = norm;
});
const sll = 10.0 * Math.log10(Math.max(1e-4, maxLobulo));

// Objetivo 1: error de apuntamiento y déficit de potencia
const objDirectividad = Math.abs(anguloPico - anguloObjetivo) * 2.5 + Math.max(0, 36.0 - potenciaEnObjetivo) * 1.5;
// Objetivo 2: supresión de lóbulos secundarios y ancho de haz
const objSLL = (sll + 30.0) * 1.8 + Math.max(0, anchoHaz - 20) * 0.5;

return [objDirectividad, Math.max(0.1, objSLL)];`
};
