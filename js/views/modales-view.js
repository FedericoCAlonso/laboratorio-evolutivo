// =========================================================================
// CAPA VISTA: CONTROLADOR DE DIÁLOGOS MODALES Y ALERTAS DE USUARIO
// ARQUITECTURA MVVM - GESTIÓN MODAL DE BIBLIOTECA, CONFIGURACIÓN Y CONSTRUCTOR
// =========================================================================

import {
  mostrarAlerta,
  mostrarToast,
  abrirModalConstructor,
  cerrarModalConstructor,
  agregarFilaVariableConstructor,
  extraerDefinicionModeloDesdeUI,
  abrirModalBiblioteca,
  cerrarModalBiblioteca,
  abrirModalRenombrar,
  cerrarModalRenombrar,
  abrirModalImportar,
  cerrarModalImportar,
  abrirModalGuardarPreset,
  cerrarModalGuardarPreset,
  aplicarTemaColor
} from "../ui.js";

// Reexporta las funciones atómicas para consumo directo o desacoplado.
export {
  mostrarAlerta,
  mostrarToast,
  abrirModalConstructor,
  cerrarModalConstructor,
  agregarFilaVariableConstructor,
  extraerDefinicionModeloDesdeUI,
  abrirModalBiblioteca,
  cerrarModalBiblioteca,
  abrirModalRenombrar,
  cerrarModalRenombrar,
  abrirModalImportar,
  cerrarModalImportar,
  abrirModalGuardarPreset,
  cerrarModalGuardarPreset,
  aplicarTemaColor
};

// Controlador centralizado de ventanas modales y notificaciones en la interfaz de usuario.
export class ModalesView {
  // Inicializa el controlador asociando los grupos de elementos DOM de cada modal.
  constructor(elementos = {}, estudioView = null) {
    this.elementosConstructor = elementos.constructor || {};
    this.elementosBiblioteca = elementos.biblioteca || {};
    this.elementosRenombrar = elementos.renombrar || {};
    this.elementosImportar = elementos.importar || {};
    this.elementosPreset = elementos.preset || {};
    this.elementosConfiguracion = elementos.configuracion || {};
    this.estudioView = estudioView;
  }

  // Asigna la instancia del Estudio de Modelado de pantalla completa.
  asignarEstudioView(estudioView) {
    this.estudioView = estudioView;
  }

  // Muestra una notificación flotante estilo Snackbar de Material 3.
  notificar(mensaje, duracion = 3200) {
    mostrarToast(mensaje, duracion);
  }

  // Muestra u oculta un banner de advertencia o error en un contenedor de alerta.
  alerta(mensaje, elementoAlerta) {
    mostrarAlerta(mensaje, elementoAlerta);
  }

  // Abre el modal de configuración de tema y color.
  abrirConfiguracion() {
    if (this.elementosConfiguracion.modal) {
      this.elementosConfiguracion.modal.style.display = "flex";
    }
  }

  // Cierra el modal de configuración.
  cerrarConfiguracion() {
    if (this.elementosConfiguracion.modal) {
      this.elementosConfiguracion.modal.style.display = "none";
    }
  }

  // Abre el constructor/estudio de simulaciones en modo creación o edición.
  abrirConstructor(datosIniciales = null, esEdicion = false) {
    if (this.estudioView) {
      this.estudioView.abrir(datosIniciales, esEdicion);
    } else {
      abrirModalConstructor(this.elementosConstructor, datosIniciales, esEdicion);
    }
  }

  // Cierra el constructor/estudio de simulaciones.
  cerrarConstructor() {
    if (this.estudioView) {
      this.estudioView.cerrar();
    } else {
      cerrarModalConstructor(this.elementosConstructor);
    }
  }

  // Extrae los datos ingresados en el formulario del constructor low-code.
  extraerDatosConstructor() {
    if (this.estudioView) {
      return this.estudioView.extraerDatos();
    }
    return extraerDefinicionModeloDesdeUI(this.elementosConstructor);
  }

  // Agrega una fila de variable al formulario del constructor.
  agregarVariableConstructor(datosVariable = {}) {
    if (this.estudioView) {
      this.estudioView.agregarVariable(datosVariable);
    } else if (this.elementosConstructor.tbody) {
      agregarFilaVariableConstructor(this.elementosConstructor.tbody, datosVariable);
    }
  }

  // Abre la biblioteca completa con simulaciones nativas, dinámicas y presets.
  abrirBiblioteca(modelos, presets, onAccion) {
    abrirModalBiblioteca(this.elementosBiblioteca, modelos, presets, onAccion);
  }

  // Cierra la biblioteca modal.
  cerrarBiblioteca() {
    cerrarModalBiblioteca(this.elementosBiblioteca);
  }

  // Abre el diálogo para renombrar una simulación.
  abrirRenombrar(modelo) {
    abrirModalRenombrar(this.elementosRenombrar, modelo);
  }

  // Cierra el diálogo de renombrado.
  cerrarRenombrar() {
    cerrarModalRenombrar(this.elementosRenombrar);
  }

  // Abre el modal para importar archivos JSON.
  abrirImportar() {
    abrirModalImportar(this.elementosImportar);
  }

  // Cierra el modal de importación JSON.
  cerrarImportar() {
    cerrarModalImportar(this.elementosImportar);
  }

  // Abre el diálogo para guardar un preset.
  abrirGuardarPreset(sugerenciaNombre = "") {
    abrirModalGuardarPreset(this.elementosPreset, sugerenciaNombre);
  }

  // Cierra el diálogo de guardar preset.
  cerrarGuardarPreset() {
    cerrarModalGuardarPreset(this.elementosPreset);
  }

  // Aplica el modo y la paleta tonal activa al documento.
  aplicarTema(modo, acento) {
    aplicarTemaColor(modo, acento);
  }

  // Despliega un diálogo nativo Material 3 de confirmación retornando una Promesa booleana.
  confirmar({ titulo = "⚠️ Confirmar Acción", mensaje = "¿Desea continuar?", textoConfirmar = "Confirmar", textoCancelar = "Cancelar", peligro = true } = {}) {
    if (typeof document === "undefined") return Promise.resolve(true);
    const modal = document.getElementById("modal-confirmacion-m3");
    const tituloEl = document.getElementById("modal-titulo-confirmar");
    const mensajeEl = document.getElementById("modal-mensaje-confirmar");
    const btnAceptar = document.getElementById("btn-aceptar-confirmar-m3");
    const btnCancelar = document.getElementById("btn-cancelar-confirmar-m3");
    const btnCerrar = document.getElementById("btn-cerrar-confirmar-m3");

    if (!modal || !btnAceptar || !btnCancelar) {
      return Promise.resolve(typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(mensaje) : true);
    }

    if (tituloEl) tituloEl.textContent = titulo;
    if (mensajeEl) mensajeEl.textContent = mensaje;
    btnAceptar.textContent = textoConfirmar;
    btnCancelar.textContent = textoCancelar;
    btnAceptar.className = peligro ? "btn-peligro" : "btn-m3-filled";

    modal.style.display = "flex";

    return new Promise((resolve) => {
      const finalizar = (resultado) => {
        modal.style.display = "none";
        btnAceptar.onclick = null;
        btnCancelar.onclick = null;
        if (btnCerrar) btnCerrar.onclick = null;
        resolve(resultado);
      };

      btnAceptar.onclick = () => finalizar(true);
      btnCancelar.onclick = () => finalizar(false);
      if (btnCerrar) btnCerrar.onclick = () => finalizar(false);
    });
  }
}

export default ModalesView;
