// =========================================================================
// PUNTO DE ENTRADA PRINCIPAL: ARRANQUE Y BOOTSTRAP DE LA APLICACIÓN
// ARQUITECTURA MVVM (MODEL - VIEW - VIEWMODEL) EN VANILLA JS / ES MODULES
// =========================================================================

import { AppViewModel } from "./viewmodels/app-viewmodel.js?v=2.7";
import { AppView } from "./views/app-view.js?v=2.7";

// Referencias de la aplicación para control y depuración
let viewModel = null;
let view = null;

// Función de arranque que inicializa el ViewModel y la Vista una vez que el DOM está listo.
function arrancarAplicacion() {
  if (view) return;
  viewModel = new AppViewModel();
  view = new AppView(viewModel);
  view.inicializar();

  // Exposición en el objeto global window para invocaciones directas desde el DOM
  window.appView = view;
  window.viewModel = viewModel;
  window.estudioView = view.estudioView;
}

// Ejecuta la inicialización de manera segura cuando el DOM termine de cargarse.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancarAplicacion);
} else {
  arrancarAplicacion();
}
