// =========================================================================
// MÓDULO: MODELO MANIOBRA DE TRANSFERENCIA ORBITAL (MECÁNICA CELESTE 2D)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Simula la dinámica orbital newtoniana de dos cuerpos con impulsos vectoriales discretos.
export function simularManiobraOrbital(genoma, entrada) {
  const mu = Number(entrada?.constanteGravitacional !== undefined ? entrada.constanteGravitacional : 10000.0);
  const rInicial = Number(entrada?.radioInicial !== undefined ? entrada.radioInicial : 35.0);
  const rObjetivo = Number(entrada?.radioObjetivo !== undefined ? entrada.radioObjetivo : 75.0);
  const rPlaneta = 18.0;

  // 4 genes del genoma:
  // dv1Tangencial: impulso inicial en dirección del movimiento (+ prograde)
  // dv1Radial: impulso inicial transversal
  // tiempoVueloFase1: tiempo de espera en la elipse de transferencia antes del segundo encendido
  // dv2Tangencial: segundo impulso para circularizar en la órbita de destino
  const [dv1T, dv1R, tEspera, dv2T] = genoma;

  // Velocidad circular inicial para equilibrio v0 = sqrt(mu / r0)
  const v0 = Math.sqrt(mu / rInicial);

  // Estado inicial en coordenadas cartesianas: satélite en el eje X
  let x = rInicial;
  let y = 0.0;
  let vx = dv1R;
  let vy = v0 + dv1T;

  const dt = 0.04;
  const tiempoTotal = Math.max(tEspera + 6.0, 15.0);
  const pasos = Math.round(tiempoTotal / dt);

  const trayectoria = [{ x, y, vx, vy, t: 0, encendido: 1 }];
  let colisionPlaneta = false;
  let segundoEncendidoAplicado = false;
  let tSegundoEncendido = 0;

  for (let k = 1; k <= pasos; k++) {
    const tActual = k * dt;

    // Aplicación del segundo impulso al cumplirse el tiempo de transferencia programado
    let encendido = 0;
    if (!segundoEncendidoAplicado && tActual >= tEspera) {
      // Impulso prograde en la dirección instantánea de la velocidad
      const velMag = Math.hypot(vx, vy);
      if (velMag > 0.001) {
        vx += (vx / velMag) * dv2T;
        vy += (vy / velMag) * dv2T;
      }
      segundoEncendidoAplicado = true;
      tSegundoEncendido = tActual;
      encendido = 2;
    }

    const r = Math.hypot(x, y);
    if (r < rPlaneta) {
      colisionPlaneta = true;
    }

    // Aceleración gravitatoria central a = -mu / r^3 * vec(r)
    const r3 = r * r * r || 1;
    const ax = -(mu / r3) * x;
    const ay = -(mu / r3) * y;

    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;

    trayectoria.push({ x, y, vx, vy, t: tActual, encendido });
  }

  // Parámetros orbitales en el arco final (después del segundo encendido)
  const puntoFinal = trayectoria[trayectoria.length - 1];
  const rFinal = Math.hypot(puntoFinal.x, puntoFinal.y);
  const vFinal = Math.hypot(puntoFinal.vx, puntoFinal.vy);

  // Momento angular específico h = x*vy - y*vx
  const h = puntoFinal.x * puntoFinal.vy - puntoFinal.y * puntoFinal.vx;

  // Vector de excentricidad de Laplace-Runge-Lenz: e = (v x h)/mu - r/|r|
  const ex = (puntoFinal.vy * h) / mu - puntoFinal.x / rFinal;
  const ey = -(puntoFinal.vx * h) / mu - puntoFinal.y / rFinal;
  const excentricidadFinal = Math.hypot(ex, ey);

  // Error de radio respecto a la órbita deseada
  const errorRadio = Math.abs(rFinal - rObjetivo);

  // Gasto total de propelente (Delta V acumulado)
  const deltaVTotal = Math.hypot(dv1T, dv1R) + Math.abs(dv2T);

  // Transferencia exitosa: error radio < 2.5 km y órbita casi circular (e < 0.08)
  const maniobraExitosa = !colisionPlaneta && errorRadio < 2.5 && excentricidadFinal < 0.08;

  return {
    trayectoria,
    rInicial,
    rObjetivo,
    rPlaneta,
    rFinal,
    vFinal,
    errorRadio,
    excentricidadFinal,
    deltaVTotal,
    colisionPlaneta,
    maniobraExitosa,
    tSegundoEncendido,
    tEspera
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloTransferenciaOrbital = {
  id: "orbita-transferencia",
  nombre: "Transferencia Orbital (Hohmann / Kepler)",
  descripcion: "Optimiza los impulsos vectoriales Δv de un satélite en un campo gravitatorio central para transferirse a una órbita circular superior con mínimo combustible.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Gasto de Combustible Δv (m/s)", "Error Orbital y Excentricidad"],

  // Parámetros de entorno orbital.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Ahorro Δv vs. Precisión)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Inserción precisa)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "radioInicial", etiqueta: "Radio Órbita Inicial (km)", tipo: "numero", min: 25, max: 45, paso: 5, valorDefecto: 35 },
    { clave: "radioObjetivo", etiqueta: "Radio Órbita Destino (km)", tipo: "numero", min: 55, max: 95, paso: 5, valorDefecto: 75 }
  ],

  // 4 genes: [dv1Tangencial, dv1Radial, tEspera, dv2Tangencial].
  crearGenoma() {
    return [
      { tipo: "continuo", min: 1.0, max: 12.0 },  // dv1T (impulso prograde inicial)
      { tipo: "continuo", min: -3.0, max: 3.0 },  // dv1R (corrección radial inicial)
      { tipo: "continuo", min: 2.5, max: 12.0 },  // tEspera (tiempo de arco de transferencia)
      { tipo: "continuo", min: 0.5, max: 10.0 }   // dv2T (segundo impulso de circularización)
    ];
  },

  // Evalúa el consumo total de propelente Δv y la circularidad/precisión orbital alcanzada.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularManiobraOrbital(genoma, entrada);

    let penalizacion = 0;
    if (sim.colisionPlaneta) {
      penalizacion += 400;
    }

    const objCombustible = sim.deltaVTotal + (penalizacion > 0 ? 15.0 : 0);
    const objPrecision = sim.errorRadio * 2.0 + sim.excentricidadFinal * 40.0 + penalizacion;

    if (esMulti) {
      return [objCombustible, objPrecision];
    }

    return objCombustible * 3.0 + objPrecision * 4.0;
  },

  // Genera el informe textual con los parámetros orbitales de Kepler y el delta V de los motores.
  describir(genoma, entrada) {
    const sim = simularManiobraOrbital(genoma, entrada);
    const [dv1T, dv1R, tEspera, dv2T] = genoma;

    let texto = `MANIOBRA ORBITAL KEPLERIANA - TELEMETRÍA DE TRANSFERENCIA\n`;
    texto += `========================================================================\n`;
    texto += `CONDICIONES ORBITALES:\n`;
    texto += `  • Radio de partida (r₀)   : ${sim.rInicial.toFixed(1)} km (Circular)\n`;
    texto += `  • Radio objetivo (rf)     : ${sim.rObjetivo.toFixed(1)} km (Circular)\n`;
    texto += `  • Radio final alcanzado   : ${sim.rFinal.toFixed(2)} km (Error: ${sim.errorRadio.toFixed(2)} km)\n`;
    texto += `  • Excentricidad orbital e : ${sim.excentricidadFinal.toFixed(4)} (Ideal circular: < 0.05)\n\n`;

    texto += `PLAN DE ENCENDIDO DE PROPULSORES:\n`;
    texto += `  • Impulso 1 (Transferencia) : Δv Prograde = ${dv1T.toFixed(2)} m/s | Δv Radial = ${dv1R.toFixed(2)} m/s\n`;
    texto += `  • Tiempo en semielipse     : ${tEspera.toFixed(2)} s de arco orbital\n`;
    texto += `  • Impulso 2 (Circularizar) : Δv Prograde = ${dv2T.toFixed(2)} m/s\n`;
    texto += `  • Presupuesto total Δv     : ${sim.deltaVTotal.toFixed(2)} m/s de impulso acumulado\n\n`;

    texto += `DIAGNÓSTICO DE MISIÓN:\n`;
    texto += `  • Estado de la inserción   : ${sim.maniobraExitosa ? "INSERCIÓN ORBITAL EXITOSA ✓" : "DESVÍO O EXCENTRICIDAD ELEVADA ✕"}\n`;
    texto += `  • Seguridad planetaria     : ${sim.colisionPlaneta ? "IMPACTO EN SUPERFICIE PLANETARIA ✕" : "TRAYECTO SEGURO FUERA DE ATMÓSFERA ✓"}\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloTransferenciaOrbital;
