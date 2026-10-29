// =========================================================================
// MÓDULO: MODELO ATERRIZAJE RETRO-PROPULSADO DE COHETE (FALCON BOOSTER)
// =========================================================================

// Simula la trayectoria física de descenso retro-propulsado paso a paso en el tiempo.
export function simularDescensoCohete(genoma, entrada) {
  const viento = Number(entrada?.viento !== undefined ? entrada.viento : 4.0);
  const alturaInicial = Number(entrada?.alturaInicial !== undefined ? entrada.alturaInicial : 120.0);

  // 4 fases de empuje vectorial: [F1, F2, F3, F4] en Newtons y [ang1, ang2, ang3, ang4] en grados.
  const [f1, f2, f3, f4, a1, a2, a3, a4] = genoma;
  const fuerzas = [f1, f2, f3, f4];
  const angulos = [a1, a2, a3, a4];

  const g = 9.81;
  const dt = 0.05;
  const masaSeca = 500;
  const combInicial = 500;
  let masa = masaSeca + combInicial;
  const tasaConsumo = 0.00045; // kg por Newton por segundo

  let x = 15.0; // Desplazamiento inicial lateral por desacople
  let y = alturaInicial;
  let vx = -2.0;
  let vy = -22.0; // Velocidad descendente inicial

  const trayectoria = [{ x, y, vx, vy, t: 0, empuje: 0, angulo: 0 }];
  let t = 0;
  const tiempoFase = 2.0; // Cada una de las 4 fases dura 2.0 segundos

  while (y > 0 && t < 10.0) {
    const faseIdx = Math.min(3, Math.floor(t / tiempoFase));
    let empuje = fuerzas[faseIdx];
    const angDeg = angulos[faseIdx];
    const angRad = (angDeg * Math.PI) / 180;

    // Si se agota el propelente, el empuje cesa.
    const combRestante = masa - masaSeca;
    if (combRestante <= 0) {
      empuje = 0;
    } else {
      const consumo = empuje * tasaConsumo * dt;
      masa -= Math.min(combRestante, consumo);
    }

    // Fuerzas aerodinámicas y vector de empuje del motor orientable.
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

    trayectoria.push({ x, y: Math.max(0, y), vx, vy, t, empuje, angulo: angDeg });
  }

  const puntoImpacto = trayectoria[trayectoria.length - 1];
  const velocidadImpacto = Math.hypot(puntoImpacto.vx, puntoImpacto.vy);
  const desvioPlataforma = Math.abs(puntoImpacto.x);
  const combustibleRestante = Math.max(0, masa - masaSeca);
  const combustibleGastadoPct = ((combInicial - combustibleRestante) / combInicial) * 100;

  // Aterrizaje exitoso: velocidad < 4 m/s y dentro de la barcaza flotante (|X| < 12m).
  const aterrizajeExitoso = velocidadImpacto <= 4.0 && desvioPlataforma <= 12.0 && Math.abs(puntoImpacto.vy) <= 3.5;

  return {
    trayectoria,
    velocidadImpacto,
    desvioPlataforma,
    combustibleRestante,
    combustibleGastadoPct,
    aterrizajeExitoso,
    tiempoVuelo: t,
    viento,
    alturaInicial
  };
}

