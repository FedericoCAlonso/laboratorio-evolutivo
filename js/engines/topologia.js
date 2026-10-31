// =========================================================================
// MOTOR FUNDAMENTAL 4: ANÁLISIS FUNCIONAL, LÍNEAS RF/SMITH Y TOPOLOGÍA 2D
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================

// Motor central de simulación para líneas de transmisión RF, Carta de Smith y empaquetamiento/anidado 2D
export class MotorFuncionalTopologico {
  // -----------------------------------------------------------------------
  // RAMA A: LÍNEAS DE TRANSMISIÓN RF Y CARTA DE SMITH (ANÁLISIS ESPECTRAL)
  // -----------------------------------------------------------------------

  // Calcula la impedancia de entrada Zin de una línea de transmisión terminada en carga compleja ZL
  static calcularImpedanciaLinea(frecuenciaHz, longitudMetros, z0Linea = 50.0, zCargaR = 100.0, zCargaX = 50.0, velPropagacion = 2e8) {
    // Longitud de onda en la línea: lambda = v / f
    const lambda = velPropagacion / Math.max(1e3, frecuenciaHz);
    const beta = (2.0 * Math.PI) / lambda; // Constante de fase beta (rad/m)
    const betaL = beta * longitudMetros;

    const tanBL = Math.tan(betaL);

    // Ecuación de transformación de impedancia: Zin = Z0 * (ZL + j*Z0*tan(beta*l)) / (Z0 + j*ZL*tan(beta*l))
    const numReal = zCargaR;
    const numImag = zCargaX + z0Linea * tanBL;

    const denReal = z0Linea - zCargaX * tanBL;
    const denImag = zCargaR * tanBL;

    const denMag2 = denReal * denReal + denImag * denImag;
    const zinR = ((numReal * denReal + numImag * denImag) / denMag2) * z0Linea;
    const zinX = ((numImag * denReal - numReal * denImag) / denMag2) * z0Linea;

    // Coeficiente de reflexión complejo Gamma = (Zin - Z0) / (Zin + Z0)
    const cNumR = zinR - z0Linea;
    const cNumI = zinX;
    const cDenR = zinR + z0Linea;
    const cDenI = zinX;

    const cDenMag2 = cDenR * cDenR + cDenI * cDenI;
    const gammaU = (cNumR * cDenR + cNumI * cDenI) / cDenMag2; // Coordenada horizontal en Carta de Smith
    const gammaV = (cNumI * cDenR - cNumR * cDenI) / cDenMag2; // Coordenada vertical en Carta de Smith
    const magGamma = Math.hypot(gammaU, gammaV);

    // Relación de Onda Estacionaria (ROE / SWR): SWR = (1 + |Gamma|) / (1 - |Gamma|)
    const roe = (1.0 + Math.min(0.999, magGamma)) / Math.max(0.001, 1.0 - Math.min(0.999, magGamma));
    // Pérdidas de retorno en dB: Return Loss = -20 * log10(|Gamma|)
    const perdidasRetornoDb = -20.0 * Math.log10(Math.max(1e-4, magGamma));

    return {
      zinR,
      zinX,
      gammaU,
      gammaV,
      magGamma,
      roe,
      perdidasRetornoDb
    };
  }

  // Genera un barrido de frecuencia calculando la trayectoria sobre la Carta de Smith
  static simularBarridoSmith(fMinHz, fMaxHz, numPuntos = 50, parametrosLinea) {
    const puntos = [];
    const paso = (fMaxHz - fMinHz) / (numPuntos - 1);
    let peorROE = 1.0;
    let mejorROE = Infinity;

    for (let i = 0; i < numPuntos; i++) {
      const f = fMinHz + i * paso;
      const res = MotorFuncionalTopologico.calcularImpedanciaLinea(
        f,
        parametrosLinea.longitudMetros,
        parametrosLinea.z0,
        parametrosLinea.zCargaR,
        parametrosLinea.zCargaX,
        parametrosLinea.velPropagacion
      );

      puntos.push({ f, ...res });
      if (res.roe > peorROE) peorROE = res.roe;
      if (res.roe < mejorROE) mejorROE = res.roe;
    }

    return {
      puntos,
      peorROE,
      mejorROE,
      fMinHz,
      fMaxHz
    };
  }

