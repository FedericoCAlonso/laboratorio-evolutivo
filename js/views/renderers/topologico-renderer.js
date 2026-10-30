// =========================================================================
// RENDERIZADOR 3: LIENZO TOPOLÓGICO, CORTE DE CHAPA (NESTING 2D) Y BALANCEO
// CAPA VISTA: RENDERIZADO CANVAS 2D CON ESTÉTICA GOOGLE MATERIAL 3
// =========================================================================

// Renderiza planos de corte de chapa (nesting de piezas), retazos y balance de fases
export class LienzoTopologicoRenderer {
  // Inicializa el renderizador topológico
  constructor() {
    this.animId = null;
  }

  // Cancela la animación activa
  detener() {
    if (this.animId !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.animId);
      }
      this.animId = null;
    }
  }

  // Ajusta la resolución del canvas según la densidad de píxeles (HiDPI)
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

  // Renderiza el plano de anidado de corte o la distribución combinatoria de cargas
  render(canvas, datosTopologia, opciones = {}) {
    if (!canvas) return;
    this.detener();

    const { ctx, ancho, alto } = LienzoTopologicoRenderer.ajustarCanvas(canvas);

    // Fondo oscuro Material 3
    ctx.fillStyle = "#0c111c";
    ctx.fillRect(0, 0, ancho, alto);

    // MODO 1: CORTE DE CHAPA Y ANIDADO DE PIEZAS (NESTING 2D)
    if (datosTopologia.anchoChapa && datosTopologia.altoChapa) {
      const margenX = 50;
      const margenY = 60;
      const anchoDisp = ancho - margenX * 2 - 180;
      const altoDisp = alto - margenY * 2;

      const escala = Math.min(anchoDisp / datosTopologia.anchoChapa, altoDisp / datosTopologia.altoChapa);
      const chapaW = datosTopologia.anchoChapa * escala;
      const chapaH = datosTopologia.altoChapa * escala;
      const origenX = margenX;
      const origenY = margenY;

      // Chapa matriz (base de acero o madera con rayado de desperdicio)
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(origenX, origenY, chapaW, chapaH);

      // Rayado diagonal sutil en la chapa que representa material sobrante
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      for (let d = -chapaH; d < chapaW; d += 16) {
        ctx.beginPath();
        ctx.moveTo(origenX + Math.max(0, d), origenY + Math.max(0, -d));
        ctx.lineTo(origenX + Math.min(chapaW, d + chapaH), origenY + Math.min(chapaH, chapaH));
        ctx.stroke();
      }

      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.strokeRect(origenX, origenY, chapaW, chapaH);

      // Cotas de la chapa matriz
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${datosTopologia.anchoChapa.toFixed(0)} mm`, origenX + chapaW / 2, origenY - 10);
      ctx.textAlign = "right";
      ctx.fillText(`${datosTopologia.altoChapa.toFixed(0)} mm`, origenX - 10, origenY + chapaH / 2);

      // Dibujo de piezas colocadas con esquinas redondeadas y colores Material 3
      const piezas = datosTopologia.piezasColocadas || [];
      const paleta = ["#38bdf8", "#34d399", "#f59e0b", "#ec4899", "#818cf8", "#a78bfa"];

      piezas.forEach((pz, idx) => {
        const px = origenX + pz.x * escala;
        const py = origenY + pz.y * escala;
        const pw = pz.w * escala;
        const ph = pz.h * escala;
        const color = pz.color || paleta[idx % paleta.length];

        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`P${pz.id || idx + 1}`, px + pw / 2, py + ph / 2 + 3);
      });

      // Panel lateral derecho de estadísticas de corte
      const panelX = origenX + chapaW + 25;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.fillRect(panelX, origenY, 190, chapaH);
      ctx.strokeRect(panelX, origenY, 190, chapaH);

      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "left";
      ctx.fillText("📦 Corte de Chapa (Nesting)", panelX + 12, origenY + 24);

      const aprov = datosTopologia.porcentajeAprovechamiento || 0.0;
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillStyle = aprov >= 75.0 ? "#00e676" : "#f59e0b";
      ctx.fillText(`Aprovechamiento: ${aprov.toFixed(1)}%`, panelX + 12, origenY + 48);

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Desperdicio: ${(100.0 - aprov).toFixed(1)}%`, panelX + 12, origenY + 68);
      ctx.fillText(`Piezas: ${piezas.length} anidadas`, panelX + 12, origenY + 88);

      // Barra visual de porcentaje de llenado
      ctx.fillStyle = "#334155";
      ctx.fillRect(panelX + 12, origenY + 104, 166, 12);
      ctx.fillStyle = aprov >= 75.0 ? "#00e676" : "#f59e0b";
      ctx.fillRect(panelX + 12, origenY + 104, (aprov / 100.0) * 166, 12);

    } else if (datosTopologia.totalesFase) {
      // MODO 2: BALANCEO DE FASES ELÉCTRICAS
      const fases = datosTopologia.totalesFase;
      const maxFase = Math.max(...fases, 100.0);
      const nombresFases = ["Fase R", "Fase S", "Fase T"];
      const colores = ["#ef4444", "#38bdf8", "#f59e0b"];

      const baseGraficoY = alto - 60;
      const anchoBarra = 70;
      const espacio = 50;
      const inicioX = (ancho - (fases.length * anchoBarra + (fases.length - 1) * espacio)) / 2;

      fases.forEach((val, i) => {
        const x = inicioX + i * (anchoBarra + espacio);
        const h = (val / maxFase) * 200;
        const y = baseGraficoY - h;

        ctx.fillStyle = colores[i % colores.length];
        ctx.beginPath();
        ctx.roundRect(x, y, anchoBarra, h, [6, 6, 0, 0]);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${val.toFixed(0)} kW`, x + anchoBarra / 2, y - 8);

        ctx.fillStyle = "#94a3b8";
        ctx.fillText(nombresFases[i] || `F${i + 1}`, x + anchoBarra / 2, baseGraficoY + 20);
      });

      // Línea de promedio ideal
      if (datosTopologia.promedio) {
        const yProm = baseGraficoY - (datosTopologia.promedio / maxFase) * 200;
        ctx.strokeStyle = "#00e676";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(inicioX - 20, yProm);
        ctx.lineTo(inicioX + fases.length * (anchoBarra + espacio), yProm);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

export default LienzoTopologicoRenderer;
