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

// Clave utilizada para almacenar la lista de escenarios o presets completos de simulación.
export const CLAVE_PRESETS = "laboratorio_presets_simulacion_v1";

// Guarda la lista de escenarios o presets guardados en localStorage con try/catch.
export function guardarPresets(presets) {
  try {
    const serializado = JSON.stringify(presets);
    localStorage.setItem(CLAVE_PRESETS, serializado);
    return true;
  } catch (error) {
    console.warn("[Storage] No se pudieron guardar los presets:", error.message);
    return false;
  }
}

// Recupera y deserializa los presets de simulación guardados desde localStorage.
export function cargarPresets() {
  try {
    const crudo = localStorage.getItem(CLAVE_PRESETS);
    if (!crudo) return [];
    const parseado = JSON.parse(crudo);
    return Array.isArray(parseado) ? parseado : [];
  } catch (error) {
    console.warn("[Storage] No se pudieron leer los presets:", error.message);
    return [];
  }
}

// Guarda o actualiza un preset de simulación en localStorage.
export function guardarUnPreset(preset) {
  try {
    const presets = cargarPresets();
    const indice = presets.findIndex(p => p.id === preset.id);
    if (indice >= 0) {
      presets[indice] = preset;
    } else {
      presets.push(preset);
    }
    return guardarPresets(presets);
  } catch (error) {
    console.warn("[Storage] Error al guardar el preset:", error.message);
    return false;
  }
}

// Elimina un preset de simulación persistido a partir de su identificador.
export function eliminarPreset(id) {
  try {
    const presets = cargarPresets();
    const filtrados = presets.filter(p => p.id !== id);
    return guardarPresets(filtrados);
  } catch (error) {
    console.warn("[Storage] Error al eliminar el preset:", error.message);
    return false;
  }
}

// Clave utilizada para almacenar las preferencias de tema y paleta de color Material 3.
export const CLAVE_TEMA = "laboratorio_tema_preferencias_v1";

// Guarda las preferencias del tema de usuario (modo: light/dark/auto y acento: ocean/emerald/amethyst/terracotta).
export function guardarPreferenciaTema(tema) {
  try {
    localStorage.setItem(CLAVE_TEMA, JSON.stringify(tema));
    return true;
  } catch (error) {
    console.warn("[Storage] No se pudieron guardar las preferencias de tema:", error.message);
    return false;
  }
}

// Recupera las preferencias del tema de usuario desde localStorage.
export function cargarPreferenciaTema() {
  try {
    const crudo = localStorage.getItem(CLAVE_TEMA);
    if (!crudo) return { modo: "auto", acento: "ocean" };
    return JSON.parse(crudo);
  } catch (error) {
    console.warn("[Storage] No se pudieron leer las preferencias de tema:", error.message);
    return { modo: "auto", acento: "ocean" };
  }
}
