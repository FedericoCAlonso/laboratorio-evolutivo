// =========================================================================
// RENDERIZADOR 1: LIENZO DE CAMPOS CONTINUOS Y POTENCIALES UNIFICADOS
// CAPA VISTA: RENDERIZADO CANVAS 2D CON ESTÉTICA GOOGLE MATERIAL 3
// =========================================================================

// Renderiza mapas de calor continuos, isolíneas equipotenciales, vectores de fuerza y partículas
export class LienzoCamposRenderer {
  // Inicializa el renderizador con identificador de animación cancelable
  constructor() {
    this.animId = null;
  }

  // Cancela cualquier bucle de animación activo en el lienzo
  detener() {
    if (this.animId !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.animId);
      }
      this.animId = null;
    }
  }

  // Prepara y ajusta la resolución del canvas según la escala de píxeles del dispositivo (HiDPI)
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

  // Renderiza la escena completa de campos continuos en el canvas
  render(canvas, datosCampo, opciones = {}) {
    if (!canvas) return;
    this.detener();

    const { ctx, ancho, alto } = LienzoCamposRenderer.ajustarCanvas(canvas);
    const limites = datosCampo.limites || { xMin: -50, xMax: 50, yMin: -35, yMax: 35 };
    const escala = Math.min((ancho - 40) / (limites.xMax - limites.xMin), (alto - 40) / (limites.yMax - limites.yMin));
    const centroX = ancho / 2;
    const centroY = alto / 2;

    const aCanvas = (x, y) => ({
      x: centroX + x * escala,
      y: centroY - y * escala
    });

    // 1. Fondo oscuro con estética Material 3 Surface Container Lowest
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, ancho, alto);

    // 2. Mapa de calor de potencial escalar V(x, y)
    if (datosCampo.mapa && datosCampo.cols && datosCampo.filas) {
      const cols = datosCampo.cols;
      const filas = datosCampo.filas;
      const celdaW = (ancho / cols) + 1.2;
      const celdaH = (alto / filas) + 1.2;
      const rangoV = Math.max(1.0, Math.max(Math.abs(datosCampo.vMin || -10), Math.abs(datosCampo.vMax || 10)));

      for (let iy = 0; iy < filas; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const v = datosCampo.mapa[iy * cols + ix];
          const vNorm = Math.max(-1.0, Math.min(1.0, v / rangoV));
          let r = 20, g = 30, b = 50, alpha = 0.08;

          if (vNorm >= 0.0) {
            r = Math.floor(220 * vNorm + 35 * (1 - vNorm));
            g = Math.floor(60 + 80 * (1 - vNorm));
            b = Math.floor(40 * (1 - vNorm));
            alpha = 0.08 + 0.5 * vNorm;
          } else {
            const ab = Math.abs(vNorm);
            r = Math.floor(20 * (1 - ab));
            g = Math.floor(110 * ab);
            b = Math.floor(220 * ab + 50 * (1 - ab));
            alpha = 0.08 + 0.5 * ab;
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fillRect(ix * (ancho / cols), (filas - 1 - iy) * (alto / filas), celdaW, celdaH);
        }
      }
    }

    // 3. Cuadrícula métrica de fondo
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let x = -50; x <= 50; x += 20) {
      const p0 = aCanvas(x, limites.yMin);
      const p1 = aCanvas(x, limites.yMax);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let y = -30; y <= 30; y += 15) {
      const p0 = aCanvas(limites.xMin, y);
      const p1 = aCanvas(limites.xMax, y);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // 4. Dibujo de fuentes del campo (cargas, masas, bobinas solenoides, focos de calor)
    if (datosCampo.fuentes) {
      datosCampo.fuentes.forEach((f) => {
        const pt = aCanvas(f.x, f.y);
        const radioPx = Math.max(8, (f.radio || 2.0) * escala);

        if (f.q !== undefined && f.q !== 0.0) {
          // Carga electrostática (roja positiva, azul negativa)
          const esPos = f.q > 0.0;
          const color = esPos ? "#ef4444" : "#38bdf8";

          const glow = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, radioPx * 2.2);
          glow.addColorStop(0, color);
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radioPx * 2.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radioPx, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(esPos ? `+${f.q.toFixed(1)}` : `${f.q.toFixed(1)}`, pt.x, pt.y + 4);

        } else if (f.m !== undefined && f.m > 0.0) {
          // Masa gravitatoria (esfera celeste)
          const gradMasa = ctx.createRadialGradient(pt.x - 3, pt.y - 3, 2, pt.x, pt.y, radioPx);
          gradMasa.addColorStop(0, "#94a3b8");
          gradMasa.addColorStop(1, "#1e293b");
          ctx.fillStyle = gradMasa;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radioPx, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.5;
          ctx.stroke();

        } else if (f.mu !== undefined && f.mu !== 0.0) {
          // Solenoide / dipolo magnético
          ctx.fillStyle = "#b45309";
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radioPx, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(f.mu > 0 ? "⊙ (+)" : "⊗ (-)", pt.x, pt.y + 4);
        }
      });
    }

    // 5. Trayectoria animada de partículas de prueba
    if (datosCampo.trayectoria && datosCampo.trayectoria.length > 0) {
      const tray = datosCampo.trayectoria;
      ctx.beginPath();
      const p0 = aCanvas(tray[0].x, tray[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < tray.length; i++) {
        const pt = aCanvas(tray[i].x, tray[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = "rgba(0, 230, 118, 0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const fin = aCanvas(tray[tray.length - 1].x, tray[tray.length - 1].y);
      ctx.fillStyle = "#00e676";
      ctx.beginPath();
      ctx.arc(fin.x, fin.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Tarjeta HUD flotante de métricas Material 3
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.fillRect(16, 16, 240, 68);
    ctx.strokeRect(16, 16, 240, 68);

    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "left";
    ctx.fillText("🌐 Mapa de Potencial y Campos 2D", 26, 34);

    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`Fuentes activas: ${datosCampo.fuentes ? datosCampo.fuentes.length : 0}`, 26, 50);
    ctx.fillText(`Rango: [${(datosCampo.vMin || 0).toFixed(1)} V a ${(datosCampo.vMax || 0).toFixed(1)} V]`, 26, 66);
  }
}

export default LienzoCamposRenderer;
