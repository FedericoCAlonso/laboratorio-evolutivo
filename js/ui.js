// =========================================================================
// MÓDULO: INTERFAZ DE USUARIO (FORMULARIOS DINÁMICOS, GRÁFICO CANVAS Y PROGRESO)
// =========================================================================

import { obtenerPlantillaSimulacion } from "./builder.js";

// Textos de ayuda descriptivos para cada naturaleza de representación gráfica en el diseñador.
export const HINTS_VISUALIZACION = {
  "calibracion": "Muestra el estado y magnitud de cada variable en indicadores visuales de barra y porcentaje de rango.",
  "campo_potencial_2d": "Genera un mapa de calor 2D continuo con curvas de nivel (isolíneas equipotenciales), gradiente de fuerza y ubicación de partículas.",
  "campo_vectorial_2d": "Muestra una grilla de vectores direccionales de velocidad y líneas de flujo con rotación de vórtices.",
  "trayectoria_particulas_2d": "Traza waypoints espaciales 2D, rutas dinámicas y zonas de obstáculos con evasión animada.",
  "serie_temporal": "Renderiza un osciloscopio en tiempo real con curva transitoria y(t) o respuesta en frecuencia.",
  "mecanismo_barras_2d": "Dibuja articulaciones cinemáticas y eslabones mecánicos conectados en el plano 2D.",
  "distribucion_recursos": "Presenta barras apiladas e indicadores de balanceo de cargas y capacidad de servidores.",
  "acustica_ondas_2d": "Simula la interferencia constructiva de ondas de presión acústica propagándose y el patrón polar de directividad.",
  "electromagnetismo_lorentz": "Muestra el flujo magnético Bz, bobinas de electroimanes y la trayectoria del haz de iones bajo la fuerza de Lorentz.",
  "fonoabsorbente_acustico": "Ilustra el corte transversal de cuñas o capas estratificadas con atenuación espectral dBA y rebotes acústicos.",
  "linea_transmision_smith": "Traza el coeficiente de reflexión Gamma sobre la Carta de Smith polar y calcula la Relación de Onda Estacionaria (ROE).",
  "corte_chapa_nesting": "Visualiza el plano de corte 2D con aprovechamiento de chapa matriz y minimización de retazos residuales.",
  "mecanismo_jansen": "Simula el mecanismo de 13 barras de Theo Jansen con lazo cinemático cerrado, curva del pie, aceleración y manipulación interactiva directa."
};

