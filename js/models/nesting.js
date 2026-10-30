// =========================================================================
// MÓDULO: MODELO DE CORTE DE CHAPA Y ANIDADO 2D (NESTING / CUTTING STOCK)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

import { MotorFuncionalTopologico } from "../engines/topologia.js";

// Conjunto de 6 piezas rectangulares estándar a cortar de la chapa matriz
export const PIEZAS_DEFECTO = [
  { id: 1, w: 220, h: 140, color: "#38bdf8" }, // Pieza A (Panel grande)
  { id: 2, w: 180, h: 120, color: "#34d399" }, // Pieza B (Soporte)
  { id: 3, w: 140, h: 90,  color: "#f59e0b" }, // Pieza C (Refuerzo)
  { id: 4, w: 160, h: 110, color: "#ec4899" }, // Pieza D (Brida)
  { id: 5, w: 110, h: 80,  color: "#818cf8" }, // Pieza E (Tapa)
  { id: 6, w: 90,  h: 60,  color: "#a78bfa" }  // Pieza F (Guía)
];

// Simula la colocación espacial y calcula el desperdicio porcentual de corte en la chapa
export function simularCorteChapaNesting(genoma, entrada) {
  const anchoChapa = Number(entrada?.anchoChapaMm !== undefined ? entrada.anchoChapaMm : 500.0);
  const altoChapa = Number(entrada?.altoChapaMm !== undefined ? entrada.altoChapaMm : 350.0);

  const numPiezas = PIEZAS_DEFECTO.length;

  // Genoma de 12 genes:
  // [0..5]: Prioridades de orden de colocación (peso continuo de ordenamiento)
  // [6..11]: Umbrales de decisión de rotación a 90° (si > 0.5 se rota)
  const prioridades = genoma.slice(0, numPiezas);
  const rotaciones = genoma.slice(numPiezas, numPiezas * 2);

  // Asocia cada pieza con su prioridad y orientación dada por el genoma
  const piezasPreparadas = PIEZAS_DEFECTO.map((p, idx) => {
    const rotar = (rotaciones[idx] !== undefined ? rotaciones[idx] : 0.0) > 0.5;
    return {
      id: p.id,
      w: rotar ? p.h : p.w,
      h: rotar ? p.w : p.h,
      prioridad: prioridades[idx] !== undefined ? prioridades[idx] : idx,
      color: p.color
    };
  }).sort((a, b) => b.prioridad - a.prioridad);

  // Ejecuta la heurística de anidado 2D del motor topológico
  const resNesting = MotorFuncionalTopologico.resolverNesting2D(anchoChapa, altoChapa, piezasPreparadas);

  // Calcula la envolvente real ocupada (ancho y alto máximo alcanzado por las piezas)
  let maxAlcanzadoX = 0.0;
  let maxAlcanzadoY = 0.0;

  resNesting.piezasColocadas.forEach((pz) => {
    const bordeDer = pz.x + pz.w;
    const bordeInf = pz.y + pz.h;
    if (bordeDer > maxAlcanzadoX) maxAlcanzadoX = bordeDer;
    if (bordeInf > maxAlcanzadoY) maxAlcanzadoY = bordeInf;
  });

  return {
    anchoChapa,
    altoChapa,
    piezasColocadas: resNesting.piezasColocadas,
    piezasNoColocadas: resNesting.piezasNoColocadas,
    porcentajeAprovechamiento: resNesting.porcentajeAprovechamiento,
    porcentajeDesperdicio: resNesting.porcentajeDesperdicio,
    areaUtilizada: resNesting.areaUtilizada,
    areaTotalChapa: resNesting.areaTotalChapa,
    maxAlcanzadoX,
    maxAlcanzadoY,
    anchoUtilizadoMm: maxAlcanzadoX,
    todasColocadas: resNesting.piezasNoColocadas === 0
  };
}

// Objeto de definición del modelo para el motor evolutivo
export const ModeloCorteChapaNesting = {
  id: "corte-chapa-nesting",
  nombre: "Corte de Chapa y Anidado 2D (Nesting)",
  descripcion: "Optimiza la secuencia de colocación y la rotación angular de piezas a cortar de una chapa matriz para minimizar el desperdicio de material y retazos residuales.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Desperdicio de Chapa (%)", "Longitud de Chapa Utilizada (mm)"],

  // Parámetros de la chapa de fabricación
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Desperdicio mínimo vs. Longitud de chapa)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Desperdicio ponderado)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "anchoChapaMm", etiqueta: "Ancho Total de Chapa (mm)", tipo: "numero", min: 350, max: 800, paso: 50, valorDefecto: 500 },
    { clave: "altoChapaMm", etiqueta: "Largo/Alto de Chapa (mm)", tipo: "numero", min: 250, max: 600, paso: 50, valorDefecto: 350 }
  ],

  // 12 genes continuos: 6 prioridades de ordenamiento [0, 10] y 6 flags de rotación [0, 1]
  crearGenoma() {
    return [
      { tipo: "continuo", min: 0.0, max: 10.0 }, // Prioridad pieza 1
      { tipo: "continuo", min: 0.0, max: 10.0 }, // Prioridad pieza 2
      { tipo: "continuo", min: 0.0, max: 10.0 }, // Prioridad pieza 3
      { tipo: "continuo", min: 0.0, max: 10.0 }, // Prioridad pieza 4
      { tipo: "continuo", min: 0.0, max: 10.0 }, // Prioridad pieza 5
      { tipo: "continuo", min: 0.0, max: 10.0 }, // Prioridad pieza 6
      { tipo: "continuo", min: 0.0, max: 1.0 },  // Rotación pieza 1
      { tipo: "continuo", min: 0.0, max: 1.0 },  // Rotación pieza 2
      { tipo: "continuo", min: 0.0, max: 1.0 },  // Rotación pieza 3
      { tipo: "continuo", min: 0.0, max: 1.0 },  // Rotación pieza 4
      { tipo: "continuo", min: 0.0, max: 1.0 },  // Rotación pieza 5
      { tipo: "continuo", min: 0.0, max: 1.0 }   // Rotación pieza 6
    ];
  },

  // Evalúa el porcentaje de desperdicio y penaliza fuertemente piezas no colocadas
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularCorteChapaNesting(genoma, entrada);

    // Objetivo 1: Minimizar desperdicio de chapa + fuerte penalización si una pieza no entra
    const penalizacionFaltantes = sim.piezasNoColocadas * 65.0;
    const objDesperdicio = sim.porcentajeDesperdicio + penalizacionFaltantes;

    // Objetivo 2: Minimizar el ancho de avance de corte en X (para dejar el retazo más limpio)
    const objAvanceX = sim.anchoUtilizadoMm;

    if (esMulti) {
      return [Math.max(1.0, objDesperdicio), Math.max(50.0, objAvanceX)];
    }

    return objDesperdicio * 0.7 + (objAvanceX / sim.anchoChapa) * 30.0;
  },

  // Resumen legible del aprovechamiento de material en el nido de corte
  describir(genoma, entrada) {
    const sim = simularCorteChapaNesting(genoma, entrada);
    const estado = sim.todasColocadas ? "✓ TODAS COLOCADAS" : `✕ FALTAN ${sim.piezasNoColocadas} PIEZAS`;
    return `✂️ Nesting 2D: Aprovechamiento ${sim.porcentajeAprovechamiento.toFixed(1)}% | Desperdicio: ${sim.porcentajeDesperdicio.toFixed(1)}% | ${estado} | Avance: ${sim.anchoUtilizadoMm.toFixed(0)} mm`;
  }
};

export default ModeloCorteChapaNesting;
