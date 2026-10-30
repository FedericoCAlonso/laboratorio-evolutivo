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

export default MotorFuncionalTopologico;
