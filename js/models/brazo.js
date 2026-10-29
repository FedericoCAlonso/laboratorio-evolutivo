// =========================================================================
// MÓDULO: MODELO BRAZO ROBÓTICO PLANAR (CINEMÁTICA INVERSA CON OBSTÁCULO)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Longitudes fijas de los 3 eslabones del brazo manipulador en unidades de modelado.
export const LONGITUDES_ESLABONES_BRAZO = [45, 35, 25];

// Calcula la distancia mínima euclidiana desde un punto P hasta un segmento de recta AB.
export function distanciaPuntoASegmento(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const longCuad = abx * abx + aby * aby;
  if (longCuad === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Proyección escalar t acotada al intervalo [0, 1] del segmento.
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / longCuad;
  t = Math.max(0, Math.min(1, t));

  const proyX = a.x + t * abx;
  const proyY = a.y + t * aby;
  return Math.hypot(p.x - proyX, p.y - proyY);
}

// Resuelve la cinemática directa del manipulador de 3 articulaciones a partir de los ángulos en grados.
export function resolverCinematicaBrazo(genoma) {
  const [th1Deg, th2Deg, th3Deg] = genoma;
  const [L1, L2, L3] = LONGITUDES_ESLABONES_BRAZO;

  const a1 = (th1Deg * Math.PI) / 180;
  const a2 = a1 + (th2Deg * Math.PI) / 180;
  const a3 = a2 + (th3Deg * Math.PI) / 180;

  const p0 = { x: 0, y: 0 };
  const p1 = { x: L1 * Math.cos(a1), y: L1 * Math.sin(a1) };
  const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) };
  const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) };

  return { p0, p1, p2, p3, a1, a2, a3 };
}

