// =========================================================================
// MÓDULO C++ (WEBASSEMBLY): NÚCLEO CINEMÁTICO Y MOTOR GENÉTICO JANSEN
// =========================================================================

#include <cmath>
#include <cstdint>
#include <vector>
#include <algorithm>
#include <cstring>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Estructura bidimensional para representar coordenadas y vectores en el plano euclidiano.
struct Punto {
    double x;
    double y;
};

// Longitud fija de la manivela motriz central m en el mecanismo de Theo Jansen.
const double LONGITUD_MANIVELA_JANSEN = 15.0;

// Valores canónicos de las 12 longitudes de referencia descubiertas por Theo Jansen [a, l, b, c, d, e, f, g, h, i, j, k].
const double JANSEN_VALORES_REFERENCIA[12] = {
    38.0, 7.8, 41.5, 39.3, 40.1, 55.8, 39.4, 36.7, 65.7, 49.0, 50.0, 61.9
};

// Generador pseudoaleatorio Mulberry32 determinista para reproducibilidad exacta en C++.
struct PRNGMulberry32 {
    // Estado interno entero de 32 bits.
    uint32_t s;

    // Constructor que inicializa el estado con la semilla dada.
    PRNGMulberry32(uint32_t semilla = 123456) : s(semilla) {}

    // Genera el siguiente número pseudoaleatorio en punto flotante en el rango [0, 1).
    double siguiente() {
        s = (s + 0x6D2B79F5u);
        uint32_t t = s;
        t = (t ^ (t >> 15)) * (1u | t);
        t ^= t + ((t ^ (t >> 7)) * (61u | t));
        return static_cast<double>((t ^ (t >> 14))) / 4294967296.0;
    }
};

// Calcula analíticamente la intersección entre dos circunferencias según el signo de rama s (+1 o -1).
bool interseccionCircunferencias(Punto p1, double r1, Punto p2, double r2, double s, Punto& res) {
    double dx = p2.x - p1.x;
    double dy = p2.y - p1.y;
    double dd = std::hypot(dx, dy);
    if (dd == 0.0 || dd > r1 + r2 || dd < std::abs(r1 - r2)) {
        return false;
    }
    double aa = (r1 * r1 - r2 * r2 + dd * dd) / (2.0 * dd);
    double hh = std::sqrt(std::max(0.0, r1 * r1 - aa * aa));
    double mx = p1.x + (aa * dx) / dd;
    double my = p1.y + (aa * dy) / dd;
    res.x = mx + (s * hh * dy) / dd;
    res.y = my - (s * hh * dx) / dd;
    return true;
}

// Resuelve las posiciones de las articulaciones del mecanismo de Theo Jansen y devuelve la coordenada del pie H.
bool resolverCinematicaJansen(double theta, const double* genoma, Punto& H) {
    double a = genoma[0], l = genoma[1], b = genoma[2], c = genoma[3];
    double d = genoma[4], e = genoma[5], f = genoma[6], g = genoma[7];
    double h = genoma[8], i = genoma[9], j = genoma[10], k = genoma[11];
    double m = LONGITUD_MANIVELA_JANSEN;

    // Pivote fijo del chasis X y extremo de la manivela motriz K girando respecto al origen (0,0).
    Punto X = {-a, -l};
    Punto K = {m * std::cos(theta), m * std::sin(theta)};

    Punto D, E, F, G;
    if (!interseccionCircunferencias(X, b, K, j, -1.0, D)) return false;
    if (!interseccionCircunferencias(X, d, D, e, -1.0, E)) return false;
    if (!interseccionCircunferencias(X, c, K, k, 1.0, F)) return false;
    if (!interseccionCircunferencias(E, f, F, g, 1.0, G)) return false;
    if (!interseccionCircunferencias(G, h, F, i, 1.0, H)) return false;

    return true;
}

// Estructura auxiliar para ordenar muestras verticales durante el cálculo de la fase de apoyo.
struct MuestraY {
    int idx;
    double y;
};

