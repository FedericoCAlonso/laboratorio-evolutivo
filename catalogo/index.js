// =========================================================================
// MÓDULO: CATÁLOGO CENTRAL DE MODELOS DE OPTIMIZACIÓN (JSON DATA-DRIVEN)
// REGISTRO UNIFICADO DE DEFINICIONES Y MODELOS COMPILADOS PARA EL OPTIMIZADOR
// =========================================================================

import {
  CATALOGO_PREDEFINIDO,
  CATALOGO_POR_ID,
  obtenerDefinicionCatalogo,
  obtenerModeloCatalogo
} from "./definiciones.js";

import { compilarModeloDinamico } from "../js/builder.js";

// Re-exporta definiciones declarativas
export {
  CATALOGO_PREDEFINIDO,
  CATALOGO_POR_ID,
  obtenerDefinicionCatalogo,
  obtenerModeloCatalogo
};

// Lista global de todos los modelos compilados listos para optimización
export const MODELOS = CATALOGO_PREDEFINIDO.map(def => {
  const modeloCompilado = compilarModeloDinamico(def);
  modeloCompilado.esCatalogoOriginal = true;
  return modeloCompilado;
});

// Registra un nuevo modelo dinámico compilado en la lista global evitando duplicados por identificador
export function registrarModeloDinamico(modelo) {
  const indice = MODELOS.findIndex(m => m.id === modelo.id);
  if (indice >= 0) {
    MODELOS[indice] = modelo;
  } else {
    MODELOS.push(modelo);
  }
  return modelo;
}

// Elimina un modelo dinámico de la lista de modelos registrados (protegiendo los del catálogo original)
export function eliminarModeloDinamicoDelRegistro(id) {
  const indice = MODELOS.findIndex(m => m.id === id);
  if (indice >= 0 && (MODELOS[indice].esDinamico && !MODELOS[indice].esCatalogoOriginal)) {
    MODELOS.splice(indice, 1);
    return true;
  }
  return false;
}

// Compila e incorpora al registro central una lista de definiciones crudas provenientes del almacenamiento persistente
export function cargarModelosDinamicosEnRegistro(definicionesCrudas = []) {
  definicionesCrudas.forEach(def => {
    try {
      const compilado = compilarModeloDinamico(def);
      registrarModeloDinamico(compilado);
    } catch (error) {
      console.warn(`[Catálogo] No se pudo cargar el modelo dinámico '${def?.nombre}':`, error.message);
    }
  });
}

// Busca y retorna un modelo registrado a partir de su identificador textual único
export function obtenerModeloPorId(id) {
  if (!id) return MODELOS[0];
  const normalizado = String(id).toLowerCase().trim().replace(/_/g, "-");
  return MODELOS.find(m => m.id === normalizado || m.id === id) || MODELOS[0];
}

export default MODELOS;
