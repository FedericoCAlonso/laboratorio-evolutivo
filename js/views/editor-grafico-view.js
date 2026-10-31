// =========================================================================
// CAPA VISTA: EDITOR GRÁFICO CAD DE MECANISMOS MULTICUERPO Y MULTIFÍSICA 2D
// ARQUITECTURA MVVM - WORKSPACE DEDICADO A PANTALLA COMPLETA
// =========================================================================

import {
  GrafoMecanismoMultifisica,
  analizarGradosLibertad,
  resolverPasoMecanismo,
  sincronizarPosicionesNodosGrafo,
  simularCicloMecanismo,
  crearGrafoBrazoRobotico,
  crearGrafoPataCaminante,
  crearGrafoTrenEngranajes,
  crearGrafoPorModelo
} from "../engines/mecanismos.js?v=3.1";

// Vista de diseño y construcción gráfica de mecanismos articulados y acoplamientos multifísica
export class EditorGraficoView {
  constructor(opciones = {}) {
    this.contenedor = opciones.contenedor || null;
    this.onGrafoModificado = opciones.onGrafoModificado || null;
    this.onVariableVinculada = opciones.onVariableVinculada || null;
    this.onVariableModificada = opciones.onVariableModificada || null;
    this.onPresetSeleccionado = opciones.onPresetSeleccionado || null;

    // Estado del grafo activo
    this.grafo = new GrafoMecanismoMultifisica();
    this.herramientaActiva = "select"; // 'select' | 'nodo_fijo' | 'nodo_libre' | 'nodo_deslizante' | 'barra' | 'cuerpo' | 'motor_rotativo' | 'motor_lineal' | 'engranaje' | 'polea' | 'sensor' | 'multiefecto'
    this.elementoSeleccionado = null; // { tipo: 'nodo'|'barra'|'motor'|'transmision'|'sensor', id: string }
    this.nodoInicioConexion = null;
    this.nodosCuerpoTemporal = [];
    this._nodoArrastradoActivo = null;

    // Estado de simulación en vivo del mecanismo (inicia en modo edición/pausa a theta=0 para arrastrar cotas con precisión)
    this.animando = false;
    this.animId = null;
    this.thetaActual = 0.0;
    this.indicePaso = 0;
    this.valoresVariables = {};
    this.telemetriaSensores = {};

    // Transformación de coordenadas del viewport del canvas (Mundo <-> Pantalla)
    this.viewport = {
      zoom: 3.2, // Píxeles por unidad física (mm)
      centroX: 0.0,
      centroY: -35.0,
      arrastrandoPan: false,
      panInicioX: 0,
      panInicioY: 0
    };

    this.dom = {};
  }

  // Inicializa y mapea la interfaz del editor en el contenedor proporcionado
  inicializar(contenedor) {
    if (contenedor) this.contenedor = contenedor;
    if (!this.contenedor) return;

    this._construirLayout();
    this._mapearElementosDom();
    this._registrarEventos();
    this.redibujar();
  }

  // Detiene animaciones activas
  detener() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  // Carga un grafo completo de mecanismo multicuerpo en el lienzo
  cargarGrafo(grafo) {
    if (grafo instanceof GrafoMecanismoMultifisica) {
      this.grafo = grafo.clonar();
    } else if (grafo && typeof grafo === "object") {
      this.grafo = new GrafoMecanismoMultifisica(grafo);
    }
    this.elementoSeleccionado = null;
    // Asegura posiciones de nodos consistentes con las longitudes actuales en theta=0
    if (this.grafo.nodos.length > 0) {
      sincronizarPosicionesNodosGrafo(this.grafo, this.valoresVariables, this.thetaActual);
    }
    this._actualizarIndicadorDOF();
    this._ejecutarSimulacionEnLienzo();
    this.autoEncuadrar();
    this._actualizarInspector();
    this._actualizarPanelVariablesVinculadas();
    this.redibujar();
  }

