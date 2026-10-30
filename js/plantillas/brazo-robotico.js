// Plantilla fiel del Brazo Robótico planar de 3 eslabones (cinemática inversa con obstáculo).
import { crearGrafoBrazoRobotico } from "../engines/mecanismos.js";

export default {
  nombre: "Brazo Robótico (Cinemática Inversa)",
  descripcion: "Manipulador planar de 3 eslabones articulados que optimiza la orientación de sus articulaciones para alcanzar un punto objetivo evadiendo un obstáculo circular.",
  tipoVisualizacion: "brazo_robotico",
  grafo: crearGrafoBrazoRobotico().exportarJSON(),
  variables: [
    { nombre: "theta1", etiqueta: "theta1: Ángulo eslabón base θ₁ (-180° a 180°)", tipo: "continuo", min: -180, max: 180 },
    { nombre: "theta2", etiqueta: "theta2: Ángulo eslabón codo θ₂ (-180° a 180°)", tipo: "continuo", min: -180, max: 180 },
    { nombre: "theta3", etiqueta: "theta3: Ángulo efector muñeca θ₃ (-180° a 180°)", tipo: "continuo", min: -180, max: 180 }
  ],
  codigoEvaluacion: `// Parámetros del escenario (editables): objetivo, obstáculo circular y longitudes de eslabones
const objetivo = { x: 55, y: 40 };
const obstaculo = { x: 30, y: 20, radio: 16 };
const [L1, L2, L3] = [45, 35, 25];

// Cinemática directa: ángulos acumulados a lo largo de la cadena
const a1 = (vars.theta1 * Math.PI) / 180;
const a2 = a1 + (vars.theta2 * Math.PI) / 180;
const a3 = a2 + (vars.theta3 * Math.PI) / 180;
const p0 = { x: 0, y: 0 };
const p1 = { x: L1 * Math.cos(a1), y: L1 * Math.sin(a1) };
const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) };
const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) };

// Distancia mínima del obstáculo a un segmento AB
const distSegmento = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
};
const minDist = Math.min(
  distSegmento(obstaculo, p0, p1),
  distSegmento(obstaculo, p1, p2),
  distSegmento(obstaculo, p2, p3)
);

// Objetivos: precisión (con penalización de colisión) y esfuerzo angular normalizado
const distObjetivo = Math.hypot(p3.x - objetivo.x, p3.y - objetivo.y);
const penColision = minDist < obstaculo.radio ? 300 + (obstaculo.radio - minDist) * 15 : 0;
const esfuerzo = (Math.abs(vars.theta1) + Math.abs(vars.theta2) + Math.abs(vars.theta3)) / 540;

return [distObjetivo + penColision, esfuerzo + (penColision > 0 ? 2.0 : 0)];`
};
