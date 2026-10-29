// =========================================================================
// MÓDULO: MODELO 1 - BALANCEO DE FASES TRIFÁSICO (R, S, T)
// =========================================================================

// Objeto que implementa el contrato del Modelo 1: Balanceo de cargas en sistemas eléctricos trifásicos.
export const ModeloBalanceoFases = {
  // Identificador único del modelo en el registro.
  id: "balanceo-fases-trifasico",
  // Nombre legible para mostrar en el selector de la aplicación.
  nombre: "Balanceo de Fases Trifásico (R, S, T)",
  // Descripción técnica del problema de optimización combinatoria.
  descripcion: "Distribuye cargas monofásicas entre las fases R, S y T para minimizar el desbalance de corriente y respetar fases obligatorias.",
  // No utiliza aceleración WebAssembly compilada por ser un problema combinatorio puramente discreto.
  usaWasm: false,
  // Indica que la función de aptitud es determinista sin ruido estocástico.
  usaRuido: false,

  // Definición de parámetros de entrada editables por el usuario.
  parametrosEntrada: [
    {
      clave: "circuitos",
      etiqueta: "Lista de Circuitos a Balancear",
      tipo: "tabla",
      columnas: [
        { clave: "nombre", etiqueta: "Nombre del Circuito", tipo: "texto" },
        { clave: "corriente", etiqueta: "Corriente (A)", tipo: "numero", min: 0.1, paso: 0.5 },
        { clave: "faseFija", etiqueta: "Fase Obligatoria", tipo: "selector", opciones: ["", "R", "S", "T"] }
      ],
      valorDefecto: [
        { nombre: "Iluminación PB", corriente: 6.0, faseFija: "" },
        { nombre: "Iluminación PA", corriente: 5.5, faseFija: "" },
        { nombre: "Tomas Uso General PB", corriente: 12.0, faseFija: "" },
        { nombre: "Tomas Uso Especial Cocina", corriente: 16.0, faseFija: "" },
        { nombre: "Horno Eléctrico", corriente: 22.0, faseFija: "" },
        { nombre: "Aire Acondicionado Living", corriente: 18.0, faseFija: "" },
        { nombre: "Aire Dormitorio Principal", corriente: 9.5, faseFija: "" },
        { nombre: "Aire Dormitorio Secundario", corriente: 9.5, faseFija: "" },
        { nombre: "Lavarropas y Secarropas", corriente: 14.0, faseFija: "" },
        { nombre: "Bomba de Agua y Riego", corriente: 8.5, faseFija: "" },
        { nombre: "Termotanque Eléctrico", corriente: 15.0, faseFija: "" },
        { nombre: "Heladera y Servidor", corriente: 7.0, faseFija: "R" }
      ]
    },
    {
      clave: "penalizacionViolacion",
      etiqueta: "Penalización por violar fase obligatoria",
      tipo: "numero",
      min: 10,
      max: 10000,
      paso: 50,
      valorDefecto: 500
    }
  ],

  // Crea el genoma definiendo un gen categórico (0=R, 1=S, 2=T) por cada circuito recibido.
  crearGenoma(entrada) {
    const listaCircuitos = entrada.circuitos || [];
    // Mapea cada circuito a un gen con valores discretos entre 0 y 2.
    return listaCircuitos.map(() => ({
      tipo: "categorico",
      min: 0,
      max: 2
    }));
  },

  // Evalúa el genoma calculando el desbalance (máx - mín) de corriente más penalizaciones.
  evaluar(genoma, entrada) {
    const circuitos = entrada.circuitos || [];
    const penalizacionBase = Number(entrada.penalizacionViolacion) || 500;
    let sumasFases = [0, 0, 0]; // 0: R, 1: S, 2: T
    let penalizacionTotal = 0;
    const nombreFases = ["R", "S", "T"];

    for (let i = 0; i < circuitos.length; i++) {
      const faseAsignada = genoma[i]; // 0, 1 o 2
      const corriente = Number(circuitos[i].corriente) || 0;
      sumasFases[faseAsignada] += corriente;

      // Si el circuito tenía una fase fija exigida y el genoma la viola, se penaliza fuertemente.
      const obligatoria = circuitos[i].faseFija;
      if (obligatoria && obligatoria !== "" && nombreFases[faseAsignada] !== obligatoria) {
        penalizacionTotal += penalizacionBase;
      }
    }

    const maxCorriente = Math.max(sumasFases[0], sumasFases[1], sumasFases[2]);
    const minCorriente = Math.min(sumasFases[0], sumasFases[1], sumasFases[2]);
    const desbalance = maxCorriente - minCorriente;

    // El fitness a minimizar es la diferencia más cualquier penalización incurrida.
    return desbalance + penalizacionTotal;
  },

  // Dibuja en el contenedor DOM las 3 barras apiladas (R, S, T), métricas y comparación.
  dibujar(genoma, entrada, contenedor, contexto = {}) {
    const circuitos = entrada.circuitos || [];
    const fases = [
      { nombre: "R", corrienteTotal: 0, circuitos: [], claseColor: "color-r", claseColumna: "fase-r" },
      { nombre: "S", corrienteTotal: 0, circuitos: [], claseColor: "color-s", claseColumna: "fase-s" },
      { nombre: "T", corrienteTotal: 0, circuitos: [], claseColor: "color-t", claseColumna: "fase-t" }
    ];

    let violacionesFaseFija = 0;

    for (let i = 0; i < circuitos.length; i++) {
      const faseIdx = genoma[i];
      const c = circuitos[i];
      const valorA = Number(c.corriente) || 0;
      const obligatoria = c.faseFija;
      const esViolacion = obligatoria && obligatoria !== "" && fases[faseIdx].nombre !== obligatoria;

      if (esViolacion) {
        violacionesFaseFija++;
      }

      fases[faseIdx].corrienteTotal += valorA;
      fases[faseIdx].circuitos.push({
        nombre: c.nombre,
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

    // Escala máxima para asegurar altura visual adecuada en las barras apiladas.
    const alturaReferencia = Math.max(maxC * 1.15, 1);

    // Desbalance de la solución inicial asignada al azar para comparar antes y después.
    const desbalanceInicial = contexto && contexto.fitnessInicialAzar !== undefined ? contexto.fitnessInicialAzar : null;
    let mejoraTexto = "";
    if (desbalanceInicial !== null) {
      const dif = desbalanceInicial - desbalanceAmperes;
      const pctReduccion = desbalanceInicial > 0 ? (dif / desbalanceInicial) * 100 : 0;
      mejoraTexto = `(-${pctReduccion.toFixed(1)}% mejora)`;
    }

    // Construcción del HTML visual de barras y tarjetas de estadísticas.
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

    // Genera cada una de las 3 columnas apiladas (R, S, T).
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

      // Genera los bloques apilados por circuito dentro de la fase.
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
  },

  // Devuelve una descripción en texto plano y legible del resultado del balanceo.
  describir(genoma, entrada) {
    const circuitos = entrada.circuitos || [];
    const fases = ["R", "S", "T"];
    const sumas = [0, 0, 0];
    const asignaciones = { R: [], S: [], T: [] };

    for (let i = 0; i < circuitos.length; i++) {
      const faseNombre = fases[genoma[i]];
      const c = circuitos[i];
      const corr = Number(c.corriente) || 0;
      sumas[genoma[i]] += corr;
      asignaciones[faseNombre].push({
        nombre: c.nombre,
        corriente: corr,
        faseFija: c.faseFija
      });
    }

    const maxC = Math.max(...sumas);
    const minC = Math.min(...sumas);
    const desbalance = maxC - minC;
    const total = sumas[0] + sumas[1] + sumas[2];
    const promedio = total / 3;
    const pctDesbalance = promedio > 0 ? (desbalance / promedio) * 100 : 0;

    let reporte = `REPORTE DE BALANCEO DE FASES (ALGORITMO GENÉTICO)\n`;
    reporte += `========================================================\n\n`;

    for (let f = 0; f < fases.length; f++) {
      const fNom = fases[f];
      reporte += `FASE ${fNom} -> Total: ${sumas[f].toFixed(2)} A (${asignaciones[fNom].length} circuitos)\n`;
      asignaciones[fNom].forEach(item => {
        const notaFija = item.faseFija ? ` [Fija: ${item.faseFija}]` : "";
        reporte += `   • ${item.nombre.padEnd(28, " ")}: ${item.corriente.toFixed(1).padStart(5, " ")} A${notaFija}\n`;
      });
      reporte += `\n`;
    }

    reporte += `--------------------------------------------------------\n`;
    reporte += `Corriente Total Instalada : ${total.toFixed(2)} A\n`;
    reporte += `Carga Promedio Objetivo   : ${promedio.toFixed(2)} A por fase\n`;
    reporte += `Desbalance Final (Máx-Mín): ${desbalance.toFixed(2)} A (${pctDesbalance.toFixed(2)}%)\n`;
    reporte += `========================================================\n`;

    return reporte;
  }
};

export default ModeloBalanceoFases;