// Objeto de contrato del modelo de aterrizaje de cohete para el motor evolutivo.
export const ModeloCoheteLanding = {
  id: "cohete-landing",
  nombre: "Aterrizaje de Cohete (Falcon Landing)",
  descripcion: "Control de empuje vectorial de un cohete en descenso retro-propulsado para tocar una plataforma marina con velocidad nula minimizando combustible.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Velocidad de Impacto (m/s)", "Combustible Consumido (%)"],

  // Parámetros de entorno configurables por el usuario.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Suavidad vs. Combustible)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Aterrizaje seguro)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "alturaInicial", etiqueta: "Altitud Inicial (metros)", tipo: "numero", min: 80, max: 200, paso: 10, valorDefecto: 120 },
    { clave: "viento", etiqueta: "Viento Lateral (m/s)", tipo: "numero", min: -15, max: 15, paso: 1, valorDefecto: 4 }
  ],

  // 8 genes: [Fuerza 1..4 en Newtons (0..20000), Ángulos 1..4 en grados (-15..15)].
  crearGenoma() {
    return [
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: -15, max: 15 },
      { tipo: "continuo", min: -15, max: 15 },
      { tipo: "continuo", min: -15, max: 15 },
      { tipo: "continuo", min: -15, max: 15 }
    ];
  },

  // Evalúa la suavidad del contacto en la barcaza y el ahorro de combustible.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularDescensoCohete(genoma, entrada);

    // Penalizaciones por impacto severo o caída fuera de la plataforma marina.
    let penalizacionCrash = 0;
    if (sim.velocidadImpacto > 4.0) {
      penalizacionCrash += (sim.velocidadImpacto - 4.0) * 8.0;
    }
    if (sim.desvioPlataforma > 12.0) {
      penalizacionCrash += (sim.desvioPlataforma - 12.0) * 5.0;
    }

    const objVelocidad = sim.velocidadImpacto + sim.desvioPlataforma * 0.4 + penalizacionCrash;
    const objCombustible = sim.combustibleGastadoPct / 100 + (penalizacionCrash > 0 ? 1.0 : 0);

    if (esMulti) {
      return [objVelocidad, objCombustible];
    }

    return objVelocidad * 2.5 + objCombustible * 15.0;
  },

  // Dibuja en Canvas 2D el océano, la barcaza flotante, la trayectoria de humo y el cohete con fuego vectorial.
  dibujar(genoma, entrada, contenedor) {
    if (!contenedor) return;

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

    const sim = simularDescensoCohete(genoma, entrada);
    const tray = sim.trayectoria;

    // Configuración del sistema de coordenadas con el nivel del mar en la parte inferior.
    const nivelMarY = altoCSS - 35;
    const centroX = anchoCSS * 0.5;
    const escalaY = (altoCSS - 70) / (sim.alturaInicial || 120);
    const escalaX = escalaY;

    const toPx = (x, y) => ({
      x: centroX + x * escalaX,
      y: nivelMarY - y * escalaY
    });

    // 1. Cielo crepuscular con gradiente atmosférico.
    const gradCielo = ctx.createLinearGradient(0, 0, 0, nivelMarY);
    gradCielo.addColorStop(0, "#091325");
    gradCielo.addColorStop(0.7, "#172554");
    gradCielo.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = gradCielo;
    ctx.fillRect(0, 0, anchoCSS, nivelMarY);

    // 2. Mar profundo con oleaje.
    const gradMar = ctx.createLinearGradient(0, nivelMarY, 0, altoCSS);
    gradMar.addColorStop(0, "#0284c7");
    gradMar.addColorStop(1, "#0369a1");
    ctx.fillStyle = gradMar;
    ctx.fillRect(0, nivelMarY, anchoCSS, altoCSS - nivelMarY);

    // 3. Barcaza marina flotante ("ASOG") en X=0.
    const anchoBarcazaPx = 28 * escalaX;
    const pMar = toPx(0, 0);

    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.roundRect(pMar.x - anchoBarcazaPx / 2, pMar.y - 6, anchoBarcazaPx, 10, 3);
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Balizas luminosas en los extremos de la barcaza.
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(pMar.x - anchoBarcazaPx / 2 + 3, pMar.y - 6, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(pMar.x + anchoBarcazaPx / 2 - 3, pMar.y - 6, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Diana central sobre la cubierta.
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pMar.x, pMar.y - 1, 8, 0, 2 * Math.PI);
    ctx.stroke();

    // 4. Trazado de la trayectoria de descenso con estela de humo.
    if (tray.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
      ctx.lineWidth = 3;
      for (let i = 0; i < tray.length; i++) {
        const pt = toPx(tray[i].x, tray[i].y);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // 5. Cohete y fuego vectorial en la posición final de contacto.
    const ultimo = tray[tray.length - 1];
    const pFin = toPx(ultimo.x, ultimo.y);

    const altoCohete = 32;
    const anchoCohete = 7;
    const angRad = (ultimo.angulo * Math.PI) / 180;

    ctx.save();
    ctx.translate(pFin.x, pFin.y - altoCohete / 2);
    ctx.rotate(angRad * 0.4);

    // Llama de propulsión si el motor estaba encendido.
    if (ultimo.empuje > 500) {
      const longLlama = Math.min(35, (ultimo.empuje / 20000) * 35);
      const gradFuego = ctx.createLinearGradient(0, altoCohete / 2, 0, altoCohete / 2 + longLlama);
      gradFuego.addColorStop(0, "#ffffff");
      gradFuego.addColorStop(0.3, "#fde047");
      gradFuego.addColorStop(0.7, "#f97316");
      gradFuego.addColorStop(1, "rgba(239, 68, 68, 0)");

      ctx.beginPath();
      ctx.moveTo(-anchoCohete / 2, altoCohete / 2);
      ctx.lineTo(0, altoCohete / 2 + longLlama);
      ctx.lineTo(anchoCohete / 2, altoCohete / 2);
      ctx.closePath();
      ctx.fillStyle = gradFuego;
      ctx.fill();
    }

    // Fuselaje blanco aerodinámico del cohete.
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-anchoCohete / 2, -altoCohete / 2, anchoCohete, altoCohete, 2);
    ctx.fill();
    ctx.stroke();

    // Ogiva o punta superior.
    ctx.beginPath();
    ctx.moveTo(-anchoCohete / 2, -altoCohete / 2);
    ctx.lineTo(0, -altoCohete / 2 - 7);
    ctx.lineTo(anchoCohete / 2, -altoCohete / 2);
    ctx.closePath();
    ctx.fillStyle = "#0f172a";
    ctx.fill();

    // Patas de aterrizaje desplegadas.
    ctx.beginPath();
    ctx.moveTo(-anchoCohete / 2, altoCohete / 2 - 4);
    ctx.lineTo(-anchoCohete / 2 - 8, altoCohete / 2 + 5);
    ctx.moveTo(anchoCohete / 2, altoCohete / 2 - 4);
    ctx.lineTo(anchoCohete / 2 + 8, altoCohete / 2 + 5);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // 6. HUD de telemetría en esquina superior izquierda.
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 300, 60, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText(`Velocidad de Contacto : ${sim.velocidadImpacto.toFixed(2)} m/s (Límite: 4.0)`, 24, 32);
    ctx.fillText(`Desvío de Barcaza    : ${sim.desvioPlataforma.toFixed(2)} m (Radio: 12.0)`, 24, 48);

    ctx.fillStyle = sim.aterrizajeExitoso ? "#4ade80" : "#f87171";
    ctx.fillText(`Estado Misión: ${sim.aterrizajeExitoso ? "¡ATERRIZAJE PERFECTO ✓!" : "IMPACTO DESTRUCTIVO 💥"} (Comb: ${sim.combustibleRestante.toFixed(0)} kg)`, 24, 64);
  },

  // Genera el informe textual detallado con las fases de empuje y la telemetría de contacto.
  describir(genoma, entrada) {
    const sim = simularDescensoCohete(genoma, entrada);
    const [f1, f2, f3, f4, a1, a2, a3, a4] = genoma;

    let texto = `PROPULSOR ESPACIAL RETRO-PROPULSADO - TELEMETRÍA DE DESCENSO\n`;
    texto += `========================================================================\n`;
    texto += `CONDICIONES DE ENTORNO:\n`;
    texto += `  • Altitud de entrada      : ${sim.alturaInicial.toFixed(1)} m\n`;
    texto += `  • Viento lateral oceánico : ${sim.viento.toFixed(1)} m/s\n`;
    texto += `  • Duración total de vuelo : ${sim.tiempoVuelo.toFixed(2)} s\n\n`;

    texto += `PARÁMETROS DE TOBERA POR FASE:\n`;
    texto += `  Fase 1 (0-2s) : Empuje = ${f1.toFixed(0).padStart(5, " ")} N | Inclinación = ${a1.toFixed(1)}°\n`;
    texto += `  Fase 2 (2-4s) : Empuje = ${f2.toFixed(0).padStart(5, " ")} N | Inclinación = ${a2.toFixed(1)}°\n`;
    texto += `  Fase 3 (4-6s) : Empuje = ${f3.toFixed(0).padStart(5, " ")} N | Inclinación = ${a3.toFixed(1)}°\n`;
    texto += `  Fase 4 (6-8s) : Empuje = ${f4.toFixed(0).padStart(5, " ")} N | Inclinación = ${a4.toFixed(1)}°\n\n`;

    texto += `MÉTRICAS DE CONTACTO EN CUBIERTA:\n`;
    texto += `  • Velocidad de impacto    : ${sim.velocidadImpacto.toFixed(2)} m/s (Máx seguro: 4.0 m/s)\n`;
    texto += `  • Desvío sobre barcaza    : ${sim.desvioPlataforma.toFixed(2)} m (Radio cubierta: 12.0 m)\n`;
    texto += `  • Combustible consumido   : ${sim.combustibleGastadoPct.toFixed(1)}% (Remanente: ${sim.combustibleRestante.toFixed(1)} kg)\n`;
    texto += `  • RESULTADO DE LA MISIÓN  : ${sim.aterrizajeExitoso ? "ATERRIZAJE EXITOSO (BOOSTER RECUPERADO) ✓" : "PÉRDIDA DEL VEHÍCULO POR IMPACTO ✕"}\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloCoheteLanding;