  // -----------------------------------------------------------------------
  // RAMA B: TOPOLOGÍA, CORTE DE MATERIAL 2D (NESTING) Y BALANCEO DE RECURSOS
  // -----------------------------------------------------------------------

  // Resuelve el anidado y empaquetamiento rectangular 2D (Nesting / Cutting Stock) para corte de chapa
  static resolverNesting2D(anchoChapa, altoChapa, piezas) {
    // Copia y ordena las piezas por área decreciente (heurística Bottom-Left Fill)
    const items = piezas.map((p, idx) => ({
      id: p.id !== undefined ? p.id : idx,
      w: p.w,
      h: p.h,
      area: p.w * p.h,
      color: p.color || "#38bdf8"
    })).sort((a, b) => b.area - a.area);

    const colocadas = [];
    let areaUtilizada = 0.0;
    const areaTotalChapa = anchoChapa * altoChapa;
    let superposiciones = 0;

    // Espacios rectangulares libres disponibles
    const espaciosLibres = [{ x: 0, y: 0, w: anchoChapa, h: altoChapa }];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let colocado = false;

      for (let e = 0; e < espaciosLibres.length; e++) {
        const esp = espaciosLibres[e];

        // Prueba en orientación original (rotada = false)
        if (item.w <= esp.w && item.h <= esp.h) {
          colocadas.push({
            id: item.id,
            x: esp.x,
            y: esp.y,
            w: item.w,
            h: item.h,
            rotada: false,
            color: item.color
          });
          areaUtilizada += item.area;

          // Divide el espacio libre restante en sub-rectángulos (corte guillotina)
          espaciosLibres.push({ x: esp.x + item.w, y: esp.y, w: esp.w - item.w, h: item.h });
          espaciosLibres.push({ x: esp.x, y: esp.y + item.h, w: esp.w, h: esp.h - item.h });
          espaciosLibres.splice(e, 1);
          colocado = true;
          break;
        }

        // Prueba con rotación de 90° (rotada = true)
        if (item.h <= esp.w && item.w <= esp.h) {
          colocadas.push({
            id: item.id,
            x: esp.x,
            y: esp.y,
            w: item.h,
            h: item.w,
            rotada: true,
            color: item.color
          });
          areaUtilizada += item.area;

          espaciosLibres.push({ x: esp.x + item.h, y: esp.y, w: esp.w - item.h, h: item.w });
          espaciosLibres.push({ x: esp.x, y: esp.y + item.w, w: esp.w, h: esp.h - item.w });
          espaciosLibres.splice(e, 1);
          colocado = true;
          break;
        }
      }

      if (!colocado) {
        superposiciones++;
      }
    }

    const porcentajeAprovechamiento = (areaUtilizada / areaTotalChapa) * 100.0;
    const porcentajeDesperdicio = Math.max(0.0, 100.0 - porcentajeAprovechamiento);

    return {
      anchoChapa,
      altoChapa,
      piezasColocadas: colocadas,
      piezasNoColocadas: superposiciones,
      porcentajeAprovechamiento,
      porcentajeDesperdicio,
      areaUtilizada,
      areaTotalChapa
    };
  }

  // Resuelve el balanceo combinatorio de cargas eléctricas entre N fases independientes (ej: R, S, T)
  static resolverBalanceoFases(cargas, asignacionesFase, numFases = 3) {
    const totalesFase = new Float64Array(numFases);

    for (let i = 0; i < cargas.length; i++) {
      const faseIdx = Math.max(0, Math.min(numFases - 1, Math.round(asignacionesFase[i] || 0)));
      totalesFase[faseIdx] += cargas[i];
    }

    let sumaTotal = 0.0;
    let maxCarga = -Infinity;
    let minCarga = Infinity;

    for (let f = 0; f < numFases; f++) {
      const c = totalesFase[f];
      sumaTotal += c;
      if (c > maxCarga) maxCarga = c;
      if (c < minCarga) minCarga = c;
    }

    const promedio = sumaTotal / numFases;
    const desbalanceNeto = maxCarga - minCarga;
    const porcentajeDesbalance = promedio > 0 ? (desbalanceNeto / promedio) * 100.0 : 0.0;

    return {
      totalesFase: Array.from(totalesFase),
      sumaTotal,
      promedio,
      desbalanceNeto,
      porcentajeDesbalance
    };
  }
}




