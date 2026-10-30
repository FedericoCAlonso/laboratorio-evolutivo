// =========================================================================
// MÓDULO: MODELO SINTONIZADOR EVOLUTIVO DE CONTROLADOR PID
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Simula la respuesta temporal al escalón unitario de un sistema de control en lazo cerrado con PID.
export function simularRespuestaPID(genoma, entrada) {
  const [kp, ki, kd] = genoma;
  const wn = Number(entrada?.frecuenciaNatural !== undefined ? entrada.frecuenciaNatural : 2.5);
  const zeta = Number(entrada?.amortiguamiento !== undefined ? entrada.amortiguamiento : 0.4);

  const dt = 0.01;
  const tiempoTotal = 8.0;
  const N = Math.round(tiempoTotal / dt);

  // Estados de la planta de segundo orden: y (salida) e yd (velocidad de salida dy/dt).
  let y = 0.0;
  let yd = 0.0;
  let integralError = 0.0;
  let errorPrevio = 1.0;

  const respuesta = [{ t: 0, y: 0, e: 1, u: 0 }];
  let yMax = 0.0;
  let tPico = 0.0;
  let itae = 0.0;

  for (let k = 1; k <= N; k++) {
    const t = k * dt;
    const r = 1.0; // Escalón unitario de referencia
    const e = r - y;

    integralError += e * dt;
    // Anti-windup suave para evitar saturación desmedida del término integral
    integralError = Math.max(-50, Math.min(50, integralError));

    const de = (e - errorPrevio) / dt;
    errorPrevio = e;

    // Ley de control PID con saturación de actuador en [-80, 80]
    let u = kp * e + ki * integralError + kd * de;
    u = Math.max(-80, Math.min(80, u));

    // Dinámica de la planta: d²y/dt² = wn² * u - 2*zeta*wn * dy/dt - wn² * y
    const ydd = (wn * wn * u) - (2.0 * zeta * wn * yd) - (wn * wn * y);
    yd += ydd * dt;
    y += yd * dt;

    if (isNaN(y) || Math.abs(y) > 100) {
      // Detección de inestabilidad divergente en lazo cerrado
      y = 100;
      break;
    }

    if (y > yMax) {
      yMax = y;
      tPico = t;
    }

    itae += t * Math.abs(e) * dt;
    respuesta.push({ t, y, e, u });
  }

  // Cálculo del sobrepico porcentual (Overshoot Mp)
  const sobrepicoPct = Math.max(0, (yMax - 1.0) * 100);

  // Cálculo del tiempo de establecimiento al 2% (Settling Time ts)
  let tEstablecimiento = tiempoTotal;
  for (let i = respuesta.length - 1; i >= 0; i--) {
    if (Math.abs(respuesta[i].y - 1.0) > 0.02) {
      tEstablecimiento = Math.min(tiempoTotal, respuesta[i].t + dt);
      break;
    }
  }

  const esEstable = !isNaN(y) && Math.abs(y - 1.0) < 0.15 && yMax < 3.0;

  return {
    respuesta,
    sobrepicoPct,
    tEstablecimiento,
    yMax,
    tPico,
    itae,
    esEstable,
    wn,
    zeta
  };
}

// Objeto de contrato del modelo de sintonización PID para el motor evolutivo.
export const ModeloControladorPID = {
  id: "controlador-pid",
  nombre: "Sintonizador PID (Control Automático)",
  descripcion: "Optimiza las ganancias Proporcional (Kp), Integral (Ki) y Derivativa (Kd) para controlar una planta dinámica minimizando sobrepico y tiempo de respuesta.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Sobrepico Mp (%)", "Tiempo de Establecimiento (s)"],

  // Parámetros de la planta configurables por el usuario.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Sobrepico vs. Rapidez)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Criterio ITAE)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "frecuenciaNatural", etiqueta: "Frecuencia Natural wn (rad/s)", tipo: "numero", min: 0.5, max: 10, paso: 0.5, valorDefecto: 2.5 },
    { clave: "amortiguamiento", etiqueta: "Factor de Amortiguamiento zeta", tipo: "numero", min: 0.1, max: 2.0, paso: 0.1, valorDefecto: 0.4 }
  ],

  // 3 genes continuos: Kp en [0.1, 35], Ki en [0, 25], Kd en [0, 10].
  crearGenoma() {
    return [
      { nombre: "Kp", etiqueta: "Kp: Ganancia proporcional del lazo", tipo: "continuo", min: 0.1, max: 35.0 },
      { nombre: "Ki", etiqueta: "Ki: Ganancia integral (eliminación de error de estado estacionario)", tipo: "continuo", min: 0.0, max: 25.0 },
      { nombre: "Kd", etiqueta: "Kd: Ganancia derivativa (amortiguamiento transitorio)", tipo: "continuo", min: 0.0, max: 10.0 }
    ];
  },

  // Evalúa el comportamiento transitorio en lazo cerrado.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularRespuestaPID(genoma, entrada);

    if (!sim.esEstable) {
      return esMulti ? [500, 500] : 1000;
    }

    const objSobrepico = sim.sobrepicoPct;
    const objTiempo = sim.tEstablecimiento;

    if (esMulti) {
      return [objSobrepico, objTiempo];
    }

    // En monobjetivo minimizamos el error temporal acumulado ITAE ponderado.
    return sim.itae + (sim.sobrepicoPct > 15 ? (sim.sobrepicoPct - 15) * 2 : 0);
  },

  // Genera el informe técnico de control y desempeño transitorio.
  describir(genoma, entrada) {
    const sim = simularRespuestaPID(genoma, entrada);
    const [kp, ki, kd] = genoma;

    let texto = `CONTROLADOR PID EN LAZO CERRADO - RESPUESTA AL ESCALÓN\n`;
    texto += `========================================================================\n`;
    texto += `PARÁMETROS DE LA PLANTA DE 2DO ORDEN:\n`;
    texto += `  • Frecuencia natural (wn)  : ${sim.wn.toFixed(2)} rad/s\n`;
    texto += `  • Coef. amortiguamiento (ζ): ${sim.zeta.toFixed(2)}\n\n`;

    texto += `GANANCIAS DEL CONTROLADOR EVOLUCIONADAS:\n`;
    texto += `  • Ganancia Proporcional (Kp) : ${kp.toFixed(4)}\n`;
    texto += `  • Ganancia Integral     (Ki) : ${ki.toFixed(4)}\n`;
    texto += `  • Ganancia Derivativa   (Kd) : ${kd.toFixed(4)}\n\n`;

    texto += `MÉTRICAS DE DESEMPEÑO TRANSITORIO:\n`;
    texto += `  • Sobrepico máximo (Overshoot Mp) : ${sim.sobrepicoPct.toFixed(2)}%\n`;
    texto += `  • Tiempo de pico (tp)             : ${sim.tPico.toFixed(2)} s (Ymax = ${sim.yMax.toFixed(3)})\n`;
    texto += `  • Tiempo de asentamiento al 2% (ts): ${sim.tEstablecimiento.toFixed(2)} s\n`;
    texto += `  • Criterio de error ITAE          : ${sim.itae.toFixed(3)}\n`;
    texto += `  • Estabilidad del sistema         : ${sim.esEstable ? "LAZO CERRADO ESTABLE ✓" : "SISTEMA INESTABLE O OSCILANTE ✕"}\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloControladorPID;
