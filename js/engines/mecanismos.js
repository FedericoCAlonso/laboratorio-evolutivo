// =========================================================================
// MÓDULO: MOTOR DE MECANISMOS MULTICUERPO Y MULTIFÍSICA 2D
// MODELO DE DOMINIO MATEMÁTICO PURO (COMPATIBLE CON WEB WORKER Y NODE.JS)
// =========================================================================

import { MotorEstructurasCinematica } from "./estructuras.js";
import { MotorCamposUnificados } from "./campos.js";

// Representación formal de un grafo de mecanismo multicuerpo y acoplamiento multifísica
export class GrafoMecanismoMultifisica {
  constructor(definicion = {}) {
    this.nodos = [];
    this.barras = [];
    this.cuerposRigidos = [];
    this.motores = [];
    this.transmisiones = [];
    this.sensores = [];
    this.capasFisicas = {
      imanes: [],
      cargas: [],
      obstaculos: []
    };

    if (definicion) {
      this.cargarDesdeObjeto(definicion);
    }
  }

  // Agrega o actualiza un nodo (articulación de bisagra, anclaje o corredera)
  agregarNodo(nodo) {
    const id = nodo.id || `nodo_${this.nodos.length + 1}`;
    const nuevo = {
      id,
      nombre: nodo.nombre || id,
      x: Number(nodo.x !== undefined ? nodo.x : 0.0),
      y: Number(nodo.y !== undefined ? nodo.y : 0.0),
      tipo: nodo.tipo || "libre", // 'fijo' | 'libre' | 'deslizante'
      anguloGuia: Number(nodo.anguloGuia !== undefined ? nodo.anguloGuia : 0.0),
      masa: Number(nodo.masa !== undefined ? nodo.masa : 1.0),
      carga: Number(nodo.carga !== undefined ? nodo.carga : 0.0),
      imanDipolo: Number(nodo.imanDipolo !== undefined ? nodo.imanDipolo : 0.0),
      temperaturaFuente: Number(nodo.temperaturaFuente !== undefined ? nodo.temperaturaFuente : 0.0),
      variableX: nodo.variableX || null,
      variableY: nodo.variableY || null,
      signoX: nodo.signoX !== undefined ? Number(nodo.signoX) : undefined,
      signoY: nodo.signoY !== undefined ? Number(nodo.signoY) : undefined,
      offsetX: nodo.offsetX !== undefined ? Number(nodo.offsetX) : 0,
      offsetY: nodo.offsetY !== undefined ? Number(nodo.offsetY) : 0,
      escalaX: nodo.escalaX !== undefined ? Number(nodo.escalaX) : 1,
      escalaY: nodo.escalaY !== undefined ? Number(nodo.escalaY) : 1
    };
    const idx = this.nodos.findIndex(n => n.id === id);
    if (idx >= 0) this.nodos[idx] = nuevo;
    else this.nodos.push(nuevo);
    return nuevo;
  }

  // Agrega una barra conectora (eslabón binario / palito)
  agregarBarra(barra) {
    const id = barra.id || `barra_${this.barras.length + 1}`;
    const nueva = {
      id,
      nombre: barra.nombre || id,
      nodoA: barra.nodoA,
      nodoB: barra.nodoB,
      longitud: Number(barra.longitud !== undefined ? barra.longitud : 0.0),
      variableAsociada: barra.variableAsociada || barra.longitudVinculada || null,
      signoTrilateracion: barra.signoTrilateracion !== undefined ? Number(barra.signoTrilateracion) : 1,
      color: barra.color || "#3b82f6",
      grosor: Number(barra.grosor !== undefined ? barra.grosor : 2.5),
      esAuxiliar: Boolean(barra.esAuxiliar)
    };
    const idx = this.barras.findIndex(b => b.id === id);
    if (idx >= 0) this.barras[idx] = nueva;
    else this.barras.push(nueva);
    return nueva;
  }

  // Agrega un cuerpo rígido poligonal (triángulo o placa con 3 o más nodos)
  agregarCuerpoRigido(cuerpo) {
    const id = cuerpo.id || `cuerpo_${this.cuerposRigidos.length + 1}`;
    const nuevo = {
      id,
      nombre: cuerpo.nombre || id,
      nodos: Array.isArray(cuerpo.nodos) ? [...cuerpo.nodos] : [],
      color: cuerpo.color || "rgba(59, 130, 246, 0.15)",
      bordeColor: cuerpo.bordeColor || "#2563eb"
    };
    const idx = this.cuerposRigidos.findIndex(c => c.id === id);
    if (idx >= 0) this.cuerposRigidos[idx] = nuevo;
    else this.cuerposRigidos.push(nuevo);
    return nuevo;
  }

  // Agrega un actuador (motor rotativo manivela o motor lineal pistón)
  agregarMotor(motor) {
    const id = motor.id || `motor_${this.motores.length + 1}`;
    const nuevo = {
      id,
      nombre: motor.nombre || id,
      tipo: motor.tipo || "rotativo", // 'rotativo' | 'lineal'
      nodoPivote: motor.nodoPivote || null,
      nodoExtremo: motor.nodoExtremo || motor.nodoSeguidor || null,
      longitudManivela: Number(motor.longitudManivela !== undefined ? motor.longitudManivela : 15.0),
      velocidadAngular: Number(motor.velocidadAngular !== undefined ? motor.velocidadAngular : 1.0),
      anguloInicial: Number(motor.anguloInicial !== undefined ? motor.anguloInicial : 0.0),
      carreraMin: Number(motor.carreraMin !== undefined ? motor.carreraMin : 10.0),
      carreraMax: Number(motor.carreraMax !== undefined ? motor.carreraMax : 50.0),
      variableAsociada: motor.variableAsociada || null
    };
    const idx = this.motores.findIndex(m => m.id === id);
    if (idx >= 0) this.motores[idx] = nuevo;
    else this.motores.push(nuevo);
    return nuevo;
  }

  // Agrega una transmisión mecánica de engranaje o polea entre dos ejes
  agregarTransmision(transmision) {
    const id = transmision.id || `trans_${this.transmisiones.length + 1}`;
    const r1 = Number(transmision.radio1 !== undefined ? transmision.radio1 : 20.0);
    const r2 = Number(transmision.radio2 !== undefined ? transmision.radio2 : 40.0);
    const nueva = {
      id,
      nombre: transmision.nombre || id,
      tipo: transmision.tipo || "engranaje", // 'engranaje' | 'polea'
      nodo1: transmision.nodo1,
      nodo2: transmision.nodo2,
      radio1: r1,
      radio2: r2,
      relacion: Number(transmision.relacion !== undefined ? transmision.relacion : (r2 > 0 ? r1 / r2 : 0.5)),
      variableAsociada: transmision.variableAsociada || null
    };
    const idx = this.transmisiones.findIndex(t => t.id === id);
    if (idx >= 0) this.transmisiones[idx] = nueva;
    else this.transmisiones.push(nueva);
    return nueva;
  }

  // Agrega un punto de medida / sensor de telemetría física sobre un nodo
  agregarSensor(sensor) {
    const id = sensor.id || `sensor_${this.sensores.length + 1}`;
    const nuevo = {
      id,
      nombre: sensor.nombre || id,
      nodoId: sensor.nodoId || sensor.nodoAsociado || null,
      magnitudes: Array.isArray(sensor.magnitudes)
        ? [...sensor.magnitudes]
        : ["posicion", "velocidad", "aceleracion", "trayectoria"],
      color: sensor.color || "#f59e0b"
    };
    const idx = this.sensores.findIndex(s => s.id === id);
    if (idx >= 0) this.sensores[idx] = nuevo;
    else this.sensores.push(nuevo);
    return nuevo;
  }

  // Agrega o actualiza una capa física o acoplamiento multiefecto (ej. imán, carga electrostática)
  agregarCapaFisica(capa) {
    const id = capa.id || `capa_${this.capasFisicas.length + 1}`;
    const nueva = {
      id,
      tipo: capa.tipo || "iman", // 'iman' | 'carga' | 'temperatura'
      nodoAsociado: capa.nodoAsociado || capa.nodoId || null,
      momentoMagnetico: Number(capa.momentoMagnetico !== undefined ? capa.momentoMagnetico : 1.0),
      cargaCoulomb: Number(capa.cargaCoulomb !== undefined ? capa.cargaCoulomb : 1e-6),
      temperatura: Number(capa.temperatura !== undefined ? capa.temperatura : 25.0)
    };
    const idx = this.capasFisicas.findIndex(c => c.id === id);
    if (idx >= 0) this.capasFisicas[idx] = nueva;
    else this.capasFisicas.push(nueva);
    return nueva;
  }

  // Carga una definición completa estructurada en formato objeto/JSON
  cargarDesdeObjeto(obj) {
    if (!obj || typeof obj !== "object") return;
    this.nodos = [];
    this.barras = [];
    this.cuerposRigidos = [];
    this.motores = [];
    this.transmisiones = [];
    this.sensores = [];
    this.capasFisicas = [];

    (obj.nodos || []).forEach(n => this.agregarNodo(n));
    (obj.barras || []).forEach(b => this.agregarBarra(b));
    (obj.cuerposRigidos || []).forEach(c => this.agregarCuerpoRigido(c));
    (obj.motores || []).forEach(m => this.agregarMotor(m));
    (obj.transmisiones || []).forEach(t => this.agregarTransmision(t));
    (obj.sensores || []).forEach(s => this.agregarSensor(s));
    (obj.capasFisicas || []).forEach(cp => this.agregarCapaFisica(cp));
  }

  // Exporta el grafo completo a un objeto plano serializable
  exportarAObjeto() {
    return {
      nodos: JSON.parse(JSON.stringify(this.nodos)),
      barras: JSON.parse(JSON.stringify(this.barras)),
      cuerposRigidos: JSON.parse(JSON.stringify(this.cuerposRigidos)),
      motores: JSON.parse(JSON.stringify(this.motores)),
      transmisiones: JSON.parse(JSON.stringify(this.transmisiones)),
      sensores: JSON.parse(JSON.stringify(this.sensores)),
      capasFisicas: JSON.parse(JSON.stringify(this.capasFisicas))
    };
  }

  // Alias compatible para exportación a objeto/JSON plano
  exportarJSON() {
    return this.exportarAObjeto();
  }

