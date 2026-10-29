// =========================================================================
// MÓDULO: MODELO SINTONIZADOR EVOLUTIVO DE CONTROLADOR PID
// =========================================================================

// Identificador del temporizador de animación requestAnimationFrame para el osciloscopio PID.
let idAnimacionPID = null;

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
      { tipo: "continuo", min: 0.1, max: 35.0 },
      { tipo: "continuo", min: 0.0, max: 25.0 },
      { tipo: "continuo", min: 0.0, max: 10.0 }
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

  // Detiene el ciclo continuo de animación en requestAnimationFrame.
  detenerAnimacion() {
    if (idAnimacionPID !== null) {
      cancelAnimationFrame(idAnimacionPID);
      idAnimacionPID = null;
    }
  },

  // Dibuja en Canvas 2D el osciloscopio animado trazando la respuesta al escalón temporal en tiempo real.
  dibujar(genoma, entrada, contenedor) {
    if (!contenedor) return;

    this.detenerAnimacion();

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 360;
      canvas.style.width = "100%";
      canvas.style.height = "360px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularRespuestaPID(genoma, entrada);
    const pts = sim.respuesta;

    let indicePaso = 0;
    let contadorPausaFinal = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        if (idAnimacionPID !== null) {
          cancelAnimationFrame(idAnimacionPID);
          idAnimacionPID = null;
        }
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 360;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const margenIzq = 55;
      const margenDer = 25;
      const margenSup = 35;
      const margenInf = 40;
      const anchoG = anchoCSS - margenIzq - margenDer;
      const altoG = altoCSS - margenSup - margenInf;

      // Escala del gráfico: Tiempo t en [0, 8]s, Salida y en [0, 1.8].
      const tMax = 8.0;
      const yMaxEscala = Math.max(1.5, Math.min(2.5, sim.yMax * 1.15));

      const toPx = (t, y) => ({
        x: margenIzq + (t / tMax) * anchoG,
        y: margenSup + altoG - (y / yMaxEscala) * altoG
      });

      // Fondo y cuadrícula.
      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      ctx.fillRect(margenIzq, margenSup, anchoG, altoG);

      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#64748b";
      ctx.font = "11px system-ui";

      // Líneas horizontales de amplitud y.
      for (let v = 0.0; v <= yMaxEscala; v += 0.5) {
        const p = toPx(0, v);
        ctx.beginPath();
        ctx.moveTo(margenIzq, p.y);
        ctx.lineTo(margenIzq + anchoG, p.y);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.fillText(v.toFixed(1), margenIzq - 8, p.y + 4);
      }

      // Líneas verticales de tiempo t.
      ctx.textAlign = "center";
      for (let t = 0; t <= tMax; t += 2) {
        const p = toPx(t, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, margenSup);
        ctx.lineTo(p.x, margenSup + altoG);
        ctx.stroke();

        ctx.fillText(`${t}s`, p.x, margenSup + altoG + 16);
      }

      // 1. Banda de tolerancia del 2% [0.98, 1.02].
      const pBandaSup = toPx(0, 1.02);
      const pBandaInf = toPx(0, 0.98);
      ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
      ctx.fillRect(margenIzq, pBandaSup.y, anchoG, pBandaInf.y - pBandaSup.y);

      // 2. Línea de referencia objetivo escalón unitario r(t) = 1.0.
      const pRef = toPx(0, 1.0);
      ctx.beginPath();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.moveTo(margenIzq, pRef.y);
      ctx.lineTo(margenIzq + anchoG, pRef.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#b45309";
      ctx.textAlign = "left";
      ctx.fillText("Referencia r(t) = 1.0", margenIzq + 10, pRef.y - 6);

      // 3. Trazo progresivo de la curva temporal de respuesta y(t) hasta el índice animado.
      const maxIdx = Math.min(indicePaso, pts.length - 1);
      if (maxIdx > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2.5;
        for (let i = 0; i <= maxIdx; i++) {
          const pt = toPx(pts[i].t, pts[i].y);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Cabezal de escaneo luminoso con efecto de osciloscopio en el punto actual.
        const ptActual = toPx(pts[maxIdx].t, pts[maxIdx].y);
        ctx.beginPath();
        ctx.arc(ptActual.x, ptActual.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 4. Marcadores destacados de Sobrepico y Tiempo de Establecimiento si ya fueron alcanzados.
      const puntoPico = pts.find(p => p.t >= sim.tPico);
      if (sim.yMax > 1.0 && maxIdx >= (puntoPico ? pts.indexOf(puntoPico) : pts.length)) {
        const pPico = toPx(sim.tPico, sim.yMax);
        ctx.beginPath();
        ctx.arc(pPico.x, pPico.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#991b1b";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`Pico: ${sim.sobrepicoPct.toFixed(1)}%`, pPico.x, pPico.y - 10);
      }

      const puntoTs = pts.find(p => p.t >= sim.tEstablecimiento);
      if (sim.tEstablecimiento < tMax && maxIdx >= (puntoTs ? pts.indexOf(puntoTs) : pts.length)) {
        const pTs = toPx(sim.tEstablecimiento, 1.0);
        ctx.beginPath();
        ctx.moveTo(pTs.x, margenSup);
        ctx.lineTo(pTs.x, margenSup + altoG);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#059669";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`ts = ${sim.tEstablecimiento.toFixed(2)}s`, pTs.x, margenSup - 8);
      }

      // 5. HUD dinámico en esquina superior derecha con telemetría de control.
      const actualDato = pts[maxIdx];
      const [kp, ki, kd] = genoma;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(anchoCSS - 260, 10, 245, 60, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Ganancias: Kp=${kp.toFixed(2)} | Ki=${ki.toFixed(2)} | Kd=${kd.toFixed(2)}`, anchoCSS - 250, 28);
      ctx.fillText(`Salida y(t)=${actualDato.y.toFixed(3)} | Error e=${actualDato.e.toFixed(3)}`, anchoCSS - 250, 44);

      ctx.fillStyle = sim.esEstable ? "#4ade80" : "#f87171";
      ctx.fillText(`Lazo: ${sim.esEstable ? "ESTABLE ✓" : "INESTABLE ✕"} | T: ${actualDato.t.toFixed(2)}s`, anchoCSS - 250, 60);

      // Avance del barrido de tiempo con pausa de retención final.
      if (indicePaso < pts.length - 1) {
        indicePaso += 5;
      } else {
        contadorPausaFinal++;
        if (contadorPausaFinal > 80) {
          contadorPausaFinal = 0;
          indicePaso = 0;
        }
      }

      idAnimacionPID = requestAnimationFrame(animar);
    };

    idAnimacionPID = requestAnimationFrame(animar);
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
