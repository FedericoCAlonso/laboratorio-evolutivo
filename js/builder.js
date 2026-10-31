// =========================================================================
// MÓDULO: CONSTRUCTOR DE MODELOS DINÁMICOS LOW-CODE (COMPILACIÓN Y VISUALIZADOR)
// =========================================================================

import { MotorCamposUnificados } from "./engines/campos.js";
import { MotorEstructurasCinematica } from "./engines/estructuras.js";
import { MotorOndasAcustica } from "./engines/ondas.js";
import { MotorFuncionalTopologico } from "./engines/topologia.js";
import {
  GrafoMecanismoMultifisica,
  simularCicloMecanismo,
  crearGrafoBrazoRobotico
} from "./engines/mecanismos.js";
import { CATALOGO_PREDEFINIDO } from "../catalogo/definiciones.js";

// Plantillas preconfiguradas para inspirar y servir de base a nuevas simulaciones de diversas naturalezas.
export const PLANTILLAS_SIMULACION = {
  "brazo_robotico": {
    nombre: "Brazo Robótico Articulado (3 Eslabones)",
    descripcion: "Cinemática de 3 grados de libertad para alcanzar el objetivo (55, 40) eludiendo un obstáculo circular con mínimo esfuerzo angular.",
    tipoVisualizacion: "mecanismo_barras_2d",
    grafo: crearGrafoBrazoRobotico().exportarJSON(),
    variables: [
      { nombre: "theta1", etiqueta: "theta1: Ángulo base θ₁ (-180° a 180°)", tipo: "continuo", min: -180, max: 180 },
      { nombre: "theta2", etiqueta: "theta2: Ángulo codo θ₂ (-180° a 180°)", tipo: "continuo", min: -180, max: 180 },
      { nombre: "theta3", etiqueta: "theta3: Ángulo muñeca θ₃ (-180° a 180°)", tipo: "continuo", min: -180, max: 180 }
    ],
    codigoEvaluacion: `const t1 = (vars.theta1 * Math.PI) / 180;
const t2 = t1 + (vars.theta2 * Math.PI) / 180;
const t3 = t2 + (vars.theta3 * Math.PI) / 180;

const x1 = 35 * Math.cos(t1), y1 = 35 * Math.sin(t1);
const x2 = x1 + 30 * Math.cos(t2), y2 = y1 + 30 * Math.sin(t2);
const x3 = x2 + 25 * Math.cos(t3), y3 = y2 + 25 * Math.sin(t3);

const distObjetivo = Math.hypot(x3 - 55, y3 - 40);
const distObs = Math.hypot(x2 - 30, y2 - 20);
const penColision = distObs < 16 ? 150 : 0;
const esfuerzo = (Math.abs(vars.theta1) + Math.abs(vars.theta2) + Math.abs(vars.theta3)) * 0.05;

return [distObjetivo + penColision, esfuerzo];`
  },
  "campo_potencial": {
    nombre: "Campo de Potencial Electrostático 2D",
    descripcion: "Optimiza la posición y polaridad de electrodos deflectores para guiar partículas minimizando la energía del campo y evitando barreras.",
    tipoVisualizacion: "campo_potencial_2d",
    variables: [
      { nombre: "x1", tipo: "continuo", min: -35, max: 35 },
      { nombre: "y1", tipo: "continuo", min: -30, max: 30 },
      { nombre: "q1", tipo: "continuo", min: -3.0, max: 3.0 },
      { nombre: "x2", tipo: "continuo", min: -35, max: 35 },
      { nombre: "y2", tipo: "continuo", min: -30, max: 30 },
      { nombre: "q2", tipo: "continuo", min: -3.0, max: 3.0 }
    ],
    codigoEvaluacion: `// Colector en (x=35, y=0) y barrera prohibida en (0, 0)\nconst distColector = Math.hypot(vars.x2 - 35, vars.y2);\nconst distBarrera = Math.hypot(vars.x1, vars.y1);\nconst colision = distBarrera < 8.0 ? 250 : 0;\nconst esfuerzoCargas = Math.abs(vars.q1) + Math.abs(vars.q2);\n\n// Retorna [f1 (Precisión), f2 (Energía)] para Frente de Pareto NSGA-II\nreturn [distColector + colision, esfuerzoCargas + (colision > 0 ? 5.0 : 0)];`
  },
  "campo_vectorial": {
    nombre: "Vórtices y Campo Vectorial de Flujo",
    descripcion: "Navegación y control en un campo vectorial de velocidades con vórtices rotacionales y corrientes forzadas.",
    tipoVisualizacion: "campo_vectorial_2d",
    variables: [
      { nombre: "vortexX", tipo: "continuo", min: -30, max: 30 },
      { nombre: "vortexY", tipo: "continuo", min: -25, max: 25 },
      { nombre: "circulacion", tipo: "continuo", min: 1.0, max: 10.0 },
      { nombre: "empujeX", tipo: "continuo", min: -10, max: 10 },
      { nombre: "empujeY", tipo: "continuo", min: -10, max: 10 }
    ],
    codigoEvaluacion: `// Minimizar desvío respecto al vórtice deseado en (15, 10)\nconst dVortex = Math.hypot(vars.vortexX - 15, vars.vortexY - 10);\nconst esfuerzo = Math.hypot(vars.empujeX, vars.empujeY);\nreturn [dVortex, esfuerzo * 0.3 + Math.abs(vars.circulacion - 6.0)];`
  },
  "trayectoria": {
    nombre: "Navegación Espacial con Obstáculos",
    descripcion: "Optimización de waypoints cinemáticos para alcanzar un blanco eludiendo zonas circulares de exclusión.",
    tipoVisualizacion: "trayectoria_particulas_2d",
    variables: [
      { nombre: "wp1X", tipo: "continuo", min: -40, max: 40 },
      { nombre: "wp1Y", tipo: "continuo", min: -30, max: 30 },
      { nombre: "wp2X", tipo: "continuo", min: -40, max: 40 },
      { nombre: "wp2Y", tipo: "continuo", min: -30, max: 30 },
      { nombre: "velocidad", tipo: "continuo", min: 5, max: 30 }
    ],
    codigoEvaluacion: `// Blanco en (45, 20) y obstáculo en (15, 5, radio=12)\nconst distBlanco = Math.hypot(vars.wp2X - 45, vars.wp2Y - 20);\nconst distObs = Math.hypot(vars.wp1X - 15, vars.wp1Y - 5);\nconst penalizacionColision = distObs < 12.0 ? 300 : 0;\nconst longitudRuta = Math.hypot(vars.wp1X, vars.wp1Y) + Math.hypot(vars.wp2X - vars.wp1X, vars.wp2Y - vars.wp1Y);\nreturn [distBlanco + penalizacionColision, longitudRuta * 0.15 + (penalizacionColision > 0 ? 5.0 : 0)];`
  },
  "serie_temporal": {
    nombre: "Oscilador Dinámico Amortiguado",
    descripcion: "Sintonización de amortiguamiento y frecuencia para respuesta temporal rápida sin sobrepico oscilatorio.",
    tipoVisualizacion: "serie_temporal",
    variables: [
      { nombre: "masa", tipo: "continuo", min: 0.5, max: 10.0 },
      { nombre: "amortiguamiento", tipo: "continuo", min: 0.1, max: 5.0 },
      { nombre: "rigidez", tipo: "continuo", min: 2.0, max: 50.0 },
      { nombre: "ganancia", tipo: "continuo", min: 1.0, max: 20.0 }
    ],
    codigoEvaluacion: `// Frecuencia natural wn y coeficiente de amortiguamiento zeta\nconst wn = Math.sqrt(vars.rigidez / vars.masa);\nconst zeta = vars.amortiguamiento / (2 * Math.sqrt(vars.masa * vars.rigidez));\nconst sobrepico = zeta < 1.0 ? Math.exp((-Math.PI * zeta) / Math.sqrt(Math.max(0.01, 1 - zeta * zeta))) * 100 : 0;\nconst tEstablecimiento = 4.0 / Math.max(0.1, zeta * wn);\nreturn [sobrepico, tEstablecimiento];`
  },
  "mecanismo": {
    nombre: "Mecanismo Articulado de 3 Barras",
    descripcion: "Optimiza la longitud y ángulos de un mecanismo articulado planar para alcanzar un objetivo cinemático.",
    tipoVisualizacion: "mecanismo_barras_2d",
    variables: [
      { nombre: "longitud1", tipo: "continuo", min: 15, max: 50 },
      { nombre: "longitud2", tipo: "continuo", min: 10, max: 40 },
      { nombre: "longitud3", tipo: "continuo", min: 5, max: 30 },
      { nombre: "angulo1", tipo: "continuo", min: -180, max: 180 },
      { nombre: "angulo2", tipo: "continuo", min: -180, max: 180 }
    ],
    codigoEvaluacion: `const a1 = (vars.angulo1 * Math.PI) / 180;\nconst a2 = a1 + (vars.angulo2 * Math.PI) / 180;\nconst x = vars.longitud1 * Math.cos(a1) + vars.longitud2 * Math.cos(a2);\nconst y = vars.longitud1 * Math.sin(a1) + vars.longitud2 * Math.sin(a2);\nconst distBlanco = Math.hypot(x - 45, y - 25);\nconst masaTotal = vars.longitud1 + vars.longitud2 + vars.longitud3;\nreturn [distBlanco, masaTotal * 0.1];`
  },
  "distribucion": {
    nombre: "Distribución de Cargas y Recursos",
    descripcion: "Partición y balanceo de carga computacional entre servidores con penalización de saturación.",
    tipoVisualizacion: "distribucion_recursos",
    variables: [
      { nombre: "srvWeb", tipo: "continuo", min: 0, max: 100 },
      { nombre: "srvApp", tipo: "continuo", min: 0, max: 100 },
      { nombre: "srvDB", tipo: "continuo", min: 0, max: 100 },
      { nombre: "srvCache", tipo: "continuo", min: 0, max: 100 }
    ],
    codigoEvaluacion: `const cargas = [vars.srvWeb, vars.srvApp, vars.srvDB, vars.srvCache];\nconst suma = cargas.reduce((a, b) => a + b, 0);\nconst desbalance = Math.max(...cargas) - Math.min(...cargas);\nlet sobrecarga = 0;\ncargas.forEach(c => { if (c > 80) sobrecarga += (c - 80) * 4; });\nconst errorTotal = Math.abs(suma - 250);\nreturn [desbalance + sobrecarga, errorTotal];`
  },
  "acustica_beamforming": {
    nombre: "Beamforming Acústico Phased Array",
    descripcion: "Sintonización de fases relativas en un arreglo de altavoces para dirigir el haz sonoro hacia un ángulo objetivo.",
    tipoVisualizacion: "acustica_ondas_2d",
    variables: [
      { nombre: "fase1", tipo: "continuo", min: -3.14, max: 3.14 },
      { nombre: "fase2", tipo: "continuo", min: -3.14, max: 3.14 },
      { nombre: "fase3", tipo: "continuo", min: -3.14, max: 3.14 },
      { nombre: "fase4", tipo: "continuo", min: -3.14, max: 3.14 },
      { nombre: "fase5", tipo: "continuo", min: -3.14, max: 3.14 },
      { nombre: "fase6", tipo: "continuo", min: -3.14, max: 3.14 },
      { nombre: "amp1", tipo: "continuo", min: 0.2, max: 1.0 },
      { nombre: "amp2", tipo: "continuo", min: 0.2, max: 1.0 },
      { nombre: "amp3", tipo: "continuo", min: 0.2, max: 1.0 },
      { nombre: "amp4", tipo: "continuo", min: 0.2, max: 1.0 },
      { nombre: "amp5", tipo: "continuo", min: 0.2, max: 1.0 },
      { nombre: "amp6", tipo: "continuo", min: 0.2, max: 1.0 }
    ],
    codigoEvaluacion: `// Objetivo: Apuntar a theta = 25 grados\\nconst d = 0.085;\\nconst lambda = 0.1715;\\nconst k = (2 * Math.PI) / lambda;\\nconst sinTheta = Math.sin((25 * Math.PI) / 180);\\nconst fases = [vars.fase1, vars.fase2, vars.fase3, vars.fase4, vars.fase5, vars.fase6];\\nconst amps = [vars.amp1, vars.amp2, vars.amp3, vars.amp4, vars.amp5, vars.amp6];\\nlet re = 0, im = 0;\\nfor (let i = 0; i < 6; i++) {\\n  const x = (i - 2.5) * d;\\n  const f = fases[i] + k * x * sinTheta;\\n  re += amps[i] * Math.cos(f);\\n  im += amps[i] * Math.sin(f);\\n}\\nconst pot = re * re + im * im;\\nreturn [36.0 - pot, Math.abs(vars.amp1 - 0.5) + Math.abs(vars.amp6 - 0.5)];`
  },
  "confinamiento_em": {
    nombre: "Guía EM y Fuerza de Lorentz",
    descripcion: "Control de corrientes en electroimanes y placas deflectoras para enfocar iones hacia un colimador objetivo.",
    tipoVisualizacion: "electromagnetismo_lorentz",
    variables: [
      { nombre: "i1", tipo: "continuo", min: -10, max: 10 },
      { nombre: "i2", tipo: "continuo", min: -10, max: 10 },
      { nombre: "i3", tipo: "continuo", min: -10, max: 10 },
      { nombre: "i4", tipo: "continuo", min: -10, max: 10 },
      { nombre: "vSup", tipo: "continuo", min: -200, max: 200 },
      { nombre: "vInf", tipo: "continuo", min: -200, max: 200 }
    ],
    codigoEvaluacion: `// Desvío objetivo hacia detector en y = 6 con mínima potencia\\nconst potElectrica = (vars.i1*vars.i1 + vars.i2*vars.i2 + vars.i3*vars.i3 + vars.i4*vars.i4)*0.8;\\nconst balance = Math.abs((vars.vInf - vars.vSup) - 120);\\nreturn [balance, potElectrica];`
  },
  "fonoabsorbente": {
    nombre: "Diseño de Superficie Fonoabsorbente",
    descripcion: "Optimiza la profundidad de cuña o capas para cumplir una atenuación en dBA con material mínimo.",
    tipoVisualizacion: "fonoabsorbente_acustico",
    variables: [
      { nombre: "hCuna", tipo: "continuo", min: 30, max: 150 },
      { nombre: "hBase", tipo: "continuo", min: 15, max: 60 },
      { nombre: "wPeriodo", tipo: "continuo", min: 30, max: 90 },
      { nombre: "curvatura", tipo: "continuo", min: 0.8, max: 2.0 },
      { nombre: "sigma", tipo: "continuo", min: 10, max: 50 },
      { nombre: "camaraAire", tipo: "continuo", min: 0, max: 40 }
    ],
    codigoEvaluacion: `// Minimizar déficit respecto a 18 dBA de atenuación y volumen de material\\nconst espesor = vars.hCuna + vars.hBase + vars.camaraAire;\\nconst atenuacionEstimada = 8.0 + (espesor * 0.08) * (vars.sigma / (vars.sigma + 15));\\nconst deficit = Math.max(0, 18.0 - atenuacionEstimada);\\nreturn [deficit * 15.0, espesor * 0.6];`
  },
  "linea_rf": {
    nombre: "Adaptación RF y Carta de Smith",
    descripcion: "Sintonización de longitud e impedancia característica para adaptar una antena de 85+j40 ohms a 50 ohms.",
    tipoVisualizacion: "linea_transmision_smith",
    variables: [
      { nombre: "longitudLinea", tipo: "continuo", min: 0.01, max: 0.12 },
      { nombre: "z0Linea", tipo: "continuo", min: 30.0, max: 110.0 },
      { nombre: "longitudStub", tipo: "continuo", min: 0.005, max: 0.06 },
      { nombre: "z0Stub", tipo: "continuo", min: 35.0, max: 90.0 }
    ],
    codigoEvaluacion: `// Minimizar desadaptación en ROE (SWR) a 1 GHz y longitud física total\\nconst roeEstimada = 1.0 + Math.abs(vars.z0Linea - 65.0)*0.015 + Math.abs(vars.longitudLinea - 0.04)*10.0;\\nreturn [roeEstimada - 1.0, (vars.longitudLinea + vars.longitudStub) * 1000.0];`
  },
  "corte_chapa": {
    nombre: "Corte y Anidado 2D de Chapa",
    descripcion: "Prioridades de empaquetamiento y rotaciones de 6 piezas para maximizar el aprovechamiento de la chapa matriz.",
    tipoVisualizacion: "corte_chapa_nesting",
    variables: [
      { nombre: "p1", tipo: "continuo", min: 0.0, max: 10.0 },
      { nombre: "p2", tipo: "continuo", min: 0.0, max: 10.0 },
      { nombre: "p3", tipo: "continuo", min: 0.0, max: 10.0 },
      { nombre: "rot1", tipo: "continuo", min: 0.0, max: 1.0 },
      { nombre: "rot2", tipo: "continuo", min: 0.0, max: 1.0 },
      { nombre: "rot3", tipo: "continuo", min: 0.0, max: 1.0 }
    ],
    codigoEvaluacion: `// Minimizar desperdicio de material porcentual y longitud de corte\\nconst ordenDesc = vars.p1 >= vars.p2 && vars.p2 >= vars.p3 ? 0 : 15;\\nconst rotadas = (vars.rot1 > 0.5 ? 1 : 0) + (vars.rot2 > 0.5 ? 1 : 0);\\nreturn [25.0 + ordenDesc - rotadas * 2.0, 320.0 - rotadas * 15.0];`
  }
};

