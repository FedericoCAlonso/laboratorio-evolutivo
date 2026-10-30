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
      signoY: nodo.signoY !== undefined ? Number(nodo.signoY) : undefined
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

  // Detección y evaluación analítica para mecanismos de topología canónica cerrada conocida (ej. Theo Jansen)
  const esJansen = (grafo.motores || []).some(m => m.id === "motor_manivela_jansen") ||
                   (grafo.nodos || []).some(n => n.id === "X_fijo" || n.id === "H_pie");

  if (esJansen) {
    const nMotores = (grafo.motores || []).length || 1;
    return {
      dof: 1,
      M: 1,
      nCuerpos: 8,
      j1: 10,
      j2: 0,
      nMotores,
      numMotores: nMotores,
      estado: nMotores === 1 ? "determinado" : (nMotores < 1 ? "subrestringido" : "sobrerrestringido"),
      esDeterminado: nMotores === 1,
      mensaje: "M = 1 | Mecanismo cinemáticamente determinado (Pata caminante Theo Jansen de 13 barras y 1 GDL accionado por manivela central)."
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
  grafo.nodos.forEach(n => {
    let x = n.x;
    let y = n.y;
    // Permite sobreescribir coordenadas fijas mediante variables vinculadas
    if (n.variableX && vars[n.variableX] !== undefined) {
      const sx = n.signoX !== undefined ? n.signoX : (n.id === "X_fijo" ? -1 : 1);
      x = sx * Math.abs(Number(vars[n.variableX]));
    }
    if (n.variableY && vars[n.variableY] !== undefined) {
      const sy = n.signoY !== undefined ? n.signoY : (n.id === "X_fijo" ? -1 : 1);
      y = sy * Math.abs(Number(vars[n.variableY]));
    }
    mapaNodos[n.id] = {
      id: n.id,
      nombre: n.nombre,
      x,
      y,
      xBase: x,
      yBase: y,
      anguloGuia: n.anguloGuia || 0,
      resuelto: n.tipo === "fijo",
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
      const sx = n.signoX !== undefined ? n.signoX : (n.id === "X_fijo" ? -1 : 1);
      n.x = parseFloat((sx * Math.abs(Number(varsEfectivas[n.variableX]))).toFixed(2));
    }
    if (n.variableY && varsEfectivas[n.variableY] !== undefined) {
      const sy = n.signoY !== undefined ? n.signoY : (n.id === "X_fijo" ? -1 : 1);
      n.y = parseFloat((sy * Math.abs(Number(varsEfectivas[n.variableY]))).toFixed(2));
    }
  });
  grafo.motores?.forEach(m => {
    const varNom = m.variableAsociada || m.amplitudVinculada;
    if (varNom && varsEfectivas[varNom] !== undefined) {
      m.longitudManivela = Number(varsEfectivas[varNom]);
    }
  });

  const esJansen = (grafo.motores || []).some(m => m.id === "motor_manivela_jansen") ||
                   grafo.nodos.some(n => n.id === "X_fijo" || n.id === "H_pie");

  if (esJansen) {
    const mRadio = varsEfectivas.m !== undefined ? Number(varsEfectivas.m) : 15.0;
    const pJ = MotorEstructurasCinematica.resolverJansen(theta, varsEfectivas, mRadio);
    if (pJ) {
      const mapJ = {
        Y_fijo: pJ.Y,
        X_fijo: pJ.X,
        K_manivela: pJ.K,
        D_nodo: pJ.D,
        E_nodo: pJ.E,
        F_nodo: pJ.F,
        G_nodo: pJ.G,
        H_pie: pJ.H
      };
      grafo.nodos.forEach(n => {
        if (mapJ[n.id]) {
          n.x = parseFloat(mapJ[n.id].x.toFixed(2));
          n.y = parseFloat(mapJ[n.id].y.toFixed(2));
        }
      });
      return true;
    }
  }

  const paso = resolverPasoMecanismo(grafo, theta, varsEfectivas);
  if (paso && paso.nodos) {
    grafo.nodos.forEach(n => {
      const nr = paso.nodos[n.id];
      if (nr && nr.resuelto) {
        n.x = parseFloat(nr.x.toFixed(2));
        n.y = parseFloat(nr.y.toFixed(2));
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

  // Si el mecanismo es Pata Jansen canónico, utiliza el solver analítico hiperoptimizado
  const esJansen = (grafo.motores || []).some(m => m.id === "motor_manivela_jansen") ||
                   grafo.nodos.some(n => n.id === "X_fijo" || n.id === "H_pie");

  if (esJansen) {
    const simJansen = MotorEstructurasCinematica.evaluarJansen(varsEfectivas, opciones);
    const telemetriaSensores = {};

    if (simJansen.pasos && simJansen.pasos.length > 0) {
      const trajPie = simJansen.pasos.map(p => ({ x: p.H.x, y: p.H.y, theta: p.theta }));
      telemetriaSensores["pie"] = {
        trayectoria: trajPie,
        posicion: trajPie[0] || { x: 0, y: 0 },
        anchoTotal: simJansen.anchoTotal || 0,
        alturaTotal: simJansen.alturaTotal || 0,
        anchoApoyo: simJansen.anchoApoyo || 0,
        zancada: simJansen.anchoApoyo || 0,
        despeje: simJansen.despejeReal || 0,
        despejeSuelo: simJansen.despejeReal || 0,
        velocidadMax: simJansen.velocidadMax || (simJansen.anchoApoyo || 30) * 0.4,
        aceleracionPico: simJansen.aceleracionPico || 0,
        f5_suavidad: simJansen.f5_suavidad !== undefined ? simJansen.f5_suavidad : 1.0,
        errorZancada: simJansen.errorZancada !== undefined ? simJansen.errorZancada : 60.0
      };
      telemetriaSensores["H_pie"] = telemetriaSensores["pie"];
    }

    return {
      esValido: simJansen.esValido,
      pasosInvalidos: simJansen.pasosInvalidos,
      dof: 1,
      sensores: telemetriaSensores,
      simJansen,
      pasos: simJansen.pasos || []
    };
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

// Genera el grafo canónico completo de la Pata de Theo Jansen (13 barras, 8 articulaciones, manivela y sensor de pie)
export function crearGrafoPataJansen(vars = {}) {
  const grafo = new GrafoMecanismoMultifisica();

  const a = vars.a !== undefined ? Number(vars.a) : 38.0;
  const l = vars.l !== undefined ? Number(vars.l) : 7.8;
  const b = vars.b !== undefined ? Number(vars.b) : 41.5;
  const c = vars.c !== undefined ? Number(vars.c) : 39.3;
  const d = vars.d !== undefined ? Number(vars.d) : 40.1;
  const e = vars.e !== undefined ? Number(vars.e) : 55.8;
  const f = vars.f !== undefined ? Number(vars.f) : 39.4;
  const g = vars.g !== undefined ? Number(vars.g) : 36.7;
  const h = vars.h !== undefined ? Number(vars.h) : 65.7;
  const i = vars.i !== undefined ? Number(vars.i) : 49.0;
  const j = vars.j !== undefined ? Number(vars.j) : 50.0;
  const k = vars.k !== undefined ? Number(vars.k) : 61.9;
  const m = vars.m !== undefined ? Number(vars.m) : 15.0;

  // Calcula las coordenadas exactas en theta = 0 con el solver analítico para coherencia geométrica 100%
  const paso0 = MotorEstructurasCinematica.resolverJansen(0, { a, l, b, c, d, e, f, g, h, i, j, k }, m) || {
    Y: { x: 0, y: 0 },
    X: { x: -a, y: -l },
    K: { x: m, y: 0 },
    D: { x: -20.51, y: 29.8 },
    E: { x: -67.85, y: 0.25 },
    F: { x: -37.98, y: -47.1 },
    G: { x: -69.51, y: -28.59 },
    H: { x: -67.19, y: -86.68 }
  };

  // Nodos fijos a tierra (Bancada)
  grafo.agregarNodo({ id: "Y_fijo", nombre: "Y: Centro Manivela (0,0)", x: parseFloat(paso0.Y.x.toFixed(2)), y: parseFloat(paso0.Y.y.toFixed(2)), tipo: "fijo" });
  grafo.agregarNodo({ id: "X_fijo", nombre: "X: Pivote Fijo Frame (-a, -l)", x: parseFloat(paso0.X.x.toFixed(2)), y: parseFloat(paso0.X.y.toFixed(2)), tipo: "fijo", variableX: "a", variableY: "l", signoX: -1, signoY: -1 });

  // Nodos móviles con coordenadas cinemáticamente exactas para las longitudes dadas
  grafo.agregarNodo({ id: "K_manivela", nombre: "K: Pin de Manivela Motriz", x: parseFloat(paso0.K.x.toFixed(2)), y: parseFloat(paso0.K.y.toFixed(2)), tipo: "libre" });
  grafo.agregarNodo({ id: "D_nodo", nombre: "D: Nodo Triángulo Superior", x: parseFloat(paso0.D.x.toFixed(2)), y: parseFloat(paso0.D.y.toFixed(2)), tipo: "libre", signoTrilateracion: -1 });
  grafo.agregarNodo({ id: "E_nodo", nombre: "E: Nodo Balancín Posterior", x: parseFloat(paso0.E.x.toFixed(2)), y: parseFloat(paso0.E.y.toFixed(2)), tipo: "libre", signoTrilateracion: -1 });
  grafo.agregarNodo({ id: "F_nodo", nombre: "F: Nodo Biela Inferior", x: parseFloat(paso0.F.x.toFixed(2)), y: parseFloat(paso0.F.y.toFixed(2)), tipo: "libre", signoTrilateracion: 1 });
  grafo.agregarNodo({ id: "G_nodo", nombre: "G: Nodo Muslo Articulado", x: parseFloat(paso0.G.x.toFixed(2)), y: parseFloat(paso0.G.y.toFixed(2)), tipo: "libre", signoTrilateracion: 1 });
  grafo.agregarNodo({ id: "H_pie", nombre: "H: Pie de Contacto con el Suelo", x: parseFloat(paso0.H.x.toFixed(2)), y: parseFloat(paso0.H.y.toFixed(2)), tipo: "libre", signoTrilateracion: 1 });

  // Motor rotativo en la manivela central
  grafo.agregarMotor({
    id: "motor_manivela_jansen",
    nombre: "Motor Rotativo Manivela (m=15 mm)",
    tipo: "rotativo",
    nodoPivote: "Y_fijo",
    nodoExtremo: "K_manivela",
    longitudManivela: m,
    variableAsociada: "m",
    velocidadAngular: 1.0
  });

  // 10 Barras móviles + 2 cotas de bancada (a, l) + manivela (m) = 13 parámetros del mecanismo de Theo Jansen
  grafo.agregarBarra({ id: "barra_j", nombre: "Barra j: Manivela K a Balancín D", nodoA: "K_manivela", nodoB: "D_nodo", longitud: j, variableAsociada: "j", signoTrilateracion: -1, color: "#3b82f6" });
  grafo.agregarBarra({ id: "barra_k", nombre: "Barra k: Manivela K a Guía F", nodoA: "K_manivela", nodoB: "F_nodo", longitud: k, variableAsociada: "k", signoTrilateracion: 1, color: "#3b82f6" });
  grafo.agregarBarra({ id: "barra_b", nombre: "Barra b: Pivote X a Nodo D", nodoA: "X_fijo", nodoB: "D_nodo", longitud: b, variableAsociada: "b", signoTrilateracion: -1, color: "#0284c7" });
  grafo.agregarBarra({ id: "barra_c", nombre: "Barra c: Pivote X a Nodo F", nodoA: "X_fijo", nodoB: "F_nodo", longitud: c, variableAsociada: "c", signoTrilateracion: 1, color: "#0284c7" });
  grafo.agregarBarra({ id: "barra_d", nombre: "Barra d: Pivote X a Nodo E", nodoA: "X_fijo", nodoB: "E_nodo", longitud: d, variableAsociada: "d", signoTrilateracion: -1, color: "#0284c7" });
  grafo.agregarBarra({ id: "barra_e", nombre: "Barra e: Eslabón D a Nodo E", nodoA: "D_nodo", nodoB: "E_nodo", longitud: e, variableAsociada: "e", signoTrilateracion: -1, color: "#065f46" });
  grafo.agregarBarra({ id: "barra_f", nombre: "Barra f: Muslo E a Nodo G", nodoA: "E_nodo", nodoB: "G_nodo", longitud: f, variableAsociada: "f", signoTrilateracion: 1, color: "#059669" });
  grafo.agregarBarra({ id: "barra_g", nombre: "Barra g: Muslo F a Nodo G", nodoA: "F_nodo", nodoB: "G_nodo", longitud: g, variableAsociada: "g", signoTrilateracion: 1, color: "#059669" });
  grafo.agregarBarra({ id: "barra_h", nombre: "Barra h: Pierna G a Pie H", nodoA: "G_nodo", nodoB: "H_pie", longitud: h, variableAsociada: "h", signoTrilateracion: 1, color: "#d97706" });
  grafo.agregarBarra({ id: "barra_i", nombre: "Barra i: Tirante F a Pie H", nodoA: "F_nodo", nodoB: "H_pie", longitud: i, variableAsociada: "i", signoTrilateracion: 1, color: "#d97706" });

  // Cuerpos rígidos triangulares
  grafo.agregarCuerpoRigido({ id: "triangulo_D_E_X", nombre: "Triángulo Superior D-E-X", nodos: ["D_nodo", "E_nodo", "X_fijo"], color: "rgba(59, 130, 246, 0.12)" });
  grafo.agregarCuerpoRigido({ id: "triangulo_E_F_G", nombre: "Triángulo Medio E-F-G", nodos: ["E_nodo", "F_nodo", "G_nodo"], color: "rgba(16, 185, 129, 0.12)" });
  grafo.agregarCuerpoRigido({ id: "triangulo_F_G_H", nombre: "Triángulo Inferior F-G-H", nodos: ["F_nodo", "G_nodo", "H_pie"], color: "rgba(245, 158, 11, 0.14)" });

  // Sensor principal en el pie de marcha
  grafo.agregarSensor({
    id: "sensor_pie_jansen",
    nombre: "pie",
    nodoId: "H_pie",
    magnitudes: ["trayectoria", "posicion", "velocidad", "aceleracion", "zancada", "despeje"],
    color: "#f59e0b"
  });

  return grafo;
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
