// =========================================================================
// PLANTILLA FIEL: PATA CINEMÁTICA DE THEO JANSEN (13 BARRAS Y LAZO CERRADO)
// =========================================================================

import { crearGrafoPataJansen } from "../engines/mecanismos.js";

export default {
  nombre: "Pata Cinemática de Theo Jansen (13 Barras)",
  descripcion: "Optimización mecatrónica multiobjetivo de las 12 barras del mecanismo caminante de Theo Jansen para maximizar suavidad inercial y precisión de zancada superando obstáculos.",
  tipoVisualizacion: "mecanismo_jansen",
  grafo: crearGrafoPataJansen().exportarJSON(),
  variables: [
    {
      nombre: "a",
      etiqueta: "a: Offset horizontal manivela Y al pivote fijo X (-a, -l)",
      tipo: "continuo",
      min: 26.6,
      max: 49.4,
      valorNominal: 38.0
    },
    {
      nombre: "l",
      etiqueta: "l: Offset vertical manivela Y al pivote fijo X (-a, -l)",
      tipo: "continuo",
      min: 5.46,
      max: 10.14,
      valorNominal: 7.8
    },
    {
      nombre: "b",
      etiqueta: "b: Eslabón superior de acople pivote fijo X al nodo D",
      tipo: "continuo",
      min: 29.05,
      max: 53.95,
      valorNominal: 41.5
    },
    {
      nombre: "c",
      etiqueta: "c: Biela motriz inferior desde pivote fijo X al nodo F",
      tipo: "continuo",
      min: 27.51,
      max: 51.09,
      valorNominal: 39.3
    },
    {
      nombre: "d",
      etiqueta: "d: Balancín de transferencia pivote fijo X al nodo E",
      tipo: "continuo",
      min: 28.07,
      max: 52.13,
      valorNominal: 40.1
    },
    {
      nombre: "e",
      etiqueta: "e: Eslabón superior de cierre nodo D al nodo E",
      tipo: "continuo",
      min: 39.06,
      max: 72.54,
      valorNominal: 55.8
    },
    {
      nombre: "f",
      etiqueta: "f: Eslabón del muslo superior nodo E al nodo G",
      tipo: "continuo",
      min: 27.58,
      max: 51.22,
      valorNominal: 39.4
    },
    {
      nombre: "g",
      etiqueta: "g: Eslabón del muslo inferior nodo F al nodo G",
      tipo: "continuo",
      min: 25.69,
      max: 47.71,
      valorNominal: 36.7
    },
    {
      nombre: "h",
      etiqueta: "h: Pierna inferior de apoyo desde nodo G al pie H",
      tipo: "continuo",
      min: 45.99,
      max: 85.41,
      valorNominal: 65.7
    },
    {
      nombre: "i",
      etiqueta: "i: Tirante de talón desde nodo F al pie de contacto H",
      tipo: "continuo",
      min: 34.3,
      max: 63.7,
      valorNominal: 49.0
    },
    {
      nombre: "j",
      etiqueta: "j: Biela de manivela K al nodo de balancín D",
      tipo: "continuo",
      min: 35.0,
      max: 65.0,
      valorNominal: 50.0
    },
    {
      nombre: "k",
      etiqueta: "k: Biela de manivela K al nodo de guía inferior F",
      tipo: "continuo",
      min: 43.33,
      max: 80.47,
      valorNominal: 61.9
    }
  ],
  codigoEvaluacion: `// Fitness multiobjetivo de la Pata de Theo Jansen (180 pasos)
// Barreras duras: 1000+ lazo no cierra, 500 saltos bruscos, 800 viola gálibo/despeje
const modoOptimizacion = "multiobjetivo";
const maxAncho = 80;
const maxAlto = 40;
const obstaculoAlto = 15;
const zancadaObjetivo = 4.0;
const criterioSuavidad = "pico";
const limitePico = 30;
const w1 = 3.0, w2 = 1.0, w3 = 1.0, w4 = 1.0, w5 = 0.5, w7 = 1.0, w9 = 1.0;

return estructuras.evaluarJansenFitness(vars, {
  modoOptimizacion, maxAncho, maxAlto, obstaculoAlto,
  zancadaObjetivo, criterioSuavidad, limitePico,
  w1, w2, w3, w4, w5, w7, w9
});`
};