  // Ajusta automáticamente el centro y el zoom del lienzo para que el mecanismo ocupe de forma óptima la pantalla (especialmente en móviles).
  autoEncuadrar() {
    const nodos = this.grafo?.nodos || [];
    if (nodos.length === 0) {
      this.viewport.centroX = 0.0;
      this.viewport.centroY = -20.0;
      this.viewport.zoom = 2.6;
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodos.forEach(n => {
      if (typeof n.x === "number" && typeof n.y === "number") {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
      }
    });

    for (const sNom in this.telemetriaSensores) {
      const tr = this.telemetriaSensores[sNom]?.trayectoria;
      if (Array.isArray(tr)) {
        tr.forEach(pt => {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        });
      }
    }

    if (!isFinite(minX) || !isFinite(maxX)) return;
    const rangoX = Math.max(35, maxX - minX);
    const rangoY = Math.max(35, maxY - minY);
    this.viewport.centroX = (minX + maxX) / 2;
    this.viewport.centroY = (minY + maxY) / 2;

    const { w: wCSS, h: hCSS } = this._obtenerDimensionesLienzo();

    const factorMargen = wCSS < 600 ? 0.80 : 0.74;
    const zoomOptimo = Math.min((wCSS * factorMargen) / rangoX, (hCSS * factorMargen) / rangoY);
    this.viewport.zoom = Math.max(0.6, Math.min(8.5, zoomOptimo));
  }

  // Obtiene las dimensiones reales y acotadas del lienzo CAD evitando desbordes por DPR en móviles
  _obtenerDimensionesLienzo() {
    const canvas = this.dom?.canvas;
    const maxW = typeof window !== "undefined" ? Math.max(260, window.innerWidth - 24) : 1000;
    const rawW = (canvas && (canvas.parentElement?.clientWidth || canvas.clientWidth) > 60)
      ? (canvas.parentElement?.clientWidth || canvas.clientWidth)
      : (typeof window !== "undefined" && window.innerWidth < 768 ? Math.max(300, window.innerWidth - 28) : 820);
    const w = Math.min(rawW, maxW);
    const h = (canvas && (canvas.parentElement?.clientHeight || canvas.clientHeight) > 60)
      ? (canvas.parentElement?.clientHeight || canvas.clientHeight)
      : (typeof window !== "undefined" && window.innerWidth < 768 ? 380 : 500);
    return { w, h };
  }

  // Permite que sensores físicos del móvil (giroscopio / inclinación) o sliders externos roten el mecanismo en vivo.
  establecerAnguloExterno(thetaRad) {
    if (typeof thetaRad !== "number" || !isFinite(thetaRad)) return;
    this.thetaActual = ((thetaRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (this.grafo && this.grafo.nodos.length > 0) {
      sincronizarPosicionesNodosGrafo(this.grafo, this.valoresVariables, this.thetaActual);
      this.redibujar();
    }
  }

  // Actualiza los valores de las variables de optimización y recalcula la cinemática
  actualizarValoresVariables(vars = {}) {
    this.valoresVariables = { ...this.valoresVariables, ...vars };

    // Sincroniza geometría del grafo CAD según los valores provistos
    for (const nom in vars) {
      const val = Number(vars[nom]);
      if (isNaN(val)) continue;

      // 1. Longitud de barras vinculadas
      this.grafo.barras?.forEach(b => {
        if (b.variableAsociada === nom || b.longitudVinculada === nom) {
          b.longitud = val;
        }
      });

      // 2. Coordenadas de nodos vinculados a cotas dimensionales (con soporte de offset y escala)
      this.grafo.nodos?.forEach(n => {
        if (n.variableX === nom) {
          const ox = n.offsetX || 0;
          const ex = n.escalaX || 1;
          n.x = parseFloat((n.signoX !== undefined ? ox + n.signoX * Math.abs(val) * ex : ox + val * ex).toFixed(2));
        }
        if (n.variableY === nom) {
          const oy = n.offsetY || 0;
          const ey = n.escalaY || 1;
          n.y = parseFloat((n.signoY !== undefined ? oy + n.signoY * Math.abs(val) * ey : oy + val * ey).toFixed(2));
        }
      });

      // 3. Radio de motores vinculados
      this.grafo.motores?.forEach(m => {
        if (m.variableAsociada === nom || m.amplitudVinculada === nom) {
          m.longitudManivela = val;
        }
      });
    }

    // Si no estamos arrastrando manualmente un nodo con el mouse, actualiza las posiciones cinemáticas de los nodos
    if (!this._nodoArrastradoActivo && this.grafo.nodos.length > 0) {
      sincronizarPosicionesNodosGrafo(this.grafo, this.valoresVariables, this.thetaActual);
    }

    this._ejecutarSimulacionEnLienzo();
    this._actualizarInspector();
    this._actualizarPanelVariablesVinculadas();
    this.redibujar();
  }

  // Obtiene el diccionario de telemetría de sensores para los valores de variables provistos
  obtenerTelemetriaSensores(vars = null) {
    const v = vars || this.valoresVariables;
    try {
      const res = simularCicloMecanismo(this.grafo, v, { pasos: 60 });
      return res.sensores || {};
    } catch (_) {
      return this.telemetriaSensores || {};
    }
  }

  // Genera y monta la estructura HTML del Workspace CAD completo
  _construirLayout() {
    this.contenedor.innerHTML = `
      <div class="editor-cad-contenedor" style="display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 600px; background: var(--bg-card, #111827); border-radius: var(--radio-sm, 12px); overflow: hidden; border: 1px solid var(--borde, rgba(148,163,184,0.2));">
        
        <!-- Barra de herramientas superior del CAD -->
        <div class="toolbar-cad" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.45rem; padding: 0.5rem 0.75rem; background: var(--bg-tarjeta, #1f2937); border-bottom: 1px solid var(--borde, rgba(148,163,184,0.2));">
          
          <!-- Paleta de herramientas de modelado -->
          <div style="display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;">
            <button type="button" class="btn-tool-cad" data-tool="select" title="Seleccionar y arrastrar nodos (recalcula longitudes y variables en vivo)" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              👆 Seleccionar / Mover
            </button>
            <div style="width: 1px; height: 20px; background: rgba(148,163,184,0.25); margin: 0 0.1rem;"></div>
            <button type="button" class="btn-tool-cad" data-tool="nodo_fijo" title="Agregar pivote fijo a bancada/tierra" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              ⚓ Pivote Fijo
            </button>
            <button type="button" class="btn-tool-cad" data-tool="nodo_libre" title="Agregar articulación o bisagra libre" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              ⚪ Bisagra Libre
            </button>
            <button type="button" class="btn-tool-cad" data-tool="nodo_deslizante" title="Agregar corredera / unión prismática deslizante" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              🛤️ Corredera
            </button>
            <button type="button" class="btn-tool-cad" data-tool="barra" title="Conectar 2 nodos con una barra/palito" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              📏 Barra / Palito
            </button>
            <button type="button" class="btn-tool-cad" data-tool="cuerpo" title="Crear cuerpo rígido poligonal con puntos bisagra (clic en 3 nodos)" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              🔺 Cuerpo Rígido
            </button>
            <div style="width: 1px; height: 20px; background: rgba(148,163,184,0.25); margin: 0 0.1rem;"></div>
            <button type="button" class="btn-tool-cad" data-tool="motor_rotativo" title="Asignar motor rotativo (manivela motriz entre pivote y extremo)" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              🔄 Motor Rotativo
            </button>
            <button type="button" class="btn-tool-cad" data-tool="motor_lineal" title="Asignar actuador / motor lineal (pistón entre 2 nodos)" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              ↔️ Motor Lineal
            </button>
            <button type="button" class="btn-tool-cad" data-tool="engranaje" title="Acoplar par de engranajes entre 2 ejes" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              ⚙️ Engranaje
            </button>
            <button type="button" class="btn-tool-cad" data-tool="polea" title="Acoplar transmisión por poleas y correa entre 2 ejes" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              🪢 Polea
            </button>
            <div style="width: 1px; height: 20px; background: rgba(148,163,184,0.25); margin: 0 0.1rem;"></div>
            <button type="button" class="btn-tool-cad" data-tool="sensor" title="Marcar punto de medida multimagnitud (posición, velocidad, aceleración, temperatura, campo EM)" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              🎯 Punto Medida
            </button>
            <button type="button" class="btn-tool-cad" data-tool="multiefecto" title="Asociar imán, carga eléctrica o fuente térmica a un nodo" style="padding: 0.32rem 0.55rem; font-size: 0.76rem; border-radius: 6px; cursor: pointer;">
              🧲 Fuente EM / Térmica
            </button>
          </div>

          <!-- Acciones de control y Grados de Libertad -->
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <!-- Badge de Grados de Libertad DOF (Grübler-Kutzbach) -->
            <div id="cad-badge-dof" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.4);" title="Grados de Libertad cinemáticos">
              ⚙️ DOF: M = 1 (Determinado)
            </div>

            <!-- Badge de Fitness Evaluado en Vivo -->
            <div id="cad-live-fitness-badge" title="Aptitud (Fitness) evaluada en tiempo real mientras arrastras nodos o modificas cotas">
              🎯 Fitness: --
            </div>

            <!-- Selector de modelos gráficos y mecanismos preconfigurados -->
            <select id="cad-select-predefinido" style="padding: 0.28rem 0.45rem; font-size: 0.75rem; border-radius: 6px; background: var(--bg-input, #0f172a); color: var(--texto-principal, #f8fafc); border: 1px solid var(--borde, #334155); cursor: pointer;">
              <option value="">💡 Cargar Modelo Gráfico...</option>
              <option value="armadura-puente">🌉 Armadura de Puente (Celosía 2D)</option>
              <option value="cohete-landing">🚀 Aterrizaje de Cohete (Falcon Landing)</option>
              <option value="confinamiento-em">⚡ Trampa Electromagnética (Lorentz)</option>
              <option value="brazo-robotico">🦾 Brazo Robótico (3 GDL)</option>
              <option value="pata-caminante">🦿 Pata Caminante (4 Barras)</option>
              <option value="campo-potencial">🌐 Campo de Potencial y Deflexión 2D</option>
              <option value="orbita-transferencia">🛰️ Transferencia Orbital (Hohmann)</option>
              <option value="distribucion-termica">🔥 Disipación Térmica en Placa 2D</option>
              <option value="acustica-beamforming">🔊 Arreglo Acústico y Beamforming</option>
              <option value="superficie-fonoabsorbente">🔇 Superficie Fonoabsorbente (Cuñas)</option>
              <option value="linea-transmision-rf">📶 Línea de Transmisión RF (Smith)</option>
              <option value="corte-chapa-nesting">✂️ Corte de Chapa y Anidado 2D</option>
              <option value="controlador-pid">📈 Sintonizador PID (Lazo Control)</option>
              <option value="filtro-rlc">🔌 Síntesis de Filtro Analógico RLC</option>
              <option value="balanceo-fases-trifasico">⚡ Balanceo de Fases Trifásico (R-S-T)</option>
              <option value="engranajes">⚙️ Tren Engranajes + Pistón</option>
              <option value="vacio">📄 Lienzo en Blanco (Nuevo)</option>
            </select>

            <!-- Botón simular giro / modo edición estática -->
            <button type="button" id="cad-btn-animar" class="btn-m3-tonal" style="padding: 0.28rem 0.6rem; font-size: 0.75rem; cursor: pointer; border-radius: 6px;" title="Animar el giro del motor o pausar para editar cotas arrastrando nodos">
              ▶ Simular Giro
            </button>

            <!-- Botón maximizar a pantalla completa -->
            <button type="button" id="cad-btn-fullscreen" class="btn-m3-tonal" style="padding: 0.28rem 0.55rem; font-size: 0.75rem; cursor: pointer; border-radius: 6px;" title="Alternar pantalla completa del Editor CAD">
              ⛶ Pantalla Completa
            </button>
          </div>
        </div>

        <!-- Área de trabajo central: Viewport Canvas y Panel Inspector + Variables en Vivo -->
        <div class="cad-main-split">
          
          <!-- Viewport del Canvas CAD interactivo -->
          <div class="cad-canvas-viewport" style="flex: 1; position: relative; width: 100%; height: 100%; overflow: hidden; background: #0b0f19;">
            <canvas id="canvas-editor-cad" width="320" height="380" style="display: block; width: 100%; height: 100%; cursor: default; touch-action: none;"></canvas>

            <!-- Overlay de información de coordenadas del cursor -->
            <div id="cad-overlay-coords" style="position: absolute; bottom: 8px; left: 12px; font-size: 0.78rem; color: #cbd5e1; font-family: monospace; background: rgba(15,23,42,0.88); padding: 0.25rem 0.55rem; border-radius: 6px; pointer-events: none; border: 1px solid rgba(148,163,184,0.2);">
              X: 0.0 | Y: 0.0 | 100%
            </div>

            <!-- Botones de zoom flotantes -->
            <div style="position: absolute; bottom: 10px; right: 12px; display: flex; flex-direction: column; gap: 6px;">
              <button type="button" id="cad-btn-zoom-in" style="width: 38px; height: 38px; border-radius: 8px; background: rgba(30,41,59,0.92); color: #fff; border: 1px solid #475569; font-weight: bold; font-size: 1.05rem; cursor: pointer;">+</button>
              <button type="button" id="cad-btn-zoom-out" style="width: 38px; height: 38px; border-radius: 8px; background: rgba(30,41,59,0.92); color: #fff; border: 1px solid #475569; font-weight: bold; font-size: 1.05rem; cursor: pointer;">-</button>
              <button type="button" id="cad-btn-zoom-reset" style="width: 38px; height: 38px; border-radius: 8px; background: rgba(30,41,59,0.92); color: #fff; border: 1px solid #475569; font-size: 0.95rem; cursor: pointer;" title="Centrar mecanismo">⌖</button>
            </div>
          </div>

          <!-- Sidebar lateral: Inspector de Propiedades, Variables Vinculadas en Vivo y Telemetría de Sensores -->
          <div id="cad-sidebar-inspector" style="width: 310px; border-left: 1px solid var(--borde, rgba(148,163,184,0.2)); background: var(--bg-card, #111827); padding: 0.85rem; display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h4 style="margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--texto-principal, #f8fafc); text-transform: uppercase; letter-spacing: 0.05em;">
                🔍 Inspector CAD
              </h4>
              <span id="cad-inspector-tipo-tag" style="font-size: 0.78rem; padding: 0.2rem 0.5rem; border-radius: 6px; background: #1e293b; color: #cbd5e1; font-weight: 600;">
                Ninguno
              </span>
            </div>

            <!-- Contenido dinámico del elemento seleccionado -->
            <div id="cad-inspector-contenido" style="font-size: 0.88rem; color: #e2e8f0;">
              <div style="padding: 0.85rem 0.5rem; text-align: center; color: #94a3b8; font-size: 0.86rem; background: rgba(30,41,59,0.35); border-radius: 8px;">
                Toque o arrastre cualquier <strong>nodo</strong>, <strong>barra</strong>, <strong>motor</strong>, <strong>engranaje</strong> o <strong>sensor</strong> en el lienzo.
              </div>
            </div>

            <!-- Panel en vivo de Variables / Cotas Vinculadas al Mecanismo (se actualizan en vivo al arrastrar nodos) -->
            <div style="border-top: 1px solid rgba(148,163,184,0.18); padding-top: 0.65rem;">
              <div style="font-size: 0.86rem; font-weight: 700; margin-bottom: 0.45rem; color: #60a5fa; display: flex; align-items: center; justify-content: space-between;">
                <span>📐 Cotas / Variables Vinculadas</span>
                <span id="cad-conteo-vars" style="color: #93c5fd; font-family: monospace; font-size: 0.82rem;">(0)</span>
              </div>
              <div id="cad-lista-variables-vivas" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; max-height: 220px; overflow-y: auto; padding-right: 2px;">
                <span style="color: #64748b; font-size: 0.82rem; grid-column: span 2;">Sin variables vinculadas.</span>
              </div>
            </div>

            <!-- Resumen de Sensores activos y Telemetría Multimagnitud -->
            <div style="border-top: 1px solid rgba(148,163,184,0.18); padding-top: 0.65rem;">
              <div style="font-size: 0.86rem; font-weight: 700; margin-bottom: 0.45rem; color: #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                <span>🎯 Puntos de Medida (Sensores)</span>
                <span id="cad-conteo-sensores" style="color: #f59e0b; font-family: monospace; font-size: 0.82rem;">(0)</span>
              </div>
              <div id="cad-lista-sensores-telemetria" style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto;">
                <span style="color: #64748b;">No hay sensores definidos.</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  // Mapea referencias a los elementos DOM interactivos
  _mapearElementosDom() {
    this.dom.contenedorRaiz = this.contenedor.querySelector(".editor-cad-contenedor");
    this.dom.canvas = this.contenedor.querySelector("#canvas-editor-cad");
    this.dom.ctx = this.dom.canvas ? this.dom.canvas.getContext("2d") : null;
    this.dom.badgeDof = this.contenedor.querySelector("#cad-badge-dof");
    this.dom.badgeFitnessVivo = this.contenedor.querySelector("#cad-live-fitness-badge");
    this.dom.btnAnimar = this.contenedor.querySelector("#cad-btn-animar");
    this.dom.btnFullscreen = this.contenedor.querySelector("#cad-btn-fullscreen");
    this.dom.selectPredefinido = this.contenedor.querySelector("#cad-select-predefinido");
    this.dom.overlayCoords = this.contenedor.querySelector("#cad-overlay-coords");
    this.dom.inspectorContenido = this.contenedor.querySelector("#cad-inspector-contenido");
    this.dom.inspectorTipoTag = this.contenedor.querySelector("#cad-inspector-tipo-tag");
    this.dom.listaVariablesVivas = this.contenedor.querySelector("#cad-lista-variables-vivas");
    this.dom.conteoVars = this.contenedor.querySelector("#cad-conteo-vars");
    this.dom.listaSensores = this.contenedor.querySelector("#cad-lista-sensores-telemetria");
    this.dom.conteoSensores = this.contenedor.querySelector("#cad-conteo-sensores");
    this.dom.btnZoomIn = this.contenedor.querySelector("#cad-btn-zoom-in");
    this.dom.btnZoomOut = this.contenedor.querySelector("#cad-btn-zoom-out");
    this.dom.btnZoomReset = this.contenedor.querySelector("#cad-btn-zoom-reset");
    this.dom.botonesTool = Array.from(this.contenedor.querySelectorAll(".btn-tool-cad"));
  }

  // Registra los eventos de interacción y herramientas
  _registrarEventos() {
    // 1. Selección de herramientas
    this.dom.botonesTool.forEach(btn => {
      btn.addEventListener("click", () => {
        const tool = btn.dataset.tool;
        this.seleccionarHerramienta(tool);
      });
    });

    // 2. Control de simulación en vivo (Giro de motores vs Modo Edición Estática)
    this.dom.btnAnimar?.addEventListener("click", () => {
      this.animando = !this.animando;
      this.dom.btnAnimar.textContent = this.animando ? "⏸ Pausar Giro" : "▶ Simular Giro";
      if (this.animando) {
        this._iniciarBucleAnimacion();
      } else {
        this.detener();
        this.thetaActual = 0.0;
        sincronizarPosicionesNodosGrafo(this.grafo, this.valoresVariables, 0.0);
        this.redibujar();
      }
    });

    // 2b. Botón Pantalla Completa
    this.dom.btnFullscreen?.addEventListener("click", () => {
      const raiz = this.dom.contenedorRaiz || this.contenedor;
      if (!raiz) return;
      const activo = raiz.classList.toggle("cad-fullscreen-overlay");
      if (activo) {
        raiz.style.position = "fixed";
        raiz.style.inset = "12px";
        raiz.style.zIndex = "9999";
        raiz.style.width = "calc(100vw - 24px)";
        raiz.style.height = "calc(100vh - 24px)";
        this.dom.btnFullscreen.textContent = "🗗 Salir Pantalla Completa";
      } else {
        raiz.style.position = "";
        raiz.style.inset = "";
        raiz.style.zIndex = "";
        raiz.style.width = "100%";
        raiz.style.height = "100%";
        this.dom.btnFullscreen.textContent = "⛶ Pantalla Completa";
      }
      setTimeout(() => this.redibujar(), 30);
    });

    // 3. Modelos gráficos y mecanismos predefinidos
    this.dom.selectPredefinido?.addEventListener("change", (e) => {
      const valor = e.target.value;
      if (!valor) return;
      if (valor === "vacio") {
        this.cargarGrafo(new GrafoMecanismoMultifisica());
        this._notificarCambioGrafo();
      } else if (valor === "engranajes") {
        this.cargarGrafo(crearGrafoTrenEngranajes());
        this._notificarCambioGrafo();
      } else {
        const clave = valor === "caminante" ? "pata-caminante" : (valor === "brazo" ? "brazo-robotico" : valor);
        if (typeof this.onPresetSeleccionado === "function") {
          this.onPresetSeleccionado(clave);
        } else {
          this.cargarGrafo(crearGrafoPorModelo(clave, this.valoresVariables));
          this._notificarCambioGrafo();
        }
      }
      e.target.value = "";
    });

    // 4. Zoom y auto-encuadre
    this.dom.btnZoomIn?.addEventListener("click", () => {
      this.viewport.zoom = Math.min(10.0, this.viewport.zoom * 1.25);
      this.redibujar();
    });
    this.dom.btnZoomOut?.addEventListener("click", () => {
      this.viewport.zoom = Math.max(0.5, this.viewport.zoom / 1.25);
      this.redibujar();
    });
    this.dom.btnZoomReset?.addEventListener("click", () => {
      this.autoEncuadrar();
      this.redibujar();
    });

    // 5. Interacción con el Canvas (Clics, Arrastre de Nodos, Paneo, Pinch-to-Zoom y Soporte Táctil Móvil)
    const canvas = this.dom.canvas;
    if (!canvas) return;

    let arrastrandoNodo = null;
    let pinchEstado = null;
    let ultimoTapMs = 0;

    const vibrarTactil = (ms = 10) => {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          navigator.vibrate(ms);
        }
      } catch (_) {}
    };

    const iniciarInteraccion = (clientX, clientY, button = 0, esTouch = false) => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const mundo = this.pantallaAMundo(px, py);
      const radioHitNodo = (esTouch ? 28 : 14) / this.viewport.zoom;

      // Botón secundario o rueda central: paneo directo
      if (button === 1 || button === 2) {
        this.viewport.arrastrandoPan = true;
        this.viewport.panInicioX = px;
        this.viewport.panInicioY = py;
        return;
      }

      // Herramienta 'select'
      if (this.herramientaActiva === "select") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, radioHitNodo);
        if (nodo) {
          arrastrandoNodo = nodo;
          if (esTouch) vibrarTactil(12);
          this.seleccionarElemento("nodo", nodo.id);
          this.redibujar();
          return;
        }

        const barra = this._encontrarBarraCercana(mundo.x, mundo.y, (esTouch ? 18 : 8) / this.viewport.zoom);
        if (barra) {
          if (esTouch) vibrarTactil(8);
          this.seleccionarElemento("barra", barra.id);
          this.redibujar();
          return;
        }

        const motor = this._encontrarMotorCercano(mundo.x, mundo.y, (esTouch ? 20 : 10) / this.viewport.zoom);
        if (motor) {
          if (esTouch) vibrarTactil(8);
          this.seleccionarElemento("motor", motor.id);
          this.redibujar();
          return;
        }

        const transmision = this._encontrarTransmisionCercana(mundo.x, mundo.y, (esTouch ? 20 : 10) / this.viewport.zoom);
        if (transmision) {
          if (esTouch) vibrarTactil(8);
          this.seleccionarElemento("transmision", transmision.id);
          this.redibujar();
          return;
        }

        // Si toca o arrastra sobre el fondo vacío en modo 'select', activa paneo suave de cámara
        this.seleccionarElemento(null, null);
        this.viewport.arrastrandoPan = true;
        this.viewport.panInicioX = px;
        this.viewport.panInicioY = py;
        this.redibujar();
      }

      // Herramienta 'nodo_fijo'
      else if (this.herramientaActiva === "nodo_fijo") {
        const nuevo = this.grafo.agregarNodo({
          x: parseFloat(mundo.x.toFixed(1)),
          y: parseFloat(mundo.y.toFixed(1)),
          tipo: "fijo"
        });
        this.seleccionarElemento("nodo", nuevo.id);
        this._notificarCambioGrafo();
        this.seleccionarHerramienta("select");
      }

      // Herramienta 'nodo_libre'
      else if (this.herramientaActiva === "nodo_libre") {
        const nuevo = this.grafo.agregarNodo({
          x: parseFloat(mundo.x.toFixed(1)),
          y: parseFloat(mundo.y.toFixed(1)),
          tipo: "libre"
        });
        this.seleccionarElemento("nodo", nuevo.id);
        this._notificarCambioGrafo();
        this.seleccionarHerramienta("select");
      }

      // Herramienta 'nodo_deslizante' (Corredera / Guía Prismática)
      else if (this.herramientaActiva === "nodo_deslizante") {
        const nuevo = this.grafo.agregarNodo({
          nombre: `Corredera ${this.grafo.nodos.length + 1}`,
          x: parseFloat(mundo.x.toFixed(1)),
          y: parseFloat(mundo.y.toFixed(1)),
          tipo: "deslizante",
          anguloGuia: 0
        });
        this.seleccionarElemento("nodo", nuevo.id);
        this._notificarCambioGrafo();
        this.seleccionarHerramienta("select");
      }

      // Herramienta 'barra' (Conexión entre 2 nodos)
      else if (this.herramientaActiva === "barra") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          if (!this.nodoInicioConexion) {
            this.nodoInicioConexion = nodo;
          } else if (this.nodoInicioConexion.id !== nodo.id) {
            const dist = Math.hypot(nodo.x - this.nodoInicioConexion.x, nodo.y - this.nodoInicioConexion.y);
            const varSug = `L_${this.grafo.barras.length + 1}`;
            const bNueva = this.grafo.agregarBarra({
              nodoA: this.nodoInicioConexion.id,
              nodoB: nodo.id,
              longitud: parseFloat(dist.toFixed(1)),
              variableAsociada: varSug,
              color: "#3b82f6"
            });
            this.nodoInicioConexion = null;
            this.seleccionarElemento("barra", bNueva.id);
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
          }
        }
      }

      // Herramienta 'cuerpo' (Cuerpo rígido poligonal con puntos bisagra)
      else if (this.herramientaActiva === "cuerpo") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo && !this.nodosCuerpoTemporal.includes(nodo.id)) {
          this.nodosCuerpoTemporal.push(nodo.id);
          if (this.nodosCuerpoTemporal.length >= 3) {
            const ids = [...this.nodosCuerpoTemporal];
            // Asegura que existan las barras rígidas perimetrales del triángulo
            for (let i = 0; i < ids.length; i++) {
              const idA = ids[i];
              const idB = ids[(i + 1) % ids.length];
              const existe = this.grafo.barras.some(
                b => (b.nodoA === idA && b.nodoB === idB) || (b.nodoA === idB && b.nodoB === idA)
              );
              if (!existe) {
                const nA = this.grafo.nodos.find(n => n.id === idA);
                const nB = this.grafo.nodos.find(n => n.id === idB);
                if (nA && nB) {
                  this.grafo.agregarBarra({
                    nodoA: idA,
                    nodoB: idB,
                    longitud: parseFloat(Math.hypot(nA.x - nB.x, nA.y - nB.y).toFixed(1)),
                    color: "#059669"
                  });
                }
              }
            }
            this.grafo.agregarCuerpoRigido({
              nombre: `Cuerpo Rígido ${this.grafo.cuerposRigidos.length + 1}`,
              nodos: ids,
              color: "rgba(16, 185, 129, 0.14)"
            });
            this.nodosCuerpoTemporal = [];
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
          } else {
            this.redibujar();
          }
        }
      }

      // Herramienta 'motor_rotativo' (Asignar manivela motriz sobre un pivote)
      else if (this.herramientaActiva === "motor_rotativo") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          if (!this.nodoInicioConexion) {
            this.nodoInicioConexion = nodo;
          } else if (this.nodoInicioConexion.id !== nodo.id) {
            const dist = Math.hypot(nodo.x - this.nodoInicioConexion.x, nodo.y - this.nodoInicioConexion.y);
            const mNuevo = this.grafo.agregarMotor({
              tipo: "rotativo",
              nombre: `Motor Rotativo ${this.grafo.motores.length + 1}`,
              nodoPivote: this.nodoInicioConexion.id,
              nodoExtremo: nodo.id,
              longitudManivela: parseFloat(dist.toFixed(1)),
              variableAsociada: `m_${this.grafo.motores.length + 1}`,
              velocidadAngular: 1.0
            });
            this.nodoInicioConexion = null;
            this.seleccionarElemento("motor", mNuevo.id);
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
          }
        }
      }

      // Herramienta 'motor_lineal' (Actuador lineal / pistón entre 2 nodos)
      else if (this.herramientaActiva === "motor_lineal") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          if (!this.nodoInicioConexion) {
            this.nodoInicioConexion = nodo;
          } else if (this.nodoInicioConexion.id !== nodo.id) {
            const dist = Math.hypot(nodo.x - this.nodoInicioConexion.x, nodo.y - this.nodoInicioConexion.y);
            const mLin = this.grafo.agregarMotor({
              tipo: "lineal",
              nombre: `Actuador Lineal ${this.grafo.motores.length + 1}`,
              nodoPivote: this.nodoInicioConexion.id,
              nodoExtremo: nodo.id,
              longitudManivela: parseFloat(dist.toFixed(1)),
              carreraMin: parseFloat((dist * 0.75).toFixed(1)),
              carreraMax: parseFloat((dist * 1.25).toFixed(1)),
              variableAsociada: `act_${this.grafo.motores.length + 1}`,
              velocidadAngular: 1.0
            });
            this.nodoInicioConexion = null;
            this.seleccionarElemento("motor", mLin.id);
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
          }
        }
      }

      // Herramienta 'engranaje' o 'polea' (Transmisión entre 2 ejes)
      else if (this.herramientaActiva === "engranaje" || this.herramientaActiva === "polea") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          if (!this.nodoInicioConexion) {
            this.nodoInicioConexion = nodo;
          } else if (this.nodoInicioConexion.id !== nodo.id) {
            const dist = Math.hypot(nodo.x - this.nodoInicioConexion.x, nodo.y - this.nodoInicioConexion.y);
            const esEng = this.herramientaActiva === "engranaje";
            const r1 = esEng ? parseFloat((dist * 0.4).toFixed(1)) : 14.0;
            const r2 = esEng ? parseFloat((dist * 0.6).toFixed(1)) : 22.0;
            const trNueva = this.grafo.agregarTransmision({
              tipo: esEng ? "engranaje" : "polea",
              nodo1: this.nodoInicioConexion.id,
              nodo2: nodo.id,
              radio1: r1,
              radio2: r2,
              relacion: parseFloat((r1 / Math.max(1, r2)).toFixed(3))
            });
            this.nodoInicioConexion = null;
            this.seleccionarElemento("transmision", trNueva.id);
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
          }
        }
      }

      // Herramienta 'sensor'
      else if (this.herramientaActiva === "sensor") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          const existente = this.grafo.sensores.find(s => s.nodoId === nodo.id);
          if (existente) {
            this.seleccionarElemento("sensor", existente.id);
          } else {
            const sNuevo = this.grafo.agregarSensor({
              nodoId: nodo.id,
              nombre: nodo.id === "H_pie" ? "pie" : nodo.nombre.split(":")[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "_"),
              magnitudes: ["posicion", "velocidad", "aceleracion", "trayectoria", "temperatura", "campo_electrico", "campo_magnetico"]
            });
            this.seleccionarElemento("sensor", sNuevo.id);
          }
          this._notificarCambioGrafo();
          this.seleccionarHerramienta("select");
        }
      }

      // Herramienta 'multiefecto' (Asignar carga eléctrica, imán o fuente térmica a un nodo)
      else if (this.herramientaActiva === "multiefecto") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, radioHitNodo);
        if (nodo) {
          nodo.imanDipolo = (nodo.imanDipolo || 0) + 10.0;
          nodo.cargaElectrica = (nodo.cargaElectrica || 0) + 5.0;
          nodo.temperaturaFuente = Math.max(80.0, (nodo.temperaturaFuente || 25.0) + 25.0);
          this.seleccionarElemento("nodo", nodo.id);
          this._notificarCambioGrafo();
          this.seleccionarHerramienta("select");
        }
      }
    };

    const moverInteraccion = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const mundo = this.pantallaAMundo(px, py);

      if (this.dom.overlayCoords) {
        this.dom.overlayCoords.textContent = `X: ${mundo.x.toFixed(1)} | Y: ${mundo.y.toFixed(1)} | ${Math.round(this.viewport.zoom * 31.25)}%`;
      }

      if (this.viewport.arrastrandoPan) {
        const dx = (px - this.viewport.panInicioX) / this.viewport.zoom;
        const dy = (py - this.viewport.panInicioY) / this.viewport.zoom;
        this.viewport.centroX -= dx;
        this.viewport.centroY += dy;
        this.viewport.panInicioX = px;
        this.viewport.panInicioY = py;
        this.redibujar();
        return;
      }

      if (arrastrandoNodo) {
        arrastrandoNodo.x = parseFloat(mundo.x.toFixed(1));
        arrastrandoNodo.y = parseFloat(mundo.y.toFixed(1));

        // 1. Coordenadas de nodo si tiene variables asociadas (con soporte de offset y escala)
        if (arrastrandoNodo.variableX) {
          const ox = arrastrandoNodo.offsetX || 0;
          const ex = arrastrandoNodo.escalaX || 1;
          const rawX = (arrastrandoNodo.x - ox) / ex;
          const valX = parseFloat((arrastrandoNodo.signoX !== undefined ? Math.abs(rawX) : rawX).toFixed(2));
          this.valoresVariables[arrastrandoNodo.variableX] = valX;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: arrastrandoNodo.variableX, valor: valX });
          }
        }
        if (arrastrandoNodo.variableY) {
          const oy = arrastrandoNodo.offsetY || 0;
          const ey = arrastrandoNodo.escalaY || 1;
          const rawY = (arrastrandoNodo.y - oy) / ey;
          const valY = parseFloat((arrastrandoNodo.signoY !== undefined ? Math.abs(rawY) : rawY).toFixed(2));
          this.valoresVariables[arrastrandoNodo.variableY] = valY;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: arrastrandoNodo.variableY, valor: valY });
          }
        }

        // 2. Actualiza longitudes de todas las barras conectadas a este nodo y sus variables asociadas
        this.grafo.barras.forEach(b => {
          if (b.nodoA === arrastrandoNodo.id || b.nodoB === arrastrandoNodo.id) {
            const nA = this.grafo.nodos.find(n => n.id === b.nodoA);
            const nB = this.grafo.nodos.find(n => n.id === b.nodoB);
            if (nA && nB) {
              const nuevaLong = parseFloat(Math.hypot(nA.x - nB.x, nA.y - nB.y).toFixed(1));
              b.longitud = nuevaLong;

              const varNom = b.variableAsociada || b.longitudVinculada;
              if (varNom) {
                this.valoresVariables[varNom] = nuevaLong;
                if (typeof this.onVariableModificada === "function") {
                  this.onVariableModificada({ nombre: varNom, valor: nuevaLong });
                }
              }
            }
          }
        });

        // 3. Motores conectados al nodo (ej. manivela motriz K)
        this.grafo.motores?.forEach(m => {
          if (m.tipo === "rotativo" && (m.nodoExtremo === arrastrandoNodo.id || m.nodoPivote === arrastrandoNodo.id)) {
            const piv = this.grafo.nodos.find(n => n.id === m.nodoPivote);
            const ext = this.grafo.nodos.find(n => n.id === m.nodoExtremo);
            if (piv && ext) {
              const nuevoRadio = parseFloat(Math.hypot(ext.x - piv.x, ext.y - piv.y).toFixed(1));
              m.longitudManivela = nuevoRadio;
              const varNom = m.variableAsociada || m.amplitudVinculada;
              if (varNom) {
                this.valoresVariables[varNom] = nuevoRadio;
                if (typeof this.onVariableModificada === "function") {
                  this.onVariableModificada({ nombre: varNom, valor: nuevoRadio });
                }
              }
            }
          }
        });

        this._nodoArrastradoActivo = arrastrandoNodo;
        this._actualizarInspector();
        this._actualizarPanelVariablesVinculadas();
        this._ejecutarSimulacionEnLienzo();
        this.redibujar();
      }
    };

    const finInteraccion = () => {
      if (arrastrandoNodo) {
        arrastrandoNodo = null;
        this._nodoArrastradoActivo = null;
        this._notificarCambioGrafo();
      }
      this.viewport.arrastrandoPan = false;
      pinchEstado = null;
    };

    canvas.addEventListener("mousedown", (e) => iniciarInteraccion(e.clientX, e.clientY, e.button, false));
    canvas.addEventListener("mousemove", (e) => moverInteraccion(e.clientX, e.clientY));
    canvas.addEventListener("mouseup", finInteraccion);
    canvas.addEventListener("mouseleave", finInteraccion);
    canvas.addEventListener("dblclick", () => {
      this.autoEncuadrar();
      this.redibujar();
    });

    // Eventos multitáctiles (1 dedo = arrastrar nodo o panear, 2 dedos = Pinch-to-Zoom + Pan, Doble Tap = Auto-encuadrar)
    canvas.addEventListener("touchstart", (e) => {
      if (!e.touches) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        arrastrandoNodo = null;
        this._nodoArrastradoActivo = null;
        this.viewport.arrastrandoPan = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const rect = canvas.getBoundingClientRect();
        pinchEstado = {
          distInicial: Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)),
          zoomInicial: this.viewport.zoom,
          midX: ((t1.clientX + t2.clientX) / 2) - rect.left,
          midY: ((t1.clientY + t2.clientY) / 2) - rect.top
        };
        return;
      }

      if (e.touches.length === 1) {
        const ahora = Date.now();
        const t = e.touches[0];
        if (ahora - ultimoTapMs < 280 && this.herramientaActiva === "select") {
          e.preventDefault();
          vibrarTactil(15);
          this.autoEncuadrar();
          this.redibujar();
          ultimoTapMs = 0;
          return;
        }
        ultimoTapMs = ahora;
        iniciarInteraccion(t.clientX, t.clientY, 0, true);
        if (arrastrandoNodo || this.viewport.arrastrandoPan || this.herramientaActiva !== "select") {
          e.preventDefault();
        }
      }
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
      if (!e.touches) return;
      if (e.touches.length === 2 && pinchEstado) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const rect = canvas.getBoundingClientRect();
        const distActual = Math.max(10, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        const midXActual = ((t1.clientX + t2.clientX) / 2) - rect.left;
        const midYActual = ((t1.clientY + t2.clientY) / 2) - rect.top;

        const nuevoZoom = Math.max(0.5, Math.min(12.0, pinchEstado.zoomInicial * (distActual / pinchEstado.distInicial)));
        const dx = (midXActual - pinchEstado.midX) / nuevoZoom;
        const dy = (midYActual - pinchEstado.midY) / nuevoZoom;
        this.viewport.centroX -= dx;
        this.viewport.centroY += dy;
        this.viewport.zoom = nuevoZoom;
        pinchEstado.midX = midXActual;
        pinchEstado.midY = midYActual;
        if (this.dom.overlayCoords) {
          this.dom.overlayCoords.textContent = `Zoom: ${Math.round(this.viewport.zoom * 31.25)}% (Pinch 2 dedos)`;
        }
        this.redibujar();
        return;
      }

      if (e.touches.length === 1 && !pinchEstado) {
        if (arrastrandoNodo || this.viewport.arrastrandoPan) {
          e.preventDefault();
        }
        const t = e.touches[0];
        moverInteraccion(t.clientX, t.clientY);
      }
    }, { passive: false });

    canvas.addEventListener("touchend", finInteraccion);
    canvas.addEventListener("touchcancel", finInteraccion);

    // Zoom con rueda del ratón centrado
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 0.85;
      this.viewport.zoom = Math.max(0.4, Math.min(12.0, this.viewport.zoom * delta));
      this.redibujar();
    }, { passive: false });
  }

  // Inicia el bucle de animación continua del ángulo theta para previsualizar el ciclo del mecanismo
  _iniciarBucleAnimacion() {
    this.detener();
    const step = () => {
      if (!this.animando) return;
      this.thetaActual = (this.thetaActual + 0.04) % (2 * Math.PI);
      sincronizarPosicionesNodosGrafo(this.grafo, this.valoresVariables, this.thetaActual);
      this.redibujar();
      this.animId = requestAnimationFrame(step);
    };
    this.animId = requestAnimationFrame(step);
  }

  // Activa una herramienta de la paleta
  seleccionarHerramienta(tool) {
    this.herramientaActiva = tool;
    this.nodoInicioConexion = null;
    if (tool !== "cuerpo") this.nodosCuerpoTemporal = [];

    this.dom.botonesTool.forEach(btn => {
      const activo = btn.dataset.tool === tool;
      btn.style.background = activo ? "var(--md-sys-color-primary, #3b82f6)" : "";
      btn.style.color = activo ? "#ffffff" : "";
      btn.style.fontWeight = activo ? "700" : "normal";
    });

    if (this.dom.canvas) {
      if (tool === "select") this.dom.canvas.style.cursor = "default";
      else this.dom.canvas.style.cursor = "crosshair";
    }
  }

  // Selecciona un elemento del grafo y actualiza el inspector lateral
  seleccionarElemento(tipo, id) {
    this.elementoSeleccionado = tipo ? { tipo, id } : null;
    this._actualizarInspector();
  }

  // Notifica cambios al callback externo y sincroniza DOF, variables e inspector
  _notificarCambioGrafo() {
    this._actualizarIndicadorDOF();
    this._ejecutarSimulacionEnLienzo();
    this._actualizarInspector();
    this._actualizarPanelVariablesVinculadas();
    this.redibujar();

    if (typeof this.onGrafoModificado === "function") {
      this.onGrafoModificado(this.grafo);
    }
  }

  // Actualiza el panel lateral de Variables / Cotas Vinculadas para ver y editar sus valores en tiempo real
  _actualizarPanelVariablesVinculadas() {
    if (!this.dom.listaVariablesVivas) return;

    const mapaVars = new Map();
    // 1. Nodos con variables de coordenada (ej. a, l)
    (this.grafo.nodos || []).forEach(n => {
      if (n.variableX) {
        mapaVars.set(n.variableX, {
          nombre: n.variableX,
          valor: parseFloat(Math.abs(n.x).toFixed(2)),
          origen: `Nodo ${n.id}`
        });
      }
      if (n.variableY) {
        mapaVars.set(n.variableY, {
          nombre: n.variableY,
          valor: parseFloat(Math.abs(n.y).toFixed(2)),
          origen: `Nodo ${n.id}`
        });
      }
    });
    // 2. Barras con variable asociada (ej. b..k)
    (this.grafo.barras || []).forEach(b => {
      const vn = b.variableAsociada || b.longitudVinculada;
      if (vn) {
        mapaVars.set(vn, {
          nombre: vn,
          valor: parseFloat(Number(b.longitud).toFixed(2)),
          origen: b.nombre || b.id
        });
      }
    });
    // 3. Motores con variable asociada (ej. m, theta1..3)
    (this.grafo.motores || []).forEach(m => {
      const vn = m.variableAsociada || m.amplitudVinculada;
      if (vn) {
        const valM = this.valoresVariables[vn] !== undefined ? Number(this.valoresVariables[vn]) : (m.longitudManivela || 15);
        mapaVars.set(vn, {
          nombre: vn,
          valor: parseFloat(valM.toFixed(2)),
          origen: m.nombre || m.id
        });
      }
    });

    if (this.dom.conteoVars) {
      this.dom.conteoVars.textContent = `(${mapaVars.size})`;
    }

    if (mapaVars.size === 0) {
      this.dom.listaVariablesVivas.innerHTML = `<span style="color: #64748b; font-size: 0.72rem; grid-column: span 2;">Sin variables vinculadas.</span>`;
      return;
    }

    // Si los inputs ya existen para las mismas variables, solo actualiza sus valores numéricos para no perder foco
    const inputsExistentes = this.dom.listaVariablesVivas.querySelectorAll("input[data-cad-var]");
    if (inputsExistentes.length === mapaVars.size) {
      let todosCoinciden = true;
      inputsExistentes.forEach(inp => {
        const nom = inp.dataset.cadVar;
        if (!mapaVars.has(nom)) todosCoinciden = false;
      });
      if (todosCoinciden) {
        inputsExistentes.forEach(inp => {
          const nom = inp.dataset.cadVar;
          const info = mapaVars.get(nom);
          if (info && document.activeElement !== inp) {
            inp.value = info.valor;
          }
        });
        return;
      }
    }

    let html = "";
    mapaVars.forEach((info, nom) => {
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; background: var(--md-sys-color-surface-container-high, rgba(15,23,42,0.85)); border: 1px solid var(--md-sys-color-outline-variant, rgba(59,130,246,0.35)); border-radius: 8px; padding: 5px 8px;" title="${info.origen}">
          <span style="font-family: monospace; font-weight: 700; color: var(--md-sys-color-primary, #93c5fd); font-size: 0.88rem;">${nom}:</span>
          <input type="number" step="0.5" data-cad-var="${nom}" value="${info.valor}" style="width: 72px; min-height: 32px; background: var(--md-sys-color-surface-container-highest, #090d16); color: var(--md-sys-color-on-surface, #f8fafc); border: 1px solid var(--md-sys-color-outline, #334155); border-radius: 6px; padding: 3px 6px; font-family: monospace; font-size: 0.88rem; text-align: right;">
        </div>
      `;
    });
    this.dom.listaVariablesVivas.innerHTML = html;

    this.dom.listaVariablesVivas.querySelectorAll("input[data-cad-var]").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const nom = inp.dataset.cadVar;
        const nuevoVal = parseFloat(e.target.value);
        if (isNaN(nuevoVal) || nuevoVal <= 0) return;
        this.valoresVariables[nom] = nuevoVal;
        this.actualizarValoresVariables({ [nom]: nuevoVal });
        if (typeof this.onVariableModificada === "function") {
          this.onVariableModificada({ nombre: nom, valor: nuevoVal });
        }
      });
    });
  }

  // Actualiza el badge visual de Grados de Libertad (Criterio de Grübler-Kutzbach)
  _actualizarIndicadorDOF() {
    if (!this.dom.badgeDof) return;
    const analisis = analizarGradosLibertad(this.grafo);

    if (analisis.estado === "determinado") {
      this.dom.badgeDof.style.background = "rgba(16, 185, 129, 0.15)";
      this.dom.badgeDof.style.color = "#10b981";
      this.dom.badgeDof.style.borderColor = "rgba(16, 185, 129, 0.4)";
      this.dom.badgeDof.textContent = `⚙️ DOF: M = ${analisis.dof} (Determinado ✓)`;
    } else if (analisis.estado === "subrestringido") {
      this.dom.badgeDof.style.background = "rgba(245, 158, 11, 0.15)";
      this.dom.badgeDof.style.color = "#f59e0b";
      this.dom.badgeDof.style.borderColor = "rgba(245, 158, 11, 0.4)";
      this.dom.badgeDof.textContent = `⚠️ DOF: M = ${analisis.dof} (Requiere ${analisis.dof} Motores)`;
    } else {
      this.dom.badgeDof.style.background = "rgba(239, 68, 68, 0.15)";
      this.dom.badgeDof.style.color = "#ef4444";
      this.dom.badgeDof.style.borderColor = "rgba(239, 68, 68, 0.4)";
      this.dom.badgeDof.textContent = `🔒 DOF: M = ${analisis.dof} (Rígido/Sobrerrestringido)`;
    }
    this.dom.badgeDof.title = analisis.mensaje;
  }

  // Actualiza la insignia de Fitness evaluado en tiempo real en la barra superior del Editor CAD.
  actualizarFitnessEnVivo(resultadoFitness) {
    if (!this.dom?.badgeFitnessVivo) return;
    if (Array.isArray(resultadoFitness)) {
      const f1 = typeof resultadoFitness[0] === "number" ? resultadoFitness[0].toFixed(2) : resultadoFitness[0];
      const f2 = typeof resultadoFitness[1] === "number" ? resultadoFitness[1].toFixed(2) : resultadoFitness[1];
      this.dom.badgeFitnessVivo.textContent = `🎯 Pareto: [${f1}, ${f2}]`;
    } else if (typeof resultadoFitness === "number") {
      this.dom.badgeFitnessVivo.textContent = isFinite(resultadoFitness)
        ? `🎯 Fitness: ${resultadoFitness.toFixed(3)}`
        : "🎯 Fitness: Inválido";
    } else if (resultadoFitness !== undefined && resultadoFitness !== null) {
      this.dom.badgeFitnessVivo.textContent = `🎯 Fitness: ${resultadoFitness}`;
    }
  }

  // Actualiza el panel inspector lateral de propiedades
  _actualizarInspector() {
    if (!this.dom.inspectorContenido || !this.dom.inspectorTipoTag) return;

    // Actualiza telemetría multimagnitud de sensores en el pie del inspector
    if (this.dom.conteoSensores) {
      this.dom.conteoSensores.textContent = `(${this.grafo.sensores.length})`;
    }
    if (this.dom.listaSensores) {
      if (this.grafo.sensores.length === 0) {
        this.dom.listaSensores.innerHTML = `<span style="color: #64748b;">No hay sensores definidos.</span>`;
      } else {
        let htmlSensores = "";
        this.grafo.sensores.forEach(s => {
          const tele = this.telemetriaSensores[s.nombre] || {};
          const zanc = tele.zancada !== undefined ? `Zanc: ${tele.zancada.toFixed(1)}mm` : "";
          const vel = tele.velocidadMax !== undefined ? ` | V: ${tele.velocidadMax.toFixed(1)}` : "";
          const acel = tele.aceleracionPico !== undefined ? ` | A: ${tele.aceleracionPico.toFixed(1)}` : "";
          const temp = tele.temperatura && tele.temperatura > 25.1 ? ` | T: ${tele.temperatura.toFixed(0)}°C` : "";
          const em = tele.campoMagnetico && tele.campoMagnetico > 0.01 ? ` | Bz: ${tele.campoMagnetico.toFixed(1)}` : "";
          htmlSensores += `
            <div data-sensor-id="${s.id}" style="background: rgba(30,41,59,0.55); padding: 0.32rem 0.45rem; border-radius: 4px; border-left: 3px solid ${s.color || '#f59e0b'}; cursor: pointer;" title="Clic para configurar magnitudes del sensor">
              <div style="font-weight: 700; color: #f8fafc;">🎯 ${s.nombre} (${s.nodoId})</div>
              <div style="color: #94a3b8; font-family: monospace; font-size: 0.68rem;">${zanc}${vel}${acel}${temp}${em}</div>
            </div>
          `;
        });
        this.dom.listaSensores.innerHTML = htmlSensores;
        this.dom.listaSensores.querySelectorAll("[data-sensor-id]").forEach(el => {
          el.addEventListener("click", () => {
            this.seleccionarElemento("sensor", el.dataset.sensorId);
          });
        });
      }
    }

    if (!this.elementoSeleccionado) {
      this.dom.inspectorTipoTag.textContent = "Ninguno";
      this._inspectorIdActual = null;
      this.dom.inspectorContenido.innerHTML = `
        <div style="padding: 0.75rem 0.4rem; text-align: center; color: #94a3b8; font-size: 0.75rem; background: rgba(30,41,59,0.35); border-radius: 6px;">
          Haga clic en un <strong>nodo</strong>, <strong>barra</strong>, <strong>motor</strong>, <strong>engranaje/polea</strong> o <strong>sensor</strong> para editar sus cotas o vincularlo a variables.
        </div>
      `;
      return;
    }

    const { tipo, id } = this.elementoSeleccionado;
    this.dom.inspectorTipoTag.textContent = tipo.toUpperCase();

    // Inspector para Nodo
    if (tipo === "nodo") {
      const nodo = this.grafo.nodos.find(n => n.id === id);
      if (!nodo) return;

      const inpXExistente = this.dom.inspectorContenido.querySelector("#insp-nodo-x");
      const inpYExistente = this.dom.inspectorContenido.querySelector("#insp-nodo-y");
      if (inpXExistente && inpYExistente && this._inspectorIdActual === id) {
        if (document.activeElement !== inpXExistente) inpXExistente.value = nodo.x;
        if (document.activeElement !== inpYExistente) inpYExistente.value = nodo.y;
        return;
      }
      this._inspectorIdActual = id;

      this.dom.inspectorContenido.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div>
            <label style="font-size: 0.7rem; color: #94a3b8;">Nombre de la Articulación</label>
            <input type="text" id="insp-nodo-nom" value="${nodo.nombre}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">X (mm) ${nodo.variableX ? `[${nodo.variableX}]` : ""}</label>
              <input type="number" id="insp-nodo-x" step="any" value="${nodo.x}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Y (mm) ${nodo.variableY ? `[${nodo.variableY}]` : ""}</label>
              <input type="number" id="insp-nodo-y" step="any" value="${nodo.y}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Tipo de Unión</label>
              <select id="insp-nodo-tipo" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
                <option value="fijo" ${nodo.tipo === "fijo" ? "selected" : ""}>⚓ Fijo (Bancada)</option>
                <option value="libre" ${nodo.tipo === "libre" ? "selected" : ""}>⚪ Bisagra Libre</option>
                <option value="deslizante" ${nodo.tipo === "deslizante" ? "selected" : ""}>🛤️ Corredera Lineal</option>
              </select>
            </div>
            <div style="width: 85px;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Guía (°)</label>
              <input type="number" id="insp-nodo-guia" step="any" value="${nodo.anguloGuia || 0}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div style="border-top: 1px solid #334155; padding-top: 0.4rem; display: flex; gap: 0.35rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: #94a3b8;">🧲 Imán (Bz)</label>
              <input type="number" id="insp-nodo-iman" step="any" value="${nodo.imanDipolo || 0}" style="width: 100%; padding: 0.22rem 0.3rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: #94a3b8;">⚡ Carga (q)</label>
              <input type="number" id="insp-nodo-carga" step="any" value="${nodo.cargaElectrica || 0}" style="width: 100%; padding: 0.22rem 0.3rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.68rem; color: #94a3b8;">🔥 Temp (°C)</label>
              <input type="number" id="insp-nodo-temp" step="any" value="${nodo.temperaturaFuente || 25}" style="width: 100%; padding: 0.22rem 0.3rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
          </div>
          <button type="button" id="insp-nodo-borrar" style="margin-top: 0.25rem; padding: 0.3rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; font-size: 0.74rem;">
            🗑️ Eliminar Nodo
          </button>
        </div>
      `;

      this.dom.inspectorContenido.querySelector("#insp-nodo-nom")?.addEventListener("input", (e) => {
        nodo.nombre = e.target.value;
        this.redibujar();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-x")?.addEventListener("input", (e) => {
        nodo.x = parseFloat(e.target.value) || 0;
        if (nodo.variableX) {
          const valX = parseFloat(Math.abs(nodo.x).toFixed(1));
          this.valoresVariables[nodo.variableX] = valX;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: nodo.variableX, valor: valX });
          }
        }
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-y")?.addEventListener("input", (e) => {
        nodo.y = parseFloat(e.target.value) || 0;
        if (nodo.variableY) {
          const valY = parseFloat(Math.abs(nodo.y).toFixed(1));
          this.valoresVariables[nodo.variableY] = valY;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: nodo.variableY, valor: valY });
          }
        }
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-tipo")?.addEventListener("change", (e) => {
        nodo.tipo = e.target.value;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-guia")?.addEventListener("input", (e) => {
        nodo.anguloGuia = parseFloat(e.target.value) || 0;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-iman")?.addEventListener("input", (e) => {
        nodo.imanDipolo = parseFloat(e.target.value) || 0;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-carga")?.addEventListener("input", (e) => {
        nodo.cargaElectrica = parseFloat(e.target.value) || 0;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-temp")?.addEventListener("input", (e) => {
        nodo.temperaturaFuente = parseFloat(e.target.value) || 25;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-nodo-borrar")?.addEventListener("click", () => {
        this.grafo.nodos = this.grafo.nodos.filter(n => n.id !== id);
        this.grafo.barras = this.grafo.barras.filter(b => b.nodoA !== id && b.nodoB !== id);
        this.grafo.sensores = this.grafo.sensores.filter(s => s.nodoId !== id);
        this.seleccionarElemento(null, null);
        this._notificarCambioGrafo();
      });
    }

    // Inspector para Barra
    else if (tipo === "barra") {
      const barra = this.grafo.barras.find(b => b.id === id);
      if (!barra) return;

      const inpLongExistente = this.dom.inspectorContenido.querySelector("#insp-barra-long");
      const inpSliderExistente = this.dom.inspectorContenido.querySelector("#insp-barra-slider");
      if (inpLongExistente && this._inspectorIdActual === id) {
        if (document.activeElement !== inpLongExistente) inpLongExistente.value = barra.longitud;
        if (inpSliderExistente && document.activeElement !== inpSliderExistente) inpSliderExistente.value = barra.longitud;
        return;
      }
      this._inspectorIdActual = id;
      const maxSlider = Math.max(150, Math.ceil((barra.longitud || 40) * 1.8));

      this.dom.inspectorContenido.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
          <div>
            <label style="font-size: 0.84rem; color: #cbd5e1; font-weight: 600;">Nombre del Eslabón</label>
            <input type="text" id="insp-barra-nom" value="${barra.nombre}" style="width: 100%; min-height: 38px; padding: 0.35rem 0.5rem; font-size: 0.92rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff;">
          </div>
          <div>
            <label style="font-size: 0.84rem; color: #cbd5e1; font-weight: 600;">Longitud (mm)</label>
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
              <button type="button" id="insp-barra-menos" class="btn-m3-tonal" style="min-width: 38px; min-height: 38px; padding: 0; font-size: 1.05rem; font-weight: 700;">-1</button>
              <input type="number" id="insp-barra-long" step="any" value="${barra.longitud}" style="flex: 1; min-height: 38px; padding: 0.35rem 0.5rem; font-size: 0.95rem; font-family: monospace; text-align: center; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff;">
              <button type="button" id="insp-barra-mas" class="btn-m3-tonal" style="min-width: 38px; min-height: 38px; padding: 0; font-size: 1.05rem; font-weight: 700;">+1</button>
            </div>
            <input type="range" id="insp-barra-slider" min="2" max="${maxSlider}" step="0.5" value="${barra.longitud}" style="width: 100%; height: 28px; margin-top: 0.35rem; accent-color: var(--md-sys-color-primary, #7bd0ff); cursor: pointer;">
          </div>
          
          <!-- Vinculación con variable de optimización -->
          <div style="background: rgba(59, 130, 246, 0.1); padding: 0.55rem; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
            <div style="font-weight: 700; color: #60a5fa; font-size: 0.84rem; margin-bottom: 0.3rem;">⚡ Variable de Decisión Vinculada</div>
            <input type="text" id="insp-barra-var" value="${barra.variableAsociada || ""}" placeholder="Ej: b, j, radio..." style="width: 100%; min-height: 38px; padding: 0.35rem 0.5rem; font-size: 0.9rem; background: #0f172a; border: 1px solid #3b82f6; border-radius: 6px; color: #fff; font-family: monospace;">
            <button type="button" id="insp-barra-vincular" class="btn-m3-filled" style="width: 100%; min-height: 38px; margin-top: 0.45rem; padding: 0.4rem; font-size: 0.86rem;">
              Asociar a Variables de Algoritmo
            </button>
          </div>

          <button type="button" id="insp-barra-borrar" style="margin-top: 0.25rem; min-height: 38px; padding: 0.4rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer; font-size: 0.86rem; font-weight: 600;">
            🗑️ Eliminar Barra
          </button>
        </div>
      `;

      const aplicarLongitudBarra = (nuevaLong) => {
        if (!isFinite(nuevaLong) || nuevaLong <= 0.5) return;
        barra.longitud = parseFloat(nuevaLong.toFixed(2));
        const inpL = this.dom.inspectorContenido.querySelector("#insp-barra-long");
        const inpS = this.dom.inspectorContenido.querySelector("#insp-barra-slider");
        if (inpL && document.activeElement !== inpL) inpL.value = barra.longitud;
        if (inpS && document.activeElement !== inpS) inpS.value = barra.longitud;
        const varNom = barra.variableAsociada || barra.longitudVinculada;
        if (varNom) {
          this.valoresVariables[varNom] = barra.longitud;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: varNom, valor: barra.longitud });
          }
        }
        sincronizarPosicionesNodosGrafo(this.grafo, this.valoresVariables, this.thetaActual);
        this._notificarCambioGrafo();
      };

      this.dom.inspectorContenido.querySelector("#insp-barra-nom")?.addEventListener("input", (e) => {
        barra.nombre = e.target.value;
        this.redibujar();
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-long")?.addEventListener("input", (e) => {
        aplicarLongitudBarra(parseFloat(e.target.value));
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-slider")?.addEventListener("input", (e) => {
        aplicarLongitudBarra(parseFloat(e.target.value));
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-menos")?.addEventListener("click", () => {
        aplicarLongitudBarra((Number(barra.longitud) || 10) - 1);
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-mas")?.addEventListener("click", () => {
        aplicarLongitudBarra((Number(barra.longitud) || 10) + 1);
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-var")?.addEventListener("input", (e) => {
        barra.variableAsociada = e.target.value.trim() || null;
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-vincular")?.addEventListener("click", () => {
        const varName = (this.dom.inspectorContenido.querySelector("#insp-barra-var")?.value || "").trim();
        if (varName) {
          barra.variableAsociada = varName;
          if (typeof this.onVariableVinculada === "function") {
            this.onVariableVinculada({
              nombre: varName,
              etiqueta: `${varName}: Longitud de ${barra.nombre}`,
              tipo: "continuo",
              min: parseFloat((barra.longitud * 0.7).toFixed(1)),
              max: parseFloat((barra.longitud * 1.3).toFixed(1)),
              valorNominal: barra.longitud
            });
          }
          this._actualizarPanelVariablesVinculadas();
        }
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-borrar")?.addEventListener("click", () => {
        this.grafo.barras = this.grafo.barras.filter(b => b.id !== id);
        this.seleccionarElemento(null, null);
        this._notificarCambioGrafo();
      });
    }

    // Inspector para Motor (Rotativo o Lineal)
    else if (tipo === "motor") {
      const motor = (this.grafo.motores || []).find(m => m.id === id);
      if (!motor) return;
      this._inspectorIdActual = id;

      this.dom.inspectorContenido.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div>
            <label style="font-size: 0.7rem; color: #94a3b8;">Nombre del Actuador</label>
            <input type="text" id="insp-motor-nom" value="${motor.nombre}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Tipo</label>
              <select id="insp-motor-tipo" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
                <option value="rotativo" ${motor.tipo === "rotativo" ? "selected" : ""}>🔄 Rotativo (Manivela)</option>
                <option value="lineal" ${motor.tipo === "lineal" ? "selected" : ""}>↔️ Lineal (Pistón)</option>
              </select>
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Radio / Carrera (mm)</label>
              <input type="number" id="insp-motor-radio" step="any" value="${motor.longitudManivela || 15}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Vel. Angular (ω)</label>
              <input type="number" id="insp-motor-vel" step="0.1" value="${motor.velocidadAngular || 1.0}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Variable Asociada</label>
              <input type="text" id="insp-motor-var" value="${motor.variableAsociada || ""}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff; font-family: monospace;">
            </div>
          </div>
          <button type="button" id="insp-motor-borrar" style="margin-top: 0.25rem; padding: 0.3rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; font-size: 0.74rem;">
            🗑️ Eliminar Motor
          </button>
        </div>
      `;

      this.dom.inspectorContenido.querySelector("#insp-motor-nom")?.addEventListener("input", (e) => {
        motor.nombre = e.target.value;
        this.redibujar();
      });
      this.dom.inspectorContenido.querySelector("#insp-motor-tipo")?.addEventListener("change", (e) => {
        motor.tipo = e.target.value;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-motor-radio")?.addEventListener("input", (e) => {
        motor.longitudManivela = parseFloat(e.target.value) || 15;
        if (motor.variableAsociada) {
          this.valoresVariables[motor.variableAsociada] = motor.longitudManivela;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: motor.variableAsociada, valor: motor.longitudManivela });
          }
        }
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-motor-vel")?.addEventListener("input", (e) => {
        motor.velocidadAngular = parseFloat(e.target.value) || 1.0;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-motor-var")?.addEventListener("input", (e) => {
        motor.variableAsociada = e.target.value.trim() || null;
        this._actualizarPanelVariablesVinculadas();
      });
      this.dom.inspectorContenido.querySelector("#insp-motor-borrar")?.addEventListener("click", () => {
        this.grafo.motores = this.grafo.motores.filter(m => m.id !== id);
        this.seleccionarElemento(null, null);
        this._notificarCambioGrafo();
      });
    }

    // Inspector para Transmisión (Engranaje / Polea)
    else if (tipo === "transmision") {
      const tr = (this.grafo.transmisiones || []).find(t => t.id === id);
      if (!tr) return;
      this._inspectorIdActual = id;

      this.dom.inspectorContenido.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div>
            <label style="font-size: 0.7rem; color: #94a3b8;">Tipo de Transmisión</label>
            <select id="insp-tr-tipo" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
              <option value="engranaje" ${tr.tipo === "engranaje" ? "selected" : ""}>⚙️ Par de Engranajes</option>
              <option value="polea" ${tr.tipo === "polea" ? "selected" : ""}>🪢 Poleas con Correa</option>
            </select>
          </div>
          <div style="display: flex; gap: 0.4rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Radio 1 (mm)</label>
              <input type="number" id="insp-tr-r1" step="any" value="${tr.radio1 || 15}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.7rem; color: #94a3b8;">Radio 2 (mm)</label>
              <input type="number" id="insp-tr-r2" step="any" value="${tr.radio2 || 25}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div style="font-size: 0.72rem; color: #93c5fd; font-family: monospace;">
            Relación i = r₁/r₂ = ${((tr.radio1 || 15) / Math.max(1, tr.radio2 || 25)).toFixed(3)}
          </div>
          <button type="button" id="insp-tr-borrar" style="margin-top: 0.25rem; padding: 0.3rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; font-size: 0.74rem;">
            🗑️ Eliminar Transmisión
          </button>
        </div>
      `;

      this.dom.inspectorContenido.querySelector("#insp-tr-tipo")?.addEventListener("change", (e) => {
        tr.tipo = e.target.value;
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-tr-r1")?.addEventListener("input", (e) => {
        tr.radio1 = parseFloat(e.target.value) || 10;
        tr.relacion = tr.radio1 / Math.max(1, tr.radio2 || 10);
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-tr-r2")?.addEventListener("input", (e) => {
        tr.radio2 = parseFloat(e.target.value) || 10;
        tr.relacion = (tr.radio1 || 10) / Math.max(1, tr.radio2);
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelector("#insp-tr-borrar")?.addEventListener("click", () => {
        this.grafo.transmisiones = this.grafo.transmisiones.filter(t => t.id !== id);
        this.seleccionarElemento(null, null);
        this._notificarCambioGrafo();
      });
    }

    // Inspector para Sensor Multimagnitud
    else if (tipo === "sensor") {
      const sensor = (this.grafo.sensores || []).find(s => s.id === id);
      if (!sensor) return;
      this._inspectorIdActual = id;

      const mags = new Set(sensor.magnitudes || ["posicion", "velocidad", "aceleracion", "trayectoria"]);
      const listaMags = [
        { k: "posicion", lbl: "📍 Posición (x, y)" },
        { k: "velocidad", lbl: "💨 Velocidad" },
        { k: "aceleracion", lbl: "🚀 Aceleración" },
        { k: "trayectoria", lbl: "〰️ Trayectoria / Zancada" },
        { k: "temperatura", lbl: "🔥 Temperatura (°C)" },
        { k: "campo_electrico", lbl: "⚡ Campo Eléctrico |E|" },
        { k: "campo_magnetico", lbl: "🧲 Campo Magnético Bz" }
      ];

      this.dom.inspectorContenido.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.45rem;">
          <div>
            <label style="font-size: 0.7rem; color: #94a3b8;">Identificador del Sensor (en <code>sensores.*</code>)</label>
            <input type="text" id="insp-sensor-nom" value="${sensor.nombre}" style="width: 100%; padding: 0.25rem 0.35rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff; font-family: monospace;">
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.2rem;">Magnitudes Físicas a Sensar:</div>
          <div style="display: flex; flex-direction: column; gap: 3px; background: rgba(15,23,42,0.6); padding: 0.4rem; border-radius: 4px; border: 1px solid #334155;">
            ${listaMags.map(m => `
              <label style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; cursor: pointer;">
                <input type="checkbox" class="chk-sensor-mag" value="${m.k}" ${mags.has(m.k) ? "checked" : ""}>
                <span>${m.lbl}</span>
              </label>
            `).join("")}
          </div>
          <button type="button" id="insp-sensor-borrar" style="margin-top: 0.25rem; padding: 0.3rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; font-size: 0.74rem;">
            🗑️ Eliminar Sensor
          </button>
        </div>
      `;

      this.dom.inspectorContenido.querySelector("#insp-sensor-nom")?.addEventListener("input", (e) => {
        sensor.nombre = e.target.value.trim() || "sensor";
        this._notificarCambioGrafo();
      });
      this.dom.inspectorContenido.querySelectorAll(".chk-sensor-mag").forEach(chk => {
        chk.addEventListener("change", () => {
          const seleccionadas = [];
          this.dom.inspectorContenido.querySelectorAll(".chk-sensor-mag:checked").forEach(c => seleccionadas.push(c.value));
          sensor.magnitudes = seleccionadas;
          this._notificarCambioGrafo();
        });
      });
      this.dom.inspectorContenido.querySelector("#insp-sensor-borrar")?.addEventListener("click", () => {
        this.grafo.sensores = this.grafo.sensores.filter(s => s.id !== id);
        this.seleccionarElemento(null, null);
        this._notificarCambioGrafo();
      });
    }
  }

  // Ejecuta la simulación temporal del mecanismo y actualiza telemetría de sensores
  _ejecutarSimulacionEnLienzo() {
    try {
      const res = simularCicloMecanismo(this.grafo, this.valoresVariables, { pasos: 120 });
      this.telemetriaSensores = res.sensores || {};
    } catch (e) {
      console.warn("[EditorGraficoView] Advertencia en cinemática:", e);
    }
  }

  // Convierte coordenadas de pantalla (píxeles) a coordenadas métricas del mundo (mm)
  pantallaAMundo(px, py) {
    const { w, h } = this._obtenerDimensionesLienzo();
    return {
      x: this.viewport.centroX + (px - w / 2) / this.viewport.zoom,
      y: this.viewport.centroY - (py - h / 2) / this.viewport.zoom
    };
  }

  // Convierte coordenadas métricas del mundo a pantalla
  mundoAPantalla(x, y) {
    const { w, h } = this._obtenerDimensionesLienzo();
    return {
      x: w / 2 + (x - this.viewport.centroX) * this.viewport.zoom,
      y: h / 2 - (y - this.viewport.centroY) * this.viewport.zoom
    };
  }

  // Encuentra el nodo más cercano a las coordenadas dadas
  _encontrarNodoCercano(x, y, radioMax) {
    let cercano = null;
    let minDist = radioMax;
    this.grafo.nodos.forEach(n => {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < minDist) {
        minDist = d;
        cercano = n;
      }
    });
    return cercano;
  }

  // Encuentra la barra más cercana a las coordenadas dadas
  _encontrarBarraCercana(x, y, radioMax) {
    let cercana = null;
    let minDist = radioMax;

    this.grafo.barras.forEach(b => {
      const nA = this.grafo.nodos.find(n => n.id === b.nodoA);
      const nB = this.grafo.nodos.find(n => n.id === b.nodoB);
      if (!nA || !nB) return;

      const d = this._distanciaPuntoASegmento(x, y, nA.x, nA.y, nB.x, nB.y);
      if (d < minDist) {
        minDist = d;
        cercana = b;
      }
    });

    return cercana;
  }

  // Encuentra un motor cercano a las coordenadas dadas
  _encontrarMotorCercano(x, y, radioMax) {
    let cercano = null;
    let minDist = radioMax;
    (this.grafo.motores || []).forEach(m => {
      const nPiv = this.grafo.nodos.find(n => n.id === m.nodoPivote);
      const nExt = this.grafo.nodos.find(n => n.id === m.nodoExtremo);
      if (!nPiv || !nExt) return;
      const d = this._distanciaPuntoASegmento(x, y, nPiv.x, nPiv.y, nExt.x, nExt.y);
      if (d < minDist) {
        minDist = d;
        cercano = m;
      }
    });
    return cercano;
  }

  // Encuentra una transmisión (engranaje o polea) cercana a las coordenadas dadas
  _encontrarTransmisionCercana(x, y, radioMax) {
    let cercana = null;
    let minDist = radioMax;
    (this.grafo.transmisiones || []).forEach(tr => {
      const n1 = this.grafo.nodos.find(n => n.id === tr.nodo1);
      const n2 = this.grafo.nodos.find(n => n.id === tr.nodo2);
      if (!n1 || !n2) return;
      const d = this._distanciaPuntoASegmento(x, y, n1.x, n1.y, n2.x, n2.y);
      if (d < minDist) {
        minDist = d;
        cercana = tr;
      }
    });
    return cercana;
  }

  // Calcula la distancia euclidiana mínima de un punto a un segmento
  _distanciaPuntoASegmento(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  // Redibuja el lienzo CAD completo
  redibujar() {
    const canvas = this.dom.canvas;
    const ctx = this.dom.ctx;
    if (!canvas || !ctx) return;

    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const { w: wCSS, h: hCSS } = this._obtenerDimensionesLienzo();
    const targetW = Math.round(wCSS * dpr);
    const targetH = Math.round(hCSS * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, wCSS, hCSS);

    // 1. Rejilla milimétrica CAD (Grid)
    this._dibujarRejilla(ctx, wCSS, hCSS);

    // 2. Ejes de coordenadas de origen (0, 0)
    const ptOrigen = this.mundoAPantalla(0, 0);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1;
    ctx.moveTo(0, ptOrigen.y);
    ctx.lineTo(wCSS, ptOrigen.y);
    ctx.moveTo(ptOrigen.x, 0);
    ctx.lineTo(ptOrigen.x, hCSS);
    ctx.stroke();

    // 3. Cuerpos rígidos poligonales
    this.grafo.cuerposRigidos.forEach(cr => {
      const pts = cr.nodos.map(nid => this.grafo.nodos.find(n => n.id === nid)).filter(Boolean);
      if (pts.length >= 3) {
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const sc = this.mundoAPantalla(p.x, p.y);
          if (idx === 0) ctx.moveTo(sc.x, sc.y);
          else ctx.lineTo(sc.x, sc.y);
        });
        ctx.closePath();
        ctx.fillStyle = cr.color || "rgba(59, 130, 246, 0.12)";
        ctx.fill();
        ctx.strokeStyle = cr.bordeColor || "rgba(59, 130, 246, 0.4)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });

    // 4. Estelas y trayectorias de sensores activos
    for (const sNom in this.telemetriaSensores) {
      const sensorData = this.telemetriaSensores[sNom];
      if (sensorData.trayectoria && sensorData.trayectoria.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2.2;
        ctx.setLineDash([3, 3]);
        sensorData.trayectoria.forEach((pt, idx) => {
          const sc = this.mundoAPantalla(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(sc.x, sc.y);
          else ctx.lineTo(sc.x, sc.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 5. Barras / Eslabones conectores
    this.grafo.barras.forEach(b => {
      const nA = this.grafo.nodos.find(n => n.id === b.nodoA);
      const nB = this.grafo.nodos.find(n => n.id === b.nodoB);
      if (!nA || !nB) return;

      const pA = this.mundoAPantalla(nA.x, nA.y);
      const pB = this.mundoAPantalla(nB.x, nB.y);
      const esSel = this.elementoSeleccionado?.tipo === "barra" && this.elementoSeleccionado?.id === b.id;
      const estaConectadaAArrastre = this._nodoArrastradoActivo && (b.nodoA === this._nodoArrastradoActivo.id || b.nodoB === this._nodoArrastradoActivo.id);

      // Barra con aspecto de ingeniería / viga (escalado adaptable para nitidez en móvil)
      const esMovilCanvas = wCSS < 640;
      ctx.beginPath();
      ctx.strokeStyle = estaConectadaAArrastre ? "#06b6d4" : (esSel ? "#38bdf8" : (b.color || "#3b82f6"));
      ctx.lineWidth = estaConectadaAArrastre ? (esMovilCanvas ? 5.2 : 4.0) : (esSel ? (esMovilCanvas ? 5.5 : 4.5) : (esMovilCanvas ? 3.4 : (b.grosor || 2.5)));
      ctx.lineCap = "round";
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();

      // Cotas y etiqueta sobre la barra (legibles en pantallas móviles)
      const mx = (pA.x + pB.x) / 2;
      const my = (pA.y + pB.y) / 2;
      const texto = b.variableAsociada ? `${b.variableAsociada}: ${b.longitud.toFixed(1)}` : `${b.longitud.toFixed(1)}`;
      ctx.font = estaConectadaAArrastre
        ? (esMovilCanvas ? "bold 12px monospace" : "bold 10px monospace")
        : (esMovilCanvas ? "bold 11px system-ui" : "bold 9px system-ui");
      const tw = ctx.measureText(texto).width + (esMovilCanvas ? 12 : (estaConectadaAArrastre ? 12 : 8));
      const th = esMovilCanvas ? 20 : 16;
      ctx.fillStyle = estaConectadaAArrastre ? "rgba(6, 182, 212, 0.95)" : "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2, my - th / 2, tw, th, 5);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(texto, mx, my);
    });

    // 6. Actuadores / Motores (rotativos y lineales) y Transmisiones (engranajes y poleas)
    (this.grafo.transmisiones || []).forEach(tr => {
      const n1 = this.grafo.nodos.find(n => n.id === tr.nodo1);
      const n2 = this.grafo.nodos.find(n => n.id === tr.nodo2);
      if (!n1 || !n2) return;
      const p1 = this.mundoAPantalla(n1.x, n1.y);
      const p2 = this.mundoAPantalla(n2.x, n2.y);
      const r1Pix = (tr.radio1 || 15) * this.viewport.zoom;
      const r2Pix = (tr.radio2 || 20) * this.viewport.zoom;
      const esSel = this.elementoSeleccionado?.tipo === "transmision" && this.elementoSeleccionado?.id === tr.id;

      if (tr.tipo === "engranaje") {
        // Ruedas dentadas primitivas
        [ { p: p1, r: r1Pix }, { p: p2, r: r2Pix } ].forEach(rueda => {
          ctx.beginPath();
          ctx.strokeStyle = esSel ? "#38bdf8" : "#a855f7";
          ctx.fillStyle = "rgba(168, 85, 247, 0.12)";
          ctx.lineWidth = esSel ? 2.5 : 1.8;
          ctx.setLineDash([4, 3]);
          ctx.arc(rueda.p.x, rueda.p.y, rueda.r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        });
      } else {
        // Poleas con correa de transmisión
        [ { p: p1, r: r1Pix }, { p: p2, r: r2Pix } ].forEach(rueda => {
          ctx.beginPath();
          ctx.strokeStyle = esSel ? "#38bdf8" : "#eab308";
          ctx.fillStyle = "rgba(234, 179, 8, 0.12)";
          ctx.lineWidth = esSel ? 2.5 : 1.8;
          ctx.arc(rueda.p.x, rueda.p.y, rueda.r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });
        // Líneas de correa
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2;
        ctx.beginPath();
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1.5;
        ctx.moveTo(p1.x + r1Pix * Math.cos(ang), p1.y + r1Pix * Math.sin(ang));
        ctx.lineTo(p2.x + r2Pix * Math.cos(ang), p2.y + r2Pix * Math.sin(ang));
        ctx.moveTo(p1.x - r1Pix * Math.cos(ang), p1.y - r1Pix * Math.sin(ang));
        ctx.lineTo(p2.x - r2Pix * Math.cos(ang), p2.y - r2Pix * Math.sin(ang));
        ctx.stroke();
      }
    });

    this.grafo.motores.forEach(m => {
      const piv = this.grafo.nodos.find(n => n.id === m.nodoPivote);
      const ext = this.grafo.nodos.find(n => n.id === m.nodoExtremo);
      if (!piv) return;
      const scPiv = this.mundoAPantalla(piv.x, piv.y);
      const esSel = this.elementoSeleccionado?.tipo === "motor" && this.elementoSeleccionado?.id === m.id;

      if (m.tipo === "rotativo") {
        const radioPix = (m.longitudManivela || 15) * this.viewport.zoom;
        // Círculo de giro de la manivela
        ctx.beginPath();
        ctx.strokeStyle = esSel ? "#38bdf8" : "rgba(239, 68, 68, 0.45)";
        ctx.lineWidth = esSel ? 2.2 : 1.3;
        ctx.setLineDash([4, 4]);
        ctx.arc(scPiv.x, scPiv.y, radioPix, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        if (ext) {
          const scExt = this.mundoAPantalla(ext.x, ext.y);
          ctx.beginPath();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 3.2;
          ctx.moveTo(scPiv.x, scPiv.y);
          ctx.lineTo(scExt.x, scExt.y);
          ctx.stroke();
        }
      } else if (m.tipo === "lineal" && ext) {
        const scExt = this.mundoAPantalla(ext.x, ext.y);
        // Dibujo de cilindro + vástago de motor lineal
        ctx.beginPath();
        ctx.strokeStyle = esSel ? "#38bdf8" : "#ec4899";
        ctx.lineWidth = 5;
        ctx.moveTo(scPiv.x, scPiv.y);
        ctx.lineTo((scPiv.x + scExt.x) / 2, (scPiv.y + scExt.y) / 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = "#f472b6";
        ctx.lineWidth = 2.5;
        ctx.moveTo((scPiv.x + scExt.x) / 2, (scPiv.y + scExt.y) / 2);
        ctx.lineTo(scExt.x, scExt.y);
        ctx.stroke();
      }
    });

    // 7. Nodos / Articulaciones (Fijos, Libres, Correderas y Fuentes Multifísica)
    this.grafo.nodos.forEach(n => {
      const sc = this.mundoAPantalla(n.x, n.y);
      const esSel = this.elementoSeleccionado?.tipo === "nodo" && this.elementoSeleccionado?.id === n.id;
      const esFijo = n.tipo === "fijo";
      const esDeslizante = n.tipo === "deslizante";

      // Halo multifísica si tiene imán, carga o temperatura
      if ((n.imanDipolo && Math.abs(n.imanDipolo) > 0) || (n.cargaElectrica && Math.abs(n.cargaElectrica) > 0) || (n.temperaturaFuente && n.temperaturaFuente > 25.1)) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 13, 0, 2 * Math.PI);
        ctx.fillStyle = n.imanDipolo ? "rgba(168, 85, 247, 0.22)" : (n.temperaturaFuente > 25.1 ? "rgba(239, 68, 68, 0.22)" : "rgba(56, 189, 248, 0.22)");
        ctx.fill();
      }

      // Halo de selección
      if (esSel) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 10, 0, 2 * Math.PI);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Dibujo de guía prismática para nodos deslizantes (correderas)
      if (esDeslizante) {
        const ang = ((n.anguloGuia || 0) * Math.PI) / 180;
        const ux = Math.cos(ang) * 18;
        const uy = -Math.sin(ang) * 18;
        ctx.beginPath();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 2]);
        ctx.moveTo(sc.x - ux, sc.y - uy);
        ctx.lineTo(sc.x + ux, sc.y + uy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
        ctx.fillRect(sc.x - 6, sc.y - 4, 12, 8);
      }

      // Dibujo de bancada a tierra para nodos fijos
      if (esFijo) {
        ctx.beginPath();
        ctx.moveTo(sc.x - 7, sc.y + 7);
        ctx.lineTo(sc.x + 7, sc.y + 7);
        ctx.lineTo(sc.x, sc.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Pin central (ampliado en móviles para mejor visibilidad e interacción táctil)
      const radioPin = wCSS < 640 ? (esFijo ? 7.5 : 6.5) : (esFijo ? 5 : 4);
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, radioPin, 0, 2 * Math.PI);
      ctx.fillStyle = esFijo ? "#1e293b" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = esFijo ? "#f8fafc" : "#0f172a";
      ctx.lineWidth = wCSS < 640 ? 2.4 : 1.8;
      ctx.stroke();

      // Indicador de sensor si el nodo es punto de medida
      const esSensor = this.grafo.sensores.some(s => s.nodoId === n.id);
      if (esSensor) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, wCSS < 640 ? 11 : 8, 0, 2 * Math.PI);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      // Etiqueta del nodo
      ctx.font = wCSS < 640 ? "bold 12px system-ui" : "10px system-ui";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(n.nombre, sc.x + (wCSS < 640 ? 10 : 8), sc.y - 4);
    });

    // 8. Tooltip HUD dinámico para el nodo en arrastre con sus cotas de posición
    if (this._nodoArrastradoActivo) {
      const nAct = this._nodoArrastradoActivo;
      const sc = this.mundoAPantalla(nAct.x, nAct.y);
      let infoTxt = `${nAct.nombre}: (${nAct.x.toFixed(1)}, ${nAct.y.toFixed(1)})`;
      if (nAct.variableX && nAct.variableY) {
        infoTxt = `${nAct.variableX}=${Math.abs(nAct.x).toFixed(1)}, ${nAct.variableY}=${Math.abs(nAct.y).toFixed(1)}`;
      }
      ctx.font = "bold 10px monospace";
      const wTip = ctx.measureText(infoTxt).width + 14;
      ctx.fillStyle = "rgba(14, 165, 233, 0.95)";
      ctx.beginPath();
      ctx.roundRect(sc.x + 12, sc.y - 24, wTip, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(infoTxt, sc.x + 12 + wTip / 2, sc.y - 14);
    }
  }

  // Dibuja una cuadrícula milimétrica suave en el fondo del canvas
  _dibujarRejilla(ctx, w, h) {
    const pasoMayor = 50 * this.viewport.zoom; // 50 mm
    const pasoMenor = 10 * this.viewport.zoom; // 10 mm

    const origenPantalla = this.mundoAPantalla(0, 0);
    const startX = (origenPantalla.x % pasoMenor + pasoMenor) % pasoMenor;
    const startY = (origenPantalla.y % pasoMenor + pasoMenor) % pasoMenor;

    // Líneas menores
    if (this.viewport.zoom >= 1.5) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.04)";
      ctx.lineWidth = 1;
      for (let x = startX; x < w; x += pasoMenor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = startY; y < h; y += pasoMenor) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    // Líneas mayores (50 mm)
    const startXMay = (origenPantalla.x % pasoMayor + pasoMayor) % pasoMayor;
    const startYMay = (origenPantalla.y % pasoMayor + pasoMayor) % pasoMayor;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = 1.2;
    for (let x = startXMay; x < w; x += pasoMayor) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startYMay; y < h; y += pasoMayor) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }
}

export default EditorGraficoView;
