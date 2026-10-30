// =========================================================================
// CAPA VISTA: EDITOR GRÁFICO CAD DE MECANISMOS MULTICUERPO Y MULTIFÍSICA 2D
// ARQUITECTURA MVVM - WORKSPACE DEDICADO A PANTALLA COMPLETA
// =========================================================================

import {
  GrafoMecanismoMultifisica,
  analizarGradosLibertad,
  resolverPasoMecanismo,
  simularCicloMecanismo,
  crearGrafoPataJansen,
  crearGrafoBrazoRobotico
} from "../engines/mecanismos.js?v=2.5";

// Vista de diseño y construcción gráfica de mecanismos articulados y acoplamientos multifísica
export class EditorGraficoView {
  constructor(opciones = {}) {
    this.contenedor = opciones.contenedor || null;
    this.onGrafoModificado = opciones.onGrafoModificado || null;
    this.onVariableVinculada = opciones.onVariableVinculada || null;
    this.onVariableModificada = opciones.onVariableModificada || null;

    // Estado del grafo activo
    this.grafo = new GrafoMecanismoMultifisica();
    this.herramientaActiva = "select"; // 'select' | 'nodo_fijo' | 'nodo_libre' | 'barra' | 'cuerpo' | 'motor_rotativo' | 'sensor'
    this.elementoSeleccionado = null; // { tipo: 'nodo'|'barra'|'motor'|'sensor', id: string }
    this.nodoInicioConexion = null;
    this.nodosCuerpoTemporal = [];
    this._nodoArrastradoActivo = null;

    // Estado de simulación en vivo del mecanismo
    this.animando = true;
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

  // Carga un grafo completo (por ejemplo, al editar Jansen o Brazo Robótico)
  cargarGrafo(grafo) {
    if (grafo instanceof GrafoMecanismoMultifisica) {
      this.grafo = grafo.clonar();
    } else if (grafo && typeof grafo === "object") {
      this.grafo = new GrafoMecanismoMultifisica(grafo);
    }
    this.elementoSeleccionado = null;
    this._actualizarIndicadorDOF();
    this._actualizarInspector();
    this._ejecutarSimulacionEnLienzo();
    this.redibujar();
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

      // 2. Coordenadas de nodos vinculados a cotas dimensionales
      this.grafo.nodos?.forEach(n => {
        if (n.variableX === nom) {
          const sx = n.signoX !== undefined ? n.signoX : (n.id === "X_fijo" ? -1 : 1);
          n.x = parseFloat((sx * Math.abs(val)).toFixed(1));
        }
        if (n.variableY === nom) {
          const sy = n.signoY !== undefined ? n.signoY : (n.id === "X_fijo" ? -1 : 1);
          n.y = parseFloat((sy * Math.abs(val)).toFixed(1));
        }
      });

      // 3. Radio de motores vinculados
      this.grafo.motores?.forEach(m => {
        if (m.variableAsociada === nom || m.amplitudVinculada === nom) {
          m.longitudManivela = val;
        }
      });
    }

    this._ejecutarSimulacionEnLienzo();
    this._actualizarInspector();
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
      <div class="editor-cad-contenedor" style="display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 580px; background: var(--bg-card, #111827); border-radius: var(--radio-sm, 12px); overflow: hidden; border: 1px solid var(--borde, rgba(148,163,184,0.2));">
        
        <!-- Barra de herramientas superior del CAD -->
        <div class="toolbar-cad" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem 0.85rem; background: var(--bg-tarjeta, #1f2937); border-bottom: 1px solid var(--borde, rgba(148,163,184,0.2));">
          
          <!-- Paleta de herramientas de modelado -->
          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <button type="button" class="btn-tool-cad" data-tool="select" title="Seleccionar y mover nodos" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              👆 Seleccionar
            </button>
            <div style="width: 1px; height: 22px; background: rgba(148,163,184,0.25); margin: 0 0.2rem;"></div>
            <button type="button" class="btn-tool-cad" data-tool="nodo_fijo" title="Agregar pivote fijo a bancada/tierra" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              ⚓ Pivote Fijo
            </button>
            <button type="button" class="btn-tool-cad" data-tool="nodo_libre" title="Agregar articulación o bisagra libre" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              ⚪ Bisagra Libre
            </button>
            <button type="button" class="btn-tool-cad" data-tool="barra" title="Conectar 2 nodos con una barra/palito" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              📏 Barra / Palito
            </button>
            <button type="button" class="btn-tool-cad" data-tool="cuerpo" title="Crear cuerpo rígido poligonal (triángulo)" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              🔺 Triángulo Rígido
            </button>
            <div style="width: 1px; height: 22px; background: rgba(148,163,184,0.25); margin: 0 0.2rem;"></div>
            <button type="button" class="btn-tool-cad" data-tool="motor_rotativo" title="Asignar motor rotativo (manivela motriz)" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              🔄 Motor Rotativo
            </button>
            <button type="button" class="btn-tool-cad" data-tool="sensor" title="Marcar punto de medida / sensor de trayectoria" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              🎯 Punto Medida
            </button>
            <button type="button" class="btn-tool-cad" data-tool="multiefecto" title="Asociar imán o carga para acople electromagnético" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;">
              🧲 Imán / Carga EM
            </button>
          </div>

          <!-- Acciones de control y Grados de Libertad -->
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <!-- Badge de Grados de Libertad DOF (Grübler-Kutzbach) -->
            <div id="cad-badge-dof" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.7rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.4);" title="Grados de Libertad cinemáticos">
              ⚙️ DOF: M = 1 (Determinado)
            </div>

            <!-- Selector de mecanismos preconfigurados -->
            <select id="cad-select-predefinido" style="padding: 0.3rem 0.5rem; font-size: 0.78rem; border-radius: 6px; background: var(--bg-input, #0f172a); color: var(--texto-principal, #f8fafc); border: 1px solid var(--borde, #334155); cursor: pointer;">
              <option value="">💡 Mecanismo...</option>
              <option value="jansen">🦵 Theo Jansen (13 Barras)</option>
              <option value="brazo">🦾 Brazo Robótico (3 GDL)</option>
              <option value="vacio">📄 Lienzo en Blanco (Nuevo)</option>
            </select>

            <!-- Botón simular / pausar -->
            <button type="button" id="cad-btn-animar" class="btn-m3-tonal" style="padding: 0.3rem 0.65rem; font-size: 0.78rem; cursor: pointer; border-radius: 6px;">
              ⏸ Pausar
            </button>
          </div>
        </div>

        <!-- Área de trabajo central: Viewport Canvas y Panel Inspector -->
        <div style="display: flex; flex: 1; position: relative; overflow: hidden; min-height: 480px;">
          
          <!-- Viewport del Canvas CAD interactivo -->
          <div style="flex: 1; position: relative; width: 100%; height: 100%; overflow: hidden; background: #0b0f19;">
            <canvas id="canvas-editor-cad" width="1000" height="520" style="display: block; width: 100%; height: 100%; cursor: default;"></canvas>

            <!-- Overlay de información de coordenadas del cursor y ayuda rápida -->
            <div id="cad-overlay-coords" style="position: absolute; bottom: 8px; left: 12px; font-size: 0.73rem; color: #94a3b8; font-family: monospace; background: rgba(15,23,42,0.8); padding: 0.2rem 0.5rem; border-radius: 4px; pointer-events: none;">
              X: 0.0 mm | Y: 0.0 mm | Zoom: 100%
            </div>

            <!-- Botones de zoom flotantes -->
            <div style="position: absolute; bottom: 10px; right: 12px; display: flex; flex-direction: column; gap: 4px;">
              <button type="button" id="cad-btn-zoom-in" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(30,41,59,0.85); color: #fff; border: 1px solid #475569; font-weight: bold; cursor: pointer;">+</button>
              <button type="button" id="cad-btn-zoom-out" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(30,41,59,0.85); color: #fff; border: 1px solid #475569; font-weight: bold; cursor: pointer;">-</button>
              <button type="button" id="cad-btn-zoom-reset" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(30,41,59,0.85); color: #fff; border: 1px solid #475569; font-size: 0.7rem; cursor: pointer;" title="Centrar mecanismo">⌖</button>
            </div>
          </div>

          <!-- Sidebar lateral: Inspector de Propiedades y Variables de Optimización -->
          <div id="cad-sidebar-inspector" style="width: 290px; border-left: 1px solid var(--borde, rgba(148,163,184,0.2)); background: var(--bg-card, #111827); padding: 0.85rem; display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h4 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--texto-principal, #f8fafc); text-transform: uppercase; letter-spacing: 0.05em;">
                🔍 Inspector CAD
              </h4>
              <span id="cad-inspector-tipo-tag" style="font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; background: #1e293b; color: #94a3b8;">
                Ninguno
              </span>
            </div>

            <!-- Contenido dinámico del inspector -->
            <div id="cad-inspector-contenido" style="flex: 1; font-size: 0.8rem; color: #cbd5e1;">
              <div style="padding: 1.5rem 0.5rem; text-align: center; color: #64748b; font-size: 0.8rem;">
                Haga clic en un nodo, barra, motor o sensor para editar sus propiedades o vincularlo a variables de optimización.
              </div>
            </div>

            <!-- Resumen de Sensores activos y Telemetría -->
            <div style="border-top: 1px solid rgba(148,163,184,0.15); padding-top: 0.65rem;">
              <div style="font-size: 0.78rem; font-weight: 700; margin-bottom: 0.4rem; color: #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                <span>🎯 Puntos de Medida</span>
                <span id="cad-conteo-sensores" style="color: #f59e0b; font-family: monospace;">(0)</span>
              </div>
              <div id="cad-lista-sensores-telemetria" style="font-size: 0.74rem; display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto;">
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
    this.dom.canvas = this.contenedor.querySelector("#canvas-editor-cad");
    this.dom.ctx = this.dom.canvas ? this.dom.canvas.getContext("2d") : null;
    this.dom.badgeDof = this.contenedor.querySelector("#cad-badge-dof");
    this.dom.btnAnimar = this.contenedor.querySelector("#cad-btn-animar");
    this.dom.selectPredefinido = this.contenedor.querySelector("#cad-select-predefinido");
    this.dom.overlayCoords = this.contenedor.querySelector("#cad-overlay-coords");
    this.dom.inspectorContenido = this.contenedor.querySelector("#cad-inspector-contenido");
    this.dom.inspectorTipoTag = this.contenedor.querySelector("#cad-inspector-tipo-tag");
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

    // 2. Control de simulación en vivo
    this.dom.btnAnimar?.addEventListener("click", () => {
      this.animando = !this.animando;
      this.dom.btnAnimar.textContent = this.animando ? "⏸ Pausar" : "▶ Reanudar";
    });

    // 3. Mecanismos predefinidos
    this.dom.selectPredefinido?.addEventListener("change", (e) => {
      const valor = e.target.value;
      if (valor === "jansen") {
        this.cargarGrafo(crearGrafoPataJansen(this.valoresVariables));
      } else if (valor === "brazo") {
        this.cargarGrafo(crearGrafoBrazoRobotico(this.valoresVariables));
      } else if (valor === "vacio") {
        this.cargarGrafo(new GrafoMecanismoMultifisica());
      }
      e.target.value = "";
    });

    // 4. Zoom
    this.dom.btnZoomIn?.addEventListener("click", () => {
      this.viewport.zoom = Math.min(10.0, this.viewport.zoom * 1.25);
      this.redibujar();
    });
    this.dom.btnZoomOut?.addEventListener("click", () => {
      this.viewport.zoom = Math.max(0.5, this.viewport.zoom / 1.25);
      this.redibujar();
    });
    this.dom.btnZoomReset?.addEventListener("click", () => {
      this.viewport.zoom = 3.2;
      this.viewport.centroX = 0;
      this.viewport.centroY = -35;
      this.redibujar();
    });

    // 5. Interacción con el Canvas (Clics, Arrastre de Nodos y Paneo)
    const canvas = this.dom.canvas;
    if (!canvas) return;

    let arrastrandoNodo = null;

    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const mundo = this.pantallaAMundo(px, py);

      // Botón secundario o espacio: paneo
      if (e.button === 1 || e.button === 2) {
        this.viewport.arrastrandoPan = true;
        this.viewport.panInicioX = px;
        this.viewport.panInicioY = py;
        return;
      }

      // Herramienta 'select'
      if (this.herramientaActiva === "select") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          arrastrandoNodo = nodo;
          this.seleccionarElemento("nodo", nodo.id);
          this.redibujar();
          return;
        }

