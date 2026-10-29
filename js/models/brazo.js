// =========================================================================
// MÓDULO: MODELO BRAZO ROBÓTICO PLANAR (CINEMÁTICA INVERSA CON OBSTÁCULO)
// =========================================================================

// Identificador del temporizador de animación requestAnimationFrame para el brazo robótico.
let idAnimacionBrazo = null;

// Longitudes fijas de los 3 eslabones del brazo manipulador en unidades de modelado.
export const LONGITUDES_ESLABONES_BRAZO = [45, 35, 25];

// Calcula la distancia mínima euclidiana desde un punto P hasta un segmento de recta AB.
function distanciaPuntoASegmento(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const longCuad = abx * abx + aby * aby;
  if (longCuad === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Proyección escalar t acotada al intervalo [0, 1] del segmento.
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / longCuad;
  t = Math.max(0, Math.min(1, t));

  const proyX = a.x + t * abx;
  const proyY = a.y + t * aby;
  return Math.hypot(p.x - proyX, p.y - proyY);
}

// Resuelve la cinemática directa del manipulador de 3 articulaciones a partir de los ángulos en grados.
export function resolverCinematicaBrazo(genoma) {
  const [th1Deg, th2Deg, th3Deg] = genoma;
  const [L1, L2, L3] = LONGITUDES_ESLABONES_BRAZO;

  const a1 = (th1Deg * Math.PI) / 180;
  const a2 = a1 + (th2Deg * Math.PI) / 180;
  const a3 = a2 + (th3Deg * Math.PI) / 180;

  const p0 = { x: 0, y: 0 };
  const p1 = { x: L1 * Math.cos(a1), y: L1 * Math.sin(a1) };
  const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) };
  const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) };

  return { p0, p1, p2, p3, a1, a2, a3 };
}

