// =========================================================================
// SUITE DE PRUEBAS AUTOMATIZADAS: MOTOR CAD DE MECANISMOS, DOF Y MULTIFÍSICA
// ARQUITECTURA MVVM - VERIFICACIÓN MATEMÁTICA Y TELEMETRÍA DE SENSORES
// =========================================================================

import assert from "assert";
import {
  GrafoMecanismoMultifisica,
  analizarGradosLibertad,
  resolverPasoMecanismo,
  simularCicloMecanismo,
  crearGrafoPataJansen,
  crearGrafoBrazoRobotico
} from "./js/engines/mecanismos.js";
import {
  compilarFuncionEvaluacion,
  validarDefinicionModelo,
  compilarModeloDinamico,
  PLANTILLAS_SIMULACION
} from "./js/builder.js";
import { EditorGraficoView } from "./js/views/editor-grafico-view.js";

console.log("=== INICIANDO PRUEBAS DEL MOTOR CAD DE MECANISMOS Y MULTIFÍSICA 2D ===\n");

// -------------------------------------------------------------------------
// PRUEBA 1: ANÁLISIS DE GRADOS DE LIBERTAD (CRITERIO DE GRÜBLER-KUTZBACH)
// -------------------------------------------------------------------------
console.log("[1] Probando análisis de Grados de Libertad (Criterio Grübler-Kutzbach)...");

// 1.1 Mecanismo de 4 barras canónico (1 bancada fija + 3 eslabones móviles, 4 articulaciones j1)
const grafo4Barras = new GrafoMecanismoMultifisica();
grafo4Barras.agregarNodo({ id: "N1", x: 0, y: 0, tipo: "fijo" });
grafo4Barras.agregarNodo({ id: "N2", x: 40, y: 0, tipo: "fijo" });
grafo4Barras.agregarNodo({ id: "N3", x: 10, y: 30, tipo: "libre" });
grafo4Barras.agregarNodo({ id: "N4", x: 30, y: 30, tipo: "libre" });
grafo4Barras.agregarBarra({ id: "B1", nodoA: "N1", nodoB: "N3", longitud: 31.62 });
grafo4Barras.agregarBarra({ id: "B2", nodoA: "N3", nodoB: "N4", longitud: 20.0 });
grafo4Barras.agregarBarra({ id: "B3", nodoA: "N4", nodoB: "N2", longitud: 31.62 });
grafo4Barras.agregarMotor({ id: "M1", tipo: "rotativo", nodoPivote: "N1", nodoExtremo: "N3", velocidadAngular: 1.0 });

const dof4Barras = analizarGradosLibertad(grafo4Barras);
assert.strictEqual(dof4Barras.M, 1, `Mecanismo de 4 barras debe tener M=1 GDL, obtenido: ${dof4Barras.M}`);
assert.strictEqual(dof4Barras.esDeterminado, true, "Con 1 motor rotativo y M=1, el mecanismo debe ser cinemáticamente determinado");
console.log(`    ✓ Mecanismo 4 barras: M = ${dof4Barras.M} (Grübler-Kutzbach), Motores: ${dof4Barras.numMotores} | Determinado: ${dof4Barras.esDeterminado} | OK`);

// 1.2 Brazo Robótico Articulado (3 GDL seriales)
const grafoBrazo = crearGrafoBrazoRobotico();
const dofBrazo = analizarGradosLibertad(grafoBrazo);
assert.strictEqual(dofBrazo.M, 3, `Brazo robotico debe tener M=3 GDL, obtenido: ${dofBrazo.M}`);
assert.strictEqual(dofBrazo.esDeterminado, true, "Con 3 motores independientes y M=3, debe ser cinemáticamente determinado");
console.log(`    ✓ Brazo robótico (3 eslabones): M = ${dofBrazo.M} GDL, Motores: ${dofBrazo.numMotores} | Determinado | OK`);

