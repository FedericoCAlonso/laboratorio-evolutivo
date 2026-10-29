// =========================================================================
// MÓDULO: PERSISTENCIA LOCAL (LOCALSTORAGE CON CONTROL DE ERRORES)
// =========================================================================

// Clave utilizada para almacenar y recuperar la configuración de la PWA en localStorage.
export const CLAVE_STORAGE = "laboratorio_evolutivo_config_v2";

// Persiste el estado de configuración de la aplicación en localStorage de forma segura con try/catch.
export function guardarConfiguracion(configuracion) {
  try {
    const serializado = JSON.stringify(configuracion);
    localStorage.setItem(CLAVE_STORAGE, serializado);
    return true;
  } catch (error) {
    console.warn("[Storage] No se pudo guardar en localStorage:", error.message);
    return false;
  }
}

// Recupera y deserializa la configuración previa desde localStorage con control de excepciones.
export function cargarConfiguracion() {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return null;
    return JSON.parse(crudo);
  } catch (error) {
    console.warn("[Storage] No se pudo leer de localStorage:", error.message);
    return null;
  }
}

// Elimina cualquier configuración previa almacenada en localStorage.
export function limpiarConfiguracion() {
  try {
    localStorage.removeItem(CLAVE_STORAGE);
    return true;
  } catch (error) {
    console.warn("[Storage] No se pudo limpiar localStorage:", error.message);
    return false;
  }
}

// Clave utilizada para almacenar la lista de definiciones crudas de modelos dinámicos en localStorage.
export const CLAVE_MODELOS_DINAMICOS = "laboratorio_modelos_dinamicos_v1";

// Guarda la lista completa de definiciones crudas de modelos dinámicos en localStorage con try/catch.
export function guardarModelosDinamicos(modelosCrudos) {
  try {
    const serializado = JSON.stringify(modelosCrudos);
    localStorage.setItem(CLAVE_MODELOS_DINAMICOS, serializado);
    return true;
  } catch (error) {
    console.warn("[Storage] No se pudieron guardar los modelos dinámicos:", error.message);
    return false;
  }
}

// Recupera y deserializa el arreglo de definiciones crudas de modelos dinámicos desde localStorage.
export function cargarModelosDinamicos() {
  try {
    const crudo = localStorage.getItem(CLAVE_MODELOS_DINAMICOS);
    if (!crudo) return [];
    const parseado = JSON.parse(crudo);
    return Array.isArray(parseado) ? parseado : [];
  } catch (error) {
    console.warn("[Storage] No se pudieron leer los modelos dinámicos:", error.message);
    return [];
  }
}

// Agrega o actualiza una definición de modelo dinámico en el listado persistido.
export function guardarUnModeloDinamico(modeloCrudo) {
  try {
    const modelos = cargarModelosDinamicos();
    const indiceExistente = modelos.findIndex(m => m.id === modeloCrudo.id);
    if (indiceExistente >= 0) {
      modelos[indiceExistente] = modeloCrudo;
    } else {
      modelos.push(modeloCrudo);
    }
    return guardarModelosDinamicos(modelos);
  } catch (error) {
    console.warn("[Storage] Error al persistir el modelo dinámico:", error.message);
    return false;
  }
}

// Elimina una definición de modelo dinámico persistida a partir de su identificador.
export function eliminarModeloDinamico(id) {
  try {
    const modelos = cargarModelosDinamicos();
    const filtrados = modelos.filter(m => m.id !== id);
    return guardarModelosDinamicos(filtrados);
  } catch (error) {
    console.warn("[Storage] Error al eliminar el modelo dinámico:", error.message);
    return false;
  }
}
