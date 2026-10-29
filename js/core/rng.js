// =========================================================================
// MÓDULO: GENERADOR DE NÚMEROS PSEUDOALEATORIOS DETERMINISTA (MULBERRY32)
// =========================================================================

// Generador pseudoaleatorio mulberry32 determinista basado en una semilla entera de 32 bits para reproducibilidad exacta.
export function crearPrngMulberry32(semilla) {
  // Estado interno entero de 32 bits sin signo derivado de la semilla inicial provista.
  let s = Math.floor(semilla) >>> 0;

  // Función generadora determinista que retorna un número flotante pseudoaleatorio en el intervalo [0, 1).
  return function siguienteRandom() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