// Muestra u oculta la barra superior de alerta con mensajes de error o validación.
export function mostrarAlerta(mensaje, elementoAlerta) {
  if (!elementoAlerta) return;
  if (!mensaje) {
    elementoAlerta.style.display = "none";
    elementoAlerta.textContent = "";
    return;
  }
  elementoAlerta.className = "alerta alerta-error";
  elementoAlerta.textContent = mensaje;
  elementoAlerta.style.display = "block";
  elementoAlerta.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Construye dinámicamente los campos del formulario según los parametrosEntrada del modelo.
export function construirFormularioModelo(modelo, contenedor, valoresGuardados = null, elementoAlerta = null) {
  if (!contenedor) return;
  contenedor.innerHTML = "";
  if (elementoAlerta) mostrarAlerta(null, elementoAlerta);

  const params = modelo.parametrosEntrada || [];
  if (params.length === 0) {
    const nota = document.createElement("div");
    nota.style.padding = "0.75rem";
    nota.style.fontSize = "0.85rem";
    nota.style.color = "var(--texto-secundario)";
    nota.style.background = "var(--bg-input)";
    nota.style.borderRadius = "var(--radio-sm)";
    nota.style.border = "1px solid var(--borde)";
    nota.textContent = "ℹ️ Este modelo dinámico optimiza directamente las variables matemáticas de su definición.";
    contenedor.appendChild(nota);
    return;
  }

  params.forEach(param => {
    const valorInicial = valoresGuardados && valoresGuardados[param.clave] !== undefined
      ? valoresGuardados[param.clave]
      : param.valorDefecto;

    const wrapper = document.createElement("div");
    wrapper.className = "grupo-campo";
    wrapper.dataset.clave = param.clave;
    wrapper.dataset.tipo = param.tipo;

    const label = document.createElement("label");
    label.textContent = param.etiqueta;
    wrapper.appendChild(label);

    if (param.tipo === "numero") {
      // Campo numérico directo con límites y paso opcional.
      const input = document.createElement("input");
      input.type = "number";
      input.id = `campo-modelo-${param.clave}`;
      input.value = valorInicial;
      if (param.min !== undefined) input.min = param.min;
      if (param.max !== undefined) input.max = param.max;
      if (param.paso !== undefined) input.step = param.paso;
      wrapper.appendChild(input);
    } else if (param.tipo === "selector") {
      // Menú desplegable para selección de modos o valores discretos.
      const select = document.createElement("select");
      select.id = `campo-modelo-${param.clave}`;
      (param.opciones || []).forEach(opt => {
        const option = document.createElement("option");
        option.value = typeof opt === "object" ? opt.valor : opt;
        option.textContent = typeof opt === "object" ? opt.etiqueta : opt;
        if (option.value === String(valorInicial)) option.selected = true;
        select.appendChild(option);
      });
      wrapper.appendChild(select);
    } else if (param.tipo === "texto") {
      // Campo de texto plano o selector de modo.
      const input = document.createElement("input");
      input.type = "text";
      input.id = `campo-modelo-${param.clave}`;
      input.value = valorInicial || "";
      wrapper.appendChild(input);
    } else if (param.tipo === "tabla") {
      // Editor dinámico de listas tabulares con agregar y quitar filas.
      const contenedorTabla = document.createElement("div");
      contenedorTabla.className = "tabla-responsive";

      const tabla = document.createElement("table");
      tabla.className = "tabla-datos";
      tabla.id = `tabla-modelo-${param.clave}`;

      const thead = document.createElement("thead");
      const trHead = document.createElement("tr");
      param.columnas.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col.etiqueta;
        trHead.appendChild(th);
      });
      const thAccion = document.createElement("th");
      thAccion.textContent = "Acción";
      thAccion.style.width = "70px";
      trHead.appendChild(thAccion);
      thead.appendChild(trHead);
      tabla.appendChild(thead);

      const tbody = document.createElement("tbody");
      tabla.appendChild(tbody);
      contenedorTabla.appendChild(tabla);
      wrapper.appendChild(contenedorTabla);

      // Función interna para añadir una fila individual a la tabla.
      const agregarFila = (datosFila = {}) => {
        const tr = document.createElement("tr");
        param.columnas.forEach(col => {
          const td = document.createElement("td");
          const val = datosFila[col.clave] !== undefined ? datosFila[col.clave] : "";

          if (col.tipo === "selector") {
            const sel = document.createElement("select");
            sel.dataset.columna = col.clave;
            col.opciones.forEach(opt => {
              const o = document.createElement("option");
              o.value = opt;
              o.textContent = opt === "" ? "(Cualquiera)" : `Fase ${opt}`;
              if (opt === val) o.selected = true;
              sel.appendChild(o);
            });
            td.appendChild(sel);
          } else if (col.tipo === "numero") {
            const inp = document.createElement("input");
            inp.type = "number";
            inp.dataset.columna = col.clave;
            inp.value = val;
            if (col.min !== undefined) inp.min = col.min;
            if (col.max !== undefined) inp.max = col.max;
            if (col.paso !== undefined) inp.step = col.paso;
            td.appendChild(inp);
          } else {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.dataset.columna = col.clave;
            inp.value = val;
            td.appendChild(inp);
          }
          tr.appendChild(td);
        });

        // Botón de eliminar fila.
        const tdBorrar = document.createElement("td");
        const btnBorrar = document.createElement("button");
        btnBorrar.type = "button";
        btnBorrar.className = "btn-fila-borrar";
        btnBorrar.textContent = "✕ Quitar";
        btnBorrar.title = "Eliminar circuito";
        btnBorrar.addEventListener("click", () => tr.remove());
        tdBorrar.appendChild(btnBorrar);
        tr.appendChild(tdBorrar);

        tbody.appendChild(tr);
      };

      const filasIniciales = Array.isArray(valorInicial) ? valorInicial : [];
      filasIniciales.forEach(f => agregarFila(f));

      const btnAgregar = document.createElement("button");
      btnAgregar.type = "button";
      btnAgregar.className = "btn-secundario";
      btnAgregar.style.marginTop = "0.5rem";
      btnAgregar.textContent = "➕ Agregar Circuito";
      btnAgregar.addEventListener("click", () => {
        agregarFila({ nombre: `Circuito Nuevo ${tbody.children.length + 1}`, corriente: 10.0, faseFija: "" });
      });
      wrapper.appendChild(btnAgregar);
    }

    contenedor.appendChild(wrapper);
  });
}

