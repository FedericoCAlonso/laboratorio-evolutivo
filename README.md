# 🧬 Laboratorio Evolutivo

Optimizador genético con modelos matemáticos intercambiables, evolución multiobjetivo con Frente de Pareto (NSGA-II), constructor *low-code* dinámico, gestión completa de simulaciones y diseño **Google Material 3** con modos y paletas de color.

---

## 🚀 Características Principales

- **Diseño Google Material 3 (M3) & Modos de Color:**
  - Sistema de tokens de diseño semánticos (`--md-sys-color-*`, elevación 1 a 4, formas redondeadas y tipografía moderna).
  - Modos de visualización: **☀️ Claro**, **🌙 Oscuro** y **🌓 Automático** sincronizado con el sistema operativo.
  - Paletas tonales dinámicas de acento: **Océano** (azul), **Esmeralda** (verde), **Amatista** (púrpura) y **Terracota** (ámbar), con persistencia en `localStorage`.
  - Notificaciones flotantes estilo **Snackbar / Toast Material 3** (`#toast-m3`).

- **Gestión Integral de Simulaciones (CRUD + Presets):**
  - **➕ Nuevo:** Diseña simulaciones matemáticas personalizadas desde cero.
  - **✏️ Editar:** Modifica variables de decisión, límites y funciones de costo en caliente.
  - **📑 Copiar:** Duplica cualquier simulación (nativa o dinámica) para experimentar con variantes.
  - **🏷️ Renombrar:** Personaliza títulos y descripciones.
  - **⭐ Guardar Presets:** Almacena escenarios completos (modelo activo, variables configuradas y parámetros del motor genético).
  - **📤 Exportar / 📥 Importar:** Comparte simulaciones y presets mediante archivos o texto `.json`.
  - **📚 Biblioteca Modal:** Explora, filtra, busca y ejecuta todas las simulaciones y escenarios guardados en un solo lugar.

- **Motor Genético Dual y Multiobjetivo (NSGA-II Pareto):**
  - Algoritmo genético determinista reproducible (`mulberry32`), selección por torneo binario, cruce uniforme y mutación adaptativa.
  - Soporte **Monobjetivo** (convergencia escalar) y **Multiobjetivo NSGA-II** (clasificación por dominancia no dominada, distancia de apiñamiento (*crowding distance*) y Frente de Pareto interactivo con inspección por clic en Canvas).
  - Web Workers dedicados para ejecución 100% no bloqueante a 60 FPS con soporte para WebAssembly (WASM).

- **6 Modelos de Simulación Integrados:**
  1. **Pata Jansen (13 Barras):** Escultura cinética de Theo Jansen (*Strandbeest*) con métricas multiobjetivo (planitud de apoyo, zancada, suavidad y gálibo).
  2. **Brazo Robótico Planar (3 Eslabones):** Cinemática inversa para alcance de objetivos cartesianos $(X, Y)$ con evasión geométrica de obstáculos circulares prohibidos y minimización de esfuerzo articular.
  3. **Aterrizaje de Cohete (Falcon Landing):** Dinámica retropropulsada no lineal en 2D con empuje vectorial multietapa, viento cruzado, arrastre aerodinámico y conservación de propelente.
  4. **Sintonizador PID (Control Automático):** Ajuste evolutivo de ganancias $(K_p, K_i, K_d)$ sobre plantas de segundo orden para minimización del error ITAE y control de sobreimpulso porcentual.
  5. **Balanceo de Fases Trifásico (R, S, T):** Distribución combinatoria de cargas en redes eléctricas para equilibrar fases y evitar sobrecargas de neutro.
  6. **Pata Caminante (Cuatro Barras):** Mecanismo de cuatro barras optimizado para marcha bípeda estable.

---

## 📂 Estructura del Proyecto

```text
├── index.html              # Top App Bar M3, toolbar CRUD, modales y layouts responsivos
├── styles.css              # Sistema de diseño Google Material 3, temas claro/oscuro y paletas
├── js/
│   ├── main.js             # Controlador central, bindings M3 y canal con Web Worker
│   ├── ui.js               # Renderizado del DOM, Canvas 2D, modales, toasters y selector M3
│   ├── storage.js          # Persistencia en localStorage (modelos, presets y preferencias)
│   ├── builder.js          # Compilador dinámico low-code, clonador, renombrador y serializador JSON
│   ├── core/
│   │   ├── motor.js        # Motor genético mono y multiobjetivo (NSGA-II)
│   │   ├── rng.js          # Generador pseudoaleatorio Mulberry32 reproducible
│   │   └── worker.js       # Web Worker aislado para cómputo evolutivo en segundo plano
│   └── models/
│       ├── index.js        # Registro maestro de modelos (estáticos y dinámicos)
│       ├── jansen.js       # Modelo 1: Pata cinética de Jansen de 13 barras
│       ├── brazo.js        # Modelo 2: Brazo robótico planar con evasión de obstáculos
│       ├── cohete.js       # Modelo 3: Aterrizaje retropropulsado de cohete
│       ├── pid.js          # Modelo 4: Sintonizador evolutivo de controlador PID
│       ├── fases.js        # Modelo 5: Balanceo de fases trifásico
│       └── caminante.js    # Modelo 6: Pata caminante de cuatro barras
├── src-wasm/
│   └── sim_core.cpp        # Núcleo cinemático acelerado en C++ para WebAssembly
├── Makefile                # Script de compilación a WASM
├── LICENSE                 # Términos de copyright privativo
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
