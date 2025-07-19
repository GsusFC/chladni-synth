# 🛠️ Detalles Técnicos – Chladni Visual Synthesizer

## 1. Visión general de la arquitectura

```text
React (TSX) ─┬─ ChladniSynthesizer (Canvas 2D / WebGL)
             ├─ ChladniAdvancedControls (UI, MIDI, presets)
             ├─ ChladniMusicIntegration (Audio + EQ + Beat)
             └─ Example.tsx (composición y demo)
```

* **Render thread**: Canvas 2D o WebGL + OffscreenCanvas  
* **Logic thread**: Web Worker opcional para generar posiciones/colores  
* **UI thread**: React + Tailwind/vanilla CSS  
* **Audio thread**: Web Audio API → `AnalyserNode` → callbacks

## 2. Algoritmo principal de generación

### 2.1 Ecuación estándar

```
f(x,y) = cos(n·π·x/L)·cos(m·π·y/L) − cos(m·π·x/L)·cos(n·π·y/L)
```

1. Normalizamos `x,y∈[-1,1]`.
2. Calculamos `f(x,y)` (intensidad).
3. |f| < ε ⇒ punto pertenece a línea nodal.

### 2.2 Ecuaciones personalizadas
Se compila en tiempo real una función segura:

```ts
const safeFn = new Function('x','y','n','m','L','Math', `return ${expr}`);
```

• Sandbox mínimo (sin acceso a objeto global).  
• Validación rápida ejecutando la expresión con un juego de valores canónicos.

### 2.3 Muestreo

* Malla cartesiana de **particle sprites**  
* Densidad seleccionable (`low≈20 k`, `medium≈60 k`, `high≈120 k` vértices).  
* Cada frame se evalúa `f` **solo** si:
  1. hay beat detectado (_audio-responsive_), o  
  2. parámetros han cambiado, o  
  3. transcurrió `1/FPS` cuando se limita.

## 3. Tubería de renderizado

| Paso | Canvas 2D | WebGL |
|------|-----------|-------|
| Vertex gen. | JS / Worker | JS / Worker |
| Transform | CPU (`ctx.putImageData`) | GPU (vertex shader) |
| Color | CPU | Fragment shader |
| Post-FX | CSS filters | WebGL ping-pong FBO + shaders opcionales |

### 3.1 WebGL shaders clave

```glsl
// vertex.glsl
attribute vec2 a_pos;
uniform float u_pointSize;
void main() {
  gl_Position = vec4(a_pos,0.0,1.0);
  gl_PointSize = u_pointSize;
}

// fragment.glsl
precision mediump float;
uniform vec3 u_color;
void main() {
  float d = distance(gl_PointCoord, vec2(0.5));
  if(d>0.5) discard;          // sprite circular
  gl_FragColor = vec4(u_color, 1.0);
}
```

*Instanced rendering* minimiza draw-calls.

## 4. Optimización y multihilo

1. **Web Worker**  
   * Calcula `f(x,y)` y devuelve `Float32Array` con resultados.  
   * Transferencia cero-copy con `postMessage({particles}, [particles.buffer])`.

2. **OffscreenCanvas**  
   * Safari no soporta OffscreenCanvas → _feature detection_.  
   * Si disponible, el contexto se crea en worker → UI thread libre.

3. **Adaptive FPS**  
   * `requestAnimationFrame` + contador → si frame > 10 ms ⇒ reduce densidad o baja a 30 FPS.

4. **Memoria**  
   * Re-uso de buffers; doble página para evitar GC spikes.

5. **Device tiering**  
   ```ts
   const isHighEnd = navigator.hardwareConcurrency >= 6 || navigator.gpu;
   ```

## 5. Integración de audio

| Bloque | Nodo Web Audio |
|--------|----------------|
| Input  | `MediaStreamSource` (mic/file) |
| Gain   | `GainNode` |
| EQ 5B  | `BiquadFilterNode` ×5 |
| Analyse| `AnalyserNode` |
| Dest   | `AudioContext.destination` |

*FFT size* predeterminada 2048 → resolución ≈ 21 Hz @48 kHz.  
El **beat-detector** utiliza energía en 0-250 Hz con decaimiento exponencial.

## 6. Control MIDI

* `navigator.requestMIDIAccess()`  
* Modo **MIDI-learn**:  
  1. Usuario pulsa “Asignar”.  
  2. Primer mensaje `ControlChange` almacena `controlId → param`.  
  3. Mapeo lineal valor (0-127) → rango param.

Latencia típica < 2 ms.

## 7. Post-procesamiento

| Efecto | Implementación |
|--------|----------------|
| Blur   | CSS `filter: blur(px)` o kernel Gaussian en shader |
| Glow   | Blend additive de frame anterior |
| HDR    | Ajuste de brillo/contraste vía CSS o LUT shader |
| Invert | CSS `invert(100%)` |

Para WebGL se usa **ping-pong framebuffer** si `postProcessing.glow>0`.

## 8. Grabación y exportación

* **Canvas**: `HTMLCanvasElement.captureStream()` → `MediaRecorder`.  
* 5-60 fps, `video/webm` (VP9) o `mp4` (experimental).  
* **Audio**: `MediaStreamDestination` → `MediaRecorder` (se guarda `.webm`).  
* Chunks se almacenan en memoria y se unen al `onstop`.

## 9. Consideraciones de rendimiento

| Aspecto | Recomendación |
|---------|---------------|
| CPU budget | < 8 ms/frame (60 FPS) |
| GPU calls | ≤ 2 draw-calls (instancing) |
| Buffer size | Partículas × 16 bytes ≲ 4 MB |
| Texture units | Evitar texturas externas cuando se use blur |
| Mobile | Deshabilitar glow, particleDensity = `low` |
| Safari | Forzar Canvas 2D, sin OffscreenCanvas |

## 10. Tecnologías y dependencias

* **React 18 + TypeScript 5**  
* **Vite 4** – bundling y HMR  
* **WebGL 2.0** con fallback a 1.0  
* **Web Audio API** (Chrome/Edge/Firefox)  
* **Web MIDI API** (solo Chromium desktop)  
* **Media Capture & Streams** (getUserMedia, captureStream)  
* **Tailwind utility classes** mínimas + CSS-in-JS `style jsx`

---

## 11. Futuras mejoras

1. Shader de **marching-squares** para líneas nodales continuas.  
2. Compresión **ASTC** de sprites para GPUs móviles.  
3. Exportación **GIF** vía `gif.js` (worker).  
4. WebGPU backend experimental (cuando Safari/FF lo soporten).

---

_Última actualización: Jul 2025_
