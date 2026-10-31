// =========================================================================
// MÓDULO: DEFINICIONES DECLARATIVAS DEL CATÁLOGO (JSON DATA-DRIVEN)
// FUENTE ÚNICA DE VERDAD: IMPORTACIÓN PURA DE ARCHIVOS JSON SIN DEPENDENCIAS
// =========================================================================

import brazo from "./brazo-robotico.json" with { type: "json" };
import cohete from "./cohete-landing.json" with { type: "json" };
import pid from "./controlador-pid.json" with { type: "json" };
import potencial from "./campo-potencial.json" with { type: "json" };
import orbita from "./orbita-transferencia.json" with { type: "json" };
import filtro from "./filtro-rlc.json" with { type: "json" };
import armadura from "./armadura-puente.json" with { type: "json" };
import termico from "./distribucion-termica.json" with { type: "json" };
import acustica from "./acustica-beamforming.json" with { type: "json" };
import em from "./confinamiento-em.json" with { type: "json" };
import fono from "./superficie-fonoabsorbente.json" with { type: "json" };
import rf from "./linea-transmision-rf.json" with { type: "json" };
import nesting from "./corte-chapa-nesting.json" with { type: "json" };
import fases from "./balanceo-fases-trifasico.json" with { type: "json" };
import caminante from "./pata-caminante.json" with { type: "json" };
import jansen from "./pata-jansen.json" with { type: "json" };

// Lista declarativa de los 16 modelos del catálogo
export const CATALOGO_PREDEFINIDO = [
  brazo,
  cohete,
  pid,
  potencial,
  orbita,
  filtro,
  armadura,
  termico,
  acustica,
  em,
  fono,
  rf,
  nesting,
  fases,
  caminante,
  jansen
];

// Identifica cada modelo como perteneciente al catálogo base de fábrica
CATALOGO_PREDEFINIDO.forEach(def => {
  def.esCatalogoOriginal = true;
});

// Mapa indexado por ID canónico
export const CATALOGO_POR_ID = Object.fromEntries(
  CATALOGO_PREDEFINIDO.map(m => [m.id, m])
);

// Retorna una copia profunda de la definición JSON de un modelo del catálogo
export function obtenerDefinicionCatalogo(id) {
  if (!id) return null;
  const normalizado = String(id).toLowerCase().trim().replace(/_/g, "-");
  const def = CATALOGO_POR_ID[normalizado] || CATALOGO_POR_ID[id];
  return def ? JSON.parse(JSON.stringify(def)) : null;
}

export const obtenerModeloCatalogo = obtenerDefinicionCatalogo;
export default CATALOGO_PREDEFINIDO;
