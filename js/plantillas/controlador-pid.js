// Plantilla fiel del modelo controlador-pid: PID sobre planta de 2do orden al escalón.
export default {
  nombre: "Sintonizador PID (Control Automático)",
  descripcion: "Optimiza las ganancias Proporcional (Kp), Integral (Ki) y Derivativa (Kd) para controlar una planta dinámica minimizando sobrepico y tiempo de respuesta.",
  tipoVisualizacion: "controlador_pid",
  variables: [
    { nombre: "Kp", etiqueta: "Kp: Ganancia proporcional del lazo", tipo: "continuo", min: 0.1, max: 35.0 },
    { nombre: "Ki", etiqueta: "Ki: Ganancia integral (eliminación de error de estado estacionario)", tipo: "continuo", min: 0.0, max: 25.0 },
    { nombre: "Kd", etiqueta: "Kd: Ganancia derivativa (amortiguamiento transitorio)", tipo: "continuo", min: 0.0, max: 10.0 }
  ],
  codigoEvaluacion: `const { Kp, Ki, Kd } = vars;
// Parámetros de la planta por defecto
const wn = 2.5, zeta = 0.4;
const dt = 0.01, tiempoTotal = 8.0;
const N = Math.round(tiempoTotal / dt);

let y = 0.0, yd = 0.0;
let integralError = 0.0, errorPrevio = 1.0;
let yMax = 0.0, itae = 0.0;
const ts = []; // historial (t, y) para el tiempo de establecimiento

for (let k = 1; k <= N; k++) {
  const t = k * dt;
  const e = 1.0 - y; // escalón unitario de referencia

  // Integral con anti-windup y derivada discreta
  integralError = Math.max(-50, Math.min(50, integralError + e * dt));
  const de = (e - errorPrevio) / dt;
  errorPrevio = e;

  // Ley PID con saturación del actuador en [-80, 80]
  let u = Kp * e + Ki * integralError + Kd * de;
  u = Math.max(-80, Math.min(80, u));

  // Planta de 2do orden integrada con Euler semi-implícito
  const ydd = (wn * wn * u) - (2.0 * zeta * wn * yd) - (wn * wn * y);
  yd += ydd * dt;
  y += yd * dt;

  // Divergencia: se corta la simulación
  if (isNaN(y) || Math.abs(y) > 100) { y = 100; break; }

  if (y > yMax) yMax = y;
  itae += t * Math.abs(e) * dt;
  ts.push({ t, y });
}

// Sobrepico porcentual
const sobrepicoPct = Math.max(0, (yMax - 1.0) * 100);

// Tiempo de establecimiento al 2% (el punto inicial t=0 tiene y=0)
let tEstablecimiento = tiempoTotal;
for (let i = ts.length; i >= 0; i--) {
  const p = i === 0 ? { t: 0, y: 0 } : ts[i - 1];
  if (Math.abs(p.y - 1.0) > 0.02) {
    tEstablecimiento = Math.min(tiempoTotal, p.t + dt);
    break;
  }
}

// Sistema inestable: penalización fija
const esEstable = !isNaN(y) && Math.abs(y - 1.0) < 0.15 && yMax < 3.0;
if (!esEstable) return [500, 500];
return [sobrepicoPct, tEstablecimiento];`
};
