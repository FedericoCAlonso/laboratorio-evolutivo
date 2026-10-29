// =========================================================================
// MÓDULO: MODELO SÍNTESIS DE FILTRO ANALÓGICO RLC (RESPUESTA EN FRECUENCIA)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Simula la respuesta en frecuencia completa (Diagrama de Bode de Magnitud) de un filtro RLC pasabanda.
export function simularRespuestaFiltroRLC(genoma, entrada) {
  const fDeseada = Number(entrada?.frecuenciaCentral !== undefined ? entrada.frecuenciaCentral : 1000.0); // Hz
  const bwDeseado = Number(entrada?.anchoBanda !== undefined ? entrada.anchoBanda : 200.0); // Hz

  // 3 genes continuos que representan el logaritmo de los valores de componentes:
  // R en [10 Ohm, 10000 Ohm]
  // L en [0.1 mH, 1000 mH]
  // C en [1 nF, 10 uF]
  const [logR, logL, logC] = genoma;
  const R = Math.pow(10, logR);
  const L = Math.pow(10, logL); // en Henrios
  const C = Math.pow(10, logC); // en Faradios

  // Frecuencia de resonancia teórica w0 = 1 / sqrt(L * C)
  const w0 = 1.0 / Math.sqrt(L * C);
  const f0 = w0 / (2 * Math.PI);

  // Factor de calidad Q = (1 / R) * sqrt(L / C) (para RLC serie pasabanda)
  const Q = (1.0 / R) * Math.sqrt(L / C);
  const bwReal = Q > 0 ? f0 / Q : 99999;

  // Barrido logarítmico de 70 puntos de frecuencia entre 20 Hz y 50 kHz
  const fMin = 20.0;
  const fMax = 50000.0;
  const numPuntos = 70;
  const respuesta = [];

  let magMaximaDB = -Infinity;
  let fPico = f0;

  for (let i = 0; i < numPuntos; i++) {
    const f = Math.pow(10, Math.log10(fMin) + (i / (numPuntos - 1)) * (Math.log10(fMax) - Math.log10(fMin)));
    const w = 2 * Math.PI * f;

    // Función de transferencia pasabanda normalizada H(s) = ( (w0/Q)*s ) / ( s^2 + (w0/Q)*s + w0^2 )
    // Para s = j*w:
    // Numerador: j * w * (w0 / Q)
    // Denominador: (w0^2 - w^2) + j * w * (w0 / Q)
    const numReal = 0;
    const numImag = w * (w0 / Math.max(0.01, Q));

    const denReal = (w0 * w0) - (w * w);
    const denImag = w * (w0 / Math.max(0.01, Q));

    const modNum = Math.hypot(numReal, numImag);
    const modDen = Math.hypot(denReal, denImag);

    const gananciaLineal = modDen > 0 ? modNum / modDen : 0;
    const gananciaDB = 20 * Math.log10(Math.max(1e-6, gananciaLineal));

    if (gananciaDB > magMaximaDB) {
      magMaximaDB = gananciaDB;
      fPico = f;
    }

    respuesta.push({ f, gananciaDB, gananciaLineal });
  }

  // Atenuación en las frecuencias de parada (Stopband rejection a 0.2*f0 y 5.0*f0)
  let atenuacionBaja = 0;
  let atenuacionAlta = 0;
  const pBaja = respuesta.find(p => p.f >= fDeseada * 0.25);
  const pAlta = respuesta.find(p => p.f >= fDeseada * 4.0);
  if (pBaja) atenuacionBaja = -pBaja.gananciaDB;
  if (pAlta) atenuacionAlta = -pAlta.gananciaDB;

  const errorFrecuencia = Math.abs(f0 - fDeseada);
  const errorAnchoBanda = Math.abs(bwReal - bwDeseado);

  return {
    R,
    L,
    C,
    f0,
    Q,
    bwReal,
    fDeseada,
    bwDeseado,
    errorFrecuencia,
    errorAnchoBanda,
    magMaximaDB,
    fPico,
    atenuacionBaja,
    atenuacionAlta,
    respuesta
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloFiltroRLC = {
  id: "filtro-rlc",
  nombre: "Síntesis de Filtro Analógico RLC",
  descripcion: "Optimiza los valores de componentes pasivos R, L y C para sintetizar un filtro pasabanda sintonizado con ancho de banda y atenuación deseados.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Error Frecuencia Central (Hz)", "Error Ancho de Banda y Selectividad"],

  // Parámetros de diseño del filtro.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Sintonización vs. Selectividad Q)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Criterio de máscara)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "frecuenciaCentral", etiqueta: "Frecuencia Central Deseada (Hz)", tipo: "numero", min: 100, max: 10000, paso: 100, valorDefecto: 1000 },
    { clave: "anchoBanda", etiqueta: "Ancho de Banda Deseado BW (Hz)", tipo: "numero", min: 50, max: 2000, paso: 50, valorDefecto: 250 }
  ],

  // 3 genes continuos logarítmicos: log10(R), log10(L), log10(C).
  crearGenoma() {
    return [
      { tipo: "continuo", min: 1.0, max: 4.0 },   // R: 10^1 = 10 Ohm a 10^4 = 10k Ohm
      { tipo: "continuo", min: -4.0, max: 0.0 },  // L: 10^-4 = 0.1 mH a 10^0 = 1 H
      { tipo: "continuo", min: -9.0, max: -4.0 }  // C: 10^-9 = 1 nF a 10^-4 = 100 uF
    ];
  },

  // Evalúa el error de sintonía en frecuencia y la conformidad del factor de calidad Q.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularRespuestaFiltroRLC(genoma, entrada);

    const objSintonia = sim.errorFrecuencia;
    const objSelectividad = sim.errorAnchoBanda + Math.max(0, 15 - sim.atenuacionBaja) * 5 + Math.max(0, 15 - sim.atenuacionAlta) * 5;

    if (esMulti) {
      return [objSintonia, objSelectividad];
    }

    return objSintonia * 1.5 + objSelectividad * 0.8;
  },

  // Genera el informe textual con los valores de componentes normalizados y métricas de audio/RF.
  describir(genoma, entrada) {
    const sim = simularRespuestaFiltroRLC(genoma, entrada);

    // Formateo de componentes con prefijos métricos estándar de ingeniería
    const rStr = sim.R >= 1000 ? `${(sim.R / 1000).toFixed(2)} kΩ` : `${sim.R.toFixed(1)} Ω`;
    const lStr = sim.L < 0.001 ? `${(sim.L * 1e6).toFixed(1)} µH` : sim.L < 1.0 ? `${(sim.L * 1000).toFixed(2)} mH` : `${sim.L.toFixed(3)} H`;
    const cStr = sim.C < 1e-6 ? `${(sim.C * 1e9).toFixed(2)} nF` : `${(sim.C * 1e6).toFixed(2)} µF`;

    let texto = `SÍNTESIS DE FILTRO RLC PASABANDA DE 2DO ORDEN\n`;
    texto += `========================================================================\n`;
    texto += `VALORES DE COMPONENTES SINTETIZADOS:\n`;
    texto += `  • Resistencia (R)        : ${rStr} (log10 R = ${genoma[0].toFixed(3)})\n`;
    texto += `  • Inductancia (L)        : ${lStr} (log10 L = ${genoma[1].toFixed(3)})\n`;
    texto += `  • Capacitancia (C)       : ${cStr} (log10 C = ${genoma[2].toFixed(3)})\n\n`;

    texto += `RESPUESTA EN FRECUENCIA Y SINTONIZACIÓN:\n`;
    texto += `  • Frecuencia central f₀  : ${sim.f0.toFixed(1)} Hz (Objetivo: ${sim.fDeseada} Hz | Error: ${sim.errorFrecuencia.toFixed(1)} Hz)\n`;
    texto += `  • Ancho de banda BW (-3dB): ${sim.bwReal.toFixed(1)} Hz (Objetivo: ${sim.bwDeseado} Hz)\n`;
    texto += `  • Factor de calidad Q    : ${sim.Q.toFixed(2)}\n`;
    texto += `  • Ganancia en resonancia : ${sim.magMaximaDB.toFixed(2)} dB\n`;
    texto += `  • Atenuación en stopband : Baja = ${sim.atenuacionBaja.toFixed(1)} dB | Alta = ${sim.atenuacionAlta.toFixed(1)} dB\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloFiltroRLC;