// Extrae y valida los datos de entrada del modelo actual desde el DOM.
export function obtenerDatosEntradaModelo(modelo) {
  const datos = {};
  const params = modelo.parametrosEntrada || [];

  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    if (param.tipo === "numero") {
      const el = document.getElementById(`campo-modelo-${param.clave}`);
      const num = Number(el.value);
      if (isNaN(num)) {
        throw new Error(`El campo '${param.etiqueta}' debe ser un número válido.`);
      }
      datos[param.clave] = num;
    } else if (param.tipo === "texto" || param.tipo === "selector") {
      const el = document.getElementById(`campo-modelo-${param.clave}`);
      datos[param.clave] = el ? el.value.trim() : (param.valorDefecto || "");
    } else if (param.tipo === "tabla") {
      const tabla = document.getElementById(`tabla-modelo-${param.clave}`);
      const tbody = tabla.querySelector("tbody");
      const filas = [];

      for (let f = 0; f < tbody.children.length; f++) {
        const tr = tbody.children[f];
        const objFila = {};
        param.columnas.forEach(col => {
          const inputCol = tr.querySelector(`[data-columna="${col.clave}"]`);
          if (col.tipo === "numero") {
            const valNum = Number(inputCol.value);
            if (isNaN(valNum) || valNum <= 0) {
              throw new Error(`Fila ${f + 1}: La corriente debe ser un número positivo mayor a 0.`);
            }
            objFila[col.clave] = valNum;
          } else if (col.tipo === "texto") {
            const texto = inputCol.value.trim();
            if (!texto) {
              throw new Error(`Fila ${f + 1}: El nombre del circuito no puede estar vacío.`);
            }
            objFila[col.clave] = texto;
          } else {
            objFila[col.clave] = inputCol.value;
          }
        });
        filas.push(objFila);
      }

      if (filas.length === 0) {
        throw new Error("Debe ingresar al menos un circuito en la tabla para optimizar.");
      }
      datos[param.clave] = filas;
    }
  }

  return datos;
}

// Extrae y valida los parámetros de configuración del motor genético desde el DOM.
export function obtenerParametrosMotor() {
  const poblacion = parseInt(document.getElementById("param-poblacion").value, 10);
  const generaciones = parseInt(document.getElementById("param-generaciones").value, 10);
  const mutacion = parseFloat(document.getElementById("param-mutacion").value);
  const elitismo = parseInt(document.getElementById("param-elitismo").value, 10);
  const torneo = parseInt(document.getElementById("param-torneo").value, 10);
  const replicas = parseInt(document.getElementById("param-replicas-ruido").value, 10);
  const semilla = parseInt(document.getElementById("param-semilla").value, 10);

  if (isNaN(poblacion) || poblacion < 4) throw new Error("La población debe ser al menos de 4 individuos.");
  if (isNaN(generaciones) || generaciones < 1) throw new Error("Las generaciones deben ser al menos 1.");
  if (isNaN(mutacion) || mutacion < 0 || mutacion > 1) throw new Error("La tasa de mutación debe estar entre 0.0 y 1.0.");
  if (isNaN(elitismo) || elitismo < 0 || elitismo >= poblacion) throw new Error("El elitismo debe ser menor que el tamaño de población.");
  if (isNaN(torneo) || torneo < 1 || torneo > poblacion) throw new Error("El torneo debe estar entre 1 y el tamaño de población.");
  if (isNaN(semilla)) throw new Error("La semilla debe ser un número entero válido.");

  return {
    tamanoPoblacion: poblacion,
    generaciones: generaciones,
    tasaMutacion: mutacion,
    elitismo: elitismo,
    tamanoTorneo: torneo,
    nReplicasRuido: isNaN(replicas) || replicas < 1 ? 5 : replicas,
    semilla: semilla
  };
}

