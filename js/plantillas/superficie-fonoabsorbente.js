// Plantilla fiel del modelo superficie-fonoabsorbente (equivale a js/models/fonoabsorbente.js).
// Reproduce el modo por defecto: cuñas prismáticas, ruido de conversación, objetivo 18 dBA.
export default {
  nombre: "Superficie Fonoabsorbente (Cuñas y Multimaterial dBA)",
  descripcion: "Optimiza la geometría transversal de cuñas acústicas o la estratificación de un panel plano multimaterial para alcanzar una atenuación objetivo en dBA con espesor y material mínimos.",
  tipoVisualizacion: "fonoabsorbente_acustico",
  variables: [
    { nombre: "alturaCuna", etiqueta: "Altura de la cuña (mm)", tipo: "continuo", min: 25.0, max: 140.0 },
    { nombre: "alturaBase", etiqueta: "Altura de la base (mm)", tipo: "continuo", min: 15.0, max: 70.0 },
    { nombre: "periodoCuna", etiqueta: "Período de la cuña (mm)", tipo: "continuo", min: 25.0, max: 90.0 },
    { nombre: "exponentePerfil", etiqueta: "Curvatura del perfil", tipo: "continuo", min: 0.6, max: 2.2 },
    { nombre: "sigmaMaterial", etiqueta: "Resistividad al flujo (kPa·s/m²)", tipo: "continuo", min: 6.0, max: 55.0 },
    { nombre: "camaraAire", etiqueta: "Cámara de aire trasera (mm)", tipo: "continuo", min: 0.0, max: 50.0 }
  ],
  codigoEvaluacion: `// Entorno por defecto del modelo nativo: cuña prismática, ruido de conversación
const bandas = [125, 250, 500, 1000, 2000, 4000];
const ponderacionA = [-16.1, -8.6, -3.2, 0.0, 1.2, 1.0];
const espectro = [62.0, 70.0, 76.0, 78.0, 72.0, 62.0];
const atenuacionObjetivo = 18.0;
const limiteEspesor = 180.0;

// Geometría acotada de la cuña
const hCuna = Math.max(20, Math.min(180, vars.alturaCuna));
const hBase = Math.max(10, Math.min(80, vars.alturaBase));
const camara = Math.max(0, Math.min(60, vars.camaraAire || 0));
const wPeriodo = Math.max(25, Math.min(100, vars.periodoCuna));
const sigma = Math.max(5, Math.min(60, vars.sigmaMaterial));
const espesorTotal = hCuna + hBase + camara;
const volumenRelativo = (hBase + hCuna * 0.5) / Math.max(1, espesorTotal);

// Impedancia y número de onda del medio poroso (Delany-Bazley-Miki)
const impedanciaPoro = (f) => {
  const z0 = 1.205 * 343.0;
  const k0 = (2.0 * Math.PI * f) / 343.0;
  const X = (1.205 * f) / (Math.max(2.0, Math.min(150.0, sigma)) * 1000.0);
  return {
    zcReal: z0 * (1.0 + 0.07 * Math.pow(X, -0.632)),
    kcReal: k0 * (1.0 + 0.109 * Math.pow(X, -0.618)),
    z0
  };
};

// Ángulo de punta y rebotes múltiples (no dependen de la banda)
const anguloPunta = Math.atan2(wPeriodo / 2.0, hCuna);
const numRebotes = Math.max(1.0, Math.min(4.0, (Math.PI / 2.0) / (anguloPunta || 0.5)));
const hTotalM = (hCuna + hBase) / 1000.0;

// Absorción por banda y suma energética en dBA
let sumaInc = 0.0, sumaRef = 0.0;
for (let b = 0; b < bandas.length; b++) {
  const imp = impedanciaPoro(bandas[b]);
  const alphaNormal = Math.min(0.96, Math.max(0.04, (1.0 - Math.exp(-imp.kcReal * hTotalM * 1.6)) * (imp.zcReal / (imp.zcReal + imp.z0))));
  let alpha = 1.0 - Math.pow(Math.max(0.02, 1.0 - alphaNormal), numRebotes * 0.7);
  // La cámara de aire trasera mejora las bajas frecuencias
  if (camara > 0 && bandas[b] <= 500) alpha = Math.min(0.98, alpha * 1.35);
  alpha = Math.min(0.99, Math.max(0.05, alpha));

  const splRef = espectro[b] + 10.0 * Math.log10(Math.max(0.001, 1.0 - alpha));
  sumaInc += Math.pow(10.0, (espectro[b] + ponderacionA[b]) / 10.0);
  sumaRef += Math.pow(10.0, (splRef + ponderacionA[b]) / 10.0);
}
const atenuacion = Math.max(0.0, 10.0 * Math.log10(Math.max(1.0, sumaInc)) - 10.0 * Math.log10(Math.max(1.0, sumaRef)));

// Objetivo 1: déficit de atenuación y exceso de espesor; objetivo 2: espesor ponderado por volumen
const deficit = Math.max(0.0, atenuacionObjetivo - atenuacion);
const exceso = Math.max(0.0, espesorTotal - limiteEspesor);
const objAtenuacion = deficit * 12.0 + deficit * deficit * 5.0 + exceso * 4.0;
const objMaterial = espesorTotal * (0.5 + volumenRelativo * 0.5);
return [Math.max(0.01, objAtenuacion), Math.max(10.0, objMaterial)];`
};
