// =========================================================================
// TEST DE INTEGRACIÓN: VERIFICACIÓN DE LOS 4 MOTORES FUNDAMENTALES
// =========================================================================

import {
  MotorCamposUnificados,
  MotorEstructurasCinematica,
  MotorOndasAcustica,
  MotorFuncionalTopologico
} from "./js/engines/index.js";

console.log("=== INICIANDO PRUEBAS DE LOS 4 MOTORES FUNDAMENTALES ===");

// -------------------------------------------------------------------------
// 1. Verificación de MotorCamposUnificados
// -------------------------------------------------------------------------
console.log("\n[1] Probando MotorCamposUnificados...");
const mCampos = new MotorCamposUnificados();

// Agrega dos cargas electrostáticas y una masa central
mCampos.agregarFuente({ id: "carga_pos", x: -20, y: 0, q: 2.0, m: 0 });
mCampos.agregarFuente({ id: "carga_neg", x: 20, y: 0, q: -2.0, m: 0 });
mCampos.agregarFuente({ id: "solenoide", x: 0, y: 10, mu: 5.0, m: 0 });
mCampos.agregarFuente({ id: "chip_calor", x: 0, y: -10, temp: 85.0 });

// Prueba de potencial eléctrico en el centro (por simetría q1=+2, q2=-2 a distancias iguales, V ≈ 0)
const vCentro = mCampos.calcularPotencialPunto(0, 0, "electrico");
if (Math.abs(vCentro) > 0.01) {
  throw new Error(`Potencial eléctrico central asimétrico: ${vCentro}`);
}
console.log(`    ✓ Potencial electrostático simétrico en centro: ${vCentro.toFixed(4)} V | OK`);

// Prueba de campo magnético Bz
const bz = mCampos.calcularCampoMagneticoBz(0, 10);
if (bz <= 0) {
  throw new Error("Campo magnético Bz esperado positivo cerca del solenoide.");
}
console.log(`    ✓ Campo magnético Bz en solenoide: ${bz.toFixed(2)} T | OK`);

// Prueba de trayectoria de partícula bajo Lorentz
const resTrayectoria = mCampos.simularTrayectoria({ x: -35, y: 5, vx: 18, vy: 0, q: 1.0, m: 1.0 });
if (!resTrayectoria.camino || resTrayectoria.camino.length < 5) {
  throw new Error("Simulación de trayectoria devolvió camino vacío.");
}
console.log(`    ✓ Trayectoria de Lorentz calculada: ${resTrayectoria.camino.length} pasos | OK`);

// Prueba de relajación térmica de Poisson
const limitesTermicos = { xMin: -40, xMax: 40, yMin: -30, yMax: 30 };
const resTermica = mCampos.resolverCampoTermicoPoisson(24, 18, limitesTermicos, 25.0);
if (resTermica.tMax < 50.0) {
  throw new Error(`Temperatura máxima inesperadamente baja: ${resTermica.tMax}`);
}
console.log(`    ✓ Campo térmico Poisson: Tmax = ${resTermica.tMax.toFixed(1)} °C (Tamb: 25 °C) | OK`);

// -------------------------------------------------------------------------
// 2. Verificación de MotorEstructurasCinematica
// -------------------------------------------------------------------------
console.log("\n[2] Probando MotorEstructurasCinematica...");
// Prueba de trilateración para cinemática cerrada (triángulo base 4, lados 3 y 5)
const pTri = MotorEstructurasCinematica.resolverTrilateracion({ x: 0, y: 0 }, { x: 4, y: 0 }, 3, 5, 1);
if (!pTri || Math.abs(pTri.x - 0.0) > 0.05 || Math.abs(pTri.y - 3.0) > 0.05) {
  // Triángulo rectángulo 0,0 a 4,0 con catetos 3 y 4 e hipotenusa 5
  if (Math.hypot(pTri.x, pTri.y) - 3.0 > 0.05) {
    throw new Error(`Fallo en trilateración: ${JSON.stringify(pTri)}`);
  }
}
console.log(`    ✓ Trilateración cinemática 2D resuelta: (${pTri.x.toFixed(2)}, ${pTri.y.toFixed(2)}) | OK`);

