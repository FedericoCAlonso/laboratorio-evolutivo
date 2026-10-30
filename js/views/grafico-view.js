// =========================================================================
// CAPA VISTA: GRÁFICO 2D DE CONVERGENCIA Y DISPERSIÓN PARETO (CANVAS 2D)
// ARQUITECTURA MVVM - VISTA ESPECIALIZADA PARA LA VISUALIZACIÓN GRÁFICA
// =========================================================================

// Vista encargada de renderizar la evolución matemática en Canvas 2D (convergencia monobjetivo y Pareto multiobjetivo).
export class GraficoView {
  // Inicializa la vista con la referencia al elemento canvas del DOM y el tooltip M3 opcional.
  constructor(canvasElement, contenedorLeyenda = null, tooltipElement = null) {
    this.canvas = canvasElement;
    this.contenedorLeyenda = contenedorLeyenda;
    this.tooltip = tooltipElement || (typeof document !== "undefined" ? document.getElementById("tooltip-grafico-m3") : null);
    this.limitesPareto = null;
    this.limitesConvergencia = null;
    this.ultimoRenderArgs = null;
    this.indiceGenHover = null;
  }

  // Obtiene los colores semánticos del tema Material 3 activo con respaldo para ejecución Headless.
  _obtenerPaletaTema() {
    if (typeof window === "undefined" || typeof document === "undefined" || !window.getComputedStyle) {
      return {
        texto: "#64748b",
        textoFuerte: "#334155",
        grilla: "rgba(100, 116, 139, 0.2)",
        fondoArea: "rgba(0, 0, 0, 0.03)",
        primario: "#0061a4"
      };
    }
    const estilos = window.getComputedStyle(document.documentElement);
    const onSurfaceVariant = estilos.getPropertyValue("--md-sys-color-on-surface-variant").trim() || "#64748b";
    const onSurface = estilos.getComputedStyle ? onSurfaceVariant : (estilos.getPropertyValue("--md-sys-color-on-surface").trim() || "#334155");
    const primario = estilos.getPropertyValue("--md-sys-color-primary").trim() || "#0061a4";
    return {
      texto: onSurfaceVariant,
      textoFuerte: onSurface,
      grilla: "rgba(148, 163, 184, 0.22)",
      fondoArea: "rgba(148, 163, 184, 0.05)",
      primario
    };
  }

  // Actualiza la leyenda descriptiva bajo el gráfico según el modo de optimización.
  actualizarLeyenda(esMultiobjetivo) {
    const contenedor = this.contenedorLeyenda || (typeof document !== "undefined" ? document.querySelector(".leyenda-grafico") : null);
    if (!contenedor) return;

    if (esMultiobjetivo) {
      contenedor.innerHTML = `
        <div class="item-leyenda">
          <div class="color-leyenda" style="background-color: #10b981; border-radius: 50%; width: 10px; height: 10px;"></div>
          <span>Frente de Pareto F₀ (No dominados)</span>
        </div>
        <div class="item-leyenda">
          <div class="color-leyenda" style="background-color: #8b5cf6; border-radius: 50%; width: 8px; height: 8px;"></div>
          <span>Población (Frentes F₁+)</span>
        </div>
        <div class="item-leyenda">
          <div class="color-leyenda" style="background-color: #f59e0b; border-radius: 50%; width: 10px; height: 10px;"></div>
          <span>★ Selección Activa (Clic para ver mecanismo)</span>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="item-leyenda">
          <div class="color-leyenda" style="background-color: #10b981;"></div>
          <span>Mejor Individuo</span>
        </div>
        <div class="item-leyenda">
          <div class="color-leyenda" style="background-color: #8b5cf6;"></div>
          <span>Promedio Población</span>
        </div>
      `;
    }
  }

