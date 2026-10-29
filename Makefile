# =========================================================================
# MAKEFILE DE COMPILACIÓN PARA EL NÚCLEO WEBASSEMBLY (WASM)
# =========================================================================
# Compila src-wasm/sim_core.cpp al binario binario autónomo js/core/sim_core.wasm
# utilizando Emscripten (emcc) y exportando las funciones C para el Worker.

EMCC = emcc
CXXFLAGS = -O3 -std=c++17 -Wall -Wextra
SRC = src-wasm/sim_core.cpp
OUT_WASM = js/core/sim_core.wasm

# Funciones de la biblioteca C exportadas hacia JavaScript / WebAssembly
EXPORTED_FUNCTIONS = "['_evaluar_jansen_c', '_correr_tanda_jansen_c']"

# Opciones de enlace autónomo WebAssembly (WASM independiente sin runtime pesado)
EMCC_FLAGS = -s STANDALONE_WASM=1 \
             -s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
             --no-entry \
             -s ALLOW_MEMORY_GROWTH=1

# Regla principal para compilar el binario WebAssembly
all: $(OUT_WASM)

# Regla de compilación de sim_core.wasm desde el fuente C++
$(OUT_WASM): $(SRC)
	@mkdir -p js/core
	$(EMCC) $(CXXFLAGS) $(SRC) -o $(OUT_WASM) $(EMCC_FLAGS)
	@echo "✓ Binario WebAssembly compilado con éxito en: $(OUT_WASM)"

# Limpieza del binario compilado
clean:
	rm -f $(OUT_WASM)
	@echo "✓ Archivos compilados eliminados."

.PHONY: all clean
