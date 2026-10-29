# ROADMAP: PWA Laboratorio Evolutivo

Este documento contiene el plan de desarrollo en etapas para escalar la PWA "Laboratorio Evolutivo".
REGLA GLOBAL PARA TODAS LAS ETAPAS: Cada función, método, clase o variable importante nueva debe llevar arriba un comentario de 1-2 líneas explicando qué es y qué hace. No romper la funcionalidad existente (modelos de Balanceo y Jansen).

## ETAPA 1: Refactorización Modular y Web Worker (Rendimiento)
**Objetivo:** Sacar el motor del hilo principal para que la interfaz no se congele y separar el código monolítico en ES Modules nativos.

**Instrucciones para el Agente:**
1. Lee el `index.html` monolítico actual.
2. Extrae la lógica en la siguiente estructura de carpetas:
   - `index.html`: Solo maquetado y carga de `<script type="module" src="./js/main.js"></script>`.
   - `styles.css`: Todos los estilos.
   - `js/core/rng.js`: Generador `mulberry32`.
   - `js/core/motor.js`: La clase genérica `Motor`.
   - `js/models/index.js`: Registro central de modelos.
   - `js/models/fases.js`: Lógica del balanceo trifásico (separando `evaluar` de `dibujar`).
   - `js/models/jansen.js`: Lógica de la pata de Jansen de 13 barras (separando `evaluar` de `dibujar`).
   - `js/ui.js`: Manejo del DOM y gráficos del hilo principal.
   - `js/main.js`: Inicialización.
3. Crea `js/core/worker.js`: Un Web Worker real que importe el motor y los modelos, escuche comandos (`iniciar`, `pausar`, `detener`) y emita por `postMessage` el progreso de las generaciones.
4. Conecta `js/main.js` y `js/ui.js` para que la evolución corra 100% en el Worker y el canvas se actualice al recibir mensajes.

**Criterio de aceptación:** La app funciona exactamente igual que antes, pero el código está en archivos separados y la animación/scroll de la página es totalmente fluida mientras evoluciona.

---

## ETAPA 2: Constructor de Modelos Dinámicos (Low-Code)
**Objetivo:** Permitir al usuario crear sus propios modelos matemáticos ingresando variables y código JavaScript directamente desde la interfaz de la PWA.

**Instrucciones para el Agente:**
1. Modifica `index.html` y `js/ui.js` para agregar un modal o panel de "Crear Modelo".
2. UI del Constructor:
   - Formulario para agregar N variables (Nombre, Tipo: Continuo/Entero, Mínimo, Máximo).
   - Un `textarea` (fuente monoespaciada) para escribir el cuerpo de la función de evaluación en JS. La función recibirá `(vars, rng)` donde `vars` es un diccionario dinámico con los valores de los genes (ej: `vars.largo * vars.ancho`).
3. Lógica (`js/builder.js`):
   - Al guardar, usa `new Function('vars', 'rng', codigoUsuario)` para compilar el evaluador.
   - Crea un `dibujar` por defecto genérico que grafique barras horizontales mostrando el valor de cada variable entre su min y max.
4. Persistencia (`js/storage.js`):
   - Guarda las definiciones crudas (JSON) de estos modelos en `localStorage` (con `try/catch`).
   - Al iniciar la app, inyecta los modelos guardados en el registro del Worker y en el selector de la UI.

**Criterio de aceptación:** Puedo ir a la UI, crear un modelo llamado "Caja de Volumen", agregar variables "ancho" y "alto", escribir la fórmula de la superficie, darle a "Guardar", seleccionarlo y el motor evolutivo lo optimiza.

---

## ETAPA 3: Evolución Multiobjetivo (Frente de Pareto)
**Objetivo:** Dejar de usar pesos fijos (`w1`, `w2`) y permitir que el motor encuentre todas las soluciones de compromiso (Frente de Pareto) usando lógica inspirada en NSGA-II.

**Instrucciones para el Agente:**
1. Modifica la clase `Motor` (`js/core/motor.js`) para aceptar evaluadores que devuelvan un `Array` de puntajes en lugar de un solo número.
2. Reemplaza el elitismo y la selección de torneo simples por una clasificación de "Dominancia de Pareto" (Non-dominated sorting):
   - Un individuo A domina a B si es igual o mejor en todos los objetivos, y estrictamente mejor en al menos uno.
3. Modifica la interfaz (`js/ui.js`) para soportar gráficos de dispersión (Scatter Plot) en el canvas de fitness. Si el modelo devuelve 2 objetivos (ej: Suavidad vs Zancada), el eje X es el objetivo 1 y el eje Y es el objetivo 2.
4. Al terminar la corrida, la UI debe mostrar todos los puntos de la frontera de Pareto, y al hacer clic en un punto del gráfico, se dibuja ese genoma específico.

**Criterio de aceptación:** Al correr el modelo de Jansen modificado para devolver múltiples métricas (sin sumarlas con `w`), el motor muestra una curva visual con las distintas opciones (las patas rápidas pero bruscas en un extremo, las lentas y suaves en el otro), permitiendo al usuario elegir la que prefiera al final.