  // Dibuja en el Canvas 2D la curva monobjetivo o el scatter plot de Pareto según los datos provistos.
  render({ historiaMejor = [], historiaPromedio = [], totalGeneraciones = 100, datosMulti = null } = {}) {
    if (!this.canvas) return;
    this.ultimoRenderArgs = { historiaMejor, historiaPromedio, totalGeneraciones, datosMulti };

    const ctx = this.canvas.getContext("2d");
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const anchoCSS = this.canvas.clientWidth || 800;
    const altoCSS = this.canvas.clientHeight || 220;

    if (this.canvas.width !== anchoCSS * dpr || this.canvas.height !== altoCSS * dpr) {
      this.canvas.width = anchoCSS * dpr;
      this.canvas.height = altoCSS * dpr;
    }

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, anchoCSS, altoCSS);

    if (datosMulti && datosMulti.esMultiobjetivo) {
      this.limitesConvergencia = null;
      this._dibujarScatterPlotPareto(ctx, anchoCSS, altoCSS, datosMulti);
      return;
    }

    this._dibujarConvergenciaMonobjetivo(ctx, anchoCSS, altoCSS, historiaMejor, historiaPromedio, totalGeneraciones);
  }

  // Renderiza la curva de convergencia monobjetivo con soporte para línea guía (crosshair) interactiva.
  _dibujarConvergenciaMonobjetivo(ctx, anchoCSS, altoCSS, historiaMejor, historiaPromedio, totalGeneraciones) {
    this.canvas.style.cursor = historiaMejor && historiaMejor.length > 0 ? "crosshair" : "default";
    this.limitesPareto = null;
    this.canvas._limitesPareto = null;

    const paleta = this._obtenerPaletaTema();
    const margenIzq = 54;
    const margenDer = 20;
    const margenSup = 20;
    const margenInf = 30;
    const anchoGrafico = anchoCSS - margenIzq - margenDer;
    const altoGrafico = altoCSS - margenSup - margenInf;

    ctx.fillStyle = paleta.fondoArea;
    ctx.fillRect(margenIzq, margenSup, anchoGrafico, altoGrafico);

    if (!historiaMejor || historiaMejor.length === 0) {
      this.limitesConvergencia = null;
      ctx.fillStyle = paleta.texto;
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Esperando inicio de la corrida...", anchoCSS / 2, altoCSS / 2);
      return;
    }

    let minVal = Math.min(...historiaMejor);
    let maxVal = Math.max(...(historiaPromedio.length > 0 ? historiaPromedio : historiaMejor));

    if (minVal === maxVal) {
      maxVal += 1;
      minVal = Math.max(0, minVal - 1);
    }
    const rangoY = maxVal - minVal;

    this.limitesConvergencia = {
      margenIzq,
      margenSup,
      anchoGrafico,
      altoGrafico,
      minVal,
      maxVal,
      rangoY,
      totalGeneraciones: totalGeneraciones || Math.max(1, historiaMejor.length - 1),
      historiaMejor,
      historiaPromedio
    };

    ctx.strokeStyle = paleta.grilla;
    ctx.lineWidth = 1;
    ctx.fillStyle = paleta.texto;
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";

    const divisionesY = 4;
    for (let i = 0; i <= divisionesY; i++) {
      const y = margenSup + altoGrafico - (i / divisionesY) * altoGrafico;
      const valorY = minVal + (i / divisionesY) * rangoY;

      ctx.beginPath();
      ctx.moveTo(margenIzq, y);
      ctx.lineTo(margenIzq + anchoGrafico, y);
      ctx.stroke();

      ctx.fillText(valorY.toFixed(1), margenIzq - 8, y + 4);
    }

    const convertirCoordenadas = (indiceGen, valorFitness) => {
      const x = margenIzq + (indiceGen / (totalGeneraciones || 1)) * anchoGrafico;
      const y = margenSup + altoGrafico - ((valorFitness - minVal) / rangoY) * altoGrafico;
      return { x, y };
    };

    if (historiaPromedio.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 2;
      for (let i = 0; i < historiaPromedio.length; i++) {
        const pt = convertirCoordenadas(i, historiaPromedio[i]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    if (historiaMejor.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2.5;
      for (let i = 0; i < historiaMejor.length; i++) {
        const pt = convertirCoordenadas(i, historiaMejor[i]);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // Si hay una generación bajo el cursor (hover), dibujar línea vertical guía y puntos resaltados
    if (this.indiceGenHover !== null && this.indiceGenHover >= 0 && this.indiceGenHover < historiaMejor.length) {
      const idx = this.indiceGenHover;
      const ptMejor = convertirCoordenadas(idx, historiaMejor[idx]);
      if (typeof ctx.save === "function") ctx.save();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([4, 4]);
      ctx.strokeStyle = paleta.primario;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ptMejor.x, margenSup);
      ctx.lineTo(ptMejor.x, margenSup + altoGrafico);
      ctx.stroke();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);

      if (typeof ctx.arc === "function") {
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(ptMejor.x, ptMejor.y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        if (idx < historiaPromedio.length) {
          const ptProm = convertirCoordenadas(idx, historiaPromedio[idx]);
          ctx.fillStyle = "#8b5cf6";
          ctx.beginPath();
          ctx.arc(ptProm.x, ptProm.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (typeof ctx.restore === "function") ctx.restore();
    }

    ctx.fillStyle = paleta.texto;
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Gen 0", margenIzq, altoCSS - 8);
    ctx.fillText(`Gen ${Math.floor(totalGeneraciones / 2)}`, margenIzq + anchoGrafico / 2, altoCSS - 8);
    ctx.fillText(`Gen ${totalGeneraciones}`, margenIzq + anchoGrafico, altoCSS - 8);
  }

  // Renderiza el gráfico de dispersión bidimensional (Scatter Plot) con la nube de puntos y la frontera de Pareto.
  _dibujarScatterPlotPareto(ctx, anchoCSS, altoCSS, datosMulti) {
    this.canvas.style.cursor = "pointer";

    const paleta = this._obtenerPaletaTema();
    const frentePareto = datosMulti.frentePareto || [];
    const poblacion = datosMulti.poblacion || [];
    const nombres = datosMulti.nombresObjetivos || ["Objetivo 1", "Objetivo 2"];
    const seleccionado = datosMulti.individuoSeleccionado || null;

    const margenIzq = 65;
    const margenDer = 25;
    const margenSup = 28;
    const margenInf = 42;
    const anchoGrafico = anchoCSS - margenIzq - margenDer;
    const altoGrafico = altoCSS - margenSup - margenInf;

    const validosFrente = frentePareto.filter((p) => Array.isArray(p.fitness) && p.fitness[0] < 500 && p.fitness[1] < 500);
    const validosPoblacion = poblacion.filter((p) => Array.isArray(p.fitness) && p.fitness[0] < 500 && p.fitness[1] < 500);
    const todosValidos = [...validosFrente, ...validosPoblacion];

    ctx.fillStyle = paleta.fondoArea;
    ctx.fillRect(margenIzq, margenSup, anchoGrafico, altoGrafico);

    if (todosValidos.length === 0) {
      ctx.fillStyle = paleta.texto;
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Buscando soluciones cinemáticamente viables...", anchoCSS / 2, altoCSS / 2);
      this.limitesPareto = null;
      this.canvas._limitesPareto = null;
      return;
    }

    let minX = Math.min(...todosValidos.map((p) => p.fitness[0]));
    let maxX = Math.max(...todosValidos.map((p) => p.fitness[0]));
    let minY = Math.min(...todosValidos.map((p) => p.fitness[1]));
    let maxY = Math.max(...todosValidos.map((p) => p.fitness[1]));

    if (minX === maxX) {
      minX = Math.max(0, minX - 0.2);
      maxX += 0.2;
    }
    if (minY === maxY) {
      minY = Math.max(0, minY - 0.2);
      maxY += 0.2;
    }

    const padX = (maxX - minX) * 0.12 || 0.05;
    const padY = (maxY - minY) * 0.12 || 0.05;
    const x0 = Math.max(0, minX - padX);
    const x1 = maxX + padX;
    const y0 = Math.max(0, minY - padY);
    const y1 = maxY + padY;

    this.limitesPareto = {
      x0, x1, y0, y1,
      margenIzq, margenSup, anchoGrafico, altoGrafico,
      frenteValido: validosFrente,
      nombresObjetivos: nombres
    };
    this.canvas._limitesPareto = this.limitesPareto;

    const aPixelX = (val) => margenIzq + ((val - x0) / (x1 - x0)) * anchoGrafico;
    const aPixelY = (val) => margenSup + altoGrafico - ((val - y0) / (y1 - y0)) * altoGrafico;

    // Trazado de grilla y escalas cartesianas.
    ctx.strokeStyle = paleta.grilla;
    ctx.lineWidth = 1;
    ctx.fillStyle = paleta.texto;
    ctx.font = "11px system-ui";

    // Eje vertical Y (Objetivo 2).
    const divY = 4;
    ctx.textAlign = "right";
    for (let i = 0; i <= divY; i++) {
      const yVal = y0 + (i / divY) * (y1 - y0);
      const py = aPixelY(yVal);

      ctx.beginPath();
      ctx.moveTo(margenIzq, py);
      ctx.lineTo(margenIzq + anchoGrafico, py);
      ctx.stroke();

      ctx.fillText(yVal.toFixed(2), margenIzq - 8, py + 4);
    }

    // Eje horizontal X (Objetivo 1).
    const divX = 5;
    ctx.textAlign = "center";
    for (let i = 0; i <= divX; i++) {
      const xVal = x0 + (i / divX) * (x1 - x0);
      const px = aPixelX(xVal);

      ctx.beginPath();
      ctx.moveTo(px, margenSup);
      ctx.lineTo(px, margenSup + altoGrafico);
      ctx.stroke();

      ctx.fillText(xVal.toFixed(2), px, margenSup + altoGrafico + 16);
    }

    // Título e indicador de ejes.
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = paleta.textoFuerte;
    ctx.textAlign = "center";
    ctx.fillText(`Eje X: ${nombres[0]} (Menor = Mejor)`, margenIzq + anchoGrafico / 2, altoCSS - 6);

    ctx.save();
    ctx.translate(14, margenSup + altoGrafico / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Eje Y: ${nombres[1]} (Menor = Mejor)`, 0, 0);
    ctx.restore();

    // 1. Población dominada (Frentes F1+).
    ctx.fillStyle = "rgba(139, 92, 246, 0.5)";
    ctx.strokeStyle = "rgba(109, 40, 217, 0.7)";
    ctx.lineWidth = 1;
    for (let i = 0; i < validosPoblacion.length; i++) {
      const ind = validosPoblacion[i];
      if (ind.rango > 0) {
        const px = aPixelX(ind.fitness[0]);
        const py = aPixelY(ind.fitness[1]);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 2. Frontera de Pareto (F0): curva y puntos no dominados.
    validosFrente.sort((a, b) => a.fitness[0] - b.fitness[0]);
    if (validosFrente.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < validosFrente.length; i++) {
        const px = aPixelX(validosFrente[i].fitness[0]);
        const py = aPixelY(validosFrente[i].fitness[1]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Puntos del frente no dominado F0.
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#065f46";
    ctx.lineWidth = 2;
    for (let i = 0; i < validosFrente.length; i++) {
      const px = aPixelX(validosFrente[i].fitness[0]);
      const py = aPixelY(validosFrente[i].fitness[1]);
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Resaltado de la solución seleccionada.
    if (seleccionado && Array.isArray(seleccionado.fitness)) {
      const sx = aPixelX(seleccionado.fitness[0]);
      const sy = aPixelY(seleccionado.fitness[1]);

      ctx.beginPath();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.arc(sx, sy, 11, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = "#f59e0b";
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 2;
      ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "center";
      ctx.fillText("★ Seleccionado", sx, sy - 15);
    }

    // Indicador resumen en esquina superior derecha.
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "right";
    ctx.fillText(`Frente Pareto: ${validosFrente.length} soluciones (Clic para inspeccionar)`, margenIzq + anchoGrafico, margenSup - 8);
  }

  // Localiza el individuo del frente de Pareto más cercano a las coordenadas del mouse en el Canvas.
  obtenerPuntoParetoCercano(clientX, clientY) {
    if (!this.canvas) return null;
    const limites = this.limitesPareto || this.canvas._limitesPareto;
    if (!limites || !limites.frenteValido || limites.frenteValido.length === 0) return null;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const { x0, x1, y0, y1, margenIzq, margenSup, anchoGrafico, altoGrafico, frenteValido } = limites;

    let mejorInd = null;
    let distMinima = Infinity;

    for (let i = 0; i < frenteValido.length; i++) {
      const ind = frenteValido[i];
      const px = margenIzq + ((ind.fitness[0] - x0) / (x1 - x0)) * anchoGrafico;
      const py = margenSup + altoGrafico - ((ind.fitness[1] - y0) / (y1 - y0)) * altoGrafico;

      const dist = Math.hypot(mouseX - px, mouseY - py);
      if (dist < distMinima) {
        distMinima = dist;
        mejorInd = ind;
      }
    }

    if (distMinima <= 45) {
      return mejorInd;
    }
    return null;
  }

  // Gestiona el movimiento del cursor sobre el gráfico para mostrar el tooltip interactivo M3 y la guía vertical.
  actualizarHover(clientX, clientY) {
    if (!this.canvas || typeof this.canvas.getBoundingClientRect !== "function") return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // 1. Modo Multiobjetivo Pareto
    if (this.limitesPareto) {
      const punto = this.obtenerPuntoParetoCercano(clientX, clientY);
      this.canvas.style.cursor = punto ? "pointer" : "default";
      if (punto && this.tooltip) {
        const nombres = this.limitesPareto.nombresObjetivos || ["f₁", "f₂"];
        this.tooltip.innerHTML = `<strong>★ Individuo Pareto</strong><br>${nombres[0]}: <b>${punto.fitness[0].toFixed(3)}</b> | ${nombres[1]}: <b>${punto.fitness[1].toFixed(3)}</b>`;
        this._posicionarTooltip(mouseX, mouseY, rect.width);
      } else {
        this.ocultarHover();
      }
      return;
    }

    // 2. Modo Convergencia Monobjetivo
    if (this.limitesConvergencia) {
      const { margenIzq, anchoGrafico, totalGeneraciones, historiaMejor, historiaPromedio } = this.limitesConvergencia;
      if (mouseX < margenIzq || mouseX > margenIzq + anchoGrafico || historiaMejor.length === 0) {
        this.ocultarHover();
        return;
      }

      const ratio = (mouseX - margenIzq) / Math.max(1, anchoGrafico);
      const genEstimada = Math.round(ratio * (totalGeneraciones || 1));
      const idx = Math.max(0, Math.min(historiaMejor.length - 1, genEstimada));

      if (this.indiceGenHover !== idx) {
        this.indiceGenHover = idx;
        if (this.ultimoRenderArgs) {
          this.render(this.ultimoRenderArgs);
        }
      }

      if (this.tooltip) {
        const mejorVal = Number(historiaMejor[idx]).toFixed(4);
        const promVal = idx < historiaPromedio.length ? Number(historiaPromedio[idx]).toFixed(4) : "--";
        this.tooltip.innerHTML = `<strong>Generación ${idx}</strong><br><span style="color:#10b981;">● Mejor: ${mejorVal}</span> | <span style="color:#8b5cf6;">● Prom: ${promVal}</span>`;
        this._posicionarTooltip(mouseX, mouseY, rect.width);
      }
    }
  }

  // Posiciona y hace visible el tooltip flotante dentro de los límites del contenedor del gráfico.
  _posicionarTooltip(mouseX, mouseY, anchoCanvas) {
    if (!this.tooltip) return;
    const desplazarIzq = mouseX > anchoCanvas * 0.65;
    this.tooltip.style.left = desplazarIzq ? `${Math.max(8, mouseX - 210)}px` : `${mouseX + 14}px`;
    this.tooltip.style.top = `${Math.max(8, mouseY - 38)}px`;
    this.tooltip.classList.add("visible");
  }

  // Oculta el tooltip flotante y limpia el estado de resaltado temporal bajo el cursor.
  ocultarHover() {
    if (this.tooltip) {
      this.tooltip.classList.remove("visible");
    }
    if (this.indiceGenHover !== null) {
      this.indiceGenHover = null;
      if (this.ultimoRenderArgs) {
        this.render(this.ultimoRenderArgs);
      }
    }
  }
}

export default GraficoView;
