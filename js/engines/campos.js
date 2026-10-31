// =========================================================================
// MOTOR FUNDAMENTAL 1: CAMPOS CLÁSICOS UNIFICADOS Y DINÁMICA DE PARTÍCULAS
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================

// Constantes físicas normalizadas para cálculo numérico estable
export const CONSTANTES_CAMPOS = {
  G: 1000.0,            // Constante de gravitación universal escalada
  K_ELECTRICA: 100.0,   // Constante electrostática de Coulomb escalada
  EPSILON_SUAVIZADO: 1.5 // Factor de ablandamiento para evitar singularidades r -> 0
};

// Motor central de cálculo de potenciales, gradientes de campo y dinámica de partículas
export class MotorCamposUnificados {
  // Inicializa el motor con listas de fuentes de campo y parámetros de integración
  constructor(config = {}) {
    // Lista de cuerpos masivos/cargados/magnéticos que generan el campo
    this.fuentes = [];
    // Lista de partículas de prueba que se desplazan en el campo resultante
    this.particulas = [];
    // Constantes de escala física
    this.G = config.G !== undefined ? config.G : CONSTANTES_CAMPOS.G;
    this.kElec = config.kElec !== undefined ? config.kElec : CONSTANTES_CAMPOS.K_ELECTRICA;
    this.eps = config.eps !== undefined ? config.eps : CONSTANTES_CAMPOS.EPSILON_SUAVIZADO;
  }

  // Agrega un cuerpo fuente generador de campo escalar y/o vectorial
  agregarFuente(fuente) {
    this.fuentes.push({
      id: fuente.id || `fuente_${this.fuentes.length + 1}`,
      x: fuente.x || 0.0,
      y: fuente.y || 0.0,
      m: fuente.m || 0.0,       // Masa gravitatoria (kg / normalizada)
      q: fuente.q || 0.0,       // Carga eléctrica (Coulombs / normalizada)
      mu: fuente.mu || 0.0,     // Momento magnético dipolar / corriente (A·m2)
      temp: fuente.temp || 0.0, // Fuente o sumidero de calor (°C)
      radio: fuente.radio || 2.0,
      fijo: fuente.fijo !== undefined ? fuente.fijo : true
    });
  }

  // Limpia todas las fuentes y partículas activas
  reiniciar() {
    this.fuentes = [];
    this.particulas = [];
  }

  // Calcula el potencial escalar total V(x, y) sumando contribuciones gravitatorias, eléctricas y térmicas
  calcularPotencialPunto(x, y, tipo = "electrico") {
    let pot = 0.0;
    const eps2 = this.eps * this.eps;

    for (let i = 0; i < this.fuentes.length; i++) {
      const f = this.fuentes[i];
      const dx = x - f.x;
      const dy = y - f.y;
      const dist2 = dx * dx + dy * dy;
      const rEfectivo = Math.sqrt(dist2 + eps2);

      if (tipo === "electrico" && f.q !== 0.0) {
        pot += (this.kElec * f.q) / rEfectivo;
      } else if (tipo === "gravitatorio" && f.m !== 0.0) {
        pot -= (this.G * f.m) / rEfectivo;
      } else if (tipo === "termico" && f.temp !== 0.0) {
        pot += f.temp / Math.sqrt(dist2 + 4.0);
      }
    }

    return pot;
  }

  // Calcula la intensidad de campo vectorial (E, g o gradiente) por diferencias finitas centrales
  calcularGradienteCampo(x, y, tipo = "electrico") {
    const h = 0.25;
    const vXMas = this.calcularPotencialPunto(x + h, y, tipo);
    const vXMenos = this.calcularPotencialPunto(x - h, y, tipo);
    const vYMas = this.calcularPotencialPunto(x, y + h, tipo);
    const vYMenos = this.calcularPotencialPunto(x, y - h, tipo);

    // El campo de fuerza conservativo es el gradiente negativo del potencial: F = -grad(V)
    const fx = -(vXMas - vXMenos) / (2.0 * h);
    const fy = -(vYMas - vYMenos) / (2.0 * h);

    return { fx, fy };
  }