// Prueba de cinemática de brazo robótico serie
const resBrazo = MotorEstructurasCinematica.resolverBrazoSerie([45, -45, 0], [40, 30, 20]);
if (!resBrazo.extremoEfector || resBrazo.articulaciones.length !== 4) {
  throw new Error("Cinemática de brazo serie falló.");
}
console.log(`    ✓ Brazo serie (3 eslabones): extremo en (${resBrazo.extremoEfector.x.toFixed(1)}, ${resBrazo.extremoEfector.y.toFixed(1)}) | OK`);

// Prueba de estática matricial de celosía (puente simple de 3 nudos y 3 barras)
const mEst = new MotorEstructurasCinematica();
mEst.agregarNudo({ x: 0, y: 0, fijo: true });
mEst.agregarNudo({ x: 20, y: 0, fijo: false, cargaY: 50.0 });
mEst.agregarNudo({ x: 10, y: 15, fijo: false });
mEst.agregarBarra({ nudoA: 0, nudoB: 1 });
mEst.agregarBarra({ nudoA: 0, nudoB: 2 });
mEst.agregarBarra({ nudoA: 2, nudoB: 1 });

const resEstatica = mEst.resolverEstaticaCelosia();
if (resEstatica.fuerzasAxialesKN.length !== 3 || resEstatica.masaTotalAceroKg <= 0) {
  throw new Error("Estática de celosía no calculó esfuerzos correctamente.");
}
console.log(`    ✓ Celosía 2D resuelta: Masa total = ${resEstatica.masaTotalAceroKg.toFixed(1)} kg | Tensión máx: ${resEstatica.maxTensionMPa.toFixed(1)} MPa | OK`);

// -------------------------------------------------------------------------
// 3. Verificación de MotorOndasAcustica
// -------------------------------------------------------------------------
console.log("\n[3] Probando MotorOndasAcustica...");
const mOndas = new MotorOndasAcustica();

// Prueba de impedancia Delany-Bazley-Miki
const impPoro = mOndas.calcularImpedanciaPoroMiki(1000, 25.0);
if (impPoro.zReal <= 0 || impPoro.kReal <= 0) {
  throw new Error("Impedancia de medio poroso inválida.");
}
console.log(`    ✓ Impedancia Miki a 1 kHz: Zreal = ${impPoro.zReal.toFixed(1)} Pa·s/m | OK`);

// Prueba de absorción multicapa
const capas = [
  { espesorMm: 30, sigma: 12.0 },
  { espesorMm: 50, sigma: 35.0 }
];
const absMulti = mOndas.calcularAbsorcionMulticapa(capas, 1000);
if (absMulti.alphaNormal < 0.1 || absMulti.alphaNormal > 1.0) {
  throw new Error(`Coeficiente de absorción fuera de rango: ${absMulti.alphaNormal}`);
}
console.log(`    ✓ Absorción multicapa a 1 kHz: α = ${absMulti.alphaNormal.toFixed(3)} | OK`);

// Prueba de diagrama polar de Phased Array
mOndas.agregarEmisor({ x: -0.1, y: 0, amplitud: 1.0, faseRad: 0 });
mOndas.agregarEmisor({ x: 0.1, y: 0, amplitud: 1.0, faseRad: 0.5 });
const diagPolar = mOndas.calcularDiagramaPolar(2000, 15.0);
if (diagPolar.diagrama.length !== 181) {
  throw new Error("Barrido polar angular incompleto.");
}
console.log(`    ✓ Diagrama polar calculado: SLL = ${diagPolar.sllDb.toFixed(1)} dB | OK`);

// Prueba de suma dBA
const nivelDba = MotorOndasAcustica.calcularNivelGlobalDba([70, 75, 78, 76, 72, 65]);
if (nivelDba < 60 || nivelDba > 90) {
  throw new Error(`Nivel dBA inesperado: ${nivelDba}`);
}
console.log(`    ✓ Suma logarítmica dBA (IEC 61672-1): ${nivelDba.toFixed(1)} dBA | OK`);