// Dibuja en el Canvas 2D el gráfico correspondiente: curva monobjetivo o dispersión multiobjetivo (Scatter Plot Pareto).
export function dibujarGraficoFitness(canvasFitness, historiaMejor, historiaPromedio, totalGeneraciones, datosMulti = null) {
  if (!canvasFitness) return;
  const ctx = canvasFitness.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const anchoCSS = canvasFitness.clientWidth || 800;
  const altoCSS = canvasFitness.clientHeight || 220;

  if (canvasFitness.width !== anchoCSS * dpr || canvasFitness.height !== altoCSS * dpr) {
    canvasFitness.width = anchoCSS * dpr;
    canvasFitness.height = altoCSS * dpr;
  }
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, anchoCSS, altoCSS);

  // Si se dispone de datos multiobjetivo activos, se renderiza el gráfico de dispersión de Pareto.
  if (datosMulti && datosMulti.esMultiobjetivo) {
    dibujarScatterPlotPareto(ctx, canvasFitness, anchoCSS, altoCSS, datosMulti);
    return;
  }

  // Gráfico de convergencia monobjetivo tradicional.
  canvasFitness.style.cursor = "default";
  canvasFitness._limitesPareto = null;

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
function dibujarScatterPlotPareto(ctx, canvasFitness, anchoCSS, altoCSS, datosMulti) {
  canvasFitness.style.cursor = "pointer";

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

  // Filtrado de soluciones físicamente válidas para no distorsionar las escalas con penalizaciones.
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
    canvasFitness._limitesPareto = null;
    return;
  }

  // Determinación de los rangos coordenados de ambos objetivos.
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

  // Persistencia de los límites para la detección de clics interactivos del usuario.
  canvasFitness._limitesPareto = {
    x0, x1, y0, y1,
    margenIzq, margenSup, anchoGrafico, altoGrafico,
    frenteValido: validosFrente
  };

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

  // Título e indicador de objetivos.
  ctx.font = "bold 11px system-ui";
  ctx.fillStyle = "#334155";
  ctx.textAlign = "center";
  ctx.fillText(`Eje X: ${nombres[0]} (Menor = Mejor)`, margenIzq + anchoGrafico / 2, altoCSS - 6);

  ctx.save();
  ctx.translate(14, margenSup + altoGrafico / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`Eje Y: ${nombres[1]} (Menor = Mejor)`, 0, 0);
  ctx.restore();

  // 1. Dibujo de los puntos de la población dominada (Frentes F1+).
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

  // 2. Dibujo de la frontera de Pareto (F0): curva y puntos no dominados.
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

  // Puntos del frente de Pareto F0.
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

  // 3. Resaltado del individuo seleccionado actualmente por el usuario.
  if (seleccionado && Array.isArray(seleccionado.fitness)) {
    const sx = aPixelX(seleccionado.fitness[0]);
    const sy = aPixelY(seleccionado.fitness[1]);

    // Anillo exterior brillante.
    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.arc(sx, sy, 11, 0, 2 * Math.PI);
    ctx.stroke();

    // Punto central resaltado.
    ctx.beginPath();
    ctx.fillStyle = "#f59e0b";
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Etiqueta flotante explicativa.
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#b45309";
    ctx.textAlign = "center";
    ctx.fillText("★ Seleccionado", sx, sy - 15);
  }

  // Resumen de cantidad de puntos óptimos en la esquina superior derecha.
  ctx.font = "bold 11px system-ui";
  ctx.fillStyle = "#059669";
  ctx.textAlign = "right";
  ctx.fillText(`Frente Pareto: ${validosFrente.length} soluciones (Clic para inspeccionar)`, margenIzq + anchoGrafico, margenSup - 8);
}

// Localiza el individuo del frente de Pareto más cercano a las coordenadas del mouse en el Canvas.
export function obtenerPuntoParetoCercano(canvasFitness, clientX, clientY) {
  const limites = canvasFitness._limitesPareto;
  if (!limites || !limites.frenteValido || limites.frenteValido.length === 0) return null;

  const rect = canvasFitness.getBoundingClientRect();
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

  // Se retorna el individuo si el cursor se encuentra a una distancia razonable (máximo 45px en pantalla).
  if (distMinima <= 45) {
    return mejorInd;
  }
  return null;
}

