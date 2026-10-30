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
import jansen from "./pata-jansen.js";

export const PLANTILLAS_FIELES = {
  "cohete-landing": cohete, "controlador-pid": pid, "orbita-transferencia": orbita,
  "filtro-rlc": filtro, "armadura-puente": armadura, "distribucion-termica": termico,
  "campo-potencial": potencial, "balanceo-fases-trifasico": fases,
  "acustica-beamforming": acustica, "confinamiento-em": em,
  "superficie-fonoabsorbente": fono, "linea-transmision-rf": rf,
  "corte-chapa-nesting": nesting, "brazo-robotico": brazo,
  "pata-caminante": caminante, "pata-jansen": jansen
};
