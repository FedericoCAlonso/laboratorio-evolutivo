// Paridad: la plantilla editable de cada modelo debe reproducir exactamente el modelo nativo.
// Uso: node test_paridad_modelos.js [id ...]
import { PLANTILLAS_FIELES } from "./js/plantillas/index.js";
import { compilarModeloDinamico } from "./js/builder.js";
import { MODELOS } from "./js/models/index.js";

const filtro = process.argv.slice(2);
const sembrar = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const cerca = (a, b) => Math.abs(a - b) <= 1e-9 * (1 + Math.abs(a));
let fallos = 0;

for (const m of MODELOS.filter(m => !m.esDinamico && (!filtro.length || filtro.includes(m.id)))) {
  const p = PLANTILLAS_FIELES[m.id];
  const errores = [];
  if (!p) { console.log(`✗ ${m.id}: sin plantilla fiel`); fallos++; continue; }
  const genes = m.crearGenoma();
  if (p.variables.length !== genes.length) errores.push(`variables ${p.variables.length} != genes ${genes.length}`);
  genes.forEach((g, i) => {
    const v = p.variables[i] || {};
    for (const k of ["nombre", "tipo", "min", "max"]) if (v[k] !== g[k]) errores.push(`gen ${i} ${k}: ${v[k]} != ${g[k]}`);
    if (/^var\d+$/.test(v.nombre || "")) errores.push(`gen ${i} nombre genérico`);
  });
  if (!p.codigoEvaluacion || /Definición basada en/.test(p.codigoEvaluacion)) errores.push("código genérico");
  try {
    const comp = compilarModeloDinamico({ id: m.id, ...p });
    const rnd = sembrar(42);
    for (let t = 0; t < 25 && !errores.length; t++) {
      const g = genes.map(x => t === 0 && x.valorNominal !== undefined ? x.valorNominal
        : ((x.tipo === "entero" || x.tipo === "categorico") ? Math.round(x.min + rnd() * (x.max - x.min)) : x.min + rnd() * (x.max - x.min)));
      const a = [].concat(m.evaluar(g, undefined, sembrar(7)));
      const b = [].concat(comp.evaluar(g, undefined, sembrar(7)));
      if (a.length !== b.length || !a.every((x, i) => cerca(x, b[i]))) errores.push(`evaluación distinta en caso ${t}: nativo=${JSON.stringify(a)} editor=${JSON.stringify(b)}`);
    }
  } catch (e) { errores.push("error: " + e.message); }
  if (errores.length) { fallos++; console.log(`✗ ${m.id}:\n   - ${errores.slice(0, 4).join("\n   - ")}`); }
  else console.log(`✓ ${m.id}: ${genes.length} variables y evaluación idénticas al nativo`);
}
process.exit(fallos ? 1 : 0);
