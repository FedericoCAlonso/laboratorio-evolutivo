// =========================================================================
// REGISTRO CENTRAL DE MOTORES FUNDAMENTALES DE SIMULACIÓN Y FÍSICA
// ARQUITECTURA MVVM - DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER)
// =========================================================================

import { MotorCamposUnificados, CONSTANTES_CAMPOS } from "./campos.js";
import { MotorEstructurasCinematica } from "./estructuras.js";
import { MotorOndasAcustica, CONSTANTES_ACUSTICAS } from "./ondas.js";
import { MotorFuncionalTopologico } from "./topologia.js";
import {
  GrafoMecanismoMultifisica,
  analizarGradosLibertad,
  resolverPasoMecanismo,
  simularCicloMecanismo,
  crearGrafoPataCaminante,
  crearGrafoTrenEngranajes,
  crearGrafoBrazoRobotico
} from "./mecanismos.js";

// Reexporta las clases y constantes de los motores fundamentales
export {
  MotorCamposUnificados,
  CONSTANTES_CAMPOS,
  MotorEstructurasCinematica,
  MotorOndasAcustica,
  CONSTANTES_ACUSTICAS,
  MotorFuncionalTopologico,
  GrafoMecanismoMultifisica,
  analizarGradosLibertad,
  resolverPasoMecanismo,
  simularCicloMecanismo,
  crearGrafoPataCaminante,
  crearGrafoTrenEngranajes,
  crearGrafoBrazoRobotico
};

// Diccionario de instancias de motores fundamentales
export const MOTORES_SIMULACION = {
  campos: new MotorCamposUnificados(),
  estructuras: new MotorEstructurasCinematica(),
  ondas: new MotorOndasAcustica(),
  topologia: MotorFuncionalTopologico,
  mecanismos: GrafoMecanismoMultifisica
};

export default MOTORES_SIMULACION;
