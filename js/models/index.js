// =========================================================================
// MÓDULO: REGISTRO CENTRAL DE MODELOS DE OPTIMIZACIÓN
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

import { ModeloBalanceoFases } from "./fases.js";
import { ModeloPataCaminante } from "./caminante.js";
import { ModeloBrazoRobotico } from "./brazo.js";
import { ModeloCoheteLanding } from "./cohete.js";
import { ModeloControladorPID } from "./pid.js";
import { ModeloCampoPotencial } from "./potencial.js";
import { ModeloTransferenciaOrbital } from "./orbita.js";
import { ModeloFiltroRLC } from "./filtro.js";
import { ModeloArmaduraPuente } from "./armadura.js";
import { ModeloDistribucionTermica } from "./termico.js";
import { ModeloArregloAcustico } from "./acustica.js";
import { ModeloConfinamientoEM } from "./electromagnetismo.js";
import { ModeloSuperficieFonoabsorbente } from "./fonoabsorbente.js";
import { ModeloLineaTransmisionRF } from "./linea-rf.js";
import { ModeloCorteChapaNesting } from "./nesting.js";
import { compilarModeloDinamico } from "../builder.js";
import { PLANTILLAS_FIELES } from "../plantillas/index.js";

// Reexporta los modelos individuales para facilitar su importación directa.
export {
  ModeloBalanceoFases,
  ModeloPataCaminante,
  ModeloBrazoRobotico,
  ModeloCoheteLanding,
  ModeloControladorPID,
  ModeloCampoPotencial,
  ModeloTransferenciaOrbital,
  ModeloFiltroRLC,
  ModeloArmaduraPuente,
  ModeloDistribucionTermica,
  ModeloArregloAcustico,
  ModeloConfinamientoEM,
  ModeloSuperficieFonoabsorbente,
  ModeloLineaTransmisionRF,
  ModeloCorteChapaNesting
};

// Lista global de todos los modelos de optimización disponibles en la aplicación (estáticos y dinámicos).
export const MODELOS = [
  ModeloBrazoRobotico,
  ModeloCoheteLanding,
  ModeloControladorPID,
  ModeloCampoPotencial,
  ModeloTransferenciaOrbital,
  ModeloFiltroRLC,
  ModeloArmaduraPuente,
  ModeloDistribucionTermica,
  ModeloArregloAcustico,
  ModeloConfinamientoEM,
  ModeloSuperficieFonoabsorbente,
  ModeloLineaTransmisionRF,
  ModeloCorteChapaNesting,
  ModeloBalanceoFases,
  ModeloPataCaminante
];

// Dota de nombre, etiqueta, grafo y código editable a cada modelo nativo, tomándolos de su plantilla fiel.
MODELOS.forEach(modelo => {
  const plantilla = PLANTILLAS_FIELES[modelo.id];
  if (!plantilla) return;
  if (!modelo.grafo && plantilla.grafo) {
    modelo.grafo = plantilla.grafo;
  }
  if (!modelo.codigoEvaluacion && plantilla.codigoEvaluacion) {
    modelo.codigoEvaluacion = plantilla.codigoEvaluacion;
  }
  if (!modelo.tipoVisualizacion && plantilla.tipoVisualizacion) {
    modelo.tipoVisualizacion = plantilla.tipoVisualizacion;
  }
  if (typeof modelo.crearGenoma === "function") {
    const crearOriginal = modelo.crearGenoma.bind(modelo);
    modelo.crearGenoma = (...args) => crearOriginal(...args).map((gen, i) => {
      const v = plantilla.variables?.[i] || {};
      return {
        ...gen,
        nombre: gen.nombre || v.nombre || `var${i + 1}`,
        etiqueta: gen.etiqueta || v.etiqueta || v.nombre,
        valorNominal: gen.valorNominal !== undefined ? gen.valorNominal : v.valorNominal
      };
    });
  }
});

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