// =========================================================================
// SOLVERS ESPECÍFICOS DE TOPOLOGÍA, CORTE Y LÍNEAS RF
// =========================================================================

export const PIEZAS_DEFECTO = [
  { id: 1, w: 220, h: 140, color: "#38bdf8" }, // Pieza A (Panel grande)
  { id: 2, w: 180, h: 120, color: "#34d399" }, // Pieza B (Soporte)
  { id: 3, w: 140, h: 90,  color: "#f59e0b" }, // Pieza C (Refuerzo)
  { id: 4, w: 160, h: 110, color: "#ec4899" }, // Pieza D (Brida)
  { id: 5, w: 110, h: 80,  color: "#818cf8" }, // Pieza E (Tapa)
  { id: 6, w: 90,  h: 60,  color: "#a78bfa" }  // Pieza F (Guía)
];

// Simula la colocación espacial y calcula el desperdicio porcentual de corte en la chapa
export function simularCorteChapaNesting(genoma, entrada) {
  const anchoChapa = Number(entrada?.anchoChapaMm !== undefined ? entrada.anchoChapaMm : 500.0);
  const altoChapa = Number(entrada?.altoChapaMm !== undefined ? entrada.altoChapaMm : 350.0);

  const numPiezas = PIEZAS_DEFECTO.length;

  // Genoma de 12 genes:
  // [0..5]: Prioridades de orden de colocación (peso continuo de ordenamiento)
  // [6..11]: Umbrales de decisión de rotación a 90° (si > 0.5 se rota)
  const prioridades = genoma.slice(0, numPiezas);
  const rotaciones = genoma.slice(numPiezas, numPiezas * 2);

  // Asocia cada pieza con su prioridad y orientación dada por el genoma
  const piezasPreparadas = PIEZAS_DEFECTO.map((p, idx) => {
    const rotar = (rotaciones[idx] !== undefined ? rotaciones[idx] : 0.0) > 0.5;
    return {
      id: p.id,
      w: rotar ? p.h : p.w,
      h: rotar ? p.w : p.h,
      prioridad: prioridades[idx] !== undefined ? prioridades[idx] : idx,
      color: p.color
    };
  }).sort((a, b) => b.prioridad - a.prioridad);

  // Ejecuta la heurística de anidado 2D del motor topológico
  const resNesting = MotorFuncionalTopologico.resolverNesting2D(anchoChapa, altoChapa, piezasPreparadas);

  // Calcula la envolvente real ocupada (ancho y alto máximo alcanzado por las piezas)
  let maxAlcanzadoX = 0.0;
  let maxAlcanzadoY = 0.0;

  resNesting.piezasColocadas.forEach((pz) => {
    const bordeDer = pz.x + pz.w;
    const bordeInf = pz.y + pz.h;
    if (bordeDer > maxAlcanzadoX) maxAlcanzadoX = bordeDer;
    if (bordeInf > maxAlcanzadoY) maxAlcanzadoY = bordeInf;
  });

  return {
    anchoChapa,
    altoChapa,
    piezasColocadas: resNesting.piezasColocadas,
    piezasNoColocadas: resNesting.piezasNoColocadas,
    porcentajeAprovechamiento: resNesting.porcentajeAprovechamiento,
    porcentajeDesperdicio: resNesting.porcentajeDesperdicio,
    areaUtilizada: resNesting.areaUtilizada,
    areaTotalChapa: resNesting.areaTotalChapa,
    maxAlcanzadoX,
    maxAlcanzadoY,
    anchoUtilizadoMm: maxAlcanzadoX,
    todasColocadas: resNesting.piezasNoColocadas === 0
  };
}

// Objeto de definición del modelo para el motor evolutivo


