// =========================================================================
// CAPA VISTA: VISUALIZADORES Y ANIMACIONES DE RESULTADOS (CANVAS 2D Y DOM)
// =========================================================================

import { JANSEN_VALORES_REFERENCIA, TRAYECTORIA_JANSEN_ORIGINAL, ModeloPataJansen } from "../models/jansen.js";
import { resolverCinematicaBrazo, distanciaPuntoASegmento } from "../models/brazo.js";
import { simularDescensoCohete } from "../models/cohete.js";
import { simularRespuestaPID } from "../models/pid.js";
import { ModeloPataCaminante } from "../models/caminante.js";
import { simularTrayectoriaParticula, calcularPotencialPunto, calcularCampoVectorial } from "../models/potencial.js";
import { simularManiobraOrbital } from "../models/orbita.js";
import { simularRespuestaFiltroRLC } from "../models/filtro.js";
import { resolverEstaticaArmadura } from "../models/armadura.js";
import { simularCampoTermico } from "../models/termico.js";
import { simularArregloAcustico } from "../models/acustica.js";
import { simularTrayectoriaLorentz, calcularCampoMagneticoBz } from "../models/electromagnetismo.js";
import { simularAbsorbenteAcustico } from "../models/fonoabsorbente.js";

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
// 7. VISUALIZADOR DE CAMPO DE POTENCIAL 2D Y DEFLEXIÓN ELECTROSTÁTICA
// -------------------------------------------------------------------------
export class VisualizadorPotencial {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularTrayectoriaParticula(genoma, entrada);
    const tray = sim.trayectoria;

    let tiempoAnimacion = 0;
    let indiceParticula = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const escala = Math.min(anchoCSS / 120, altoCSS / 85);
      const centroX = anchoCSS / 2;
      const centroY = altoCSS / 2;

      const aCanvas = (x, y) => ({
        x: centroX + x * escala,
        y: centroY - y * escala
      });

      // 1. Mapa de calor de potencial V(x, y)
      const celdasX = 36;
      const celdasY = 24;
      const pasoX = 110 / celdasX;
      const pasoY = 75 / celdasY;
      const anchoCeldaPx = pasoX * escala + 1;
      const altoCeldaPx = pasoY * escala + 1;

      for (let ix = 0; ix < celdasX; ix++) {
        const gx = -55 + (ix + 0.5) * pasoX;
        for (let iy = 0; iy < celdasY; iy++) {
          const gy = -37.5 + (iy + 0.5) * pasoY;
          const pot = calcularPotencialPunto(gx, gy, sim.electrodos, sim.cargasFijas);
          const potNorm = Math.max(-1, Math.min(1, pot / 45));
          let r, g, b, alpha;
          if (potNorm >= 0) {
            r = Math.floor(180 + 75 * potNorm);
            g = Math.floor(90 * (1 - potNorm * 0.7));
            b = 30;
            alpha = 0.12 + 0.45 * potNorm;
          } else {
            const absN = Math.abs(potNorm);
            r = 15;
            g = Math.floor(110 * absN);
            b = Math.floor(200 + 55 * absN);
            alpha = 0.12 + 0.45 * absN;
          }

          const pt = aCanvas(gx, gy);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fillRect(pt.x - anchoCeldaPx / 2, pt.y - altoCeldaPx / 2, anchoCeldaPx, altoCeldaPx);
        }
      }