// Objeto de definición del modelo para el optimizador evolutivo.
export const ModeloBrazoRobotico = {
  id: "brazo-robotico",
  nombre: "Brazo Robótico (Cinemática Inversa)",
  descripcion: "Manipulador planar de 3 eslabones articulados que optimiza la orientación de sus articulaciones para alcanzar un punto objetivo evadiendo un obstáculo circular.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Distancia al Blanco (mm)", "Esfuerzo Angular"],

  // Parámetros de entrada interactivos para posicionar el blanco y el obstáculo.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Precisión vs. Esfuerzo)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Precisión ponderada)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "objetivoX", etiqueta: "Coordenada Objetivo X", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 55 },
    { clave: "objetivoY", etiqueta: "Coordenada Objetivo Y", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 40 },
    { clave: "obstaculoX", etiqueta: "Centro Obstáculo X", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 30 },
    { clave: "obstaculoY", etiqueta: "Centro Obstáculo Y", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 20 },
    { clave: "obstaculoRadio", etiqueta: "Radio Obstáculo", tipo: "numero", min: 5, max: 40, paso: 2, valorDefecto: 16 }
  ],

  // Define los 3 genes correspondientes a los ángulos theta1, theta2 y theta3 en grados [-180, 180].
  crearGenoma() {
    return [
      { tipo: "continuo", min: -180, max: 180 },
      { tipo: "continuo", min: -180, max: 180 },
      { tipo: "continuo", min: -180, max: 180 }
    ];
  },

  // Evalúa la distancia al objetivo, la evasión del obstáculo y el esfuerzo cinemático acumulado.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const targetX = Number(entrada?.objetivoX !== undefined ? entrada.objetivoX : 55);
    const targetY = Number(entrada?.objetivoY !== undefined ? entrada.objetivoY : 40);
    const obsX = Number(entrada?.obstaculoX !== undefined ? entrada.obstaculoX : 30);
    const obsY = Number(entrada?.obstaculoY !== undefined ? entrada.obstaculoY : 20);
    const obsRadio = Number(entrada?.obstaculoRadio !== undefined ? entrada.obstaculoRadio : 16);

    const { p0, p1, p2, p3 } = resolverCinematicaBrazo(genoma);

    // Verificación de colisión de los 3 eslabones contra el obstáculo circular.
    const puntoObs = { x: obsX, y: obsY };
    const d0 = distanciaPuntoASegmento(puntoObs, p0, p1);
    const d1 = distanciaPuntoASegmento(puntoObs, p1, p2);
    const d2 = distanciaPuntoASegmento(puntoObs, p2, p3);
    const minDistObstaculo = Math.min(d0, d1, d2);

    // Distancia euclidiana del efector final al objetivo.
    const distObjetivo = Math.hypot(p3.x - targetX, p3.y - targetY);

    // Penalización por colisión si algún eslabón invade el radio de seguridad.
    let penalizacionColision = 0;
    if (minDistObstaculo < obsRadio) {
      penalizacionColision = 300 + (obsRadio - minDistObstaculo) * 15;
    }

    // Esfuerzo angular acumulado normalizado respecto al punto de reposo (ángulos 0).
    const esfuerzoAngular = (Math.abs(genoma[0]) + Math.abs(genoma[1]) + Math.abs(genoma[2])) / 540;

    if (esMulti) {
      // Objetivo 1 (Precisión): Distancia con penalización de colisión.
      // Objetivo 2 (Esfuerzo): Desplazamiento articular para suavizar la cinemática.
      return [
        distObjetivo + penalizacionColision,
        esfuerzoAngular + (penalizacionColision > 0 ? 2.0 : 0)
      ];
    }

    return distObjetivo + esfuerzoAngular * 15 + penalizacionColision;
  },

  // Detiene el ciclo continuo de animación en requestAnimationFrame.
  detenerAnimacion() {
    if (idAnimacionBrazo !== null) {
      cancelAnimationFrame(idAnimacionBrazo);
      idAnimacionBrazo = null;
    }
  },

  // Dibuja en Canvas 2D el brazo mecánico articulado con animación cinemática fluida, trayectoria y HUD.
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

    const targetX = Number(entrada?.objetivoX !== undefined ? entrada.objetivoX : 55);
    const targetY = Number(entrada?.objetivoY !== undefined ? entrada.objetivoY : 40);
    const obsX = Number(entrada?.obstaculoX !== undefined ? entrada.obstaculoX : 30);
    const obsY = Number(entrada?.obstaculoY !== undefined ? entrada.obstaculoY : 20);
    const obsRadio = Number(entrada?.obstaculoRadio !== undefined ? entrada.obstaculoRadio : 16);

    const [targetTh1, targetTh2, targetTh3] = genoma;
    let tiempoAnimacion = 0;
    const historialEfector = [];

    const animar = () => {
      if (!canvas.isConnected) {
        if (idAnimacionBrazo !== null) {
          cancelAnimationFrame(idAnimacionBrazo);
          idAnimacionBrazo = null;
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

      // Movimiento oscilatorio suave de alcance y retracción hacia la posición óptima evolucionada.
      const factorInterpolacion = 0.5 - 0.5 * Math.cos(tiempoAnimacion);
      const th1Actual = targetTh1 * factorInterpolacion;
      const th2Actual = targetTh2 * factorInterpolacion;
      const th3Actual = targetTh3 * factorInterpolacion;

      // Sistema de coordenadas centrado en la base del manipulador.
      const origenX = anchoCSS * 0.35;
      const origenY = altoCSS * 0.55;
      const escala = Math.min(anchoCSS, altoCSS) / 220;

      const toPx = (p) => ({
        x: origenX + p.x * escala,
        y: origenY - p.y * escala
      });

      // Fondo y cuadrícula cartesiana suave.
      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      ctx.fillRect(0, 0, anchoCSS, altoCSS);

      ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
      ctx.lineWidth = 1;
      for (let x = -100; x <= 120; x += 20) {
        const p = toPx({ x, y: 0 });
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, altoCSS);
        ctx.stroke();
      }
      for (let y = -80; y <= 80; y += 20) {
        const p = toPx({ x: 0, y });
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(anchoCSS, p.y);
        ctx.stroke();
      }

      // 1. Dibujo del obstáculo circular de colisión.
      const pObs = toPx({ x: obsX, y: obsY });
      const rObsPx = obsRadio * escala;

      ctx.beginPath();
      ctx.arc(pObs.x, pObs.y, rObsPx, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("Zona Prohibida", pObs.x, pObs.y - rObsPx - 6);

      // 2. Dibujo del objetivo (diana de precisión con pulso animado).
      const pTar = toPx({ x: targetX, y: targetY });
      const pulsoRadio = 14 + 2 * Math.sin(tiempoAnimacion * 4);

      ctx.beginPath();
      ctx.arc(pTar.x, pTar.y, pulsoRadio, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pTar.x, pTar.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#10b981";
      ctx.fill();

      // Cruz de mira telescópica en el blanco.
      ctx.beginPath();
      ctx.moveTo(pTar.x - 18, pTar.y);
      ctx.lineTo(pTar.x + 18, pTar.y);
      ctx.moveTo(pTar.x, pTar.y - 18);
      ctx.lineTo(pTar.x, pTar.y + 18);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#059669";
      ctx.textAlign = "center";
      ctx.fillText("Blanco", pTar.x, pTar.y + 26);

      // 3. Resolución cinemática y dibujo del manipulador robótico.
      const { p0, p1, p2, p3 } = resolverCinematicaBrazo([th1Actual, th2Actual, th3Actual]);
      const px0 = toPx(p0);
      const px1 = toPx(p1);
      const px2 = toPx(p2);
      const px3 = toPx(p3);

      // Trazo de estela del efector final.
      historialEfector.push(px3);
      if (historialEfector.length > 80) historialEfector.shift();

      if (historialEfector.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        for (let i = 0; i < historialEfector.length; i++) {
          const pt = historialEfector[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pedestal de la base fija.
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.roundRect(px0.x - 22, px0.y - 10, 44, 20, 6);
      ctx.fill();

      // Función auxiliar para dibujar un eslabón con acabado de barra industrial.
      const dibujarEslabon = (inicio, fin, color, grosor) => {
        ctx.beginPath();
        ctx.moveTo(inicio.x, inicio.y);
        ctx.lineTo(fin.x, fin.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = grosor;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(inicio.x, inicio.y);
        ctx.lineTo(fin.x, fin.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = grosor * 0.3;
        ctx.stroke();
      };

      dibujarEslabon(px0, px1, "#0284c7", 12);
      dibujarEslabon(px1, px2, "#0369a1", 10);
      dibujarEslabon(px2, px3, "#075985", 8);

      // Articulaciones rotativas (rodamientos).
      const dibujarArticulacion = (pt, radio, label = "") => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radio, 0, 2 * Math.PI);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radio * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = "#0284c7";
        ctx.fill();

        if (label) {
          ctx.fillStyle = "#64748b";
          ctx.font = "10px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(label, pt.x, pt.y + radio + 12);
        }
      };

      dibujarArticulacion(px0, 9, `θ1:${th1Actual.toFixed(0)}°`);
      dibujarArticulacion(px1, 8, `θ2:${th2Actual.toFixed(0)}°`);
      dibujarArticulacion(px2, 7, `θ3:${th3Actual.toFixed(0)}°`);

      // Efector final (pinza / cabezal de agarre).
      ctx.beginPath();
      ctx.arc(px3.x, px3.y, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Línea de distancia residual al blanco.
      ctx.beginPath();
      ctx.moveTo(px3.x, px3.y);
      ctx.lineTo(pTar.x, pTar.y);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Diagnóstico cinemático y banner informativo.
      const distReal = Math.hypot(p3.x - targetX, p3.y - targetY);
      const d0 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p0, p1);
      const d1 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p1, p2);
      const d2 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p2, p3);
      const minObs = Math.min(d0, d1, d2);
      const colisiona = minObs < obsRadio;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 310, 60, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Distancia al Blanco: ${distReal.toFixed(2)} mm (Efector: ${p3.x.toFixed(1)}, ${p3.y.toFixed(1)})`, 24, 34);

      ctx.fillStyle = colisiona ? "#f87171" : "#4ade80";
      ctx.fillText(`Obstáculo: ${colisiona ? "COLISIÓN ⚠️" : "EVADIDO ✓"} (Dist: ${minObs.toFixed(1)} mm) | Mov: ${(factorInterpolacion * 100).toFixed(0)}%`, 24, 54);

      tiempoAnimacion += 0.035;
      idAnimacionBrazo = requestAnimationFrame(animar);
    };

    idAnimacionBrazo = requestAnimationFrame(animar);
  },

  // Genera un reporte textual exhaustivo con los ángulos articulares y estado cinemático del robot.
  describir(genoma, entrada) {
    const targetX = Number(entrada?.objetivoX !== undefined ? entrada.objetivoX : 55);
    const targetY = Number(entrada?.objetivoY !== undefined ? entrada.objetivoY : 40);
    const obsX = Number(entrada?.obstaculoX !== undefined ? entrada.obstaculoX : 30);
    const obsY = Number(entrada?.obstaculoY !== undefined ? entrada.obstaculoY : 20);
    const obsRadio = Number(entrada?.obstaculoRadio !== undefined ? entrada.obstaculoRadio : 16);

    const { p0, p1, p2, p3 } = resolverCinematicaBrazo(genoma);
    const distReal = Math.hypot(p3.x - targetX, p3.y - targetY);

    const d0 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p0, p1);
    const d1 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p1, p2);
    const d2 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p2, p3);
    const minDistObs = Math.min(d0, d1, d2);
    const colisiona = minDistObs < obsRadio;

    const [th1, th2, th3] = genoma;
    const esfuerzo = Math.abs(th1) + Math.abs(th2) + Math.abs(th3);

    let texto = `MANIPULADOR ROBÓTICO PLANAR (3 ESLABONES) - CINEMÁTICA INVERSA\n`;
    texto += `========================================================================\n`;
    texto += `COORDINADAS Y PRECISIÓN:\n`;
    texto += `  • Objetivo deseado (X, Y)  : (${targetX.toFixed(1)}, ${targetY.toFixed(1)}) mm\n`;
    texto += `  • Efector final alcanzado   : (${p3.x.toFixed(2)}, ${p3.y.toFixed(2)}) mm\n`;
    texto += `  • Error de precisión final  : ${distReal.toFixed(3)} mm\n\n`;

    texto += `SEGURIDAD Y EVASIÓN DE OBSTÁCULOS:\n`;
    texto += `  • Centro del obstáculo (X, Y): (${obsX.toFixed(1)}, ${obsY.toFixed(1)}) mm (Radio: ${obsRadio} mm)\n`;
    texto += `  • Distancia mínima al centro : ${minDistObs.toFixed(2)} mm\n`;
    texto += `  • Diagnóstico de colisión    : ${colisiona ? "FALLIDO (Impacto en zona prohibida) ✕" : "SEGURO (Evasión exitosa) ✓"}\n\n`;

    texto += `CONFIGURACIÓN ARTICULAR (GENES EVOLUCIONADOS):\n`;
    texto += `  • Articulación 1 (Hombro θ₁) : ${th1.toFixed(2)}°\n`;
    texto += `  • Articulación 2 (Codo θ₂)   : ${th2.toFixed(2)}°\n`;
    texto += `  • Articulación 3 (Muñeca θ₃) : ${th3.toFixed(2)}°\n`;
    texto += `  • Desplazamiento angular total: ${esfuerzo.toFixed(1)}°\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloBrazoRobotico;
