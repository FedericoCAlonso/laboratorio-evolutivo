// =========================================================================
// MÓDULO: MODELO CAMPO DE POTENCIAL 2D Y DEFLEXIÓN DE PARTÍCULAS
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Calcula el potencial eléctrico escalar V(x, y) en un punto dado según la superposición de cargas fijas y deflectores.
export function calcularPotencialPunto(x, y, electrodos, cargasFijas) {
  let v = 0;
  const eps = 1.5; // Factor de suavizado para evitar singularidades en r = 0

  // Contribución de cargas fijas de borde y emisor/colector
  for (let i = 0; i < cargasFijas.length; i++) {
    const c = cargasFijas[i];
    const d = Math.hypot(x - c.x, y - c.y);
    v += (c.q * 100) / Math.sqrt(d * d + eps * eps);
  }

  // Contribución de los electrodos deflectores móviles del genoma
  for (let i = 0; i < electrodos.length; i++) {
    const e = electrodos[i];
    const d = Math.hypot(x - e.x, y - e.y);
    v += (e.q * 100) / Math.sqrt(d * d + eps * eps);
  }

  return v;
}

// Calcula el gradiente del campo eléctrico E = -grad(V) mediante diferencias finitas centrales.
export function calcularCampoVectorial(x, y, electrodos, cargasFijas) {
  const h = 0.5;
  const vXMas = calcularPotencialPunto(x + h, y, electrodos, cargasFijas);
  const vXMenos = calcularPotencialPunto(x - h, y, electrodos, cargasFijas);
  const vYMas = calcularPotencialPunto(x, y + h, electrodos, cargasFijas);
  const vYMenos = calcularPotencialPunto(x, y - h, electrodos, cargasFijas);

  // E = - dV/dr
  const ex = -(vXMas - vXMenos) / (2 * h);
  const ey = -(vYMas - vYMenos) / (2 * h);

  return { ex, ey };
}

