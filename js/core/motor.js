// =========================================================================
// MÓDULO: MOTOR GENÉTICO GENÉRICO (CLASE MOTOR)
// =========================================================================

import { crearPrngMulberry32 } from "./rng.js";

// Función auxiliar para programar la siguiente tanda de generaciones compatible con el hilo principal y Web Workers.
const programarFrame = typeof requestAnimationFrame === "function"
  ? requestAnimationFrame
  : (cb) => setTimeout(cb, 0);

// Función auxiliar para cancelar la tanda programada compatible con el hilo principal y Web Workers.
const cancelarFrame = typeof cancelAnimationFrame === "function"
  ? cancelAnimationFrame
  : (id) => clearTimeout(id);

// Clase del motor evolutivo genérico que opera de manera agnóstica al modelo mediante un contrato unificado.
export class Motor {
  // Constructor que inicializa los parámetros del motor con sus valores por defecto.
  constructor(opciones = {}) {
    // Tamaño de la población (por defecto 60).
    this.tamanoPoblacion = opciones.tamanoPoblacion || 60;
    // Cantidad de generaciones a simular (por defecto 200).
    this.generaciones = opciones.generaciones || 200;
    // Probabilidad de mutación por cada gen (por defecto 0.05).
    this.tasaMutacion = opciones.tasaMutacion !== undefined ? opciones.tasaMutacion : 0.05;
    // Cantidad de mejores individuos que pasan intactos a la siguiente generación (por defecto 2).
    this.elitismo = opciones.elitismo !== undefined ? opciones.elitismo : 2;
    // Cantidad de candidatos participantes en cada torneo de selección (por defecto 3).
    this.tamanoTorneo = opciones.tamanoTorneo || 3;
    // Semilla numérica para inicializar el generador determinista.
    this.semilla = opciones.semilla !== undefined ? opciones.semilla : 123456;
    // Cantidad de generaciones calculadas por tanda para evitar congelar el hilo de ejecución.
    this.tandaGeneraciones = opciones.tandaGeneraciones || 5;
    // Cantidad de réplicas de evaluación si el modelo declara tener ruido estocástico.
    this.nReplicasRuido = opciones.nReplicasRuido || 5;

    // Instancia del generador pseudoaleatorio determinista mulberry32.
    this.random = crearPrngMulberry32(this.semilla);

    // Estado interno de la simulación: 'DETENIDO', 'CORRIENDO', 'PAUSADO'.
    this.estado = "DETENIDO";
    // Generación actual en progreso.
    this.generacionActual = 0;
    // Arreglo con la población actual de individuos { genoma, fitness }.
    this.poblacion = [];
    // Historial de los mejores fitness por generación para graficar.
    this.historiaMejor = [];
    // Historial de los fitness promedio por generación para graficar.
    this.historiaPromedio = [];
    // Primer mejor genoma inicial antes de evolucionar para comparar antes/después.
    this.genomaInicialAzar = null;
    // Mejor fitness inicial obtenido al azar en la generación 0.
    this.fitnessInicialAzar = null;

    // Identificador de temporizador para la tanda asíncrona.
    this.idAnimacion = null;
    // Función de retorno (callback) invocada al completar cada tanda con el progreso.
    this.onProgreso = null;
    // Modelo actual que provee la definición de genoma y función de fitness.
    this.modelo = null;
    // Datos de entrada ingresados por el usuario para alimentar al modelo.
    this.datosEntrada = null;
    // Definición de genes generada por el modelo para el problema actual.
    this.definicionGenes = [];
  }

