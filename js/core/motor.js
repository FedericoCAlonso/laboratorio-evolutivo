// =========================================================================
// MÓDULO: MOTOR GENÉTICO GENÉRICO (MONO-OBJETIVO Y MULTIOBJETIVO NSGA-II)
// =========================================================================

import { crearPrngMulberry32 } from "./rng.js";

// Función auxiliar para programar la siguiente tanda de generaciones compatible con el hilo principal y Web Workers.
const programarFrame = (typeof requestAnimationFrame === "function" && typeof window !== "undefined")
  ? requestAnimationFrame
  : (cb) => setTimeout(cb, 0);

// Función auxiliar para cancelar la tanda programada compatible con el hilo principal y Web Workers.
const cancelarFrame = (typeof cancelAnimationFrame === "function" && typeof window !== "undefined")
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
    // Probabilidad de aplicar cruce entre padres (por defecto 0.85).
    this.probCruzamiento = opciones.probCruzamiento !== undefined ? opciones.probCruzamiento : 0.85;
    // Esquema de selección parental ('torneo' | 'ruleta' | 'rango').
    this.esquemaSeleccion = opciones.esquemaSeleccion || "torneo";
    // Operador de cruce genético ('sbx' | 'aritmetico' | 'un_punto' | 'uniforme').
    this.crossover = opciones.crossover || "sbx";
    // Factor de escala para la amplitud relativa de mutación continua.
    this.sigmaMutacion = opciones.sigmaMutacion !== undefined ? opciones.sigmaMutacion : 0.15;
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
    // Historial espaciado de instantáneas generacionales para línea de tiempo y fantasmas.
    this.historiaInstantaneas = [];
    // Cantidad aproximada de generaciones entre cada instantánea capturada.
    this.intervaloInstantaneas = 1;

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

    for (let i = 0; i < N; i++) {
      individuos[i]._idx = i;
    }

    for (let p = 0; p < N; p++) {
      const fitP = individuos[p].fitness;
      const esArrP = Array.isArray(fitP);
      const lenP = esArrP ? fitP.length : 1;

      for (let q = p + 1; q < N; q++) {
        const indP = individuos[p];
        const indQ = individuos[q];
        const vpViol = indP.violacion || 0;
        const vqViol = indQ.violacion || 0;
        let pDomina = false;
        let qDomina = false;

        // Reglas de Deb con restricciones: cualquier solución viable domina a una inviable;
        // entre dos inviables domina la de menor violación acumulada.
        if (vpViol <= 0 && vqViol > 0) {
          pDomina = true;
        } else if (vpViol > 0 && vqViol <= 0) {
          qDomina = true;
        } else if (vpViol > 0 && vqViol > 0) {
          pDomina = vpViol < vqViol;
          qDomina = vqViol < vpViol;
        } else {
          const fitQ = indQ.fitness;
          if (esArrP && Array.isArray(fitQ)) {
            let pMejor = false;
            let qMejor = false;
            for (let m = 0; m < lenP; m++) {
              const vp = fitP[m];
              const vq = fitQ[m];
              if (vp < vq) pMejor = true;
              else if (vp > vq) qMejor = true;
            }
            pDomina = pMejor && !qMejor;
            qDomina = qMejor && !pMejor;
          } else {
            pDomina = fitP < fitQ;
            qDomina = fitQ < fitP;
          }
        }

        if (pDomina) {
          Sp[p].push(q);
          np[q]++;
        } else if (qDomina) {
          Sp[q].push(p);
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
    this.historiaInstantaneas = [];
    this.intervaloInstantaneas = Math.max(1, Math.floor(this.generaciones / 24));
    this.frentePareto = [];
    this.estado = "CORRIENDO";

    // Creación y evaluación de la población inicial (generación 0).
    this.poblacion = [];
    for (let i = 0; i < this.tamanoPoblacion; i++) {
      const genoma = this.crearGenomaAleatorio();
      const { fitness, violacion } = this._evaluarDetallado(genoma);
      this.poblacion.push({ genoma, fitness, violacion, rango: 0, crowdingDistance: 0 });
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
      // Modo monobjetivo clásico con priorización de viabilidad (reglas de Deb).
      this.poblacion.sort((a, b) => this._compararEscalar(a, b));
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

  // Normaliza el resultado devuelto por modelo.evaluar a { fitness, violacion } para manejo de restricciones.
  _desempenoIndividuo(res) {
    if (res && typeof res === "object" && !Array.isArray(res) && res.fitness !== undefined) {
      return {
        fitness: res.fitness,
        violacion: typeof res.violacion === "number" && Number.isFinite(res.violacion) ? Math.max(0, res.violacion) : 0
      };
    }
    return { fitness: res, violacion: 0 };
  }

  // Comparador escalar con reglas de Deb: viable siempre vence a inviable; menor violación desempata inviables.
  _compararEscalar(a, b) {
    const va = a.violacion || 0;
    const vb = b.violacion || 0;
    if ((va > 0) !== (vb > 0)) return va > 0 ? 1 : -1;
    if (va > 0 && vb > 0) return va - vb;
    return a.fitness - b.fitness;
  }

  // Evalúa un genoma devolviendo { fitness, violacion } promediando réplicas si hay ruido estocástico.
  _evaluarDetallado(genoma) {
    if (this.modelo.usaRuido) {
      const replicas = [];
      let violSum = 0;
      for (let r = 0; r < this.nReplicasRuido; r++) {
        const d = this._desempenoIndividuo(this.modelo.evaluar(genoma, this.datosEntrada));
        replicas.push(d.fitness);
        violSum += d.violacion;
      }
      const violProm = violSum / this.nReplicasRuido;
      if (Array.isArray(replicas[0])) {
        const numObj = replicas[0].length;
        const promedio = new Array(numObj).fill(0);
        for (let r = 0; r < this.nReplicasRuido; r++) {
          for (let m = 0; m < numObj; m++) {
            promedio[m] += replicas[r][m];
          }
        }
        return { fitness: promedio.map((v) => v / this.nReplicasRuido), violacion: violProm };
      }
      let suma = 0;
      for (let r = 0; r < this.nReplicasRuido; r++) {
        suma += replicas[r];
      }
      return { fitness: suma / this.nReplicasRuido, violacion: violProm };
    }
    return this._desempenoIndividuo(this.modelo.evaluar(genoma, this.datosEntrada));
  }

  // Evalúa un genoma considerando si el modelo tiene ruido estocástico o es determinista, con soporte escalar y multiobjetivo.
  evaluarIndividuo(genoma) {
    return this._evaluarDetallado(genoma).fitness;
  }

  // Calcula métricas poblacionales de diversidad fenotípica, viabilidad y una muestra representativa de individuos.
  _calcularMetricasPoblacion() {
    const N = this.poblacion.length;
    if (N === 0) {
      return { diversidadPct: 0, viabilidadPct: 0, muestraPoblacion: [] };
    }

    // Diversidad genética: desviación estándar promedio normalizada sobre [min, max] de cada gen.
    const numGenes = this.definicionGenes.length;
    let sumaDesvNorm = 0;
    let genesConRango = 0;
    for (let g = 0; g < numGenes; g++) {
      const def = this.definicionGenes[g];
      const rango = def ? (def.max - def.min) : 0;
      if (rango <= 1e-12) continue;

      let suma = 0;
      for (let i = 0; i < N; i++) {
        suma += (this.poblacion[i].genoma[g] - def.min) / rango;
      }
      const media = suma / N;
      let varSuma = 0;
      for (let i = 0; i < N; i++) {
        const diff = (this.poblacion[i].genoma[g] - def.min) / rango - media;
        varSuma += diff * diff;
      }
      sumaDesvNorm += Math.sqrt(varSuma / N);
      genesConRango++;
    }
    // En uniforme [0,1], std teórico es 1/sqrt(12) ≈ 0.2887 -> se escala a 100%.
    const promedioStd = genesConRango > 0 ? sumaDesvNorm / genesConRango : 0;
    const diversidadPct = Math.min(100, Math.max(0, (promedioStd / 0.2887) * 100));

    // Porcentaje de soluciones viables (sin violación de restricciones ni penalización severa >= 500).
    let viables = 0;
    for (let i = 0; i < N; i++) {
      const ind = this.poblacion[i];
      if (typeof ind.violacion === "number") {
        if (ind.violacion <= 0) viables++;
      } else if (Array.isArray(ind.fitness)) {
        if (ind.fitness.every((v) => Number.isFinite(v) && v < 500)) viables++;
      } else if (Number.isFinite(ind.fitness) && ind.fitness < 500) {
        viables++;
      }
    }
    const viabilidadPct = (viables / N) * 100;

    // Muestra representativa de hasta 12 individuos distribuidos uniformemente en la población.
    const maxFantasmas = Math.min(12, N);
    const muestraPoblacion = [];
    const paso = N / maxFantasmas;
    for (let k = 0; k < maxFantasmas; k++) {
      const idx = Math.min(N - 1, Math.floor(k * paso));
      muestraPoblacion.push([...this.poblacion[idx].genoma]);
    }

    return {
      diversidadPct: Number(diversidadPct.toFixed(1)),
      viabilidadPct: Number(viabilidadPct.toFixed(1)),
      muestraPoblacion
    };
  }

  // Guarda una instantánea de la generación actual si corresponde al intervalo de muestreo o hitos clave.
  _registrarInstantaneaSiCorresponde(metricas, forzar = false) {
    const ultima = this.historiaInstantaneas[this.historiaInstantaneas.length - 1];
    const esInicioOFin = this.generacionActual === 0 || this.generacionActual >= this.generaciones;
    const tocaPorIntervalo = !ultima || (this.generacionActual - ultima.generacion >= this.intervaloInstantaneas);
    if (!forzar && !esInicioOFin && !tocaPorIntervalo) return;

    const lider = this.esMultiobjetivo && this.frentePareto[0] ? this.frentePareto[0] : this.poblacion[0];
    if (!lider) return;

    const instantanea = {
      generacion: this.generacionActual,
      mejorGenoma: [...lider.genoma],
      mejorFitness: Array.isArray(lider.fitness) ? [...lider.fitness] : lider.fitness,
      diversidadPct: metricas.diversidadPct,
      viabilidadPct: metricas.viabilidadPct,
      fantasmas: metricas.muestraPoblacion
    };

    if (ultima && ultima.generacion === this.generacionActual) {
      this.historiaInstantaneas[this.historiaInstantaneas.length - 1] = instantanea;
    } else {
      this.historiaInstantaneas.push(instantanea);
    }
  }

  // Registra las estadísticas de la generación actual en los historiales y notifica al observador.
  registrarEstadisticas(emitirEvento = true) {
    if (this.esMultiobjetivo) {
      const frenteF0 = this.poblacion.filter((ind) => ind.rango === 0);
      frenteF0.sort((a, b) => a.fitness[0] - b.fitness[0]);
      this.frentePareto = frenteF0;

      const metricas = (emitirEvento || this.generacionActual === 0 || this.generacionActual >= this.generaciones ||
        !this.historiaInstantaneas.length ||
        this.generacionActual - this.historiaInstantaneas[this.historiaInstantaneas.length - 1].generacion >= this.intervaloInstantaneas)
        ? this._calcularMetricasPoblacion()
        : null;

      if (metricas) {
        this._registrarInstantaneaSiCorresponde(metricas);
      }

      if (emitirEvento && this.onProgreso) {
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
          diversidadPct: metricas.diversidadPct,
          viabilidadPct: metricas.viabilidadPct,
          muestraPoblacion: metricas.muestraPoblacion,
          instantaneas: this.historiaInstantaneas,
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

      const metricas = (emitirEvento || this.generacionActual === 0 || this.generacionActual >= this.generaciones ||
        !this.historiaInstantaneas.length ||
        this.generacionActual - this.historiaInstantaneas[this.historiaInstantaneas.length - 1].generacion >= this.intervaloInstantaneas)
        ? this._calcularMetricasPoblacion()
        : null;

      if (metricas) {
        this._registrarInstantaneaSiCorresponde(metricas);
      }

      if (emitirEvento && this.onProgreso) {
        this.onProgreso({
          esMultiobjetivo: false,
          generacion: this.generacionActual,
          totalGeneraciones: this.generaciones,
          mejorFitness: mejorFitness,
          promedioFitness: promedioFitness,
          mejorGenoma: this.poblacion[0].genoma,
          genomaInicialAzar: this.genomaInicialAzar,
          fitnessInicialAzar: this.fitnessInicialAzar,
          diversidadPct: metricas.diversidadPct,
          viabilidadPct: metricas.viabilidadPct,
          muestraPoblacion: metricas.muestraPoblacion,
          instantaneas: this.historiaInstantaneas,
          historiaMejor: this.historiaMejor,
          historiaPromedio: this.historiaPromedio,
          completado: this.generacionActual >= this.generaciones
        });
      }
    }
  }

  // Ejecuta una tanda de generaciones en lotes con presupuesto de tiempo dinámico
  // para balancear máximo rendimiento de CPU con una tasa de refresco visual fluida de 60 FPS.
  ejecutarTanda() {
    if (this.estado !== "CORRIENDO") return;

    const tInicioLote = performance.now();
    const loteMinimo = Math.max(5, this.tandaGeneraciones || 10);
    let genEnLote = 0;

    while (this.generacionActual < this.generaciones) {
      this.avanzarUnaGeneracion();
      this.generacionActual++;
      genEnLote++;

      const esUltima = this.generacionActual >= this.generaciones;
      const tiempoConsumido = performance.now() - tInicioLote;

      if (esUltima || (genEnLote >= loteMinimo && tiempoConsumido >= 30)) {
        this.registrarEstadisticas(true);
        break;
      } else {
        this.registrarEstadisticas(false);
      }
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

    // Creación de N descendientes mediante selección, cruce y mutación.
    for (let i = 0; i < N; i++) {
      const padre1 = this.seleccionarPadre();
      const padre2 = this.seleccionarPadre();

      let genomaHijo = this.cruzarGenomas(padre1.genoma, padre2.genoma);
      genomaHijo = this.mutarGenoma(genomaHijo);
      const { fitness: fitnessHijo, violacion: violacionHijo } = this._evaluarDetallado(genomaHijo);

      descendencia.push({
        genoma: genomaHijo,
        fitness: fitnessHijo,
        violacion: violacionHijo,
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
        fitness: this.poblacion[e].fitness,
        violacion: this.poblacion[e].violacion || 0
      });
    }

    // 2. Generación de descendencia mediante selección, cruce y mutación.
    while (nuevaPoblacion.length < this.tamanoPoblacion) {
      const padre1 = this.seleccionarPadre();
      const padre2 = this.seleccionarPadre();

      let genomaHijo = this.cruzarGenomas(padre1.genoma, padre2.genoma);
      genomaHijo = this.mutarGenoma(genomaHijo);
      const { fitness: fitnessHijo, violacion: violacionHijo } = this._evaluarDetallado(genomaHijo);

      nuevaPoblacion.push({ genoma: genomaHijo, fitness: fitnessHijo, violacion: violacionHijo });
    }

    nuevaPoblacion.sort((a, b) => this._compararEscalar(a, b));
    this.poblacion = nuevaPoblacion;
  }

  // Selecciona un padre delegando al esquema configurado ('torneo', 'ruleta' o 'rango').
  seleccionarPadre() {
    if (this.esquemaSeleccion === "ruleta") {
      return this.seleccionPorRuleta();
    }
    if (this.esquemaSeleccion === "rango") {
      return this.seleccionPorRango();
    }
    return this.seleccionPorTorneo();
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
      } else if (this._compararEscalar(candidato, mejorCandidato) < 0) {
        mejorCandidato = candidato;
      }
    }
    return mejorCandidato;
  }

  // Selecciona un individuo proporcionalmente a su aptitud relativa (ruleta inversa en minimización).
  seleccionPorRuleta() {
    const N = this.poblacion.length;
    if (N === 0) return null;

    let sumaPesos = 0;
    const pesos = new Float64Array(N);

    if (this.esMultiobjetivo) {
      for (let i = 0; i < N; i++) {
        const ind = this.poblacion[i];
        const bonoDistancia = Number.isFinite(ind.crowdingDistance) ? Math.min(1.0, ind.crowdingDistance * 0.25) : 1.0;
        const penViol = ind.violacion > 0 ? 1.0 / (1.0 + ind.violacion) : 1.0;
        const w = ((1.0 / (1.0 + (ind.rango || 0))) + bonoDistancia * 0.2) * penViol;
        pesos[i] = w;
        sumaPesos += w;
      }
    } else {
      let maxFit = -Infinity;
      let minFit = Infinity;
      for (let i = 0; i < N; i++) {
        const f = this.poblacion[i].fitness;
        if (f > maxFit) maxFit = f;
        if (f < minFit) minFit = f;
      }
      const span = Math.max(1e-9, maxFit - minFit);
      for (let i = 0; i < N; i++) {
        const ind = this.poblacion[i];
        const w = (ind.violacion > 0)
          ? (0.01 / (1.0 + ind.violacion))
          : (((maxFit - ind.fitness) / span) + 0.05);
        pesos[i] = w;
        sumaPesos += w;
      }
    }

    let umbral = this.random() * sumaPesos;
    for (let i = 0; i < N; i++) {
      umbral -= pesos[i];
      if (umbral <= 0) return this.poblacion[i];
    }
    return this.poblacion[N - 1];
  }

  // Selecciona un individuo con probabilidad lineal según su ordenamiento en la población (rank selection).
  seleccionPorRango() {
    const N = this.poblacion.length;
    if (N === 0) return null;
    const sumaRangos = (N * (N + 1)) / 2;
    let umbral = this.random() * sumaRangos;
    for (let i = 0; i < N; i++) {
      umbral -= (N - i);
      if (umbral <= 0) return this.poblacion[i];
    }
    return this.poblacion[0];
  }

  // Aplica el operador de cruce configurado respetando la probabilidad de cruzamiento.
  cruzarGenomas(genomaA, genomaB) {
    if (this.random() > this.probCruzamiento) {
      return [...genomaA];
    }
    if (this.crossover === "aritmetico") {
      return this.cruceAritmetico(genomaA, genomaB);
    }
    if (this.crossover === "un_punto") {
      return this.cruceUnPunto(genomaA, genomaB);
    }
    if (this.crossover === "uniforme") {
      return this.cruceUniforme(genomaA, genomaB);
    }
    return this.cruceSBX(genomaA, genomaB);
  }

  // Cruce Binario Simulado (SBX) para variables continuas y uniforme para variables discretas.
  cruceSBX(genomaA, genomaB, etaC = 15) {
    const hijo = new Array(genomaA.length);
    const tomarPrimero = this.random() < 0.5;

    for (let i = 0; i < genomaA.length; i++) {
      const def = this.definicionGenes[i];
      const v1 = genomaA[i];
      const v2 = genomaB[i];

      if (!def || def.tipo !== "continuo" || this.random() > 0.5 || Math.abs(v1 - v2) < 1e-12) {
        hijo[i] = this.random() < 0.5 ? v1 : v2;
        continue;
      }

      const y1 = Math.min(v1, v2);
      const y2 = Math.max(v1, v2);
      const lb = def.min;
      const ub = def.max;

      const u = this.random();
      let beta = 1.0 + (2.0 * (y1 - lb)) / Math.max(1e-12, y2 - y1);
      let alpha = 2.0 - Math.pow(beta, -(etaC + 1.0));
      let betaq = u <= 1.0 / alpha
        ? Math.pow(u * alpha, 1.0 / (etaC + 1.0))
        : Math.pow(1.0 / Math.max(1e-12, 2.0 - u * alpha), 1.0 / (etaC + 1.0));
      const c1 = 0.5 * ((y1 + y2) - betaq * (y2 - y1));

      beta = 1.0 + (2.0 * (ub - y2)) / Math.max(1e-12, y2 - y1);
      alpha = 2.0 - Math.pow(beta, -(etaC + 1.0));
      betaq = u <= 1.0 / alpha
        ? Math.pow(u * alpha, 1.0 / (etaC + 1.0))
        : Math.pow(1.0 / Math.max(1e-12, 2.0 - u * alpha), 1.0 / (etaC + 1.0));
      const c2 = 0.5 * ((y1 + y2) + betaq * (y2 - y1));

      const elegido = tomarPrimero ? c1 : c2;
      hijo[i] = Math.min(ub, Math.max(lb, elegido));
    }
    return hijo;
  }

  // Cruce aritmético BLX-alfa para genes continuos y uniforme para discretos.
  cruceAritmetico(genomaA, genomaB) {
    const hijo = new Array(genomaA.length);
    for (let i = 0; i < genomaA.length; i++) {
      const def = this.definicionGenes[i];
      if (def && def.tipo === "continuo") {
        const alfa = -0.1 + this.random() * 1.2;
        const val = alfa * genomaA[i] + (1 - alfa) * genomaB[i];
        hijo[i] = Math.min(def.max, Math.max(def.min, val));
      } else {
        hijo[i] = this.random() < 0.5 ? genomaA[i] : genomaB[i];
      }
    }
    return hijo;
  }

  // Cruce clásico de un punto de corte sobre la secuencia del genoma.
  cruceUnPunto(genomaA, genomaB) {
    const L = genomaA.length;
    if (L <= 1) return [...genomaA];
    const corte = 1 + Math.floor(this.random() * (L - 1));
    const hijo = new Array(L);
    for (let i = 0; i < L; i++) {
      hijo[i] = i < corte ? genomaA[i] : genomaB[i];
    }
    return hijo;
  }

  // Combina dos genomas parentales asignando cada gen de un padre u otro con probabilidad del 50%.
  cruceUniforme(genomaA, genomaB) {
    const hijo = [];
    for (let i = 0; i < genomaA.length; i++) {
      hijo.push(this.random() < 0.5 ? genomaA[i] : genomaB[i]);
    }
    return hijo;
  }

  // Aplica mutaciones genéticas adaptativas según el avance generacional y el tipo de cada gen.
  mutarGenoma(genoma) {
    const mutado = [...genoma];
    const progreso = Math.min(1, Math.max(0, this.generacionActual / Math.max(1, this.generaciones)));
    // Decaimiento progresivo: exploración amplia al inicio, ajuste fino al final.
    const factorEscala = Math.max(0.08, 1.0 - 0.85 * progreso) * Math.max(0.05, this.sigmaMutacion * 2.0);

    for (let i = 0; i < mutado.length; i++) {
      if (this.random() < this.tasaMutacion) {
        const def = this.definicionGenes[i];
        if (def.tipo === "continuo") {
          // 15% de mutaciones globales suaves para evitar estancamiento en mínimos locales.
          const escala = this.random() < 0.15 ? 0.35 : factorEscala;
          // Suma de dos uniformes centrada en 0 (distribución triangular) para favorecer pasos pequeños.
          const gaussAprox = (this.random() + this.random() - 1.0);
          const delta = gaussAprox * escala * (def.max - def.min);
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

  // Actualiza los parámetros ambientales en vivo y re-evalúa la población para forzar adaptación darwiniana.
  actualizarDatosEntrada(nuevosDatos) {
    if (!this.modelo || !this.poblacion || this.poblacion.length === 0) return;
    this.datosEntrada = nuevosDatos;

    // Si la población estaba hiperconvergida, reinyecta 25% no-élite aleatorio para explorar el nuevo entorno.
    const metricasPrevias = this._calcularMetricasPoblacion();
    if (metricasPrevias.diversidadPct < 10) {
      const inicioReemplazo = Math.max(1, Math.floor(this.poblacion.length * 0.75));
      for (let i = inicioReemplazo; i < this.poblacion.length; i++) {
        this.poblacion[i].genoma = this.crearGenomaAleatorio();
      }
    }

    for (let i = 0; i < this.poblacion.length; i++) {
      const det = this._evaluarDetallado(this.poblacion[i].genoma);
      this.poblacion[i].fitness = det.fitness;
      this.poblacion[i].violacion = det.violacion;
    }

    if (this.esMultiobjetivo) {
      const frentes = this.clasificarFrentesPareto(this.poblacion);
      frentes.forEach((f) => this.calcularDistanciaApiñamiento(f));
      this.poblacion.sort((a, b) => this.compararPorPareto(a, b));
      this.frentePareto = this.poblacion.filter((ind) => ind.rango === 0);
    } else {
      this.poblacion.sort((a, b) => this._compararEscalar(a, b));
    }

    const metricasActuales = this._calcularMetricasPoblacion();
    this._registrarInstantaneaSiCorresponde(metricasActuales, true);
    this.registrarEstadisticas(true);
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