// Simula la trayectoria dinámica de una partícula cargada dentro del campo de potencial mediante integración por pasos.
export function simularTrayectoriaParticula(genoma, entrada) {
  // Coordenadas de emisor y colector
  const emisorX = Number(entrada?.emisorX !== undefined ? entrada.emisorX : -45);
  const emisorY = Number(entrada?.emisorY !== undefined ? entrada.emisorY : 0);
  const colectorX = Number(entrada?.colectorX !== undefined ? entrada.colectorX : 45);
  const colectorY = Number(entrada?.colectorY !== undefined ? entrada.colectorY : 0);
  const vInicial = Number(entrada?.velocidadInicial !== undefined ? entrada.velocidadInicial : 14.0);
  const cargaParticula = Number(entrada?.cargaParticula !== undefined ? entrada.cargaParticula : 1.0);

  // 2 o 3 electrodos deflectores optimizados en el genoma: [x1, y1, q1, x2, y2, q2]
  const electrodos = [
    { x: genoma[0], y: genoma[1], q: genoma[2] },
    { x: genoma[3], y: genoma[4], q: genoma[5] }
  ];

  if (genoma.length >= 9) {
    electrodos.push({ x: genoma[6], y: genoma[7], q: genoma[8] });
  }

  // Cargas fijas de contorno y obstáculo prohibitivo central
  const cargasFijas = [
    { x: 0, y: 0, q: 1.8 },      // Barrera de potencial central repulsora
    { x: emisorX, y: emisorY, q: 0.5 }, // Emisor
    { x: colectorX, y: colectorY, q: -1.2 } // Colector atractor
  ];

  let x = emisorX;
  let y = emisorY;
  let vx = vInicial;
  let vy = 0.0;
  const dt = 0.05;
  const masa = 1.0;

  const trayectoria = [{ x, y, vx, vy, t: 0 }];
  let distanciaMinimaColector = Infinity;
  let energiaCinematicaTotal = 0;
  let colisionObstaculo = false;
  let tiempoEscape = 0;

  for (let paso = 0; paso < 200; paso++) {
    // Distancia al colector diana
    const distColector = Math.hypot(x - colectorX, y - colectorY);
    if (distColector < distanciaMinimaColector) {
      distanciaMinimaColector = distColector;
    }

    // Detección de colisión con la barrera de potencial central fija (|r| < 6)
    const distCentro = Math.hypot(x, y);
    if (distCentro < 6.0) {
      colisionObstaculo = true;
    }

    // Si alcanza el colector (distancia < 3.5), se considera llegada exitosa
    if (distColector < 3.5) {
      break;
    }

    // Fuerza electrostática F = q * E
    const { ex, ey } = calcularCampoVectorial(x, y, electrodos, cargasFijas);
    const fx = cargaParticula * ex;
    const fy = cargaParticula * ey;

    const ax = fx / masa;
    const ay = fy / masa;

    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;

    energiaCinematicaTotal += 0.5 * masa * (vx * vx + vy * vy) * dt;
    trayectoria.push({ x, y, vx, vy, t: (paso + 1) * dt });

    // Si escapa de los límites razonables del campo [-60, 60]
    if (Math.abs(x) > 65 || Math.abs(y) > 45) {
      tiempoEscape = (paso + 1) * dt;
      break;
    }
  }

  const exitoLlegada = distanciaMinimaColector < 3.5;

  return {
    electrodos,
    cargasFijas,
    trayectoria,
    distanciaMinimaColector,
    energiaCinematicaTotal,
    colisionObstaculo,
    exitoLlegada,
    emisorX,
    emisorY,
    colectorX,
    colectorY
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloCampoPotencial = {
  id: "campo-potencial",
  nombre: "Campo de Potencial y Deflexión 2D",
  descripcion: "Optimiza la ubicación y polaridad de electrodos deflectores para guiar partículas a través de un campo de potencial V(x,y) evitando barreras de sobrepotencial.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Distancia al Colector (mm)", "Energía de Campo (J)"],

  // Parámetros de entrada configurables por el usuario.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Precisión vs. Energía)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Precisión ponderada)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "velocidadInicial", etiqueta: "Velocidad Inicial Emisor (m/s)", tipo: "numero", min: 5, max: 25, paso: 1, valorDefecto: 14 },
    { clave: "cargaParticula", etiqueta: "Carga de la Partícula (q)", tipo: "numero", min: 0.1, max: 5.0, paso: 0.1, valorDefecto: 1.0 },
    { clave: "emisorX", etiqueta: "Emisor X (mm)", tipo: "numero", min: -50, max: -30, paso: 5, valorDefecto: -45 },
    { clave: "colectorX", etiqueta: "Colector X (mm)", tipo: "numero", min: 30, max: 50, paso: 5, valorDefecto: 45 }
  ],

  // Define los 6 genes: [x1, y1, q1, x2, y2, q2] para 2 electrodos móviles.
  crearGenoma() {
    return [
      { tipo: "continuo", min: -35, max: 35 },   // x1
      { tipo: "continuo", min: -30, max: 30 },   // y1
      { tipo: "continuo", min: -3.0, max: 3.0 }, // q1 (polaridad y magnitud)
      { tipo: "continuo", min: -35, max: 35 },   // x2
      { tipo: "continuo", min: -30, max: 30 },   // y2
      { tipo: "continuo", min: -3.0, max: 3.0 }  // q2 (polaridad y magnitud)
    ];
  },

  // Evalúa el desvío al colector y el gasto de energía potencial.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularTrayectoriaParticula(genoma, entrada);

    let penalizacionColision = 0;
    if (sim.colisionObstaculo) {
      penalizacionColision = 250;
    }

    // Objetivo 1: Distancia final mínima al colector
    const objDistancia = sim.distanciaMinimaColector + penalizacionColision;

    // Objetivo 2: Energía del campo y esfuerzo de cargas
    const esfuerzoCargas = Math.abs(genoma[2]) + Math.abs(genoma[5]);
    const objEnergia = (sim.energiaCinematicaTotal * 0.05) + (esfuerzoCargas * 2.0) + (penalizacionColision > 0 ? 5.0 : 0);

    if (esMulti) {
      return [objDistancia, objEnergia];
    }

    return objDistancia * 3.0 + objEnergia * 1.5;
  },

  // Genera el reporte textual detallado con la configuración de los electrodos y la telemetría del haz.
  describir(genoma, entrada) {
    const sim = simularTrayectoriaParticula(genoma, entrada);
    const [x1, y1, q1, x2, y2, q2] = genoma;

    let texto = `CAMPO DE POTENCIAL 2D Y DEFLEXIÓN ELECTROSTÁTICA\n`;
    texto += `========================================================================\n`;
    texto += `CONDICIONES DE HAZ:\n`;
    texto += `  • Emisor de partículas    : (${sim.emisorX.toFixed(1)}, ${sim.emisorY.toFixed(1)}) mm\n`;
    texto += `  • Colector objetivo       : (${sim.colectorX.toFixed(1)}, ${sim.colectorY.toFixed(1)}) mm\n`;
    texto += `  • Distancia al blanco     : ${sim.distanciaMinimaColector.toFixed(2)} mm\n`;
    texto += `  • Estado de captura       : ${sim.exitoLlegada ? "CAPTURA EXITOSA EN COLECTOR ✓" : "DESVÍO O PÉRDIDA DE HAZ ✕"}\n`;
    texto += `  • Barrera central prohibida: ${sim.colisionObstaculo ? "COLISIÓN DETECTADA ✕" : "EVADIDA EXITOSAMENTE ✓"}\n\n`;

    texto += `ELECTRODOS DEFLECTORES ACTIVOS:\n`;
    texto += `  • Electrodo 1 : Pos (${x1.toFixed(1)}, ${y1.toFixed(1)}) mm | Carga: ${q1 >= 0 ? "+" : ""}${q1.toFixed(2)} µC (${q1 >= 0 ? "Repulsor" : "Atractor"})\n`;
    texto += `  • Electrodo 2 : Pos (${x2.toFixed(1)}, ${y2.toFixed(1)}) mm | Carga: ${q2 >= 0 ? "+" : ""}${q2.toFixed(2)} µC (${q2 >= 0 ? "Repulsor" : "Atractor"})\n\n`;

    texto += `ENERGÍA Y TRAYECTORIA:\n`;
    texto += `  • Puntos calculados       : ${sim.trayectoria.length} pasos temporales\n`;
    texto += `  • Energía cinética acum.  : ${sim.energiaCinematicaTotal.toFixed(2)} J\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloCampoPotencial;