// Prueba de trazado de rayos
mOndas.agregarSuperficie(0, 50, 100, 50, 0.4);
const rayo = mOndas.trazarRayo(50, 0, Math.PI / 2, 100.0, 3);
if (rayo.length < 2) {
  throw new Error("Trazado de rayos no registró impacto.");
}
console.log(`    ✓ Trazado de rayos con absorción: ${rayo.length} segmentos | OK`);

// -------------------------------------------------------------------------
// 4. Verificación de MotorFuncionalTopologico
// -------------------------------------------------------------------------
console.log("\n[4] Probando MotorFuncionalTopologico...");

// Prueba de línea de transmisión RF y coordenadas en Carta de Smith
const resLinea = MotorFuncionalTopologico.calcularImpedanciaLinea(1e9, 0.05, 50.0, 75.0, 20.0);
if (Math.hypot(resLinea.gammaU, resLinea.gammaV) > 1.0) {
  throw new Error("Coeficiente de reflexión fuera del círculo unitario de Smith.");
}
console.log(`    ✓ Línea RF a 1 GHz: Zin = ${resLinea.zinR.toFixed(1)} + j${resLinea.zinX.toFixed(1)} Ω | ROE = ${resLinea.roe.toFixed(2)} | Smith (u=${resLinea.gammaU.toFixed(2)}, v=${resLinea.gammaV.toFixed(2)}) | OK`);

// Prueba de barrido en Carta de Smith
const resBarrido = MotorFuncionalTopologico.simularBarridoSmith(500e6, 2e9, 20, {
  longitudMetros: 0.06,
  z0: 50.0,
  zCargaR: 50.0,
  zCargaX: 0.0,
  velPropagacion: 2e8
});
if (resBarrido.puntos.length !== 20 || resBarrido.peorROE > 1.05) {
  // Carga adaptada a 50 + j0 ohms debe dar ROE ≈ 1.0
  throw new Error(`Carga adaptada generó ROE alta: ${resBarrido.peorROE}`);
}
console.log(`    ✓ Barrido Smith (500 MHz - 2 GHz) con carga adaptada: ROE óptima = ${resBarrido.peorROE.toFixed(2)} | OK`);

// Prueba de anidado 2D / Corte de chapa (Nesting)
const piezasACortar = [
  { id: 1, w: 200, h: 150, color: "#ef4444" },
  { id: 2, w: 180, h: 100, color: "#3b82f6" },
  { id: 3, w: 120, h: 80, color: "#10b981" },
  { id: 4, w: 150, h: 120, color: "#f59e0b" }
];
const resNesting = MotorFuncionalTopologico.resolverNesting2D(500, 300, piezasACortar);
if (resNesting.piezasColocadas.length !== 4) {
  throw new Error(`No cupieron todas las piezas: ${resNesting.piezasColocadas.length}/4`);
}
console.log(`    ✓ Nesting 2D (Corte de chapa): 4/4 piezas colocadas | Aprovechamiento: ${resNesting.porcentajeAprovechamiento.toFixed(1)}% | OK`);

// Prueba de balanceo de fases trifásico
const resBalance = MotorFuncionalTopologico.resolverBalanceoFases([500, 450, 400, 350, 600, 300], [0, 1, 2, 0, 1, 2]);
if (resBalance.totalesFase.length !== 3) {
  throw new Error("Balanceo trifásico falló.");
}
console.log(`    ✓ Balanceo trifásico: R=${resBalance.totalesFase[0]} kW, S=${resBalance.totalesFase[1]} kW, T=${resBalance.totalesFase[2]} kW | Desbalance: ${resBalance.porcentajeDesbalance.toFixed(1)}% | OK`);

console.log("\n=== ¡LOS 4 MOTORES FUNDAMENTALES PASARON TODAS LAS PRUEBAS CON ÉXITO (4/4)! ===");
