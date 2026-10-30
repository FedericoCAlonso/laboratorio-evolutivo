// Plantilla fiel del modelo orbita-transferencia: dos impulsos en campo gravitatorio central.
export default {
  nombre: "Transferencia Orbital (Hohmann / Kepler)",
  descripcion: "Optimiza los impulsos vectoriales Δv de un satélite en un campo gravitatorio central para transferirse a una órbita circular superior con mínimo combustible.",
  tipoVisualizacion: "calibracion",
  variables: [
    { nombre: "dv1T", etiqueta: "Δv1 tangencial: impulso prograde inicial", tipo: "continuo", min: 1.0, max: 12.0 },
    { nombre: "dv1R", etiqueta: "Δv1 radial: corrección radial inicial", tipo: "continuo", min: -3.0, max: 3.0 },
    { nombre: "tEspera", etiqueta: "Tiempo de arco de transferencia", tipo: "continuo", min: 2.5, max: 12.0 },
    { nombre: "dv2T", etiqueta: "Δv2 tangencial: circularización", tipo: "continuo", min: 0.5, max: 10.0 }
  ],
  codigoEvaluacion: `const { dv1T, dv1R, tEspera, dv2T } = vars;
// Entorno por defecto del modelo nativo
const mu = 10000.0, rInicial = 35.0, rObjetivo = 75.0, rPlaneta = 18.0;

// Estado inicial: órbita circular en el eje X más el primer impulso
const v0 = Math.sqrt(mu / rInicial);
let x = rInicial, y = 0.0, vx = dv1R, vy = v0 + dv1T;

const dt = 0.04;
const tiempoTotal = Math.max(tEspera + 6.0, 15.0);
const pasos = Math.round(tiempoTotal / dt);
let colisionPlaneta = false;
let segundoEncendidoAplicado = false;

for (let k = 1; k <= pasos; k++) {
  const tActual = k * dt;

  // Segundo impulso prograde en la dirección instantánea de la velocidad
  if (!segundoEncendidoAplicado && tActual >= tEspera) {
    const velMag = Math.hypot(vx, vy);
    if (velMag > 0.001) {
      vx += (vx / velMag) * dv2T;
      vy += (vy / velMag) * dv2T;
    }
    segundoEncendidoAplicado = true;
  }

  if (Math.hypot(x, y) < rPlaneta) colisionPlaneta = true;

  // Gravedad central a = -mu/r^3 * r_vec, integración de Euler semi-implícita
  const r = Math.hypot(x, y);
  const r3 = r * r * r || 1;
  vx += -(mu / r3) * x * dt;
  vy += -(mu / r3) * y * dt;
  x += vx * dt;
  y += vy * dt;
}

// Elementos orbitales finales: momento angular y excentricidad de Laplace-Runge-Lenz
const rFinal = Math.hypot(x, y);
const h = x * vy - y * vx;
const ex = (vy * h) / mu - x / rFinal;
const ey = -(vx * h) / mu - y / rFinal;
const excentricidadFinal = Math.hypot(ex, ey);
const errorRadio = Math.abs(rFinal - rObjetivo);
const deltaVTotal = Math.hypot(dv1T, dv1R) + Math.abs(dv2T);

// Penalización por colisión con el planeta
const penalizacion = colisionPlaneta ? 400 : 0;
const objCombustible = deltaVTotal + (penalizacion > 0 ? 15.0 : 0);
const objPrecision = errorRadio * 2.0 + excentricidadFinal * 40.0 + penalizacion;
return [objCombustible, objPrecision];`
};