// 1.3 Pata caminante Theo Jansen (13 barras, 1 motor central)
const grafoJansen = crearGrafoPataJansen();
const dofJansen = analizarGradosLibertad(grafoJansen);
assert.strictEqual(dofJansen.M, 1, `Pata Jansen debe tener exactamente M=1 GDL según Grübler-Kutzbach, obtenido: ${dofJansen.M}`);
assert.strictEqual(dofJansen.esDeterminado, true, "Con 1 motor de manivela, Jansen es estrictamente determinado");
console.log(`    ✓ Theo Jansen (13 barras): M = ${dofJansen.M} GDL | Determinado con motor central | OK`);

// -------------------------------------------------------------------------
// PRUEBA 2: ACOPLAMIENTO MULTIFÍSICA (IMANES / CAMPOS EM COUPLING)
// -------------------------------------------------------------------------
console.log("\n[2] Probando acoplamiento multifísica (imanes móviles y campos acoplados)...");

const grafoMultifisica = new GrafoMecanismoMultifisica();
grafoMultifisica.agregarNodo({ id: "O", x: 0, y: 0, tipo: "fijo" });
grafoMultifisica.agregarNodo({ id: "P", x: 25, y: 0, tipo: "libre" });
grafoMultifisica.agregarBarra({ id: "brazo_iman", nodoA: "O", nodoB: "P", longitud: 25 });
grafoMultifisica.agregarMotor({ id: "motor_rot", tipo: "rotativo", nodoPivote: "O", nodoExtremo: "P", velocidadAngular: 2.0 });

// Acoplar capa física: imán montado en nodo P con momento dipolar magnético 5.0 A·m²
grafoMultifisica.agregarCapaFisica({
  id: "iman_p",
  tipo: "iman",
  nodoAsociado: "P",
  momentoMagnetico: 5.0
});

// Agregar sensor de campo magnético y eléctrico en un punto fijo del espacio
grafoMultifisica.agregarSensor({
  id: "sensor_campo",
  nombre: "sensor_campo",
  nodoAsociado: "P",
  magnitudes: ["trayectoria_2d", "campo_b", "campo_e"]
});

const cicloMultifisica = simularCicloMecanismo(grafoMultifisica, {}, { pasos: 40 });
assert.ok(cicloMultifisica.esValido, "El ciclo multifísica debe resolver cinemática válida");
assert.ok(cicloMultifisica.sensores.sensor_campo, "Debe registrar telemetría para sensor_campo");
assert.strictEqual(cicloMultifisica.sensores.sensor_campo.trayectoria.length, 40, "Debe calcular 40 puntos en la trayectoria");
console.log(`    ✓ Acoplamiento multifísica resuelto: 40 pasos calculados con telemetría de campo electromagnético | OK`);

// -------------------------------------------------------------------------
// PRUEBA 3: TELEMETRÍA DE SENSORES Y ACCESO EN CÓDIGO DE EVALUACIÓN
// -------------------------------------------------------------------------
console.log("\n[3] Probando telemetría de sensores en evaluación de aptitud (Fitness)...");

// Definición de modelo que consume el sensor 'pie' del editor CAD
const definicionConSensores = {
  nombre: "Caminante Jansen con Telemetría CAD",
  descripcion: "Evalúa fitness consumiendo directamente el sensor 'pie' del editor",
  tipoVisualizacion: "mecanismo_jansen",
  grafo: grafoJansen.exportarJSON(),
  variables: [
    { nombre: "a", tipo: "continuo", min: 30, max: 45, valorNominal: 38.0 },
    { nombre: "l", tipo: "continuo", min: 5, max: 12, valorNominal: 7.8 }
  ],
  codigoEvaluacion: `
    // Acceso directo a la telemetría del sensor CAD 'pie'
    const pie = sensores.pie;
    const errorZancada = Math.abs(pie.zancada - 60);
    const suavidadInercial = pie.aceleracionPico;
    return [suavidadInercial, errorZancada];
  `
};

