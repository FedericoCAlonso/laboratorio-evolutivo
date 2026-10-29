// =========================================================================
// MÓDULO: CONSTRUCTOR DE MODELOS DINÁMICOS LOW-CODE (COMPILACIÓN Y VISUALIZADOR)
// =========================================================================

// Compila de forma segura la función de evaluación ingresada por el usuario utilizando new Function envuelto en try/catch.
export function compilarFuncionEvaluacion(codigoFuente) {
  try {
    // new Function crea una función pura que recibe el diccionario de variables (vars) y el generador aleatorio (rng).
    const fn = new Function("vars", "rng", codigoFuente);
    return { ok: true, fn };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Convierte un nombre textual arbitrario en un identificador único seguro (slug en minúsculas).
export function generarIdModelo(nombre) {
  const base = nombre
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `dinamico-${base || "modelo"}`;
}

// Valida la integridad estructural de la definición cruda de un modelo antes de su compilación y guardado.
export function validarDefinicionModelo(definicion) {
  if (!definicion || typeof definicion !== "object") {
    throw new Error("La definición del modelo es inválida.");
  }
  if (!definicion.nombre || typeof definicion.nombre !== "string" || !definicion.nombre.trim()) {
    throw new Error("El nombre del modelo no puede estar vacío.");
  }
  if (!Array.isArray(definicion.variables) || definicion.variables.length === 0) {
    throw new Error("Debe definir al menos una variable de decisión.");
  }

  const nombresVistos = new Set();
  const regexIdValido = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  for (let i = 0; i < definicion.variables.length; i++) {
    const v = definicion.variables[i];
    const nombre = (v.nombre || "").trim();

    if (!nombre) {
      throw new Error(`Variable ${i + 1}: El nombre de la variable no puede estar vacío.`);
    }
    if (!regexIdValido.test(nombre)) {
      throw new Error(`Variable '${nombre}': Debe ser un identificador válido de JavaScript (sin espacios ni caracteres especiales).`);
    }
    if (nombresVistos.has(nombre)) {
      throw new Error(`La variable '${nombre}' está duplicada.`);
    }
    nombresVistos.add(nombre);

    const min = Number(v.min);
    const max = Number(v.max);
    if (isNaN(min) || isNaN(max)) {
      throw new Error(`Variable '${nombre}': Los límites mínimo y máximo deben ser números válidos.`);
    }
    if (min >= max) {
      throw new Error(`Variable '${nombre}': El valor mínimo (${min}) debe ser estrictamente menor que el máximo (${max}).`);
    }
    if (v.tipo !== "continuo" && v.tipo !== "entero") {
      throw new Error(`Variable '${nombre}': El tipo debe ser 'continuo' o 'entero'.`);
    }
  }

  if (!definicion.codigoEvaluacion || typeof definicion.codigoEvaluacion !== "string" || !definicion.codigoEvaluacion.trim()) {
    throw new Error("Debe ingresar el código JavaScript de la función de evaluación.");
  }

  // Prueba de compilación sintáctica en bloque try/catch obligatorio.
  const compilacion = compilarFuncionEvaluacion(definicion.codigoEvaluacion);
  if (!compilacion.ok) {
    throw new Error(`Error de sintaxis en el código de evaluación: ${compilacion.error}`);
  }

  // Prueba de ejecución con valores de prueba (punto medio de cada variable).
  const varsPrueba = {};
  definicion.variables.forEach(v => {
    varsPrueba[v.nombre.trim()] = (Number(v.min) + Number(v.max)) / 2;
  });

  try {
    const resPrueba = compilacion.fn(varsPrueba, Math.random);
    if (typeof resPrueba !== "number" || isNaN(resPrueba)) {
      throw new Error("La función de evaluación debe retornar un número válido.");
    }
  } catch (error) {
    throw new Error(`Error al ejecutar el código de prueba con valores iniciales: ${error.message}`);
  }

  return true;
}

// Compila una definición cruda y retorna un objeto de modelo completo cumpliendo el contrato del optimizador.
export function compilarModeloDinamico(definicionCruda) {
  validarDefinicionModelo(definicionCruda);

  const { fn: funcionEvaluacion } = compilarFuncionEvaluacion(definicionCruda.codigoEvaluacion);
  const varsDef = definicionCruda.variables.map(v => ({
    nombre: v.nombre.trim(),
    tipo: v.tipo === "entero" ? "entero" : "continuo",
    min: Number(v.min),
    max: Number(v.max)
  }));

  const modeloId = definicionCruda.id || generarIdModelo(definicionCruda.nombre);

  return {
    id: modeloId,
    nombre: definicionCruda.nombre.trim(),
    descripcion: (definicionCruda.descripcion || "Modelo matemático personalizado creado dinámicamente.").trim(),
    esDinamico: true,
    usaWasm: false,
    usaRuido: false,
    parametrosEntrada: [],
    definicionCruda: {
      ...definicionCruda,
      id: modeloId,
      variables: varsDef
    },

    // Genera la especificación de los genes a optimizar a partir de las variables definidas.
    crearGenoma() {
      return varsDef.map(v => ({
        tipo: v.tipo,
        min: v.min,
        max: v.max
      }));
    },

    // Evalúa el genoma mapeándolo al diccionario vars y ejecutando la función compilada de forma pura y segura.
    evaluar(genoma, entrada, rng) {
      const vars = {};
      for (let i = 0; i < varsDef.length; i++) {
        vars[varsDef[i].nombre] = genoma[i];
      }

      try {
        const puntaje = funcionEvaluacion(vars, rng || Math.random);
        if (typeof puntaje !== "number" || isNaN(puntaje)) {
          return 999999;
        }
        return puntaje;
      } catch (error) {
        return 999999;
      }
    },

    // Dibuja en el DOM una representación visual por defecto con barras horizontales para cada variable y tarjetas de estado.
    dibujar(genoma, entrada, contenedor) {
      if (!contenedor) return;

      const vars = {};
      for (let i = 0; i < varsDef.length; i++) {
        vars[varsDef[i].nombre] = genoma[i];
      }

      let fitnessActual = 0;
      try {
        fitnessActual = funcionEvaluacion(vars, Math.random);
      } catch (e) {
        fitnessActual = 999999;
      }

      let htmlBarras = "";
      varsDef.forEach((v, idx) => {
        const val = genoma[idx];
        const pct = Math.max(0, Math.min(100, ((val - v.min) / (v.max - v.min || 1)) * 100));
        const valFormateado = v.tipo === "entero" ? Math.round(val) : val.toFixed(3);

        htmlBarras += `
          <div style="margin-bottom: 0.9rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
              <span style="font-weight: 600;">${v.nombre} <span style="font-weight: 400; color: var(--texto-secundario);">(${v.tipo})</span></span>
              <span style="font-family: monospace; font-weight: 600; color: var(--primario);">${valFormateado}</span>
            </div>
            <div style="position: relative; height: 18px; background: var(--bg-input); border-radius: 9px; overflow: hidden; border: 1px solid var(--borde);">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--primario), var(--exito)); border-radius: 9px; transition: width 0.15s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--texto-secundario); margin-top: 2px;">
              <span>Mín: ${v.min}</span>
              <span>${pct.toFixed(1)}% del rango</span>
              <span>Máx: ${v.max}</span>
            </div>
          </div>
        `;
      });

      contenedor.innerHTML = `
        <div class="comparativa-azar" style="margin-bottom: 1rem;">
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Fitness Obtenido</div>
            <div class="stat-valor" style="color: var(--exito);">${fitnessActual.toFixed(4)}</div>
            <div class="stat-sub">Función de evaluación matemática</div>
          </div>
          <div class="tarjeta-stat">
            <div class="stat-etiqueta">Variables Optimizadas</div>
            <div class="stat-valor" style="color: var(--primario);">${varsDef.length}</div>
            <div class="stat-sub">Genes continuos / enteros</div>
          </div>
        </div>
        <div style="padding: 1.25rem; background: var(--bg-tarjeta); border: 1px solid var(--borde); border-radius: var(--radio-sm);">
          <h4 style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--texto-principal);">Distribución y Magnitud de Variables en su Rango</h4>
          ${htmlBarras}
        </div>
      `;
    },

    // Genera un informe textual detallado con las variables encontradas, sus rangos y el fitness resultante.
    describir(genoma) {
      const vars = {};
      for (let i = 0; i < varsDef.length; i++) {
        vars[varsDef[i].nombre] = genoma[i];
      }

      let fitness = 0;
      try {
        fitness = funcionEvaluacion(vars, Math.random);
      } catch (e) {
        fitness = 999999;
      }

      let texto = `MODELO DINÁMICO: ${definicionCruda.nombre.toUpperCase()}\n`;
      texto += `========================================================================\n`;
      texto += `Descripción: ${definicionCruda.descripcion || "Sin descripción"}\n`;
      texto += `Identificador: ${modeloId}\n\n`;
      texto += `VARIABLES DE DECISIÓN OPTIMIZADAS:\n`;
      texto += `  Variable        | Tipo      | Rango [Mín, Máx]       | Valor Encontrado\n`;
      texto += `  ----------------+-----------+------------------------+-------------------\n`;

      varsDef.forEach((v, idx) => {
        const val = genoma[idx];
        const valStr = v.tipo === "entero" ? Math.round(val).toString() : val.toFixed(4);
        const rangoStr = `[${v.min}, ${v.max}]`;
        texto += `  ${v.nombre.padEnd(15, " ")} | ${v.tipo.padEnd(9, " ")} | ${rangoStr.padEnd(22, " ")} | ${valStr}\n`;
      });

      texto += `\nFITNESS FINAL: ${fitness.toFixed(6)} (Menor = Mejor)\n`;
      texto += `========================================================================\n`;

      return texto;
    }
  };
}
