// =========================================================================
// MÓDULO: MODELO ATERRIZAJE RETRO-PROPULSADO DE COHETE (FALCON BOOSTER)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Simula la trayectoria física de descenso retro-propulsado paso a paso en el tiempo.
export function simularDescensoCohete(genoma, entrada) {
  const viento = Number(entrada?.viento !== undefined ? entrada.viento : 4.0);
  const alturaInicial = Number(entrada?.alturaInicial !== undefined ? entrada.alturaInicial : 120.0);

  // 4 fases de empuje vectorial: [F1, F2, F3, F4] en Newtons y [ang1, ang2, ang3, ang4] en grados.
  const [f1, f2, f3, f4, a1, a2, a3, a4] = genoma;
  const fuerzas = [f1, f2, f3, f4];
  const angulos = [a1, a2, a3, a4];

  const g = 9.81;
  const dt = 0.05;
  const masaSeca = 500;
  const combInicial = 500;
  let masa = masaSeca + combInicial;
  const tasaConsumo = 0.00045; // kg por Newton por segundo

  let x = 15.0; // Desplazamiento inicial lateral por desacople
  let y = alturaInicial;
  let vx = -2.0;
  let vy = -22.0; // Velocidad descendente inicial

  const trayectoria = [{ x, y, vx, vy, t: 0, empuje: 0, angulo: 0 }];
  let t = 0;
  const tiempoFase = 2.0; // Cada una de las 4 fases dura 2.0 segundos

  while (y > 0 && t < 10.0) {
    const faseIdx = Math.min(3, Math.floor(t / tiempoFase));
    let empuje = fuerzas[faseIdx];
    const angDeg = angulos[faseIdx];
    const angRad = (angDeg * Math.PI) / 180;

    // Si se agota el propelente, el empuje cesa.
    const combRestante = masa - masaSeca;
    if (combRestante <= 0) {
      empuje = 0;
    } else {
      const consumo = empuje * tasaConsumo * dt;
      masa -= Math.min(combRestante, consumo);
    }

    // Fuerzas aerodinámicas y vector de empuje del motor orientable.
    const fEmpujeX = empuje * Math.sin(angRad);
    const fEmpujeY = empuje * Math.cos(angRad);

    const fArrastreX = -0.08 * (vx - viento) * Math.abs(vx - viento);
    const fArrastreY = -0.06 * vy * Math.abs(vy);

    const ax = (fEmpujeX + fArrastreX) / masa;
    const ay = -g + (fEmpujeY + fArrastreY) / masa;

    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;

    trayectoria.push({ x, y: Math.max(0, y), vx, vy, t, empuje, angulo: angDeg });
  }

  const puntoImpacto = trayectoria[trayectoria.length - 1];
  const velocidadImpacto = Math.hypot(puntoImpacto.vx, puntoImpacto.vy);
  const desvioPlataforma = Math.abs(puntoImpacto.x);
  const combustibleRestante = Math.max(0, masa - masaSeca);
  const combustibleGastadoPct = ((combInicial - combustibleRestante) / combInicial) * 100;

  // Aterrizaje exitoso: velocidad < 4 m/s y dentro de la barcaza flotante (|X| < 12m).
  const aterrizajeExitoso = velocidadImpacto <= 4.0 && desvioPlataforma <= 12.0 && Math.abs(puntoImpacto.vy) <= 3.5;

  return {
    trayectoria,
    velocidadImpacto,
    desvioPlataforma,
    combustibleRestante,
    combustibleGastadoPct,
    aterrizajeExitoso,
    tiempoVuelo: t,
    viento,
    alturaInicial
  };
}

