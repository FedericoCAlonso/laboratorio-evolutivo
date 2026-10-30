// Plantilla fiel del modelo cohete-landing: descenso retro-propulsado en 4 fases de empuje.
export default {
  nombre: "Aterrizaje de Cohete (Falcon Landing)",
  descripcion: "Control de empuje vectorial de un cohete en descenso retro-propulsado para tocar una plataforma marina con velocidad nula minimizando combustible.",
  tipoVisualizacion: "cohete_landing",
  variables: [
    { nombre: "F1", etiqueta: "Empuje fase 1 (N)", tipo: "continuo", min: 0, max: 20000 },
    { nombre: "F2", etiqueta: "Empuje fase 2 (N)", tipo: "continuo", min: 0, max: 20000 },
    { nombre: "F3", etiqueta: "Empuje fase 3 (N)", tipo: "continuo", min: 0, max: 20000 },
    { nombre: "F4", etiqueta: "Empuje fase 4 (N)", tipo: "continuo", min: 0, max: 20000 },
    { nombre: "A1", etiqueta: "Ángulo fase 1 (°)", tipo: "continuo", min: -15, max: 15 },
    { nombre: "A2", etiqueta: "Ángulo fase 2 (°)", tipo: "continuo", min: -15, max: 15 },
    { nombre: "A3", etiqueta: "Ángulo fase 3 (°)", tipo: "continuo", min: -15, max: 15 },
    { nombre: "A4", etiqueta: "Ángulo fase 4 (°)", tipo: "continuo", min: -15, max: 15 }
  ],
  codigoEvaluacion: `// Entorno por defecto del modelo nativo
const viento = 4.0;
const alturaInicial = 120.0;
const fuerzas = [vars.F1, vars.F2, vars.F3, vars.F4];
const angulos = [vars.A1, vars.A2, vars.A3, vars.A4];

// Constantes físicas y estado inicial
const g = 9.81, dt = 0.05, masaSeca = 500, combInicial = 500;
const tasaConsumo = 0.00045;
let masa = masaSeca + combInicial;
let x = 15.0, y = alturaInicial, vx = -2.0, vy = -22.0;
let t = 0;
const tiempoFase = 2.0;
let ultimo = { x, vx, vy };

// Integración temporal: 4 fases de 2 s, hasta tocar el suelo o 10 s
while (y > 0 && t < 10.0) {
  const faseIdx = Math.min(3, Math.floor(t / tiempoFase));
  let empuje = fuerzas[faseIdx];
  const angRad = (angulos[faseIdx] * Math.PI) / 180;

  // Sin propelente el empuje cesa; si no, se descuenta el consumo
  const combRestante = masa - masaSeca;
  if (combRestante <= 0) {
    empuje = 0;
  } else {
    masa -= Math.min(combRestante, empuje * tasaConsumo * dt);
  }

  // Empuje vectorial y arrastre aerodinámico
  const fEmpujeX = empuje * Math.sin(angRad);
  const fEmpujeY = empuje * Math.cos(angRad);
  const fArrastreX = -0.08 * (vx - viento) * Math.abs(vx - viento);
  const fArrastreY = -0.06 * vy * Math.abs(vy);
  const ax = (fEmpujeX + fArrastreX) / masa;
  const ay = -g + (fEmpujeY + fArrastreY) / masa;

  vx += ax * dt;
  vy += ay * dt;
  x += vx * dt;
  y += vy * dt;
  t += dt;
  ultimo = { x, vx, vy };
}

// Métricas de impacto y consumo
const velocidadImpacto = Math.hypot(ultimo.vx, ultimo.vy);
const desvioPlataforma = Math.abs(ultimo.x);
const combustibleRestante = Math.max(0, masa - masaSeca);
const combustibleGastadoPct = ((combInicial - combustibleRestante) / combInicial) * 100;

// Penalizaciones por impacto severo o caída fuera de la barcaza
let penalizacionCrash = 0;
if (velocidadImpacto > 4.0) penalizacionCrash += (velocidadImpacto - 4.0) * 8.0;
if (desvioPlataforma > 12.0) penalizacionCrash += (desvioPlataforma - 12.0) * 5.0;

const objVelocidad = velocidadImpacto + desvioPlataforma * 0.4 + penalizacionCrash;
const objCombustible = combustibleGastadoPct / 100 + (penalizacionCrash > 0 ? 1.0 : 0);
return [objVelocidad, objCombustible];`
};
