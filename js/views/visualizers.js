// =========================================================================
// CAPA VISTA: VISUALIZADORES Y ANIMACIONES DE RESULTADOS (CANVAS 2D Y DOM)
// =========================================================================

import { JANSEN_VALORES_REFERENCIA, TRAYECTORIA_JANSEN_ORIGINAL, ModeloPataJansen } from "../models/jansen.js";
import { resolverCinematicaBrazo, distanciaPuntoASegmento } from "../models/brazo.js";
import { simularDescensoCohete } from "../models/cohete.js";
import { simularRespuestaPID } from "../models/pid.js";
import { ModeloPataCaminante } from "../models/caminante.js";

// Estado checkbox para superponer la curva original de Theo Jansen en el lienzo Canvas.
let mostrarReferenciaJansen = true;

// -------------------------------------------------------------------------
// 1. VISUALIZADOR DE PATA JANSEN (13 BARRAS CINETICAS)
// -------------------------------------------------------------------------
export class VisualizadorJansen {
  constructor() {
    this.animId = null;
  }

  detener() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render(contenedor, genoma, entrada, contexto = {}) {
    if (!contenedor) return;
    this.detener();

    const mMet = ModeloPataJansen.obtenerMetricasDetalladas(genoma, entrada);
    const mRef = ModeloPataJansen.obtenerMetricasDetalladas(JANSEN_VALORES_REFERENCIA, entrada);

    if (!mMet.valido || mMet.pasos.length === 0) {
      contenedor.innerHTML = `
        <div class="comparativa-azar">
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Estado Físico</div>
            <div class="stat-valor" style="color: var(--peligro);">${mMet.fitness.toFixed(0)}</div>
            <div class="stat-sub">Violación de barreras duras de entorno</div>
          </div>
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Ancho / Límite</div>
            <div class="stat-valor" style="color: ${mMet.anchoTotal > mMet.maxAncho ? 'var(--peligro)' : 'var(--texto-principal)'};">${mMet.anchoTotal.toFixed(1)} / ${mMet.maxAncho}</div>
            <div class="stat-sub">Gálibo horizontal</div>
          </div>
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Alto / Límite</div>
            <div class="stat-valor" style="color: ${mMet.alturaTotal > mMet.maxAlto ? 'var(--peligro)' : 'var(--texto-principal)'};">${mMet.alturaTotal.toFixed(1)} / ${mMet.maxAlto}</div>
            <div class="stat-sub">Gálibo vertical</div>
          </div>
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Despeje / Obstáculo</div>
            <div class="stat-valor" style="color: ${mMet.despejeReal < mMet.obstaculoAlto ? 'var(--peligro)' : 'var(--texto-principal)'};">${mMet.despejeReal.toFixed(1)} / ${mMet.obstaculoAlto}</div>
            <div class="stat-sub">Superación de escalón</div>
          </div>
        </div>
        <div style="padding: 2rem; text-align: center; color: var(--texto-secundario);">
          El diseño actual viola los límites de gálibo o no alcanza el despeje mínimo exigido para el obstáculo. El motor genético continuará refinando dimensiones.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = `
      <div class="comparativa-azar">
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Fitness Óptimo / Jansen</div>
          <div class="stat-valor" style="color: ${mMet.fitness <= mRef.fitness ? 'var(--exito)' : 'var(--primario)'};">
            ${mMet.fitness.toFixed(3)} <span style="font-size: 0.85rem; color: var(--texto-secundario);">/ ${mRef.fitness.toFixed(3)}</span>
          </div>
          <div class="stat-sub">${mMet.fitness <= mRef.fitness ? '✓ Supera a Theo Jansen' : 'Cercano al óptimo histórico'}</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Dimensiones (Ancho / Alto)</div>
          <div class="stat-valor">${mMet.anchoTotal.toFixed(1)} / ${mMet.alturaTotal.toFixed(1)} u</div>
          <div class="stat-sub">Límites: ${mMet.maxAncho} / ${mMet.maxAlto} u</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Despeje / Obstáculo</div>
          <div class="stat-valor" style="color: var(--exito);">${mMet.despejeReal.toFixed(1)} u</div>
          <div class="stat-sub">Exigido: ${mMet.obstaculoAlto} u (✓ Superado)</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Ataque f7 / Eficiencia f9</div>
          <div class="stat-valor" style="color: ${mMet.f7 <= mRef.f7 ? 'var(--exito)' : 'var(--aviso)'};">${mMet.f7.toFixed(3)} / ${mMet.f9.toFixed(3)}</div>
          <div class="stat-sub">Ataque: ${mMet.dxAtaque.toFixed(1)} u | Efic: ${(mMet.f9 * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div style="position: relative; width: 100%; border-radius: var(--radio-sm); overflow: hidden; border: 1px solid var(--borde); background: var(--bg-input);">
        <canvas id="canvas-jansen" width="850" height="420" style="width: 100%; height: 380px; display: block;"></canvas>
      </div>

      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-top: 0.65rem; gap: 0.5rem;">
        <label style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; user-select: none;">
          <input type="checkbox" id="check-jansen-referencia" ${mostrarReferenciaJansen ? "checked" : ""} style="width: 18px; height: 18px; min-height: 18px; cursor: pointer;">
          <span>Mostrar diseño original de Jansen como referencia (curva gris punteada)</span>
        </label>
        <span style="font-size: 0.8rem; color: var(--texto-secundario);">Manivela m=15 (centro Y en 0,0)</span>
      </div>
    `;

    const canvas = contenedor.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const chkReferencia = contenedor.querySelector("#check-jansen-referencia");
    if (chkReferencia) {
      chkReferencia.addEventListener("change", (e) => {
        mostrarReferenciaJansen = e.target.checked;
      });
    }

    const [a, l] = genoma;
    let minX = Math.min(0, -a, -JANSEN_VALORES_REFERENCIA[0], TRAYECTORIA_JANSEN_ORIGINAL.minX);
    let maxX = Math.max(0, -a, -JANSEN_VALORES_REFERENCIA[0], TRAYECTORIA_JANSEN_ORIGINAL.maxX);
    let minY = Math.min(0, -l, -JANSEN_VALORES_REFERENCIA[1], TRAYECTORIA_JANSEN_ORIGINAL.minY);
    let maxY = Math.max(0, -l, -JANSEN_VALORES_REFERENCIA[1], TRAYECTORIA_JANSEN_ORIGINAL.maxY);

    for (let s = 0; s < mMet.pasos.length; s++) {
      const p = mMet.pasos[s];
      minX = Math.min(minX, p.K.x, p.D.x, p.E.x, p.F.x, p.G.x, p.H.x);
      maxX = Math.max(maxX, p.K.x, p.D.x, p.E.x, p.F.x, p.G.x, p.H.x);
      minY = Math.min(minY, p.K.y, p.D.y, p.E.y, p.F.y, p.G.y, p.H.y);
      maxY = Math.max(maxY, p.K.y, p.D.y, p.E.y, p.F.y, p.G.y, p.H.y);
    }

    const margenMundo = 6.0;
    minX -= margenMundo;
    maxX += margenMundo;
    minY -= margenMundo;
    maxY += margenMundo;

    const rangoX = maxX - minX || 1;
    const rangoY = maxY - minY || 1;
    const centroMundoX = (minX + maxX) / 2;
    const centroMundoY = (minY + maxY) / 2;

    let indicePasoAnimacion = 0;

    const aCanvas = (x, y, anchoCSS, altoCSS, escala) => ({
      x: anchoCSS / 2 + (x - centroMundoX) * escala,
      y: altoCSS / 2 - (y - centroMundoY) * escala
    });

    let minANorm = Infinity, maxANorm = -Infinity;
    for (let s = 0; s < mMet.aNorm.length; s++) {
      const v = mMet.aNorm[s];
      if (v < minANorm) minANorm = v;
      if (v > maxANorm) maxANorm = v;
    }

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 850;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const escala = Math.min((anchoCSS - 60) / rangoX, (altoCSS - 60) / rangoY);

      // Línea de suelo
      const ptSuelo = aCanvas(0, mMet.minYTotal, anchoCSS, altoCSS, escala);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(0, ptSuelo.y);
      ctx.lineTo(anchoCSS, ptSuelo.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cota visual del obstáculo
      const ptObstaculo = aCanvas(0, mMet.minYApoyo + mMet.obstaculoAlto, anchoCSS, altoCSS, escala);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(0, ptObstaculo.y);
      ctx.lineTo(anchoCSS, ptObstaculo.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
      ctx.font = "10px system-ui";
      ctx.fillText(`Obstáculo mínimo (${mMet.obstaculoAlto} u)`, 12, ptObstaculo.y - 4);

      if (mostrarReferenciaJansen) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        for (let s = 0; s < TRAYECTORIA_JANSEN_ORIGINAL.pasos.length; s++) {
          const ptRef = aCanvas(TRAYECTORIA_JANSEN_ORIGINAL.pasos[s].H.x, TRAYECTORIA_JANSEN_ORIGINAL.pasos[s].H.y, anchoCSS, altoCSS, escala);
          if (s === 0) ctx.moveTo(ptRef.x, ptRef.y);
          else ctx.lineTo(ptRef.x, ptRef.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (let s = 0; s < mMet.pasos.length; s++) {
        const p1 = aCanvas(mMet.pasos[s].H.x, mMet.pasos[s].H.y, anchoCSS, altoCSS, escala);
        const sigIdx = (s + 1) % mMet.pasos.length;
        const p2 = aCanvas(mMet.pasos[sigIdx].H.x, mMet.pasos[sigIdx].H.y, anchoCSS, altoCSS, escala);
        const esApoyo = mMet.apoyoSet.has(s) && mMet.apoyoSet.has(sigIdx);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        if (esApoyo) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 3.5;
        } else {
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
      }

      const paso = mMet.pasos[indicePasoAnimacion];
      const ptO = aCanvas(0, 0, anchoCSS, altoCSS, escala);
      const ptK = aCanvas(paso.K.x, paso.K.y, anchoCSS, altoCSS, escala);
      const ptX = aCanvas(paso.X.x, paso.X.y, anchoCSS, altoCSS, escala);
      const ptD = aCanvas(paso.D.x, paso.D.y, anchoCSS, altoCSS, escala);
      const ptE = aCanvas(paso.E.x, paso.E.y, anchoCSS, altoCSS, escala);
      const ptF = aCanvas(paso.F.x, paso.F.y, anchoCSS, altoCSS, escala);
      const ptG = aCanvas(paso.G.x, paso.G.y, anchoCSS, altoCSS, escala);
      const ptH = aCanvas(paso.H.x, paso.H.y, anchoCSS, altoCSS, escala);

      // Triángulo superior D-E-X
      ctx.beginPath();
      ctx.moveTo(ptD.x, ptD.y);
      ctx.lineTo(ptE.x, ptE.y);
      ctx.lineTo(ptX.x, ptX.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
      ctx.fill();

      // Triángulo medio E-F-G
      ctx.beginPath();
      ctx.moveTo(ptE.x, ptE.y);
      ctx.lineTo(ptF.x, ptF.y);
      ctx.lineTo(ptG.x, ptG.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      ctx.fill();

      // Triángulo inferior de contacto F-G-H
      ctx.beginPath();
      ctx.moveTo(ptF.x, ptF.y);
      ctx.lineTo(ptG.x, ptG.y);
      ctx.lineTo(ptH.x, ptH.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(245, 158, 11, 0.14)";
      ctx.fill();

      const barras = [
        [ptO, ptK, "#ef4444", 3],
        [ptO, ptX, "#94a3b8", 1.5, true],
        [ptK, ptD, "#3b82f6", 2.2],
        [ptK, ptF, "#3b82f6", 2.2],
        [ptX, ptD, "#0284c7", 2.2],
        [ptX, ptF, "#0284c7", 2.2],
        [ptX, ptE, "#0284c7", 2.2],
        [ptD, ptE, "#065f46", 2.2],
        [ptE, ptG, "#059669", 2.2],
        [ptF, ptG, "#059669", 2.2],
        [ptG, ptH, "#d97706", 2.6],
        [ptF, ptH, "#d97706", 2.6]
      ];

      barras.forEach(([pA, pB, color, ancho, punteado]) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = ancho;
        if (punteado) ctx.setLineDash([4, 4]);
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
        if (punteado) ctx.setLineDash([]);
      });

      const nodos = [
        { pt: ptO, nombre: "Y(0,0)", fija: true },
        { pt: ptX, nombre: `X(-${a.toFixed(0)},-${l.toFixed(0)})`, fija: true },
        { pt: ptK, nombre: "K", fija: false },
        { pt: ptD, nombre: "D", fija: false },
        { pt: ptE, nombre: "E", fija: false },
        { pt: ptF, nombre: "F", fija: false },
        { pt: ptG, nombre: "G", fija: false }
      ];

      nodos.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.pt.x, n.pt.y, n.fija ? 5.5 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = n.fija ? "#1e293b" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = n.fija ? "#f8fafc" : "#0f172a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Pie dinámico
      const enApoyo = mMet.apoyoSet.has(indicePasoAnimacion);
      ctx.beginPath();
      ctx.arc(ptH.x, ptH.y, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = enApoyo ? "#f59e0b" : "#10b981";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      indicePasoAnimacion = (indicePasoAnimacion + 1) % mMet.pasos.length;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 2. VISUALIZADOR DE BRAZO ROBÓTICO (CINEMÁTICA INVERSA 3 ESLABONES)
// -------------------------------------------------------------------------
export class VisualizadorBrazo {
  constructor() {
    this.animId = null;
  }

  detener() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render(contenedor, genoma, entrada) {
    if (!contenedor) return;
    this.detener();

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
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 360;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const factorInterpolacion = 0.5 - 0.5 * Math.cos(tiempoAnimacion);
      const th1Actual = targetTh1 * factorInterpolacion;
      const th2Actual = targetTh2 * factorInterpolacion;
      const th3Actual = targetTh3 * factorInterpolacion;

      const origenX = anchoCSS * 0.35;
      const origenY = altoCSS * 0.55;
      const escala = Math.min(anchoCSS, altoCSS) / 220;

      const toPx = (p) => ({
        x: origenX + p.x * escala,
        y: origenY - p.y * escala
      });

      // Fondo y cuadrícula
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

      // 1. Obstáculo circular
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

      // 2. Objetivo animado
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

      // 3. Mecanismo articulado
      const { p0, p1, p2, p3 } = resolverCinematicaBrazo([th1Actual, th2Actual, th3Actual]);
      const px0 = toPx(p0);
      const px1 = toPx(p1);
      const px2 = toPx(p2);
      const px3 = toPx(p3);

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

      // Base
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.roundRect(px0.x - 22, px0.y - 10, 44, 20, 6);
      ctx.fill();

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

      // Efector
      ctx.beginPath();
      ctx.arc(px3.x, px3.y, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px3.x, px3.y);
      ctx.lineTo(pTar.x, pTar.y);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

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
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 3. VISUALIZADOR DE COHETE (ATERRIZAJE RETRO-PROPULSADO FALCON)
// -------------------------------------------------------------------------
export class VisualizadorCohete {
  constructor() {
    this.animId = null;
  }

  detener() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render(contenedor, genoma, entrada) {
    if (!contenedor) return;
    this.detener();

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
    const sim = simularDescensoCohete(genoma, entrada);
    const tray = sim.trayectoria;

    let indicePaso = 0;
    let contadorPausaFinal = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 360;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const nivelMarY = altoCSS - 35;
      const centroX = anchoCSS * 0.5;
      const escalaY = (altoCSS - 70) / (sim.alturaInicial || 120);
      const escalaX = escalaY;

      const toPx = (x, y) => ({
        x: centroX + x * escalaX,
        y: nivelMarY - y * escalaY
      });

      // Cielo
      const gradCielo = ctx.createLinearGradient(0, 0, 0, nivelMarY);
      gradCielo.addColorStop(0, "#091325");
      gradCielo.addColorStop(0.7, "#172554");
      gradCielo.addColorStop(1, "#1e3a8a");
      ctx.fillStyle = gradCielo;
      ctx.fillRect(0, 0, anchoCSS, nivelMarY);

      // Mar
      const gradMar = ctx.createLinearGradient(0, nivelMarY, 0, altoCSS);
      gradMar.addColorStop(0, "#0284c7");
      gradMar.addColorStop(1, "#0369a1");
      ctx.fillStyle = gradMar;
      ctx.fillRect(0, nivelMarY, anchoCSS, altoCSS - nivelMarY);

      // Barcaza
      const anchoBarcazaPx = 28 * escalaX;
      const pMar = toPx(0, 0);

      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(pMar.x - anchoBarcazaPx / 2, pMar.y - 6, anchoBarcazaPx, 10, 3);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Balizas
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(pMar.x - anchoBarcazaPx / 2 + 3, pMar.y - 6, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(pMar.x + anchoBarcazaPx / 2 - 3, pMar.y - 6, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Diana
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pMar.x, pMar.y - 1, 8, 0, 2 * Math.PI);
      ctx.stroke();

      // Trayectoria de plasma
      const pasoActual = tray[Math.min(indicePaso, tray.length - 1)];
      if (indicePaso > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
        ctx.lineWidth = 3;
        for (let i = 0; i <= Math.min(indicePaso, tray.length - 1); i++) {
          const pt = toPx(tray[i].x, tray[i].y);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Cohete
      const pCohete = toPx(pasoActual.x, pasoActual.y);
      const angRad = (pasoActual.angulo * Math.PI) / 180;
      const altoCohete = 32;
      const anchoCohete = 7;

      ctx.save();
      ctx.translate(pCohete.x, pCohete.y - altoCohete / 2);
      ctx.rotate(angRad * 0.4);

      if (pasoActual.empuje > 500) {
        const longLlama = Math.min(35, (pasoActual.empuje / 20000) * 35) + Math.random() * 4;
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

      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-anchoCohete / 2, -altoCohete / 2, anchoCohete, altoCohete, 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-anchoCohete / 2, -altoCohete / 2);
      ctx.lineTo(0, -altoCohete / 2 - 7);
      ctx.lineTo(anchoCohete / 2, -altoCohete / 2);
      ctx.closePath();
      ctx.fillStyle = "#0f172a";
      ctx.fill();

      const patasDesplegadas = pasoActual.y < 35;
      ctx.beginPath();
      ctx.moveTo(-anchoCohete / 2, altoCohete / 2 - 4);
      ctx.lineTo(patasDesplegadas ? -anchoCohete / 2 - 8 : -anchoCohete / 2 - 2, altoCohete / 2 + (patasDesplegadas ? 5 : 1));
      ctx.moveTo(anchoCohete / 2, altoCohete / 2 - 4);
      ctx.lineTo(patasDesplegadas ? anchoCohete / 2 + 8 : anchoCohete / 2 + 2, altoCohete / 2 + (patasDesplegadas ? 5 : 1));
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // HUD
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 310, 64, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Altitud : ${pasoActual.y.toFixed(1)} m | Vy : ${pasoActual.vy.toFixed(1)} m/s | Vx : ${pasoActual.vx.toFixed(1)} m/s`, 24, 32);
      ctx.fillText(`Empuje : ${pasoActual.empuje.toFixed(0)} N | Tobera : ${pasoActual.angulo.toFixed(1)}° | T : ${pasoActual.t.toFixed(1)} s`, 24, 48);

      const haAterrizado = indicePaso >= tray.length - 1;
      if (haAterrizado) {
        ctx.fillStyle = sim.aterrizajeExitoso ? "#4ade80" : "#f87171";
        ctx.fillText(`Misión Finalizada: ${sim.aterrizajeExitoso ? "¡ATERRIZAJE EXITOSO EN BARCAZA ✓!" : "IMPACTO DESTRUCTIVO 💥"} (V=${sim.velocidadImpacto.toFixed(1)} m/s)`, 24, 64);
      } else {
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(`Fase de Descenso Activa... (${((indicePaso / tray.length) * 100).toFixed(0)}% del vuelo)`, 24, 64);
      }

      if (indicePaso < tray.length - 1) {
        indicePaso++;
      } else {
        contadorPausaFinal++;
        if (contadorPausaFinal > 75) {
          contadorPausaFinal = 0;
          indicePaso = 0;
        }
      }

      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 4. VISUALIZADOR DE CONTROLADOR PID (OSCILOSCOPIO DINÁMICO)
// -------------------------------------------------------------------------
export class VisualizadorPID {
  constructor() {
    this.animId = null;
  }

  detener() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render(contenedor, genoma, entrada) {
    if (!contenedor) return;
    this.detener();

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
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
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

      const tMax = 8.0;
      const yMaxEscala = Math.max(1.5, Math.min(2.5, sim.yMax * 1.15));

      const toPx = (t, y) => ({
        x: margenIzq + (t / tMax) * anchoG,
        y: margenSup + altoG - (y / yMaxEscala) * altoG
      });

      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      ctx.fillRect(margenIzq, margenSup, anchoG, altoG);

      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#64748b";
      ctx.font = "11px system-ui";

      for (let v = 0.0; v <= yMaxEscala; v += 0.5) {
        const p = toPx(0, v);
        ctx.beginPath();
        ctx.moveTo(margenIzq, p.y);
        ctx.lineTo(margenIzq + anchoG, p.y);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.fillText(v.toFixed(1), margenIzq - 8, p.y + 4);
      }

      for (let t = 0; t <= tMax; t += 2) {
        const p = toPx(t, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, margenSup);
        ctx.lineTo(p.x, margenSup + altoG);
        ctx.stroke();

        ctx.fillText(`${t}s`, p.x, margenSup + altoG + 16);
      }

      // Tolerancia 2%
      const pBandaSup = toPx(0, 1.02);
      const pBandaInf = toPx(0, 0.98);
      ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
      ctx.fillRect(margenIzq, pBandaSup.y, anchoG, pBandaInf.y - pBandaSup.y);

      // Referencia r=1
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

      // Trazo
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

        const ptActual = toPx(pts[maxIdx].t, pts[maxIdx].y);
        ctx.beginPath();
        ctx.arc(ptActual.x, ptActual.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

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

      if (indicePaso < pts.length - 1) {
        indicePaso += 5;
      } else {
        contadorPausaFinal++;
        if (contadorPausaFinal > 80) {
          contadorPausaFinal = 0;
          indicePaso = 0;
        }
      }

      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 5. VISUALIZADOR DE PATA CAMINANTE (4 BARRAS)
// -------------------------------------------------------------------------
export class VisualizadorCaminante {
  constructor() {
    this.animId = null;
  }

  detener() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  render(contenedor, genoma, entrada) {
    if (!contenedor) return;
    this.detener();

    const m = ModeloPataCaminante.obtenerMetricasDetalladas(genoma, entrada);

    if (!m.valido || m.pasos.length === 0) {
      contenedor.innerHTML = `
        <div class="comparativa-azar">
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Validez del Mecanismo</div>
            <div class="stat-valor" style="color: var(--peligro);">${m.pctValidos.toFixed(1)}%</div>
            <div class="stat-sub">Posiciones con barras alcanzables</div>
          </div>
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Penalización Fitness</div>
            <div class="stat-valor" style="color: var(--peligro);">${m.fitness.toFixed(1)}</div>
            <div class="stat-sub">Mecanismo fuera de rango cinemático</div>
          </div>
        </div>
        <div style="padding: 2rem; text-align: center; color: var(--texto-secundario);">
          El mecanismo no puede cerrar sus cuatro barras durante todo el giro de 360°. El optimizador continuará buscando soluciones cerradas.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = `
      <div class="comparativa-azar">
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Fitness Ponderado</div>
          <div class="stat-valor" style="color: ${m.fitness <= 1.0 ? 'var(--exito)' : 'var(--primario)'};">
            ${m.fitness.toFixed(3)}
          </div>
          <div class="stat-sub">${m.pctValidos.toFixed(0)}% del ciclo válido</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Planitud Apoyo (f1)</div>
          <div class="stat-valor" style="color: ${m.f1 <= 0.08 ? 'var(--exito)' : 'var(--aviso)'};">${m.f1.toFixed(3)}</div>
          <div class="stat-sub">Menor valor = más plano</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Zancada / Alcance (f2)</div>
          <div class="stat-valor">${m.f2.toFixed(3)}</div>
          <div class="stat-sub">Ancho apoyo: ${m.anchoApoyo.toFixed(2)} u</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Despeje / Uniformidad</div>
          <div class="stat-valor">${m.f3.toFixed(2)} / ${m.f4.toFixed(2)}</div>
          <div class="stat-sub">f3 retorno / f4 velocidad</div>
        </div>
      </div>

      <div style="position: relative; width: 100%; border-radius: var(--radio-sm); overflow: hidden; border: 1px solid var(--borde); background: var(--bg-input);">
        <canvas id="canvas-mecanismo" width="800" height="380" style="width: 100%; height: 350px; display: block;"></canvas>
      </div>
      <div class="leyenda-grafico" style="margin-top: 0.5rem; flex-wrap: wrap;">
        <div class="item-leyenda"><div class="color-leyenda" style="background-color: #ef4444;"></div><span>Manivela O1-A (r=1)</span></div>
        <div class="item-leyenda"><div class="color-leyenda" style="background-color: #3b82f6;"></div><span>Acoplador A-B y Pie (L)</span></div>
        <div class="item-leyenda"><div class="color-leyenda" style="background-color: #10b981;"></div><span>Balancín O2-B (r3)</span></div>
        <div class="item-leyenda"><div class="color-leyenda" style="background-color: #f59e0b;"></div><span>Tramo Apoyo Suelo</span></div>
        <div class="item-leyenda"><div class="color-leyenda" style="background-color: #8b5cf6;"></div><span>Retorno Aéreo</span></div>
      </div>
    `;

    const canvas = contenedor.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const [dx, dy] = genoma;
    let minX = Math.min(0, dx, -1, 1);
    let maxX = Math.max(0, dx, -1, 1);
    let minY = Math.min(0, dy, -1, 1);
    let maxY = Math.max(0, dy, -1, 1);

    for (let s = 0; s < m.pasos.length; s++) {
      const p = m.pasos[s];
      minX = Math.min(minX, p.A.x, p.B.x, p.P.x);
      maxX = Math.max(maxX, p.A.x, p.B.x, p.P.x);
      minY = Math.min(minY, p.A.y, p.B.y, p.P.y);
      maxY = Math.max(maxY, p.A.y, p.B.y, p.P.y);
    }

    const margenMundo = 0.5;
    minX -= margenMundo;
    maxX += margenMundo;
    minY -= margenMundo;
    maxY += margenMundo;

    const rangoX = maxX - minX || 1;
    const rangoY = maxY - minY || 1;
    const centroMundoX = (minX + maxX) / 2;
    const centroMundoY = (minY + maxY) / 2;

    let indicePasoAnimacion = 0;

    const aCanvas = (x, y, anchoCSS, altoCSS, escala) => ({
      x: anchoCSS / 2 + (x - centroMundoX) * escala,
      y: altoCSS / 2 - (y - centroMundoY) * escala
    });

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 350;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const escalaX = (anchoCSS - 40) / rangoX;
      const escalaY = (altoCSS - 40) / rangoY;
      const escala = Math.min(escalaX, escalaY);

      const ptSuelo = aCanvas(0, m.minYTotal, anchoCSS, altoCSS, escala);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(0, ptSuelo.y);
      ctx.lineTo(anchoCSS, ptSuelo.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(100, 116, 139, 0.7)";
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`Línea de suelo (Y = ${m.minYTotal.toFixed(2)})`, 10, ptSuelo.y - 6);

      for (let s = 0; s < m.pasos.length; s++) {
        const p1 = aCanvas(m.pasos[s].P.x, m.pasos[s].P.y, anchoCSS, altoCSS, escala);
        const sigIdx = (s + 1) % m.pasos.length;
        const p2 = aCanvas(m.pasos[sigIdx].P.x, m.pasos[sigIdx].P.y, anchoCSS, altoCSS, escala);
        const esApoyo = m.apoyoSet.has(s) && m.apoyoSet.has(sigIdx);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        if (esApoyo) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 3.5;
        } else {
          ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
      }

      const paso = m.pasos[indicePasoAnimacion];
      const ptO1 = aCanvas(paso.O1.x, paso.O1.y, anchoCSS, altoCSS, escala);
      const ptO2 = aCanvas(paso.O2.x, paso.O2.y, anchoCSS, altoCSS, escala);
      const ptA = aCanvas(paso.A.x, paso.A.y, anchoCSS, altoCSS, escala);
      const ptB = aCanvas(paso.B.x, paso.B.y, anchoCSS, altoCSS, escala);
      const ptP = aCanvas(paso.P.x, paso.P.y, anchoCSS, altoCSS, escala);

      ctx.beginPath();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(ptO1.x, ptO1.y);
      ctx.lineTo(ptO2.x, ptO2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.lineTo(ptP.x, ptP.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3.5;
      ctx.moveTo(ptO1.x, ptO1.y);
      ctx.lineTo(ptA.x, ptA.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.moveTo(ptO2.x, ptO2.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.lineTo(ptP.x, ptP.y);
      ctx.stroke();

      [
        { pt: ptO1, etiqueta: "O1 (0,0)", fija: true },
        { pt: ptO2, etiqueta: `O2 (${dx.toFixed(1)}, ${dy.toFixed(1)})`, fija: true },
        { pt: ptA, etiqueta: "A", fija: false },
        { pt: ptB, etiqueta: "B", fija: false }
      ].forEach(nodo => {
        ctx.beginPath();
        ctx.arc(nodo.pt.x, nodo.pt.y, nodo.fija ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = nodo.fija ? "#334155" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = nodo.fija ? "#ffffff" : "#1e293b";
        ctx.lineWidth = 2;
        ctx.stroke();

        if (nodo.fija) {
          ctx.fillStyle = "#64748b";
          ctx.font = "10px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(nodo.etiqueta, nodo.pt.x, nodo.pt.y + 14);
        }
      });

      const enApoyo = m.apoyoSet.has(indicePasoAnimacion);
      ctx.beginPath();
      ctx.arc(ptP.x, ptP.y, 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = enApoyo ? "#f59e0b" : "#8b5cf6";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      indicePasoAnimacion = (indicePasoAnimacion + 1) % m.pasos.length;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 6. VISUALIZADOR DE BALANCEO DE FASES (BARRAS APILADAS Y CARGAS ELÉCTRICAS)
// -------------------------------------------------------------------------
export class VisualizadorFases {
  detener() {}

  render(contenedor, genoma, entrada, contexto = {}) {
    if (!contenedor) return;
    const circuitos = entrada?.circuitos || [500, 450, 400, 350, 300, 250, 200, 150];
    const fases = [
      { nombre: "R", corrienteTotal: 0, circuitos: [], claseColor: "color-r", claseColumna: "fase-r" },
      { nombre: "S", corrienteTotal: 0, circuitos: [], claseColor: "color-s", claseColumna: "fase-s" },
      { nombre: "T", corrienteTotal: 0, circuitos: [], claseColor: "color-t", claseColumna: "fase-t" }
    ];

    let violacionesFaseFija = 0;

    for (let i = 0; i < circuitos.length; i++) {
      const faseIdx = genoma[i] !== undefined ? genoma[i] : 0;
      const c = circuitos[i];
      const valorA = typeof c === "object" ? Number(c.corriente) || 0 : Number(c) || 0;
      const obligatoria = typeof c === "object" ? c.faseFija : "";
      const esViolacion = obligatoria && obligatoria !== "" && fases[faseIdx].nombre !== obligatoria;
      if (esViolacion) violacionesFaseFija++;

      fases[faseIdx].corrienteTotal += valorA;
      fases[faseIdx].circuitos.push({
        nombre: typeof c === "object" ? c.nombre : `Circuito ${i + 1}`,
        corriente: valorA,
        faseFija: obligatoria,
        esViolacion: esViolacion
      });
    }

    const corrientes = fases.map(f => f.corrienteTotal);
    const maxC = Math.max(...corrientes);
    const minC = Math.min(...corrientes);
    const desbalanceAmperes = maxC - minC;
    const corrienteTotalSistema = corrientes[0] + corrientes[1] + corrientes[2];
    const promedioIdeal = corrienteTotalSistema / 3;
    const porcentajeDesbalance = promedioIdeal > 0 ? (desbalanceAmperes / promedioIdeal) * 100 : 0;

    const alturaReferencia = Math.max(maxC * 1.15, 1);
    const desbalanceInicial = contexto && contexto.fitnessInicialAzar !== undefined ? contexto.fitnessInicialAzar : null;
    let mejoraTexto = "";
    if (desbalanceInicial !== null) {
      const dif = desbalanceInicial - desbalanceAmperes;
      const pctReduccion = desbalanceInicial > 0 ? (dif / desbalanceInicial) * 100 : 0;
      mejoraTexto = `(-${pctReduccion.toFixed(1)}% mejora)`;
    }

    let html = `
      <div class="comparativa-azar">
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Desbalance Inicial (Azar)</div>
          <div class="stat-valor" style="color: var(--aviso);">
            ${desbalanceInicial !== null ? desbalanceInicial.toFixed(2) + " A" : "--"}
          </div>
          <div class="stat-sub">Antes de optimizar</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Desbalance Final (Óptimo)</div>
          <div class="stat-valor" style="color: ${desbalanceAmperes <= 2.0 ? 'var(--exito)' : 'var(--primario)'};">
            ${desbalanceAmperes.toFixed(2)} A
          </div>
          <div class="stat-sub">${porcentajeDesbalance.toFixed(1)}% desbalance ${mejoraTexto}</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Carga Total y Media</div>
          <div class="stat-valor">${corrienteTotalSistema.toFixed(1)} A</div>
          <div class="stat-sub">Ideal por fase: ${promedioIdeal.toFixed(1)} A</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Restricciones Fijas</div>
          <div class="stat-valor" style="color: ${violacionesFaseFija === 0 ? 'var(--exito)' : 'var(--peligro)'};">
            ${violacionesFaseFija === 0 ? '✓ 100% OK' : '⚠ ' + violacionesFaseFija + ' faltas'}
          </div>
          <div class="stat-sub">${violacionesFaseFija === 0 ? 'Todas las fases fijas respetadas' : 'Violó fase fija establecida'}</div>
        </div>
      </div>

      <div class="fases-contenedor">
    `;

    for (let f = 0; f < fases.length; f++) {
      const fase = fases[f];
      const pctFase = corrienteTotalSistema > 0 ? ((fase.corrienteTotal / corrienteTotalSistema) * 100).toFixed(1) : "0.0";

      html += `
        <div class="columna-fase ${fase.claseColumna}">
          <div class="fase-nombre">Fase ${fase.nombre}</div>
          <div class="fase-corriente">${fase.corrienteTotal.toFixed(1)} A</div>
          <div style="font-size: 0.75rem; color: var(--texto-secundario); margin-bottom: 0.5rem;">${pctFase}% del total</div>
          <div class="fase-barra-fondo">
      `;

      for (let c = 0; c < fase.circuitos.length; c++) {
        const circ = fase.circuitos[c];
        const alturaPct = (circ.corriente / alturaReferencia) * 100;
        const iconoFija = circ.faseFija ? (circ.esViolacion ? " ⚠️" : " 🔒") : "";
        html += `
          <div class="bloque-circuito ${fase.claseColor}"
               style="height: ${alturaPct}%;"
               title="${circ.nombre}: ${circ.corriente} A${circ.faseFija ? ' (Fase ' + circ.faseFija + ')' : ''}">
            ${circ.nombre} (${circ.corriente}A)${iconoFija}
          </div>
        `;
      }

      html += `
          </div>
          <div style="font-size: 0.75rem; margin-top: 0.4rem; color: var(--texto-secundario); font-weight: 600;">
            ${fase.circuitos.length} circuitos
          </div>
        </div>
      `;
    }

    html += `</div>`;
    contenedor.innerHTML = html;
  }
}

// -------------------------------------------------------------------------
// 7. VISUALIZADOR DE MODELOS DINÁMICOS LOW-CODE
// -------------------------------------------------------------------------
export class VisualizadorDinamico {
  detener() {}

  render(contenedor, genoma, entrada, contexto = {}) {
    if (!contenedor) return;
    const modelo = contexto.modelo;
    const varsDef = modelo?.variables || (modelo?.crearGenoma ? modelo.crearGenoma() : []);

    let htmlBarras = "";
    varsDef.forEach((v, idx) => {
      const val = genoma[idx] !== undefined ? genoma[idx] : 0;
      const min = v.min !== undefined ? v.min : 0;
      const max = v.max !== undefined ? v.max : 100;
      const pct = Math.max(0, Math.min(100, ((val - min) / (max - min || 1)) * 100));
      const valFormateado = v.tipo === "entero" ? Math.round(val) : val.toFixed(3);

      htmlBarras += `
        <div style="margin-bottom: 0.9rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
            <span style="font-weight: 600;">${v.nombre || `Var ${idx + 1}`} <span style="font-weight: 400; color: var(--texto-secundario);">(${v.tipo || "continuo"})</span></span>
            <span style="font-family: monospace; font-weight: 600; color: var(--primario);">${valFormateado}</span>
          </div>
          <div style="position: relative; height: 18px; background: var(--bg-input); border-radius: 9px; overflow: hidden; border: 1px solid var(--borde);">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--primario), var(--exito)); border-radius: 9px; transition: width 0.15s ease;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--texto-secundario); margin-top: 2px;">
            <span>Mín: ${min}</span>
            <span>${pct.toFixed(1)}% del rango</span>
            <span>Máx: ${max}</span>
          </div>
        </div>
      `;
    });

    const fitVal = contexto.fitness !== undefined ? (Array.isArray(contexto.fitness) ? `[${contexto.fitness.map(f => f.toFixed(2)).join(", ")}]` : contexto.fitness.toFixed(4)) : "--";

    contenedor.innerHTML = `
      <div class="comparativa-azar" style="margin-bottom: 1rem;">
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Fitness Actual</div>
          <div class="stat-valor" style="color: var(--exito);">${fitVal}</div>
          <div class="stat-sub">Función de evaluación</div>
        </div>
        <div class="tarjeta-stat">
          <div class="stat-etiqueta">Variables Optimizadas</div>
          <div class="stat-valor" style="color: var(--primario);">${varsDef.length}</div>
          <div class="stat-sub">Genes de decisión</div>
        </div>
      </div>
      <div style="padding: 1.25rem; background: var(--bg-tarjeta); border: 1px solid var(--borde); border-radius: var(--radio-sm);">
        <h4 style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--texto-principal);">Distribución y Magnitud de Variables en su Rango</h4>
        ${htmlBarras}
      </div>
    `;
  }
}

// -------------------------------------------------------------------------
// REGISTRO Y FACTORÍA DE VISUALIZADORES
// -------------------------------------------------------------------------
const visualizadoresRegistrados = {
  "pata-jansen": new VisualizadorJansen(),
  "brazo-robotico": new VisualizadorBrazo(),
  "cohete-landing": new VisualizadorCohete(),
  "controlador-pid": new VisualizadorPID(),
  "pata-caminante": new VisualizadorCaminante(),
  "balanceo-fases-trifasico": new VisualizadorFases()
};

const visualizadorDinamicoCompartido = new VisualizadorDinamico();

// Obtiene la instancia del visualizador correspondiente al identificador del modelo.
export function obtenerVisualizador(modeloId) {
  if (visualizadoresRegistrados[modeloId]) {
    return visualizadoresRegistrados[modeloId];
  }
  return visualizadorDinamicoCompartido;
}

// Detiene de forma preventiva todas las animaciones activas en los visualizadores.
export function detenerTodosLosVisualizadores() {
  Object.values(visualizadoresRegistrados).forEach(v => {
    if (typeof v.detener === "function") v.detener();
  });
}