  // Calcula la componente ortogonal del campo magnético Bz(x, y) generado por fuentes dipolares/bobinas
  calcularCampoMagneticoBz(x, y) {
    let bz = 0.0;
    const rNucleo2 = 3.5;

    for (let i = 0; i < this.fuentes.length; i++) {
      const f = this.fuentes[i];
      if (!f.mu) continue;
      const dx = x - f.x;
      const dy = y - f.y;
      const dist2 = dx * dx + dy * dy;
      // Ley de Biot-Savart / dipolo magnético en eje Z perpendicular al plano
      bz += (f.mu * 30.0) / Math.pow(dist2 + rNucleo2, 1.25);
    }

    return bz;
  }

  // Calcula la aceleración total que experimenta una partícula bajo gravitación, electrostática y fuerza de Lorentz
  calcularAceleracionParticula(p) {
    const m = Math.max(0.0001, p.m || 1.0);
    const q = p.q || 0.0;

    // 1. Aceleración gravitatoria g = -grad(V_grav)
    const gradG = this.calcularGradienteCampo(p.x, p.y, "gravitatorio");
    let ax = gradG.fx;
    let ay = gradG.fy;

    // 2. Fuerza electrostática F_e = q * E = -q * grad(V_elec)
    if (q !== 0.0) {
      const gradE = this.calcularGradienteCampo(p.x, p.y, "electrico");
      ax += (q / m) * gradE.fx;
      ay += (q / m) * gradE.fy;

      // 3. Fuerza magnética de Lorentz: F_mag = q * (v x B)
      // En 2D cartesiano: (vx, vy, 0) x (0, 0, Bz) = (vy*Bz, -vx*Bz, 0)
      const bz = this.calcularCampoMagneticoBz(p.x, p.y);
      if (bz !== 0.0) {
        ax += (q / m) * (p.vy * bz);
        ay += (q / m) * (-p.vx * bz);
      }
    }

    return { ax, ay };
  }

  // Simula la trayectoria de una partícula integrando numéricamente por el método simpléctico Euler-Cromer
  simularTrayectoria(particulaInicial, dt = 0.04, maxPasos = 250, limites = null) {
    let x = particulaInicial.x;
    let y = particulaInicial.y;
    let vx = particulaInicial.vx || 0.0;
    let vy = particulaInicial.vy || 0.0;
    const m = particulaInicial.m || 1.0;
    const q = particulaInicial.q || 0.0;

    const camino = [{ x, y, vx, vy, t: 0.0 }];
    let colision = false;
    let idCuerpoColision = null;

    for (let paso = 1; paso <= maxPasos; paso++) {
      const { ax, ay } = this.calcularAceleracionParticula({ x, y, vx, vy, m, q });

      vx += ax * dt;
      vy += ay * dt;
      x += vx * dt;
      y += vy * dt;

      camino.push({ x, y, vx, vy, t: paso * dt });

      // Verificación de choque contra cuerpos físicos del campo
      for (let i = 0; i < this.fuentes.length; i++) {
        const f = this.fuentes[i];
        if (Math.hypot(x - f.x, y - f.y) <= f.radio) {
          colision = true;
          idCuerpoColision = f.id;
          break;
        }
      }
      if (colision) break;

      // Verificación de límites de mundo
      if (limites) {
        if (x < limites.xMin || x > limites.xMax || y < limites.yMin || y > limites.yMax) {
          break;
        }
      }
    }

    return {
      camino,
      colision,
      idCuerpoColision,
      xFinal: x,
      yFinal: y,
      vFinal: Math.hypot(vx, vy)
    };
  }