// Actualiza los elementos visuales de la leyenda inferior según el modo de optimización activo.
export function actualizarLeyendaGrafico(esMultiobjetivo) {
  const leyenda = document.querySelector(".leyenda-grafico");
  if (!leyenda) return;

  if (esMultiobjetivo) {
    leyenda.innerHTML = `
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
    leyenda.innerHTML = `
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

// Actualiza los estados de los botones de la botonera principal según el estado de la corrida.
export function actualizarBotonesControl(estado, btns, textoEstado) {
  const { btnCorrer, btnPausar, btnDetener } = btns;
  if (!btnCorrer || !btnPausar || !btnDetener) return;

  if (estado === "CORRIENDO") {
    btnCorrer.disabled = true;
    btnPausar.disabled = false;
    btnPausar.textContent = "⏸ Pausar";
    btnDetener.disabled = false;
    if (textoEstado) textoEstado.textContent = "Evolucionando población...";
  } else if (estado === "PAUSADO") {
    btnCorrer.disabled = true;
    btnPausar.disabled = false;
    btnPausar.textContent = "▶ Reanudar";
    btnDetener.disabled = false;
    if (textoEstado) textoEstado.textContent = "Simulación pausada";
  } else {
    btnCorrer.disabled = false;
    btnPausar.disabled = true;
    btnPausar.textContent = "⏸ Pausar";
    btnDetener.disabled = true;
  }
}

// Abre el modal del constructor low-code reiniciando sus campos o precargando los datos existentes para edición.
export function abrirModalConstructor(elementosModal, datosIniciales = null, esEdicion = false) {
  const vistaEstudio = document.getElementById("vista-estudio");
  const vistaLaboratorio = document.getElementById("vista-laboratorio");
  if (vistaEstudio && vistaLaboratorio) {
    vistaLaboratorio.style.display = "none";
    vistaEstudio.style.display = "flex";
  }

  const { modal, alerta, inputNombre, inputDesc, tbody, textareaCodigo, selectTipoVisualizacion, selectPlantilla, hintTipoVisualizacion } = elementosModal;
  if (!modal && !vistaEstudio) return;

  mostrarAlerta(null, alerta);
  tbody.innerHTML = "";

  const tituloEl = modal.querySelector(".modal-header h3");
  if (tituloEl) {
    tituloEl.textContent = esEdicion ? "✏️ Editar Simulación (Low-Code)" : "🛠️ Diseñador de Simulaciones (Low-Code)";
  }

  modal.dataset.modo = esEdicion ? "edicion" : "creacion";
  modal.dataset.modeloId = datosIniciales?.id || "";

  // Selector de plantillas de ejemplo
  if (selectPlantilla) {
    selectPlantilla.value = "";
    selectPlantilla.onchange = (e) => {
      const plantilla = obtenerPlantillaSimulacion(e.target.value);
      if (!plantilla) return;
      inputNombre.value = plantilla.nombre;
      inputDesc.value = plantilla.descripcion;
      if (selectTipoVisualizacion) {
        selectTipoVisualizacion.value = plantilla.tipoVisualizacion || "calibracion";
        if (hintTipoVisualizacion) {
          hintTipoVisualizacion.textContent = HINTS_VISUALIZACION[selectTipoVisualizacion.value] || "";
        }
      }
      textareaCodigo.value = plantilla.codigoEvaluacion;
      tbody.innerHTML = "";
      plantilla.variables.forEach(v => agregarFilaVariableConstructor(tbody, v));
    };
  }

  // Escuchador para cambiar la ayuda contextual según la naturaleza de la simulación
  if (selectTipoVisualizacion) {
    selectTipoVisualizacion.onchange = (e) => {
      if (hintTipoVisualizacion) {
        hintTipoVisualizacion.textContent = HINTS_VISUALIZACION[e.target.value] || "";
      }
    };
  }

  if (datosIniciales) {
    inputNombre.value = datosIniciales.nombre || "";
    inputDesc.value = datosIniciales.descripcion || "";
    if (selectTipoVisualizacion) {
      selectTipoVisualizacion.value = datosIniciales.tipoVisualizacion || "calibracion";
      if (hintTipoVisualizacion) {
        hintTipoVisualizacion.textContent = HINTS_VISUALIZACION[selectTipoVisualizacion.value] || "";
      }
    }
    textareaCodigo.value = datosIniciales.codigoEvaluacion || "";
    (datosIniciales.variables || []).forEach(v => agregarFilaVariableConstructor(tbody, v));
  } else {
    inputNombre.value = "";
    inputDesc.value = "";
    if (selectTipoVisualizacion) {
      selectTipoVisualizacion.value = "calibracion";
      if (hintTipoVisualizacion) {
        hintTipoVisualizacion.textContent = HINTS_VISUALIZACION["calibracion"];
      }
    }
    textareaCodigo.value = "// Minimizar el error cuadrático respecto a un volumen objetivo de 100\nconst volumen = vars.ancho * vars.alto;\nreturn Math.abs(volumen - 100);";

    // Fila 1 de ejemplo: ancho
    agregarFilaVariableConstructor(tbody, { nombre: "ancho", tipo: "continuo", min: 1, max: 20 });
    // Fila 2 de ejemplo: alto
    agregarFilaVariableConstructor(tbody, { nombre: "alto", tipo: "continuo", min: 1, max: 20 });
  }

  modal.style.display = "flex";
  inputNombre.focus();
}

// Oculta el modal del constructor de modelos dinámicos.
export function cerrarModalConstructor(elementosModal) {
  const { modal, alerta } = elementosModal;
  if (!modal) return;
  mostrarAlerta(null, alerta);
  modal.style.display = "none";
}

// Muestra una notificación flotante estilo Snackbar de Material 3 con auto-ocultamiento.
export function mostrarToast(mensaje, duracion = 3200) {
  let toast = document.getElementById("toast-m3");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-m3";
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.classList.add("visible");

  if (toast._timer) clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("visible");
  }, duracion);
}

