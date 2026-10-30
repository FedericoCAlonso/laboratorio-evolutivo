// Plantilla fiel del modelo balanceo-fases-trifasico (genes categóricos 0=R, 1=S, 2=T).
export default {
  nombre: "Balanceo de Fases Trifásico (R, S, T)",
  descripcion: "Distribuye cargas monofásicas entre las fases R, S y T para minimizar el desbalance de corriente y respetar fases obligatorias.",
  tipoVisualizacion: "distribucion_recursos",
  variables: [
    { nombre: "fase1", etiqueta: "fase1: Fase del circuito 1 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase2", etiqueta: "fase2: Fase del circuito 2 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase3", etiqueta: "fase3: Fase del circuito 3 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase4", etiqueta: "fase4: Fase del circuito 4 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase5", etiqueta: "fase5: Fase del circuito 5 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase6", etiqueta: "fase6: Fase del circuito 6 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase7", etiqueta: "fase7: Fase del circuito 7 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 },
    { nombre: "fase8", etiqueta: "fase8: Fase del circuito 8 (0=R, 1=S, 2=T)", tipo: "categorico", min: 0, max: 2 }
  ],
  codigoEvaluacion: `// Circuitos por defecto (corriente en A y fase obligatoria opcional), uno por gen
const circuitos = [
  { corriente: 6.0, faseFija: "" }, { corriente: 5.5, faseFija: "" },
  { corriente: 12.0, faseFija: "" }, { corriente: 16.0, faseFija: "" },
  { corriente: 22.0, faseFija: "" }, { corriente: 18.0, faseFija: "" },
  { corriente: 9.5, faseFija: "" }, { corriente: 9.5, faseFija: "" }
];
const penalizacionBase = 500;
const genoma = [vars.fase1, vars.fase2, vars.fase3, vars.fase4, vars.fase5, vars.fase6, vars.fase7, vars.fase8];
const nombreFases = ["R", "S", "T"];
const sumasFases = [0, 0, 0];
let penalizacionTotal = 0;

// Suma de corriente por fase y penalización si se viola la fase obligatoria
for (let i = 0; i < circuitos.length; i++) {
  const fase = Math.round(genoma[i]);
  sumasFases[fase] += Number(circuitos[i].corriente) || 0;
  const obligatoria = circuitos[i].faseFija;
  if (obligatoria && obligatoria !== "" && nombreFases[fase] !== obligatoria) penalizacionTotal += penalizacionBase;
}

// Desbalance (máx - mín) más penalizaciones
const desbalance = Math.max(...sumasFases) - Math.min(...sumasFases);
return desbalance + penalizacionTotal;`
};