  // Clona una copia profunda e independiente del grafo
  clonar() {
    return new GrafoMecanismoMultifisica(this.exportarAObjeto());
  }
}

// Analizador de Grados de Libertad (Criterio de Grübler-Kutzbach para mecanismos planares 2D)
export function analizarGradosLibertad(grafo) {
  if (!grafo || !Array.isArray(grafo.nodos) || grafo.nodos.length === 0) {
    return {
      dof: 0,
      nCuerpos: 0,
      j1: 0,
      j2: 0,
      nMotores: 0,
      estado: "vacio",
      mensaje: "El mecanismo no contiene nodos definidos."
    };
  }

  // 1. Identificación del marco de referencia (Bancada fija a tierra = Cuerpo 0)
  const nodosFijos = grafo.nodos.filter(n => n.tipo === "fijo");
  const nodosLibres = grafo.nodos.filter(n => n.tipo !== "fijo");

  // 2. Conteo de cuerpos rígidos n
  // La bancada/tierra cuenta como 1 cuerpo rígido
  let n = nodosFijos.length > 0 ? 1 : 0;

  // Cada barra binaria que no pertenezca a un cuerpo rígido poligonal es un cuerpo rígido
  const barrasEnCuerpos = new Set();
  (grafo.cuerposRigidos || []).forEach(cr => {
    n++; // Cada cuerpo rígido poligonal suma 1 cuerpo
    // Registra barras internas conectadas
    for (let i = 0; i < cr.nodos.length; i++) {
      for (let j = i + 1; j < cr.nodos.length; j++) {
        barrasEnCuerpos.add(`${cr.nodos[i]}_${cr.nodos[j]}`);
        barrasEnCuerpos.add(`${cr.nodos[j]}_${cr.nodos[i]}`);
      }
    }
  });

  (grafo.barras || []).forEach(b => {
    if (!b.esAuxiliar && !barrasEnCuerpos.has(`${b.nodoA}_${b.nodoB}`)) {
      n++;
    }
  });

  // Motores rotativos o lineales aportan un eslabón (manivela / actuador) solo si no está ya modelado como barra
  const motoresComoEslabon = [];
  (grafo.motores || []).forEach(m => {
    const ext = m.nodoExtremo || m.nodoSeguidor;
    const yaExiste = (grafo.barras || []).some(
      b => (b.nodoA === m.nodoPivote && b.nodoB === ext) ||
           (b.nodoB === m.nodoPivote && b.nodoA === ext)
    );
    if (!yaExiste) {
      if (m.tipo === "rotativo") {
        n++;
        motoresComoEslabon.push(m);
      } else if (m.tipo === "lineal") {
        // Actuador lineal (cilindro + émbolo con unión prismática bloqueada por el actuador)
        n++;
        motoresComoEslabon.push(m);
      }
    }
  });

  // 3. Conteo de uniones cinemáticas j1 (1 Grado de Libertad: Revoluta / Prismática)
  // Cada nodo de unión conecta un conjunto de cuerpos adyacentes.
  // Si en una articulación concurren k cuerpos rígidos, aporta (k - 1) pares cinemáticos de revoluta.
  const adyacenciaCuerposPorNodo = {};
  grafo.nodos.forEach(nodo => {
    adyacenciaCuerposPorNodo[nodo.id] = new Set();
  });

  // Bancada (cuerpo "tierra")
  nodosFijos.forEach(nf => {
    adyacenciaCuerposPorNodo[nf.id].add("tierra");
  });

  // Nodos deslizantes (correderas prismáticas sobre la bancada fija)
  grafo.nodos.filter(nd => nd.tipo === "deslizante").forEach(nd => {
    adyacenciaCuerposPorNodo[nd.id].add("tierra");
  });

  // Barras
  (grafo.barras || []).forEach(b => {
    if (adyacenciaCuerposPorNodo[b.nodoA]) adyacenciaCuerposPorNodo[b.nodoA].add(b.id);
    if (adyacenciaCuerposPorNodo[b.nodoB]) adyacenciaCuerposPorNodo[b.nodoB].add(b.id);
  });

  // Cuerpos rígidos poligonales
  (grafo.cuerposRigidos || []).forEach(cr => {
    cr.nodos.forEach(nid => {
      if (adyacenciaCuerposPorNodo[nid]) adyacenciaCuerposPorNodo[nid].add(cr.id);
    });
  });

  // Motores independientes no modelados como barra
  motoresComoEslabon.forEach(m => {
    const ext = m.nodoExtremo || m.nodoSeguidor;
    if (adyacenciaCuerposPorNodo[m.nodoPivote]) adyacenciaCuerposPorNodo[m.nodoPivote].add(`motor_${m.id}`);
    if (ext && adyacenciaCuerposPorNodo[ext]) adyacenciaCuerposPorNodo[ext].add(`motor_${m.id}`);
  });

  let j1 = 0;
  for (const nid in adyacenciaCuerposPorNodo) {
    const k = adyacenciaCuerposPorNodo[nid].size;
    if (k > 1) {
      j1 += (k - 1);
    }
  }

  // 4. Conteo de pares cinemáticos de 2 GDL j2 (Engranajes / Levas)
  let j2 = 0;
  (grafo.transmisiones || []).forEach(t => {
    if (t.tipo === "engranaje") j2++;
  });

  // 5. Aplicación del Criterio de Grübler-Kutzbach en 2D: M = 3(n - 1) - 2*j1 - j2
  const dof = Math.max(-10, 3 * (n - 1) - 2 * j1 - j2);
  const nMotores = (grafo.motores || []).length;

  let estado = "determinado";
  let mensaje = "";

  if (dof <= 0) {
    estado = "estructura_rigida";
    mensaje = `M = ${dof} | Estructura rígida o hiperestática (no hay movilidad global).`;
  } else if (dof === nMotores) {
    estado = "determinado";
    mensaje = `M = ${dof} | Mecanismo cinemáticamente determinado (Accionado exactamente por ${nMotores} motor/es).`;
  } else if (dof > nMotores) {
    estado = "subrestringido";
    const faltantes = dof - nMotores;
    mensaje = `M = ${dof} | Mecanismo sub-restringido (Tiene ${dof} GDL pero solo ${nMotores} motor/es. Se requieren ${faltantes} motor/es adicional/es).`;
  } else {
    estado = "sobrerrestringido";
    mensaje = `M = ${dof} | Sobrerrestringido por actuadores (${nMotores} motores para ${dof} GDL: posible bloqueo de movimiento).`;
  }

  return {
    dof,
    M: dof,
    nCuerpos: n,
    j1,
    j2,
    nMotores,
    numMotores: nMotores,
    estado,
    esDeterminado: estado === "determinado",
    mensaje
  };
}