// Aliases canónicos para vincular identificadores de modelos nativos (con guiones) a plantillas
PLANTILLAS_SIMULACION["brazo-robotico"] = PLANTILLAS_SIMULACION["brazo_robotico"];
PLANTILLAS_SIMULACION["campo-potencial"] = PLANTILLAS_SIMULACION["campo_potencial"];
PLANTILLAS_SIMULACION["acustica-beamforming"] = PLANTILLAS_SIMULACION["acustica_beamforming"];
PLANTILLAS_SIMULACION["confinamiento-em"] = PLANTILLAS_SIMULACION["confinamiento_em"];
PLANTILLAS_SIMULACION["superficie-fonoabsorbente"] = PLANTILLAS_SIMULACION["fonoabsorbente"];
PLANTILLAS_SIMULACION["linea-transmision-rf"] = PLANTILLAS_SIMULACION["linea_rf"];
PLANTILLAS_SIMULACION["corte-chapa-nesting"] = PLANTILLAS_SIMULACION["corte_chapa"];

// Sustituye las plantillas por las versiones declarativas oficiales del catálogo JSON.
for (const plantilla of CATALOGO_PREDEFINIDO) {
  if (!plantilla || !plantilla.id) continue;
  PLANTILLAS_SIMULACION[plantilla.id] = plantilla;
  const alias = plantilla.id.replace(/-/g, "_");
  PLANTILLAS_SIMULACION[alias] = plantilla;
}

