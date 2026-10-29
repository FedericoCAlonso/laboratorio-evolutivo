// =========================================================================
// MÓDULO: REGISTRO CENTRAL DE MODELOS DE OPTIMIZACIÓN
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

import { ModeloBalanceoFases } from "./fases.js";
import { ModeloPataCaminante } from "./caminante.js";
import { ModeloPataJansen } from "./jansen.js";
import { ModeloBrazoRobotico } from "./brazo.js";
import { ModeloCoheteLanding } from "./cohete.js";
import { ModeloControladorPID } from "./pid.js";
import { ModeloCampoPotencial } from "./potencial.js";
import { ModeloTransferenciaOrbital } from "./orbita.js";
import { ModeloFiltroRLC } from "./filtro.js";
import { ModeloArmaduraPuente } from "./armadura.js";
import { ModeloDistribucionTermica } from "./termico.js";
import { compilarModeloDinamico } from "../builder.js";

// Reexporta los modelos individuales para facilitar su importación directa.
export {
  ModeloBalanceoFases,
  ModeloPataCaminante,
  ModeloPataJansen,
  ModeloBrazoRobotico,
  ModeloCoheteLanding,
  ModeloControladorPID,
  ModeloCampoPotencial,
  ModeloTransferenciaOrbital,
  ModeloFiltroRLC,
  ModeloArmaduraPuente,
  ModeloDistribucionTermica
};

// Lista global de todos los modelos de optimización disponibles en la aplicación (estáticos y dinámicos).
export const MODELOS = [
  ModeloPataJansen,
  ModeloBrazoRobotico,
  ModeloCoheteLanding,
  ModeloControladorPID,
  ModeloCampoPotencial,
  ModeloTransferenciaOrbital,
  ModeloFiltroRLC,
  ModeloArmaduraPuente,
  ModeloDistribucionTermica,
  ModeloBalanceoFases,
  ModeloPataCaminante
];

// Registra un nuevo modelo dinámico compilado en la lista global evitando duplicados por identificador.
export function registrarModeloDinamico(modelo) {
  const indice = MODELOS.findIndex(m => m.id === modelo.id);
  if (indice >= 0) {
    MODELOS[indice] = modelo;
  } else {
    MODELOS.push(modelo);
  }
  return modelo;
}

// Elimina un modelo dinámico de la lista de modelos registrados.
export function eliminarModeloDinamicoDelRegistro(id) {
  const indice = MODELOS.findIndex(m => m.id === id);
  if (indice >= 0 && MODELOS[indice].esDinamico) {
    MODELOS.splice(indice, 1);
    return true;
  }
  return false;
}

// Compila e incorpora al registro central una lista de definiciones crudas provenientes del almacenamiento persistente.
export function cargarModelosDinamicosEnRegistro(definicionesCrudas = []) {
  definicionesCrudas.forEach(def => {
    try {
      const compilado = compilarModeloDinamico(def);
      registrarModeloDinamico(compilado);
    } catch (error) {
      console.warn(`[Modelos] No se pudo cargar el modelo dinámico '${def?.nombre}':`, error.message);
    }
  });
}

// Busca y retorna un modelo registrado a partir de su identificador textual único.
export function obtenerModeloPorId(id) {
  return MODELOS.find(m => m.id === id) || MODELOS[0];
}

export default MODELOS;
