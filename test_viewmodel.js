// =========================================================================
// TEST DE INTEGRACIÓN: VERIFICACIÓN DEL VIEWMODEL
// =========================================================================

// Mock de localStorage para entorno Node.js
const storageMap = new Map();
global.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

import { AppViewModel } from "./js/viewmodels/app-viewmodel.js";

console.log("=== INICIANDO PRUEBAS DEL APP VIEWMODEL ===");

const vm = new AppViewModel();

// 1. Verificación de inicialización y modelo inicial
console.log("\n[1] Verificando inicialización de estado...");
if (!vm.modeloActual || vm.modeloActual.id !== "brazo-robotico") {
  throw new Error(`Modelo inicial inesperado: ${vm.modeloActual?.id}`);
}
if (vm.estadoSimulacion !== "DETENIDO") {
  throw new Error(`Estado inicial incorrecto: ${vm.estadoSimulacion}`);
}
console.log(`    ✓ Modelo activo: ${vm.modeloActual.nombre} | Estado: ${vm.estadoSimulacion}`);

// 2. Verificación de suscripción a eventos
console.log("\n[2] Verificando sistema de eventos reactivos...");
let eventosRecibidos = [];
vm.on("modeloCambiado", ({ modelo }) => eventosRecibidos.push(`modelo:${modelo.id}`));
vm.on("temaCambiado", ({ modo, acento }) => eventosRecibidos.push(`tema:${modo}-${acento}`));
vm.on("presetsActualizados", (lista) => eventosRecibidos.push(`presets:${lista.length}`));

vm.seleccionarModelo("brazo-robotico");
vm.cambiarModoTema("dark");
vm.cambiarAcentoTema("emerald");

if (!eventosRecibidos.includes("modelo:brazo-robotico")) {
  throw new Error("Evento modeloCambiado no emitido");
}
if (!eventosRecibidos.includes("tema:dark-emerald")) {
  throw new Error("Evento temaCambiado no emitido");
}
console.log("    ✓ Eventos modeloCambiado y temaCambiado recibidos correctamente");

// 3. Verificación de Presets
console.log("\n[3] Verificando operaciones de Presets...");
const presetGuardado = vm.guardarPreset("Test Escenario Brazo");
if (!presetGuardado.id || presetGuardado.modeloId !== "brazo-robotico") {
  throw new Error("Error guardando preset.");
}
const listaPresets = vm.obtenerPresets();
if (listaPresets.length !== 1) {
  throw new Error("Error en cantidad de presets recuperados.");
}
console.log(`    ✓ Preset guardado: '${presetGuardado.nombre}' (Total: ${listaPresets.length})`);

vm.seleccionarModelo("cohete-landing");
if (vm.modeloActual.id !== "cohete-landing") {
  throw new Error("Fallo al cambiar a cohete-landing.");
}
vm.aplicarPreset(presetGuardado.id);
if (vm.modeloActual.id !== "brazo-robotico") {
  throw new Error("Fallo al restaurar modelo desde preset.");
}
console.log(`    ✓ Preset aplicado exitosamente: restauró modelo '${vm.modeloActual.nombre}'`);

vm.eliminarPreset(presetGuardado.id);
if (vm.obtenerPresets().length !== 0) {
  throw new Error("Fallo al eliminar preset.");
}
console.log("    ✓ Preset eliminado correctamente");

// 4. Verificación de modelos dinámicos y clonación
console.log("\n[4] Verificando ciclo de vida de modelos dinámicos...");
const defNueva = {
  nombre: "Función Ackley 2D",
  descripcion: "Benchmark de optimización no lineal",
  variables: [
    { nombre: "x1", tipo: "continuo", min: -5, max: 5 },
    { nombre: "x2", tipo: "continuo", min: -5, max: 5 }
  ],
  codigoEvaluacion: "return -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (vars.x1*vars.x1 + vars.x2*vars.x2))) + 20;"
};
const modeloCreado = vm.guardarModeloDinamico(defNueva);
if (vm.modeloActual.id !== modeloCreado.id) {
  throw new Error("El modelo dinámico creado no fue seleccionado como activo.");
}
console.log(`    ✓ Modelo dinámico creado y activado: '${modeloCreado.nombre}' (${modeloCreado.id})`);

// Clonar modelo
const modeloClon = vm.clonarModelo(modeloCreado.id);
if (!modeloClon.nombre.includes("Copia")) {
  throw new Error("Error al clonar modelo dinámico.");
}
console.log(`    ✓ Modelo dinámico clonado: '${modeloClon.nombre}'`);

// Renombrar modelo
const modeloRenombrado = vm.renombrarModelo(modeloClon.id, "Ackley Modificado", "Nueva descripción");
if (modeloRenombrado.nombre !== "Ackley Modificado") {
  throw new Error("Error al renombrar modelo dinámico.");
}
console.log(`    ✓ Modelo renombrado: '${modeloRenombrado.nombre}'`);

// Eliminar modelo dinámico
vm.eliminarModelo(modeloRenombrado.id);
console.log("    ✓ Modelo dinámico eliminado correctamente");

// 5. Verificación de Exportación e Importación JSON
console.log("\n[5] Verificando exportación e importación JSON...");
const exportacion = vm.generarExportacionSimulacion();
const jsonStr = JSON.stringify(exportacion);
const resultadoImport = vm.importarDesdeJSON(jsonStr);
if (!resultadoImport) {
  throw new Error("Fallo en la importación de JSON.");
}
console.log(`    ✓ Exportación e importación completada: tipo '${resultadoImport.tipo}'`);

// 6. Verificación de Resumen de Genoma para M3 Chips y Sincronización Bidireccional
console.log("\n[6] Verificando resumen de genoma M3 y sincronización de configMotor...");
vm.seleccionarModelo("brazo-robotico");
const resumenChips = vm.obtenerResumenGenomaActual();
if (!Array.isArray(resumenChips) || resumenChips.length !== 3 || resumenChips[0].nombre !== "theta1") {
  throw new Error("obtenerResumenGenomaActual() no devolvió los 3 genes estructurados del Brazo Robótico.");
}
vm.actualizarConfigMotor({ tamPoblacion: 120, probMutacion: 0.08, torneoK: 5, replicasRuido: 4 });
if (vm.configMotor.tamanoPoblacion !== 120 || vm.configMotor.tasaMutacion !== 0.08 || vm.configMotor.tamanoTorneo !== 5 || vm.configMotor.nReplicasRuido !== 4) {
  throw new Error("actualizarConfigMotor() no sincronizó los alias requeridos por Motor/Worker.");
}
let inicializadoEmitido = false;
vm.on("estado:inicializado", ({ configMotor }) => {
  if (configMotor && configMotor.tamPoblacion === 120) inicializadoEmitido = true;
});
vm.restaurarEstadoInicial();
if (!inicializadoEmitido) {
  throw new Error("restaurarEstadoInicial() no emitió estado:inicializado con configMotor.");
}
console.log(`    ✓ Resumen de genoma (${resumenChips.length} chips) y estado:inicializado verificados | OK`);

console.log("\n=== TODAS LAS PRUEBAS DEL VIEWMODEL PASARON EXITOSAMENTE (6/6) ===");