// Resuelve la posición cinemática de todos los nodos del mecanismo para un ángulo theta dado
export function resolverPasoMecanismo(grafo, theta, vars = {}) {
  const mapaNodos = {};
  const sinMotores = !grafo.motores || grafo.motores.length === 0;
  grafo.nodos.forEach(n => {
    let x = n.x;
    let y = n.y;
    // Permite sobreescribir coordenadas mediante variables vinculadas (con soporte de offset y escala)
    if (n.variableX && vars[n.variableX] !== undefined) {
      const valX = Number(vars[n.variableX]);
      const ox = n.offsetX || 0;
      const ex = n.escalaX || 1;
      x = n.signoX !== undefined ? ox + n.signoX * Math.abs(valX) * ex : ox + valX * ex;
    }
    if (n.variableY && vars[n.variableY] !== undefined) {
      const valY = Number(vars[n.variableY]);
      const oy = n.offsetY || 0;
      const ey = n.escalaY || 1;
      y = n.signoY !== undefined ? oy + n.signoY * Math.abs(valY) * ey : oy + valY * ey;
    }
    mapaNodos[n.id] = {
      id: n.id,
      nombre: n.nombre,
      x,
      y,
      xBase: x,
      yBase: y,
      anguloGuia: n.anguloGuia || 0,
      resuelto: n.tipo === "fijo" || Boolean(n.variableX || n.variableY) || sinMotores,
      tipo: n.tipo,
      anguloGiro: 0
    };
  });

  // Actualiza longitudes de barras según el diccionario de variables
  const mapaBarras = {};
  grafo.barras.forEach(b => {
    let L = b.longitud;
    const varNom = b.variableAsociada || b.longitudVinculada;
    if (varNom && vars[varNom] !== undefined) {
      L = Number(vars[varNom]);
    }
    mapaBarras[b.id] = { ...b, longitudEfectiva: L };
  });

  // 1. Actuación de motores rotativos y lineales (con propagación a engranajes/poleas)
  const angulosNodos = {};
  (grafo.motores || []).forEach(m => {
    if (!mapaNodos[m.nodoPivote] || !mapaNodos[m.nodoExtremo]) return;
    const piv = mapaNodos[m.nodoPivote];
    let radio = m.longitudManivela || m.amplitud || 15.0;
    const varNom = m.variableAsociada || m.amplitudVinculada;
    if (varNom && vars[varNom] !== undefined) {
      radio = Number(vars[varNom]);
    }

    if (m.tipo === "rotativo") {
      const ang = theta * (m.velocidadAngular || 1.0) + (m.anguloInicial || 0.0);
      angulosNodos[m.nodoPivote] = ang;
      mapaNodos[m.nodoPivote].anguloGiro = ang;
      mapaNodos[m.nodoExtremo].x = piv.x + radio * Math.cos(ang);
      mapaNodos[m.nodoExtremo].y = piv.y + radio * Math.sin(ang);
      mapaNodos[m.nodoExtremo].resuelto = true;
    } else if (m.tipo === "lineal") {
      const cMin = m.carreraMin !== undefined ? m.carreraMin : radio * 0.7;
      const cMax = m.carreraMax !== undefined ? m.carreraMax : radio * 1.3;
      const factor = 0.5 * (1 + Math.sin(theta * (m.velocidadAngular || 1.0) + (m.anguloInicial || 0.0)));
      const distActiva = cMin + (cMax - cMin) * factor;
      const extOrig = grafo.nodos.find(nd => nd.id === m.nodoExtremo);
      const angDir = extOrig ? Math.atan2(extOrig.y - piv.y, extOrig.x - piv.x) : (m.anguloInicial || 0.0);
      mapaNodos[m.nodoExtremo].x = piv.x + distActiva * Math.cos(angDir);
      mapaNodos[m.nodoExtremo].y = piv.y + distActiva * Math.sin(angDir);
      mapaNodos[m.nodoExtremo].resuelto = true;
    }
  });

  // 1b. Propagación de transmisiones (engranajes y poleas)
  (grafo.transmisiones || []).forEach(tr => {
    const r1 = tr.radio1 || 20;
    const r2 = tr.radio2 || 20;
    const relacion = r1 / Math.max(1e-3, r2);
    const signo = tr.tipo === "engranaje" ? -1 : 1;
    if (angulosNodos[tr.nodo1] !== undefined && mapaNodos[tr.nodo2]) {
      const ang2 = signo * angulosNodos[tr.nodo1] * relacion;
      angulosNodos[tr.nodo2] = ang2;
      mapaNodos[tr.nodo2].anguloGiro = ang2;
    } else if (angulosNodos[tr.nodo2] !== undefined && mapaNodos[tr.nodo1]) {
      const ang1 = signo * angulosNodos[tr.nodo2] / Math.max(1e-3, relacion);
      angulosNodos[tr.nodo1] = ang1;
      mapaNodos[tr.nodo1].anguloGiro = ang1;
    }
  });

  // Si un nodo con engranaje/polea tiene una barra rígida hacia un nodo libre y una sola conexión, actúa como manivela conducida
  (grafo.transmisiones || []).forEach(tr => {
    [tr.nodo1, tr.nodo2].forEach(nid => {
      if (angulosNodos[nid] === undefined || !mapaNodos[nid]) return;
      const piv = mapaNodos[nid];
      (grafo.barras || []).forEach(b => {
        const otroId = b.nodoA === nid ? b.nodoB : (b.nodoB === nid ? b.nodoA : null);
        if (!otroId || !mapaNodos[otroId] || mapaNodos[otroId].resuelto) return;
        // Cuenta cuántas barras concurren en otroId
        const grado = (grafo.barras || []).filter(bx => bx.nodoA === otroId || bx.nodoB === otroId).length;
        if (grado === 1) {
          const L = mapaBarras[b.id]?.longitudEfectiva || b.longitud;
          const nOrig = grafo.nodos.find(nx => nx.id === otroId);
          const ang0 = nOrig ? Math.atan2(nOrig.y - piv.y, nOrig.x - piv.x) : 0;
          const angTotal = ang0 + angulosNodos[nid];
          mapaNodos[otroId].x = piv.x + L * Math.cos(angTotal);
          mapaNodos[otroId].y = piv.y + L * Math.sin(angTotal);
          mapaNodos[otroId].resuelto = true;
        }
      });
    });
  });

  // 2. Algoritmo iterativo de propagación de trilateración y correderas para nodos dependientes
  let huboAvance = true;
  let iteraciones = 0;
  const maxIter = 15;

  while (huboAvance && iteraciones++ < maxIter) {
    huboAvance = false;

    grafo.nodos.forEach(n => {
      if (mapaNodos[n.id].resuelto) return;

      // Encuentra todas las barras conectadas a este nodo cuyos extremos opuestos ya estén resueltos
      const conexiones = [];
      for (const bid in mapaBarras) {
        const b = mapaBarras[bid];
        if (b.nodoA === n.id && mapaNodos[b.nodoB]?.resuelto) {
          conexiones.push({ nodoFijo: mapaNodos[b.nodoB], radio: b.longitudEfectiva, signo: b.signoTrilateracion || 1 });
        } else if (b.nodoB === n.id && mapaNodos[b.nodoA]?.resuelto) {
          conexiones.push({ nodoFijo: mapaNodos[b.nodoA], radio: b.longitudEfectiva, signo: b.signoTrilateracion || 1 });
        }
      }

      // Caso A: Nodo prismático / deslizante sobre guía lineal (1 barra desde un nodo resuelto)
      if (n.tipo === "deslizante" && conexiones.length >= 1) {
        const c1 = conexiones[0];
        const alpha = ((n.anguloGuia || 0) * Math.PI) / 180;
        const ux = Math.cos(alpha);
        const uy = Math.sin(alpha);
        const dx0 = mapaNodos[n.id].xBase - c1.nodoFijo.x;
        const dy0 = mapaNodos[n.id].yBase - c1.nodoFijo.y;
        const bProj = dx0 * ux + dy0 * uy;
        const cVal = dx0 * dx0 + dy0 * dy0 - c1.radio * c1.radio;
        const disc = bProj * bProj - cVal;
        if (disc >= 0) {
          const s1 = -bProj + Math.sqrt(disc);
          const s2 = -bProj - Math.sqrt(disc);
          const s = Math.abs(s1) <= Math.abs(s2) ? s1 : s2;
          mapaNodos[n.id].x = mapaNodos[n.id].xBase + s * ux;
          mapaNodos[n.id].y = mapaNodos[n.id].yBase + s * uy;
          mapaNodos[n.id].resuelto = true;
          huboAvance = true;
          return;
        }
      }

      // Caso B: Nodo libre revoluta conectado a 2 nodos ya resueltos (Trilateración)
      if (conexiones.length >= 2) {
        const c1 = conexiones[0];
        const c2 = conexiones[1];
        const pt = MotorEstructurasCinematica.resolverTrilateracion(
          c1.nodoFijo,
          c2.nodoFijo,
          c1.radio,
          c2.radio,
          n.signoTrilateracion !== undefined ? n.signoTrilateracion : c1.signo
        );

        if (pt) {
          mapaNodos[n.id].x = pt.x;
          mapaNodos[n.id].y = pt.y;
          mapaNodos[n.id].resuelto = true;
          huboAvance = true;
        }
      }
    });
  }

  // Comprueba si todos los nodos fueron resueltos con éxito
  const todosResueltos = grafo.nodos.every(n => mapaNodos[n.id].resuelto);

  return {
    theta,
    esValido: todosResueltos,
    nodos: mapaNodos
  };
}

// Sincroniza las posiciones (x, y) de todos los nodos del grafo según las longitudes y variables activas
export function sincronizarPosicionesNodosGrafo(grafo, vars = {}, theta = 0) {
  if (!grafo || !Array.isArray(grafo.nodos)) return false;

  const varsEfectivas = { ...vars };
  grafo.barras?.forEach(b => {
    const varNom = b.variableAsociada || b.longitudVinculada;
    if (varNom && varsEfectivas[varNom] !== undefined) {
      b.longitud = Number(varsEfectivas[varNom]);
    } else if (varNom && varsEfectivas[varNom] === undefined) {
      varsEfectivas[varNom] = b.longitud;
    }
  });
  grafo.nodos?.forEach(n => {
    if (n.variableX && varsEfectivas[n.variableX] !== undefined) {
      const valX = Number(varsEfectivas[n.variableX]);
      const ox = n.offsetX || 0;
      const ex = n.escalaX || 1;
      n.x = parseFloat((n.signoX !== undefined ? ox + n.signoX * Math.abs(valX) * ex : ox + valX * ex).toFixed(2));
    }
    if (n.variableY && varsEfectivas[n.variableY] !== undefined) {
      const valY = Number(varsEfectivas[n.variableY]);
      const oy = n.offsetY || 0;
      const ey = n.escalaY || 1;
      n.y = parseFloat((n.signoY !== undefined ? oy + n.signoY * Math.abs(valY) * ey : oy + valY * ey).toFixed(2));
    }
  });
  grafo.motores?.forEach(m => {
    const varNom = m.variableAsociada || m.amplitudVinculada;
    if (varNom && varsEfectivas[varNom] !== undefined) {
      m.longitudManivela = Number(varsEfectivas[varNom]);
    }
  });

  const paso = resolverPasoMecanismo(grafo, theta, varsEfectivas);
  if (paso && paso.nodos) {
    grafo.nodos.forEach(n => {
      const nr = paso.nodos[n.id];
      if (nr && nr.resuelto) {
        n.x = parseFloat(nr.x.toFixed(2));
        n.y = parseFloat(nr.y.toFixed(2));
      }
    });
    // Actualiza longitudes geométricas de barras cuyos nodos cambiaron por coordenadas parametrizadas
    grafo.barras?.forEach(b => {
      if (!b.variableAsociada && !b.longitudVinculada) {
        const nA = grafo.nodos.find(nx => nx.id === b.nodoA);
        const nB = grafo.nodos.find(nx => nx.id === b.nodoB);
        if (nA && nB) {
          b.longitud = parseFloat(Math.hypot(nA.x - nB.x, nA.y - nB.y).toFixed(2));
        }
      }
    });
    return paso.esValido;
  }
  return false;
}