      // 2. Grilla cartesiana y flechas del campo vectorial eléctrico E
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let x = -50; x <= 50; x += 25) {
        const p0 = aCanvas(x, -35);
        const p1 = aCanvas(x, 35);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      for (let y = -30; y <= 30; y += 15) {
        const p0 = aCanvas(-55, y);
        const p1 = aCanvas(55, y);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      for (let x = -45; x <= 45; x += 15) {
        for (let y = -25; y <= 25; y += 15) {
          const { ex, ey } = calcularCampoVectorial(x, y, sim.electrodos, sim.cargasFijas);
          const mag = Math.hypot(ex, ey);
          if (mag > 0.05) {
            const p = aCanvas(x, y);
            const len = Math.min(14, mag * 0.8 + 3);
            const dirX = (ex / mag) * len;
            const dirY = -(ey / mag) * len;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + dirX, p.y + dirY);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
            ctx.lineWidth = 1.2;
            ctx.stroke();

            const ang = Math.atan2(dirY, dirX);
            ctx.beginPath();
            ctx.moveTo(p.x + dirX, p.y + dirY);
            ctx.lineTo(p.x + dirX - 4 * Math.cos(ang - 0.45), p.y + dirY - 4 * Math.sin(ang - 0.45));
            ctx.lineTo(p.x + dirX - 4 * Math.cos(ang + 0.45), p.y + dirY - 4 * Math.sin(ang + 0.45));
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.fill();
          }
        }
      }

      // 3. Barrera de sobrepotencial central
      const pCentro = aCanvas(0, 0);
      const radioObsPx = 6.0 * escala;
      ctx.beginPath();
      ctx.arc(pCentro.x, pCentro.y, radioObsPx, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("Barrera Central", pCentro.x, pCentro.y - radioObsPx - 6);

      // 4. Emisor y Colector diana
      const pEmisor = aCanvas(sim.emisorX, sim.emisorY);
      ctx.beginPath();
      ctx.arc(pEmisor.x, pEmisor.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 10px system-ui";
      ctx.fillText("Emisor e⁻", pEmisor.x, pEmisor.y + 18);

      const pColector = aCanvas(sim.colectorX, sim.colectorY);
      const pulsoCol = 9 + Math.sin(tiempoAnimacion * 4) * 2;
      ctx.beginPath();
      ctx.arc(pColector.x, pColector.y, pulsoCol, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pColector.x, pColector.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.fillStyle = "#059669";
      ctx.fillText("Colector", pColector.x, pColector.y + 22);

      // 5. Electrodos deflectores móviles
      sim.electrodos.forEach((el, idx) => {
        const pEl = aCanvas(el.x, el.y);
        const esPositivo = el.q >= 0;
        const colorEl = esPositivo ? "#f59e0b" : "#38bdf8";
        const radioEl = 7 + Math.min(5, Math.abs(el.q) * 2);

        ctx.beginPath();
        ctx.arc(pEl.x, pEl.y, radioEl, 0, 2 * Math.PI);
        ctx.fillStyle = esPositivo ? "rgba(245, 158, 11, 0.25)" : "rgba(56, 189, 248, 0.25)";
        ctx.fill();
        ctx.strokeStyle = colorEl;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pEl.x, pEl.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = colorEl;
        ctx.fill();

        ctx.font = "bold 10px system-ui";
        ctx.fillStyle = colorEl;
        ctx.textAlign = "center";
        const sign = esPositivo ? "+" : "";
        ctx.fillText(`Deflector ${idx + 1} (${sign}${el.q.toFixed(1)}µC)`, pEl.x, pEl.y - radioEl - 4);
      });

      // 6. Trayectoria calculada
      if (tray.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        for (let i = 0; i < tray.length; i++) {
          const pt = aCanvas(tray[i].x, tray[i].y);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Partícula en movimiento animado a lo largo del haz
      if (tray.length > 0) {
        const ptAct = aCanvas(tray[indiceParticula].x, tray[indiceParticula].y);
        const estelaInicio = Math.max(0, indiceParticula - 14);
        ctx.beginPath();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        for (let i = estelaInicio; i <= indiceParticula; i++) {
          const ptE = aCanvas(tray[i].x, tray[i].y);
          if (i === estelaInicio) ctx.moveTo(ptE.x, ptE.y);
          else ctx.lineTo(ptE.x, ptE.y);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ptAct.x, ptAct.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.stroke();

        if (indiceParticula < tray.length - 1) {
          indiceParticula++;
        } else {
          indiceParticula = 0;
        }
      }

      // 7. Telemetría HUD
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 290, 68, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Distancia al Colector: ${sim.distanciaMinimaColector.toFixed(2)} mm`, 24, 34);
      ctx.fillText(`Energía Cinética: ${sim.energiaCinematicaTotal.toFixed(1)} J | Pasos: ${tray.length}`, 24, 50);

      ctx.fillStyle = sim.exitoLlegada ? "#4ade80" : (sim.colisionObstaculo ? "#f87171" : "#f59e0b");
      const estadoTxt = sim.exitoLlegada ? "CAPTURA EXITOSA EN COLECTOR ✓" : (sim.colisionObstaculo ? "COLISIÓN CON BARRERA ✕" : "DESVÍO DE TRAYECTORIA ⚠️");
      ctx.fillText(`Estado: ${estadoTxt}`, 24, 66);

      tiempoAnimacion += 0.04;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 8. VISUALIZADOR DE TRANSFERENCIA ORBITAL (MECÁNICA CELESTE 2D)
// -------------------------------------------------------------------------
export class VisualizadorOrbita {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularManiobraOrbital(genoma, entrada);
    const tray = sim.trayectoria;

    let tiempoAnimacion = 0;
    let indicePaso = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      // Fondo del espacio profundo con estrellas
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, anchoCSS, altoCSS);

      const escala = Math.min(anchoCSS, altoCSS) / 190;
      const centroX = anchoCSS / 2;
      const centroY = altoCSS / 2;

      const aCanvas = (x, y) => ({
        x: centroX + x * escala,
        y: centroY - y * escala
      });

      // 1. Órbitas circulares de referencia (inicial y objetivo)
      ctx.beginPath();
      ctx.arc(centroX, centroY, sim.rInicial * escala, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centroX, centroY, sim.rObjetivo * escala, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "10px system-ui";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Órbita Inicial (r = ${sim.rInicial} km)`, centroX, centroY - sim.rInicial * escala - 4);
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Órbita Objetivo (rf = ${sim.rObjetivo} km)`, centroX, centroY - sim.rObjetivo * escala - 4);

      // 2. Trayectoria calculada de transferencia
      if (tray.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i < tray.length; i++) {
          const pt = aCanvas(tray[i].x, tray[i].y);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // 3. Planeta central con atmósfera
      const rPlanetaPx = sim.rPlaneta * escala;
      const gradAtmosfera = ctx.createRadialGradient(centroX, centroY, rPlanetaPx * 0.8, centroX, centroY, rPlanetaPx * 1.35);
      gradAtmosfera.addColorStop(0, "rgba(56, 189, 248, 0.35)");
      gradAtmosfera.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.beginPath();
      ctx.arc(centroX, centroY, rPlanetaPx * 1.35, 0, 2 * Math.PI);
      ctx.fillStyle = gradAtmosfera;
      ctx.fill();

      // Superficie del planeta
      const gradPlaneta = ctx.createRadialGradient(centroX - rPlanetaPx * 0.3, centroY - rPlanetaPx * 0.3, 2, centroX, centroY, rPlanetaPx);
      gradPlaneta.addColorStop(0, "#38bdf8");
      gradPlaneta.addColorStop(0.6, "#0284c7");
      gradPlaneta.addColorStop(1, "#0f172a");
      ctx.beginPath();
      ctx.arc(centroX, centroY, rPlanetaPx, 0, 2 * Math.PI);
      ctx.fillStyle = gradPlaneta;
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 4. Satélite animado a lo largo del arco orbital
      if (tray.length > 0) {
        const ptAct = aCanvas(tray[indicePaso].x, tray[indicePaso].y);
        const datoAct = tray[indicePaso];

        // Llama de propulsión cuando se produce un encendido impulsivo (Delta V)
        if (datoAct.encendido > 0) {
          const velMag = Math.hypot(datoAct.vx, datoAct.vy) || 1;
          const dirX = -(datoAct.vx / velMag);
          const dirY = (datoAct.vy / velMag);
          const llamaLen = 16 + Math.sin(tiempoAnimacion * 20) * 4;

          ctx.beginPath();
          ctx.moveTo(ptAct.x, ptAct.y);
          ctx.lineTo(ptAct.x + dirX * llamaLen, ptAct.y + dirY * llamaLen);
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(ptAct.x, ptAct.y);
          ctx.lineTo(ptAct.x + dirX * (llamaLen * 0.6), ptAct.y + dirY * (llamaLen * 0.6));
          ctx.strokeStyle = "#fde047";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Estructura del satélite (cuerpo + paneles solares)
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(ptAct.x - 12, ptAct.y - 2, 8, 4); // Panel izquierdo
        ctx.fillRect(ptAct.x + 4, ptAct.y - 2, 8, 4);  // Panel derecho

        ctx.beginPath();
        ctx.arc(ptAct.x, ptAct.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (indicePaso < tray.length - 1) {
          indicePaso++;
        } else {
          indicePaso = 0;
        }
      }

      // 5. Telemetría HUD
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 290, 68, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Radio Final: ${sim.rFinal.toFixed(2)} km (Obj: ${sim.rObjetivo} km)`, 24, 34);
      ctx.fillText(`Δv Total: ${sim.deltaVTotal.toFixed(2)} m/s | Excentricidad e: ${sim.excentricidadFinal.toFixed(4)}`, 24, 50);

      ctx.fillStyle = sim.maniobraExitosa ? "#4ade80" : (sim.colisionPlaneta ? "#f87171" : "#f59e0b");
      const estadoTxt = sim.maniobraExitosa ? "INSERCIÓN ORBITAL EXITOSA ✓" : (sim.colisionPlaneta ? "COLISIÓN PLANETARIA ✕" : "DESVÍO / ALTA EXCENTRICIDAD ⚠️");
      ctx.fillText(`Estado: ${estadoTxt}`, 24, 66);

      tiempoAnimacion += 0.04;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 9. VISUALIZADOR DE FILTRO ANALÓGICO RLC (DIAGRAMA DE BODE)
// -------------------------------------------------------------------------
export class VisualizadorFiltro {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularRespuestaFiltroRLC(genoma, entrada);
    const pts = sim.respuesta;

    let tiempoAnimacion = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const margenIzq = 55;
      const margenDer = 25;
      const margenSup = 25;
      const margenInf = 45;
      const anchoG = anchoCSS - margenIzq - margenDer;
      const altoG = altoCSS - margenSup - margenInf;

      const logMinF = Math.log10(20.0);
      const logMaxF = Math.log10(50000.0);
      const minDB = -50.0;
      const maxDB = 6.0;

      const aCanvas = (f, db) => {
        const x = margenIzq + ((Math.log10(f) - logMinF) / (logMaxF - logMinF)) * anchoG;
        const y = margenSup + altoG - ((db - minDB) / (maxDB - minDB)) * altoG;
        return { x, y };
      };

      // Fondo del osciloscopio de Bode
      ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
      ctx.fillRect(margenIzq, margenSup, anchoG, altoG);

      // 1. Zonas de máscara de frecuencia (banda de paso y stopband)
      const pBwInf = aCanvas(Math.max(20, sim.fDeseada - sim.bwDeseado / 2), 0);
      const pBwSup = aCanvas(sim.fDeseada + sim.bwDeseado / 2, 0);
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      ctx.fillRect(pBwInf.x, margenSup, pBwSup.x - pBwInf.x, altoG);

      // 2. Grilla cartesiana logarítmica
      ctx.strokeStyle = "rgba(100, 116, 139, 0.18)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "#64748b";
      ctx.font = "11px system-ui";

      // Décadas de frecuencia
      const decadas = [100, 1000, 10000];
      ctx.textAlign = "center";
      decadas.forEach(f => {
        const p = aCanvas(f, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, margenSup);
        ctx.lineTo(p.x, margenSup + altoG);
        ctx.stroke();
        const fStr = f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`;
        ctx.fillText(fStr, p.x, margenSup + altoG + 16);
      });

      // Eje de magnitud dB
      ctx.textAlign = "right";
      for (let db = -40; db <= 0; db += 10) {
        const p = aCanvas(100, db);
        ctx.beginPath();
        ctx.moveTo(margenIzq, p.y);
        ctx.lineTo(margenIzq + anchoG, p.y);
        ctx.stroke();
        ctx.fillText(`${db} dB`, margenIzq - 6, p.y + 4);
      }

      // Línea de corte a -3 dB
      const p3db = aCanvas(100, -3.0);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(margenIzq, p3db.y);
      ctx.lineTo(margenIzq + anchoG, p3db.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#b45309";
      ctx.textAlign = "left";
      ctx.fillText("-3 dB (Corte)", margenIzq + 8, p3db.y - 5);

      // 3. Curva de respuesta en magnitud |H(f)|
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2.5;
        for (let i = 0; i < pts.length; i++) {
          const pt = aCanvas(pts[i].f, pts[i].gananciaDB);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // 4. Marcador en la frecuencia de resonancia pico f0
      const pPico = aCanvas(sim.f0, sim.magMaximaDB);
      ctx.beginPath();
      ctx.arc(pPico.x, pPico.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.strokeStyle = "#065f46";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pPico.x, margenSup);
      ctx.lineTo(pPico.x, margenSup + altoG);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#059669";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`f₀ = ${sim.f0.toFixed(0)} Hz`, pPico.x, margenSup - 6);

      // 5. HUD de componentes y selectividad
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.roundRect(anchoCSS - 310, 14, 295, 68, 8);
      ctx.fill();

      const rStr = sim.R >= 1000 ? `${(sim.R / 1000).toFixed(2)}kΩ` : `${sim.R.toFixed(0)}Ω`;
      const lStr = sim.L < 0.001 ? `${(sim.L * 1e6).toFixed(0)}µH` : `${(sim.L * 1000).toFixed(2)}mH`;
      const cStr = sim.C < 1e-6 ? `${(sim.C * 1e9).toFixed(1)}nF` : `${(sim.C * 1e6).toFixed(2)}µF`;

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Componentes: R=${rStr} | L=${lStr} | C=${cStr}`, anchoCSS - 300, 34);
      ctx.fillText(`Resonancia: ${sim.f0.toFixed(0)} Hz (Obj: ${sim.fDeseada} Hz) | Q: ${sim.Q.toFixed(2)}`, anchoCSS - 300, 50);

      const sintonizado = sim.errorFrecuencia < 35;
      ctx.fillStyle = sintonizado ? "#4ade80" : "#f87171";
      ctx.fillText(`Sintonización: ${sintonizado ? "SINTONIZADO EN BANDA ✓" : "DESVIADO DE FRECUENCIA ✕"} (BW: ${sim.bwReal.toFixed(0)} Hz)`, anchoCSS - 300, 66);

      tiempoAnimacion += 0.03;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 10. VISUALIZADOR DE ARMADURA DE PUENTE (ESTRUCTURAS 2D)
// -------------------------------------------------------------------------
export class VisualizadorArmadura {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = resolverEstaticaArmadura(genoma, entrada);

    let tiempoAnimacion = 0;
    let posVehiculoX = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const margenX = 70;
      const escala = (anchoCSS - 2 * margenX) / sim.luz;
      const baseCalzadaY = altoCSS * 0.72;

      const aCanvas = (pt) => ({
        x: margenX + pt.x * escala,
        y: baseCalzadaY - pt.y * escala
      });

      // 1. Río debajo del puente con ondas
      ctx.fillStyle = "rgba(14, 165, 233, 0.12)";
      ctx.fillRect(margenX - 20, baseCalzadaY + 12, (anchoCSS - 2 * margenX) + 40, altoCSS - (baseCalzadaY + 12));

      // Estribos de soporte de hormigón en extremos
      ctx.fillStyle = "#475569";
      ctx.fillRect(margenX - 25, baseCalzadaY - 4, 30, 45);
      ctx.fillRect(margenX + sim.luz * escala - 5, baseCalzadaY - 4, 30, 45);

      // 2. Dibujo de las 11 barras de acero con código de esfuerzo de tensión/compresión
      sim.barras.forEach(b => {
        const pA = aCanvas(b.nodos[0]);
        const pB = aCanvas(b.nodos[1]);

        // Color según esfuerzo: rojo tracción, azul compresión
        const esComp = b.esCompresion;
        let colorBarra = esComp ? "#2563eb" : "#ef4444";
        if (b.pandea) colorBarra = "#dc2626";

        const grosor = Math.max(3, Math.min(10, Math.abs(b.fuerzaAxialKN) * 0.08 + 2.5));

        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.strokeStyle = colorBarra;
        ctx.lineWidth = grosor;
        ctx.lineCap = "round";
        ctx.stroke();

        // Resaltado interior metálico
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = grosor * 0.3;
        ctx.stroke();
      });

      // 3. Nudos articulados (pasadores cilíndricos)
      sim.nodos.forEach((n, idx) => {
        const pt = aCanvas(n);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#94a3b8";
        ctx.fill();
      });

      // 4. Vectores de carga de tránsito P sobre la calzada (flechas verticales)
      [sim.nodos[1], sim.nodos[2]].forEach((n, idx) => {
        const pt = aCanvas(n);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 28);
        ctx.lineTo(pt.x, pt.y - 6);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Flecha
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 4);
        ctx.lineTo(pt.x - 5, pt.y - 12);
        ctx.lineTo(pt.x + 5, pt.y - 12);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();

        ctx.font = "bold 10px system-ui";
        ctx.fillStyle = "#b45309";
        ctx.textAlign = "center";
        ctx.fillText(`P = ${sim.cargaP} kN`, pt.x, pt.y - 32);
      });

      // 5. Vehículo animado cruzando el puente
      posVehiculoX = (posVehiculoX + 0.35) % (sim.luz + 10);
      const ptVehiculo = aCanvas({ x: posVehiculoX, y: 0 });
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(ptVehiculo.x - 10, ptVehiculo.y - 8, 20, 6);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(ptVehiculo.x - 6, ptVehiculo.y - 2, 2.5, 0, 2 * Math.PI);
      ctx.arc(ptVehiculo.x + 6, ptVehiculo.y - 2, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      // 6. Telemetría HUD
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 305, 68, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Masa Total Acero: ${(sim.masaTotalKg / 1000).toFixed(2)} t (${sim.masaTotalKg.toFixed(0)} kg)`, 24, 34);
      ctx.fillText(`Tensión Máx: ${sim.maxTensionMPa.toFixed(1)} MPa (Límite: ${sim.limiteTension} MPa)`, 24, 50);

      const seguro = !sim.hayPandeo && sim.maxFactorUso <= 1.0;
      ctx.fillStyle = seguro ? "#4ade80" : "#f87171";
      const estadoTxt = seguro ? "ESTRUCTURA SEGURA (Factor Uso < 100%) ✓" : (sim.hayPandeo ? "ALERTA: PANDEO DE EULER ✕" : "SOBRETENSIÓN ADMISIBLE ✕");
      ctx.fillText(`Estado: ${estadoTxt}`, 24, 66);

      tiempoAnimacion += 0.03;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 11. VISUALIZADOR DE DISIPACIÓN TÉRMICA 2D EN PLACA
// -------------------------------------------------------------------------
export class VisualizadorTermico {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularCampoTermico(genoma, entrada);

    let tiempoAnimacion = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      const escala = Math.min((anchoCSS - 80) / sim.anchoPlaca, (altoCSS - 80) / sim.altoPlaca);
      const centroX = anchoCSS / 2;
      const centroY = altoCSS / 2;

      const aCanvas = (x, y) => ({
        x: centroX + x * escala,
        y: centroY - y * escala
      });

      // 1. Placa PCB con aletas de disipación perimetrales
      const anchoPlacaPx = sim.anchoPlaca * escala;
      const altoPlacaPx = sim.altoPlaca * escala;

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(centroX - anchoPlacaPx / 2 - 8, centroY - altoPlacaPx / 2 - 8, anchoPlacaPx + 16, altoPlacaPx + 16);

      // Aletas de aluminio del disipador
      ctx.fillStyle = "#64748b";
      for (let x = centroX - anchoPlacaPx / 2; x <= centroX + anchoPlacaPx / 2; x += 12) {
        ctx.fillRect(x - 3, centroY - altoPlacaPx / 2 - 14, 6, 8);
        ctx.fillRect(x - 3, centroY + altoPlacaPx / 2 + 6, 6, 8);
      }

      // 2. Renderizado del mapa de calor térmico T(x, y)
      const nx = sim.nx;
      const ny = sim.ny;
      const celdaW = anchoPlacaPx / nx + 1;
      const celdaH = altoPlacaPx / ny + 1;

      for (let iy = 0; iy < ny; iy++) {
        const y = - (sim.altoPlaca / 2) + (iy / (ny - 1)) * sim.altoPlaca;
        for (let ix = 0; ix < nx; ix++) {
          const x = - (sim.anchoPlaca / 2) + (ix / (nx - 1)) * sim.anchoPlaca;
          const temp = sim.grilla[iy][ix];

          // Colormap térmico: Tamb (25°C = azul/índigo) -> 45°C (verde) -> 65°C (naranja) -> 85°C+ (rojo/blanco)
          const fracT = Math.max(0, Math.min(1, (temp - sim.tAmbiente) / Math.max(15, sim.tMax - sim.tAmbiente)));
          let r, g, b;
          if (fracT < 0.35) {
            const f = fracT / 0.35;
            r = Math.floor(20 + 40 * f);
            g = Math.floor(80 + 120 * f);
            b = Math.floor(200 - 40 * f);
          } else if (fracT < 0.7) {
            const f = (fracT - 0.35) / 0.35;
            r = Math.floor(60 + 180 * f);
            g = Math.floor(200 - 30 * f);
            b = Math.floor(40 - 20 * f);
          } else {
            const f = (fracT - 0.7) / 0.3;
            r = Math.floor(240 + 15 * f);
            g = Math.floor(140 * (1 - f * 0.7));
            b = Math.floor(30 + 180 * f);
          }

          const pt = aCanvas(x, y);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(pt.x - celdaW / 2, pt.y - celdaH / 2, celdaW, celdaH);
        }
      }

      // 3. Encapsulados de los 4 componentes chips
      sim.chips.forEach(c => {
        const pt = aCanvas(c.x, c.y);
        const rPx = c.r * escala;

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.beginPath();
        ctx.roundRect(pt.x - rPx, pt.y - rPx, rPx * 2, rPx * 2, 4);
        ctx.fill();
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.font = "bold 10px system-ui";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(c.nombre, pt.x, pt.y - 2);
        ctx.font = "9px system-ui";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`${c.temperatura.toFixed(1)}°C`, pt.x, pt.y + 10);
      });

      // 4. Retícula pulsante en el punto caliente (Hotspot)
      const ptHot = aCanvas(sim.xHotspot, sim.yHotspot);
      const pulso = 10 + Math.sin(tiempoAnimacion * 5) * 3;
      ctx.beginPath();
      ctx.arc(ptHot.x, ptHot.y, pulso, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ptHot.x, ptHot.y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText(`Tmax: ${sim.tMax.toFixed(1)}°C`, ptHot.x, ptHot.y - pulso - 4);

      // 5. Telemetría HUD
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.roundRect(14, 14, 290, 68, 8);
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "left";
      ctx.fillText(`Punto Caliente Tmax: ${sim.tMax.toFixed(1)} °C (Tamb: ${sim.tAmbiente}°C)`, 24, 34);
      ctx.fillText(`Temperatura Media: ${sim.tPromedio.toFixed(1)} °C | Gradiente: ${(sim.tMax - sim.tPromedio).toFixed(1)} °C`, 24, 50);

      ctx.fillStyle = sim.sinSolapamiento ? "#4ade80" : "#f87171";
      const estadoTxt = sim.sinSolapamiento ? "LAYOUT VÁLIDO (Sin interferencias) ✓" : "VIOLACIÓN DE SEPARACIÓN FÍSICA ✕";
      ctx.fillText(`Estado: ${estadoTxt}`, 24, 66);

      tiempoAnimacion += 0.03;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 12. VISUALIZADOR DE ARREGLO ACÚSTICO Y BEAMFORMING (ONDAS 2D)
// -------------------------------------------------------------------------
export class VisualizadorAcustica {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularArregloAcustico(genoma, entrada);
    let tiempoAnimacion = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      // Fondo oscuro acústico
      const bgGrad = ctx.createLinearGradient(0, 0, 0, altoCSS);
      bgGrad.addColorStop(0, "#080b14");
      bgGrad.addColorStop(1, "#0d1322");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, anchoCSS, altoCSS);

      // Espacio acústico: ancho 1.6m, alto 1.4m
      const centroX = anchoCSS / 2;
      const baseY = altoCSS - 55;
      const escalaM = Math.min((anchoCSS - 220) / 1.6, (baseY - 30) / 1.35);

      const aCanvas = (xM, yM) => ({
        x: centroX + xM * escalaM,
        y: baseY - yM * escalaM
      });

      // 1. Renderizado de ondas de presión acústica animadas p(x, y, t)
      const cols = 48;
      const filas = 32;
      const pasoX = 1.6 / cols;
      const pasoY = 1.3 / filas;
      const dxPx = pasoX * escalaM + 1.2;
      const dyPx = pasoY * escalaM + 1.2;
      const omegaT = tiempoAnimacion * 4.0;

      for (let iy = 0; iy < filas; iy++) {
        const yM = 0.05 + iy * pasoY;
        for (let ix = 0; ix < cols; ix++) {
          const xM = -0.8 + ix * pasoX;

          let pInst = 0.0;
          for (let i = 0; i < sim.transductores.length; i++) {
            const tr = sim.transductores[i];
            const dist = Math.hypot(xM - tr.x, yM - tr.y);
            const atenuacion = tr.amp / Math.sqrt(dist + 0.04);
            const fase = sim.numeroOndaK * dist - omegaT + tr.phi;
            pInst += atenuacion * Math.cos(fase);
          }

          const norm = Math.max(-1, Math.min(1, pInst / 3.0));
          const pt = aCanvas(xM, yM);

          if (Math.abs(norm) > 0.05) {
            let r, g, b, alpha;
            if (norm > 0) {
              r = Math.floor(40 + 160 * norm);
              g = Math.floor(160 + 95 * norm);
              b = 255;
              alpha = 0.08 + 0.55 * norm;
            } else {
              const an = Math.abs(norm);
              r = Math.floor(120 * an);
              g = Math.floor(40 * an);
              b = Math.floor(180 + 75 * an);
              alpha = 0.06 + 0.45 * an;
            }
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(pt.x - dxPx / 2, pt.y - dyPx / 2, dxPx, dyPx);
          }
        }
      }

      // 2. Cono y línea directiva del ángulo objetivo y real
      const rGuia = 1.3 * escalaM;
      const angObjRad = (sim.anguloObjetivoGrad * Math.PI) / 180.0;
      const xObjFin = centroX + rGuia * Math.sin(angObjRad);
      const yObjFin = baseY - rGuia * Math.cos(angObjRad);

      ctx.fillStyle = "rgba(255, 180, 0, 0.06)";
      ctx.beginPath();
      ctx.moveTo(centroX, baseY);
      ctx.arc(centroX, baseY, rGuia, -Math.PI / 2 + angObjRad - 0.15, -Math.PI / 2 + angObjRad + 0.15);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 193, 7, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(centroX, baseY);
      ctx.lineTo(xObjFin, yObjFin);
      ctx.stroke();
      ctx.setLineDash([]);

      const ptFoco = aCanvas(sim.xFoco, sim.yFoco);
      ctx.strokeStyle = "#ffc107";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ptFoco.x, ptFoco.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 193, 7, 0.35)";
      ctx.beginPath();
      ctx.arc(ptFoco.x, ptFoco.y, 4, 0, Math.PI * 2);
      ctx.fill();

      const angPicoRad = (sim.anguloPico * Math.PI) / 180.0;
      const xPicoFin = centroX + rGuia * Math.sin(angPicoRad);
      const yPicoFin = baseY - rGuia * Math.cos(angPicoRad);

      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centroX, baseY);
      ctx.lineTo(xPicoFin, yPicoFin);
      ctx.stroke();

      // 3. Barra física de los 6 transductores acústicos
      const trY = baseY + 8;
      const anchoBarra = (sim.transductores.length - 1) * (sim.transductores[1]?.x - sim.transductores[0]?.x || 0.08) * escalaM + 40;
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.fillRect(centroX - anchoBarra / 2, trY, anchoBarra, 24);
      ctx.strokeRect(centroX - anchoBarra / 2, trY, anchoBarra, 24);

      sim.transductores.forEach((tr, i) => {
        const pt = aCanvas(tr.x, 0);
        const radioP = 7 + tr.amp * 5;

        const glow = ctx.createRadialGradient(pt.x, trY + 12, 1, pt.x, trY + 12, radioP);
        glow.addColorStop(0, "rgba(0, 229, 255, 0.9)");
        glow.addColorStop(1, "rgba(0, 229, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pt.x, trY + 12, radioP, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#00e5ff";
        ctx.beginPath();
        ctx.arc(pt.x, trY + 12, 5, 0, Math.PI * 2);
        ctx.fill();

        const agujaX = pt.x + 8 * Math.cos(tr.phi);
        const agujaY = (trY + 12) + 8 * Math.sin(tr.phi);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pt.x, trY + 12);
        ctx.lineTo(agujaX, agujaY);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`T${i + 1}`, pt.x, trY + 34);
      });

      // 4. Inset: Diagrama Polar de Radiación Angular en dB
      const radioPolar = 65;
      const polarCx = anchoCSS - 95;
      const polarCy = 85;

      ctx.fillStyle = "rgba(10, 16, 30, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.fillRect(polarCx - radioPolar - 15, polarCy - radioPolar - 15, radioPolar * 2 + 30, radioPolar * 2 + 30);
      ctx.strokeRect(polarCx - radioPolar - 15, polarCy - radioPolar - 15, radioPolar * 2 + 30, radioPolar * 2 + 30);

      const dBs = [0, -6, -12, -20];
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      dBs.forEach((db) => {
        const rDb = radioPolar * Math.pow(10, db / 20);
        ctx.beginPath();
        ctx.arc(polarCx, polarCy, rDb, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.moveTo(polarCx - radioPolar, polarCy);
      ctx.lineTo(polarCx + radioPolar, polarCy);
      ctx.moveTo(polarCx, polarCy - radioPolar);
      ctx.lineTo(polarCx, polarCy + radioPolar);
      ctx.stroke();

      ctx.beginPath();
      let primerPunto = true;
      sim.diagramaPolar.forEach((dp) => {
        const rad = dp.anguloRad;
        const rNorm = Math.max(0, (dp.gananciaDb + 26) / 26) * radioPolar;
        const px = polarCx + rNorm * Math.sin(rad);
        const py = polarCy - rNorm * Math.cos(rad);
        if (primerPunto) {
          ctx.moveTo(px, py);
          primerPunto = false;
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 230, 118, 0.25)";
      ctx.fill();
      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PATRÓN POLAR (dB)", polarCx, polarCy - radioPolar - 4);
      ctx.fillText("0°", polarCx, polarCy - radioPolar + 9);
      ctx.fillText("+60°", polarCx + radioPolar - 10, polarCy - 20);
      ctx.fillText("-60°", polarCx - radioPolar + 10, polarCy - 20);

      // 5. Panel HUD de métricas
      ctx.fillStyle = "rgba(10, 16, 30, 0.82)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(16, 16, 260, 95);
      ctx.strokeRect(16, 16, 260, 95);

      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "left";
      ctx.fillText(`🔊 Phased Array Acústico (${sim.frecuenciaHz} Hz)`, 26, 34);

      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`Ángulo Haz: ${sim.anguloPico.toFixed(1)}° (Obj: ${sim.anguloObjetivoGrad}°)`, 26, 52);
      ctx.fillText(`Supresión Lóbulo (SLL): ${sim.relacionLobuloSecundarioDb.toFixed(1)} dB`, 26, 68);
      ctx.fillText(`Ancho de Haz (-3dB): ${sim.anchoHaz3dB.toFixed(0)}°`, 26, 84);
      ctx.fillText(`Longitud de Onda: ${(sim.longitudOndaM * 100).toFixed(1)} cm`, 26, 100);

      tiempoAnimacion += 0.04;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 13. VISUALIZADOR DE TRAMPA ELECTROMAGNÉTICA (FUERZA DE LORENTZ 2D)
// -------------------------------------------------------------------------
export class VisualizadorElectromagnetismo {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularTrayectoriaLorentz(genoma, entrada);
    let tiempoAnimacion = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      ctx.fillStyle = "#0a0d18";
      ctx.fillRect(0, 0, anchoCSS, altoCSS);

      const escala = Math.min((anchoCSS - 60) / 95, (altoCSS - 50) / 55);
      const centroX = anchoCSS / 2;
      const centroY = altoCSS / 2;

      const aCanvas = (x, y) => ({
        x: centroX + x * escala,
        y: centroY - y * escala
      });

      // 1. Grilla y mapa de flujo magnético Bz(x, y)
      const cols = 36;
      const filas = 22;
      const pasoX = 90 / cols;
      const pasoY = 50 / filas;
      const celdaW = pasoX * escala + 1;
      const celdaH = pasoY * escala + 1;

      for (let ix = 0; ix < cols; ix++) {
        const gx = -45 + (ix + 0.5) * pasoX;
        for (let iy = 0; iy < filas; iy++) {
          const gy = -25 + (iy + 0.5) * pasoY;
          const bz = calcularCampoMagneticoBz(gx, gy, sim.bobinas);
          const pt = aCanvas(gx, gy);

          if (Math.abs(bz) > 0.05) {
            const bzNorm = Math.max(-1, Math.min(1, bz / 3.0));
            let r, g, b, alpha;
            if (bzNorm > 0) {
              r = 20;
              g = Math.floor(100 + 130 * bzNorm);
              b = 255;
              alpha = 0.06 + 0.28 * bzNorm;
            } else {
              const ab = Math.abs(bzNorm);
              r = 255;
              g = Math.floor(90 * (1 - ab));
              b = 30;
              alpha = 0.06 + 0.28 * ab;
            }
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(pt.x - celdaW / 2, pt.y - celdaH / 2, celdaW, celdaH);
          }
        }
      }

      // 2. Paredes de la cámara de vacío
      const pSupIzq = aCanvas(-44, 23);
      const pInfDer = aCanvas(40, -23);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(pSupIzq.x, pSupIzq.y, pInfDer.x - pSupIzq.x, pInfDer.y - pSupIzq.y);

      // Ranura de Inyección (izquierda)
      const pIny0 = aCanvas(-44, 4);
      const pIny1 = aCanvas(-44, -4);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pIny0.x, pIny0.y);
      ctx.lineTo(pIny1.x, pIny1.y);
      ctx.stroke();

      // Rendija del detector de salida (derecha)
      const pSal0 = aCanvas(sim.xSalida, sim.yObjetivo + 4.5);
      const pSal1 = aCanvas(sim.xSalida, sim.yObjetivo - 4.5);
      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pSal0.x, pSal0.y);
      ctx.lineTo(pSal1.x, pSal1.y);
      ctx.stroke();

      const pBlanco = aCanvas(sim.xSalida + 3, sim.yObjetivo);
      ctx.fillStyle = "#00e676";
      ctx.beginPath();
      ctx.arc(pBlanco.x, pBlanco.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // 3. Placas deflectoras electrostáticas
      const pl1A = aCanvas(-28, 20.5);
      const pl1B = aCanvas(28, 20.5);
      ctx.strokeStyle = sim.vSuperior >= 0 ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(pl1A.x, pl1A.y);
      ctx.lineTo(pl1B.x, pl1B.y);
      ctx.stroke();

      const pl2A = aCanvas(-28, -20.5);
      const pl2B = aCanvas(28, -20.5);
      ctx.strokeStyle = sim.vInferior >= 0 ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(pl2A.x, pl2A.y);
      ctx.lineTo(pl2B.x, pl2B.y);
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Placa Superior: ${sim.vSuperior.toFixed(0)} V`, centroX, pl1A.y - 8);
      ctx.fillText(`Placa Inferior: ${sim.vInferior.toFixed(0)} V`, centroX, pl2A.y + 15);

      // 4. Bobinas de los electroimanes
      sim.bobinas.forEach((b, idx) => {
        const pt = aCanvas(b.x, b.y);
        const radioB = 14;

        ctx.fillStyle = "#b45309";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radioB, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radioB - 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Inter, system-ui, sans-serif";
        const polaridad = b.corriente >= 0 ? "⊙ (+)" : "⊗ (-)";
        ctx.fillText(polaridad, pt.x, pt.y + 3);

        ctx.fillStyle = "#f8fafc";
        ctx.font = "9px Inter, system-ui, sans-serif";
        ctx.fillText(`L${idx + 1}: ${b.corriente.toFixed(1)} A`, pt.x, pt.y + (b.y > 0 ? -18 : 22));
      });

      // 5. Trayectorias del haz de partículas bajo la Fuerza de Lorentz
      sim.trayectorias.forEach((tData, pIdx) => {
        const camino = tData.camino;
        if (!camino || camino.length === 0) return;

        ctx.beginPath();
        const inicio = aCanvas(camino[0].x, camino[0].y);
        ctx.moveTo(inicio.x, inicio.y);
        for (let k = 1; k < camino.length; k++) {
          const pt = aCanvas(camino[k].x, camino[k].y);
          ctx.lineTo(pt.x, pt.y);
        }

        ctx.strokeStyle = tData.salioPorColimador ? "rgba(0, 230, 118, 0.75)" : (tData.colision ? "rgba(239, 68, 68, 0.6)" : "rgba(56, 189, 248, 0.6)");
        ctx.lineWidth = 1.8;
        ctx.stroke();

        const progreso = (tiempoAnimacion * 45 + pIdx * 18) % camino.length;
        const idxActual = Math.floor(progreso);
        const ptActual = aCanvas(camino[idxActual].x, camino[idxActual].y);

        const glow = ctx.createRadialGradient(ptActual.x, ptActual.y, 1, ptActual.x, ptActual.y, 8);
        glow.addColorStop(0, tData.salioPorColimador ? "#00e676" : "#38bdf8");
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ptActual.x, ptActual.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ptActual.x, ptActual.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. Panel HUD
      ctx.fillStyle = "rgba(10, 16, 30, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(16, 16, 260, 92);
      ctx.strokeRect(16, 16, 260, 92);

      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "left";
      ctx.fillText("⚡ Guía Electromagnética (Lorentz)", 26, 34);

      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      const colorTx = sim.tasaTransmision >= 80 ? "#00e676" : (sim.tasaTransmision >= 40 ? "#f59e0b" : "#ef4444");
      ctx.fillText(`Transmisión: `, 26, 52);
      ctx.fillStyle = colorTx;
      ctx.fillText(`${sim.tasaTransmision.toFixed(0)}% (${sim.particulasTransmitidas}/5 transmitidas)`, 95, 52);

      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`Error en Detector: ${sim.errorPromedioSalida.toFixed(1)} mm`, 26, 68);
      ctx.fillText(`Campo Bmax: ${sim.maxAbsBz.toFixed(2)} T | Potencia: ${sim.potenciaTotalWatts.toFixed(0)} W`, 26, 84);

      tiempoAnimacion += 0.03;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 14. VISUALIZADOR DE SUPERFICIE FONOABSORBENTE (CUÑAS Y MULTIMATERIAL dBA)
// -------------------------------------------------------------------------
export class VisualizadorFonoabsorbente {
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

    let canvas = contenedor.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 380;
      canvas.style.width = "100%";
      canvas.style.height = "380px";
      canvas.style.display = "block";
      canvas.style.borderRadius = "var(--radio-sm, 12px)";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const sim = simularAbsorbenteAcustico(genoma, entrada);
    let tiempoAnimacion = 0;

    const animar = () => {
      if (!canvas.isConnected) {
        this.detener();
        return;
      }

      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchoCSS = canvas.clientWidth || 800;
      const altoCSS = canvas.clientHeight || 380;

      if (canvas.width !== anchoCSS * dpr || canvas.height !== altoCSS * dpr) {
        canvas.width = anchoCSS * dpr;
        canvas.height = altoCSS * dpr;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, anchoCSS, altoCSS);

      ctx.fillStyle = "#0c101d";
      ctx.fillRect(0, 0, anchoCSS, altoCSS);

      const mitadW = anchoCSS * 0.52;
      const inicioGraficoX = mitadW + 15;

      // 1. DIBUJO DEL CORTE TRANSVERSAL ACÚSTICO
      const margenX = 24;
      const anchoSeccion = mitadW - margenX * 2;
      const paredY = altoCSS - 45;

      ctx.fillStyle = "#334155";
      ctx.fillRect(margenX, paredY, anchoSeccion, 16);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.strokeRect(margenX, paredY, anchoSeccion, 16);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let rx = margenX; rx < margenX + anchoSeccion; rx += 14) {
        ctx.beginPath();
        ctx.moveTo(rx, paredY + 16);
        ctx.lineTo(rx + 10, paredY);
        ctx.stroke();
      }

      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PARED RÍGIDA DE SOPORTE", margenX + anchoSeccion / 2, paredY + 28);

      const escalaY = Math.min(1.15, (paredY - 50) / Math.max(120, sim.espesorTotalMm));

      if (sim.tipoEstructura === "superficie_lisa") {
        let yActual = paredY;

        for (let i = sim.datosCapas.length - 1; i >= 0; i--) {
          const capa = sim.datosCapas[i];
          const altoCapaPx = capa.espesorMm * escalaY;
          const yInicioCapa = yActual - altoCapaPx;

          ctx.fillStyle = capa.color;
          ctx.fillRect(margenX, yInicioCapa, anchoSeccion, altoCapaPx);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.strokeRect(margenX, yInicioCapa, anchoSeccion, altoCapaPx);

          ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
          const densidadPuntos = Math.min(8, Math.max(3, Math.round(capa.sigma / 6)));
          for (let py = yInicioCapa + 5; py < yActual - 5; py += 8) {
            for (let px = margenX + 8; px < margenX + anchoSeccion - 8; px += 24 / densidadPuntos) {
              ctx.beginPath();
              ctx.arc(px, py, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px Inter, system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${capa.nombre} (${capa.espesorMm.toFixed(0)} mm | σ = ${capa.sigma.toFixed(0)} kPa·s/m²)`, margenX + 8, yInicioCapa + altoCapaPx / 2 + 3);

          yActual = yInicioCapa;
        }

        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(margenX, yActual);
        ctx.lineTo(margenX + anchoSeccion, yActual);
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 10px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SUPERFICIE EXTERIOR LISA (ACABADO PLANO)", margenX + anchoSeccion / 2, yActual - 8);

        for (let w = 0; w < 4; w++) {
          const offsetW = ((tiempoAnimacion * 45 + w * 25) % (paredY - yActual + 40));
          const yOnda = yActual - 30 + offsetW;
          if (yOnda > yActual - 35 && yOnda < paredY) {
            const penetracion = Math.max(0, (yOnda - yActual) / (paredY - yActual || 1));
            const alfaOnda = Math.max(0.05, 0.8 * (1.0 - penetracion * 0.85));

            ctx.strokeStyle = `rgba(56, 189, 248, ${alfaOnda})`;
            ctx.lineWidth = Math.max(1, 3 * (1.0 - penetracion * 0.7));
            ctx.beginPath();
            ctx.moveTo(margenX + 15, yOnda);
            ctx.lineTo(margenX + anchoSeccion - 15, yOnda);
            ctx.stroke();
          }
        }

      } else {
        const pGeom = sim.perfilGeometria;
        const hCunaPx = pGeom.hCuñaMm * escalaY;
        const hBasePx = pGeom.hBaseMm * escalaY;
        const hAirePx = (pGeom.camaraAireMm || 0) * escalaY;

        const yBaseFondo = paredY - hAirePx;
        if (hAirePx > 0) {
          ctx.fillStyle = "rgba(148, 163, 184, 0.08)";
          ctx.fillRect(margenX, yBaseFondo, anchoSeccion, hAirePx);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(margenX, yBaseFondo, anchoSeccion, hAirePx);
          ctx.setLineDash([]);

          ctx.fillStyle = "#94a3b8";
          ctx.font = "8px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`Cámara de aire (${pGeom.camaraAireMm.toFixed(0)} mm)`, margenX + anchoSeccion / 2, yBaseFondo + hAirePx / 2 + 3);
        }

        const yPuntasBase = yBaseFondo - hBasePx;
        ctx.fillStyle = "#4338ca";
        ctx.fillRect(margenX, yPuntasBase, anchoSeccion, hBasePx);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.strokeRect(margenX, yPuntasBase, anchoSeccion, hBasePx);

        const numCunas = Math.max(3, Math.min(6, Math.round(anchoSeccion / (pGeom.wPeriodoMm * 0.85))));
        const anchoCunaPx = anchoSeccion / numCunas;
        const yPunta = yPuntasBase - hCunaPx;

        ctx.fillStyle = "#6366f1";
        ctx.strokeStyle = "#a5b4fc";
        ctx.lineWidth = 1.5;

        for (let c = 0; c < numCunas; c++) {
          const x0 = margenX + c * anchoCunaPx;
          const x1 = x0 + anchoCunaPx / 2;
          const x2 = x0 + anchoCunaPx;

          ctx.beginPath();
          ctx.moveTo(x0, yPuntasBase);
          ctx.lineTo(x1, yPunta);
          ctx.lineTo(x2, yPuntasBase);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
          ctx.beginPath();
          ctx.arc(x1, yPuntasBase - hCunaPx * 0.4, 3, 0, Math.PI * 2);
          ctx.arc(x1, yPuntasBase - hCunaPx * 0.7, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6366f1";
        }

        ctx.fillStyle = "#a5b4fc";
        ctx.font = "9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        const txtModo = pGeom.modo3D === "piramidal_3d" ? "▲ Mosaico Piramidal 3D (Corte Central)" : "▬ Extrusión Longitudinal 2.5D (Bafles)";
        ctx.fillText(txtModo, margenX + anchoSeccion / 2, yPunta - 10);

        const xCentroRayos = margenX + anchoCunaPx * 1.5;
        const offsetRayo = (tiempoAnimacion * 40) % (paredY - yPunta + 30);
        const yRayo = yPunta - 25 + offsetRayo;

        if (yRayo < paredY) {
          ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(xCentroRayos - 10, yPunta - 20);
          ctx.lineTo(xCentroRayos, yPunta + hCunaPx * 0.45);
          ctx.lineTo(xCentroRayos + 12, yPunta + hCunaPx * 0.75);
          ctx.lineTo(xCentroRayos, yBaseFondo);
          ctx.stroke();

          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(xCentroRayos, yPunta + hCunaPx * 0.45, 2.5, 0, Math.PI * 2);
          ctx.arc(xCentroRayos + 12, yPunta + hCunaPx * 0.75, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      const cotaX = margenX - 10;
      ctx.beginPath();
      ctx.moveTo(cotaX, paredY);
      ctx.lineTo(cotaX, paredY - sim.espesorTotalMm * escalaY);
      ctx.moveTo(cotaX - 4, paredY);
      ctx.lineTo(cotaX + 4, paredY);
      ctx.moveTo(cotaX - 4, paredY - sim.espesorTotalMm * escalaY);
      ctx.lineTo(cotaX + 4, paredY - sim.espesorTotalMm * escalaY);
      ctx.stroke();

      ctx.save();
      ctx.translate(cotaX - 8, paredY - (sim.espesorTotalMm * escalaY) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${sim.espesorTotalMm.toFixed(0)} mm`, 0, 0);
      ctx.restore();

      // 2. GRÁFICO ESPECTRAL POR BANDAS DE OCTAVA
      const anchoGrafico = anchoCSS - inicioGraficoX - 20;
      const altoGrafico = 145;
      const baseGraficoY = 175;

      ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(inicioGraficoX, baseGraficoY - altoGrafico, anchoGrafico, altoGrafico);
      ctx.strokeRect(inicioGraficoX, baseGraficoY - altoGrafico, anchoGrafico, altoGrafico);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("ABSORCIÓN ESPECTRAL α(f) Y PONDERACIÓN dBA", inicioGraficoX + 8, baseGraficoY - altoGrafico + 13);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let n = 1; n <= 4; n++) {
        const yL = baseGraficoY - (altoGrafico - 24) * (n / 4);
        ctx.beginPath();
        ctx.moveTo(inicioGraficoX, yL);
        ctx.lineTo(inicioGraficoX + anchoGrafico, yL);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "8px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText((n * 0.25).toFixed(2), inicioGraficoX + anchoGrafico - 4, yL - 2);
      }

      const numBandas = sim.bandasHz.length;
      const anchoBarraEsp = (anchoGrafico - 20) / numBandas;

      sim.coeficientesAbsorcion.forEach((alpha, idx) => {
        const xB = inicioGraficoX + 10 + idx * anchoBarraEsp;
        const hBarra = Math.max(3, (altoGrafico - 24) * alpha);
        const yB = baseGraficoY - hBarra;

        const bGrad = ctx.createLinearGradient(0, yB, 0, baseGraficoY);
        if (alpha >= 0.8) {
          bGrad.addColorStop(0, "#00e676");
          bGrad.addColorStop(1, "#059669");
        } else if (alpha >= 0.5) {
          bGrad.addColorStop(0, "#38bdf8");
          bGrad.addColorStop(1, "#0284c7");
        } else {
          bGrad.addColorStop(0, "#f59e0b");
          bGrad.addColorStop(1, "#d97706");
        }

        ctx.fillStyle = bGrad;
        ctx.fillRect(xB + 4, yB, anchoBarraEsp - 8, hBarra);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "8px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        const fLabel = sim.bandasHz[idx] >= 1000 ? `${sim.bandasHz[idx] / 1000}k` : `${sim.bandasHz[idx]}`;
        ctx.fillText(fLabel, xB + anchoBarraEsp / 2, baseGraficoY + 11);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px Inter, system-ui, sans-serif";
        ctx.fillText(alpha.toFixed(2), xB + anchoBarraEsp / 2, yB - 3);
      });

      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      sim.ponderacionAdB.forEach((pA, idx) => {
        const xP = inicioGraficoX + 10 + idx * anchoBarraEsp + anchoBarraEsp / 2;
        const yNorm = 1.0 - (pA + 20.0) / 24.0;
        const yP = (baseGraficoY - altoGrafico + 24) + yNorm * (altoGrafico - 30);
        if (idx === 0) ctx.moveTo(xP, yP);
        else ctx.lineTo(xP, yP);
      });
      ctx.stroke();

      ctx.fillStyle = "#fb923c";
      ctx.fillRect(inicioGraficoX + 10, baseGraficoY + 18, 8, 8);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Curva Ponderación dBA (Sensibilidad auditiva)", inicioGraficoX + 22, baseGraficoY + 25);

      // 3. PANEL HUD DE EVALUACIÓN
      const hudY = baseGraficoY + 36;
      const hudH = altoCSS - hudY - 14;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = sim.cumpleObjetivo ? "#00e676" : "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.fillRect(inicioGraficoX, hudY, anchoGrafico, hudH);
      ctx.strokeRect(inicioGraficoX, hudY, anchoGrafico, hudH);

      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = sim.cumpleObjetivo ? "#00e676" : "#f87171";
      ctx.textAlign = "left";
      const estadoBadge = sim.cumpleObjetivo ? "✓ CUMPLE ATENUACIÓN OBJETIVO" : `✕ DÉFICIT: -${sim.deficitAtenuacion.toFixed(1)} dBA`;
      ctx.fillText(estadoBadge, inicioGraficoX + 10, hudY + 18);

      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(`Atenuación: ${sim.atenuacionLogradaDba.toFixed(1)} dBA (Req: ${sim.atenuacionObjetivoDba} dBA)`, inicioGraficoX + 10, hudY + 36);

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Ruido Incidente: ${sim.nivelTotalIncidenteDba.toFixed(1)} dBA → Residual: ${sim.nivelTotalReflejadoDba.toFixed(1)} dBA`, inicioGraficoX + 10, hudY + 52);
      ctx.fillText(`Espesor: ${sim.espesorTotalMm.toFixed(0)} mm | Ahorro Material: ${sim.ahorroMaterialPorcentaje.toFixed(0)}% | NRC: ${sim.nrcMedio.toFixed(2)}`, inicioGraficoX + 10, hudY + 68);

      tiempoAnimacion += 0.035;
      this.animId = requestAnimationFrame(animar);
    };

    this.animId = requestAnimationFrame(animar);
  }
}

// -------------------------------------------------------------------------
// 15. VISUALIZADOR DE MODELOS DINÁMICOS LOW-CODE MULTI-NATURALEZA
// -------------------------------------------------------------------------
export class VisualizadorDinamico {
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

    const modelo = contexto.modelo;
    const tipo = modelo?.tipoVisualizacion || modelo?.definicionCruda?.tipoVisualizacion || "calibracion";
    const varsDef = modelo?.variables || (modelo?.crearGenoma ? modelo.crearGenoma() : []);

    // 1. Representación de Campo de Potencial 2D
    if (tipo === "campo_potencial_2d") {
      this._renderizarCampoPotencialDinamico(contenedor, genoma, varsDef, contexto);
      return;
    }

    // 2. Representación de Campo Vectorial 2D
    if (tipo === "campo_vectorial_2d") {
      this._renderizarCampoVectorialDinamico(contenedor, genoma, varsDef, contexto);
      return;
    }

    // 3. Representación de Trayectoria Espacial 2D
    if (tipo === "trayectoria_particulas_2d") {
      this._renderizarTrayectoriaDinamica(contenedor, genoma, varsDef, contexto);
      return;
    }

    // 4. Representación de Serie Temporal u Oscilador
    if (tipo === "serie_temporal") {
      this._renderizarSerieTemporalDinamica(contenedor, genoma, varsDef, contexto);
      return;
    }

    // 5. Representación de Mecanismo Articulado 2D
    if (tipo === "mecanismo_barras_2d") {
      this._renderizarMecanismoDinamico(contenedor, genoma, varsDef, contexto);
      return;
    }

    // 6. Representación de Arreglo Acústico y Ondas 2D
    if (tipo === "acustica_ondas_2d") {
      new VisualizadorAcustica().render(contenedor, genoma, entrada, contexto);
      return;
    }

    // 7. Representación de Campo Electromagnético / Fuerza de Lorentz
    if (tipo === "electromagnetismo_lorentz" || tipo === "campo_electromagnetico") {
      new VisualizadorElectromagnetismo().render(contenedor, genoma, entrada, contexto);
      return;
    }

    // 8. Representación de Perfil Fonoabsorbente y Multimaterial
    if (tipo === "fonoabsorbente_acustico") {
      new VisualizadorFonoabsorbente().render(contenedor, genoma, entrada, contexto);
      return;
    }

    // 9. Representación de Distribución de Recursos / Cargas
    if (tipo === "distribucion_recursos") {
      this._renderizarDistribucionRecursos(contenedor, genoma, varsDef, contexto);
      return;
    }

    // 10. Representación por defecto: Calibración y medidores de variables
    this._renderizarCalibracionVariables(contenedor, genoma, varsDef, contexto);
  }

  _renderizarCampoPotencialDinamico(contenedor, genoma, varsDef, contexto) {
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

    // Muestreo de campo escalar derivado de los genes
    const celdasX = 30;
    const celdasY = 20;
    const cw = anchoCSS / celdasX;
    const ch = altoCSS / celdasY;

    // Detecta pares (x, y) de las variables
    const puntosClave = [];
    for (let i = 0; i < genoma.length - 1; i += 2) {
      puntosClave.push({ x: genoma[i], y: genoma[i + 1] });
    }

    for (let ix = 0; ix < celdasX; ix++) {
      for (let iy = 0; iy < celdasY; iy++) {
        const mx = (ix / (celdasX - 1) - 0.5) * 80;
        const my = (iy / (celdasY - 1) - 0.5) * 60;
        let pot = 0;
        puntosClave.forEach((p, idx) => {
          const d = Math.hypot(mx - p.x, my - p.y);
          pot += 100 / Math.sqrt(d * d + 9);
        });

        const norm = Math.max(0, Math.min(1, pot / 60));
        ctx.fillStyle = `rgba(${Math.floor(240 * norm)}, ${Math.floor(100 + 120 * (1 - norm))}, ${Math.floor(255 * (1 - norm))}, 0.45)`;
        ctx.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
      }
    }

    // Puntos destacados de variables
    puntosClave.forEach((p, idx) => {
      const px = anchoCSS / 2 + (p.x / 40) * (anchoCSS / 2);
      const py = altoCSS / 2 - (p.y / 30) * (altoCSS / 2);

      ctx.beginPath();
      ctx.arc(px, py, 7, 0, 2 * Math.PI);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(`P${idx + 1} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`, px, py - 11);
    });

    // HUD
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 260, 50, 8);
    ctx.fill();
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText("Naturaleza: Campo Escalar / Potencial 2D", 24, 34);
    ctx.fillText(`Variables mapeadas: ${varsDef.length} genes`, 24, 50);
  }

  _renderizarCampoVectorialDinamico(contenedor, genoma, varsDef, contexto) {
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

    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.fillRect(0, 0, anchoCSS, altoCSS);

    const vortexX = genoma[0] !== undefined ? genoma[0] : 0;
    const vortexY = genoma[1] !== undefined ? genoma[1] : 0;
    const circ = genoma[2] !== undefined ? genoma[2] : 2;

    for (let x = 30; x < anchoCSS; x += 35) {
      for (let y = 30; y < altoCSS; y += 35) {
        const dx = (x - anchoCSS / 2) - vortexX;
        const dy = (y - altoCSS / 2) - vortexY;
        const r = Math.hypot(dx, dy) || 1;
        const vx = - (dy / r) * (circ * 4);
        const vy = (dx / r) * (circ * 4);
        const len = Math.min(16, Math.hypot(vx, vy));

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (vx / (len || 1)) * len, y + (vy / (len || 1)) * len);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 260, 50, 8);
    ctx.fill();
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText("Naturaleza: Campo Vectorial de Flujo", 24, 34);
    ctx.fillText(`Circulación del vórtice: ${circ.toFixed(2)}`, 24, 50);
  }

  _renderizarTrayectoriaDinamica(contenedor, genoma, varsDef, contexto) {
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

    ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
    ctx.fillRect(0, 0, anchoCSS, altoCSS);

    // Dibuja waypoints conectados
    const puntos = [{ x: 40, y: altoCSS / 2 }];
    for (let i = 0; i < genoma.length - 1; i += 2) {
      puntos.push({
        x: anchoCSS / 2 + (genoma[i] / 50) * (anchoCSS * 0.4),
        y: altoCSS / 2 - (genoma[i + 1] / 50) * (altoCSS * 0.4)
      });
    }
    puntos.push({ x: anchoCSS - 60, y: altoCSS / 2 - 30 });

    ctx.beginPath();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    puntos.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    puntos.forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = idx === 0 ? "#38bdf8" : (idx === puntos.length - 1 ? "#10b981" : "#f59e0b");
      ctx.fill();
    });

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 270, 50, 8);
    ctx.fill();
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText("Naturaleza: Trayectoria / Waypoints 2D", 24, 34);
    ctx.fillText(`Ruta con ${puntos.length} puntos nodales`, 24, 50);
  }

  _renderizarSerieTemporalDinamica(contenedor, genoma, varsDef, contexto) {
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

    const m = genoma[0] || 1;
    const c = genoma[1] || 0.5;
    const k = genoma[2] || 10;
    const wn = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(m * k));

    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.fillRect(50, 30, anchoCSS - 75, altoCSS - 60);

    // Curva y(t)
    ctx.beginPath();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    const nPts = 100;
    for (let i = 0; i < nPts; i++) {
      const t = (i / nPts) * 6.0;
      const yVal = 1 - Math.exp(-zeta * wn * t) * Math.cos(wn * t);
      const px = 50 + (i / nPts) * (anchoCSS - 75);
      const py = altoCSS - 30 - yVal * (altoCSS * 0.45);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 270, 50, 8);
    ctx.fill();
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText("Naturaleza: Serie Temporal / Oscilador", 24, 34);
    ctx.fillText(`wn = ${wn.toFixed(2)} rad/s | zeta = ${zeta.toFixed(2)}`, 24, 50);
  }

  _renderizarMecanismoDinamico(contenedor, genoma, varsDef, contexto) {
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

    const l1 = genoma[0] || 30;
    const l2 = genoma[1] || 25;
    const a1 = ((genoma[3] || 30) * Math.PI) / 180;
    const a2 = a1 + ((genoma[4] || 45) * Math.PI) / 180;

    const p0 = { x: anchoCSS * 0.4, y: altoCSS * 0.65 };
    const p1 = { x: p0.x + l1 * 2 * Math.cos(a1), y: p0.y - l1 * 2 * Math.sin(a1) };
    const p2 = { x: p1.x + l2 * 2 * Math.cos(a2), y: p1.y - l2 * 2 * Math.sin(a2) };

    // Dibuja barras
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Pernos
    [p0, p1, p2].forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
    });

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(14, 14, 270, 50, 8);
    ctx.fill();
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText("Naturaleza: Mecanismo Articulado 2D", 24, 34);
    ctx.fillText(`Efector en (${p2.x.toFixed(0)}, ${p2.y.toFixed(0)}) px`, 24, 50);
  }

  _renderizarDistribucionRecursos(contenedor, genoma, varsDef, contexto) {
    let htmlBarras = "";
    varsDef.forEach((v, idx) => {
      const val = genoma[idx] !== undefined ? genoma[idx] : 0;
      const pct = Math.max(0, Math.min(100, val));
      htmlBarras += `
        <div style="margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
            <span style="font-weight: 600;">📦 ${v.nombre}</span>
            <span style="font-family: monospace; font-weight: 600; color: var(--primario);">${val.toFixed(1)} u</span>
          </div>
          <div style="position: relative; height: 20px; background: var(--bg-input); border-radius: 6px; overflow: hidden; border: 1px solid var(--borde);">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--primario), var(--exito));"></div>
          </div>
        </div>
      `;
    });

    contenedor.innerHTML = `
      <div style="padding: 1.25rem; background: var(--bg-tarjeta); border: 1px solid var(--borde); border-radius: var(--radio-sm);">
        <h4 style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--texto-principal);">Distribución y Asignación de Recursos</h4>
        ${htmlBarras}
      </div>
    `;
  }

  _renderizarCalibracionVariables(contenedor, genoma, varsDef, contexto) {
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
  "campo-potencial": new VisualizadorPotencial(),
  "orbita-transferencia": new VisualizadorOrbita(),
  "filtro-rlc": new VisualizadorFiltro(),
  "armadura-puente": new VisualizadorArmadura(),
  "distribucion-termica": new VisualizadorTermico(),
  "acustica-beamforming": new VisualizadorAcustica(),
  "confinamiento-em": new VisualizadorElectromagnetismo(),
  "superficie-fonoabsorbente": new VisualizadorFonoabsorbente(),
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
  visualizadorDinamicoCompartido.detener();
}
