// =========================================================================
// MÓDULO: MODELO DISTRIBUCIÓN TÉRMICA EN PLACA 2D (TRANSFERENCIA DE CALOR)
// MODELO DE DOMINIO PURO (ARQUITECTURA MVVM - SIN ACOPLAMIENTO A LA UI)
// =========================================================================

// Simula el campo de temperaturas 2D T(x, y) en una placa con disipación perimetral y fuentes puntuales de calor.
export function simularCampoTermico(genoma, entrada) {
  const tAmbiente = Number(entrada?.temperaturaAmbiente !== undefined ? entrada.temperaturaAmbiente : 25.0); // °C
  const kConductividad = Number(entrada?.conductividadPlaca !== undefined ? entrada.conductividadPlaca : 1.5); // W/(m·K)

  const anchoPlaca = 100.0; // mm [-50, 50]
  const altoPlaca = 80.0;   // mm [-40, 40]

  // Potencias térmicas disipadas por los 4 circuitos integrados en Watts:
  const potencias = [25.0, 18.0, 12.0, 10.0];
  const radiosChip = [9.0, 7.5, 6.5, 6.0]; // mm (radio físico de seguridad de cada encapsulado)

  // 8 genes continuos: [x1, y1, x2, y2, x3, y3, x4, y4]
  const chips = [
    { x: genoma[0], y: genoma[1], q: potencias[0], r: radiosChip[0], nombre: "CPU" },
    { x: genoma[2], y: genoma[3], q: potencias[1], r: radiosChip[1], nombre: "GPU" },
    { x: genoma[4], y: genoma[5], q: potencias[2], r: radiosChip[2], nombre: "VRM" },
    { x: genoma[6], y: genoma[7], q: potencias[3], r: radiosChip[3], nombre: "MEM" }
  ];

  // Verificación de solapamiento físico entre componentes y desborde de bordes
  let solapamientoMm = 0;
  for (let i = 0; i < chips.length; i++) {
    for (let j = i + 1; j < chips.length; j++) {
      const dist = Math.hypot(chips[i].x - chips[j].x, chips[i].y - chips[j].y);
      const radioMinimo = chips[i].r + chips[j].r + 3.0; // 3 mm de separación mínima
      if (dist < radioMinimo) {
        solapamientoMm += (radioMinimo - dist);
      }
    }

    // Distancia al borde perimetral disipador
    const margenX = (anchoPlaca / 2) - Math.abs(chips[i].x);
    const margenY = (altoPlaca / 2) - Math.abs(chips[i].y);
    if (margenX < chips[i].r) solapamientoMm += (chips[i].r - margenX) * 2;
    if (margenY < chips[i].r) solapamientoMm += (chips[i].r - margenY) * 2;
  }

  // Muestreo del campo térmico en una grilla de 32x26 puntos
  const nx = 32;
  const ny = 26;
  let tMax = tAmbiente;
  let xHotspot = 0;
  let yHotspot = 0;
  const grilla = [];

  // Función local para evaluar la temperatura en cualquier punto (x, y) de la placa
  const calcularTemperaturaPunto = (x, y) => {
    let t = tAmbiente;
    const factorEnfriamientoBorde = Math.min(
      (anchoPlaca / 2) - Math.abs(x),
      (altoPlaca / 2) - Math.abs(y)
    ) / 15.0;
    const factorConveccion = Math.max(0.2, Math.min(1.0, factorEnfriamientoBorde));

    for (let i = 0; i < chips.length; i++) {
      const c = chips[i];
      const d = Math.hypot(x - c.x, y - c.y);
      // Disipación térmica gaussiana / Green en placa delgada con disipador perimetral
      const deltaT = (c.q / (kConductividad * 0.45)) * Math.exp(-(d * d) / 380.0);
      t += deltaT * factorConveccion;
    }
    return t;
  };

  for (let iy = 0; iy < ny; iy++) {
    const y = - (altoPlaca / 2) + (iy / (ny - 1)) * altoPlaca;
    const fila = [];
    for (let ix = 0; ix < nx; ix++) {
      const x = - (anchoPlaca / 2) + (ix / (nx - 1)) * anchoPlaca;
      const t = calcularTemperaturaPunto(x, y);
      if (t > tMax) {
        tMax = t;
        xHotspot = x;
        yHotspot = y;
      }
      fila.push(t);
    }
    grilla.push(fila);
  }

  // Temperatura en el centro de cada componente
  chips.forEach(c => {
    c.temperatura = calcularTemperaturaPunto(c.x, c.y);
  });

  // Varianza térmica para homogeneidad de la disipación
  let sumaT = 0;
  let cant = 0;
  grilla.forEach(f => f.forEach(t => { sumaT += t; cant++; }));
  const tPromedio = sumaT / (cant || 1);

  return {
    chips,
    grilla,
    nx,
    ny,
    anchoPlaca,
    altoPlaca,
    tAmbiente,
    tMax,
    tPromedio,
    xHotspot,
    yHotspot,
    solapamientoMm,
    sinSolapamiento: solapamientoMm === 0
  };
}

