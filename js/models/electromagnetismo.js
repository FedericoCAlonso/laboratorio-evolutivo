// =========================================================================
// MÓDULO: MODELO TRAMPA ELECTROMAGNÉTICA Y GUÍA DE PARTÍCULAS (LORENTZ 2D)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Calcula el campo magnético Bz(x, y) generado por las 4 bobinas mediante la ley de Biot-Savart.
export function calcularCampoMagneticoBz(x, y, bobinas) {
  let bz = 0.0;
  const rNucleo2 = 4.0; // Radio efectivo del núcleo para evitar singularidades en r = 0

  for (let i = 0; i < bobinas.length; i++) {
    const bob = bobinas[i];
    const dx = x - bob.x;
    const dy = y - bob.y;
    const dist2 = dx * dx + dy * dy;
    // Bz decrece con la distancia al eje del solenoide / dipolo
    bz += (bob.corriente * 40.0) / Math.pow(dist2 + rNucleo2, 1.25);
  }

  return bz;
}

// Calcula el campo eléctrico Ex, Ey generado por las dos placas deflectoras superior e inferior.
export function calcularCampoElectrico(x, y, vSuperior, vInferior) {
  const dPlacas = 32.0; // Distancia entre placas en el eje Y
  // Campo uniforme principal en el canal central con decaimiento en los extremos X
  const amortiguacionBorde = 1.0 / (1.0 + Math.pow(x / 30.0, 4));
  const ey = ((vInferior - vSuperior) / dPlacas) * amortiguacionBorde;
  const ex = -((vSuperior + vInferior) * 0.015 * (x / 30.0)) * amortiguacionBorde;

  return { ex, ey };
}

