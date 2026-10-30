// =========================================================================
// TEST DE INTEGRACIÓN: VERIFICACIÓN DE LOS 4 RENDERIZADORES DE LIENZO
// =========================================================================

import {
  LienzoCamposRenderer,
  LienzoGeometricoRenderer,
  LienzoTopologicoRenderer,
  LienzoFuncionalRenderer
} from "./js/views/renderers/index.js";

console.log("=== INICIANDO PRUEBAS DE LOS 4 RENDERIZADORES DE LIENZO ===");

// Mock de Canvas y contexto 2D para entorno Node.js
const crearMockCanvas = (ancho = 800, alto = 380) => {
  const ctx = {
    resetTransform: () => {},
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    roundRect: () => {},
    setLineDash: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} })
  };

  return {
    clientWidth: ancho,
    clientHeight: alto,
    width: ancho,
    height: alto,
    getContext: () => ctx
  };
};

// 1. Prueba de LienzoCamposRenderer
console.log("\n[1] Probando LienzoCamposRenderer...");
const rCampos = new LienzoCamposRenderer();
const mockCanvas1 = crearMockCanvas();
rCampos.render(mockCanvas1, {
  mapa: new Float32Array(40 * 28),
  cols: 40,
  filas: 28,
  vMin: -15,
  vMax: 20,
  fuentes: [
    { x: -10, y: 0, q: 2.0 },
    { x: 10, y: 0, q: -2.0 },
    { x: 0, y: 5, mu: 4.0 }
  ],
  trayectoria: [{ x: -20, y: 5 }, { x: -10, y: 8 }, { x: 5, y: 2 }]
});
rCampos.detener();
console.log("    ✓ LienzoCamposRenderer renderizado y detenido correctamente | OK");

// 2. Prueba de LienzoGeometricoRenderer
console.log("\n[2] Probando LienzoGeometricoRenderer...");
const rGeom = new LienzoGeometricoRenderer();
const mockCanvas2 = crearMockCanvas();
rGeom.render(mockCanvas2, {
  nudos: [{ x: 0, y: 0, fijo: true }, { x: 20, y: 0 }, { x: 10, y: 15 }],
  barras: [
    { nudoA: 0, nudoB: 1, fuerzaAxial: -45.0, hayPandeo: false },
    { nudoA: 0, nudoB: 2, fuerzaAxial: 60.0, hayPandeo: false }
  ],
  masaTotalKg: 280.0,
  rayos: [[{ x: 0, y: 0, energia: 100 }, { x: 20, y: 15, energia: 60 }]]
});
rGeom.detener();
console.log("    ✓ LienzoGeometricoRenderer renderizado y detenido correctamente | OK");

// 3. Prueba de LienzoTopologicoRenderer
console.log("\n[3] Probando LienzoTopologicoRenderer...");
const rTopo = new LienzoTopologicoRenderer();
const mockCanvas3 = crearMockCanvas();
// Prueba modo Nesting 2D
rTopo.render(mockCanvas3, {
  anchoChapa: 600,
  altoChapa: 400,
  piezasColocadas: [
    { id: 1, x: 0, y: 0, w: 200, h: 150 },
    { id: 2, x: 200, y: 0, w: 150, h: 100 }
  ],
  porcentajeAprovechamiento: 78.4
});
// Prueba modo Balanceo de Fases
rTopo.render(mockCanvas3, {
  totalesFase: [850, 920, 780],
  promedio: 850
});
rTopo.detener();
console.log("    ✓ LienzoTopologicoRenderer (Nesting 2D y Fases) renderizado correctamente | OK");

// 4. Prueba de LienzoFuncionalRenderer (Carta de Smith)
console.log("\n[4] Probando LienzoFuncionalRenderer (Carta de Smith)...");
const rFunc = new LienzoFuncionalRenderer();
const mockCanvas4 = crearMockCanvas();
rFunc.render(mockCanvas4, {
  puntosSmith: [
    { gammaU: 0.2, gammaV: 0.1 },
    { gammaU: 0.05, gammaV: -0.02 },
    { gammaU: 0.0, gammaV: 0.0 }
  ],
  roe: 1.15,
  perdidasRetornoDb: 23.5,
  zinR: 52.0,
  zinX: 1.5
});
rFunc.detener();
console.log("    ✓ LienzoFuncionalRenderer (Carta de Smith) renderizado correctamente | OK");

console.log("\n=== ¡LOS 4 RENDERIZADORES DE LIENZO PASARON TODAS LAS PRUEBAS (4/4)! ===");