// Objeto de definición del modelo para el motor evolutivo.
export const ModeloDistribucionTermica = {
  id: "distribucion-termica",
  nombre: "Disipación Térmica en Placa 2D",
  descripcion: "Optimiza la disposición de 4 chips generadores de calor en una placa PCB con disipador perimetral para minimizar el punto caliente máximo (Tmax).",
  usaWasm: false,
  usaRuido: false,
  nombresObjetivos: ["Punto Caliente Tmax (°C)", "Separación y Homogeneidad"],

  // Parámetros de entorno térmico.
  parametrosEntrada: [
    {
      clave: "modoOptimizacion",
      etiqueta: "Modo de Optimización",
      tipo: "selector",
      opciones: [
        { valor: "multiobjetivo", etiqueta: "Multiobjetivo Pareto (Temperatura Tmax vs. Separación física)" },
        { valor: "monobjetivo", etiqueta: "Monobjetivo (Punto caliente ponderado)" }
      ],
      valorDefecto: "multiobjetivo"
    },
    { clave: "temperaturaAmbiente", etiqueta: "Temperatura Ambiente Tamb (°C)", tipo: "numero", min: 10, max: 50, paso: 5, valorDefecto: 25 },
    { clave: "conductividadPlaca", etiqueta: "Conductividad Térmica k (W/m·K)", tipo: "numero", min: 0.5, max: 5.0, paso: 0.5, valorDefecto: 1.5 }
  ],

  // 8 genes continuos: coordenadas (x, y) de los 4 componentes.
  crearGenoma() {
    return [
      { tipo: "continuo", min: -38, max: 38 }, // CPU X
      { tipo: "continuo", min: -28, max: 28 }, // CPU Y
      { tipo: "continuo", min: -38, max: 38 }, // GPU X
      { tipo: "continuo", min: -28, max: 28 }, // GPU Y
      { tipo: "continuo", min: -38, max: 38 }, // VRM X
      { tipo: "continuo", min: -28, max: 28 }, // VRM Y
      { tipo: "continuo", min: -38, max: 38 }, // MEM X
      { tipo: "continuo", min: -28, max: 28 }  // MEM Y
    ];
  },

  // Evalúa la temperatura máxima Tmax y penaliza solapamientos físicos.
  evaluar(genoma, entrada) {
    const modo = (entrada?.modoOptimizacion || "multiobjetivo").toString().toLowerCase().trim();
    const esMulti = modo === "multiobjetivo";

    const sim = simularCampoTermico(genoma, entrada);

    let penalizacion = 0;
    if (sim.solapamientoMm > 0) {
      penalizacion += 100 + sim.solapamientoMm * 15;
    }

    const objHotspot = sim.tMax + penalizacion;
    const objHomogeneidad = sim.tMax - sim.tPromedio + (penalizacion > 0 ? 30.0 : 0);

    if (esMulti) {
      return [objHotspot, objHomogeneidad];
    }

    return objHotspot * 2.0 + objHomogeneidad * 0.5;
  },

  // Genera el informe textual con las temperaturas de encapsulado y el punto caliente.
  describir(genoma, entrada) {
    const sim = simularCampoTermico(genoma, entrada);

    let texto = `DISTRIBUCIÓN TÉRMICA 2D Y ANÁLISIS DE PUNTOS CALIENTES\n`;
    texto += `========================================================================\n`;
    texto += `CONDICIONES DE LA PLACA:\n`;
    texto += `  • Dimensiones del PCB     : ${sim.anchoPlaca} x ${sim.altoPlaca} mm (Perímetro con disipador)\n`;
    texto += `  • Temperatura ambiente    : ${sim.tAmbiente.toFixed(1)} °C\n`;
    texto += `  • Punto caliente (Tmax)   : ${sim.tMax.toFixed(1)} °C en posición (${sim.xHotspot.toFixed(1)}, ${sim.yHotspot.toFixed(1)}) mm\n`;
    texto += `  • Temperatura media placa : ${sim.tPromedio.toFixed(1)} °C (Gradiente: ${(sim.tMax - sim.tPromedio).toFixed(1)} °C)\n\n`;

    texto += `UBICACIÓN Y TEMPERATURA POR COMPONENTE:\n`;
    sim.chips.forEach(c => {
      texto += `  • ${c.nombre.padEnd(4, " ")} (${c.q} W): Pos (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) mm | Temp Encapsulado: ${c.temperatura.toFixed(1)} °C\n`;
    });

    texto += `\nINTEGRIDAD FÍSICA Y REGLAS DE DISEÑO:\n`;
    texto += `  • Diagnóstico de layout   : ${sim.sinSolapamiento ? "DISEÑO VÁLIDO (Separación de componentes óptima) ✓" : "VIOLACIÓN DE ESPACIADO FÍSICO (Solapamiento) ✕"}\n`;
    texto += `========================================================================\n`;

    return texto;
  }
};

export default ModeloDistribucionTermica;
