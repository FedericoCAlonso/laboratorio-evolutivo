// =========================================================================
// MOTOR DE DINÁMICA TEMPORAL, CONTROL Y SISTEMAS ORBITALES
// SOLVERS FÍSICOS DESACOPLADOS PARA VISUALIZACIÓN Y TELEMETRÍA
// =========================================================================

// -------------------------------------------------------------------------
// 1. DINÁMICA DE DESCENSO BALÍSTICO / RETRO-PROPULSIÓN DE COHETE
// -------------------------------------------------------------------------
export function simularDescensoCohete(genoma, entrada = {}) {
  const viento = Number(entrada?.viento !== undefined ? entrada.viento : 4.0);
  const alturaInicial = Number(entrada?.alturaInicial !== undefined ? entrada.alturaInicial : 120.0);

  // 4 fases de empuje vectorial: [F1, F2, F3, F4] en Newtons y [ang1, ang2, ang3, ang4] en grados
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

    // Si se agota el propelente, el empuje cesa
    const combRestante = masa - masaSeca;
    if (combRestante <= 0) {
      empuje = 0;
    } else {
      const consumo = empuje * tasaConsumo * dt;
      masa -= Math.min(combRestante, consumo);
    }

    // Fuerzas aerodinámicas y vector de empuje del motor orientable
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

  // Aterrizaje exitoso: velocidad <= 4 m/s y dentro de la barcaza flotante (|X| <= 12m)
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

// -------------------------------------------------------------------------
// 2. SISTEMA DE CONTROL EN LAZO CERRADO PID (RESPUESTA TEMPORAL AL ESCALÓN)
// -------------------------------------------------------------------------
export function simularRespuestaPID(genoma, entrada = {}) {
  const [kp, ki, kd] = genoma;
  const wn = Number(entrada?.frecuenciaNatural !== undefined ? entrada.frecuenciaNatural : 2.5);
  const zeta = Number(entrada?.amortiguamiento !== undefined ? entrada.amortiguamiento : 0.4);

  const dt = 0.01;
  const tiempoTotal = 8.0;
  const N = Math.round(tiempoTotal / dt);

  // Estados de la planta de segundo orden: y (salida) e yd (velocidad de salida dy/dt)
  let y = 0.0;
  let yd = 0.0;
  let integralError = 0.0;
  let errorPrevio = 1.0;

  const respuesta = [{ t: 0, y: 0, e: 1, u: 0 }];
  let yMax = 0.0;
  let tPico = 0.0;
  let itae = 0.0;

  for (let k = 1; k <= N; k++) {
    const t = k * dt;
    const r = 1.0; // Escalón unitario de referencia
    const e = r - y;

    integralError += e * dt;
    // Anti-windup suave para evitar saturación desmedida del término integral
    integralError = Math.max(-50, Math.min(50, integralError));

    const de = (e - errorPrevio) / dt;
    errorPrevio = e;

    // Ley de control PID con saturación de actuador en [-80, 80]
    let u = kp * e + ki * integralError + kd * de;
    u = Math.max(-80, Math.min(80, u));

    // Dinámica de la planta: d²y/dt² = wn² * u - 2*zeta*wn * dy/dt - wn² * y
    const ydd = (wn * wn * u) - (2.0 * zeta * wn * yd) - (wn * wn * y);
    yd += ydd * dt;
    y += yd * dt;

    if (isNaN(y) || Math.abs(y) > 100) {
      y = 100;
      break;
    }

    if (y > yMax) {
      yMax = y;
      tPico = t;
    }

    itae += t * Math.abs(e) * dt;
    respuesta.push({ t, y, e, u });
  }

  // Cálculo del sobrepico porcentual (Overshoot Mp)
  const sobrepicoPct = Math.max(0, (yMax - 1.0) * 100);

  // Cálculo del tiempo de establecimiento al 2% (Settling Time ts)
  let tEstablecimiento = tiempoTotal;
  for (let i = respuesta.length - 1; i >= 0; i--) {
    if (Math.abs(respuesta[i].y - 1.0) > 0.02) {
      tEstablecimiento = Math.min(tiempoTotal, respuesta[i].t + dt);
      break;
    }
  }

  const esEstable = !isNaN(y) && Math.abs(y - 1.0) < 0.15 && yMax < 3.0;

  return {
    respuesta,
    sobrepicoPct,
    tEstablecimiento,
    yMax,
    tPico,
    itae,
    esEstable,
    wn,
    zeta
  };
}

// -------------------------------------------------------------------------
// 3. TRANSFERENCIA ORBITAL Y MECÁNICA CELESTE KEPLERIANA 2D
// -------------------------------------------------------------------------
export function simularManiobraOrbital(genoma, entrada = {}) {
  const mu = Number(entrada?.constanteGravitacional !== undefined ? entrada.constanteGravitacional : 10000.0);
  const rInicial = Number(entrada?.radioInicial !== undefined ? entrada.radioInicial : 35.0);
  const rObjetivo = Number(entrada?.radioObjetivo !== undefined ? entrada.radioObjetivo : 75.0);
  const rPlaneta = 18.0;

  const [dv1T, dv1R, tEspera, dv2T] = genoma;

  // Velocidad circular inicial para equilibrio v0 = sqrt(mu / r0)
  const v0 = Math.sqrt(mu / rInicial);

  let x = rInicial;
  let y = 0.0;
  let vx = dv1R;
  let vy = v0 + dv1T;

  const dt = 0.04;
  const tiempoTotal = Math.max(tEspera + 6.0, 15.0);
  const pasos = Math.round(tiempoTotal / dt);

  const trayectoria = [{ x, y, vx, vy, t: 0, encendido: 1 }];
  let colisionPlaneta = false;
  let segundoEncendidoAplicado = false;
  let tSegundoEncendido = 0;

  for (let k = 1; k <= pasos; k++) {
    const tActual = k * dt;

    let encendido = 0;
    if (!segundoEncendidoAplicado && tActual >= tEspera) {
      const velMag = Math.hypot(vx, vy);
      if (velMag > 0.001) {
        vx += (vx / velMag) * dv2T;
        vy += (vy / velMag) * dv2T;
      }
      segundoEncendidoAplicado = true;
      tSegundoEncendido = tActual;
      encendido = 2;
    }

    const r = Math.hypot(x, y);
    if (r < rPlaneta) {
      colisionPlaneta = true;
    }

    const r3 = r * r * r || 1;
    const ax = -(mu / r3) * x;
    const ay = -(mu / r3) * y;

    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;

    trayectoria.push({ x, y, vx, vy, t: tActual, encendido });
  }

  const puntoFinal = trayectoria[trayectoria.length - 1];
  const rFinal = Math.hypot(puntoFinal.x, puntoFinal.y);
  const vFinal = Math.hypot(puntoFinal.vx, puntoFinal.vy);

  const h = puntoFinal.x * puntoFinal.vy - puntoFinal.y * puntoFinal.vx;
  const ex = (puntoFinal.vy * h) / mu - puntoFinal.x / rFinal;
  const ey = -(puntoFinal.vx * h) / mu - puntoFinal.y / rFinal;
  const excentricidadFinal = Math.hypot(ex, ey);

  const errorRadio = Math.abs(rFinal - rObjetivo);
  const deltaVTotal = Math.hypot(dv1T, dv1R) + Math.abs(dv2T);

  return {
    trayectoria,
    rFinal,
    vFinal,
    excentricidadFinal,
    errorRadio,
    deltaVTotal,
    colisionPlaneta,
    tSegundoEncendido,
    rInicial,
    rObjetivo,
    rPlaneta
  };
}

// -------------------------------------------------------------------------
// 4. RESPUESTA EN FRECUENCIA DE FILTRO ANALÓGICO RLC (DIAGRAMA DE BODE)
// -------------------------------------------------------------------------
export function simularRespuestaFiltroRLC(genoma, entrada = {}) {
  const fDeseada = Number(entrada?.frecuenciaCentral !== undefined ? entrada.frecuenciaCentral : 1000.0);
  const bwDeseado = Number(entrada?.anchoBanda !== undefined ? entrada.anchoBanda : 200.0);

  const [logR, logL, logC] = genoma;
  const R = Math.pow(10, logR);
  const L = Math.pow(10, logL);
  const C = Math.pow(10, logC);

  const w0 = 1.0 / Math.sqrt(L * C);
  const f0 = w0 / (2 * Math.PI);
  const Q = (1.0 / R) * Math.sqrt(L / C);
  const bwReal = Q > 0 ? f0 / Q : 99999;

  const fMin = 20.0;
  const fMax = 50000.0;
  const numPuntos = 70;
  const respuesta = [];

  let magMaximaDB = -Infinity;
  let fPico = f0;

  for (let i = 0; i < numPuntos; i++) {
    const f = Math.pow(10, Math.log10(fMin) + (i / (numPuntos - 1)) * (Math.log10(fMax) - Math.log10(fMin)));
    const w = 2 * Math.PI * f;

    const numReal = 0;
    const numImag = w * (w0 / Math.max(0.01, Q));
    const denReal = (w0 * w0) - (w * w);
    const denImag = w * (w0 / Math.max(0.01, Q));

    const modNum = Math.hypot(numReal, numImag);
    const modDen = Math.hypot(denReal, denImag);

    const gananciaLineal = modDen > 0 ? modNum / modDen : 0;
    const gananciaDB = 20 * Math.log10(Math.max(1e-6, gananciaLineal));

    if (gananciaDB > magMaximaDB) {
      magMaximaDB = gananciaDB;
      fPico = f;
    }

    respuesta.push({ f, gananciaDB, gananciaLineal });
  }

  let atenuacionBaja = 0;
  let atenuacionAlta = 0;
  const pBaja = respuesta.find(p => p.f >= fDeseada * 0.25);
  const pAlta = respuesta.find(p => p.f >= fDeseada * 4.0);
  if (pBaja) atenuacionBaja = -pBaja.gananciaDB;
  if (pAlta) atenuacionAlta = -pAlta.gananciaDB;

  const errorFrecuencia = Math.abs(f0 - fDeseada);
  const errorAnchoBanda = Math.abs(bwReal - bwDeseado);

  return {
    R,
    L,
    C,
    f0,
    Q,
    bwReal,
    fDeseada,
    bwDeseado,
    errorFrecuencia,
    errorAnchoBanda,
    magMaximaDB,
    fPico,
    atenuacionBaja,
    atenuacionAlta,
    respuesta
  };
}
