# 📚 Documentación Principal – Sintetizador Visual Chladni

Bienvenido a la documentación del proyecto **Chladni Visual Synthesizer**.  
Aquí encontrarás:

1. Qué es un sintetizador visual Chladni.  
2. Fundamentos físicos y matemáticos.  
3. Descripción de la arquitectura del proyecto.  
4. Guía de uso de cada uno de los componentes React que lo conforman.  
5. Preguntas frecuentes y recomendaciones de rendimiento.

---

## 1. ¿Qué es un patrón Chladni?

Ernst Chladni (1756-1827) descubrió que al espolvorear arena fina sobre una placa metálica y hacerla vibrar con un arco de violín, la arena se acumula en **líneas nodales** (zonas de mínima oscilación) formando figuras fascinantes.

Un **sintetizador visual Chladni** recrea digitalmente este fenómeno. En lugar de una placa física, se dibuja en pantalla la ecuación que describe la interferencia de ondas estacionarias. Ajustando los parámetros `n` y `m` (modos de vibración), cambiamos la forma del patrón.

---

## 2. Fundamentos matemáticos

Para una placa cuadrada, la ecuación clásica es:

```
f(x, y) = cos(n·π·x/L) · cos(m·π·y/L) − cos(m·π·x/L) · cos(n·π·y/L)
```

donde  

* `n`, `m` – enteros positivos (modos)  
* `x`, `y` – coordenadas normalizadas [-1, 1]  
* `L` – longitud del lado

En este proyecto puedes:

* Usar la **ecuación estándar** (arriba).  
* Definir **ecuaciones personalizadas** con funciones de `Math` (`sin`, `cos`, `sqrt`, etc.).

---

## 3. Arquitectura del proyecto

```
src/
├── components/
│   ├── ChladniSynthesizer.tsx            # Render Canvas 2D/WebGL simple
│   ├── ChladniSynthesizerOptimized.tsx   # Versión WebGL + Workers
│   ├── ChladniAdvancedControls.tsx       # UI de ecuaciones, presets, MIDI, post-procesado
│   └── ChladniMusicIntegration.tsx       # Captura/analiza audio, EQ, espectrograma
├── Example.tsx                           # Demo que combina todo
└── ...
```

### Flujo de datos

1. **ChladniMusicIntegration** analiza audio en tiempo real → emite `audioData`.
2. `Example.tsx` decide si el visual debe reaccionar al audio.  
3. **ChladniSynthesizer[Optimized]** recibe `n`, `m`, color, sensibilidad → dibuja el patrón.  
4. **ChladniAdvancedControls** puede modificar cualquier parámetro, guardar presets, aplicar efectos, controlar vía MIDI o grabar vídeo.

---

## 4. Uso de los componentes

### 4.1 `ChladniSynthesizer`

```tsx
<ChladniSynthesizer
  initialN={5}
  initialM={3}
  colorMode="spectrum"         // 'spectrum' | 'amplitude' | 'frequency'
  sensitivity={50}             // 1-100, reactividad al sonido
/>
```

Opciones mínimas, perfecto para dispositivos limitados.

### 4.2 `ChladniSynthesizerOptimized`

Añade:

* `useWebGL` – fuerza WebGL.  
* `particleDensity` – `'low' | 'medium' | 'high'`.  
* `useWorker` y `useOffscreenCanvas` – paraleliza el cálculo.

### 4.3 `ChladniAdvancedControls`

Interfaz “todo-en-uno”.

Funciones destacadas:

* **Ecuaciones personalizadas** con validación en vivo.  
* **Presets** (localStorage, export/import `.json`).  
* **MIDI learn** – asigna potenciómetros físicos.  
* **Post-procesado** – blur, glow, brillo, contraste, etc.  
* **Grabación** – captura PNG o vídeo WebM/MP4 del canvas.

```tsx
<ChladniAdvancedControls
  initialN={4}
  initialM={6}
  enableMIDI
  enableRecording
/>
```

### 4.4 `ChladniMusicIntegration`

Captura audio de:

* Micrófono  
* Archivo local  
* Señal de demostración (oscilador)

Proporciona:

* Espectrograma y forma de onda.  
* Ecualizador de 5 bandas.  
* Detección de beats (callback `onBeatDetect`).  
* API de grabación de audio.

```tsx
<ChladniMusicIntegration
  onAudioDataUpdate={data => console.log(data.averageAmplitude)}
  onBeatDetect={() => console.log('beat!')}
  autoStart={false}
/>
```

---

## 5. Guía rápida de ejecución

```bash
# instalar dependencias
npm install
# modo desarrollo
npm run dev
# producción
npm run build && npm run preview
```

Visita `http://localhost:3000` y juega con:

1. Modo Básico vs Optimizado.  
2. Pestañas **Controles Básicos-Avanzados-Música**.  
3. Activa “Modo Audio-Responsivo” para ver la reactividad sonora.

---

## 6. FAQ / Consejos

* **¿WebGL es obligatorio?** No. El modo básico usa Canvas 2D.  
* **Rendimiento bajo** → reduce `particleDensity` o desactiva efectos.  
* **El navegador bloquea el micrófono** → comprueba permisos HTTPS.  
* **MIDI no funciona** → sólo está soportado en Chrome/Edge/Opera de escritorio.  
* **Grabación de vídeo mp4** → Chrome solo permite `video/webm`; usa conversión externa.

---

## 7. Créditos y licencia

Inspirado en los trabajos de **Ernst Chladni**.  
Proyecto liberado bajo licencia **MIT**. ¡Disfruta creando arte sonoro-visual!