// Objeto de definición del modelo para el optimizador evolutivo.
export const ModeloBrazoRobotico = {
  id: "brazo-robotico",
  nombre: "Brazo Robótico (Cinemática Inversa)",
  descripcion: "Manipulador planar de 3 eslabones articulados que optimiza la orientación de sus articulaciones para alcanzar un punto objetivo evadiendo un obstáculo circular.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Distancia al Blanco (mm)", "Esfuerzo Angular"],

  // Parámetros de entrada interactivos para posicionar el blanco y el obstáculo.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Precisión vs. Esfuerzo)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Precisión ponderada)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "objetivoX", etiqueta: "Coordenada Objetivo X", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 55 },
    { clave: "objetivoY", etiqueta: "Coordenada Objetivo Y", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 40 },
    { clave: "obstaculoX", etiqueta: "Centro Obstáculo X", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 30 },
    { clave: "obstaculoY", etiqueta: "Centro Obstáculo Y", tipo: "numero", min: -90, max: 90, paso: 5, valorDefecto: 20 },
    { clave: "obstaculoRadio", etiqueta: "Radio Obstáculo", tipo: "numero", min: 5, max: 40, paso: 2, valorDefecto: 16 }
  ],

  // Define los 3 genes correspondientes a los ángulos theta1, theta2 y theta3 en grados [-180, 180].
  crearGenoma() {
    return [
      { tipo: "continuo", min: -180, max: 180 },
      { tipo: "continuo", min: -180, max: 180 },
      { tipo: "continuo", min: -180, max: 180 }
    ];
  },

  // Evalúa la distancia al objetivo, la evasión del obstáculo y el esfuerzo cinemático acumulado.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const targetX = Number(entrada?.objetivoX !== undefined ? entrada.objetivoX : 55);
    const targetY = Number(entrada?.objetivoY !== undefined ? entrada.objetivoY : 40);
    const obsX = Number(entrada?.obstaculoX !== undefined ? entrada.obstaculoX : 30);
    const obsY = Number(entrada?.obstaculoY !== undefined ? entrada.obstaculoY : 20);
    const obsRadio = Number(entrada?.obstaculoRadio !== undefined ? entrada.obstaculoRadio : 16);

    const { p0, p1, p2, p3 } = resolverCinematicaBrazo(genoma);

    // Verificación de colisión de los 3 eslabones contra el obstáculo circular.
    const puntoObs = { x: obsX, y: obsY };
    const d0 = distanciaPuntoASegmento(puntoObs, p0, p1);
    const d1 = distanciaPuntoASegmento(puntoObs, p1, p2);
    const d2 = distanciaPuntoASegmento(puntoObs, p2, p3);
    const minDistObstaculo = Math.min(d0, d1, d2);

    // Distancia euclidiana del efector final al objetivo.
    const distObjetivo = Math.hypot(p3.x - targetX, p3.y - targetY);

    // Penalización por colisión si algún eslabón invade el radio de seguridad.
    let penalizacionColision = 0;
    if (minDistObstaculo < obsRadio) {
      penalizacionColision = 300 + (obsRadio - minDistObstaculo) * 15;
    }

    // Esfuerzo angular acumulado normalizado respecto al punto de reposo (ángulos 0).
    const esfuerzoAngular = (Math.abs(genoma[0]) + Math.abs(genoma[1]) + Math.abs(genoma[2])) / 540;

    if (esMulti) {
      // Objetivo 1 (Precisión): Distancia con penalización de colisión.
      // Objetivo 2 (Esfuerzo): Desplazamiento articular para suavizar la cinemática.
      return [
        distObjetivo + penalizacionColision,
        esfuerzoAngular + (penalizacionColision > 0 ? 2.0 : 0)
      ];
    }

    return distObjetivo + esfuerzoAngular * 15 + penalizacionColision;
  },

  // Genera un reporte textual exhaustivo con los ángulos articulares y estado cinemático del robot.
  describir(genoma, entrada) {
    const targetX = Number(entrada?.objetivoX !== undefined ? entrada.objetivoX : 55);
    const targetY = Number(entrada?.objetivoY !== undefined ? entrada.objetivoY : 40);
    const obsX = Number(entrada?.obstaculoX !== undefined ? entrada.obstaculoX : 30);
    const obsY = Number(entrada?.obstaculoY !== undefined ? entrada.obstaculoY : 20);
    const obsRadio = Number(entrada?.obstaculoRadio !== undefined ? entrada.obstaculoRadio : 16);

    const { p0, p1, p2, p3 } = resolverCinematicaBrazo(genoma);
    const distReal = Math.hypot(p3.x - targetX, p3.y - targetY);

    const d0 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p0, p1);
    const d1 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p1, p2);
    const d2 = distanciaPuntoASegmento({ x: obsX, y: obsY }, p2, p3);
    const minDistObs = Math.min(d0, d1, d2);
    const colisiona = minDistObs < obsRadio;

    const [th1, th2, th3] = genoma;
    const esfuerzo = Math.abs(th1) + Math.abs(th2) + Math.abs(th3);

    let texto = `MANIPULADOR ROBÓTICO PLANAR (3 ESLABONES) - CINEMÁTICA INVERSA\n`;
    texto += `========================================================================\n`;
    texto += `COORDINADAS Y PRECISIÓN:\n`;
    texto += `  • Objetivo deseado (X, Y)  : (${targetX.toFixed(1)}, ${targetY.toFixed(1)}) mm\n`;
    texto += `  • Efector final alcanzado   : (${p3.x.toFixed(2)}, ${p3.y.toFixed(2)}) mm\n`;
    texto += `  • Error de precisión final  : ${distReal.toFixed(3)} mm\n\n`;

    texto += `SEGURIDAD Y EVASIÓN DE OBSTÁCULOS:\n`;
    texto += `  • Centro del obstáculo (X, Y): (${obsX.toFixed(1)}, ${obsY.toFixed(1)}) mm (Radio: ${obsRadio} mm)\n`;
    texto += `  • Distancia mínima al centro : ${minDistObs.toFixed(2)} mm\n`;
    texto += `  • Diagnóstico de colisión    : ${colisiona ? "FALLIDO (Impacto en zona prohibida) ✕" : "SEGURO (Evasión exitosa) ✓"}\n\n`;

    texto += `CONFIGURACIÓN ARTICULAR (GENES EVOLUCIONADOS):\n`;
    texto += `  • Articulación 1 (Hombro θ₁) : ${th1.toFixed(2)}°\n`;
    texto += `  • Articulación 2 (Codo θ₂)   : ${th2.toFixed(2)}°\n`;
    texto += `  • Articulación 3 (Muñeca θ₃) : ${th3.toFixed(2)}°\n`;
    texto += `  • Desplazamiento angular total: ${esfuerzo.toFixed(1)}°\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloBrazoRobotico;