// Simula la trayectoria de un haz de partículas cargadas bajo la fuerza de Lorentz F = q*(E + v x B).
export function simularTrayectoriaLorentz(genoma, entrada) {
  const q = Number(entrada?.cargaParticula !== undefined ? entrada.cargaParticula : 1.0);
  const m = 1.0; // Masa unitaria de la partícula
  const vInyeccion = Number(entrada?.velocidadInyeccion !== undefined ? entrada.velocidadInyeccion : 24.0);
  const yObjetivo = Number(entrada?.posicionSalidaY !== undefined ? entrada.posicionSalidaY : 6.0);
  const dispersionHaz = Number(entrada?.dispersionHaz !== undefined ? entrada.dispersionHaz : 2.5);

  // 6 genes del genoma:
  // [I1, I2, I3, I4]: Corrientes de 4 electroimanes en Amperios [-12 A, 12 A]
  // [V_sup, V_inf]: Voltajes de placas deflectoras en Voltios [-250 V, 250 V]
  const [i1, i2, i3, i4, vSup, vInf] = genoma;

  // Posiciones de los 4 electroimanes en la cámara de vacío
  const bobinas = [
    { x: -18.0, y: 16.0, corriente: i1 }, // Bobina Superior Izquierda
    { x: 18.0, y: 16.0, corriente: i2 },  // Bobina Superior Derecha
    { x: -18.0, y: -16.0, corriente: i3 },// Bobina Inferior Izquierda
    { x: 18.0, y: -16.0, corriente: i4 }  // Bobina Inferior Derecha
  ];

  // Geometría de la cámara de vacío
  const xMin = -45.0;
  const xMax = 42.0;
  const yLimite = 24.0;
  const xSalida = 38.0;

  // Simulación de un haz compuesto de 5 partículas representativas con leve dispersión angular
  const numParticulas = 5;
  const trayectorias = [];
  const dt = 0.035;
  const maxPasos = 180;

  let particulasTransmitidas = 0;
  let sumaErrorSalida = 0.0;
  let colisionesPared = 0;

  for (let p = 0; p < numParticulas; p++) {
    // Dispersión angular normalizada del haz en la rendija de inyección
    const factorDisp = numParticulas === 1 ? 0 : (p / (numParticulas - 1) - 0.5) * 2.0;
    const anguloEntradaRad = (factorDisp * dispersionHaz * Math.PI) / 180.0;
    const yEntrada = factorDisp * 1.5;

    let x = -40.0;
    let y = yEntrada;
    let vx = vInyeccion * Math.cos(anguloEntradaRad);
    let vy = vInyeccion * Math.sin(anguloEntradaRad);

    const camino = [{ x, y, vx, vy, t: 0 }];
    let colision = false;
    let salioPorColimador = false;

    for (let paso = 1; paso <= maxPasos; paso++) {
      const bz = calcularCampoMagneticoBz(x, y, bobinas);
      const { ex, ey } = calcularCampoElectrico(x, y, vSup, vInf);

      // Aceleración por Fuerza de Lorentz: a = (q/m) * (E + v x B)
      // En 2D: (vx, vy, 0) x (0, 0, Bz) = (vy*Bz, -vx*Bz, 0)
      const ax = (q / m) * (ex + vy * bz);
      const ay = (q / m) * (ey - vx * bz);

      // Integración numérica por método semi-implícito Euler-Cromer
      vx += ax * dt;
      vy += ay * dt;
      x += vx * dt;
      y += vy * dt;

      camino.push({ x, y, vx, vy, t: paso * dt });

      // Verificación de choque contra las paredes de la cámara de confinamiento
      if (Math.abs(y) >= yLimite || x < xMin) {
        colision = true;
        colisionesPared++;
        break;
      }

      // Verificación de llegada al plano del detector / colimador de salida
      if (x >= xSalida) {
        const errorY = Math.abs(y - yObjetivo);
        if (errorY <= 4.0) {
          salioPorColimador = true;
          particulasTransmitidas++;
        }
        sumaErrorSalida += errorY;
        break;
      }
    }

    if (!salioPorColimador && !colision) {
      sumaErrorSalida += Math.abs(y - yObjetivo) + 12.0;
    }

    trayectorias.push({
      camino,
      colision,
      salioPorColimador,
      yFinal: camino[camino.length - 1].y
    });
  }

  // Eficiencia de transmisión del haz (0 % a 100 %)
  const tasaTransmision = (particulasTransmitidas / numParticulas) * 100.0;
  const errorPromedioSalida = sumaErrorSalida / numParticulas;

  // Consumo total de potencia eléctrica Joule: P = sum(I^2 * R_bobina) + V^2 / R_placa
  const potenciaBobinasWatts = (i1 * i1 + i2 * i2 + i3 * i3 + i4 * i4) * 0.8;
  const potenciaDeflectoresWatts = (vSup * vSup + vInf * vInf) * 0.0012;
  const potenciaTotalWatts = potenciaBobinasWatts + potenciaDeflectoresWatts;

  // Intensidad máxima de campo magnético |Bz| en la cámara
  let maxAbsBz = 0.0;
  bobinas.forEach((b) => {
    const mag = Math.abs(b.corriente);
    if (mag > maxAbsBz) maxAbsBz = mag;
  });

  return {
    bobinas,
    vSuperior: vSup,
    vInferior: vInf,
    yObjetivo,
    xSalida,
    trayectorias,
    particulasTransmitidas,
    tasaTransmision,
    errorPromedioSalida,
    colisionesPared,
    potenciaTotalWatts,
    maxAbsBz: maxAbsBz * 0.12 // Valor relativo en Teslas
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloConfinamientoEM = {
  id: "confinamiento-em",
  nombre: "Trampa Electromagnética (Fuerza de Lorentz)",
  descripcion: "Sintoniza las corrientes de 4 electroimanes y la tensión de placas deflectoras para confinar y enfocar un haz de partículas cargadas mediante la fuerza de Lorentz F = q(E + v × B).",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Error de Colimación del Haz", "Consumo Eléctrico (Watts)"],

  // Parámetros de entorno electromagnético.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Precisión de Colimación vs. Potencia Eléctrica)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Focalización ponderada)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "posicionSalidaY", etiqueta: "Altura del Detector Salida (mm)", tipo: "numero", min: -12, max: 12, paso: 2, valorDefecto: 6 },
    { clave: "cargaParticula", etiqueta: "Carga de Partícula q", tipo: "selector", opciones: [{ valor: 1.0, etiqueta: "+1 e (Catión / Protón)" }, { valor: -1.0, etiqueta: "-1 e (Electrón)" }], valorDefecto: 1.0 },
    { clave: "dispersionHaz", etiqueta: "Dispersión Angular Haz (°)", tipo: "numero", min: 1, max: 6, paso: 0.5, valorDefecto: 2.5 }
  ],

  // 6 genes continuos: 4 corrientes de bobinas en [-12 A, 12 A] y 2 voltajes en [-250 V, 250 V].
  crearGenoma() {
    return [
      { tipo: "continuo", min: -12.0, max: 12.0 }, // I1 Bobina Sup-Izq
      { tipo: "continuo", min: -12.0, max: 12.0 }, // I2 Bobina Sup-Der
      { tipo: "continuo", min: -12.0, max: 12.0 }, // I3 Bobina Inf-Izq
      { tipo: "continuo", min: -12.0, max: 12.0 }, // I4 Bobina Inf-Der
      { tipo: "continuo", min: -250.0, max: 250.0 }, // V_sup Placa Superior
      { tipo: "continuo", min: -250.0, max: 250.0 }  // V_inf Placa Inferior
    ];
  },

  // Evalúa la transmisión y focalización del haz colimado y penaliza choques contra paredes.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularTrayectoriaLorentz(genoma, entrada);

    // Objetivo 1: Error de apuntado en la rendija de salida + fuerte penalización por choques en paredes
    const penalizacionPared = sim.colisionesPared * 35.0;
    const objColimacion = sim.errorPromedioSalida * 3.5 + (100.0 - sim.tasaTransmision) * 1.5 + penalizacionPared;

    // Objetivo 2: Consumo de potencia eléctrica (eficiencia energética)
    const objPotencia = sim.potenciaTotalWatts;

    if (esMulti) {
      return [Math.max(0.01, objColimacion), Math.max(0.1, objPotencia)];
    }

    return objColimacion * 0.7 + objPotencia * 0.3;
  },

  // Genera un resumen legible del comportamiento del haz electromagnético.
  describir(genoma, entrada) {
    const sim = simularTrayectoriaLorentz(genoma, entrada);
    return `⚡ Haz EM Lorentz: ${sim.tasaTransmision.toFixed(0)}% transmitido (${sim.particulasTransmitidas}/5 partículas) | Error: ${sim.errorPromedioSalida.toFixed(1)} mm | Bmax: ${sim.maxAbsBz.toFixed(2)} T | Potencia: ${sim.potenciaTotalWatts.toFixed(0)} W`;
  }
};

export default ModeloConfinamientoEM;