// Obtiene una copia profunda de una plantilla predefinida a partir de su clave o identificador de modelo.
export function obtenerPlantillaSimulacion(clave) {
  if (!clave) return null;
  const normalizada = String(clave).toLowerCase().trim();
  const conGuion = normalizada.replace(/_/g, "-");
  const conSubguion = normalizada.replace(/-/g, "_");
  const p = PLANTILLAS_SIMULACION[normalizada] || PLANTILLAS_SIMULACION[conGuion] || PLANTILLAS_SIMULACION[conSubguion];
  if (p) {
    return JSON.parse(JSON.stringify(p));
  }
  return null;
}

// Compila de forma segura la función de evaluación inyectando los 4 motores físicos fundamentales y telemetría de sensores CAD.
export function compilarFuncionEvaluacion(codigoFuente) {
  try {
    const fn = new Function(
      "vars",
      "rng",
      "estructuras",
      "cinematica",
      "campos",
      "ondas",
      "topologia",
      "sensores",
      "mecanismo",
      codigoFuente
    );
    return { ok: true, fn };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Convierte un nombre textual arbitrario en un identificador único seguro (slug en minúsculas).
export function generarIdModelo(nombre) {
  const base = nombre
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `dinamico-${base || "modelo"}`;
}

// Valida la integridad estructural de la definición cruda de un modelo antes de su compilación y guardado.
export function validarDefinicionModelo(definicion) {
  if (!definicion || typeof definicion !== "object") {
    throw new Error("La definición del modelo es inválida.");
  }
  if (!definicion.nombre || typeof definicion.nombre !== "string" || !definicion.nombre.trim()) {
    throw new Error("El nombre del modelo no puede estar vacío.");
  }
  if (!Array.isArray(definicion.variables) || definicion.variables.length === 0) {
    throw new Error("Debe definir al menos una variable de decisión.");
  }

  const nombresVistos = new Set();
  const regexIdValido = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  for (let i = 0; i < definicion.variables.length; i++) {
    const v = definicion.variables[i];
    const nombre = (v.nombre || "").trim();

    if (!nombre) {
      throw new Error(`Variable ${i + 1}: El nombre de la variable no puede estar vacío.`);
    }
    if (!regexIdValido.test(nombre)) {
      throw new Error(`Variable '${nombre}': Debe ser un identificador válido de JavaScript (sin espacios ni caracteres especiales).`);
    }
    if (nombresVistos.has(nombre)) {
      throw new Error(`La variable '${nombre}' está duplicada.`);
    }
    nombresVistos.add(nombre);

    const min = Number(v.min);
    const max = Number(v.max);
    if (isNaN(min) || isNaN(max)) {
      throw new Error(`Variable '${nombre}': Los límites mínimo y máximo deben ser números válidos.`);
    }
    if (min >= max) {
      throw new Error(`Variable '${nombre}': El valor mínimo (${min}) debe ser estrictamente menor que el máximo (${max}).`);
    }
    if (v.tipo !== "continuo" && v.tipo !== "entero" && v.tipo !== "categorico") {
      throw new Error(`Variable '${nombre}': El tipo debe ser 'continuo', 'entero' o 'categorico'.`);
    }
  }

  if (!definicion.codigoEvaluacion || typeof definicion.codigoEvaluacion !== "string" || !definicion.codigoEvaluacion.trim()) {
    throw new Error("Debe ingresar el código JavaScript de la función de evaluación.");
  }

  // Prueba de compilación sintáctica en bloque try/catch obligatorio.
  const compilacion = compilarFuncionEvaluacion(definicion.codigoEvaluacion);
  if (!compilacion.ok) {
    throw new Error(`Error de sintaxis en el código de evaluación: ${compilacion.error}`);
  }

  // Prueba de ejecución con valores de prueba (punto medio de cada variable).
  const varsPrueba = {};
  definicion.variables.forEach(v => {
    const mid = (Number(v.min) + Number(v.max)) / 2;
    varsPrueba[v.nombre.trim()] = (v.tipo === "entero" || v.tipo === "categorico") ? Math.round(mid) : mid;
  });

  // Telemetría de sensores de prueba si el modelo incluye mecanismo CAD o sensores
  let telemetriaPrueba = {
    pie: { x: 0, y: -40, velocidad: 0, aceleracionPico: 12.5, zancada: 60, despejeSuelo: 15, emB: 0, emE: 0 },
    efector: { x: 55, y: 40, velocidad: 0, aceleracionPico: 5.0, emB: 0, emE: 0 }
  };
  let grafoInstancia = null;
  if (definicion.grafo) {
    try {
      grafoInstancia = new GrafoMecanismoMultifisica(definicion.grafo);
      const res = simularCicloMecanismo(grafoInstancia, varsPrueba, { pasos: 30 });
      if (res && res.sensores) telemetriaPrueba = { ...telemetriaPrueba, ...res.sensores };
    } catch (_) {}
  }

  try {
    const resPrueba = compilacion.fn(
      varsPrueba,
      Math.random,
      MotorEstructurasCinematica,
      MotorEstructurasCinematica,
      MotorCamposUnificados,
      MotorOndasAcustica,
      MotorFuncionalTopologico,
      telemetriaPrueba,
      grafoInstancia
    );
    const esNumeroValido = typeof resPrueba === "number" && !isNaN(resPrueba);
    const esArregloValido = Array.isArray(resPrueba) && resPrueba.length >= 2 && resPrueba.every(v => typeof v === "number" && !isNaN(v));
    if (!esNumeroValido && !esArregloValido) {
      throw new Error("La función de evaluación debe retornar un número válido o un arreglo de números (para multiobjetivo).");
    }
  } catch (error) {
    throw new Error(`Error al ejecutar el código de prueba con valores iniciales: ${error.message}`);
  }

  return true;
}

// Compila una definición cruda y retorna un objeto de modelo completo cumpliendo el contrato del optimizador.
export function compilarModeloDinamico(definicionCruda) {
  validarDefinicionModelo(definicionCruda);

  const { fn: funcionEvaluacion } = compilarFuncionEvaluacion(definicionCruda.codigoEvaluacion);
  const varsDef = definicionCruda.variables.map(v => ({
    nombre: v.nombre.trim(),
    etiqueta: v.etiqueta || v.nombre.trim(),
    tipo: (v.tipo === "entero" || v.tipo === "categorico") ? v.tipo : "continuo",
    min: Number(v.min),
    max: Number(v.max),
    valorNominal: v.valorNominal !== undefined ? Number(v.valorNominal) : undefined
  }));

  const modeloId = definicionCruda.id || generarIdModelo(definicionCruda.nombre);
  const tipoVisualizacion = definicionCruda.tipoVisualizacion || "calibracion";
  const grafoInstancia = definicionCruda.grafo ? new GrafoMecanismoMultifisica(definicionCruda.grafo) : null;
  const usaSensores = Boolean(grafoInstancia && /\b(sensores|mecanismo)\b/.test(definicionCruda.codigoEvaluacion));
  const telemetriaPorDefecto = {
    pie: { x: 0, y: -40, velocidad: 0, aceleracionPico: 12.5, zancada: 60, despejeSuelo: 15, emB: 0, emE: 0 },
    efector: { x: 55, y: 40, velocidad: 0, aceleracionPico: 5.0, emB: 0, emE: 0 }
  };

  return {
    id: modeloId,
    nombre: definicionCruda.nombre.trim(),
    descripcion: (definicionCruda.descripcion || "Modelo matemático personalizado creado dinámicamente.").trim(),
    tipoVisualizacion,
    grafo: definicionCruda.grafo || null,
    esDinamico: true,
    usaWasm: false,
    usaRuido: false,
    parametrosEntrada: [],
    definicionCruda: {
      ...definicionCruda,
      id: modeloId,
      tipoVisualizacion,
      variables: varsDef,
      grafo: definicionCruda.grafo || null
    },

    // Genera la especificación de los genes a optimizar a partir de las variables definidas.
    crearGenoma() {
      return varsDef.map(v => ({
        nombre: v.nombre,
        etiqueta: v.etiqueta,
        tipo: v.tipo,
        min: v.min,
        max: v.max,
        valorNominal: v.valorNominal
      }));
    },

    // Evalúa el genoma mapeándolo al diccionario vars y ejecutando la función compilada de forma pura y segura.
    evaluar(genoma, entrada, rng) {
      const vars = {};
      for (let i = 0; i < varsDef.length; i++) {
        vars[varsDef[i].nombre] = genoma[i];
      }

      // Telemetría de sensores si el código de evaluación realmente los consume
      let telemetriaSensores = telemetriaPorDefecto;
      if (usaSensores) {
        try {
          const res = simularCicloMecanismo(grafoInstancia, vars, { pasos: 60 });
          if (res && res.sensores) telemetriaSensores = { ...telemetriaPorDefecto, ...res.sensores };
        } catch (_) {}
      }

      try {
        const puntaje = funcionEvaluacion(
          vars,
          rng || Math.random,
          MotorEstructurasCinematica,
          MotorEstructurasCinematica,
          MotorCamposUnificados,
          MotorOndasAcustica,
          MotorFuncionalTopologico,
          telemetriaSensores,
          grafoInstancia
        );
        if (Array.isArray(puntaje)) {
          if (puntaje.length >= 2 && puntaje.every(v => typeof v === "number" && !isNaN(v))) {
            return puntaje;
          }
          return [999999, 999999];
        }
        if (typeof puntaje !== "number" || isNaN(puntaje)) {
          return 999999;
        }
        return puntaje;
      } catch (error) {
        return 999999;
      }
    },

    // Genera un informe textual detallado con las variables encontradas, sus rangos y el fitness resultante.
    describir(genoma) {
      const vars = {};
      for (let i = 0; i < varsDef.length; i++) {
        vars[varsDef[i].nombre] = genoma[i];
      }

      let telemetriaSensores = {
        pie: { x: 0, y: -40, velocidad: 0, aceleracionPico: 12.5, zancada: 60, despejeSuelo: 15, emB: 0, emE: 0 },
        efector: { x: 55, y: 40, velocidad: 0, aceleracionPico: 5.0, emB: 0, emE: 0 }
      };
      if (grafoInstancia) {
        try {
          const res = simularCicloMecanismo(grafoInstancia, vars, { pasos: 60 });
          if (res && res.sensores) telemetriaSensores = { ...telemetriaSensores, ...res.sensores };
        } catch (_) {}
      }

      let fitness = 0;
      try {
        fitness = funcionEvaluacion(
          vars,
          Math.random,
          MotorEstructurasCinematica,
          MotorEstructurasCinematica,
          MotorCamposUnificados,
          MotorOndasAcustica,
          MotorFuncionalTopologico,
          telemetriaSensores,
          grafoInstancia
        );
      } catch (e) {
        fitness = 999999;
      }

      let texto = `MODELO DINÁMICO: ${definicionCruda.nombre.toUpperCase()}\n`;
      texto += `========================================================================\n`;
      texto += `Descripción: ${definicionCruda.descripcion || "Sin descripción"}\n`;
      texto += `Tipo de Representación: ${tipoVisualizacion}\n`;
      texto += `Identificador: ${modeloId}\n\n`;
      texto += `VARIABLES DE DECISIÓN OPTIMIZADAS:\n`;
      texto += `  Variable        | Tipo      | Rango [Mín, Máx]       | Valor Encontrado\n`;
      texto += `  ----------------+-----------+------------------------+-------------------\n`;

      varsDef.forEach((v, idx) => {
        const val = genoma[idx];
        const valStr = v.tipo === "entero" ? Math.round(val).toString() : val.toFixed(4);
        const rangoStr = `[${v.min}, ${v.max}]`;
        texto += `  ${v.nombre.padEnd(15, " ")} | ${v.tipo.padEnd(9, " ")} | ${rangoStr.padEnd(22, " ")} | ${valStr}\n`;
      });

      const fitStr = Array.isArray(fitness) ? `[${fitness.map(f => f.toFixed(4)).join(", ")}]` : fitness.toFixed(6);
      texto += `\nFITNESS FINAL: ${fitStr} (Menor = Mejor)\n`;
      texto += `========================================================================\n`;

      return texto;
    }
  };
}

// Clona una definición de modelo dinámico asignándole un nuevo identificador y nombre con sufijo (Copia).
export function clonarModeloDinamico(definicionOriginal, nuevoNombre = null) {
  const copia = JSON.parse(JSON.stringify(definicionOriginal));
  copia.nombre = (nuevoNombre || `${copia.nombre} (Copia)`).trim();
  copia.id = `${generarIdModelo(copia.nombre)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  return copia;
}

// Clona un modelo (sea dinámico o nativo) generando una definición cruda dinámica editable.
export function clonarModeloExistente(modeloOriginal, nuevoNombre = null) {
  if (modeloOriginal.esDinamico && modeloOriginal.definicionCruda) {
    return clonarModeloDinamico(modeloOriginal.definicionCruda, nuevoNombre);
  }
  const plantilla = obtenerPlantillaSimulacion(modeloOriginal.id);
  const genes = modeloOriginal.crearGenoma ? modeloOriginal.crearGenoma() : [];
  const nombreCopia = (nuevoNombre || `${modeloOriginal.nombre} (Copia)`).trim();

  if (plantilla) {
    return {
      id: `dinamico-${modeloOriginal.id}-${Math.floor(Math.random() * 9000 + 1000)}`,
      nombre: nombreCopia,
      descripcion: `Variante personalizada basada en ${modeloOriginal.nombre}.`,
      tipoVisualizacion: plantilla.tipoVisualizacion || modeloOriginal.tipoVisualizacion || "calibracion",
      grafo: plantilla.grafo || modeloOriginal.grafo || (modeloOriginal.definicionCruda?.grafo) || null,
      variables: plantilla.variables,
      codigoEvaluacion: plantilla.codigoEvaluacion
    };
  }

  return {
    id: `dinamico-${modeloOriginal.id}-${Math.floor(Math.random() * 9000 + 1000)}`,
    nombre: nombreCopia,
    descripcion: `Variante personalizada basada en ${modeloOriginal.nombre}. Modifique las variables y función de evaluación.`,
    tipoVisualizacion: modeloOriginal.tipoVisualizacion || "calibracion",
    variables: genes.map((g, i) => ({
      nombre: g.nombre || `var${i + 1}`,
      etiqueta: g.etiqueta || g.nombre || `Variable ${i + 1}`,
      tipo: g.tipo || "continuo",
      min: g.min !== undefined ? g.min : 0,
      max: g.max !== undefined ? g.max : 100,
      valorNominal: g.valorNominal
    })),
    codigoEvaluacion: `// Definición basada en ${modeloOriginal.nombre}\n// Variables disponibles en 'vars':\nlet coste = 0;\nfor (const k in vars) {\n  coste += Math.pow(vars[k], 2);\n}\nreturn Math.sqrt(coste);`
  };
}

// Renombra un modelo dinámico actualizando su título, descripción e identificador seguro.
export function renombrarModeloDinamico(definicionOriginal, nuevoNombre, nuevaDescripcion = null) {
  const actualizado = JSON.parse(JSON.stringify(definicionOriginal));
  actualizado.nombre = nuevoNombre.trim();
  if (nuevaDescripcion !== null) {
    actualizado.descripcion = nuevaDescripcion.trim();
  }
  return actualizado;
}

// Exporta una definición de modelo dinámico o preset a formato JSON serializado legible.
export function exportarSimulacionJSON(objetoSimulacion) {
  return JSON.stringify(objetoSimulacion, null, 2);
}

// Importa y valida una cadena JSON deserializándola a objeto de simulación.
export function importarSimulacionJSON(jsonString) {
  return JSON.parse(jsonString);
}
