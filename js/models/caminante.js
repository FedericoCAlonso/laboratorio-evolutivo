// =========================================================================
// MÓDULO: MODELO 2 - PATA CAMINANTE (MECANISMO DE CUATRO BARRAS)
// =========================================================================

// Identificador del temporizador de animación requestAnimationFrame para la pata caminante.
let idAnimacionPata = null;

// Objeto que implementa el contrato del Modelo 2: Mecanismo de cuatro barras para pata caminante.
export const ModeloPataCaminante = {
  // Identificador único del modelo.
  id: "pata-caminante",
  // Nombre legible para mostrar en el selector de la interfaz.
  nombre: "Pata caminante (cuatro barras)",
  // Descripción técnica del objetivo de optimización del mecanismo.
  descripcion: "Optimiza un mecanismo de cuatro barras para que el pie describa una marcha con apoyo horizontal plano y retorno elevado.",
  // No utiliza aceleración WebAssembly.
  usaWasm: false,
  // Declara si la función de evaluación utiliza ruido estocástico.
  usaRuido: false,

  // Parámetros de ponderación para la función de aptitud multiobjetivo.
  parametrosEntrada: [
    { clave: "w1", etiqueta: "Peso w1 (Planitud del apoyo)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 3.0 },
    { clave: "w2", etiqueta: "Peso w2 (Zancada)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w3", etiqueta: "Peso w3 (Despeje de retorno)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 },
    { clave: "w4", etiqueta: "Peso w4 (Uniformidad de velocidad)", tipo: "numero", min: 0, max: 20, paso: 0.5, valorDefecto: 1.0 }
  ],

  // Define los rangos continuos de búsqueda de los 6 genes cinemáticos del mecanismo.
  crearGenoma(entrada) {
    return [
      { tipo: "continuo", min: -3.0, max: 3.0 }, // dx (Pivote O2 en X)
      { tipo: "continuo", min: -3.0, max: 3.0 }, // dy (Pivote O2 en Y)
      { tipo: "continuo", min: 1.0, max: 6.0 },  // L (Largo del acoplador)
      { tipo: "continuo", min: 1.0, max: 6.0 },  // r3 (Largo del balancín)
      { tipo: "continuo", min: 0.5, max: 6.0 },  // p (Extensión hacia el pie)
      { tipo: "continuo", min: -Math.PI, max: Math.PI } // alpha (Ángulo del pie)
    ];
  },

  // Resuelve analíticamente la cinemática de posición para un ángulo theta dado de la manivela.
  resolverCinematica(theta, genoma) {
    const [dx, dy, L, r3, p, alpha] = genoma;
    const O1 = { x: 0, y: 0 };
    const O2 = { x: dx, y: dy };
    const A = { x: Math.cos(theta), y: Math.sin(theta) };

    const vx = O2.x - A.x;
    const vy = O2.y - A.y;
    const d = Math.hypot(vx, vy);

    if (d === 0 || d > L + r3 || d < Math.abs(L - r3)) {
      return null;
    }

    const a = (L * L - r3 * r3 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L * L - a * a));
    const mx = A.x + (a * vx) / d;
    const my = A.y + (a * vy) / d;

    const B = {
      x: mx + (h * vy) / d,
      y: my - (h * vx) / d
    };

    const phi = Math.atan2(B.y - A.y, B.x - A.x);
    const P = {
      x: A.x + p * Math.cos(phi + alpha),
      y: A.y + p * Math.sin(phi + alpha)
    };

    return { theta, O1, O2, A, B, P };
  },

  // Evalúa la marcha con 180 muestras de theta calculando penalizaciones y ponderación f1..f4.
  evaluar(genoma, entrada) {
    const w1 = Number(entrada?.w1 !== undefined ? entrada.w1 : 3.0);
    const w2 = Number(entrada?.w2 !== undefined ? entrada.w2 : 1.0);
    const w3 = Number(entrada?.w3 !== undefined ? entrada.w3 : 1.0);
    const w4 = Number(entrada?.w4 !== undefined ? entrada.w4 : 1.0);
    const [dx, dy, L, r3, p, alpha] = genoma;

    const N = 180;
    const pasos = [];
    let pasosInvalidos = 0;

    for (let s = 0; s < N; s++) {
      const theta = (2 * Math.PI * s) / N;
      const res = this.resolverCinematica(theta, genoma);
      if (!res) {
        pasosInvalidos++;
      } else {
        pasos.push({ idx: s, ...res });
      }
    }

    if (pasosInvalidos > 0) {
      return 1000 + 10 * pasosInvalidos;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let s = 0; s < N; s++) {
      const P = pasos[s].P;
      if (P.x < minX) minX = P.x;
      if (P.x > maxX) maxX = P.x;
      if (P.y < minY) minY = P.y;
      if (P.y > maxY) maxY = P.y;
    }

    const anchoTotal = maxX - minX;
    const alturaTotal = maxY - minY;
    const diagCaja = Math.hypot(anchoTotal, alturaTotal);

    for (let s = 0; s < N; s++) {
      const pAct = pasos[s].P;
      const pSig = pasos[(s + 1) % N].P;
      const distSalto = Math.hypot(pSig.x - pAct.x, pSig.y - pAct.y);
      if (distSalto > 0.25 * diagCaja) {
        return 500;
      }
    }

    if (alturaTotal <= 1e-6) {
      return 800;
    }

    const numApoyo = Math.round(N * 0.35);
    const ordenadosPorY = [...pasos].sort((p1, p2) => p1.P.y - p2.P.y);
    const apoyo = ordenadosPorY.slice(0, numApoyo);
    const apoyoSet = new Set(apoyo.map(p => p.idx));

    let minYApoyo = Infinity, maxYApoyo = -Infinity;
    let minXApoyo = Infinity, maxXApoyo = -Infinity;
    let sumaYApoyo = 0;

    for (let s = 0; s < apoyo.length; s++) {
      const P = apoyo[s].P;
      if (P.y < minYApoyo) minYApoyo = P.y;
      if (P.y > maxYApoyo) maxYApoyo = P.y;
      if (P.x < minXApoyo) minXApoyo = P.x;
      if (P.x > maxXApoyo) maxXApoyo = P.x;
      sumaYApoyo += P.y;
    }

    const anchoApoyo = maxXApoyo - minXApoyo;
    if (anchoApoyo <= 1e-6) {
      return 800;
    }

    const mediaYApoyo = sumaYApoyo / numApoyo;

    const f1 = (maxYApoyo - minYApoyo) / alturaTotal;
    const f2 = 1 - Math.min(1, anchoApoyo / (L + r3));
    const f3 = Math.max(0, 0.3 - (maxY - mediaYApoyo) / anchoApoyo) / 0.3;

    const dxPasos = [];
    for (let s = 0; s < N; s++) {
      const sig = (s + 1) % N;
      if (apoyoSet.has(s) && apoyoSet.has(sig)) {
        dxPasos.push(pasos[sig].P.x - pasos[s].P.x);
      }
    }

    let f4 = 1.0;
    if (dxPasos.length >= 3) {
      const promDx = dxPasos.reduce((acc, v) => acc + v, 0) / dxPasos.length;
      const promAbsDx = dxPasos.reduce((acc, v) => acc + Math.abs(v), 0) / dxPasos.length;
      const varianza = dxPasos.reduce((acc, v) => acc + (v - promDx) ** 2, 0) / dxPasos.length;
      const desvio = Math.sqrt(varianza);
      if (promAbsDx > 1e-6) {
        f4 = Math.min(1, desvio / promAbsDx);
      }
    }

    return w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4;
  },

  // Extrae métricas geométricas completas para su graficación en Canvas y reporte descriptivo.
  obtenerMetricasDetalladas(genoma, entrada) {
    const w1 = Number(entrada?.w1 !== undefined ? entrada.w1 : 3.0);
    const w2 = Number(entrada?.w2 !== undefined ? entrada.w2 : 1.0);
    const w3 = Number(entrada?.w3 !== undefined ? entrada.w3 : 1.0);
    const w4 = Number(entrada?.w4 !== undefined ? entrada.w4 : 1.0);
    const [dx, dy, L, r3, p, alpha] = genoma;

    const N = 180;
    const pasos = [];
    let pasosInvalidos = 0;

    for (let s = 0; s < N; s++) {
      const theta = (2 * Math.PI * s) / N;
      const res = this.resolverCinematica(theta, genoma);
      if (!res) {
        pasosInvalidos++;
      } else {
        pasos.push({ idx: s, ...res });
      }
    }

    const pctValidos = ((N - pasosInvalidos) / N) * 100;
    if (pasosInvalidos > 0) {
      return {
        valido: false,
        pctValidos,
        pasosInvalidos,
        fitness: 1000 + 10 * pasosInvalidos,
        f1: 1, f2: 1, f3: 1, f4: 1,
        anchoApoyo: 0,
        alturaTotal: 0,
        anchoTotal: 0,
        pasos: []
      };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let s = 0; s < N; s++) {
      const P = pasos[s].P;
      if (P.x < minX) minX = P.x;
      if (P.x > maxX) maxX = P.x;
      if (P.y < minY) minY = P.y;
      if (P.y > maxY) maxY = P.y;
    }

    const anchoTotal = maxX - minX;
    const alturaTotal = maxY - minY;
    const diagCaja = Math.hypot(anchoTotal, alturaTotal);

    let saltoGrande = false;
    for (let s = 0; s < N; s++) {
      const pAct = pasos[s].P;
      const pSig = pasos[(s + 1) % N].P;
      if (Math.hypot(pSig.x - pAct.x, pSig.y - pAct.y) > 0.25 * diagCaja) {
        saltoGrande = true;
        break;
      }
    }

    if (saltoGrande) {
      return { valido: false, pctValidos, fitness: 500, f1: 1, f2: 1, f3: 1, f4: 1, anchoApoyo: 0, alturaTotal, anchoTotal, pasos };
    }

    if (alturaTotal <= 1e-6) {
      return { valido: false, pctValidos, fitness: 800, f1: 1, f2: 1, f3: 1, f4: 1, anchoApoyo: 0, alturaTotal: 0, anchoTotal, pasos };
    }

    const numApoyo = Math.round(N * 0.35);
    const ordenadosPorY = [...pasos].sort((p1, p2) => p1.P.y - p2.P.y);
    const apoyo = ordenadosPorY.slice(0, numApoyo);
    const apoyoSet = new Set(apoyo.map(p => p.idx));

    let minYApoyo = Infinity, maxYApoyo = -Infinity;
    let minXApoyo = Infinity, maxXApoyo = -Infinity;
    let sumaYApoyo = 0;

    for (let s = 0; s < apoyo.length; s++) {
      const P = apoyo[s].P;
      if (P.y < minYApoyo) minYApoyo = P.y;
      if (P.y > maxYApoyo) maxYApoyo = P.y;
      if (P.x < minXApoyo) minXApoyo = P.x;
      if (P.x > maxXApoyo) maxXApoyo = P.x;
      sumaYApoyo += P.y;
    }

    const anchoApoyo = maxXApoyo - minXApoyo;
    if (anchoApoyo <= 1e-6) {
      return { valido: false, pctValidos, fitness: 800, f1: 1, f2: 1, f3: 1, f4: 1, anchoApoyo: 0, alturaTotal, anchoTotal, pasos };
    }

    const mediaYApoyo = sumaYApoyo / numApoyo;

    const f1 = (maxYApoyo - minYApoyo) / alturaTotal;
    const f2 = 1 - Math.min(1, anchoApoyo / (L + r3));
    const f3 = Math.max(0, 0.3 - (maxY - mediaYApoyo) / anchoApoyo) / 0.3;

    const dxPasos = [];
    for (let s = 0; s < N; s++) {
      const sig = (s + 1) % N;
      if (apoyoSet.has(s) && apoyoSet.has(sig)) {
        dxPasos.push(pasos[sig].P.x - pasos[s].P.x);
      }
    }

    let f4 = 1.0;
    if (dxPasos.length >= 3) {
      const promDx = dxPasos.reduce((acc, v) => acc + v, 0) / dxPasos.length;
      const promAbsDx = dxPasos.reduce((acc, v) => acc + Math.abs(v), 0) / dxPasos.length;
      const varianza = dxPasos.reduce((acc, v) => acc + (v - promDx) ** 2, 0) / dxPasos.length;
      const desvio = Math.sqrt(varianza);
      if (promAbsDx > 1e-6) {
        f4 = Math.min(1, desvio / promAbsDx);
      }
    }

    const fitness = w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4;

    return {
      valido: true,
      pctValidos,
      pasosInvalidos: 0,
      fitness,
      f1, f2, f3, f4,
      anchoApoyo,
      alturaTotal,
      anchoTotal,
      minYTotal: minY,
      maxYTotal: maxY,
      minYApoyo,
      maxYApoyo,
      mediaYApoyo,
      apoyoSet,
      pasos
    };
  },

  // Dibuja en el Canvas interactivo las 4 barras articuladas y la trayectoria animada del pie.
  dibujar(genoma, entrada, contenedor, contexto = {}) {
    if (idAnimacionPata !== null) {
      cancelAnimationFrame(idAnimacionPata);
      idAnimacionPata = null;
    }

    const m = this.obtenerMetricasDetalladas(genoma, entrada);

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
          El mecanismo no puede cerrar sus cuatro barras durante todo el giro completo de 360°. El optimizador continuará buscando soluciones cerradas.
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

    const canvas = document.getElementById("canvas-mecanismo");
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

    const aCanvas = (x, y, anchoCSS, altoCSS, escala) => {
      return {
        x: anchoCSS / 2 + (x - centroMundoX) * escala,
        y: altoCSS / 2 - (y - centroMundoY) * escala
      };
    };

    // Bucle continuo con requestAnimationFrame que anima la marcha del mecanismo de cuatro barras.
    const animar = () => {
      // Detiene la animación si el canvas fue desmontado del DOM al cambiar de modelo o redibujar.
      if (!canvas.isConnected) {
        if (idAnimacionPata !== null) {
          cancelAnimationFrame(idAnimacionPata);
          idAnimacionPata = null;
        }
        return;
      }

      const dpr = window.devicePixelRatio || 1;
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
      idAnimacionPata = requestAnimationFrame(animar);
    };

    idAnimacionPata = requestAnimationFrame(animar);
  },

  // Genera el informe textual con los parámetros cinemáticos encontrados y el desglose de métricas.
  describir(genoma, entrada) {
    const [dx, dy, L, r3, p, alpha] = genoma;
    const m = this.obtenerMetricasDetalladas(genoma, entrada);
    const alphaGrados = ((alpha * 180) / Math.PI).toFixed(1);

    let texto = `MECANISMO DE CUATRO BARRAS - PATA CAMINANTE\n`;
    texto += `========================================================\n`;
    texto += `PARÁMETROS DEL GENOMA (6 VARIABLES):\n`;
    texto += `  • Pivote O1 (fijo)        : (0.000, 0.000)\n`;
    texto += `  • Manivela O1-A (largo r1): 1.000 (fijo, unidad de escala)\n`;
    texto += `  • Pivote O2 (fijo dx, dy) : (${dx.toFixed(3)}, ${dy.toFixed(3)})\n`;
    texto += `  • Acoplador A-B (largo L) : ${L.toFixed(3)}\n`;
    texto += `  • Balancín r3             : ${r3.toFixed(3)}\n`;
    texto += `  • Extensión pie p         : ${p.toFixed(3)}\n`;
    texto += `  • Ángulo pie alpha        : ${alpha.toFixed(3)} rad (${alphaGrados}°)\n\n`;

    texto += `MÉTRICAS DE RENDIMIENTO DE LA MARCHA:\n`;
    texto += `  • Pasos cinemáticos válidos : ${m.pctValidos.toFixed(1)}%\n`;
    if (!m.valido) {
      texto += `  • Estado : Mecanismo inválido o discontinuo (Fitness: ${m.fitness.toFixed(1)})\n`;
    } else {
      texto += `  • f1 (Planitud del apoyo)   : ${m.f1.toFixed(4)} (más bajo = más recto)\n`;
      texto += `  • f2 (Zancada horizontal)  : ${m.f2.toFixed(4)} (más bajo = paso más amplio)\n`;
      texto += `  • f3 (Despeje de retorno)   : ${m.f3.toFixed(4)} (0 = altura de retorno óptima)\n`;
      texto += `  • f4 (Uniformidad veloc.)   : ${m.f4.toFixed(4)} (más bajo = velocidad más constante)\n\n`;
      texto += `FITNESS PONDERADO TOTAL       : ${m.fitness.toFixed(4)}\n`;
      texto += `  • Ancho útil de zancada     : ${m.anchoApoyo.toFixed(2)} unidades\n`;
      texto += `  • Altura total de la curva  : ${m.alturaTotal.toFixed(2)} unidades\n`;
    }
    texto += `========================================================\n`;

    return texto;
  }
};

export default ModeloPataCaminante;