// Aplica el tema de modo (light/dark/auto) y paleta tonal de color en los atributos raíz del documento.
export function aplicarTemaColor(modo = "auto", acento = "ocean") {
  const html = document.documentElement;
  html.setAttribute("data-theme", modo);
  html.setAttribute("data-color", acento);

  // Sincroniza el botón activo del modo
  document.querySelectorAll(".chip-tema-btn").forEach(btn => {
    const id = btn.id;
    const esActivo = (modo === "light" && id.includes("claro")) ||
                     (modo === "dark" && id.includes("oscuro")) ||
                     (modo === "auto" && id.includes("auto"));
    btn.classList.toggle("activo", esActivo);
  });

  // Sincroniza el dot activo de la paleta
  document.querySelectorAll(".btn-dot-paleta").forEach(btn => {
    btn.classList.toggle("activo", btn.dataset.color === acento);
  });
}

// Actualiza la visibilidad de los botones de la barra de acciones de simulación según el modelo activo.
export function actualizarToolbarAcciones(modeloActual, elementosToolbar) {
  const { btnEditar, btnRenombrar, btnEliminar, btnCopiar, btnExportar, btnGuardarPreset } = elementosToolbar;
  const esDinamico = Boolean(modeloActual && modeloActual.esDinamico);

  if (btnEditar) btnEditar.style.display = "inline-flex";
  if (btnRenombrar) btnRenombrar.style.display = esDinamico ? "inline-flex" : "none";
  if (btnEliminar) btnEliminar.style.display = esDinamico ? "inline-flex" : "none";

  if (btnCopiar) btnCopiar.style.display = "inline-flex";
  if (btnExportar) btnExportar.style.display = "inline-flex";
  if (btnGuardarPreset) btnGuardarPreset.style.display = "inline-flex";
}

// Abre el diálogo de renombrado rápido para modificar el título y descripción de una simulación.
export function abrirModalRenombrar(elementosRenombrar, modelo) {
  const { modal, inputNombre, inputDesc } = elementosRenombrar;
  if (!modal) return;
  modal.dataset.modeloId = modelo.id;
  inputNombre.value = modelo.nombre || "";
  inputDesc.value = modelo.descripcion || "";
  modal.style.display = "flex";
  inputNombre.focus();
}

// Cierra el diálogo de renombrado rápido.
export function cerrarModalRenombrar(elementosRenombrar) {
  if (elementosRenombrar.modal) {
    elementosRenombrar.modal.style.display = "none";
  }
}

// Abre el modal para importar simulaciones en formato JSON.
export function abrirModalImportar(elementosImportar) {
  const { modal, alerta, textarea, inputArchivo } = elementosImportar;
  if (!modal) return;
  mostrarAlerta(null, alerta);
  if (textarea) textarea.value = "";
  if (inputArchivo) inputArchivo.value = "";
  modal.style.display = "flex";
}

// Cierra el modal de importación JSON.
export function cerrarModalImportar(elementosImportar) {
  if (elementosImportar.modal) {
    elementosImportar.modal.style.display = "none";
  }
}

// Abre el diálogo para guardar un preset con la configuración actual completa.
export function abrirModalGuardarPreset(elementosPreset, sugerenciaNombre = "") {
  const { modal, inputNombre } = elementosPreset;
  if (!modal) return;
  inputNombre.value = sugerenciaNombre;
  modal.style.display = "flex";
  inputNombre.focus();
}

// Cierra el diálogo de guardar preset.
export function cerrarModalGuardarPreset(elementosPreset) {
  if (elementosPreset.modal) {
    elementosPreset.modal.style.display = "none";
  }
}