// Objeto de contrato del modelo de aterrizaje de cohete para el motor evolutivo.
export const ModeloCoheteLanding = {
  id: "cohete-landing",
  nombre: "Aterrizaje de Cohete (Falcon Landing)",
  descripcion: "Control de empuje vectorial de un cohete en descenso retro-propulsado para tocar una plataforma marina con velocidad nula minimizando combustible.",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Velocidad de Impacto (m/s)", "Combustible Consumido (%)"],

  // Parámetros de entorno configurables por el usuario.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Suavidad vs. Combustible)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Aterrizaje seguro)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "alturaInicial", etiqueta: "Altitud Inicial (metros)", tipo: "numero", min: 80, max: 200, paso: 10, valorDefecto: 120 },
    { clave: "viento", etiqueta: "Viento Lateral (m/s)", tipo: "numero", min: -15, max: 15, paso: 1, valorDefecto: 4 }
  ],

  // 8 genes: [Fuerza 1..4 en Newtons (0..20000), Ángulos 1..4 en grados (-15..15)].
  crearGenoma() {
    return [
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: 0, max: 20000 },
      { tipo: "continuo", min: -15, max: 15 },
      { tipo: "continuo", min: -15, max: 15 },
      { tipo: "continuo", min: -15, max: 15 },
      { tipo: "continuo", min: -15, max: 15 }
    ];
  },

  // Evalúa la suavidad del contacto en la barcaza y el ahorro de combustible.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularDescensoCohete(genoma, entrada);

    // Penalizaciones por impacto severo o caída fuera de la plataforma marina.
    let penalizacionCrash = 0;
    if (sim.velocidadImpacto > 4.0) {
      penalizacionCrash += (sim.velocidadImpacto - 4.0) * 8.0;
    }
    if (sim.desvioPlataforma > 12.0) {
      penalizacionCrash += (sim.desvioPlataforma - 12.0) * 5.0;
    }

    const objVelocidad = sim.velocidadImpacto + sim.desvioPlataforma * 0.4 + penalizacionCrash;
    const objCombustible = sim.combustibleGastadoPct / 100 + (penalizacionCrash > 0 ? 1.0 : 0);

    if (esMulti) {
      return [objVelocidad, objCombustible];
    }

    return objVelocidad * 2.5 + objCombustible * 15.0;
  },

  // Genera el informe textual detallado con las fases de empuje y la telemetría de contacto.
  describir(genoma, entrada) {
    const sim = simularDescensoCohete(genoma, entrada);
    const [f1, f2, f3, f4, a1, a2, a3, a4] = genoma;

    let texto = `PROPULSOR ESPACIAL RETRO-PROPULSADO - TELEMETRÍA DE DESCENSO\n`;
    texto += `========================================================================\n`;
    texto += `CONDICIONES DE ENTORNO:\n`;
    texto += `  • Altitud de entrada      : ${sim.alturaInicial.toFixed(1)} m\n`;
    texto += `  • Viento lateral oceánico : ${sim.viento.toFixed(1)} m/s\n`;
    texto += `  • Duración total de vuelo : ${sim.tiempoVuelo.toFixed(2)} s\n\n`;

    texto += `PARÁMETROS DE TOBERA POR FASE:\n`;
    texto += `  Fase 1 (0-2s) : Empuje = ${f1.toFixed(0).padStart(5, " ")} N | Inclinación = ${a1.toFixed(1)}°\n`;
    texto += `  Fase 2 (2-4s) : Empuje = ${f2.toFixed(0).padStart(5, " ")} N | Inclinación = ${a2.toFixed(1)}°\n`;
    texto += `  Fase 3 (4-6s) : Empuje = ${f3.toFixed(0).padStart(5, " ")} N | Inclinación = ${a3.toFixed(1)}°\n`;
    texto += `  Fase 4 (6-8s) : Empuje = ${f4.toFixed(0).padStart(5, " ")} N | Inclinación = ${a4.toFixed(1)}°\n\n`;

    texto += `MÉTRICAS DE CONTACTO EN CUBIERTA:\n`;
    texto += `  • Velocidad de impacto    : ${sim.velocidadImpacto.toFixed(2)} m/s (Máx seguro: 4.0 m/s)\n`;
    texto += `  • Desvío sobre barcaza    : ${sim.desvioPlataforma.toFixed(2)} m (Radio cubierta: 12.0 m)\n`;
    texto += `  • Combustible consumido   : ${sim.combustibleGastadoPct.toFixed(1)}% (Remanente: ${sim.combustibleRestante.toFixed(1)} kg)\n`;
    texto += `  • RESULTADO DE LA MISIÓN  : ${sim.aterrizajeExitoso ? "ATERRIZAJE EXITOSO (BOOSTER RECUPERADO) ✓" : "PÉRDIDA DEL VEHÍCULO POR IMPACTO ✕"}\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloCoheteLanding;
