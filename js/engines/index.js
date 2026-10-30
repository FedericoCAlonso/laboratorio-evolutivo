// =========================================================================
// REGISTRO CENTRAL DE MOTORES FUNDAMENTALES DE SIMULACIÓN Y FÍSICA
// ARQUITECTURA MVVM - DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER)
// =========================================================================

import { MotorCamposUnificados, CONSTANTES_CAMPOS } from "./campos.js";
import { MotorEstructurasCinematica } from "./estructuras.js";
import { MotorOndasAcustica, CONSTANTES_ACUSTICAS } from "./ondas.js";
import { MotorFuncionalTopologico } from "./topologia.js";

// Reexporta las clases y constantes de los 4 motores para consumo desacoplado
export {
  MotorCamposUnificados,
  CONSTANTES_CAMPOS,
  MotorEstructurasCinematica,
  MotorOndasAcustica,
  CONSTANTES_ACUSTICAS,
  MotorFuncionalTopologico
};

// Diccionario de instancias de motores fundamentales
export const MOTORES_SIMULACION = {
  campos: new MotorCamposUnificados(),
  estructuras: new MotorEstructurasCinematica(),
  ondas: new MotorOndasAcustica(),
  topologia: MotorFuncionalTopologico
};

export default MOTORES_SIMULACION;