  // Método principal correr(): ejecuta la optimización genética por tandas asíncronas no bloqueantes.
  correr(modelo, datosEntrada, onProgreso) {
    // Asignación de dependencias del modelo y callback.
    this.modelo = modelo;
    this.datosEntrada = datosEntrada;
    this.onProgreso = onProgreso;

    // Reinicio del generador pseudoaleatorio determinista con la semilla establecida.
    this.random = crearPrngMulberry32(this.semilla);
    // Obtención de la definición de genes según los datos de entrada del modelo.
    this.definicionGenes = this.modelo.crearGenoma(this.datosEntrada);

    // Limpieza de métricas previas y estado inicial.
    this.generacionActual = 0;
    this.historiaMejor = [];
    this.historiaPromedio = [];
    this.estado = "CORRIENDO";

    // Creación y evaluación de la población inicial de generación cero.
    this.poblacion = [];
    for (let i = 0; i < this.tamanoPoblacion; i++) {
      const genoma = this.crearGenomaAleatorio();
      const fitness = this.evaluarIndividuo(genoma);
      this.poblacion.push({ genoma, fitness });
    }

    // Ordenamiento ascendente: menor fitness significa mejor desempeño.
    this.poblacion.sort((a, b) => a.fitness - b.fitness);

    // Guardado de la asignación inicial al azar para contrastar la mejora.
    this.genomaInicialAzar = JSON.parse(JSON.stringify(this.poblacion[0].genoma));
    this.fitnessInicialAzar = this.poblacion[0].fitness;

    // Registro de métricas de la generación 0.
    this.registrarEstadisticas();

    // Lanzamiento del lazo de ejecución no bloqueante.
    this.programarSiguienteTanda();
  }

  // Crea un genoma aleatorio respetando el tipo (continuo, entero, categorico) de cada gen.
  crearGenomaAleatorio() {
    const genoma = [];
    for (let i = 0; i < this.definicionGenes.length; i++) {
      const def = this.definicionGenes[i];
      let valor = 0;
      if (def.tipo === "continuo") {
        // Valor de punto flotante uniforme en el intervalo [min, max].
        valor = def.min + this.random() * (def.max - def.min);
      } else if (def.tipo === "entero" || def.tipo === "categorico") {
        // Valor entero discreto en el rango [min, max].
        const rango = def.max - def.min + 1;
        valor = def.min + Math.floor(this.random() * rango);
      }
      genoma.push(valor);
    }
    return genoma;
  }

  // Evalúa un genoma considerando si el modelo tiene ruido estocástico o es determinista.
  evaluarIndividuo(genoma) {
    if (this.modelo.usaRuido) {
      // Si el modelo declara ruido, se evalúan N réplicas y se calcula el promedio.
      let suma = 0;
      for (let r = 0; r < this.nReplicasRuido; r++) {
        suma += this.modelo.evaluar(genoma, this.datosEntrada);
      }
      return suma / this.nReplicasRuido;
    }
    // Evaluación directa de la función de aptitud del modelo.
    return this.modelo.evaluar(genoma, this.datosEntrada);
  }

  // Registra las estadísticas de la generación actual en los historiales y notifica al observador.
  registrarEstadisticas() {
    const mejorFitness = this.poblacion[0].fitness;
    let suma = 0;
    for (let i = 0; i < this.poblacion.length; i++) {
      suma += this.poblacion[i].fitness;
    }
    const promedioFitness = suma / this.poblacion.length;

    this.historiaMejor.push(mejorFitness);
    this.historiaPromedio.push(promedioFitness);

    if (this.onProgreso) {
      this.onProgreso({
        generacion: this.generacionActual,
        totalGeneraciones: this.generaciones,
        mejorFitness: mejorFitness,
        promedioFitness: promedioFitness,
        mejorGenoma: this.poblacion[0].genoma,
        genomaInicialAzar: this.genomaInicialAzar,
        fitnessInicialAzar: this.fitnessInicialAzar,
        historiaMejor: this.historiaMejor,
        historiaPromedio: this.historiaPromedio,
        completado: this.generacionActual >= this.generaciones
      });
    }
  }

  // Ejecuta una tanda de generaciones en lotes para mantener la fluidez de la interfaz o el worker.
  ejecutarTanda() {
    if (this.estado !== "CORRIENDO") return;

    const finTanda = Math.min(this.generacionActual + this.tandaGeneraciones, this.generaciones);

    while (this.generacionActual < finTanda) {
      this.avanzarUnaGeneracion();
      this.generacionActual++;
      this.registrarEstadisticas();
    }

    if (this.generacionActual >= this.generaciones) {
      this.estado = "DETENIDO";
    } else {
      this.programarSiguienteTanda();
    }
  }

  // Programa la ejecución del siguiente lote de manera asíncrona.
  programarSiguienteTanda() {
    if (this.estado === "CORRIENDO") {
      this.idAnimacion = programarFrame(() => this.ejecutarTanda());
    }
  }