// Simula el ciclo cinemático temporal completo y calcula la telemetría de todos los sensores
export function simularCicloMecanismo(grafo, vars = {}, opciones = {}) {
  const N = opciones.pasos || 180;
  const pasos = [];
  let pasosInvalidos = 0;

  // Fusiona variables explícitas con las dimensiones geométricas actuales del grafo
  const varsEfectivas = { ...vars };
  if (grafo) {
    grafo.barras?.forEach(b => {
      const varNom = b.variableAsociada || b.longitudVinculada;
      if (varNom && varsEfectivas[varNom] === undefined) {
        varsEfectivas[varNom] = b.longitud;
      }
    });
    grafo.nodos?.forEach(n => {
      if (n.variableX && varsEfectivas[n.variableX] === undefined) {
        varsEfectivas[n.variableX] = Math.abs(n.x);
      }
      if (n.variableY && varsEfectivas[n.variableY] === undefined) {
        varsEfectivas[n.variableY] = Math.abs(n.y);
      }
    });
    grafo.motores?.forEach(m => {
      const varNom = m.variableAsociada || m.amplitudVinculada;
      if (varNom && varsEfectivas[varNom] === undefined) {
        varsEfectivas[varNom] = m.longitudManivela;
      }
    });
  }

  // Solver genérico por propagación de lazo multicuerpo
  for (let s = 0; s < N; s++) {
    const theta = (2 * Math.PI * s) / N;
    const res = resolverPasoMecanismo(grafo, theta, varsEfectivas);
    if (!res.esValido) pasosInvalidos++;
    pasos.push({ idx: s, ...res });
  }

  const esValido = pasosInvalidos === 0 && pasos.length === N;

  // Extracción de telemetría multimagnitud para cada sensor definido en el grafo
  const telemetriaSensores = {};
  (grafo.sensores || []).forEach(sensor => {
    const traj = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let s = 0; s < pasos.length; s++) {
      const pNodo = pasos[s].nodos[sensor.nodoId];
      if (pNodo && pNodo.resuelto) {
        traj.push({ x: pNodo.x, y: pNodo.y, theta: pasos[s].theta });
        if (pNodo.x < minX) minX = pNodo.x;
        if (pNodo.x > maxX) maxX = pNodo.x;
        if (pNodo.y < minY) minY = pNodo.y;
        if (pNodo.y > maxY) maxY = pNodo.y;
      }
    }

    // Cálculo de velocidad y aceleración normalizada
    const dTheta = (2 * Math.PI) / (traj.length || 1);
    const dTheta2 = dTheta * dTheta;
    let maxA = 0;
    let maxV = 0;

    for (let t = 0; t < traj.length; t++) {
      const sig = traj[(t + 1) % traj.length];
      const act = traj[t];
      const ant = traj[(t - 1 + traj.length) % traj.length];

      const vx = (sig.x - ant.x) / (2 * dTheta);
      const vy = (sig.y - ant.y) / (2 * dTheta);
      const vMag = Math.hypot(vx, vy);
      if (vMag > maxV) maxV = vMag;

      const ax = (sig.x - 2 * act.x + ant.x) / dTheta2;
      const ay = (sig.y - 2 * act.y + ant.y) / dTheta2;
      const aMag = Math.hypot(ax, ay);
      if (aMag > maxA) maxA = aMag;
    }

    // Acoplamiento multifísica: campo magnético, campo eléctrico y temperatura en el sensor
    let campoTotalEM = 0;
    let campoElectricoMedio = 0;
    let temperaturaMedia = 25.0;

    const nodosConIman = grafo.nodos.filter(nd => nd.imanDipolo && nd.id !== sensor.nodoId);
    const nodosConCarga = grafo.nodos.filter(nd => nd.cargaElectrica && nd.id !== sensor.nodoId);
    const nodosConTemp = grafo.nodos.filter(nd => nd.temperaturaFuente && nd.id !== sensor.nodoId);

    if (
      (grafo.capasFisicas && Array.isArray(grafo.capasFisicas.imanes) && grafo.capasFisicas.imanes.length > 0) ||
      nodosConIman.length > 0 || nodosConCarga.length > 0 || nodosConTemp.length > 0
    ) {
      const bobinasFijas = (grafo.capasFisicas?.imanes || []).map(im => ({
        x: im.x || 0,
        y: im.y || 0,
        radio: im.radio || 10,
        espiras: im.espiras || 100,
        corriente: im.corriente || 5
      }));

      let sumaBz = 0;
      let sumaE = 0;
      let sumaT = 0;

      for (let t = 0; t < traj.length; t++) {
        const pt = traj[t];
        let bzPaso = bobinasFijas.length > 0
          ? Math.abs(MotorCamposUnificados.calcularCampoMagneticoBz(pt, bobinasFijas))
          : 0;
        nodosConIman.forEach(ni => {
          const r2 = Math.max(4.0, (pt.x - ni.x) ** 2 + (pt.y - ni.y) ** 2);
          bzPaso += Math.abs(ni.imanDipolo) / Math.pow(r2, 1.5) * 100;
        });
        sumaBz += bzPaso;

        let ePaso = 0;
        nodosConCarga.forEach(nc => {
          const r2 = Math.max(4.0, (pt.x - nc.x) ** 2 + (pt.y - nc.y) ** 2);
          ePaso += Math.abs(nc.cargaElectrica) * 89.9 / r2;
        });
        sumaE += ePaso;

        let tPaso = 25.0;
        nodosConTemp.forEach(nt => {
          const d = Math.hypot(pt.x - nt.x, pt.y - nt.y);
          tPaso += (nt.temperaturaFuente - 25.0) * Math.exp(-d / 45.0);
        });
        sumaT += tPaso;
      }

      const denom = Math.max(1, traj.length);
      campoTotalEM = sumaBz / denom;
      campoElectricoMedio = sumaE / denom;
      temperaturaMedia = sumaT / denom;
    }

    const ancho = isFinite(maxX - minX) ? (maxX - minX) : 0;
    const alto = isFinite(maxY - minY) ? (maxY - minY) : 0;

    telemetriaSensores[sensor.nombre] = {
      id: sensor.id,
      nombre: sensor.nombre,
      nodoId: sensor.nodoId,
      posicion: traj[0] || { x: 0, y: 0 },
      trayectoria: traj,
      anchoTotal: ancho,
      alturaTotal: alto,
      zancada: ancho,
      despeje: alto,
      minX, maxX, minY, maxY,
      velocidadMax: maxV,
      aceleracionPico: maxA,
      campoEM: campoTotalEM,
      campoMagnetico: campoTotalEM,
      campoElectrico: campoElectricoMedio,
      temperatura: temperaturaMedia,
      f5_suavidad: Math.min(1.0, maxA / 30.0)
    };
  });

  return {
    esValido,
    pasosInvalidos,
    dof: analizarGradosLibertad(grafo).dof,
    sensores: telemetriaSensores,
    pasos
  };
}

// Genera el grafo canónico del Mecanismo Caminante de 4 Barras (Manivela-Balancín)
export function crearGrafoPataCaminante(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const l1 = vars.l1_manivela !== undefined ? Number(vars.l1_manivela) : 18.0;
  const l2 = vars.l2_biela !== undefined ? Number(vars.l2_biela) : 48.0;
  const l3 = vars.l3_balancin !== undefined ? Number(vars.l3_balancin) : 42.0;
  const l4 = vars.l4_chasis !== undefined ? Number(vars.l4_chasis) : 45.0;

  grafo.agregarNodo({ id: "O_manivela", nombre: "O: Pivote Motriz (0,0)", x: 0.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "B_chasis", nombre: "B: Pivote Balancín Chasis", x: l4, y: 0.0, tipo: "fijo", variableX: "l4_chasis", signoX: 1 });
  grafo.agregarNodo({ id: "A_pin", nombre: "A: Extremo Manivela", x: l1, y: 0.0, tipo: "libre" });

  const ptC = MotorEstructurasCinematica.resolverTrilateracion({ x: l1, y: 0 }, { x: l4, y: 0 }, l2, l3, 1) || { x: l4 - 10, y: -35 };
  grafo.agregarNodo({ id: "C_articulacion", nombre: "C: Unión Biela-Balancín", x: parseFloat(ptC.x.toFixed(2)), y: parseFloat(ptC.y.toFixed(2)), tipo: "libre", signoTrilateracion: 1 });

  grafo.agregarMotor({
    id: "motor_caminante",
    nombre: "Motor Manivela l1",
    tipo: "rotativo",
    nodoPivote: "O_manivela",
    nodoExtremo: "A_pin",
    longitudManivela: l1,
    variableAsociada: "l1_manivela",
    velocidadAngular: 1.0
  });

  grafo.agregarBarra({ id: "barra_biela", nombre: "Biela Acopladora l2", nodoA: "A_pin", nodoB: "C_articulacion", longitud: l2, variableAsociada: "l2_biela", color: "#3b82f6" });
  grafo.agregarBarra({ id: "barra_balancin", nombre: "Balancín Seguidor l3", nodoA: "B_chasis", nodoB: "C_articulacion", longitud: l3, variableAsociada: "l3_balancin", color: "#10b981" });

  grafo.agregarSensor({
    id: "sensor_articulacion_c",
    nombre: "pie",
    nodoId: "C_articulacion",
    magnitudes: ["trayectoria", "posicion", "velocidad", "aceleracion"],
    color: "#f59e0b"
  });

  return grafo;
}

// Genera un grafo de ejemplo con Tren de Engranajes, Polea y Corredera Lineal
export function crearGrafoTrenEngranajes() {
  const grafo = new GrafoMecanismoMultifisica();
  grafo.agregarNodo({ id: "eje_motriz", nombre: "Eje Piñón Motriz", x: -35.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "eje_corona", nombre: "Eje Corona Conducida", x: 10.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "pin_manivela", nombre: "Pin Excéntrico Piñón", x: -20.0, y: 0.0, tipo: "libre" });
  grafo.agregarNodo({ id: "corredera_piston", nombre: "Corredera / Pistón Lineal", x: 35.0, y: 0.0, tipo: "deslizante", anguloGuia: 0 });

  grafo.agregarMotor({
    id: "motor_pinon",
    nombre: "Motor Piñón",
    tipo: "rotativo",
    nodoPivote: "eje_motriz",
    nodoExtremo: "pin_manivela",
    longitudManivela: 15.0,
    variableAsociada: "radio_manivela",
    velocidadAngular: 1.0
  });

  grafo.agregarBarra({
    id: "biela_piston",
    nombre: "Biela Motriz a Corredera",
    nodoA: "pin_manivela",
    nodoB: "corredera_piston",
    longitud: 55.0,
    variableAsociada: "long_biela",
    color: "#0ea5e9"
  });

  grafo.agregarTransmision({
    id: "par_engranajes",
    tipo: "engranaje",
    nodo1: "eje_motriz",
    nodo2: "eje_corona",
    radio1: 18.0,
    radio2: 27.0,
    relacion: 18.0 / 27.0
  });

  grafo.agregarSensor({
    id: "sensor_piston",
    nombre: "piston",
    nodoId: "corredera_piston",
    magnitudes: ["posicion", "velocidad", "aceleracion", "trayectoria"],
    color: "#f59e0b"
  });

  return grafo;
}

