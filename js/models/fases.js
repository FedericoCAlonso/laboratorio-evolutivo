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
  crearGenoma(entrada = {}) {
    const listaCircuitos = entrada?.circuitos || [500, 450, 400, 350, 300, 250, 200, 150];
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
