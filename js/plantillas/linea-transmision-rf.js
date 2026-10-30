// Plantilla fiel del modelo linea-transmision-rf (equivale a js/models/linea-rf.js).
export default {
  nombre: "Línea de Transmisión RF (Carta de Smith)",
  descripcion: "Optimiza los parámetros de una red de adaptación en línea de transmisión (longitud e impedancia de secciones y stubs) para minimizar la ROE y reflejar cero potencia en alta frecuencia.",
  tipoVisualizacion: "linea_transmision_smith",
  variables: [
    { nombre: "longitudLinea", etiqueta: "Longitud sección de línea (m)", tipo: "continuo", min: 0.01, max: 0.12 },
    { nombre: "z0Seccion", etiqueta: "Z0 sección de línea (Ω)", tipo: "continuo", min: 30.0, max: 110.0 },
    { nombre: "longitudStub", etiqueta: "Longitud stub paralelo (m)", tipo: "continuo", min: 0.005, max: 0.06 },
    { nombre: "z0Stub", etiqueta: "Z0 del stub (Ω)", tipo: "continuo", min: 35.0, max: 90.0 }
  ],
  codigoEvaluacion: `// Parámetros del entorno (valores por defecto del modelo nativo)
const fCentral = 1e9, z0Sistema = 50.0, rCarga = 85.0, xCarga = 40.0;

// Acota los genes a rangos físicos
const lTrafo = Math.max(0.005, Math.min(0.15, vars.longitudLinea));
const z0Trafo = Math.max(25.0, Math.min(120.0, vars.z0Seccion));
const lStub = Math.max(0.002, Math.min(0.08, vars.longitudStub || 0.02));
const z0Stub = Math.max(30.0, Math.min(100.0, vars.z0Stub || 50.0));

// Barrido de frecuencia +-25% (para el peor caso de ROE) e impedancia en la central
const barrido = topologia.simularBarridoSmith(fCentral * 0.75, fCentral * 1.25, 40, {
  longitudMetros: lTrafo, z0: z0Trafo, zCargaR: rCarga, zCargaX: xCarga, velPropagacion: 2e8
});
const central = topologia.calcularImpedanciaLinea(fCentral, lTrafo, z0Trafo, rCarga, xCarga, 2e8);

// Compensación reactiva del stub paralelo: Y_total = Y_linea + Y_stub
const bStub = -1.0 / (z0Stub * Math.tan((2.0 * Math.PI * fCentral * lStub) / 2e8 || 0.1));
const mod2 = central.zinR * central.zinR + central.zinX * central.zinX || 1.0;
const gIn = central.zinR / mod2;
const bTotal = central.zinX / mod2 + bStub * 0.35;
const denY = gIn * gIn + bTotal * bTotal || 1e-4;
const zR = gIn / denY;
const zX = -bTotal / denY;

// Coeficiente de reflexión y ROE finales
const denR = zR + z0Sistema;
const dMag2 = denR * denR + zX * zX;
const gU = ((zR - z0Sistema) * denR + zX * zX) / dMag2;
const gV = (zX * denR - (zR - z0Sistema) * zX) / dMag2;
const mag = Math.hypot(gU, gV);
const roe = (1.0 + Math.min(0.999, mag)) / Math.max(0.001, 1.0 - Math.min(0.999, mag));

// Objetivo 1: desvío de ROE; objetivo 2: longitud física total en mm
const objROE = (roe - 1.0) * 12.0 + (roe > 2.0 ? (roe - 2.0) * 20.0 : 0.0);
const longitudMm = (lTrafo + lStub) * 1000.0;
return [Math.max(0.001, objROE), Math.max(5.0, longitudMm)];`
};
