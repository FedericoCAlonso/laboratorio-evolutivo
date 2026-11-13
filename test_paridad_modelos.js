// Paridad y Conformidad del Catálogo JSON:
// Verifica que el 100% de los modelos de catalogo/*.json sean válidos, compilen limpiamente
// y evalúen de forma matemáticamente determinista y estable.
// Uso: node test_paridad_modelos.js [id ...]
import fs from "fs";
import path from "path";
import { compilarModeloDinamico } from "./js/builder.js";
import { CATALOGO_PREDEFINIDO, obtenerModeloPorId } from "./catalogo/index.js";

const filtro = process.argv.slice(2);
const sembrar = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const cerca = (a, b) => Math.abs(a - b) <= 1e-9 * (1 + Math.abs(a));
let fallos = 0;

for (const def of CATALOGO_PREDEFINIDO.filter(d => !filtro.length || filtro.includes(d.id))) {
  const errores = [];
  const jsonPath = path.join("catalogo", `${def.id}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.log(`✗ ${def.id}: archivo JSON no encontrado en ${jsonPath}`);
    fallos++;
    continue;
  }

  // Validación de metadatos requeridos
  if (!def.nombre || typeof def.nombre !== "string") errores.push("falta nombre");
  if (!def.tipoVisualizacion) errores.push("falta tipoVisualizacion");
  if (!def.categoria) errores.push("falta categoria");
  if (!def.dificultad) errores.push("falta dificultad");
  if (!Array.isArray(def.tags) || def.tags.length === 0) errores.push("faltan tags");
  if (!Array.isArray(def.variables) || def.variables.length === 0) errores.push("faltan variables");
  if (!def.codigoEvaluacion || /Definición basada en/.test(def.codigoEvaluacion)) errores.push("código de evaluación ausente o genérico");

  def.variables.forEach((v, i) => {
    if (!v.nombre || /^var\d+$/.test(v.nombre)) errores.push(`variable ${i} tiene nombre inválido o genérico: ${v.nombre}`);
    if (typeof v.min !== "number" || typeof v.max !== "number" || v.min >= v.max) errores.push(`variable ${v.nombre} tiene límites incorrectos [${v.min}, ${v.max}]`);
  });

  try {
    const comp = compilarModeloDinamico(def);
    const modRegistrado = obtenerModeloPorId(def.id);
    const genes = comp.crearGenoma();

    if (def.variables.length !== genes.length) {
      errores.push(`variables ${def.variables.length} != genes ${genes.length}`);
    }

    const rnd = sembrar(42);
    for (let t = 0; t < 25 && !errores.length; t++) {
      const g = genes.map(x => t === 0 && x.valorNominal !== undefined
        ? x.valorNominal
        : ((x.tipo === "entero" || x.tipo === "categorico")
          ? Math.round(x.min + rnd() * (x.max - x.min))
          : x.min + rnd() * (x.max - x.min)));

      const rawA = modRegistrado.evaluar(g, undefined, sembrar(7));
      const rawB = comp.evaluar(g, undefined, sembrar(7));
      const esObjA = rawA && typeof rawA === "object" && !Array.isArray(rawA) && rawA.fitness !== undefined;
      const esObjB = rawB && typeof rawB === "object" && !Array.isArray(rawB) && rawB.fitness !== undefined;
      const a = [].concat(esObjA ? rawA.fitness : rawA);
      const b = [].concat(esObjB ? rawB.fitness : rawB);
      const vA = esObjA ? Number(rawA.violacion || 0) : 0;
      const vB = esObjB ? Number(rawB.violacion || 0) : 0;

      if (a.some(v => typeof v !== "number" || isNaN(v)) || isNaN(vA)) {
        errores.push(`evaluación produjo NaN en caso ${t}: ${JSON.stringify(rawA)}`);
      }
      if (a.length !== b.length || !a.every((x, i) => cerca(x, b[i])) || !cerca(vA, vB)) {
        errores.push(`discrepancia en caso ${t}: registrado=${JSON.stringify(rawA)} compilado=${JSON.stringify(rawB)}`);
      }
    }
  } catch (e) {
    errores.push("error al compilar o evaluar: " + e.message);
  }

  if (errores.length) {
    fallos++;
    console.log(`✗ ${def.id}:\n   - ${errores.slice(0, 4).join("\n   - ")}`);
  } else {
    console.log(`✓ ${def.id}: ${def.variables.length} variables, metadatos y evaluación 100% conformes`);
  }
}

process.exit(fallos ? 1 : 0);