// Genera el grafo canónico del Brazo Robótico de 3 eslabones
export function crearGrafoBrazoRobotico(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const t1 = vars.theta1 !== undefined ? Number(vars.theta1) : 30.0;
  const t2 = vars.theta2 !== undefined ? Number(vars.theta2) : 45.0;
  const t3 = vars.theta3 !== undefined ? Number(vars.theta3) : -20.0;

  grafo.agregarNodo({ id: "base_fija", nombre: "Base Fija Robótica (0,0)", x: 0.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "codo_1", nombre: "Articulación 1 (Hombro)", x: 45.0, y: 0.0, tipo: "libre" });
  grafo.agregarNodo({ id: "codo_2", nombre: "Articulación 2 (Codo)", x: 80.0, y: 0.0, tipo: "libre" });
  grafo.agregarNodo({ id: "efector_final", nombre: "Efector Final (Pinza / Herramienta)", x: 105.0, y: 0.0, tipo: "libre" });

  grafo.agregarMotor({ id: "motor_hombro", nombre: "Motor Hombro θ₁", tipo: "rotativo", nodoPivote: "base_fija", nodoExtremo: "codo_1", longitudManivela: 45.0, anguloInicial: (t1 * Math.PI) / 180, variableAsociada: "theta1" });
  grafo.agregarMotor({ id: "motor_codo", nombre: "Motor Codo θ₂", tipo: "rotativo", nodoPivote: "codo_1", nodoExtremo: "codo_2", longitudManivela: 35.0, anguloInicial: (t2 * Math.PI) / 180, variableAsociada: "theta2" });
  grafo.agregarMotor({ id: "motor_muneca", nombre: "Motor Muñeca θ₃", tipo: "rotativo", nodoPivote: "codo_2", nodoExtremo: "efector_final", longitudManivela: 25.0, anguloInicial: (t3 * Math.PI) / 180, variableAsociada: "theta3" });

  grafo.agregarBarra({ id: "barra_l1", nombre: "Eslabón 1 (L=45 mm)", nodoA: "base_fija", nodoB: "codo_1", longitud: 45.0, color: "#3b82f6" });
  grafo.agregarBarra({ id: "barra_l2", nombre: "Eslabón 2 (L=35 mm)", nodoA: "codo_1", nodoB: "codo_2", longitud: 35.0, color: "#0284c7" });
  grafo.agregarBarra({ id: "barra_l3", nombre: "Eslabón 3 (L=25 mm)", nodoA: "codo_2", nodoB: "efector_final", longitud: 25.0, color: "#065f46" });

  grafo.agregarSensor({
    id: "sensor_efector",
    nombre: "efector",
    nodoId: "efector_final",
    magnitudes: ["posicion", "velocidad", "aceleracion", "trayectoria"],
    color: "#10b981"
  });

  return grafo;
}

// Genera el grafo estructural canónico de la Armadura de Puente (7 nudos y 11 barras)
export function crearGrafoArmaduraPuente(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const h1 = vars.h1 !== undefined ? Number(vars.h1) : 13.0;
  const xCentroRel = vars.xCentroRel !== undefined ? Number(vars.xCentroRel) : 0.0;
  const hCentro = vars.hCentro !== undefined ? Number(vars.hCentro) : 16.0;
  const h2 = vars.h2 !== undefined ? Number(vars.h2) : 13.0;

  // 4 nudos inferiores de calzada (fijos) y 3 nudos superiores (parametrizados por variables)
  grafo.agregarNodo({ id: "N0", nombre: "N0: Apoyo Izquierdo (0,0)", x: 0.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "N1", nombre: "N1: Calzada 1 (20m)", x: 20.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "N2", nombre: "N2: Calzada 2 (40m)", x: 40.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "N3", nombre: "N3: Apoyo Derecho (60m)", x: 60.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "N4", nombre: "N4: Cordón Sup Izq (h1)", x: 20.0, y: h1, tipo: "libre", variableY: "h1", signoY: 1 });
  grafo.agregarNodo({ id: "N5", nombre: "N5: Corona Central (hCentro)", x: 30.0 + xCentroRel, y: hCentro, tipo: "libre", variableX: "xCentroRel", offsetX: 30.0, variableY: "hCentro", signoY: 1 });
  grafo.agregarNodo({ id: "N6", nombre: "N6: Cordón Sup Der (h2)", x: 40.0, y: h2, tipo: "libre", variableY: "h2", signoY: 1 });

  const pares = [
    ["N0", "N1", "Cordón Inf 1", "#ef4444"],
    ["N1", "N2", "Cordón Inf 2", "#ef4444"],
    ["N2", "N3", "Cordón Inf 3", "#ef4444"],
    ["N4", "N5", "Cordón Sup Izq", "#2563eb"],
    ["N5", "N6", "Cordón Sup Der", "#2563eb"],
    ["N0", "N4", "Diagonal Ext Izq", "#2563eb"],
    ["N1", "N4", "Montante Izq", "#10b981"],
    ["N1", "N5", "Diagonal Central Izq", "#3b82f6"],
    ["N2", "N5", "Diagonal Central Der", "#3b82f6"],
    ["N2", "N6", "Montante Der", "#10b981"],
    ["N3", "N6", "Diagonal Ext Der", "#2563eb"]
  ];

  pares.forEach(([idA, idB, nombre, color], idx) => {
    const nA = grafo.nodos.find(n => n.id === idA);
    const nB = grafo.nodos.find(n => n.id === idB);
    const dist = parseFloat(Math.hypot(nA.x - nB.x, nA.y - nB.y).toFixed(2));
    grafo.agregarBarra({ id: `B_${idx + 1}`, nombre, nodoA: idA, nodoB: idB, longitud: dist, color, grosor: 3.2 });
  });

  grafo.agregarCuerpoRigido({ id: "vano_central", nombre: "Celosía Central", nodos: ["N1", "N2", "N5"], color: "rgba(59, 130, 246, 0.12)" });
  grafo.agregarSensor({ id: "sensor_puente", nombre: "corona", nodoId: "N5", magnitudes: ["posicion", "trayectoria"], color: "#f59e0b" });
  return grafo;
}

// Genera el grafo interactivo de Aterrizaje de Cohete (4 fases de empuje vectorial + plataforma ASDS)
export function crearGrafoCoheteLanding(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const F1 = vars.F1 !== undefined ? Number(vars.F1) : 10000;
  const F2 = vars.F2 !== undefined ? Number(vars.F2) : 10000;
  const F3 = vars.F3 !== undefined ? Number(vars.F3) : 10000;
  const F4 = vars.F4 !== undefined ? Number(vars.F4) : 10000;
  const A1 = vars.A1 !== undefined ? Number(vars.A1) : 0;
  const A2 = vars.A2 !== undefined ? Number(vars.A2) : 0;
  const A3 = vars.A3 !== undefined ? Number(vars.A3) : 0;
  const A4 = vars.A4 !== undefined ? Number(vars.A4) : 0;

  grafo.agregarNodo({ id: "asds_centro", nombre: "Barcaza ASDS (0,0)", x: 0.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "asds_izq", nombre: "Babor Plataforma", x: -16.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "asds_der", nombre: "Estribor Plataforma", x: 16.0, y: 0.0, tipo: "fijo" });

  grafo.agregarNodo({ id: "fase4", nombre: "Fase 4: Touchdown (A4, F4)", x: 2.0 + A4, y: Math.max(4, F4 * 0.0018), tipo: "libre", variableX: "A4", offsetX: 2.0, variableY: "F4", signoY: 1, escalaY: 0.0018, temperaturaFuente: 75 });
  grafo.agregarNodo({ id: "fase3", nombre: "Fase 3: Frenado (A3, F3)", x: 6.0 + A3, y: Math.max(12, F3 * 0.0032), tipo: "libre", variableX: "A3", offsetX: 6.0, variableY: "F3", signoY: 1, escalaY: 0.0032, temperaturaFuente: 82 });
  grafo.agregarNodo({ id: "fase2", nombre: "Fase 2: Descenso (A2, F2)", x: 10.0 + A2, y: Math.max(22, F2 * 0.0046), tipo: "libre", variableX: "A2", offsetX: 10.0, variableY: "F2", signoY: 1, escalaY: 0.0046, temperaturaFuente: 88 });
  grafo.agregarNodo({ id: "fase1", nombre: "Fase 1: Entrada (A1, F1)", x: 15.0 + A1, y: Math.max(32, F1 * 0.006), tipo: "libre", variableX: "A1", offsetX: 15.0, variableY: "F1", signoY: 1, escalaY: 0.006, temperaturaFuente: 95 });

  grafo.agregarBarra({ id: "cubierta_asds", nombre: "Cubierta Barcaza Marina", nodoA: "asds_izq", nodoB: "asds_der", longitud: 32.0, color: "#64748b", grosor: 4.0 });
  grafo.agregarBarra({ id: "tramo_1_2", nombre: "Trayectoria Fase 1→2", nodoA: "fase1", nodoB: "fase2", longitud: 20.0, color: "#f97316", grosor: 3.0 });
  grafo.agregarBarra({ id: "tramo_2_3", nombre: "Trayectoria Fase 2→3", nodoA: "fase2", nodoB: "fase3", longitud: 18.0, color: "#f59e0b", grosor: 3.0 });
  grafo.agregarBarra({ id: "tramo_3_4", nombre: "Trayectoria Fase 3→4", nodoA: "fase3", nodoB: "fase4", longitud: 16.0, color: "#eab308", grosor: 3.0 });
  grafo.agregarBarra({ id: "tramo_touchdown", nombre: "Aproximación Final ASDS", nodoA: "fase4", nodoB: "asds_centro", longitud: 18.0, color: "#10b981", grosor: 3.2 });

  grafo.agregarSensor({ id: "sensor_cohete", nombre: "tobera", nodoId: "fase4", magnitudes: ["posicion", "velocidad", "aceleracion", "temperatura"], color: "#f59e0b" });
  return grafo;
}