        const barra = this._encontrarBarraCercana(mundo.x, mundo.y, 8 / this.viewport.zoom);
        if (barra) {
          this.seleccionarElemento("barra", barra.id);
          this.redibujar();
          return;
        }

        this.seleccionarElemento(null, null);
        this.redibujar();
      }

      // Herramienta 'nodo_fijo'
      else if (this.herramientaActiva === "nodo_fijo") {
        this.grafo.agregarNodo({
          x: parseFloat(mundo.x.toFixed(1)),
          y: parseFloat(mundo.y.toFixed(1)),
          tipo: "fijo"
        });
        this._notificarCambioGrafo();
        this.seleccionarHerramienta("select");
      }

      // Herramienta 'nodo_libre'
      else if (this.herramientaActiva === "nodo_libre") {
        this.grafo.agregarNodo({
          x: parseFloat(mundo.x.toFixed(1)),
          y: parseFloat(mundo.y.toFixed(1)),
          tipo: "libre"
        });
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
            this.grafo.agregarBarra({
              nodoA: this.nodoInicioConexion.id,
              nodoB: nodo.id,
              longitud: parseFloat(dist.toFixed(1)),
              color: "#3b82f6"
            });
            this.nodoInicioConexion = null;
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
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
            this.grafo.agregarMotor({
              tipo: "rotativo",
              nodoPivote: this.nodoInicioConexion.id,
              nodoExtremo: nodo.id,
              longitudManivela: parseFloat(dist.toFixed(1)),
              velocidadAngular: 1.0
            });
            this.nodoInicioConexion = null;
            this._notificarCambioGrafo();
            this.seleccionarHerramienta("select");
          }
        }
      }

      // Herramienta 'sensor'
      else if (this.herramientaActiva === "sensor") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          this.grafo.agregarSensor({
            nodoId: nodo.id,
            nombre: nodo.nombre.toLowerCase().replace(/[^a-z0-9]/g, "_")
          });
          this._notificarCambioGrafo();
          this.seleccionarHerramienta("select");
        }
      }

      // Herramienta 'multiefecto' (Asignar carga o imán a un nodo)
      else if (this.herramientaActiva === "multiefecto") {
        const nodo = this._encontrarNodoCercano(mundo.x, mundo.y, 14 / this.viewport.zoom);
        if (nodo) {
          nodo.imanDipolo = (nodo.imanDipolo || 0) + 10.0;
          this._notificarCambioGrafo();
          this.seleccionarHerramienta("select");
        }
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const mundo = this.pantallaAMundo(px, py);

      if (this.dom.overlayCoords) {
        this.dom.overlayCoords.textContent = `X: ${mundo.x.toFixed(1)} mm | Y: ${mundo.y.toFixed(1)} mm | Zoom: ${Math.round(this.viewport.zoom * 31.25)}%`;
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

        // 1. Coordenadas de nodo si tiene variables asociadas (ej. 'a' y 'l' en frame Jansen)
        if (arrastrandoNodo.variableX) {
          const valX = parseFloat(Math.abs(arrastrandoNodo.x).toFixed(1));
          this.valoresVariables[arrastrandoNodo.variableX] = valX;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: arrastrandoNodo.variableX, valor: valX });
          }
        }
        if (arrastrandoNodo.variableY) {
          const valY = parseFloat(Math.abs(arrastrandoNodo.y).toFixed(1));
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
        this._ejecutarSimulacionEnLienzo();
        this.redibujar();
      }
    });

    const finInteraccion = () => {
      if (arrastrandoNodo) {
        arrastrandoNodo = null;
        this._nodoArrastradoActivo = null;
        this._notificarCambioGrafo();
      }
      this.viewport.arrastrandoPan = false;
    };

    canvas.addEventListener("mouseup", finInteraccion);
    canvas.addEventListener("mouseleave", finInteraccion);

    // Zoom con rueda del ratón centrado
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 0.85;
      this.viewport.zoom = Math.max(0.4, Math.min(12.0, this.viewport.zoom * delta));
      this.redibujar();
    }, { passive: false });
  }

  // Activa una herramienta de la paleta
  seleccionarHerramienta(tool) {
    this.herramientaActiva = tool;
    this.nodoInicioConexion = null;

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

  // Notifica cambios al callback externo y sincroniza DOF
  _notificarCambioGrafo() {
    this._actualizarIndicadorDOF();
    this._actualizarInspector();
    this._ejecutarSimulacionEnLienzo();
    this.redibujar();

    if (typeof this.onGrafoModificado === "function") {
      this.onGrafoModificado(this.grafo);
    }
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

  // Actualiza el panel inspector lateral de propiedades
  _actualizarInspector() {
    if (!this.dom.inspectorContenido || !this.dom.inspectorTipoTag) return;

    // Actualiza telemetría de sensores en el pie del inspector
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
          const zanc = tele.zancada !== undefined ? `Zancada: ${tele.zancada.toFixed(1)} u` : "";
          const acel = tele.aceleracionPico !== undefined ? ` | Acel: ${tele.aceleracionPico.toFixed(1)}` : "";
          htmlSensores += `
            <div style="background: rgba(30,41,59,0.5); padding: 0.35rem 0.5rem; border-radius: 4px; border-left: 3px solid ${s.color || '#f59e0b'};">
              <div style="font-weight: 700; color: #f8fafc;">🎯 ${s.nombre} (en ${s.nodoId})</div>
              <div style="color: #94a3b8; font-family: monospace; font-size: 0.7rem;">${zanc}${acel}</div>
            </div>
          `;
        });
        this.dom.listaSensores.innerHTML = htmlSensores;
      }
    }

    if (!this.elementoSeleccionado) {
      this.dom.inspectorTipoTag.textContent = "Ninguno";
      this.dom.inspectorContenido.innerHTML = `
        <div style="padding: 1.5rem 0.5rem; text-align: center; color: #64748b; font-size: 0.8rem;">
          Haga clic en un nodo, barra, motor o sensor para editar sus propiedades o vincularlo a variables de optimización.
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
        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
          <div>
            <label style="font-size: 0.72rem; color: #94a3b8;">Nombre de la Articulación</label>
            <input type="text" id="insp-nodo-nom" value="${nodo.nombre}" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <div style="flex: 1;">
              <label style="font-size: 0.72rem; color: #94a3b8;">X (mm)</label>
              <input type="number" id="insp-nodo-x" step="any" value="${nodo.x}" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.72rem; color: #94a3b8;">Y (mm)</label>
              <input type="number" id="insp-nodo-y" step="any" value="${nodo.y}" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
            </div>
          </div>
          <div>
            <label style="font-size: 0.72rem; color: #94a3b8;">Tipo de Articulación</label>
            <select id="insp-nodo-tipo" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
              <option value="fijo" ${nodo.tipo === "fijo" ? "selected" : ""}>⚓ Fijo (Bancada a Tierra)</option>
              <option value="libre" ${nodo.tipo === "libre" ? "selected" : ""}>⚪ Bisagra Libre (Revoluta)</option>
            </select>
          </div>
          <div style="border-top: 1px solid #334155; padding-top: 0.5rem;">
            <label style="font-size: 0.72rem; color: #94a3b8;">Dipolo Magnético / Carga EM</label>
            <input type="number" id="insp-nodo-iman" step="any" value="${nodo.imanDipolo || 0}" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
          </div>
          <button type="button" id="insp-nodo-borrar" style="margin-top: 0.5rem; padding: 0.35rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer;">
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
      this.dom.inspectorContenido.querySelector("#insp-nodo-iman")?.addEventListener("input", (e) => {
        nodo.imanDipolo = parseFloat(e.target.value) || 0;
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
      if (inpLongExistente && this._inspectorIdActual === id) {
        if (document.activeElement !== inpLongExistente) inpLongExistente.value = barra.longitud;
        return;
      }
      this._inspectorIdActual = id;

      this.dom.inspectorContenido.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
          <div>
            <label style="font-size: 0.72rem; color: #94a3b8;">Nombre del Eslabón</label>
            <input type="text" id="insp-barra-nom" value="${barra.nombre}" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
          </div>
          <div>
            <label style="font-size: 0.72rem; color: #94a3b8;">Longitud (mm)</label>
            <input type="number" id="insp-barra-long" step="any" value="${barra.longitud}" style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff;">
          </div>
          
          <!-- Vinculación con variable de optimización -->
          <div style="background: rgba(59, 130, 246, 0.1); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.3);">
            <div style="font-weight: 700; color: #60a5fa; font-size: 0.75rem; margin-bottom: 0.3rem;">⚡ Variable de Decisión Vinculada</div>
            <input type="text" id="insp-barra-var" value="${barra.variableAsociada || ""}" placeholder="Ej: b, j, radio..." style="width: 100%; padding: 0.3rem 0.4rem; background: #0f172a; border: 1px solid #3b82f6; border-radius: 4px; color: #fff; font-family: monospace;">
            <button type="button" id="insp-barra-vincular" class="btn-m3-filled" style="width: 100%; margin-top: 0.4rem; padding: 0.3rem; font-size: 0.74rem;">
              Asociar a Variables de Algoritmo
            </button>
          </div>

          <button type="button" id="insp-barra-borrar" style="margin-top: 0.5rem; padding: 0.35rem; background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer;">
            🗑️ Eliminar Barra
          </button>
        </div>
      `;

      this.dom.inspectorContenido.querySelector("#insp-barra-nom")?.addEventListener("input", (e) => {
        barra.nombre = e.target.value;
        this.redibujar();
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-long")?.addEventListener("input", (e) => {
        barra.longitud = parseFloat(e.target.value) || 0;
        const varNom = barra.variableAsociada || barra.longitudVinculada;
        if (varNom) {
          this.valoresVariables[varNom] = barra.longitud;
          if (typeof this.onVariableModificada === "function") {
            this.onVariableModificada({ nombre: varNom, valor: barra.longitud });
          }
        }
        this._notificarCambioGrafo();
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
        }
      });
      this.dom.inspectorContenido.querySelector("#insp-barra-borrar")?.addEventListener("click", () => {
        this.grafo.barras = this.grafo.barras.filter(b => b.id !== id);
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
    const canvas = this.dom.canvas;
    const w = canvas ? canvas.clientWidth : 1000;
    const h = canvas ? canvas.clientHeight : 520;
    return {
      x: this.viewport.centroX + (px - w / 2) / this.viewport.zoom,
      y: this.viewport.centroY - (py - h / 2) / this.viewport.zoom
    };
  }

  // Convierte coordenadas métricas del mundo a pantalla
  mundoAPantalla(x, y) {
    const canvas = this.dom.canvas;
    const w = canvas ? canvas.clientWidth : 1000;
    const h = canvas ? canvas.clientHeight : 520;
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
    const wCSS = canvas.clientWidth || 1000;
    const hCSS = canvas.clientHeight || 520;

    if (canvas.width !== wCSS * dpr || canvas.height !== hCSS * dpr) {
      canvas.width = wCSS * dpr;
      canvas.height = hCSS * dpr;
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

      // Barra con aspecto de ingeniería / viga
      ctx.beginPath();
      ctx.strokeStyle = estaConectadaAArrastre ? "#06b6d4" : (esSel ? "#38bdf8" : (b.color || "#3b82f6"));
      ctx.lineWidth = estaConectadaAArrastre ? 4.0 : (esSel ? 4.5 : (b.grosor || 2.5));
      ctx.lineCap = "round";
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();

      // Cotas y etiqueta sobre la barra
      const mx = (pA.x + pB.x) / 2;
      const my = (pA.y + pB.y) / 2;
      const texto = b.variableAsociada ? `${b.variableAsociada}: ${b.longitud.toFixed(1)}` : `${b.longitud.toFixed(1)}`;
      ctx.font = estaConectadaAArrastre ? "bold 10px monospace" : "bold 9px system-ui";
      const tw = ctx.measureText(texto).width + (estaConectadaAArrastre ? 12 : 8);
      ctx.fillStyle = estaConectadaAArrastre ? "rgba(6, 182, 212, 0.95)" : "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2, my - 8, tw, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(texto, mx, my);
    });

    // 6. Actuadores / Motores rotativos
    this.grafo.motores.forEach(m => {
      if (m.tipo === "rotativo") {
        const piv = this.grafo.nodos.find(n => n.id === m.nodoPivote);
        if (piv) {
          const scPiv = this.mundoAPantalla(piv.x, piv.y);
          const radioPix = m.longitudManivela * this.viewport.zoom;

          // Círculo de giro de la manivela
          ctx.beginPath();
          ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.arc(scPiv.x, scPiv.y, radioPix, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // 7. Nodos / Articulaciones
    this.grafo.nodos.forEach(n => {
      const sc = this.mundoAPantalla(n.x, n.y);
      const esSel = this.elementoSeleccionado?.tipo === "nodo" && this.elementoSeleccionado?.id === n.id;
      const esFijo = n.tipo === "fijo";

      // Halo de selección
      if (esSel) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 10, 0, 2 * Math.PI);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.stroke();
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

      // Pin central
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, esFijo ? 5 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = esFijo ? "#1e293b" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = esFijo ? "#f8fafc" : "#0f172a";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Indicador de sensor si el nodo es punto de medida
      const esSensor = this.grafo.sensores.some(s => s.nodoId === n.id);
      if (esSensor) {
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 8, 0, 2 * Math.PI);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Etiqueta del nodo
      ctx.font = "10px system-ui";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "left";
      ctx.fillText(n.nombre, sc.x + 8, sc.y - 4);
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
