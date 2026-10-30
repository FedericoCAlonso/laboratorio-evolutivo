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

export default MotorCamposUnificados;