// Genera el grafo interactivo de la Trampa Electromagnética de Lorentz (4 bobinas + 2 placas deflectoras + haz)
export function crearGrafoConfinamientoEM(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const i1 = vars.i1 !== undefined ? Number(vars.i1) : 4.0;
  const i2 = vars.i2 !== undefined ? Number(vars.i2) : -4.0;
  const i3 = vars.i3 !== undefined ? Number(vars.i3) : -4.0;
  const i4 = vars.i4 !== undefined ? Number(vars.i4) : 4.0;
  const vSup = vars.vSup !== undefined ? Number(vars.vSup) : 80.0;
  const vInf = vars.vInf !== undefined ? Number(vars.vInf) : -80.0;

  grafo.agregarNodo({ id: "inyector", nombre: "Inyector Haz q+ (-40,0)", x: -40.0, y: 0.0, tipo: "fijo", carga: 1.0 });
  grafo.agregarNodo({ id: "bobina1", nombre: "Bobina 1 Sup-Izq (i1)", x: -18.0, y: 16.0 + i1 * 0.5, tipo: "libre", variableY: "i1", offsetY: 16.0, escalaY: 0.5, imanDipolo: i1 || 4.0 });
  grafo.agregarNodo({ id: "bobina2", nombre: "Bobina 2 Sup-Der (i2)", x: 18.0, y: 16.0 + i2 * 0.5, tipo: "libre", variableY: "i2", offsetY: 16.0, escalaY: 0.5, imanDipolo: i2 || -4.0 });
  grafo.agregarNodo({ id: "bobina3", nombre: "Bobina 3 Inf-Izq (i3)", x: -18.0, y: -16.0 + i3 * 0.5, tipo: "libre", variableY: "i3", offsetY: -16.0, escalaY: 0.5, imanDipolo: i3 || -4.0 });
  grafo.agregarNodo({ id: "bobina4", nombre: "Bobina 4 Inf-Der (i4)", x: 18.0, y: -16.0 + i4 * 0.5, tipo: "libre", variableY: "i4", offsetY: -16.0, escalaY: 0.5, imanDipolo: i4 || 4.0 });
  grafo.agregarNodo({ id: "placa_sup", nombre: "Placa Deflectora Sup (vSup)", x: 0.0, y: 24.0 + vSup * 0.02, tipo: "libre", variableY: "vSup", offsetY: 24.0, escalaY: 0.02, carga: vSup });
  grafo.agregarNodo({ id: "placa_inf", nombre: "Placa Deflectora Inf (vInf)", x: 0.0, y: -24.0 + vInf * 0.02, tipo: "libre", variableY: "vInf", offsetY: -24.0, escalaY: 0.02, carga: vInf });
  grafo.agregarNodo({ id: "foco_lorentz", nombre: "Punto Focal Lorentz", x: 0.0, y: 3.0, tipo: "libre" });
  grafo.agregarNodo({ id: "detector", nombre: "Detector Salida (38,6)", x: 38.0, y: 6.0, tipo: "fijo" });

  grafo.agregarBarra({ id: "haz_entrada", nombre: "Haz Entrada F=q(E+v×B)", nodoA: "inyector", nodoB: "foco_lorentz", longitud: 40.1, color: "#10b981", grosor: 3.0 });
  grafo.agregarBarra({ id: "haz_salida", nombre: "Haz Colimado a Detector", nodoA: "foco_lorentz", nodoB: "detector", longitud: 38.1, color: "#34d399", grosor: 3.0 });
  grafo.agregarBarra({ id: "yugo_sup", nombre: "Yugo Magnético Superior", nodoA: "bobina1", nodoB: "bobina2", longitud: 36.0, color: "#a855f7", grosor: 2.2 });
  grafo.agregarBarra({ id: "yugo_inf", nombre: "Yugo Magnético Inferior", nodoA: "bobina3", nodoB: "bobina4", longitud: 36.0, color: "#a855f7", grosor: 2.2 });
  grafo.agregarBarra({ id: "columna_izq", nombre: "Columna Magnética Izq", nodoA: "bobina1", nodoB: "bobina3", longitud: 32.0, color: "#6366f1", grosor: 2.0 });
  grafo.agregarBarra({ id: "columna_der", nombre: "Columna Magnética Der", nodoA: "bobina2", nodoB: "bobina4", longitud: 32.0, color: "#6366f1", grosor: 2.0 });

  grafo.agregarSensor({ id: "sensor_lorentz", nombre: "haz", nodoId: "foco_lorentz", magnitudes: ["posicion", "campo_b", "campo_e", "trayectoria"], color: "#10b981" });
  return grafo;
}

// Genera el grafo interactivo de Campo de Potencial y Deflexión 2D (2 electrodos móviles + barrera central)
export function crearGrafoCampoPotencial(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const x1 = vars.x1 !== undefined ? Number(vars.x1) : -12.0;
  const y1 = vars.y1 !== undefined ? Number(vars.y1) : 14.0;
  const x2 = vars.x2 !== undefined ? Number(vars.x2) : 14.0;
  const y2 = vars.y2 !== undefined ? Number(vars.y2) : -14.0;

  grafo.agregarNodo({ id: "emisor", nombre: "Emisor (-45,0)", x: -45.0, y: 0.0, tipo: "fijo", carga: 0.5 });
  grafo.agregarNodo({ id: "barrera", nombre: "Barrera Central (0,0)", x: 0.0, y: 0.0, tipo: "fijo", carga: 1.8 });
  grafo.agregarNodo({ id: "colector", nombre: "Colector (45,0)", x: 45.0, y: 0.0, tipo: "fijo", carga: -1.2 });
  grafo.agregarNodo({ id: "electrodo1", nombre: "Electrodo 1 (x1, y1)", x: x1, y: y1, tipo: "libre", variableX: "x1", variableY: "y1", carga: 2.0 });
  grafo.agregarNodo({ id: "electrodo2", nombre: "Electrodo 2 (x2, y2)", x: x2, y: y2, tipo: "libre", variableX: "x2", variableY: "y2", carga: -2.0 });

  grafo.agregarBarra({ id: "tray_1", nombre: "Deflexión Entrada", nodoA: "emisor", nodoB: "electrodo1", longitud: 35.0, color: "#38bdf8" });
  grafo.agregarBarra({ id: "tray_2", nombre: "Acoplamiento Dipolar", nodoA: "electrodo1", nodoB: "electrodo2", longitud: 38.0, color: "#f59e0b" });
  grafo.agregarBarra({ id: "tray_3", nombre: "Enfoque a Colector", nodoA: "electrodo2", nodoB: "colector", longitud: 34.0, color: "#10b981" });

  grafo.agregarSensor({ id: "sensor_potencial", nombre: "particula", nodoId: "electrodo1", magnitudes: ["posicion", "campo_e", "trayectoria"], color: "#38bdf8" });
  return grafo;
}

// Genera el grafo interactivo de Transferencia Orbital de Hohmann
export function crearGrafoOrbitaTransferencia(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const dv1T = vars.dv1T !== undefined ? Number(vars.dv1T) : 5.5;
  const dv1R = vars.dv1R !== undefined ? Number(vars.dv1R) : 0.0;
  const tEspera = vars.tEspera !== undefined ? Number(vars.tEspera) : 7.0;
  const dv2T = vars.dv2T !== undefined ? Number(vars.dv2T) : 4.2;

  grafo.agregarNodo({ id: "planeta", nombre: "Planeta Central (0,0)", x: 0.0, y: 0.0, tipo: "fijo", masa: 100.0 });
  grafo.agregarNodo({ id: "periastro", nombre: "Periastro Impulso Δv₁", x: 25.0 + dv1T * 2.0, y: dv1R * 3.0, tipo: "libre", variableX: "dv1T", offsetX: 25.0, escalaX: 2.0, variableY: "dv1R", escalaY: 3.0 });
  grafo.agregarNodo({ id: "arco_transferencia", nombre: "Arco Hohmann (tEspera)", x: 0.0, y: 30.0 + tEspera * 3.5, tipo: "libre", variableY: "tEspera", offsetY: 30.0, signoY: 1, escalaY: 3.5 });
  grafo.agregarNodo({ id: "apoastro", nombre: "Apoastro Inserción Δv₂", x: -55.0 - dv2T * 2.5, y: 0.0, tipo: "libre", variableX: "dv2T", offsetX: -55.0, signoX: -1, escalaX: 2.5 });

  grafo.agregarBarra({ id: "radio_leo", nombre: "Radio Inicial LEO", nodoA: "planeta", nodoB: "periastro", longitud: 35.0, color: "#38bdf8" });
  grafo.agregarBarra({ id: "semieje_1", nombre: "Tramo Ascenso Elíptico", nodoA: "periastro", nodoB: "arco_transferencia", longitud: 65.0, color: "#f59e0b" });
  grafo.agregarBarra({ id: "semieje_2", nombre: "Tramo Inserción GEO", nodoA: "arco_transferencia", nodoB: "apoastro", longitud: 85.0, color: "#10b981" });
  grafo.agregarBarra({ id: "radio_geo", nombre: "Radio Objetivo GEO", nodoA: "planeta", nodoB: "apoastro", longitud: 75.0, color: "#6366f1" });

  grafo.agregarSensor({ id: "sensor_orbita", nombre: "satelite", nodoId: "apoastro", magnitudes: ["posicion", "velocidad", "trayectoria"], color: "#10b981" });
  return grafo;
}