// Renderiza y abre la biblioteca completa con todas las simulaciones y presets guardados.
export function abrirModalBiblioteca(elementosBiblioteca, modelos, presets, onAccion) {
  const { modal, contenedor, inputBuscar } = elementosBiblioteca;
  if (!modal || !contenedor) return;

  const renderizarItems = (filtro = "") => {
    contenedor.innerHTML = "";
    const filtroNorm = filtro.toLowerCase().trim();

    // 1. Modelos (Nativos y Dinámicos)
    modelos.forEach(mod => {
      const textoBuscar = `${mod.nombre} ${mod.descripcion || ""}`.toLowerCase();
      if (filtroNorm && !textoBuscar.includes(filtroNorm)) return;

      const card = document.createElement("div");
      card.className = "tarjeta-simulacion-biblioteca";

      const badgeClase = mod.esDinamico ? "badge-dinamico" : "badge-nativo";
      const badgeTexto = mod.esDinamico ? "Dinámico Low-Code" : "Modelo Nativo";

      card.innerHTML = `
        <div>
          <h4>
            <span>${mod.nombre}</span>
            <span class="badge-tipo-sim ${badgeClase}">${badgeTexto}</span>
          </h4>
          <p style="font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant); margin-top: 0.35rem;">
            ${mod.descripcion || "Sin descripción"}
          </p>
        </div>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem;">
          <button type="button" class="btn-m3-filled btn-cargar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">▶ Cargar</button>
          <button type="button" class="btn-m3-tonal btn-copiar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">📑 Copiar</button>
          <button type="button" class="btn-m3-tonal btn-editar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">✏️ Editar en Estudio</button>
          ${mod.esDinamico ? `
            <button type="button" class="btn-m3-tonal btn-renombrar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">🏷️ Renombrar</button>
            <button type="button" class="btn-m3-outlined btn-exportar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">📤 Exportar</button>
            <button type="button" class="btn-peligro btn-eliminar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">🗑️ Borrar</button>
          ` : `
            <button type="button" class="btn-m3-outlined btn-exportar-sim" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${mod.id}">📤 Exportar</button>
          `}
        </div>
      `;

      card.querySelector(".btn-cargar-sim")?.addEventListener("click", () => onAccion("cargar", mod.id));
      card.querySelector(".btn-copiar-sim")?.addEventListener("click", () => onAccion("copiar", mod.id));
      card.querySelector(".btn-editar-sim")?.addEventListener("click", () => onAccion("editar", mod.id));
      card.querySelector(".btn-renombrar-sim")?.addEventListener("click", () => onAccion("renombrar", mod.id));
      card.querySelector(".btn-exportar-sim")?.addEventListener("click", () => onAccion("exportar", mod.id));
      card.querySelector(".btn-eliminar-sim")?.addEventListener("click", () => onAccion("eliminar", mod.id));

      contenedor.appendChild(card);
    });

    // 2. Presets de Escenario Guardados
    (presets || []).forEach(pre => {
      const textoBuscar = `${pre.nombre} preset escenario`.toLowerCase();
      if (filtroNorm && !textoBuscar.includes(filtroNorm)) return;

      const card = document.createElement("div");
      card.className = "tarjeta-simulacion-biblioteca";

      card.innerHTML = `
        <div>
          <h4>
            <span>⭐ ${pre.nombre}</span>
            <span class="badge-tipo-sim badge-preset">Preset Escenario</span>
          </h4>
          <p style="font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant); margin-top: 0.35rem;">
            Modelo base: <strong>${pre.modeloId}</strong> | Creado: ${new Date(pre.fechaCreacion || Date.now()).toLocaleDateString()}
          </p>
        </div>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem;">
          <button type="button" class="btn-m3-filled btn-cargar-preset" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${pre.id}">⭐ Cargar Preset</button>
          <button type="button" class="btn-m3-outlined btn-exportar-preset" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${pre.id}">📤 Exportar</button>
          <button type="button" class="btn-peligro btn-eliminar-preset" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" data-id="${pre.id}">🗑️ Borrar</button>
        </div>
      `;

      card.querySelector(".btn-cargar-preset")?.addEventListener("click", () => onAccion("cargarPreset", pre.id));
      card.querySelector(".btn-exportar-preset")?.addEventListener("click", () => onAccion("exportarPreset", pre.id));
      card.querySelector(".btn-eliminar-preset")?.addEventListener("click", () => onAccion("eliminarPreset", pre.id));

      contenedor.appendChild(card);
    });

    if (contenedor.children.length === 0) {
      contenedor.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--md-sys-color-on-surface-variant); grid-column: 1 / -1;">No se encontraron simulaciones que coincidan con la búsqueda.</div>`;
    }
  };

  renderizarItems(inputBuscar ? inputBuscar.value : "");

  if (inputBuscar) {
    inputBuscar.oninput = (e) => renderizarItems(e.target.value);
  }

  modal.style.display = "flex";
}