  // Resuelve la ecuación de conducción térmica continua de Poisson en 2D (relajación por diferencias finitas)
  resolverCampoTermicoPoisson(nx = 36, ny = 26, limites, tAmbiente = 25.0, conductividad = 1.5, iteraciones = 45) {
    const grilla = new Float32Array(nx * ny);
    const anchoMundo = limites.xMax - limites.xMin;
    const altoMundo = limites.yMax - limites.yMin;
    const dx = anchoMundo / (nx - 1);
    const dy = altoMundo / (ny - 1);

    // Inicializa la placa a temperatura ambiente
    grilla.fill(tAmbiente);

    // Mapeo de coordenadas métricas a índice de celda de la grilla
    const aIndice = (x, y) => {
      const ix = Math.max(0, Math.min(nx - 1, Math.round(((x - limites.xMin) / anchoMundo) * (nx - 1))));
      const iy = Math.max(0, Math.min(ny - 1, Math.round(((y - limites.yMin) / altoMundo) * (ny - 1))));
      return iy * nx + ix;
    };

    // Relajación de Jacobi / Gauss-Seidel para estado estacionario
    for (let it = 0; it < iteraciones; it++) {
      for (let iy = 1; iy < ny - 1; iy++) {
        for (let ix = 1; ix < nx - 1; ix++) {
          const idx = iy * nx + ix;
          grilla[idx] = 0.25 * (
            grilla[idx - 1] +
            grilla[idx + 1] +
            grilla[idx - nx] +
            grilla[idx + nx]
          );
        }
      }

      // Inyección de fuentes térmicas activas
      for (let i = 0; i < this.fuentes.length; i++) {
        const f = this.fuentes[i];
        if (f.temp > 0) {
          const idx = aIndice(f.x, f.y);
          grilla[idx] = Math.max(grilla[idx], f.temp);
        }
      }
    }

    // Encuentra punto caliente máximo y temperatura promedio
    let tMax = tAmbiente;
    let sumaT = 0.0;
    for (let i = 0; i < grilla.length; i++) {
      const t = grilla[i];
      if (t > tMax) tMax = t;
      sumaT += t;
    }

    return {
      grilla,
      nx,
      ny,
      dx,
      dy,
      tMax,
      tPromedio: sumaT / grilla.length,
      tAmbiente
    };
  }

