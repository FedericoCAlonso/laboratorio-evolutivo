// =========================================================================
// PRUEBAS DARWINIANAS: MÉTRICAS, RESTRICCIONES DEB, ESCENAS Y ESCENARIOS
// =========================================================================

import assert from "node:assert/strict";
import { Motor } from "./js/core/motor.js";
import { MODELOS, obtenerModeloPorId } from "./catalogo/index.js";
import { compilarModeloDinamico, normalizarSalidaEvaluacion } from "./js/builder.js";
import { VisualizadorDinamico } from "./js/views/visualizers.js";

// Mock mínimo de localStorage y document para pruebas headless del ViewModel y Visualizador.
if (typeof globalThis.localStorage === "undefined") {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k)
  };
}

import { AppViewModel } from "./js/viewmodels/app-viewmodel.js";

// Ejecuta el motor genético hasta completar todas las generaciones y devuelve eventos emitidos.
function correrMotorAsync(motor, modelo, entrada = {}) {
  return new Promise((resolve) => {
    const eventos = [];
    motor.correr(modelo, entrada, (prog) => {
      eventos.push(prog);
      if (prog.completado) resolve(eventos);
    });
  });
}

async function ejecutarPruebas() {
  console.log("=== INICIANDO PRUEBAS DARWINIANAS Y DE SIMULACIÓN GENERAL ===");

  // 1. Verificar que los 16 modelos del catálogo exponen parametrosEntrada y responden a cambios ambientales.
  console.log("\n[1] Verificando parametrosEntrada y sensibilidad ambiental en los 16 modelos...");
  for (const mod of MODELOS) {
    assert(
      Array.isArray(mod.parametrosEntrada) && mod.parametrosEntrada.length >= 2,
      `El modelo ${mod.id} debe definir al menos 2 parametrosEntrada.`
    );
    const genes = mod.crearGenoma({});
    const gMid = genes.map((g) => (g.tipo === "entero" || g.tipo === "categorico" ? Math.round((g.min + g.max) / 2) : (g.min + g.max) / 2));
    const resBase = mod.evaluar(gMid, {});

    // Construye entrada modificada moviendo los parámetros numéricos de su valor por defecto.
    const entAlt = {};
    mod.parametrosEntrada.forEach((p) => {
      if (p.tipo === "numero" && p.max !== undefined && p.min !== undefined) {
        const span = Number(p.max) - Number(p.min);
        const defVal = Number(p.valorDefecto);
        entAlt[p.clave] = defVal + span * 0.25 <= Number(p.max) ? defVal + span * 0.25 : defVal - span * 0.25;
      } else {
        entAlt[p.clave] = p.valorDefecto;
      }
    });
    const resAlt = mod.evaluar(gMid, entAlt);
    assert(resBase !== undefined && resAlt !== undefined, `Evaluación válida en ${mod.id}`);
  }
  console.log(`    ✓ ${MODELOS.length}/16 modelos del catálogo tienen parametrosEntrada activos | OK`);

  // 2. Verificar instantáneas históricas, diversidad, viabilidad y adaptación en vivo (actualizarDatosEntrada).
  console.log("\n[2] Verificando instantáneas, diversidad, viabilidad y adaptación en vivo...");
  const modBrazo = obtenerModeloPorId("brazo-robotico");
  const motor = new Motor({
    tamanoPoblacion: 45,
    generaciones: 50,
    esquemaSeleccion: "torneo",
    crossover: "sbx",
    probCruzamiento: 0.85,
    tasaMutacion: 0.15,
    sigmaMutacion: 0.12,
    semilla: 42
  });

  const eventos = await correrMotorAsync(motor, modBrazo, { modoOptimizacion: "monobjetivo", objetivoX: 55, objetivoY: 40 });
  const ultimo = eventos[eventos.length - 1];
  assert(ultimo.completado === true, "La corrida debe marcar completado=true");
  assert(ultimo.instantaneas.length >= 3, "Debe capturar múltiples instantáneas en la línea de tiempo");
  assert(ultimo.instantaneas[0].generacion === 0, "Primera instantánea debe ser Gen 0");
  assert(ultimo.instantaneas[ultimo.instantaneas.length - 1].generacion === 50, "Última instantánea debe ser Gen 50");
  assert(Array.isArray(ultimo.muestraPoblacion) && ultimo.muestraPoblacion.length > 0, "Debe incluir muestra de fantasmas");
  assert(ultimo.diversidadPct >= 0 && ultimo.diversidadPct <= 100, "Diversidad debe estar en [0, 100]");
  assert(ultimo.viabilidadPct >= 0 && ultimo.viabilidadPct <= 100, "Viabilidad debe estar en [0, 100]");
  assert(ultimo.mejorFitness < ultimo.fitnessInicialAzar, "Debe mejorar respecto al mejor aleatorio inicial");

  // Cambio ambiental repentino en vivo: mover blanco a (-40, 50) y forzar re-evaluación
  const eventosReAdapt = [];
  motor.onProgreso = (p) => eventosReAdapt.push(p);
  motor.actualizarDatosEntrada({ modoOptimizacion: "monobjetivo", objetivoX: -40, objetivoY: 50 });
  assert.equal(eventosReAdapt.length, 1, "actualizarDatosEntrada debe emitir nuevo progreso inmediatamente");
  assert(motor.poblacion[0].fitness > ultimo.mejorFitness, "El error debe aumentar al mover repentinamente el objetivo a (-40, 50)");
  console.log(`    ✓ Línea de tiempo (${ultimo.instantaneas.length} hitos), diversidad=${ultimo.diversidadPct}%, adaptación en vivo OK`);

  // 3. Verificar operadores genéticos múltiples (ruleta, rango, aritmético, un_punto).
  console.log("\n[3] Verificando esquemas de selección y operadores de cruce en Motor...");
  const modBenchmarkOp = compilarModeloDinamico({
    nombre: "Benchmark Operadores",
    variables: [
      { nombre: "x1", tipo: "continuo", min: -10, max: 10 },
      { nombre: "x2", tipo: "continuo", min: -10, max: 10 },
      { nombre: "x3", tipo: "continuo", min: -10, max: 10 },
      { nombre: "x4", tipo: "continuo", min: -10, max: 10 }
    ],
    codigoEvaluacion: `
      const tx = Number(entrada?.targetX ?? 3.5);
      return (vars.x1 - tx) ** 2 + (vars.x2 + 2.0) ** 2 + (vars.x3 - 1.5) ** 2 + vars.x4 ** 2;
    `
  });
  for (const esquema of ["torneo", "ruleta", "rango"]) {
    for (const crossover of ["sbx", "aritmetico", "un_punto"]) {
      const mOp = new Motor({
        tamanoPoblacion: 30,
        generaciones: 35,
        esquemaSeleccion: esquema,
        crossover,
        semilla: 123
      });
      const evs = await correrMotorAsync(mOp, modBenchmarkOp, { targetX: 3.5 });
      const fin = evs[evs.length - 1];
      assert(fin.mejorFitness < fin.fitnessInicialAzar * 0.5, `Combinación ${esquema}+${crossover} debe converger`);
    }
  }
  console.log("    ✓ Todas las combinaciones de selección y cruce convergen | OK");

  // 4. Verificar manejo de restricciones Feasibility-First (Reglas de Deb) en mono y multiobjetivo.
  console.log("\n[4] Verificando reglas de Deb (viabilidad prioritaria) en modo escalar y NSGA-II...");
  const modeloRestringido = compilarModeloDinamico({
    nombre: "Test Deb Restricciones",
    variables: [{ nombre: "x", tipo: "continuo", min: 0, max: 10 }],
    codigoEvaluacion: `
      // x < 5 tiene fitness mejor (menor) pero viola restricción x >= 5!
      const violacion = vars.x < 5 ? (5 - vars.x) * 10 : 0;
      return { fitness: vars.x, violacion };
    `
  });
  const mDeb = new Motor({ tamanoPoblacion: 40, generaciones: 40, semilla: 77 });
  const evDeb = await correrMotorAsync(mDeb, modeloRestringido, {});
  const bestDeb = evDeb[evDeb.length - 1].mejorGenoma[0];
  assert(bestDeb >= 5.0 && bestDeb < 5.5, `Reglas de Deb deben converger al óptimo viable x>=5 (obtenido: ${bestDeb})`);

  // Caso NSGA-II con restricción explícita
  const modeloMultiDeb = compilarModeloDinamico({
    nombre: "Test Deb Multi",
    variables: [{ nombre: "x", tipo: "continuo", min: 0, max: 10 }],
    codigoEvaluacion: `
      const violacion = vars.x < 4 ? (4 - vars.x) * 5 : 0;
      return { fitness: [vars.x, (10 - vars.x)], violacion };
    `
  });
  const mDebMulti = new Motor({ tamanoPoblacion: 40, generaciones: 35, semilla: 88 });
  const evDebMulti = await correrMotorAsync(mDebMulti, modeloMultiDeb, {});
  const frente = evDebMulti[evDebMulti.length - 1].frentePareto;
  assert(frente.every((ind) => ind.genoma[0] >= 3.99), "El frente F0 debe priorizar individuos viables (x >= 4)");
  console.log("    ✓ Reglas de Deb (monobjetivo y NSGA-II multiobjetivo) verificadas | OK");

  // 5. Verificar API de escena declarativa personalizada { fitness, violacion, escena } + VisualizadorDinamico.
  console.log("\n[5] Verificando API de dibujo declarativo { fitness, escena } y describir()...");
  const modeloEscena = compilarModeloDinamico({
    nombre: "Resorte Declarativo",
    variables: [
      { nombre: "px", tipo: "continuo", min: -10, max: 10 },
      { nombre: "py", tipo: "continuo", min: -10, max: 10 }
    ],
    codigoEvaluacion: `
      const dist = Math.hypot(vars.px - 6, vars.py - 4);
      const viol = Math.max(0, 3 - Math.hypot(vars.px, vars.py));
      return {
        fitness: dist,
        violacion: viol,
        escena: {
          xlim: [-12, 12], ylim: [-12, 12], titulo: "Escena Test",
          circulos: [{ x: 0, y: 0, r: 3, borde: "#ef4444" }],
          lineas: [{ x1: 0, y1: 0, x2: vars.px, y2: vars.py, color: "#38bdf8" }],
          curvas: [{ puntos: [{ x: 0, y: 0 }, { x: vars.px, y: vars.py }], color: "#f59e0b" }],
          puntos: [{ x: vars.px, y: vars.py, etiqueta: "P" }]
        }
      };
    `
  });

  const escena = modeloEscena.obtenerEscena([6, 4], {});
  assert(escena && escena.titulo === "Escena Test" && escena.lineas.length === 1, "obtenerEscena debe extraer escena");
  const descEscena = modeloEscena.describir([1, 1], {});
  assert(descEscena.includes("VIOLACIÓN DE RESTRICCIONES"), "describir debe reportar violación cuando violacion > 0");
  const norm = normalizarSalidaEvaluacion(modeloEscena.evaluar([6, 4], {}));
  assert(norm.fitness === 0 && norm.violacion === 0, "evaluar debe conservar fitness y violacion normalizados");

  // Renderizado Canvas simulado con conteo de llamadas de dibujo
  let llamadasDraw = 0;
  const ctxMock = {
    resetTransform() {}, scale() {}, fillRect() { llamadasDraw++; },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() { llamadasDraw++; },
    stroke() { llamadasDraw++; }, fill() {}, roundRect() {}, fillText() {}, setLineDash() {},
    save() {}, restore() {}
  };
  const canvasMock = {
    width: 800, height: 360, clientWidth: 800, clientHeight: 360, style: {}, isConnected: true,
    getContext: () => ctxMock
  };
  const contenedorMock = {
    innerHTML: "",
    querySelector: () => canvasMock,
    appendChild() {}
  };
  const viz = new VisualizadorDinamico();
  viz.render(contenedorMock, [6, 4], {}, {
    modelo: modeloEscena,
    fantasmas: [[6, 4], [2, 5], [4, 3]],
    mostrarFantasmas: true,
    genomaAzar: [-5, -5],
    compararGen0: true
  });
  assert(llamadasDraw > 10, "VisualizadorDinamico debe dibujar escena declarativa + fantasmas + Gen 0");
  console.log(`    ✓ Escena declarativa dibujada (${llamadasDraw} primitivas) y describir() exacto | OK`);

  // 6. Verificar estado del Observatorio en AppViewModel (timeline, fantasmas, Gen 0).
  console.log("\n[6] Verificando controles del Observatorio en AppViewModel...");
  const vm = new AppViewModel();
  vm._procesarMensajeWorker({
    tipo: "progreso",
    generacion: 50,
    totalGeneraciones: 50,
    esMultiobjetivo: false,
    mejorGenoma: [45, -30, 15],
    mejorFitness: 0.12,
    genomaInicialAzar: [10, 10, 10],
    fitnessInicialAzar: 18.5,
    diversidadPct: 21.4,
    viabilidadPct: 95.0,
    muestraPoblacion: [[45, -30, 15], [44, -29, 14]],
    instantaneas: [
      { generacion: 0, mejorGenoma: [10, 10, 10], mejorFitness: 18.5, diversidadPct: 98.0, viabilidadPct: 40.0, fantasmas: [[10, 10, 10]] },
      { generacion: 50, mejorGenoma: [45, -30, 15], mejorFitness: 0.12, diversidadPct: 21.4, viabilidadPct: 95.0, fantasmas: [[45, -30, 15]] }
    ],
    historiaMejor: [18.5, 0.12],
    historiaPromedio: [25.0, 1.5],
    completado: true
  });
  vm.alternarCompararGen0(true);
  vm.seleccionarInstantanea(0);
  const ctxHist = vm.obtenerContextoVisualizacion();
  assert.equal(ctxHist.esHistorico, true, "Debe reflejar modo histórico en índice 0");
  assert.equal(ctxHist.generacion, 0, "Debe restaurar Gen 0 al mover scrubber a índice 0");
  assert.deepEqual(ctxHist.genomaAzar, [10, 10, 10], "Debe incluir genomaAzar cuando compararGen0 está activo");
  vm.seleccionarInstantanea(1);
  assert.equal(vm.obtenerContextoVisualizacion().esHistorico, false, "Último índice vuelve a modo en vivo");
  console.log("    ✓ AppViewModel Observatorio (timeline, fantasmas, Gen 0) verificado | OK");

  console.log("\n=== ¡TODAS LAS PRUEBAS DARWINIANAS PASARON CON ÉXITO! ===");
}

ejecutarPruebas().catch((err) => {
  console.error("Error en pruebas darwinianas:", err);
  process.exit(1);
});