// Cierra la biblioteca modal de simulaciones.
export function cerrarModalBiblioteca(elementosBiblioteca) {
  if (elementosBiblioteca.modal) {
    elementosBiblioteca.modal.style.display = "none";
  }
}

// Inserta una nueva fila de configuración de variable en la tabla del constructor low-code.
export function agregarFilaVariableConstructor(tbody, datosFila = {}) {
  const tr = document.createElement("tr");

  // Nombre de la variable
  const tdNombre = document.createElement("td");
  const inpNombre = document.createElement("input");
  inpNombre.type = "text";
  inpNombre.className = "var-nombre";
  inpNombre.placeholder = "ej: ancho";
  inpNombre.value = datosFila.nombre || "";
  tdNombre.appendChild(inpNombre);

  // Tipo de variable (continuo / entero)
  const tdTipo = document.createElement("td");
  const selTipo = document.createElement("select");
  selTipo.className = "var-tipo";
  const optCont = document.createElement("option");
  optCont.value = "continuo";
  optCont.textContent = "Continuo";
  const optEnt = document.createElement("option");
  optEnt.value = "entero";
  optEnt.textContent = "Entero";
  if (datosFila.tipo === "entero") optEnt.selected = true;
  else optCont.selected = true;
  selTipo.appendChild(optCont);
  selTipo.appendChild(optEnt);
  tdTipo.appendChild(selTipo);

  // Límite Mínimo
  const tdMin = document.createElement("td");
  const inpMin = document.createElement("input");
  inpMin.type = "number";
  inpMin.className = "var-min";
  inpMin.step = "any";
  inpMin.value = datosFila.min !== undefined ? datosFila.min : 0;
  tdMin.appendChild(inpMin);

  // Límite Máximo
  const tdMax = document.createElement("td");
  const inpMax = document.createElement("input");
  inpMax.type = "number";
  inpMax.className = "var-max";
  inpMax.step = "any";
  inpMax.value = datosFila.max !== undefined ? datosFila.max : 100;
  tdMax.appendChild(inpMax);

  // Botón Quitar
  const tdAccion = document.createElement("td");
  const btnBorrar = document.createElement("button");
  btnBorrar.type = "button";
  btnBorrar.className = "btn-fila-borrar";
  btnBorrar.textContent = "✕ Quitar";
  btnBorrar.title = "Eliminar variable";
  btnBorrar.addEventListener("click", () => tr.remove());
  tdAccion.appendChild(btnBorrar);

  tr.appendChild(tdNombre);
  tr.appendChild(tdTipo);
  tr.appendChild(tdMin);
  tr.appendChild(tdMax);
  tr.appendChild(tdAccion);

  tbody.appendChild(tr);
}

// Extrae del formulario del modal los datos ingresados por el usuario para conformar la definición cruda del modelo.
export function extraerDefinicionModeloDesdeUI(elementosModal) {
  const { inputNombre, inputDesc, tbody, textareaCodigo, selectTipoVisualizacion } = elementosModal;

  const nombre = inputNombre.value.trim();
  const descripcion = inputDesc.value.trim();
  const codigoEvaluacion = textareaCodigo.value.trim();
  const tipoVisualizacion = selectTipoVisualizacion ? selectTipoVisualizacion.value : "calibracion";

  const variables = [];
  const filas = tbody.querySelectorAll("tr");
  filas.forEach(tr => {
    const inpNom = tr.querySelector(".var-nombre");
    const selTipo = tr.querySelector(".var-tipo");
    const inpMin = tr.querySelector(".var-min");
    const inpMax = tr.querySelector(".var-max");

    variables.push({
      nombre: inpNom ? inpNom.value.trim() : "",
      tipo: selTipo ? selTipo.value : "continuo",
      min: inpMin ? parseFloat(inpMin.value) : 0,
      max: inpMax ? parseFloat(inpMax.value) : 100
    });
  });

  return {
    nombre,
    descripcion,
    tipoVisualizacion,
    variables,
    codigoEvaluacion
  };
}