extern "C" {

// Función exportada: evalúa la aptitud multiobjetivo f1..f5, f7 y f9 para un genoma de Jansen con penalizaciones graduales.
double evaluar_jansen_c(
    const double* genoma,
    double w1, double w2, double w3, double w4, double w5, double w7, double w9,
    double zancadaObj,
    int criterioSuavidad,
    double limitePico
) {
    const int N = 180;
    Punto pasos[N];
    int pasosInvalidos = 0;

    for (int s = 0; s < N; s++) {
        double theta = (2.0 * M_PI * s) / N;
        if (!resolverCinematicaJansen(theta, genoma, pasos[s])) {
            pasosInvalidos++;
        }
    }

    // Penalización gradual por cada paso cinemáticamente inalcanzable.
    if (pasosInvalidos > 0) {
        return 1000.0 + 10.0 * pasosInvalidos;
    }

    double minX = 1e18, maxX = -1e18;
    double minY = 1e18, maxY = -1e18;
    for (int s = 0; s < N; s++) {
        if (pasos[s].x < minX) minX = pasos[s].x;
        if (pasos[s].x > maxX) maxX = pasos[s].x;
        if (pasos[s].y < minY) minY = pasos[s].y;
        if (pasos[s].y > maxY) maxY = pasos[s].y;
    }

    double anchoTotal = maxX - minX;
    double alturaTotal = maxY - minY;
    double diagCaja = std::hypot(anchoTotal, alturaTotal);

    // Penalización por salto discontinuo entre posiciones consecutivas del pie.
    for (int s = 0; s < N; s++) {
        const Punto& hAct = pasos[s];
        const Punto& hSig = pasos[(s + 1) % N];
        if (std::hypot(hSig.x - hAct.x, hSig.y - hAct.y) > 0.25 * diagCaja) {
            return 500.0;
        }
    }

    if (alturaTotal <= 1e-6 || anchoTotal <= 1e-6) {
        return 800.0;
    }

    // Fase de apoyo: 35% de las muestras con menor coordenada Y.
    int numApoyo = static_cast<int>(std::round(N * 0.35));
    MuestraY ordenados[N];
    for (int s = 0; s < N; s++) {
        ordenados[s] = {s, pasos[s].y};
    }
    std::sort(ordenados, ordenados + N, [](const MuestraY& a, const MuestraY& b) {
        return a.y < b.y;
    });

    bool enApoyo[N] = {false};
    double minYApoyo = 1e18, maxYApoyo = -1e18;
    double minXApoyo = 1e18, maxXApoyo = -1e18;
    double sumaYApoyo = 0.0;

    for (int s = 0; s < numApoyo; s++) {
        int idx = ordenados[s].idx;
        enApoyo[idx] = true;
        const Punto& H = pasos[idx];
        if (H.y < minYApoyo) minYApoyo = H.y;
        if (H.y > maxYApoyo) maxYApoyo = H.y;
        if (H.x < minXApoyo) minXApoyo = H.x;
        if (H.x > maxXApoyo) maxXApoyo = H.x;
        sumaYApoyo += H.y;
    }

    double anchoApoyo = maxXApoyo - minXApoyo;
    if (anchoApoyo <= 1e-6) {
        return 800.0;
    }

    double mediaYApoyo = sumaYApoyo / numApoyo;
    double m = LONGITUD_MANIVELA_JANSEN;

    // Métricas f1..f4:
    double f1 = (maxYApoyo - minYApoyo) / alturaTotal;
    double f2 = 1.0 - std::min(1.0, anchoApoyo / (zancadaObj * m));
    double f3 = std::max(0.0, 0.3 - (maxY - mediaYApoyo) / anchoApoyo) / 0.3;

    std::vector<double> dxPasos;
    for (int s = 0; s < N; s++) {
        int sig = (s + 1) % N;
        if (enApoyo[s] && enApoyo[sig]) {
            dxPasos.push_back(pasos[sig].x - pasos[s].x);
        }
    }

    double f4 = 1.0;
    if (dxPasos.size() >= 3) {
        double promDx = 0.0, promAbsDx = 0.0;
        for (double d : dxPasos) {
            promDx += d;
            promAbsDx += std::abs(d);
        }
        promDx /= dxPasos.size();
        promAbsDx /= dxPasos.size();
        double var = 0.0;
        for (double d : dxPasos) {
            var += (d - promDx) * (d - promDx);
        }
        double desvio = std::sqrt(var / dxPasos.size());
        if (promAbsDx > 1e-6) {
            f4 = std::min(1.0, desvio / promAbsDx);
        }
    }

    // Métrica f5: Suavidad de aceleración en ciclo cerrado circular.
    double dTheta = (2.0 * M_PI) / N;
    double dTheta2 = dTheta * dTheta;
    double aNorm[N];
    double maxA = 0.0, sumaA = 0.0;

    for (int t = 0; t < N; t++) {
        const Punto& pSig = pasos[(t + 1) % N];
        const Punto& pAct = pasos[t];
        const Punto& pAnt = pasos[(t - 1 + N) % N];
        double ax = (pSig.x - 2.0 * pAct.x + pAnt.x) / dTheta2;
        double ay = (pSig.y - 2.0 * pAct.y + pAnt.y) / dTheta2;
        aNorm[t] = std::hypot(ax, ay) / m;
        if (aNorm[t] > maxA) maxA = aNorm[t];
        sumaA += aNorm[t];
    }

    double promA = sumaA / N;
    double varA = 0.0;
    for (int t = 0; t < N; t++) {
        varA += (aNorm[t] - promA) * (aNorm[t] - promA);
    }
    double desvioA = std::sqrt(varA / N);
    double cocienteA = promA > 1e-6 ? (desvioA / promA) : 0.0;

    double f5 = 1.0;
    if (criterioSuavidad == 1) { // 1: variacion
        f5 = std::min(1.0, cocienteA / 2.0);
    } else { // 0: pico
        double lim = limitePico > 0.0 ? limitePico : 30.0;
        f5 = std::min(1.0, maxA / lim);
    }

    // Métrica f7 (Verticalidad de ataque en caída hacia el suelo).
    double suelo_y = maxYApoyo;
    int i_in = -1;
    for (int t = 0; t < N; t++) {
        int prev = (t - 1 + N) % N;
        if (pasos[t].y <= suelo_y && pasos[prev].y > suelo_y) {
            i_in = t;
            break;
        }
    }

    double dx_ataque = anchoTotal;
    double f7 = 1.0;
    if (i_in != -1) {
        double yMidTarget = minY + (alturaTotal * 0.5);
        int i_mid = -1;
        int curr = i_in;
        for (int step = 0; step < N; step++) {
            curr = (curr - 1 + N) % N;
            if (pasos[curr].y >= yMidTarget) {
                i_mid = curr;
                break;
            }
        }
        if (i_mid != -1) {
            dx_ataque = std::abs(pasos[i_in].x - pasos[i_mid].x);
            f7 = dx_ataque / (anchoTotal > 1e-6 ? anchoTotal : 1.0);
        }
    }

    // Métrica f9: Eficiencia espacial / Aprovechamiento del paso en suelo vs aire.
    double f9 = anchoTotal > 1e-6 ? ((anchoTotal - anchoApoyo) / anchoTotal) : 1.0;

    return w1 * f1 + w2 * f2 + w3 * f3 + w4 * f4 + w5 * f5 + w7 * f7 + w9 * f9;
}

// Estructura para ordenar individuos por fitness en C++.
struct IndividuoC {
    int idx;
    double fitness;
};

// Función exportada: ejecuta una tanda de N generaciones del algoritmo genético íntegramente en C++.
double correr_tanda_jansen_c(
    int generaciones,
    int tamanoPoblacion,
    double tasaMutacion,
    int elitismo,
    int tamanoTorneo,
    uint32_t semilla,
    double amplitud,
    double w1, double w2, double w3, double w4, double w5, double w7, double w9,
    double zancadaObj,
    int criterioSuavidad,
    double limitePico,
    int inicializar,
    double* inoutPoblacion,
    double* inoutFitness,
    double* outMejorGenoma,
    double* outPromedioFitness
) {
    PRNGMulberry32 rng(semilla);

    // Rangos de búsqueda derivados de la amplitud sobre los valores de Theo Jansen.
    double minGen[12];
    double maxGen[12];
    for (int g = 0; g < 12; g++) {
        minGen[g] = std::max(0.1, JANSEN_VALORES_REFERENCIA[g] * (1.0 - amplitud));
        maxGen[g] = JANSEN_VALORES_REFERENCIA[g] * (1.0 + amplitud);
    }

    // Inicialización aleatoria si se solicita la primera tanda.
    if (inicializar != 0) {
        for (int i = 0; i < tamanoPoblacion; i++) {
            double* ind = inoutPoblacion + (i * 12);
            for (int g = 0; g < 12; g++) {
                ind[g] = minGen[g] + rng.siguiente() * (maxGen[g] - minGen[g]);
            }
            inoutFitness[i] = evaluar_jansen_c(ind, w1, w2, w3, w4, w5, w7, w9, zancadaObj, criterioSuavidad, limitePico);
        }
    }

    // Buffer temporal para la descendencia generada en cada paso.
    std::vector<double> nuevaPoblacion(tamanoPoblacion * 12);
    std::vector<double> nuevoFitness(tamanoPoblacion);
    std::vector<IndividuoC> ranking(tamanoPoblacion);

    for (int gen = 0; gen < generaciones; gen++) {
        for (int i = 0; i < tamanoPoblacion; i++) {
            ranking[i] = {i, inoutFitness[i]};
        }
        std::sort(ranking.begin(), ranking.end(), [](const IndividuoC& a, const IndividuoC& b) {
            return a.fitness < b.fitness;
        });

        // 1. Elitismo directo
        int cantElite = std::min(elitismo, tamanoPoblacion);
        for (int e = 0; e < cantElite; e++) {
            int srcIdx = ranking[e].idx;
            std::memcpy(nuevaPoblacion.data() + (e * 12), inoutPoblacion + (srcIdx * 12), 12 * sizeof(double));
            nuevoFitness[e] = inoutFitness[srcIdx];
        }

        // 2. Torneo, cruce uniforme y mutación
        for (int h = cantElite; h < tamanoPoblacion; h++) {
            // Torneo para padre 1
            int p1Idx = ranking[static_cast<int>(rng.siguiente() * tamanoPoblacion)].idx;
            for (int t = 1; t < tamanoTorneo; t++) {
                int cand = ranking[static_cast<int>(rng.siguiente() * tamanoPoblacion)].idx;
                if (inoutFitness[cand] < inoutFitness[p1Idx]) p1Idx = cand;
            }

            // Torneo para padre 2
            int p2Idx = ranking[static_cast<int>(rng.siguiente() * tamanoPoblacion)].idx;
            for (int t = 1; t < tamanoTorneo; t++) {
                int cand = ranking[static_cast<int>(rng.siguiente() * tamanoPoblacion)].idx;
                if (inoutFitness[cand] < inoutFitness[p2Idx]) p2Idx = cand;
            }

            const double* padre1 = inoutPoblacion + (p1Idx * 12);
            const double* padre2 = inoutPoblacion + (p2Idx * 12);
            double* hijo = nuevaPoblacion.data() + (h * 12);

            // Cruce uniforme y mutación
            for (int g = 0; g < 12; g++) {
                hijo[g] = rng.siguiente() < 0.5 ? padre1[g] : padre2[g];
                if (rng.siguiente() < tasaMutacion) {
                    double delta = (rng.siguiente() - 0.5) * 0.25 * (maxGen[g] - minGen[g]);
                    hijo[g] = std::min(maxGen[g], std::max(minGen[g], hijo[g] + delta));
                }
            }

            nuevoFitness[h] = evaluar_jansen_c(hijo, w1, w2, w3, w4, w5, w7, w9, zancadaObj, criterioSuavidad, limitePico);
        }

        std::memcpy(inoutPoblacion, nuevaPoblacion.data(), tamanoPoblacion * 12 * sizeof(double));
        std::memcpy(inoutFitness, nuevoFitness.data(), tamanoPoblacion * sizeof(double));
    }

    // Ranking final de la tanda
    for (int i = 0; i < tamanoPoblacion; i++) {
        ranking[i] = {i, inoutFitness[i]};
    }
    std::sort(ranking.begin(), ranking.end(), [](const IndividuoC& a, const IndividuoC& b) {
        return a.fitness < b.fitness;
    });

    int mejorIdx = ranking[0].idx;
    double mejorFit = inoutFitness[mejorIdx];
    std::memcpy(outMejorGenoma, inoutPoblacion + (mejorIdx * 12), 12 * sizeof(double));

    double sumaFitness = 0.0;
    for (int i = 0; i < tamanoPoblacion; i++) {
        sumaFitness += inoutFitness[i];
    }
    if (outPromedioFitness) {
        *outPromedioFitness = sumaFitness / tamanoPoblacion;
    }

    return mejorFit;
}

} // extern "C"