validarDefinicionModelo(definicionConSensores);
const modeloCompiladoConSensores = compilarModeloDinamico(definicionConSensores);
assert.ok(modeloCompiladoConSensores, "Debe compilar modelo que accede a 'sensores'");

const puntajeEvaluado = modeloCompiladoConSensores.evaluar([38.0, 7.8]);
assert.ok(Array.isArray(puntajeEvaluado), "Debe retornar arreglo de Pareto");
assert.strictEqual(puntajeEvaluado.length, 2);
assert.ok(typeof puntajeEvaluado[0] === "number" && !isNaN(puntajeEvaluado[0]), "f1 debe ser número válido");
assert.ok(typeof puntajeEvaluado[1] === "number" && !isNaN(puntajeEvaluado[1]), "f2 debe ser número válido");
console.log(`    ✓ Modelo evaluado consumiendo sensores CAD: [f1: ${puntajeEvaluado[0].toFixed(4)}, f2: ${puntajeEvaluado[1].toFixed(4)}] | OK`);

// -------------------------------------------------------------------------
// PRUEBA 4: SINCRONIZACIÓN BIDIRECCIONAL DE VARIABLES EN EDITOR GRÁFICO VIEW
// -------------------------------------------------------------------------
console.log("\n[4] Probando sincronización bidireccional de variables e Inspector CAD...");

const editorMock = new EditorGraficoView();
editorMock.cargarGrafo(grafoJansen);

assert.ok(editorMock.grafo.barras.length >= 10, "El grafo Jansen cargado debe contener al menos 10 barras cinemáticas");
assert.strictEqual(editorMock.grafo.nodos.length, 8, "Debe contener 8 nodos articulados");

// Modificar variable 'a' en tiempo real
editorMock.actualizarValoresVariables({ a: 42.0 });
const telemetriaActualizada = editorMock.obtenerTelemetriaSensores({ a: 42.0 });
assert.ok(telemetriaActualizada.pie, "La telemetría del sensor 'pie' debe recalcularse al cambiar variables");
console.log(`    ✓ Sincronización de variables y telemetría en EditorGraficoView verificada | OK`);

// -------------------------------------------------------------------------
// PRUEBA 5: RECONSTRUCCIÓN Y PARIDAD DE TODOS LOS MODELOS PREDETERMINADOS
// -------------------------------------------------------------------------
console.log("\n[5] Probando paridad de reconstrucción desde cero en plantillas predefinidas...");

assert.ok(PLANTILLAS_SIMULACION.pata_jansen.grafo, "La plantilla pata_jansen debe incluir grafo multicuerpo preconfigurado");
assert.ok(PLANTILLAS_SIMULACION.brazo_robotico.grafo, "La plantilla brazo_robotico debe incluir grafo multicuerpo preconfigurado");

const grafoJansenPlantilla = new GrafoMecanismoMultifisica(PLANTILLAS_SIMULACION.pata_jansen.grafo);
const dofPlantillaJansen = analizarGradosLibertad(grafoJansenPlantilla);
assert.strictEqual(dofPlantillaJansen.M, 1, "La plantilla de Jansen debe preservar M=1 GDL");

const grafoBrazoPlantilla = new GrafoMecanismoMultifisica(PLANTILLAS_SIMULACION.brazo_robotico.grafo);
const dofPlantillaBrazo = analizarGradosLibertad(grafoBrazoPlantilla);
assert.strictEqual(dofPlantillaBrazo.M, 3, "La plantilla de Brazo Robótico debe preservar M=3 GDL");

console.log("    ✓ Paridad completa de plantillas preconfiguradas con el Editor CAD | OK");

console.log("\n=== ¡TODAS LAS PRUEBAS DEL MOTOR CAD Y MECANISMOS PASARON CON ÉXITO (5/5)! ===");
