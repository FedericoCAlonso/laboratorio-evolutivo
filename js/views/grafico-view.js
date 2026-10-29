// =========================================================================
// CAPA VISTA: GRÁFICO 2D DE CONVERGENCIA Y DISPERSIÓN PARETO (CANVAS 2D)
// ARQUITECTURA MVVM - VISTA ESPECIALIZADA PARA LA VISUALIZACIÓN GRÁFICA
// =========================================================================

// Vista encargada de renderizar la evolución matemática en Canvas 2D (convergencia monobjetivo y Pareto multiobjetivo).
export class GraficoView {
  // Inicializa la vista con la referencia al elemento canvas del DOM.
  constructor(canvasElement, contenedorLeyenda = null) {
    this.canvas = canvasElement;
    this.contenedorLeyenda = contenedorLeyenda;
    this.limitesPareto = null;
  }

  // Actualiza la leyenda descriptiva bajo el gráfico según el modo de optimización.
  actualizarLeyenda(esMultiobjetivo) {
    const contenedor = this.contenedorLeyenda || document.querySelector(".leyenda-grafico");
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
  render({ historiaMejor = [], historiaPromedio = [], totalGeneraciones = 100, datosMulti = null }) {
    if (!this.canvas) return;

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
      this._dibujarScatterPlotPareto(ctx, anchoCSS, altoCSS, datosMulti);
      return;
    }

    this._dibujarConvergenciaMonobjetivo(ctx, anchoCSS, altoCSS, historiaMejor, historiaPromedio, totalGeneraciones);
  }

  // Renderiza la curva de convergencia monobjetivo tradicional.
  _dibujarConvergenciaMonobjetivo(ctx, anchoCSS, altoCSS, historiaMejor, historiaPromedio, totalGeneraciones) {
    this.canvas.style.cursor = "default";
    this.limitesPareto = null;
    this.canvas._limitesPareto = null;

    const margenIzq = 50;
    const margenDer = 20;
    const margenSup = 20;
    const margenInf = 30;
    const anchoGrafico = anchoCSS - margenIzq - margenDer;
    const altoGrafico = altoCSS - margenSup - margenInf;

    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.fillRect(margenIzq, margenSup, anchoGrafico, altoGrafico);

    if (!historiaMejor || historiaMejor.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Esperando inicio de la corrida...", anchoCSS / 2, altoCSS / 2);
      return;
    }

    let minVal = Math.min(...historiaMejor);
    let maxVal = Math.max(...historiaPromedio);

    if (minVal === maxVal) {
      maxVal += 1;
      minVal = Math.max(0, minVal - 1);
    }
    const rangoY = maxVal - minVal;

    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
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

    ctx.fillStyle = "#64748b";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Gen 0", margenIzq, altoCSS - 8);
    ctx.fillText(`Gen ${Math.floor(totalGeneraciones / 2)}`, margenIzq + anchoGrafico / 2, altoCSS - 8);
    ctx.fillText(`Gen ${totalGeneraciones}`, margenIzq + anchoGrafico, altoCSS - 8);
  }

  // Renderiza el gráfico de dispersión bidimensional (Scatter Plot) con la nube de puntos y la frontera de Pareto.
  _dibujarScatterPlotPareto(ctx, anchoCSS, altoCSS, datosMulti) {
    this.canvas.style.cursor = "pointer";

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

    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.fillRect(margenIzq, margenSup, anchoGrafico, altoGrafico);

    if (todosValidos.length === 0) {
      ctx.fillStyle = "#64748b";
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
      frenteValido: validosFrente
    };
    this.canvas._limitesPareto = this.limitesPareto;

    const aPixelX = (val) => margenIzq + ((val - x0) / (x1 - x0)) * anchoGrafico;
    const aPixelY = (val) => margenSup + altoGrafico - ((val - y0) / (y1 - y0)) * altoGrafico;

    // Trazado de grilla y escalas cartesianas.
    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
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
    ctx.fillStyle = "#334155";
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
      ctx.fillStyle = "#b45309";
      ctx.textAlign = "center";
      ctx.fillText("★ Seleccionado", sx, sy - 15);
    }

    // Indicador resumen en esquina superior derecha.
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#059669";
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
}

export default GraficoView;
