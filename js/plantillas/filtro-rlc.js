// Plantilla fiel del modelo filtro-rlc: pasabanda RLC serie con barrido de Bode.
export default {
  nombre: "Síntesis de Filtro Analógico RLC",
  descripcion: "Optimiza los valores de componentes pasivos R, L y C para sintetizar un filtro pasabanda sintonizado con ancho de banda y atenuación deseados.",
  tipoVisualizacion: "filtro_rlc",
  variables: [
    { nombre: "logR", etiqueta: "log10(R) con R en Ohm (10 a 10k)", tipo: "continuo", min: 1.0, max: 4.0 },
    { nombre: "logL", etiqueta: "log10(L) con L en Henrios (0.1 mH a 1 H)", tipo: "continuo", min: -4.0, max: 0.0 },
    { nombre: "logC", etiqueta: "log10(C) con C en Faradios (1 nF a 100 uF)", tipo: "continuo", min: -9.0, max: -4.0 }
  ],
  codigoEvaluacion: `// Especificación por defecto del modelo nativo
const fDeseada = 1000.0, bwDeseado = 200.0;

// Componentes a partir de sus logaritmos
const R = Math.pow(10, vars.logR);
const L = Math.pow(10, vars.logL);
const C = Math.pow(10, vars.logC);

// Resonancia, factor de calidad y ancho de banda real
const w0 = 1.0 / Math.sqrt(L * C);
const f0 = w0 / (2 * Math.PI);
const Q = (1.0 / R) * Math.sqrt(L / C);
const bwReal = Q > 0 ? f0 / Q : 99999;

// Barrido logarítmico de 70 puntos entre 20 Hz y 50 kHz
const fMin = 20.0, fMax = 50000.0, numPuntos = 70;
const respuesta = [];
for (let i = 0; i < numPuntos; i++) {
  const f = Math.pow(10, Math.log10(fMin) + (i / (numPuntos - 1)) * (Math.log10(fMax) - Math.log10(fMin)));
  const w = 2 * Math.PI * f;

  // H(jw) = j*w*(w0/Q) / ((w0^2 - w^2) + j*w*(w0/Q))
  const numImag = w * (w0 / Math.max(0.01, Q));
  const denReal = (w0 * w0) - (w * w);
  const denImag = numImag;
  const modNum = Math.hypot(0, numImag);
  const modDen = Math.hypot(denReal, denImag);
  const gananciaLineal = modDen > 0 ? modNum / modDen : 0;
  respuesta.push({ f, gananciaDB: 20 * Math.log10(Math.max(1e-6, gananciaLineal)) });
}

// Atenuación en banda de parada a 0.25*f y 4*f de la frecuencia deseada
const pBaja = respuesta.find(p => p.f >= fDeseada * 0.25);
const pAlta = respuesta.find(p => p.f >= fDeseada * 4.0);
const atenuacionBaja = pBaja ? -pBaja.gananciaDB : 0;
const atenuacionAlta = pAlta ? -pAlta.gananciaDB : 0;

const errorFrecuencia = Math.abs(f0 - fDeseada);
const errorAnchoBanda = Math.abs(bwReal - bwDeseado);
const objSintonia = errorFrecuencia;
const objSelectividad = errorAnchoBanda + Math.max(0, 15 - atenuacionBaja) * 5 + Math.max(0, 15 - atenuacionAlta) * 5;
return [objSintonia, objSelectividad];`
};
