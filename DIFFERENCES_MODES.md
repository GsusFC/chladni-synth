# Chladni Visual Synthesizer  
### Diferencias entre Modo **Básico** y **Optimizado**

| Aspecto | Modo Básico | Modo Optimizado |
|---------|-------------|-----------------|
| **Motor de renderizado** | Canvas 2D con ~130 k partículas (360 × 360) | Canvas 2D re-escrito y depurado, densidad seleccionable (5 k – 50 k) |
| **Consumo de CPU / GPU** | Alto en pantallas grandes (≥ 60 FPS solo en equipos potentes) | 30 - 60 FPS estables en la mayoría de equipos gracias a limitador de FPS y menor recuento de partículas |
| **Uso de memoria** | Proporcional a 130 k partículas | 25 % - 80 % menos memoria según densidad elegida |
| **Audio-reactividad** | ✔ Micrófono y archivos | ✔ Micrófono y archivos + detección de *beat* con indicador LED |
| **Controles superpuestos** | No (los controles viven fuera del lienzo) | Sí, panel overlay flotante dentro de la zona de visualización |
| **Parámetros ajustables** | n, m, sensibilidad, color-mode, tamaño/opacidad de partícula | Idem + auto-shuffle, densidad de partículas, limitador de FPS, indicadores de rendimiento |
| **Escalado Hi-DPI** | Correcto | Corregido (bug de ¼ de área solucionado) |
| **Dependencias** | Solo Web Audio + Canvas | Sin dependencias extra; se eliminaron WebGL y Web Worker para estabilidad |
| **Código** | 1500 líneas aprox. (legacy) | 600 líneas aprox. (refactor limpio) |
| **Mantenimiento** | Difícil; lógica entremezclada | Sencillo; arquitectura modular y tipada |
| **Casos de uso recomendados** | • Demos pequeñas <br>• Visual retro con mucho “grano” <br>• Comparar con papers originales | • Directos en vivo <br>• Proyección en eventos <br>• Equipos modestos / navegadores móviles <br>• Desarrollo y extensiones futuras |

---

## ¿Cuándo elegir cada modo?

### Usa **Básico** si…
1. Quieres la estética clásica con la mayor resolución de nodos posible.  
2. Dispones de hardware potente (GPU dedicada) y no necesitas controles incrustados.  
3. Estás depurando la matemática pura de las ecuaciones.

### Usa **Optimizado** si…
1. Necesitas **rendimiento estable** en cualquier equipo (portátiles, móviles, stream).  
2. Prefieres controles in-situ y feedback visual (FPS, leds de audio y beat).  
3. Vas a integrar la visualización en un set en vivo o una instalación prolongada.  
4. Quieres código más limpio para hackear/hacer forks.

---

## Detalles técnicos adicionales

* **Límite de FPS**  
  El modo Optimizado permite fijar 30 / 60 / 120 FPS. El bucle descarta frames si aún no se cumple el intervalo, reduciendo picos de CPU.

* **Densidad de partículas**  
  ```ts
  low:    5 000
  medium: 10 000   // valor por defecto
  high:   20 000
  ultra:  50 000
  ```
  Ajusta en tiempo real sin reiniciar.

* **Beat detection**  
  Se basa en energía de banda media y umbral adaptativo. Al detectar pulso:
  - LED “BEAT” parpadea.
  - Tamaño de partícula se amplifica levemente (1 × → 1.5 ×).

* **Escalado Retina / Hi-DPI**  
  Ambas versiones escalan por el *devicePixelRatio*, pero en Optimizado el valor se divide en el `renderFrame` para mantener la matriz de coordenadas correcta → evita el recorte a ¼ reportado.

---

## Roadmap

| Feature | Básico | Optimizado |
|---------|--------|------------|
| Off-Screen Canvas / Worker | – | planeado |
| Soporte WebGL | – | experimental (desactivado) |
| Exportar frames a vídeo | vía captura | planeado |
| Modo VR / WebXR | – | en estudio |

---

**Repositorio:** https://github.com/GsusFC/chladni-synth  
Para sugerencias o *pull-requests*, utiliza el modo Optimizado como base.