export function simularLineaTransmisionRF(genoma, entrada) {
  // Frecuencia central de operación (ej: 1.0 GHz para telecomunicaciones / ISM)
  const fCentralHz = Number(entrada?.frecuenciaCentralHz !== undefined ? entrada.frecuenciaCentralHz : 1e9);
  const z0Sistema = Number(entrada?.z0Sistema !== undefined ? entrada.z0Sistema : 50.0);
  const rCarga = Number(entrada?.rCarga !== undefined ? entrada.rCarga : 85.0);
  const xCarga = Number(entrada?.xCarga !== undefined ? entrada.xCarga : 40.0);

  // 4 genes continuos del genoma:
  // [longitudMetros, z0Seccion, stubMetros, z0Stub]
  const [lMetros, z0Sec, lStub, z0St] = genoma;

  const longitudTransformador = Math.max(0.005, Math.min(0.15, lMetros));
  const z0Transformador = Math.max(25.0, Math.min(120.0, z0Sec));
  const longitudStub = Math.max(0.002, Math.min(0.08, lStub || 0.02));
  const z0Stub = Math.max(30.0, Math.min(100.0, z0St || 50.0));

  // Barrido de frecuencia de +-25% alrededor de la frecuencia central (50 puntos)
  const fMin = fCentralHz * 0.75;
  const fMax = fCentralHz * 1.25;
  const numPuntos = 40;

  const barrido = MotorFuncionalTopologico.simularBarridoSmith(fMin, fMax, numPuntos, {
    longitudMetros: longitudTransformador,
    z0: z0Transformador,
    zCargaR: rCarga,
    zCargaX: xCarga,
    velPropagacion: 2e8 // 200,000 km/s en dieléctrico típico de teflón/FR4 (c * 0.66)
  });

  // Cálculo en la frecuencia central exacta
  const resCentral = MotorFuncionalTopologico.calcularImpedanciaLinea(
    fCentralHz,
    longitudTransformador,
    z0Transformador,
    rCarga,
    xCarga,
    2e8
  );

  // Efecto de compensación reactiva del stub paralelo: Y_total = Y_linea + Y_stub
  const bStub = -1.0 / (z0Stub * Math.tan((2.0 * Math.PI * fCentralHz * longitudStub) / 2e8 || 0.1));
  const gIn = resCentral.zinR / (resCentral.zinR * resCentral.zinR + resCentral.zinX * resCentral.zinX || 1.0);
  const bInTotal = (resCentral.zinX / (resCentral.zinR * resCentral.zinR + resCentral.zinX * resCentral.zinX || 1.0)) + bStub * 0.35;

  const denY = gIn * gIn + bInTotal * bInTotal || 1e-4;
  const zCompR = gIn / denY;
  const zCompX = -bInTotal / denY;

  // Reflexión final compensada
  const numR = zCompR - z0Sistema;
  const numX = zCompX;
  const denR = zCompR + z0Sistema;
  const denX = zCompX;
  const dMag2 = denR * denR + denX * denX;
  const gammaU = (numR * denR + numX * denX) / dMag2;
  const gammaV = (numX * denR - numR * denX) / dMag2;
  const magGamma = Math.hypot(gammaU, gammaV);
  const roeFinal = (1.0 + Math.min(0.999, magGamma)) / Math.max(0.001, 1.0 - Math.min(0.999, magGamma));
  const perdidasRetornoDb = -20.0 * Math.log10(Math.max(1e-4, magGamma));

  return {
    fCentralHz,
    z0Sistema,
    rCarga,
    xCarga,
    longitudTransformador,
    z0Transformador,
    longitudStub,
    z0Stub,
    zinR: zCompR,
    zinX: zCompX,
    gammaU,
    gammaV,
    magGamma,
    roe: roeFinal,
    perdidasRetornoDb,
    peorROE: Math.max(roeFinal, barrido.peorROE),
    puntosSmith: barrido.puntos,
    longitudTotalMm: (longitudTransformador + longitudStub) * 1000.0,
    adaptacionOptima: roeFinal <= 1.35
  };
}

// Objeto de definición del modelo para el motor evolutivo

export default MotorFuncionalTopologico;
