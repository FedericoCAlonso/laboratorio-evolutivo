// =========================================================================
// PUNTO DE ENTRADA PRINCIPAL: ARRANQUE Y BOOTSTRAP DE LA APLICACIÓN
// ARQUITECTURA MVVM (MODEL - VIEW - VIEWMODEL) EN VANILLA JS / ES MODULES
// =========================================================================

import { AppViewModel } from "./viewmodels/app-viewmodel.js";
import { AppView } from "./views/app-view.js";

// Instancia única del ViewModel que centraliza el estado reactivo y comandos de optimización.
const viewModel = new AppViewModel();

// Instancia única de la Vista que vincula el DOM, canvas interactivos y modales con el ViewModel.
const view = new AppView(viewModel);

// Función de arranque que inicializa la vista una vez que el DOM está listo.
function arrancarAplicacion() {
  view.inicializar();
}

// Ejecuta la inicialización inmediatamente o cuando el DOM termine de cargarse.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancarAplicacion);
} else {
  arrancarAplicacion();
}