// Genera el grafo interactivo de Disipación Térmica en Placa PCB 2D (4 chips móviles)
export function crearGrafoDistribucionTermica(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const xCPU = vars.xCPU !== undefined ? Number(vars.xCPU) : -18.0;
  const yCPU = vars.yCPU !== undefined ? Number(vars.yCPU) : 12.0;
  const xGPU = vars.xGPU !== undefined ? Number(vars.xGPU) : 18.0;
  const yGPU = vars.yGPU !== undefined ? Number(vars.yGPU) : 12.0;
  const xVRM = vars.xVRM !== undefined ? Number(vars.xVRM) : -18.0;
  const yVRM = vars.yVRM !== undefined ? Number(vars.yVRM) : -12.0;
  const xMEM = vars.xMEM !== undefined ? Number(vars.xMEM) : 18.0;
  const yMEM = vars.yMEM !== undefined ? Number(vars.yMEM) : -12.0;

  // Esquinas del PCB (100x80 mm)
  grafo.agregarNodo({ id: "pcb_1", nombre: "PCB Sup-Izq", x: -50.0, y: 40.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "pcb_2", nombre: "PCB Sup-Der", x: 50.0, y: 40.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "pcb_3", nombre: "PCB Inf-Der", x: 50.0, y: -40.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "pcb_4", nombre: "PCB Inf-Izq", x: -50.0, y: -40.0, tipo: "fijo" });

  // 4 Chips generadores de calor arrastrables en el CAD
  grafo.agregarNodo({ id: "chip_cpu", nombre: "CPU 25W (xCPU,yCPU)", x: xCPU, y: yCPU, tipo: "libre", variableX: "xCPU", variableY: "yCPU", temperaturaFuente: 95.0 });
  grafo.agregarNodo({ id: "chip_gpu", nombre: "GPU 18W (xGPU,yGPU)", x: xGPU, y: yGPU, tipo: "libre", variableX: "xGPU", variableY: "yGPU", temperaturaFuente: 85.0 });
  grafo.agregarNodo({ id: "chip_vrm", nombre: "VRM 12W (xVRM,yVRM)", x: xVRM, y: yVRM, tipo: "libre", variableX: "xVRM", variableY: "yVRM", temperaturaFuente: 72.0 });
  grafo.agregarNodo({ id: "chip_mem", nombre: "MEM 10W (xMEM,yMEM)", x: xMEM, y: yMEM, tipo: "libre", variableX: "xMEM", variableY: "yMEM", temperaturaFuente: 65.0 });

  grafo.agregarBarra({ id: "borde_sup", nombre: "Disipador Norte", nodoA: "pcb_1", nodoB: "pcb_2", longitud: 100.0, color: "#475569" });
  grafo.agregarBarra({ id: "borde_der", nombre: "Disipador Este", nodoA: "pcb_2", nodoB: "pcb_3", longitud: 80.0, color: "#475569" });
  grafo.agregarBarra({ id: "borde_inf", nombre: "Disipador Sur", nodoA: "pcb_3", nodoB: "pcb_4", longitud: 100.0, color: "#475569" });
  grafo.agregarBarra({ id: "borde_izq", nombre: "Disipador Oeste", nodoA: "pcb_4", nodoB: "pcb_1", longitud: 80.0, color: "#475569" });
  grafo.agregarBarra({ id: "heatpipe_1", nombre: "Conducto Térmico CPU-GPU", nodoA: "chip_cpu", nodoB: "chip_gpu", longitud: 36.0, color: "#ef4444" });
  grafo.agregarBarra({ id: "heatpipe_2", nombre: "Conducto Térmico VRM-MEM", nodoA: "chip_vrm", nodoB: "chip_mem", longitud: 36.0, color: "#f97316" });

  grafo.agregarCuerpoRigido({ id: "placa_pcb", nombre: "Sustrato PCB FR4", nodos: ["pcb_1", "pcb_2", "pcb_3", "pcb_4"], color: "rgba(16, 185, 129, 0.08)" });
  grafo.agregarSensor({ id: "sensor_termico", nombre: "hotspot", nodoId: "chip_cpu", magnitudes: ["posicion", "temperatura"], color: "#ef4444" });
  return grafo;
}

// Genera el grafo interactivo de Arreglo Acústico y Beamforming (6 transductores Phased Array)
export function crearGrafoAcusticaBeamforming(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  grafo.agregarNodo({ id: "foco_acustico", nombre: "Foco Haz Ultrasónico (25°)", x: 18.0, y: 42.0, tipo: "fijo" });

  const xs = [-37.5, -22.5, -7.5, 7.5, 22.5, 37.5];
  xs.forEach((xPos, i) => {
    const fase = vars[`fase${i}`] !== undefined ? Number(vars[`fase${i}`]) : 0.0;
    const amp = vars[`amp${i}`] !== undefined ? Number(vars[`amp${i}`]) : 0.6;
    const idNodo = `T${i}`;
    grafo.agregarNodo({
      id: idNodo,
      nombre: `T${i} (fase${i}, amp${i})`,
      x: xPos + fase * 1.5,
      y: amp * 12.0,
      tipo: "libre",
      variableX: `fase${i}`,
      offsetX: xPos,
      escalaX: 1.5,
      variableY: `amp${i}`,
      signoY: 1,
      escalaY: 12.0
    });
    grafo.agregarBarra({
      id: `rayo_${i}`,
      nombre: `Frente Onda T${i}`,
      nodoA: idNodo,
      nodoB: "foco_acustico",
      longitud: 45.0,
      color: "#00e5ff",
      grosor: 2.0
    });
  });

  grafo.agregarSensor({ id: "sensor_acustico", nombre: "hidrofono", nodoId: "foco_acustico", magnitudes: ["posicion", "trayectoria"], color: "#00e676" });
  return grafo;
}

// Genera el grafo interactivo de Superficie Fonoabsorbente (Cuñas Acústicas Anicóicas)
export function crearGrafoSuperficieFonoabsorbente(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const hCuna = vars.alturaCuna !== undefined ? Number(vars.alturaCuna) : 70.0;
  const hBase = vars.alturaBase !== undefined ? Number(vars.alturaBase) : 30.0;
  const wPeriodo = vars.periodoCuna !== undefined ? Number(vars.periodoCuna) : 50.0;
  const camara = vars.camaraAire !== undefined ? Number(vars.camaraAire) : 15.0;

  grafo.agregarNodo({ id: "pared_rigida", nombre: "Pared Rígida (0, -camara)", x: 0.0, y: -camara, tipo: "libre", variableY: "camaraAire", signoY: -1 });
  grafo.agregarNodo({ id: "base_izq", nombre: "Base Porosa Izq", x: -wPeriodo, y: 0.0, tipo: "libre", variableX: "periodoCuna", signoX: -1 });
  grafo.agregarNodo({ id: "base_der", nombre: "Base Porosa Der", x: wPeriodo, y: 0.0, tipo: "libre", variableX: "periodoCuna", signoX: 1 });
  grafo.agregarNodo({ id: "valle_central", nombre: "Valle Base (alturaBase)", x: 0.0, y: hBase, tipo: "libre", variableY: "alturaBase", signoY: 1 });
  grafo.agregarNodo({ id: "punta_1", nombre: "Vértice Cuña 1 (alturaCuna)", x: -wPeriodo * 0.5, y: hBase + hCuna * 0.5, tipo: "libre", variableY: "alturaCuna", offsetY: hBase, signoY: 1, escalaY: 0.5 });
  grafo.agregarNodo({ id: "punta_2", nombre: "Vértice Cuña 2 (alturaCuna)", x: wPeriodo * 0.5, y: hBase + hCuna * 0.5, tipo: "libre", variableY: "alturaCuna", offsetY: hBase, signoY: 1, escalaY: 0.5 });

  grafo.agregarBarra({ id: "b_camara", nombre: "Plenum Aire", nodoA: "pared_rigida", nodoB: "valle_central", longitud: camara + hBase, color: "#64748b" });
  grafo.agregarBarra({ id: "b_base", nombre: " Ancho Período", nodoA: "base_izq", nodoB: "base_der", longitud: wPeriodo * 2, color: "#475569" });
  grafo.agregarBarra({ id: "b_flanco1", nombre: "Flanco Cuña 1", nodoA: "base_izq", nodoB: "punta_1", longitud: 60.0, color: "#8b5cf6", grosor: 3.0 });
  grafo.agregarBarra({ id: "b_flanco2", nombre: "Flanco Interior 1", nodoA: "punta_1", nodoB: "valle_central", longitud: 55.0, color: "#8b5cf6", grosor: 3.0 });
  grafo.agregarBarra({ id: "b_flanco3", nombre: "Flanco Interior 2", nodoA: "valle_central", nodoB: "punta_2", longitud: 55.0, color: "#a855f7", grosor: 3.0 });
  grafo.agregarBarra({ id: "b_flanco4", nombre: "Flanco Cuña 2", nodoA: "punta_2", nodoB: "base_der", longitud: 60.0, color: "#a855f7", grosor: 3.0 });

  grafo.agregarCuerpoRigido({ id: "cuerpo_cuna_1", nombre: "Cuña Fonoabsorbente", nodos: ["base_izq", "punta_1", "valle_central", "punta_2", "base_der"], color: "rgba(139, 92, 246, 0.14)" });
  grafo.agregarSensor({ id: "sensor_cuna", nombre: "microfono", nodoId: "punta_1", magnitudes: ["posicion"], color: "#f59e0b" });
  return grafo;
}

// Genera el grafo interactivo de Línea de Transmisión RF y Stub Paralelo
export function crearGrafoLineaRF(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const lLinea = vars.longitudLinea !== undefined ? Number(vars.longitudLinea) : 0.05;
  const z0Sec = vars.z0Seccion !== undefined ? Number(vars.z0Seccion) : 70.0;
  const lStub = vars.longitudStub !== undefined ? Number(vars.longitudStub) : 0.025;
  const z0St = vars.z0Stub !== undefined ? Number(vars.z0Stub) : 50.0;

  grafo.agregarNodo({ id: "gen_rf", nombre: "Generador RF 50Ω", x: -45.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "nodo_stub", nombre: "Unión Stub (z0Stub)", x: -15.0, y: (z0St - 50.0) * 0.3, tipo: "libre", variableY: "z0Stub", offsetY: -15.0, escalaY: 0.3 });
  grafo.agregarNodo({ id: "punta_stub", nombre: "Extremo Stub (longitudStub)", x: -15.0, y: -lStub * 600.0, tipo: "libre", variableY: "longitudStub", signoY: -1, escalaY: 600.0 });
  grafo.agregarNodo({ id: "carga_rf", nombre: "Antena Carga (longitudLinea, z0Seccion)", x: -15.0 + lLinea * 500.0, y: (z0Sec - 50.0) * 0.3, tipo: "libre", variableX: "longitudLinea", offsetX: -15.0, signoX: 1, escalaX: 500.0, variableY: "z0Seccion", offsetY: -15.0, escalaY: 0.3 });

  grafo.agregarBarra({ id: "linea_alimentacion", nombre: "Línea 50Ω", nodoA: "gen_rf", nodoB: "nodo_stub", longitud: 30.0, color: "#38bdf8", grosor: 3.5 });
  grafo.agregarBarra({ id: "stub_paralelo", nombre: "Stub Reactivo Paralelo", nodoA: "nodo_stub", nodoB: "punta_stub", longitud: lStub * 600.0, color: "#f59e0b", grosor: 3.5 });
  grafo.agregarBarra({ id: "seccion_adaptadora", nombre: "Transformador Impedancia Z0", nodoA: "nodo_stub", nodoB: "carga_rf", longitud: lLinea * 500.0, color: "#10b981", grosor: 4.5 });

  grafo.agregarSensor({ id: "sensor_rf", nombre: "puerto_rf", nodoId: "carga_rf", magnitudes: ["posicion"], color: "#10b981" });
  return grafo;
}

