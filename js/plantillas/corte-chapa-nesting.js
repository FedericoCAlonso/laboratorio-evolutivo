// Plantilla fiel del modelo corte-chapa-nesting (equivale a js/models/nesting.js).
export default {
  nombre: "Corte de Chapa y Anidado 2D (Nesting)",
  descripcion: "Optimiza la secuencia de colocación y la rotación angular de piezas a cortar de una chapa matriz para minimizar el desperdicio de material y retazos residuales.",
  tipoVisualizacion: "corte_chapa_nesting",
  variables: [
    { nombre: "prioridad1", etiqueta: "Prioridad pieza 1", tipo: "continuo", min: 0.0, max: 10.0 },
    { nombre: "prioridad2", etiqueta: "Prioridad pieza 2", tipo: "continuo", min: 0.0, max: 10.0 },
    { nombre: "prioridad3", etiqueta: "Prioridad pieza 3", tipo: "continuo", min: 0.0, max: 10.0 },
    { nombre: "prioridad4", etiqueta: "Prioridad pieza 4", tipo: "continuo", min: 0.0, max: 10.0 },
    { nombre: "prioridad5", etiqueta: "Prioridad pieza 5", tipo: "continuo", min: 0.0, max: 10.0 },
    { nombre: "prioridad6", etiqueta: "Prioridad pieza 6", tipo: "continuo", min: 0.0, max: 10.0 },
    { nombre: "rotacion1", etiqueta: "Rotación pieza 1", tipo: "continuo", min: 0.0, max: 1.0 },
    { nombre: "rotacion2", etiqueta: "Rotación pieza 2", tipo: "continuo", min: 0.0, max: 1.0 },
    { nombre: "rotacion3", etiqueta: "Rotación pieza 3", tipo: "continuo", min: 0.0, max: 1.0 },
    { nombre: "rotacion4", etiqueta: "Rotación pieza 4", tipo: "continuo", min: 0.0, max: 1.0 },
    { nombre: "rotacion5", etiqueta: "Rotación pieza 5", tipo: "continuo", min: 0.0, max: 1.0 },
    { nombre: "rotacion6", etiqueta: "Rotación pieza 6", tipo: "continuo", min: 0.0, max: 1.0 }
  ],
  codigoEvaluacion: `// Chapa matriz y piezas rectangulares estándar (valores por defecto del modelo nativo)
const anchoChapa = 500.0, altoChapa = 350.0;
const piezas = [
  { id: 1, w: 220, h: 140, color: "#38bdf8" },
  { id: 2, w: 180, h: 120, color: "#34d399" },
  { id: 3, w: 140, h: 90, color: "#f59e0b" },
  { id: 4, w: 160, h: 110, color: "#ec4899" },
  { id: 5, w: 110, h: 80, color: "#818cf8" },
  { id: 6, w: 90, h: 60, color: "#a78bfa" }
];
const prioridades = [vars.prioridad1, vars.prioridad2, vars.prioridad3, vars.prioridad4, vars.prioridad5, vars.prioridad6];
const rotaciones = [vars.rotacion1, vars.rotacion2, vars.rotacion3, vars.rotacion4, vars.rotacion5, vars.rotacion6];

// Aplica rotación (> 0.5 gira 90°) y ordena por prioridad decreciente
const preparadas = piezas.map((p, i) => {
  const rotar = rotaciones[i] > 0.5;
  return { id: p.id, w: rotar ? p.h : p.w, h: rotar ? p.w : p.h, prioridad: prioridades[i], color: p.color };
}).sort((a, b) => b.prioridad - a.prioridad);

// Anidado 2D con el motor topológico y ancho máximo alcanzado
const nido = topologia.resolverNesting2D(anchoChapa, altoChapa, preparadas);
let anchoUtilizado = 0.0;
nido.piezasColocadas.forEach(pz => { if (pz.x + pz.w > anchoUtilizado) anchoUtilizado = pz.x + pz.w; });

// Objetivo 1: desperdicio + penalización por piezas faltantes; objetivo 2: ancho usado
const objDesperdicio = nido.porcentajeDesperdicio + nido.piezasNoColocadas * 65.0;
return [Math.max(1.0, objDesperdicio), Math.max(50.0, anchoUtilizado)];`
};
