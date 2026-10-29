// =========================================================================
// MÓDULO: MODELO ARREGLO ACÚSTICO Y BEAMFORMING (INTERFERENCIA DE ONDAS 2D)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Simula la propagación e interferencia constructiva de ondas acústicas según la ecuación de Helmholtz.
export function simularArregloAcustico(genoma, entrada) {
  // Constantes físicas del medio (aire a 20 °C)
  const c = 343.0; // Velocidad del sonido en m/s
  const f = Number(entrada?.frecuenciaSonido !== undefined ? entrada.frecuenciaSonido : 2000.0);
  const anguloObjetivoGrad = Number(entrada?.anguloObjetivo !== undefined ? entrada.anguloObjetivo : 25.0);
  const distanciaFoco = Number(entrada?.distanciaFoco !== undefined ? entrada.distanciaFoco : 1.2);

  // Parámetros de onda
  const lambda = c / f; // Longitud de onda en metros (ej. 0.1715 m para 2 kHz)
  const k = (2.0 * Math.PI) / lambda; // Número de onda
  const omega = 2.0 * Math.PI * f; // Frecuencia angular

  // Arreglo lineal de N = 6 transductores acústicos con espaciamiento d = lambda / 2 (criterio anti-aliasing)
  const numTransductores = 6;
  const d = Math.min(0.12, Math.max(0.04, lambda / 2.0)); // Espaciado entre transductores
  const transductores = [];

  // Los 12 genes del genoma:
  // [phi_0..phi_5]: 6 fases relativas en radianes [-PI, PI]
  // [A_0..A_5]: 6 amplitudes relativas de excitación [0.1, 1.0]
  const fases = genoma.slice(0, numTransductores);
  const amplitudes = genoma.slice(numTransductores, numTransductores * 2);

  for (let i = 0; i < numTransductores; i++) {
    const x = (i - (numTransductores - 1) / 2.0) * d;
    const y = 0.0;
    const phi = fases[i] !== undefined ? fases[i] : 0.0;
    const amp = amplitudes[i] !== undefined ? Math.max(0.05, amplitudes[i]) : 1.0;
    transductores.push({ x, y, phi, amp });
  }

  // Ángulo objetivo en radianes (medido desde la normal al arreglo, eje +Y)
  const thetaObjRad = (anguloObjetivoGrad * Math.PI) / 180.0;

  // 1. Cálculo del diagrama de radiación polar en campo lejano (Far-Field Directivity Pattern)
  const numPuntosPolar = 181; // Barrido angular de -90° a +90°
  const diagramaPolar = [];
  let potenciaEnObjetivo = 0.0;
  let potenciaMaxima = 0.0001;
  let anguloPico = 0.0;
  let maxLobuloSecundario = 0.0;

  for (let idx = 0; idx < numPuntosPolar; idx++) {
    const grad = -90.0 + idx;
    const rad = (grad * Math.PI) / 180.0;

    // Suma vectorial compleja de las contribuciones de cada emisor
    let sumaReal = 0.0;
    let sumaImag = 0.0;

    for (let i = 0; i < numTransductores; i++) {
      const emisor = transductores[i];
      // Retardo de fase espacial en dirección theta: Delta_phi = k * x_i * sin(theta)
      const retardoEspacial = k * emisor.x * Math.sin(rad);
      const faseTotal = emisor.phi + retardoEspacial;

      sumaReal += emisor.amp * Math.cos(faseTotal);
      sumaImag += emisor.amp * Math.sin(faseTotal);
    }

    const potenciaLineal = sumaReal * sumaReal + sumaImag * sumaImag;
    if (potenciaLineal > potenciaMaxima) {
      potenciaMaxima = potenciaLineal;
      anguloPico = grad;
    }

    // Evalúa la potencia en el ángulo deseado
    if (Math.abs(grad - anguloObjetivoGrad) <= 1.0) {
      potenciaEnObjetivo = potenciaLineal;
    }

    diagramaPolar.push({
      anguloGrad: grad,
      anguloRad: rad,
      potenciaLineal
    });
  }

  // 2. Normalización del diagrama polar y cálculo de lóbulos secundarios (Side-Lobe Level SLL)
  diagramaPolar.forEach((p) => {
    p.potenciaNormalizada = p.potenciaLineal / (potenciaMaxima || 1.0);
    p.gananciaDb = 10.0 * Math.log10(Math.max(1e-4, p.potenciaNormalizada));

    // Determina lóbulos secundarios fuera del haz principal (separados más de 18° del objetivo)
    if (Math.abs(p.anguloGrad - anguloObjetivoGrad) > 18.0) {
      if (p.potenciaNormalizada > maxLobuloSecundario) {
        maxLobuloSecundario = p.potenciaNormalizada;
      }
    }
  });

  // Relación lóbulo principal a secundario en decibelios (SLL dB)
  const relacionLobuloSecundarioDb = 10.0 * Math.log10(Math.max(1e-4, maxLobuloSecundario));

  // Ancho de haz a mitad de potencia (-3 dB)
  let anchoHaz3dB = 0.0;
  diagramaPolar.forEach((p) => {
    if (p.gananciaDb >= -3.0 && Math.abs(p.anguloGrad - anguloPico) < 35.0) {
      anchoHaz3dB += 1.0;
    }
  });

  // 3. Cálculo de la grilla de presión acústica RMS 2D en campo cercano/medio
  const nx = 42;
  const ny = 34;
  const anchoMundo = 1.6;
  const altoMundo = 1.4;
  const grillaRMS = new Float32Array(nx * ny);

  let presionMaxRMS = 0.001;
  const xFoco = distanciaFoco * Math.sin(thetaObjRad);
  const yFoco = distanciaFoco * Math.cos(thetaObjRad);
  let presionEnFoco = 0.0;

  for (let iy = 0; iy < ny; iy++) {
    const yPunto = 0.05 + (iy / (ny - 1)) * (altoMundo - 0.05);
    for (let ix = 0; ix < nx; ix++) {
      const xPunto = -anchoMundo / 2.0 + (ix / (nx - 1)) * anchoMundo;

      let pReal = 0.0;
      let pImag = 0.0;

      for (let i = 0; i < numTransductores; i++) {
        const em = transductores[i];
        const r = Math.hypot(xPunto - em.x, yPunto - em.y);
        const atenuacion = em.amp / Math.sqrt(r + 0.02);
        const faseProp = k * r + em.phi;

        pReal += atenuacion * Math.cos(faseProp);
        pImag += atenuacion * Math.sin(faseProp);
      }

      const rms = Math.hypot(pReal, pImag);
      grillaRMS[iy * nx + ix] = rms;
      if (rms > presionMaxRMS) presionMaxRMS = rms;

      if (Math.hypot(xPunto - xFoco, yPunto - yFoco) < 0.08) {
        presionEnFoco = rms;
      }
    }
  }

  // Normaliza grilla para visualización
  for (let idx = 0; idx < grillaRMS.length; idx++) {
    grillaRMS[idx] /= presionMaxRMS;
  }

  // 4. Eficiencia energética del arreglo (suma de cuadrados de amplitudes)
  let energiaAcusticaTotal = 0.0;
  for (let i = 0; i < numTransductores; i++) {
    energiaAcusticaTotal += transductores[i].amp * transductores[i].amp;
  }

  return {
    frecuenciaHz: f,
    longitudOndaM: lambda,
    numeroOndaK: k,
    frecuenciaAngularOmega: omega,
    anguloObjetivoGrad,
    distanciaFoco,
    xFoco,
    yFoco,
    transductores,
    diagramaPolar,
    anguloPico,
    potenciaEnObjetivo,
    potenciaMaxima,
    relacionLobuloSecundarioDb,
    anchoHaz3dB,
    maxLobuloSecundario,
    presionEnFoco,
    energiaAcusticaTotal,
    grillaRMS,
    nx,
    ny,
    anchoMundo,
    altoMundo
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloArregloAcustico = {
  id: "acustica-beamforming",
  nombre: "Arreglo Acústico y Beamforming (Ondas 2D)",
  descripcion: "Sintetiza la dirección de un haz ultrasónico/acústico mediante interferencia constructiva de transductores (Phased Array), maximizando ganancia en el ángulo deseado y eliminando lóbulos parásitos.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Error Directividad / Ganancia", "Lóbulos Secundarios (SLL dB)"],

  // Parámetros de entorno acústico.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Ganancia Angular vs. Supresión SLL)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Directividad ponderada)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "frecuenciaSonido", etiqueta: "Frecuencia Acústica (Hz)", tipo: "numero", min: 500, max: 4000, paso: 250, valorDefecto: 2000 },
    { clave: "anguloObjetivo", etiqueta: "Ángulo de Apuntamiento θ (°)", tipo: "numero", min: -60, max: 60, paso: 5, valorDefecto: 30 },
    { clave: "distanciaFoco", etiqueta: "Distancia Focal (m)", tipo: "numero", min: 0.6, max: 2.0, paso: 0.1, valorDefecto: 1.2 }
  ],

  // 12 genes: 6 fases relativas en [-PI, PI] y 6 amplitudes relativas en [0.1, 1.0].
  crearGenoma() {
    return [
      { tipo: "continuo", min: -Math.PI, max: Math.PI }, // phi 0
      { tipo: "continuo", min: -Math.PI, max: Math.PI }, // phi 1
      { tipo: "continuo", min: -Math.PI, max: Math.PI }, // phi 2
      { tipo: "continuo", min: -Math.PI, max: Math.PI }, // phi 3
      { tipo: "continuo", min: -Math.PI, max: Math.PI }, // phi 4
      { tipo: "continuo", min: -Math.PI, max: Math.PI }, // phi 5
      { tipo: "continuo", min: 0.15, max: 1.0 },         // Amp 0
      { tipo: "continuo", min: 0.15, max: 1.0 },         // Amp 1
      { tipo: "continuo", min: 0.15, max: 1.0 },         // Amp 2
      { tipo: "continuo", min: 0.15, max: 1.0 },         // Amp 3
      { tipo: "continuo", min: 0.15, max: 1.0 },         // Amp 4
      { tipo: "continuo", min: 0.15, max: 1.0 }          // Amp 5
    ];
  },

  // Evalúa la focalización acústica y la supresión de lóbulos parásitos.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularArregloAcustico(genoma, entrada);

    // Objetivo 1: Minimizar desviación entre el ángulo pico obtenido y el objetivo + maximizar potencia relativa
    const errorAngulo = Math.abs(sim.anguloPico - sim.anguloObjetivoGrad);
    const deficienciaPotencia = Math.max(0, 36.0 - sim.potenciaEnObjetivo);
    const objDirectividad = errorAngulo * 2.5 + deficienciaPotencia * 1.5;

    // Objetivo 2: Minimizar lóbulos secundarios parásitos (menor SLL = mejor supresión)
    // SLL típico va de -25 dB (excelente) a 0 dB (malo)
    const objLobulosSecundarios = (sim.relacionLobuloSecundarioDb + 30.0) * 1.8 + Math.max(0, sim.anchoHaz3dB - 20) * 0.5;

    if (esMulti) {
      return [objDirectividad, Math.max(0.1, objLobulosSecundarios)];
    }

    return objDirectividad * 0.65 + Math.max(0.1, objLobulosSecundarios) * 0.35;
  },

  // Genera un resumen técnico legible del estado de apuntamiento acústico.
  describir(genoma, entrada) {
    const sim = simularArregloAcustico(genoma, entrada);
    return `🔊 Beamforming a ${sim.frecuenciaHz} Hz (λ = ${(sim.longitudOndaM * 100).toFixed(1)} cm) | Apuntado: ${sim.anguloPico.toFixed(1)}° (Obj: ${sim.anguloObjetivoGrad}°) | SLL: ${sim.relacionLobuloSecundarioDb.toFixed(1)} dB | Ancho haz: ${sim.anchoHaz3dB.toFixed(0)}°`;
  }
};

export default ModeloArregloAcustico;
