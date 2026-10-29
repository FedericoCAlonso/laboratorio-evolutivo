// =========================================================================
// MÓDULO: MOTOR GENÉTICO GENÉRICO (MONO-OBJETIVO Y MULTIOBJETIVO NSGA-II)
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

// Clase del motor evolutivo genérico que soporta optimización monobjetivo y multiobjetivo por frentes de Pareto.
export class Motor {
  // Constructor que inicializa los parámetros del motor con sus valores por defecto.
  constructor(opciones = {}) {
    // Tamaño de la población (por defecto 60).
    this.tamanoPoblacion = opciones.tamanoPoblacion || 60;
    // Cantidad de generaciones a simular (por defecto 200).
    this.generaciones = opciones.generaciones || 200;
    // Probabilidad de mutación por cada gen (por defecto 0.05).
    this.tasaMutacion = opciones.tasaMutacion !== undefined ? opciones.tasaMutacion : 0.05;
    // Cantidad de mejores individuos que pasan intactos a la siguiente generación en monobjetivo (por defecto 2).
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
    // Arreglo con la población actual de individuos { genoma, fitness, rango, crowdingDistance }.
    this.poblacion = [];
    // Bandera booleana que detecta automáticamente si el modelo evalúa con un arreglo de objetivos (NSGA-II).
    this.esMultiobjetivo = false;
    // Conjunto de individuos no dominados pertenecientes al primer frente de Pareto (F0).
    this.frentePareto = [];
    // Historial de los mejores fitness por generación para graficar convergencia monobjetivo.
    this.historiaMejor = [];
    // Historial de los fitness promedio por generación para graficar convergencia monobjetivo.
    this.historiaPromedio = [];
    // Primer mejor genoma inicial antes de evolucionar para contrastar antes y después.
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

  // Determina si el fitness A domina al fitness B en sentido de Pareto (minimización estricta).
  domina(fitA, fitB) {
    if (typeof fitA === "number" && typeof fitB === "number") {
      return fitA < fitB;
    }
    const arrA = Array.isArray(fitA) ? fitA : [fitA];
    const arrB = Array.isArray(fitB) ? fitB : [fitB];
    let alMenosUnoMejor = false;
    for (let i = 0; i < arrA.length; i++) {
      if (arrA[i] > arrB[i]) return false;
      if (arrA[i] < arrB[i]) alMenosUnoMejor = true;
    }
    return alMenosUnoMejor;
  }

  // Clasifica una colección de individuos en frentes de dominancia de Pareto F0, F1, F2... (Fast Non-Dominated Sorting).
  clasificarFrentesPareto(individuos) {
    const N = individuos.length;
    const frentes = [[]];
    const Sp = Array.from({ length: N }, () => []);
    const np = new Int32Array(N);

    for (let p = 0; p < N; p++) {
      individuos[p]._idx = p;
      const fitP = individuos[p].fitness;
      for (let q = 0; q < N; q++) {
        if (p === q) continue;
        const fitQ = individuos[q].fitness;
        if (this.domina(fitP, fitQ)) {
          Sp[p].push(q);
        } else if (this.domina(fitQ, fitP)) {
          np[p]++;
        }
      }
      if (np[p] === 0) {
        individuos[p].rango = 0;
        frentes[0].push(individuos[p]);
      }
    }

    let i = 0;
    while (frentes[i] && frentes[i].length > 0) {
      const siguienteFrente = [];
      for (let k = 0; k < frentes[i].length; k++) {
        const indP = frentes[i][k];
        const p = indP._idx;
        const dominadosPorP = Sp[p];
        for (let j = 0; j < dominadosPorP.length; j++) {
          const q = dominadosPorP[j];
          np[q]--;
          if (np[q] === 0) {
            individuos[q].rango = i + 1;
            siguienteFrente.push(individuos[q]);
          }
        }
      }
      i++;
      if (siguienteFrente.length > 0) {
        frentes.push(siguienteFrente);
      }
    }

    return frentes;
  }

  // Calcula la distancia de apiñamiento (crowding distance) para mantener la diversidad dentro de un frente de Pareto.
  calcularDistanciaApiñamiento(frente) {
    const L = frente.length;
    if (L === 0) return;
    for (let i = 0; i < L; i++) {
      frente[i].crowdingDistance = 0;
    }
    if (L <= 2) {
      for (let i = 0; i < L; i++) {
        frente[i].crowdingDistance = Infinity;
      }
      return;
    }

    const numObjetivos = frente[0].fitness.length;
    for (let m = 0; m < numObjetivos; m++) {
      frente.sort((a, b) => a.fitness[m] - b.fitness[m]);
      frente[0].crowdingDistance = Infinity;
      frente[L - 1].crowdingDistance = Infinity;

      const minObj = frente[0].fitness[m];
      const maxObj = frente[L - 1].fitness[m];
      const rango = maxObj - minObj;

      if (rango > 1e-12) {
        for (let i = 1; i < L - 1; i++) {
          if (frente[i].crowdingDistance !== Infinity) {
            frente[i].crowdingDistance += (frente[i + 1].fitness[m] - frente[i - 1].fitness[m]) / rango;
          }
        }
      }
    }
  }

  // Operador de comparación abarrotada de NSGA-II: menor rango de frente gana; a igual rango, mayor distancia gana.
  compararPorPareto(a, b) {
    if (a.rango !== b.rango) {
      return a.rango - b.rango;
    }
    return b.crowdingDistance - a.crowdingDistance;
  }

  // Método principal correr(): inicializa la población y arranca el bucle evolutivo no bloqueante.
  correr(modelo, datosEntrada, onProgreso) {
    this.modelo = modelo;
    this.datosEntrada = datosEntrada;
    this.onProgreso = onProgreso;

    // Reinicio del generador determinista y obtención del genoma.
    this.random = crearPrngMulberry32(this.semilla);
    this.definicionGenes = this.modelo.crearGenoma(this.datosEntrada);

    // Limpieza de métricas y estados previos.
    this.generacionActual = 0;
    this.historiaMejor = [];
    this.historiaPromedio = [];
    this.frentePareto = [];
    this.estado = "CORRIENDO";

    // Creación y evaluación de la población inicial (generación 0).
    this.poblacion = [];
    for (let i = 0; i < this.tamanoPoblacion; i++) {
      const genoma = this.crearGenomaAleatorio();
      const fitness = this.evaluarIndividuo(genoma);
      this.poblacion.push({ genoma, fitness, rango: 0, crowdingDistance: 0 });
    }

    // Detección automática de optimización multiobjetivo según la forma del fitness.
    this.esMultiobjetivo = Array.isArray(this.poblacion[0].fitness);

    if (this.esMultiobjetivo) {
      // Ordenamiento por dominancia de Pareto y cálculo de distancias de apiñamiento.
      const frentes = this.clasificarFrentesPareto(this.poblacion);
      frentes.forEach((f) => this.calcularDistanciaApiñamiento(f));
      this.poblacion.sort((a, b) => this.compararPorPareto(a, b));
      this.frentePareto = this.poblacion.filter((ind) => ind.rango === 0);

      this.genomaInicialAzar = JSON.parse(JSON.stringify(this.poblacion[0].genoma));
      this.fitnessInicialAzar = [...this.poblacion[0].fitness];
    } else {
      // Modo monobjetivo clásico: ordenamiento directo por aptitud escalar.
      this.poblacion.sort((a, b) => a.fitness - b.fitness);
      this.genomaInicialAzar = JSON.parse(JSON.stringify(this.poblacion[0].genoma));
      this.fitnessInicialAzar = this.poblacion[0].fitness;
    }

    // Registro de métricas iniciales y despacho de la primera tanda.
    this.registrarEstadisticas();
    this.programarSiguienteTanda();
  }

  // Crea un genoma aleatorio respetando el tipo (continuo, entero, categorico) de cada gen.
  crearGenomaAleatorio() {
    const genoma = [];
    for (let i = 0; i < this.definicionGenes.length; i++) {
      const def = this.definicionGenes[i];
      let valor = 0;
      if (def.tipo === "continuo") {
        valor = def.min + this.random() * (def.max - def.min);
      } else if (def.tipo === "entero" || def.tipo === "categorico") {
        const rango = def.max - def.min + 1;
        valor = def.min + Math.floor(this.random() * rango);
      }
      genoma.push(valor);
    }
    return genoma;
  }

  // Evalúa un genoma considerando si el modelo tiene ruido estocástico o es determinista, con soporte escalar y multiobjetivo.
  evaluarIndividuo(genoma) {
    if (this.modelo.usaRuido) {
      const replicas = [];
      for (let r = 0; r < this.nReplicasRuido; r++) {
        replicas.push(this.modelo.evaluar(genoma, this.datosEntrada));
      }
      if (Array.isArray(replicas[0])) {
        const numObj = replicas[0].length;
        const promedio = new Array(numObj).fill(0);
        for (let r = 0; r < this.nReplicasRuido; r++) {
          for (let m = 0; m < numObj; m++) {
            promedio[m] += replicas[r][m];
          }
        }
        return promedio.map((v) => v / this.nReplicasRuido);
      }
      let suma = 0;
      for (let r = 0; r < this.nReplicasRuido; r++) {
        suma += replicas[r];
      }
      return suma / this.nReplicasRuido;
    }
    return this.modelo.evaluar(genoma, this.datosEntrada);
  }

  // Registra las estadísticas de la generación actual en los historiales y notifica al observador.
  registrarEstadisticas() {
    if (this.esMultiobjetivo) {
      // Extracción y ordenamiento del Frente de Pareto F0 por el primer objetivo para visualización fluida.
      const frenteF0 = this.poblacion.filter((ind) => ind.rango === 0);
      frenteF0.sort((a, b) => a.fitness[0] - b.fitness[0]);
      this.frentePareto = frenteF0;

      if (this.onProgreso) {
        this.onProgreso({
          esMultiobjetivo: true,
          generacion: this.generacionActual,
          totalGeneraciones: this.generaciones,
          frentePareto: this.frentePareto.map((ind) => ({
            genoma: [...ind.genoma],
            fitness: [...ind.fitness],
            rango: ind.rango,
            crowdingDistance: ind.crowdingDistance
          })),
          poblacion: this.poblacion.map((ind) => ({
            genoma: [...ind.genoma],
            fitness: [...ind.fitness],
            rango: ind.rango
          })),
          mejorGenoma: this.frentePareto[0] ? this.frentePareto[0].genoma : this.poblacion[0].genoma,
          mejorFitness: this.frentePareto[0] ? this.frentePareto[0].fitness : this.poblacion[0].fitness,
          genomaInicialAzar: this.genomaInicialAzar,
          fitnessInicialAzar: this.fitnessInicialAzar,
          nombresObjetivos: this.modelo.nombresObjetivos || ["Objetivo 1", "Objetivo 2"],
          completado: this.generacionActual >= this.generaciones
        });
      }
    } else {
      // Métricas de convergencia monobjetivo tradicional.
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
          esMultiobjetivo: false,
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

  // Realiza el paso evolutivo: selección, cruce, mutación y reemplazo generacional (NSGA-II en multiobjetivo).
  avanzarUnaGeneracion() {
    if (this.esMultiobjetivo) {
      this.avanzarGeneracionNSGA2();
    } else {
      this.avanzarGeneracionMonobjetivo();
    }
  }

  // Ejecuta la evolución generacional multiobjetivo con selección ambiental y preservación de frentes (NSGA-II).
  avanzarGeneracionNSGA2() {
    const N = this.tamanoPoblacion;
    const descendencia = [];

    // Creación de N descendientes mediante torneo abarrotado, cruce y mutación.
    for (let i = 0; i < N; i++) {
      const padre1 = this.seleccionPorTorneo();
      const padre2 = this.seleccionPorTorneo();

      let genomaHijo = this.cruceUniforme(padre1.genoma, padre2.genoma);
      genomaHijo = this.mutarGenoma(genomaHijo);
      const fitnessHijo = this.evaluarIndividuo(genomaHijo);

      descendencia.push({
        genoma: genomaHijo,
        fitness: fitnessHijo,
        rango: 0,
        crowdingDistance: 0
      });
    }

    // Combinación de padres y descendientes (conjunto de tamaño 2N).
    const combinada = [...this.poblacion, ...descendencia];
    const frentes = this.clasificarFrentesPareto(combinada);

    // Selección ambiental: se llenan los frentes de Pareto sucesivamente hasta completar N individuos.
    const nuevaPoblacion = [];
    let fIdx = 0;

    while (fIdx < frentes.length && nuevaPoblacion.length + frentes[fIdx].length <= N) {
      const frenteActual = frentes[fIdx];
      this.calcularDistanciaApiñamiento(frenteActual);
      for (let k = 0; k < frenteActual.length; k++) {
        nuevaPoblacion.push(frenteActual[k]);
      }
      fIdx++;
    }

    // Si el último frente no entra completo, se ordenan sus individuos por crowding distance descendente.
    if (nuevaPoblacion.length < N && fIdx < frentes.length) {
      const ultimoFrente = frentes[fIdx];
      this.calcularDistanciaApiñamiento(ultimoFrente);
      ultimoFrente.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
      const faltantes = N - nuevaPoblacion.length;
      for (let k = 0; k < faltantes; k++) {
        nuevaPoblacion.push(ultimoFrente[k]);
      }
    }

    this.poblacion = nuevaPoblacion;
    // Reclasificación y actualización de distancias sobre la nueva población seleccionada.
    const frentesFinales = this.clasificarFrentesPareto(this.poblacion);
    frentesFinales.forEach((f) => this.calcularDistanciaApiñamiento(f));
    this.poblacion.sort((a, b) => this.compararPorPareto(a, b));
  }

  // Ejecuta la evolución generacional monobjetivo tradicional con elitismo y torneo simple.
  avanzarGeneracionMonobjetivo() {
    const nuevaPoblacion = [];

    // 1. Elitismo: los mejores individuos pasan intactos.
    const cantidadElitismo = Math.min(this.elitismo, this.tamanoPoblacion);
    for (let e = 0; e < cantidadElitismo; e++) {
      nuevaPoblacion.push({
        genoma: [...this.poblacion[e].genoma],
        fitness: this.poblacion[e].fitness
      });
    }

    // 2. Generación de descendencia mediante torneo, cruce y mutación.
    while (nuevaPoblacion.length < this.tamanoPoblacion) {
      const padre1 = this.seleccionPorTorneo();
      const padre2 = this.seleccionPorTorneo();

      let genomaHijo = this.cruceUniforme(padre1.genoma, padre2.genoma);
      genomaHijo = this.mutarGenoma(genomaHijo);
      const fitnessHijo = this.evaluarIndividuo(genomaHijo);

      nuevaPoblacion.push({ genoma: genomaHijo, fitness: fitnessHijo });
    }

    nuevaPoblacion.sort((a, b) => a.fitness - b.fitness);
    this.poblacion = nuevaPoblacion;
  }

  // Selecciona un individuo eligiendo el mejor entre varios candidatos al azar (torneo monobjetivo o Pareto).
  seleccionPorTorneo() {
    let mejorCandidato = null;
    for (let t = 0; t < this.tamanoTorneo; t++) {
      const indice = Math.floor(this.random() * this.poblacion.length);
      const candidato = this.poblacion[indice];

      if (!mejorCandidato) {
        mejorCandidato = candidato;
      } else if (this.esMultiobjetivo) {
        if (this.compararPorPareto(candidato, mejorCandidato) < 0) {
          mejorCandidato = candidato;
        }
      } else if (candidato.fitness < mejorCandidato.fitness) {
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
          const delta = (this.random() - 0.5) * 0.25 * (def.max - def.min);
          mutado[i] = Math.min(def.max, Math.max(def.min, mutado[i] + delta));
        } else if (def.tipo === "entero") {
          const rango = def.max - def.min + 1;
          mutado[i] = def.min + Math.floor(this.random() * rango);
        } else if (def.tipo === "categorico") {
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
