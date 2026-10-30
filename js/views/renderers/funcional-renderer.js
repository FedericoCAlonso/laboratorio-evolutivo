// =========================================================================
// RENDERIZADOR 4: LIENZO FUNCIONAL, CARTA DE SMITH Y ANÁLISIS ESPECTRAL
// CAPA VISTA: RENDERIZADO CANVAS 2D CON ESTÉTICA GOOGLE MATERIAL 3
// =========================================================================

// Renderiza la Carta de Smith interactiva, trayectorias de impedancia y curvas de respuesta en frecuencia
export class LienzoFuncionalRenderer {
  // Inicializa el renderizador funcional
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

  // Renderiza la Carta de Smith polar completa con trayectorias de adaptación
  render(canvas, datosFuncionales, opciones = {}) {
    if (!canvas) return;
    this.detener();

    const { ctx, ancho, alto } = LienzoFuncionalRenderer.ajustarCanvas(canvas);

    // Fondo oscuro Material 3
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, ancho, alto);

    // 1. DIBUJO DE LA CARTA DE SMITH POLAR
    const radioCarta = Math.min((ancho - 300) / 2.0, (alto - 50) / 2.0);
    const centroX = radioCarta + 45;
    const centroY = alto / 2;

    const aSmith = (u, v) => ({
      x: centroX + u * radioCarta,
      y: centroY - v * radioCarta
    });

    // Fondo circular de la carta
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(centroX, centroY, radioCarta, 0, Math.PI * 2);
    ctx.fill();

    // Eje horizontal de resistencia pura (reactancia = 0)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(centroX - radioCarta, centroY);
    ctx.lineTo(centroX + radioCarta, centroY);
    ctx.stroke();

    // Círculos de resistencia constante r: centro en (r/(1+r), 0) y radio 1/(1+r)
    const resistenciasR = [0.0, 0.2, 0.5, 1.0, 2.0, 5.0];
    resistenciasR.forEach((r) => {
      const cU = r / (1.0 + r);
      const radU = 1.0 / (1.0 + r);
      const ptCentro = aSmith(cU, 0);

      ctx.strokeStyle = r === 1.0 ? "rgba(56, 189, 248, 0.5)" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = r === 1.0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(ptCentro.x, ptCentro.y, radU * radioCarta, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Arcos de reactancia constante x: centro en (1, 1/x) y radio 1/|x|
    const reactanciasX = [0.2, 0.5, 1.0, 2.0];
    reactanciasX.forEach((xVal) => {
      [xVal, -xVal].forEach((x) => {
        const ptCentro = aSmith(1.0, 1.0 / x);
        const radX = (1.0 / Math.abs(x)) * radioCarta;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ptCentro.x, ptCentro.y, radX, 0, Math.PI * 2);
        ctx.stroke();
      });
    });

    // Círculo exterior límite unitario |Gamma| = 1.0
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centroX, centroY, radioCarta, 0, Math.PI * 2);
    ctx.stroke();

    // Punto central de adaptación perfecta: Z = Z0 (50 ohms puros, ROE = 1.0)
    ctx.fillStyle = "#00e676";
    ctx.beginPath();
    ctx.arc(centroX, centroY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Trayectoria de impedancia en frecuencia sobre la Carta de Smith
    if (datosFuncionales.puntosSmith && datosFuncionales.puntosSmith.length > 0) {
      const pts = datosFuncionales.puntosSmith;
      ctx.beginPath();
      const pIni = aSmith(pts[0].gammaU, pts[0].gammaV);
      ctx.moveTo(pIni.x, pIni.y);

      for (let i = 1; i < pts.length; i++) {
        const pt = aSmith(pts[i].gammaU, pts[i].gammaV);
        ctx.lineTo(pt.x, pt.y);
      }

      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Punto actual / final de frecuencia
      const pFin = aSmith(pts[pts.length - 1].gammaU, pts[pts.length - 1].gammaV);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pFin.x, pFin.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Panel lateral Material 3 de parámetros de transmisión RF
    const panelX = centroX + radioCarta + 25;
    const panelW = ancho - panelX - 20;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.fillRect(panelX, 25, panelW, alto - 50);
    ctx.strokeRect(panelX, 25, panelW, alto - 50);

    ctx.font = "bold 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "left";
    ctx.fillText("📈 Carta de Smith y Línea RF", panelX + 14, 50);

    const roe = datosFuncionales.roe || 1.0;
    const roeColor = roe <= 1.5 ? "#00e676" : (roe <= 2.5 ? "#f59e0b" : "#ef4444");

    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Relación de Onda Estacionaria (ROE):", panelX + 14, 80);
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = roeColor;
    ctx.fillText(`${roe.toFixed(2)} : 1`, panelX + 14, 106);

    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    const rlDb = datosFuncionales.perdidasRetornoDb !== undefined ? datosFuncionales.perdidasRetornoDb.toFixed(1) : "--";
    ctx.fillText(`Pérdidas de Retorno: ${rlDb} dB`, panelX + 14, 136);

    const zinR = datosFuncionales.zinR !== undefined ? datosFuncionales.zinR.toFixed(1) : "50.0";
    const zinX = datosFuncionales.zinX !== undefined ? (datosFuncionales.zinX >= 0 ? `+j${datosFuncionales.zinX.toFixed(1)}` : `-j${Math.abs(datosFuncionales.zinX).toFixed(1)}`) : "+j0.0";
    ctx.fillText(`Impedancia Zin: ${zinR} ${zinX} Ω`, panelX + 14, 158);

    const estado = roe <= 1.5 ? "✓ ADAPTACIÓN ÓPTIMA" : "✕ DESADAPTADA (Reflexión)";
    ctx.fillStyle = roeColor;
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.fillText(estado, panelX + 14, 190);
  }
}

export default LienzoFuncionalRenderer;
