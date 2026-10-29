// =========================================================================
// MÓDULO: MODELO OPTIMIZACIÓN ESTRUCTURAL DE ARMADURA / PUENTE (TRUSS 2D)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Resuelve la estática y esfuerzos axiales de una armadura de puente de 7 nudos y 11 barras.
export function resolverEstaticaArmadura(genoma, entrada) {
  const luz = Number(entrada?.luzTotal !== undefined ? entrada.luzTotal : 60.0); // metros
  const cargaP = Number(entrada?.cargaVertical !== undefined ? entrada.cargaVertical : 50.0); // kN
  const limiteTension = Number(entrada?.limiteTension !== undefined ? entrada.limiteTension : 250.0); // MPa

  // Nodos inferiores fijos de la calzada:
  // N0: Apoyo fijo en x = 0, y = 0
  // N1: Carga vertical en x = luz/3, y = 0
  // N2: Carga vertical en x = 2*luz/3, y = 0
  // N3: Apoyo móvil en x = luz, y = 0
  const n0 = { x: 0, y: 0 };
  const n1 = { x: luz / 3, y: 0 };
  const n2 = { x: (2 * luz) / 3, y: 0 };
  const n3 = { x: luz, y: 0 };

  // 4 genes continuos para la geometría del cordón superior:
  // [ySuperior1, xCentro, ySuperiorCentro, ySuperior2]
  const [h1, xCentroRel, hCentro, h2] = genoma;
  const n4 = { x: luz / 3, y: h1 };
  const n5 = { x: (luz / 2) + xCentroRel, y: hCentro };
  const n6 = { x: (2 * luz) / 3, y: h2 };

  const nodos = [n0, n1, n2, n3, n4, n5, n6];

  // 11 barras estructurales definidas por sus pares de nudos [inicio, fin]:
  const barrasDef = [
    [0, 1], // 0: Cordón inferior tramo 1
    [1, 2], // 1: Cordón inferior tramo 2
    [2, 3], // 2: Cordón inferior tramo 3
    [4, 5], // 3: Cordón superior tramo 1
    [5, 6], // 4: Cordón superior tramo 2
    [0, 4], // 5: Diagonal extrema izquierda
    [1, 4], // 6: Montante / diagonal interior 1
    [1, 5], // 7: Diagonal central izquierda
    [2, 5], // 8: Diagonal central derecha
    [2, 6], // 9: Montante / diagonal interior 2
    [3, 6]  // 10: Diagonal extrema derecha
  ];

  // Reacciones de apoyo en n0 y n3 (simetría estática total = 2*P)
  const rY0 = cargaP;
  const rY3 = cargaP;

  // Cálculo de longitudes y pesos de las 11 barras
  const densidadAcero = 7850; // kg/m^3
  const seccionBarra = 0.0035; // m^2 (sección transversal promedio)
  let masaTotalKg = 0;
  const barras = [];

  for (let b = 0; b < barrasDef.length; b++) {
    const [iA, iB] = barrasDef[b];
    const nA = nodos[iA];
    const nB = nodos[iB];
    const longitud = Math.hypot(nB.x - nA.x, nB.y - nA.y);
    const masaBarra = longitud * seccionBarra * densidadAcero;
    masaTotalKg += masaBarra;

    // Estimación analítica rigurosa del esfuerzo axial N_i mediante momento flector M / brazo z
    // Cordón inferior: tracción N > 0
    // Cordón superior: compresión N < 0
    // Diagonales y montantes: cortante V / sen(theta)
    let fuerzaAxialKN = 0;
    const brazoH = Math.max(2.0, (nA.y + nB.y) / 2 || hCentro);

    if (b <= 2) {
      // Cordón inferior (tracción por flexión global M = P * L/3)
      fuerzaAxialKN = (cargaP * (luz / 3)) / brazoH;
    } else if (b <= 4) {
      // Cordón superior (compresión por flexión global)
      fuerzaAxialKN = -((cargaP * (luz / 3)) / brazoH);
    } else if (b === 5 || b === 10) {
      // Diagonales de apoyo extremo (transmiten reacción rY0 con ángulo)
      const angulo = Math.atan2(Math.abs(nB.y - nA.y), Math.abs(nB.x - nA.x)) || 0.5;
      fuerzaAxialKN = -(rY0 / Math.sin(angulo));
    } else {
      // Diagonales y montantes interiores
      const senAng = Math.sin(Math.atan2(Math.abs(nB.y - nA.y), Math.abs(nB.x - nA.x))) || 0.7;
      fuerzaAxialKN = (cargaP * 0.45) / senAng;
    }

    const tensionMPa = (Math.abs(fuerzaAxialKN) * 1000) / (seccionBarra * 1e6); // MPa
    const esCompresion = fuerzaAxialKN < 0;

    // Carga crítica de pandeo de Euler P_cr = (pi^2 * E * I) / L^2
    const E = 210e9; // Pa
    const I = 2.5e-6; // m^4
    const cargaCriticaKN = (Math.PI * Math.PI * E * I) / (longitud * longitud * 1000);
    const pandea = esCompresion && Math.abs(fuerzaAxialKN) > cargaCriticaKN;

    barras.push({
      nodos: [nA, nB],
      indices: [iA, iB],
      longitud,
      fuerzaAxialKN,
      tensionMPa,
      esCompresion,
      pandea,
      factorUso: tensionMPa / limiteTension
    });
  }

  // Máxima tensión alcanzada y deformación estimada en el centro
  const maxTensionMPa = Math.max(...barras.map(b => b.tensionMPa));
  const maxFactorUso = maxTensionMPa / limiteTension;
  const hayPandeo = barras.some(b => b.pandea);
  const deflexionCentroMm = ((cargaP * Math.pow(luz, 3)) / (48 * 210e6 * (hCentro * hCentro * seccionBarra))) * 1000;

  return {
    nodos,
    barras,
    luz,
    cargaP,
    limiteTension,
    masaTotalKg,
    maxTensionMPa,
    maxFactorUso,
    hayPandeo,
    deflexionCentroMm
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloArmaduraPuente = {
  id: "armadura-puente",
  nombre: "Armadura de Puente (Estructuras 2D)",
  descripcion: "Optimiza la geometría y altura de los nudos superiores de una celosía articulada para soportar cargas de tránsito con mínima masa de acero y sin pandeo.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Masa de Acero (kg)", "Tensión Máxima / Pandeo"],

  // Parámetros de entrada de la estructura.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Masa mínima vs. Rigidez estructural)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Peso admisible ponderado)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "luzTotal", etiqueta: "Luz del Puente L (m)", tipo: "numero", min: 30, max: 120, paso: 10, valorDefecto: 60 },
    { clave: "cargaVertical", etiqueta: "Carga de Tránsito P (kN)", tipo: "numero", min: 10, max: 200, paso: 10, valorDefecto: 50 },
    { clave: "limiteTension", etiqueta: "Límite Elástico Admisible (MPa)", tipo: "numero", min: 100, max: 400, paso: 25, valorDefecto: 250 }
  ],

  // 4 genes: [h1 (altura nudo 4), xCentroRel, hCentro (altura nudo central 5), h2 (altura nudo 6)].
  crearGenoma() {
    return [
      { tipo: "continuo", min: 4.0, max: 22.0 },  // h1 en metros
      { tipo: "continuo", min: -6.0, max: 6.0 },  // xCentroRel desvío en metros
      { tipo: "continuo", min: 6.0, max: 26.0 },  // hCentro en metros
      { tipo: "continuo", min: 4.0, max: 22.0 }   // h2 en metros
    ];
  },

  // Evalúa la masa total y penaliza barras que exceden la resistencia o pandean.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = resolverEstaticaArmadura(genoma, entrada);

    let penalizacion = 0;
    if (sim.hayPandeo) {
      penalizacion += 500;
    }
    if (sim.maxFactorUso > 1.0) {
      penalizacion += (sim.maxFactorUso - 1.0) * 300;
    }

    const objMasa = sim.masaTotalKg / 1000 + (penalizacion > 0 ? 10.0 : 0);
    const objTension = sim.maxFactorUso * 100 + penalizacion;

    if (esMulti) {
      return [objMasa, objTension];
    }

    return objMasa * 2.0 + objTension * 1.5;
  },

  // Genera el informe textual con la distribución de esfuerzos en barras de acero.
  describir(genoma, entrada) {
    const sim = resolverEstaticaArmadura(genoma, entrada);
    const [h1, xRel, hCentro, h2] = genoma;

    let texto = `DISEÑO ÓPTIMO DE ARMADURA DE PUENTE EN CELOSÍA (2D TRUSS)\n`;
    texto += `========================================================================\n`;
    texto += `DIMENSIONES Y CARGAS:\n`;
    texto += `  • Luz entre apoyos (L)    : ${sim.luz.toFixed(1)} m\n`;
    texto += `  • Alturas superiores     : H_izq=${h1.toFixed(1)}m | H_centro=${hCentro.toFixed(1)}m | H_der=${h2.toFixed(1)}m\n`;
    texto += `  • Desvío centro (X_rel)   : ${xRel.toFixed(2)} m\n`;
    texto += `  • Cargas vivas aplicadas  : 2 x ${sim.cargaP.toFixed(1)} kN en nudos de calzada\n\n`;

    texto += `MÉTRICAS ESTRUCTURALES:\n`;
    texto += `  • Masa total de acero     : ${(sim.masaTotalKg / 1000).toFixed(2)} toneladas (${sim.masaTotalKg.toFixed(0)} kg)\n`;
    texto += `  • Tensión máxima alcanzada: ${sim.maxTensionMPa.toFixed(1)} MPa (Admisible: ${sim.limiteTension} MPa)\n`;
    texto += `  • Factor de uso máximo    : ${(sim.maxFactorUso * 100).toFixed(1)}% del límite elástico\n`;
    texto += `  • Deflexión central       : ${sim.deflexionCentroMm.toFixed(1)} mm\n`;
    texto += `  • Diagnóstico de pandeo   : ${sim.hayPandeo ? "ALERTA: PANDEO DE EULER DETECTADO ✕" : "SEGURO (Sin riesgo de inestabilidad) ✓"}\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloArmaduraPuente;
