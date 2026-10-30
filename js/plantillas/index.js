// Registro de plantillas editables fieles a cada modelo nativo (editor "desde cero").
import cohete from "./cohete-landing.js";
import pid from "./controlador-pid.js";
import orbita from "./orbita-transferencia.js";
import filtro from "./filtro-rlc.js";
import armadura from "./armadura-puente.js";
import termico from "./distribucion-termica.js";
import potencial from "./campo-potencial.js";
import fases from "./balanceo-fases-trifasico.js";
import acustica from "./acustica-beamforming.js";
import em from "./confinamiento-em.js";
import fono from "./superficie-fonoabsorbente.js";
import rf from "./linea-transmision-rf.js";
import nesting from "./corte-chapa-nesting.js";
import brazo from "./brazo-robotico.js";
import caminante from "./pata-caminante.js";

import { crearGrafoPorModelo } from "../engines/mecanismos.js";

export const PLANTILLAS_FIELES = {
  "brazo-robotico": brazo,
  "cohete-landing": cohete,
  "controlador-pid": pid,
  "campo-potencial": potencial,
  "orbita-transferencia": orbita,
  "filtro-rlc": filtro,
  "armadura-puente": armadura,
  "distribucion-termica": termico,
  "acustica-beamforming": acustica,
  "confinamiento-em": em,
  "superficie-fonoabsorbente": fono,
  "linea-transmision-rf": rf,
  "corte-chapa-nesting": nesting,
  "balanceo-fases-trifasico": fases,
  "pata-caminante": caminante
};

// Asegura que todas las plantillas cuenten con su identificador y su grafo interactivo CAD 2D
Object.entries(PLANTILLAS_FIELES).forEach(([id, plantilla]) => {
  if (!plantilla) return;
  plantilla.id = id;
  if (!plantilla.grafo) {
    plantilla.grafo = crearGrafoPorModelo(id).exportarJSON();
  }
});