  // Extrae una matriz muestreada de potencial y vectores para renderizado en Canvas 2D
  generarMapaEquipotenciales(cols = 40, filas = 28, limites, tipo = "electrico") {
    const mapa = new Float32Array(cols * filas);
    const pasoX = (limites.xMax - limites.xMin) / (cols - 1);
    const pasoY = (limites.yMax - limites.yMin) / (filas - 1);
    let vMin = Infinity;
    let vMax = -Infinity;

    for (let iy = 0; iy < filas; iy++) {
      const y = limites.yMin + iy * pasoY;
      for (let ix = 0; ix < cols; ix++) {
        const x = limites.xMin + ix * pasoX;
        const v = this.calcularPotencialPunto(x, y, tipo);
        mapa[iy * cols + ix] = v;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
    }

    return {
      mapa,
      cols,
      filas,
      pasoX,
      pasoY,
      vMin,
      vMax,
      limites
    };
  }
}




// =========================================================================
// SOLVERS ESPECÍFICOS DE SIMULACIÓN DE CAMPOS Y POTENCIAL
// =========================================================================

export function calcularPotencialPunto(x, y, electrodos, cargasFijas) {
  let v = 0;
  const eps = 1.5; // Factor de suavizado para evitar singularidades en r = 0

  // Contribución de cargas fijas de borde y emisor/colector
  for (let i = 0; i < cargasFijas.length; i++) {
    const c = cargasFijas[i];
    const d = Math.hypot(x - c.x, y - c.y);
    v += (c.q * 100) / Math.sqrt(d * d + eps * eps);
  }

  // Contribución de los electrodos deflectores móviles del genoma
  for (let i = 0; i < electrodos.length; i++) {
    const e = electrodos[i];
    const d = Math.hypot(x - e.x, y - e.y);
    v += (e.q * 100) / Math.sqrt(d * d + eps * eps);
  }

  return v;
}

// Calcula el gradiente del campo eléctrico E = -grad(V) mediante diferencias finitas centrales.
export function calcularCampoVectorial(x, y, electrodos, cargasFijas) {
  const h = 0.5;
  const vXMas = calcularPotencialPunto(x + h, y, electrodos, cargasFijas);
  const vXMenos = calcularPotencialPunto(x - h, y, electrodos, cargasFijas);
  const vYMas = calcularPotencialPunto(x, y + h, electrodos, cargasFijas);
  const vYMenos = calcularPotencialPunto(x, y - h, electrodos, cargasFijas);

  // E = - dV/dr
  const ex = -(vXMas - vXMenos) / (2 * h);
  const ey = -(vYMas - vYMenos) / (2 * h);

  return { ex, ey };
}

// Simula la trayectoria dinámica de una partícula cargada dentro del campo de potencial mediante integración por pasos.
export function simularTrayectoriaParticula(genoma, entrada) {
  // Coordenadas de emisor y colector
  const emisorX = Number(entrada?.emisorX !== undefined ? entrada.emisorX : -45);
  const emisorY = Number(entrada?.emisorY !== undefined ? entrada.emisorY : 0);
  const colectorX = Number(entrada?.colectorX !== undefined ? entrada.colectorX : 45);
  const colectorY = Number(entrada?.colectorY !== undefined ? entrada.colectorY : 0);
  const vInicial = Number(entrada?.velocidadInicial !== undefined ? entrada.velocidadInicial : 14.0);
  const cargaParticula = Number(entrada?.cargaParticula !== undefined ? entrada.cargaParticula : 1.0);

  // 2 o 3 electrodos deflectores optimizados en el genoma: [x1, y1, q1, x2, y2, q2]
  const electrodos = [
    { x: genoma[0], y: genoma[1], q: genoma[2] },
    { x: genoma[3], y: genoma[4], q: genoma[5] }
  ];

  if (genoma.length >= 9) {
    electrodos.push({ x: genoma[6], y: genoma[7], q: genoma[8] });
  }

  // Cargas fijas de contorno y obstáculo prohibitivo central
  const cargasFijas = [
    { x: 0, y: 0, q: 1.8 },      // Barrera de potencial central repulsora
    { x: emisorX, y: emisorY, q: 0.5 }, // Emisor
    { x: colectorX, y: colectorY, q: -1.2 } // Colector atractor
  ];

  let x = emisorX;
  let y = emisorY;
  let vx = vInicial;
  let vy = 0.0;
  const dt = 0.05;
  const masa = 1.0;

  const trayectoria = [{ x, y, vx, vy, t: 0 }];
  let distanciaMinimaColector = Infinity;
  let energiaCinematicaTotal = 0;
  let colisionObstaculo = false;
  let tiempoEscape = 0;

  for (let paso = 0; paso < 200; paso++) {
    // Distancia al colector diana
    const distColector = Math.hypot(x - colectorX, y - colectorY);
    if (distColector < distanciaMinimaColector) {
      distanciaMinimaColector = distColector;
    }

    // Detección de colisión con la barrera de potencial central fija (|r| < 6)
    const distCentro = Math.hypot(x, y);
    if (distCentro < 6.0) {
      colisionObstaculo = true;
    }

    // Si alcanza el colector (distancia < 3.5), se considera llegada exitosa
    if (distColector < 3.5) {
      break;
    }

    // Fuerza electrostática F = q * E
    const { ex, ey } = calcularCampoVectorial(x, y, electrodos, cargasFijas);
    const fx = cargaParticula * ex;
    const fy = cargaParticula * ey;

    const ax = fx / masa;
    const ay = fy / masa;

    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;

    energiaCinematicaTotal += 0.5 * masa * (vx * vx + vy * vy) * dt;
    trayectoria.push({ x, y, vx, vy, t: (paso + 1) * dt });

    // Si escapa de los límites razonables del campo [-60, 60]
    if (Math.abs(x) > 65 || Math.abs(y) > 45) {
      tiempoEscape = (paso + 1) * dt;
      break;
    }
  }

  const exitoLlegada = distanciaMinimaColector < 3.5;

  return {
    electrodos,
    cargasFijas,
    trayectoria,
    distanciaMinimaColector,
    energiaCinematicaTotal,
    colisionObstaculo,
    exitoLlegada,
    emisorX,
    emisorY,
    colectorX,
    colectorY
  };
}

// Objeto de definición del modelo para el motor evolutivo.


export function calcularCampoMagneticoBz(x, y, bobinas) {
  let bz = 0.0;
  const rNucleo2 = 4.0; // Radio efectivo del núcleo para evitar singularidades en r = 0

  for (let i = 0; i < bobinas.length; i++) {
    const bob = bobinas[i];
    const dx = x - bob.x;
    const dy = y - bob.y;
    const dist2 = dx * dx + dy * dy;
    // Bz decrece con la distancia al eje del solenoide / dipolo
    bz += (bob.corriente * 40.0) / Math.pow(dist2 + rNucleo2, 1.25);
  }

  return bz;
}

// Calcula el campo eléctrico Ex, Ey generado por las dos placas deflectoras superior e inferior.
export function calcularCampoElectrico(x, y, vSuperior, vInferior) {
  const dPlacas = 32.0; // Distancia entre placas en el eje Y
  // Campo uniforme principal en el canal central con decaimiento en los extremos X
  const amortiguacionBorde = 1.0 / (1.0 + Math.pow(x / 30.0, 4));
  const ey = ((vInferior - vSuperior) / dPlacas) * amortiguacionBorde;
  const ex = -((vSuperior + vInferior) * 0.015 * (x / 30.0)) * amortiguacionBorde;

  return { ex, ey };
}

// Simula la trayectoria de un haz de partículas cargadas bajo la fuerza de Lorentz F = q*(E + v x B).
export function simularTrayectoriaLorentz(genoma, entrada) {
  const q = Number(entrada?.cargaParticula !== undefined ? entrada.cargaParticula : 1.0);
  const m = 1.0; // Masa unitaria de la partícula
  const vInyeccion = Number(entrada?.velocidadInyeccion !== undefined ? entrada.velocidadInyeccion : 24.0);
  const yObjetivo = Number(entrada?.posicionSalidaY !== undefined ? entrada.posicionSalidaY : 6.0);
  const dispersionHaz = Number(entrada?.dispersionHaz !== undefined ? entrada.dispersionHaz : 2.5);

  // 6 genes del genoma:
  // [I1, I2, I3, I4]: Corrientes de 4 electroimanes en Amperios [-12 A, 12 A]
  // [V_sup, V_inf]: Voltajes de placas deflectoras en Voltios [-250 V, 250 V]
  const [i1, i2, i3, i4, vSup, vInf] = genoma;

  // Posiciones de los 4 electroimanes en la cámara de vacío
  const bobinas = [
    { x: -18.0, y: 16.0, corriente: i1 }, // Bobina Superior Izquierda
    { x: 18.0, y: 16.0, corriente: i2 },  // Bobina Superior Derecha
    { x: -18.0, y: -16.0, corriente: i3 },// Bobina Inferior Izquierda
    { x: 18.0, y: -16.0, corriente: i4 }  // Bobina Inferior Derecha
  ];

  // Geometría de la cámara de vacío
  const xMin = -45.0;
  const xMax = 42.0;
  const yLimite = 24.0;
  const xSalida = 38.0;

  // Simulación de un haz compuesto de 5 partículas representativas con leve dispersión angular
  const numParticulas = 5;
  const trayectorias = [];
  const dt = 0.035;
  const maxPasos = 180;

  let particulasTransmitidas = 0;
  let sumaErrorSalida = 0.0;
  let colisionesPared = 0;

  for (let p = 0; p < numParticulas; p++) {
    // Dispersión angular normalizada del haz en la rendija de inyección
    const factorDisp = numParticulas === 1 ? 0 : (p / (numParticulas - 1) - 0.5) * 2.0;
    const anguloEntradaRad = (factorDisp * dispersionHaz * Math.PI) / 180.0;
    const yEntrada = factorDisp * 1.5;

    let x = -40.0;
    let y = yEntrada;
    let vx = vInyeccion * Math.cos(anguloEntradaRad);
    let vy = vInyeccion * Math.sin(anguloEntradaRad);

    const camino = [{ x, y, vx, vy, t: 0 }];
    let colision = false;
    let salioPorColimador = false;

    for (let paso = 1; paso <= maxPasos; paso++) {
      const bz = calcularCampoMagneticoBz(x, y, bobinas);
      const { ex, ey } = calcularCampoElectrico(x, y, vSup, vInf);

      // Aceleración por Fuerza de Lorentz: a = (q/m) * (E + v x B)
      // En 2D: (vx, vy, 0) x (0, 0, Bz) = (vy*Bz, -vx*Bz, 0)
      const ax = (q / m) * (ex + vy * bz);
      const ay = (q / m) * (ey - vx * bz);

      // Integración numérica por método semi-implícito Euler-Cromer
      vx += ax * dt;
      vy += ay * dt;
      x += vx * dt;
      y += vy * dt;

      camino.push({ x, y, vx, vy, t: paso * dt });

      // Verificación de choque contra las paredes de la cámara de confinamiento
      if (Math.abs(y) >= yLimite || x < xMin) {
        colision = true;
        colisionesPared++;
        break;
      }

      // Verificación de llegada al plano del detector / colimador de salida
      if (x >= xSalida) {
        const errorY = Math.abs(y - yObjetivo);
        if (errorY <= 4.0) {
          salioPorColimador = true;
          particulasTransmitidas++;
        }
        sumaErrorSalida += errorY;
        break;
      }
    }

    if (!salioPorColimador && !colision) {
      sumaErrorSalida += Math.abs(y - yObjetivo) + 12.0;
    }

    trayectorias.push({
      camino,
      colision,
      salioPorColimador,
      yFinal: camino[camino.length - 1].y
    });
  }

  // Eficiencia de transmisión del haz (0 % a 100 %)
  const tasaTransmision = (particulasTransmitidas / numParticulas) * 100.0;
  const errorPromedioSalida = sumaErrorSalida / numParticulas;

  // Consumo total de potencia eléctrica Joule: P = sum(I^2 * R_bobina) + V^2 / R_placa
  const potenciaBobinasWatts = (i1 * i1 + i2 * i2 + i3 * i3 + i4 * i4) * 0.8;
  const potenciaDeflectoresWatts = (vSup * vSup + vInf * vInf) * 0.0012;
  const potenciaTotalWatts = potenciaBobinasWatts + potenciaDeflectoresWatts;

  // Intensidad máxima de campo magnético |Bz| en la cámara
  let maxAbsBz = 0.0;
  bobinas.forEach((b) => {
    const mag = Math.abs(b.corriente);
    if (mag > maxAbsBz) maxAbsBz = mag;
  });

  return {
    bobinas,
    vSuperior: vSup,
    vInferior: vInf,
    yObjetivo,
    xSalida,
    trayectorias,
    particulasTransmitidas,
    tasaTransmision,
    errorPromedioSalida,
    colisionesPared,
    potenciaTotalWatts,
    maxAbsBz: maxAbsBz * 0.12 // Valor relativo en Teslas
  };
}

// Objeto de definición del modelo para el motor evolutivo.


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

export default MotorCamposUnificados;
