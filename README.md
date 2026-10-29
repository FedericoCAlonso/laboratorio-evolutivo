# 🧬 Laboratorio Evolutivo

Optimizador genético genérico con modelos matemáticos intercambiables, constructor *low-code* dinámico y ejecución en segundo plano mediante Web Workers y ES Modules nativos.

---

## 🚀 Características

- **Motor Genético Puro y Agnóstico:** Implementación en JavaScript del algoritmo genético con generador determinista reproducible (`mulberry32`), selección por torneo, cruce uniforme, mutación tipificada y ejecución asíncrona no bloqueante.
- **Arquitectura Multihilo (Web Worker):** El cálculo intensivo corre 100% aislado en un Web Worker dedicado, manteniendo la interfaz fluida a 60 FPS con animaciones cinemáticas en tiempo real.
- **Pila Tecnológica Pura:** Vanilla JS, ES Modules nativos, HTML5 y CSS3 responsivo (soporte para temas claro y oscuro). Sin dependencias externas, frameworks ni bundlers.
- **Modelos Integrados:**
  1. **Balanceo de Fases Trifásico (R, S, T):** Minimización de desbalance de corrientes eléctricas con restricciones de fases fijas obligatorias.
  2. **Pata Caminante (Cuatro Barras):** Mecanismo articulado optimizado para apoyo rectilíneo y retorno aéreo elevado.
  3. **Pata Jansen (13 Barras):** Escultura cinética de Theo Jansen (*Strandbeest*) con métricas biomecánicas multiobjetivo (planitud, zancada, suavidad de aceleración, verticalidad de ataque, eficiencia espacial) y filtros duros de gálibo y superación de obstáculos.
- **Constructor Low-Code Dinámico:** Editor integrado para definir modelos matemáticos personalizados en caliente con $N$ variables de decisión y código de evaluación en JavaScript seguro (`new Function`), persistidos en `localStorage`.

---

## 📂 Estructura del Proyecto

```text
├── index.html              # Punto de entrada de la PWA y maquetado semántico
├── styles.css              # Hoja de estilos con variables CSS y temas visuales
├── js/
│   ├── main.js             # Controlador principal y gestión de eventos de la app
│   ├── ui.js               # Renderizado del DOM, formularios dinámicos y Canvas 2D
│   ├── storage.js          # Persistencia en localStorage protegida con try/catch
│   ├── builder.js          # Compilador y evaluador de modelos dinámicos low-code
│   ├── core/
│   │   ├── motor.js        # Clase genérica Motor (algoritmo genético)
│   │   ├── rng.js          # Generador pseudoaleatorio Mulberry32 con semilla
│   │   └── worker.js       # Web Worker dedicado para cómputo en segundo plano
│   └── models/
│       ├── index.js        # Registro centralizado de modelos (estáticos y dinámicos)
│       ├── fases.js        # Modelo 1: Balanceo trifásico
│       ├── caminante.js    # Modelo 2: Mecanismo de cuatro barras
│       └── jansen.js       # Modelo 3: Pata cinética de Jansen de 13 barras
├── src-wasm/
│   └── sim_core.cpp        # Núcleo cinemático acelerado en C++ para WebAssembly
├── Makefile                # Script de compilación opcional a WASM
├── LICENSE                 # Términos de copyright privativo
└── README.md
```

---

## 🛠️ Ejecución Local

Dado que utiliza ES Modules y Web Workers, se debe servir mediante cualquier servidor HTTP local:

```bash
# Con Python:
python3 -m http.server 8080

# Abrir en el navegador:
http://localhost:8080/
```

---

## 📄 Derechos de Autor y Licencia

**Copyright (C) 2026 Federico C. Alonso. Todos los derechos reservados.**

Este proyecto es software privativo y confidencial. Queda estrictamente prohibida su copia, distribución, reproducción, modificación o uso comercial o no comercial sin autorización previa y por escrito del autor. Consulte el archivo [`LICENSE`](./LICENSE) para más detalles.