// Genera el grafo interactivo de Corte de Chapa y Anidado 2D (Nesting)
export function crearGrafoCorteChapaNesting(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  grafo.agregarNodo({ id: "chapa_1", nombre: "Chapa (0,0)", x: -50.0, y: -35.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "chapa_2", nombre: "Chapa (500,0)", x: 50.0, y: -35.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "chapa_3", nombre: "Chapa (500,350)", x: 50.0, y: 35.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "chapa_4", nombre: "Chapa (0,350)", x: -50.0, y: 35.0, tipo: "fijo" });

  grafo.agregarBarra({ id: "marco_1", nombre: "Borde Inferior Chapa", nodoA: "chapa_1", nodoB: "chapa_2", longitud: 100.0, color: "#475569" });
  grafo.agregarBarra({ id: "marco_2", nombre: "Borde Derecho Chapa", nodoA: "chapa_2", nodoB: "chapa_3", longitud: 70.0, color: "#475569" });
  grafo.agregarBarra({ id: "marco_3", nombre: "Borde Superior Chapa", nodoA: "chapa_3", nodoB: "chapa_4", longitud: 100.0, color: "#475569" });
  grafo.agregarBarra({ id: "marco_4", nombre: "Borde Izquierdo Chapa", nodoA: "chapa_4", nodoB: "chapa_1", longitud: 70.0, color: "#475569" });

  const baseCoords = [
    [-30, 15], [0, 15], [30, 15],
    [-30, -15], [0, -15], [30, -15]
  ];
  baseCoords.forEach(([bx, by], idx) => {
    const i = idx + 1;
    const prio = vars[`prioridad${i}`] !== undefined ? Number(vars[`prioridad${i}`]) : 5.0;
    const rot = vars[`rotacion${i}`] !== undefined ? Number(vars[`rotacion${i}`]) : 0.5;
    grafo.agregarNodo({
      id: `pieza_${i}`,
      nombre: `Pieza ${i} (Prio ${i}, Rot ${i})`,
      x: bx + (prio - 5.0) * 1.5,
      y: by + (rot - 0.5) * 12.0,
      tipo: "libre",
      variableX: `prioridad${i}`,
      offsetX: bx - 7.5,
      escalaX: 1.5,
      variableY: `rotacion${i}`,
      offsetY: by - 6.0,
      escalaY: 12.0
    });
  });

  grafo.agregarCuerpoRigido({ id: "plancha_acero", nombre: "Chapa Matriz 500x350", nodos: ["chapa_1", "chapa_2", "chapa_3", "chapa_4"], color: "rgba(56, 189, 248, 0.08)" });
  grafo.agregarSensor({ id: "sensor_nesting", nombre: "cabezal_laser", nodoId: "pieza_1", magnitudes: ["posicion"], color: "#f59e0b" });
  return grafo;
}

// Genera el grafo interactivo para el Sintonizador PID (Lazo de Control Realimentado)
export function crearGrafoControladorPID(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const Kp = vars.Kp !== undefined ? Number(vars.Kp) : 12.0;
  const Ki = vars.Ki !== undefined ? Number(vars.Ki) : 8.0;
  const Kd = vars.Kd !== undefined ? Number(vars.Kd) : 3.0;

  grafo.agregarNodo({ id: "sumador", nombre: "Sumador Error e(t)", x: -40.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "rama_p", nombre: "Rama Proporcional (Kp)", x: 0.0, y: 10.0 + Kp, tipo: "libre", variableY: "Kp", offsetY: 10.0, signoY: 1 });
  grafo.agregarNodo({ id: "rama_i", nombre: "Rama Integral (Ki)", x: 0.0, y: Ki * 0.4, tipo: "libre", variableY: "Ki", signoY: 1, escalaY: 0.4 });
  grafo.agregarNodo({ id: "rama_d", nombre: "Rama Derivativa (Kd)", x: 0.0, y: -10.0 - Kd * 2.0, tipo: "libre", variableY: "Kd", offsetY: -10.0, signoY: -1, escalaY: 2.0 });
  grafo.agregarNodo({ id: "planta", nombre: "Planta 2do Orden y(t)", x: 40.0, y: 0.0, tipo: "fijo" });

  ["rama_p", "rama_i", "rama_d"].forEach((idRama, idx) => {
    const colores = ["#3b82f6", "#10b981", "#f59e0b"];
    grafo.agregarBarra({ id: `in_${idRama}`, nombre: `Entrada ${idRama.toUpperCase()}`, nodoA: "sumador", nodoB: idRama, longitud: 42.0, color: colores[idx] });
    grafo.agregarBarra({ id: `out_${idRama}`, nombre: `Acción ${idRama.toUpperCase()}`, nodoA: idRama, nodoB: "planta", longitud: 42.0, color: colores[idx] });
  });

  grafo.agregarSensor({ id: "sensor_pid", nombre: "salida_y", nodoId: "planta", magnitudes: ["posicion"], color: "#10b981" });
  return grafo;
}

// Genera el grafo interactivo para Síntesis de Filtro Analógico RLC
export function crearGrafoFiltroRLC(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  const logR = vars.logR !== undefined ? Number(vars.logR) : 2.5;
  const logL = vars.logL !== undefined ? Number(vars.logL) : -2.0;
  const logC = vars.logC !== undefined ? Number(vars.logC) : -6.5;

  grafo.agregarNodo({ id: "vin", nombre: "Entrada Vin(f)", x: -45.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "nodo_r", nombre: "Resistor R (logR)", x: -15.0, y: logR * 8.0, tipo: "libre", variableY: "logR", escalaY: 8.0 });
  grafo.agregarNodo({ id: "nodo_l", nombre: "Inductor L (logL)", x: 15.0, y: logL * 6.0, tipo: "libre", variableY: "logL", escalaY: 6.0 });
  grafo.agregarNodo({ id: "nodo_c", nombre: "Capacitor C (logC)", x: 45.0, y: logC * 3.0, tipo: "libre", variableY: "logC", escalaY: 3.0 });

  grafo.agregarBarra({ id: "rama_r", nombre: "Impedancia R", nodoA: "vin", nodoB: "nodo_r", longitud: 32.0, color: "#ef4444", grosor: 3.2 });
  grafo.agregarBarra({ id: "rama_l", nombre: "Reactancia ωL", nodoA: "nodo_r", nodoB: "nodo_l", longitud: 32.0, color: "#3b82f6", grosor: 3.2 });
  grafo.agregarBarra({ id: "rama_c", nombre: "Reactancia 1/ωC", nodoA: "nodo_l", nodoB: "nodo_c", longitud: 32.0, color: "#10b981", grosor: 3.2 });

  grafo.agregarSensor({ id: "sensor_rlc", nombre: "vout_bode", nodoId: "nodo_c", magnitudes: ["posicion"], color: "#38bdf8" });
  return grafo;
}

// Genera el grafo interactivo de Estrella Fasorial para Balanceo de Fases Trifásico (R, S, T)
export function crearGrafoBalanceoFases(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();
  grafo.agregarNodo({ id: "neutro", nombre: "Centro Estrella Neutro (0,0)", x: 0.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "fase_R", nombre: "Fase R (0°)", x: 38.0, y: 0.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "fase_S", nombre: "Fase S (120°)", x: -19.0, y: 33.0, tipo: "fijo" });
  grafo.agregarNodo({ id: "fase_T", nombre: "Fase T (240°)", x: -19.0, y: -33.0, tipo: "fijo" });

  grafo.agregarBarra({ id: "vector_R", nombre: "Vector Fase R", nodoA: "neutro", nodoB: "fase_R", longitud: 38.0, color: "#ef4444", grosor: 3.8 });
  grafo.agregarBarra({ id: "vector_S", nombre: "Vector Fase S", nodoA: "neutro", nodoB: "fase_S", longitud: 38.0, color: "#eab308", grosor: 3.8 });
  grafo.agregarBarra({ id: "vector_T", nombre: "Vector Fase T", nodoA: "neutro", nodoB: "fase_T", longitud: 38.0, color: "#3b82f6", grosor: 3.8 });

  for (let i = 1; i <= 8; i++) {
    const ang = ((i - 1) * Math.PI) / 4;
    const fVal = vars[`fase${i}`] !== undefined ? Number(vars[`fase${i}`]) : (i % 3);
    grafo.agregarNodo({
      id: `circuito_${i}`,
      nombre: `C${i} (fase${i})`,
      x: parseFloat((18.0 * Math.cos(ang)).toFixed(1)),
      y: parseFloat((18.0 * Math.sin(ang) + fVal * 2.0).toFixed(1)),
      tipo: "libre",
      variableY: `fase${i}`,
      offsetY: parseFloat((18.0 * Math.sin(ang)).toFixed(1)),
      escalaY: 2.0
    });
  }

  grafo.agregarSensor({ id: "sensor_neutro", nombre: "corriente_neutro", nodoId: "neutro", magnitudes: ["posicion"], color: "#10b981" });
  return grafo;
}

// Factoría unificada que construye el grafo CAD 2D correspondiente a cualquier identificador de modelo
export function crearGrafoPorModelo(id, vars = {}) {
  const clave = String(id || "").replace(/_/g, "-");
  switch (clave) {
    case "brazo-robotico":
      return crearGrafoBrazoRobotico(vars);
    case "pata-caminante":
      return crearGrafoPataCaminante(vars);
    case "armadura-puente":
      return crearGrafoArmaduraPuente(vars);
    case "cohete-landing":
      return crearGrafoCoheteLanding(vars);
    case "confinamiento-em":
      return crearGrafoConfinamientoEM(vars);
    case "campo-potencial":
      return crearGrafoCampoPotencial(vars);
    case "orbita-transferencia":
      return crearGrafoOrbitaTransferencia(vars);
    case "distribucion-termica":
      return crearGrafoDistribucionTermica(vars);
    case "acustica-beamforming":
      return crearGrafoAcusticaBeamforming(vars);
    case "superficie-fonoabsorbente":
      return crearGrafoSuperficieFonoabsorbente(vars);
    case "linea-transmision-rf":
      return crearGrafoLineaRF(vars);
    case "corte-chapa-nesting":
      return crearGrafoCorteChapaNesting(vars);
    case "controlador-pid":
      return crearGrafoControladorPID(vars);
    case "filtro-rlc":
      return crearGrafoFiltroRLC(vars);
    case "balanceo-fases-trifasico":
      return crearGrafoBalanceoFases(vars);
    case "engranajes":
      return crearGrafoTrenEngranajes();
    default:
      return new GrafoMecanismoMultifisica();
  }
}
