// =========================================================================
// RENDERIZADOR 2: LIENZO ESPACIAL, CINEMÁTICA, CELOSÍAS Y RAYOS 2D
// CAPA VISTA: RENDERIZADO CANVAS 2D CON ESTÉTICA GOOGLE MATERIAL 3
// =========================================================================

// Renderiza nudos, barras estructurales, tensiones axiales, mecanismos articulados y rayos
export class LienzoGeometricoRenderer {
  // Inicializa el renderizador cinemático y estructural
  constructor() {
    this.animId = null;
  }

  // Detiene la animación activa
  detener() {
    if (this.animId !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.animId);
      }
      this.animId = null;
    }
  }

  // Prepara el contexto y escala de píxeles del lienzo (HiDPI)
  static ajustarCanvas(canvas) {
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const anchoCSS = canvas.clientWidth || 800;
    const altoCSS = canvas.clientHeight || 380;

    if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
      canvas.width = anchoCSS * dpr;
      canvas.height = altoCSS * dpr;
    }

    const ctx = canvas.getContext("2d");
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    return { ctx, ancho: anchoCSS, alto: altoCSS };
  }

  // Dibuja la escena de barras mecánicas, nudos articulados o trazado de rayos
  render(canvas, datosEscena, opciones = {}) {
    if (!canvas) return;
    this.detener();

    const { ctx, ancho, alto } = LienzoGeometricoRenderer.ajustarCanvas(canvas);
    const limites = datosEscena.limites || { xMin: -40, xMax: 40, yMin: -15, yMax: 35 };
    const escala = Math.min((ancho - 60) / (limites.xMax - limites.xMin), (alto - 60) / (limites.yMax - limites.yMin));
    const centroX = ancho / 2;
    const centroY = alto * 0.65;

    const aCanvas = (x, y) => ({
      x: centroX + x * escala,
      y: centroY - y * escala
    });

    // 1. Fondo técnico oscuro estilo CAD Material 3
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, ancho, alto);

    // 2. Cuadrícula métrica milimétrica
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = -60; x <= 60; x += 10) {
      const p0 = aCanvas(x, limites.yMin);
      const p1 = aCanvas(x, limites.yMax);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let y = -20; y <= 50; y += 10) {
      const p0 = aCanvas(limites.xMin, y);
      const p1 = aCanvas(limites.xMax, y);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // 3. Dibujo de barras estructurales (color según tracción/compresión axial)
    if (datosEscena.nudos && datosEscena.barras) {
      datosEscena.barras.forEach((b, idx) => {
        const na = datosEscena.nudos[b.nudoA];
        const nb = datosEscena.nudos[b.nudoB];
        if (!na || !nb) return;

        const pA = aCanvas(na.x, na.y);
        const pB = aCanvas(nb.x, nb.y);

        const fAxial = b.fuerzaAxial !== undefined ? b.fuerzaAxial : 0.0;
        const esCompresion = fAxial < 0.0;
        const esPandeo = b.hayPandeo || false;

        let strokeColor = "#38bdf8"; // Tracción (cian)
        if (esPandeo) {
          strokeColor = "#ef4444"; // Falla crítica por pandeo (rojo brillante)
        } else if (esCompresion) {
          strokeColor = "#f59e0b"; // Compresión (ámbar)
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(2.5, Math.min(8.0, 3.0 + Math.abs(fAxial) * 0.04));
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      });

      // 4. Dibujo de nudos articulados y apoyos
      datosEscena.nudos.forEach((nudo) => {
        const pt = aCanvas(nudo.x, nudo.y);

        if (nudo.fijo) {
          // Apoyo fijo a tierra (triángulo de pasador)
          ctx.fillStyle = "#64748b";
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - 9, pt.y + 14);
          ctx.lineTo(pt.x + 9, pt.y + 14);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pt.x - 14, pt.y + 14);
          ctx.lineTo(pt.x + 14, pt.y + 14);
          ctx.stroke();
        }

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // 5. Trazado de rayos acústicos/ópticos con desvanecimiento de energía
    if (datosEscena.rayos && datosEscena.rayos.length > 0) {
      datosEscena.rayos.forEach((camino) => {
        if (!camino || camino.length < 2) return;
        for (let i = 0; i < camino.length - 1; i++) {
          const p1 = aCanvas(camino[i].x, camino[i].y);
          const p2 = aCanvas(camino[i + 1].x, camino[i + 1].y);
          const alfa = Math.max(0.1, (camino[i].energia || 100.0) / 100.0);

          ctx.strokeStyle = `rgba(251, 191, 36, ${alfa})`;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });
    }

    // 6. Tarjeta HUD Material 3 con resumen de estado mecánico
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.fillRect(16, 16, 260, 72);
    ctx.strokeRect(16, 16, 260, 72);

    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "left";
    ctx.fillText("⚙️ Cinemática y Estructuras 2D", 26, 34);

    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    const numBarras = datosEscena.barras ? datosEscena.barras.length : 0;
    const numNudos = datosEscena.nudos ? datosEscena.nudos.length : 0;
    ctx.fillText(`Elementos: ${numBarras} barras | ${numNudos} nudos`, 26, 50);

    const masaTxt = datosEscena.masaTotalKg ? `Masa: ${datosEscena.masaTotalKg.toFixed(1)} kg` : "Simulación activa";
    ctx.fillText(masaTxt, 26, 68);
  }
}

export default LienzoGeometricoRenderer;
