# 🧬 Laboratorio Evolutivo

Optimizador genético con modelos matemáticos intercambiables, evolución multiobjetivo con Frente de Pareto (NSGA-II), Estudio de Modelado CAD 2D interactivo, constructor *low-code* dinámico, diseño **Google Material 3** con modos y paletas de color, y soporte móvil táctil integral con sensores.

🌐 **Demo en Vivo (GitHub Pages):** [https://federicocalonso.github.io/laboratorio-evolutivo/](https://federicocalonso.github.io/laboratorio-evolutivo/)

---

## 🚀 Características Principales

- **Diseño Google Material 3 (M3) & Experiencia Móvil Touch:**
  - Sistema de tokens de diseño semánticos (`--md-sys-color-*`, elevación 1 a 4, formas redondeadas y tipografía moderna).
  - Modos de visualización: **☀️ Claro**, **🌙 Oscuro** y **🌓 Automático** sincronizado con el sistema operativo.
  - Paletas tonales dinámicas de acento: **Océano** (azul), **Esmeralda** (verde), **Amatista** (púrpura) y **Terracota** (ámbar), con persistencia en `localStorage`.
  - **Barra de Navegación Inferior M3 (`Bottom Navigation`)** para uso ergonómico con el pulgar en celulares.
  - **Gestos Multitáctiles:** Pinch-to-zoom con dos dedos, paneo suave de lienzo, arrastre directo de nodos con respuesta háptica (`navigator.vibrate`) y auto-encuadre por doble toque.
  - **Sensores del Celular:** Control en tiempo real del giro de la manivela y de las variables del modelo mediante el **giroscopio / inclinación** (`DeviceOrientation`), y generación de nueva semilla al **agitar el dispositivo (`Shake`)**.

- **Estudio de Modelado CAD 2D de Mecanismos y Multifísica:**
  - Editor gráfico vectorial integrado para diseñar cadenas cinemáticas: nodos libres, fijos, correderas lineales, barras rígidas, cuerpos poligonales, actuadores rotativos/lineales, trenes de engranajes y transmisiones por poleas.
  - Análisis cinemático de Grados de Libertad (Criterio de Grübler-Kutzbach).
  - Sincronización bidireccional reactiva: arrastrar nodos en el lienzo actualiza en tiempo real las cotas y variables de optimización.
  - Puntos de medida y sensores virtuales con telemetría de zancada, velocidad, aceleración, campos electromagnéticos y temperatura.

- **Gestión Integral de Simulaciones (CRUD + Presets):**
  - **➕ Nuevo:** Diseña simulaciones matemáticas personalizadas desde cero.
  - **✏️ Editar:** Modifica variables de decisión, límites y funciones de costo en caliente.
  - **📑 Copiar:** Duplica cualquier simulación (nativa o dinámica) para experimentar con variantes.
  - **🏷️ Renombrar:** Personaliza títulos y descripciones.
  - **⭐ Guardar Presets:** Almacena escenarios completos (modelo activo, variables configuradas y parámetros del motor genético).
  - **📤 Exportar / 📥 Importar:** Comparte simulaciones y presets mediante archivos o texto `.json`.
  - **📚 Biblioteca Modal:** Explora, filtra, busca y ejecuta todas las simulaciones y escenarios guardados en un solo lugar.

- **Motor Genético Dual y Multiobjetivo (NSGA-II Pareto):**
  - Algoritmo genético determinista reproducible (`mulberry32`), selección por torneo binario, ruleta y rango, cruce SBX, aritmético y de un punto, y mutación adaptativa.
  - Soporte **Monobjetivo** (convergencia escalar) y **Multiobjetivo NSGA-II** (clasificación por dominancia no dominada, distancia de apiñamiento (*crowding distance*) y Frente de Pareto interactivo con inspección por clic o toque en Canvas).
  - Web Workers dedicados para ejecución 100% no bloqueante a 60 FPS con soporte para WebAssembly (WASM).

- **16 Modelos de Simulación Integrados:**
  1. **Pata Jansen (13 Barras):** Escultura cinética de Theo Jansen (*Strandbeest*) con cinemática exacta y métricas multiobjetivo.
  2. **Brazo Robótico Planar (3 Eslabones):** Cinemática inversa para alcance de objetivos con evasión de obstáculos prohibidos.
  3. **Aterrizaje de Cohete (Falcon Landing):** Dinámica retropropulsada no lineal en 2D con empuje vectorial, viento cruzado y arrastre.
  4. **Sintonizador PID (Control Automático):** Ajuste evolutivo de ganancias $(K_p, K_i, K_d)$ sobre plantas de segundo orden para minimización ITAE.
  5. **Campo de Potencial y Deflexión 2D:** Trayectorias en presencia de cargas electrostáticas y fuerzas repulsivas/atractivas.
  6. **Transferencia Orbital (Hohmann / Kepler):** Maniobra orbital bi-impulsiva con minimización de $\Delta v$ y error de inserción.
  7. **Síntesis de Filtro Analógico RLC:** Optimización de componentes pasivos para respuesta en frecuencia pasa-bajos.
  8. **Armadura de Puente (Estructuras 2D):** Análisis por elementos finitos de celosía reticular para minimización de masa y deflexión.
  9. **Disipación Térmica en Placa 2D:** Ecuación de Poisson para optimización de aletas disipadoras y fuentes de calor.
  10. **Arreglo Acústico y Beamforming:** Formación de haz ultrasónico 2D con desfases para cancelación de lóbulos secundarios.
  11. **Trampa Electromagnética (Fuerza de Lorentz):** Confinamiento de partículas cargadas mediante campos magnéticos no uniformes.
  12. **Superficie Fonoabsorbente:** Cuñas porosas multimaterial con cálculo acústico de absorción en dBA (IEC 61672-1).
  13. **Línea de Transmisión RF (Carta de Smith):** Adaptación de impedancias de microondas para ROE mínima.
  14. **Corte de Chapa y Anidado 2D (Nesting):** Algoritmo de empaquetamiento y optimización de retal industrial.
  15. **Balanceo de Fases Trifásico (R, S, T):** Distribución combinatoria de cargas en redes eléctricas para equilibrar fases.
  16. **Pata Caminante (Cuatro Barras):** Mecanismo de cuatro barras optimizado para marcha bípeda estable.

---

## 📂 Estructura del Proyecto

```text
├── index.html              # Top App Bar M3, Bottom Navigation móvil, modales y lienzos interactivos
├── styles.css              # Sistema Google Material 3, temas, responsive mobile-first y layout CAD
├── js/
│   ├── main.js             # Bootstrap y ciclo de vida de la aplicación MVVM
│   ├── ui.js               # Utilidades de formularios dinámicos y helpers de interfaz
│   ├── storage.js          # Persistencia en localStorage (modelos, presets y preferencias)
│   ├── builder.js          # Compilador dinámico low-code y serializador JSON
│   ├── core/
│   │   ├── motor.js        # Motor genético mono y multiobjetivo (NSGA-II)
│   │   ├── rng.js          # Generador pseudoaleatorio Mulberry32 reproducible
│   │   └── worker.js       # Web Worker aislado para cómputo evolutivo en segundo plano
│   ├── viewmodels/
│   │   └── app-viewmodel.js # ViewModel reactivo central (EventTarget, estado y comandos)
│   ├── views/
│   │   ├── app-view.js     # Vista orquestadora principal y control de sensores móviles
│   │   ├── estudio-view.js # Vista del Estudio de Modelado y workspace low-code
│   │   ├── editor-grafico-view.js # Editor vectorial CAD 2D de mecanismos multicuerpo
│   │   ├── grafico-view.js # Renderizador de curva de convergencia y dispersión de Pareto
│   │   ├── modales-view.js # Gestor de diálogos modales y biblioteca de simulaciones
│   │   └── visualizers.js  # Visualizadores cinemáticos y multifísicos interactivos
│   ├── engines/            # 4 Motores fundamentales de simulación física y cinemática
│   ├── models/             # 16 Modelos nativos especializados
│   └── plantillas/         # Plantillas prediseñadas para el Estudio de Modelado
├── src-wasm/
│   └── sim_core.cpp        # Núcleo cinemático acelerado en C++ para WebAssembly
├── Makefile                # Script de compilación a WASM
├── LICENSE                 # Términos de copyright
└── README.md
```

---

## 🛠️ Ejecución Local

Dado que utiliza ES Modules nativos y Web Workers, se debe servir mediante un servidor HTTP local:

```bash
# Servidor HTTP con Python:
python3 -m http.server 8080

# Abrir en el navegador:
http://localhost:8080/
```

---

## 📄 Derechos de Autor y Licencia

**Copyright (C) 2026 Federico C. Alonso. Todos los derechos reservados.**

Este proyecto es software privativo y confidencial. Queda estrictamente prohibida su copia, distribución, reproducción, modificación o uso comercial o no comercial sin autorización previa y por escrito del autor. Consulte el archivo [`LICENSE`](./LICENSE) para más detalles.
