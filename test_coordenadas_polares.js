// =========================================================================
// TEST: UTILIDADES Y PARAMETRIZACIÓN POLAR (ABSOLUTA Y RELATIVA) EN CAD 2D
// =========================================================================

import {
  GrafoMecanismoMultifisica,
  cartesianoAPolar,
  polarACartesiano,
  calcularPolarBarra,
  ajustarBarraPolar
} from "./js/engines/mecanismos.js";

console.log("=== INICIANDO PRUEBAS DE COORDENADAS POLARES (ABSOLUTAS Y RELATIVAS) ===");

// 1. Verificación de conversiones cartesianas a polares
console.log("\n[1] Verificando conversiones cartesianoAPolar y polarACartesiano...");

const p0 = cartesianoAPolar(10, 0);
if (Math.abs(p0.r - 10) > 1e-4 || Math.abs(p0.thetaDeg - 0) > 1e-4) {
  throw new Error(`Error en polar (10, 0): obtenido r=${p0.r}, theta=${p0.thetaDeg}`);
}

const p90 = cartesianoAPolar(0, 10);
if (Math.abs(p90.r - 10) > 1e-4 || Math.abs(p90.thetaDeg - 90) > 1e-4) {
  throw new Error(`Error en polar (0, 10): obtenido r=${p90.r}, theta=${p90.thetaDeg}`);
}

const c1 = polarACartesiano(10, 90);
if (Math.abs(c1.x - 0) > 1e-4 || Math.abs(c1.y - 10) > 1e-4) {
  throw new Error(`Error en cartesiano (10, 90°): obtenido x=${c1.x}, y=${c1.y}`);
}

const cCentro = polarACartesiano(20, 180, { x: 50, y: 50 });
if (Math.abs(cCentro.x - 30) > 1e-4 || Math.abs(cCentro.y - 50) > 1e-4) {
  throw new Error(`Error con centro personalizado: obtenido (${cCentro.x}, ${cCentro.y}), esperado (30, 50)`);
}
console.log("    ✓ Conversiones bidireccionales cartesiano <-> polar exactas | OK");

// 2. Verificación de cálculo polar absoluto y relativo en cadenas de barras
console.log("\n[2] Verificando análisis de polar absoluta (θ) y relativa (Δθ) en eslabones...");

const grafo = new GrafoMecanismoMultifisica();
grafo.agregarNodo({ id: "n0", nombre: "Origen", x: 0, y: 0, tipo: "fijo" });
grafo.agregarNodo({ id: "n1", nombre: "Codo", x: 10, y: 0, tipo: "libre" });
grafo.agregarNodo({ id: "n2", nombre: "Extremo", x: 10, y: 10, tipo: "libre" });

grafo.agregarBarra({ id: "b1", nombre: "Barra 1", nodoA: "n0", nodoB: "n1", longitud: 10 });
grafo.agregarBarra({ id: "b2", nombre: "Barra 2", nodoA: "n1", nodoB: "n2", longitud: 10 });

const polarB1 = calcularPolarBarra(grafo.barras[0], grafo);
if (polarB1.r !== 10 || polarB1.thetaDeg !== 0 || polarB1.tienePrevio) {
  throw new Error(`Error en polarB1: ${JSON.stringify(polarB1)}`);
}
console.log(`    ✓ Barra 1 (Base): r=${polarB1.r} mm, θ=${polarB1.thetaDeg}° | OK`);

const polarB2 = calcularPolarBarra(grafo.barras[1], grafo);
// De (10,0) a (10,10): dx=0, dy=10 => θ=90°. Barra previa orientada a 0° => Δθ = 90°
if (polarB2.r !== 10 || polarB2.thetaDeg !== 90 || polarB2.deltaThetaDeg !== 90 || !polarB2.tienePrevio) {
  throw new Error(`Error en polarB2: ${JSON.stringify(polarB2)}`);
}
console.log(`    ✓ Barra 2 (Encadenada): r=${polarB2.r} mm, θ=${polarB2.thetaDeg}°, Δθ=${polarB2.deltaThetaDeg}° relativo a Barra 1 | OK`);

// 3. Verificación de rotación / ajuste polar
console.log("\n[3] Verificando ajuste polar reactivo (ajustarBarraPolar)...");

// Girar Barra 2 con ángulo relativo de 45° respecto a Barra 1 (orientada a 0°) -> nuevo θ = 45°
ajustarBarraPolar(grafo.barras[1], grafo, { nuevoAngulo: 45, esRelativo: true });
const nodo2 = grafo.nodos.find(n => n.id === "n2");
const polarB2Mod = calcularPolarBarra(grafo.barras[1], grafo);

if (Math.abs(polarB2Mod.deltaThetaDeg - 45) > 0.2 || Math.abs(polarB2Mod.thetaDeg - 45) > 0.2) {
  throw new Error(`Error al ajustar ángulo relativo 45°: ${JSON.stringify(polarB2Mod)}`);
}
console.log(`    ✓ Barra 2 reorientada a Δθ=45°: Extremo en (${nodo2.x}, ${nodo2.y}) mm | OK`);

// Ajustar ángulo absoluto a 180° (apuntando a la izquierda)
ajustarBarraPolar(grafo.barras[1], grafo, { nuevoAngulo: 180, esRelativo: false });
const polarB2Abs = calcularPolarBarra(grafo.barras[1], grafo);
if (Math.abs(polarB2Abs.thetaDeg - 180) > 0.2) {
  throw new Error(`Error al ajustar ángulo absoluto 180°: ${JSON.stringify(polarB2Abs)}`);
}
console.log(`    ✓ Barra 2 reorientada a θ=180° absoluto: Extremo en (${nodo2.x}, ${nodo2.y}) mm | OK`);

console.log("\n=== ¡TODAS LAS PRUEBAS DE COORDENADAS POLARES PASARON EXITOSAMENTE! ===");
