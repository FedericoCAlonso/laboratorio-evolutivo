// =========================================================================
// REGISTRO CENTRAL DE RENDERIZADORES DE LIENZO UNIFICADOS MATERIAL 3
// ARQUITECTURA MVVM - CAPA VISTA CANVAS 2D DESACOPLADA
// =========================================================================

import { LienzoCamposRenderer } from "./campos-renderer.js";
import { LienzoGeometricoRenderer } from "./geometrico-renderer.js";
import { LienzoTopologicoRenderer } from "./topologico-renderer.js";
import { LienzoFuncionalRenderer } from "./funcional-renderer.js";

// Reexporta las clases para consumo directo
export {
  LienzoCamposRenderer,
  LienzoGeometricoRenderer,
  LienzoTopologicoRenderer,
  LienzoFuncionalRenderer
};

// Instancias globales singleton de los 4 renderizadores de lienzo
export const RENDERIZADORES_LIENZO = {
  campos: new LienzoCamposRenderer(),
  geometrico: new LienzoGeometricoRenderer(),
  topologico: new LienzoTopologicoRenderer(),
  funcional: new LienzoFuncionalRenderer()
};

export default RENDERIZADORES_LIENZO;