  // Realiza el paso evolutivo completo: elitismo, selección por torneo, cruce y mutación.
  avanzarUnaGeneracion() {
    const nuevaPoblacion = [];

    // 1. Elitismo: los N mejores individuos pasan intactos a la siguiente generación.
    const cantidadElitismo = Math.min(this.elitismo, this.tamanoPoblacion);
    for (let e = 0; e < cantidadElitismo; e++) {
      nuevaPoblacion.push({
        genoma: [...this.poblacion[e].genoma],
        fitness: this.poblacion[e].fitness
      });
    }

    // 2. Generación de descendencia mediante torneo, cruce uniforme y mutación.
    while (nuevaPoblacion.length < this.tamanoPoblacion) {
      const padre1 = this.seleccionPorTorneo();
      const padre2 = this.seleccionPorTorneo();

      // Cruce uniforme entre ambos padres.
      let genomaHijo = this.cruceUniforme(padre1.genoma, padre2.genoma);

      // Mutación según el tipo de gen.
      genomaHijo = this.mutarGenoma(genomaHijo);

      // Evaluación de la aptitud del descendiente.
      const fitnessHijo = this.evaluarIndividuo(genomaHijo);
      nuevaPoblacion.push({ genoma: genomaHijo, fitness: fitnessHijo });
    }

    // Ordenamiento por menor fitness.
    nuevaPoblacion.sort((a, b) => a.fitness - b.fitness);
    this.poblacion = nuevaPoblacion;
  }

  // Selecciona un individuo eligiendo el mejor entre varios candidatos al azar (torneo).
  seleccionPorTorneo() {
    let mejorCandidato = null;
    for (let t = 0; t < this.tamanoTorneo; t++) {
      const indice = Math.floor(this.random() * this.poblacion.length);
      const candidato = this.poblacion[indice];
      if (!mejorCandidato || candidato.fitness < mejorCandidato.fitness) {
        mejorCandidato = candidato;
      }
    }
    return mejorCandidato;
  }

  // Combina dos genomas parentales asignando cada gen de un padre u otro con probabilidad del 50%.
  cruceUniforme(genomaA, genomaB) {
    const hijo = [];
    for (let i = 0; i < genomaA.length; i++) {
      hijo.push(this.random() < 0.5 ? genomaA[i] : genomaB[i]);
    }
    return hijo;
  }

  // Aplica mutaciones genéticas a los genes del individuo según la tasa y tipo de cada gen.
  mutarGenoma(genoma) {
    const mutado = [...genoma];
    for (let i = 0; i < mutado.length; i++) {
      if (this.random() < this.tasaMutacion) {
        const def = this.definicionGenes[i];
        if (def.tipo === "continuo") {
          // Variación delta acotada al rango continuo permitido.
          const delta = (this.random() - 0.5) * 0.25 * (def.max - def.min);
          mutado[i] = Math.min(def.max, Math.max(def.min, mutado[i] + delta));
        } else if (def.tipo === "entero") {
          // Asignación de un entero aleatorio válido dentro del rango.
          const rango = def.max - def.min + 1;
          mutado[i] = def.min + Math.floor(this.random() * rango);
        } else if (def.tipo === "categorico") {
          // Cambio garantizado a una categoría diferente entre las opciones posibles.
          const totalOpciones = def.max - def.min + 1;
          if (totalOpciones > 1) {
            const salto = 1 + Math.floor(this.random() * (totalOpciones - 1));
            mutado[i] = def.min + ((mutado[i] - def.min + salto) % totalOpciones);
          }
        }
      }
    }
    return mutado;
  }

  // Pausa temporalmente el ciclo evolutivo.
  pausar() {
    if (this.estado === "CORRIENDO") {
      this.estado = "PAUSADO";
      if (this.idAnimacion) {
        cancelarFrame(this.idAnimacion);
        this.idAnimacion = null;
      }
    }
  }

  // Reanuda la ejecución evolutiva si se encontraba en pausa.
  reanudar() {
    if (this.estado === "PAUSADO") {
      this.estado = "CORRIENDO";
      this.programarSiguienteTanda();
    }
  }

  // Detiene por completo la ejecución del motor genético.
  detener() {
    this.estado = "DETENIDO";
    if (this.idAnimacion) {
      cancelarFrame(this.idAnimacion);
      this.idAnimacion = null;
    }
  }
}
