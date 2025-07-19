# 📑 API Reference – Chladni Visual Synthesizer Components

Esta referencia enumera de forma exhaustiva todas las **propiedades (props)**, **métodos públicos** y **eventos (callbacks)** expuestos por cada componente React del proyecto.

> Convención  
> • Los tipos TypeScript se muestran en *italic*.  
> • Las props opcionales están marcadas con **?**.  
> • Los valores por defecto se indican en **bold**.

---

## 1. `<ChladniSynthesizer />`

Visualizador básico (Canvas 2D) apto para cualquier dispositivo.

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `initialN` | *number* | **5** | Modo de vibración horizontal. Rango recomendado `1-20`. |
| `initialM` | *number* | **3** | Modo de vibración vertical. |
| `colorMode` | *'spectrum' \| 'amplitude' \| 'frequency'* | **'spectrum'** | Estrategia de coloración del patrón. |
| `sensitivity?` | *number* | **50** | Intensidad de respuesta al audio (0-100). |
| `beatDetected?` | *boolean* | `false` | Ilumina el patrón durante un beat si se integra con audio. |

### Métodos públicos  
*(expuestos mediante ref → `React.forwardRef`)*

| Método | Firma | Descripción |
|--------|-------|-------------|
| `exportPNG()` | `(): void` | Descarga la imagen actual del canvas en PNG. |
| `reset()` | `(): void` | Restaura `n`, `m` y color al estado inicial. |

---

## 2. `<ChladniSynthesizerOptimized />`

Versión de alto rendimiento con WebGL, OffscreenCanvas y Web Workers.

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| **Todos los props de `<ChladniSynthesizer>`** | | | Heredados. |
| `useWebGL` | *boolean* | **true** | Fuerza el backend WebGL; si `false` cae a Canvas 2D. |
| `particleDensity` | *'low' \| 'medium' \| 'high'* | **'medium'** | Número de partículas por pixel. |
| `useWorker` | *boolean* | **false** | Activa el cálculo de nodos en Web Worker. |
| `useOffscreenCanvas` | *boolean* | **false** | Mueve el render a un hilo aparte cuando el navegador lo permite. |
| `fpsLimit?` | *number* | `undefined` | Límite máximo de FPS (ej. 30 o 60). |

### Eventos

| Prop | Firma | Dispara |
|------|-------|---------|
| `onFrame?(delta: number)` | *function* | Cada frame renderizado (`delta`=ms). |
| `onPerformanceDrop?(fps: number)` | *function* | Cuando el FPS real cae por debajo de `fpsLimit * 0.7`. |

---

## 3. `<ChladniAdvancedControls />`

Panel integral de ecuaciones, presets, MIDI, post-FX y grabación.

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| **Props base** | ver ⬆︎ | | `initialN`, `initialM`, `colorMode`. |
| `enableCustomEquations?` | *boolean* | **true** | Permite que el usuario escriba ecuaciones propias. |
| `enablePresets?` | *boolean* | **true** | Activa sistema de presets localStorage/export-import. |
| `enableMIDI?` | *boolean* | **true** | Habilita aprendizaje y control MIDI. |
| `enablePostProcessing?` | *boolean* | **true** | Muestra controles de blur/glow/contrast… |
| `enableRecording?` | *boolean* | **true** | Permite capturas PNG y vídeo WebM/MP4. |
| `initialPresets?` | *ChladniPreset[]* | `[]` | Lista inicial de presets. |
| `onPresetSave?` | `(preset: ChladniPreset) => void` | – | Callback al guardar un preset. |
| `onPresetLoad?` | `(preset: ChladniPreset) => void` | – | Callback al cargar un preset. |

### Tipos auxiliares

```ts
interface ChladniPreset {
  id: string;
  name: string;
  n: number;
  m: number;
  colorMode: string;
  equationType: 'standard'|'custom';
  equation: string | null;
  particleSize: number;
  particleOpacity: number;
  sensitivity: number;
  postProcessing: PostProcessingSettings;
  midiMappings: MIDIMapping[];
  createdAt: number; // epoch ms
}
```

---

## 4. `<ChladniMusicIntegration />`

Módulo de captura y análisis sonoro: micrófono, archivo o demo.

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `initialVolume?` | *number* | **0.7** | Ganancia inicial (0-1). |
| `autoStart?` | *boolean* | **false** | Empieza con la fuente “demo” nada más montar. |
| `showSpectrogram?` | *boolean* | **true** | Renderiza canvas del espectrograma FFT. |
| `showWaveform?` | *boolean* | **true** | Renderiza canvas de la forma de onda. |
| `onAudioDataUpdate?` | `(data: AudioAnalysisData) => void` | – | Envía paquete completo de análisis cada frame. |
| `onFrequencyBandChange?` | `(bands: FrequencyBand) => void` | – | Bass/LowMid/Mid/HighMid/Treble (0-1). |
| `onAmplitudeChange?` | `(amp: number) => void` | – | Amplitud media 0-1. |
| `onBeatDetect?` | `() => void` | – | Evento al detectar un beat (bpm libre). |

### Métodos

Los métodos se exponen mediante **ref**.

| Método | Firma | Descripción |
|--------|-------|-------------|
| `startMicrophone()` | `(): Promise<void>` | Solicita permisos y comienza captura del micrófono. |
| `startDemoAudio()` | `(): void` | Lanza oscilador seno + LFO como fuente de prueba. |
| `loadAudioFile(file)` | `(file: File) => void` | Reproduce archivo local (`audio/*`). |
| `stop()` | `(): void` | Detiene la fuente y el análisis. |
| `startRecording()` | `(): void` | Captura audio analizado a WebM. |
| `stopRecording()` | `(): void` | Finaliza la grabación y descarga el archivo. |

### Tipos de datos

```ts
interface AudioAnalysisData {
  frequencyData: Uint8Array;   // Espectro FFT normalizado 0-255
  timeDomainData: Uint8Array;  // Forma de onda 0-255
  dominantFrequency: number;   // Hz
  averageAmplitude: number;    // 0-1
  bassLevel: number;           // 0-1
  midLevel: number;            // 0-1
  trebleLevel: number;         // 0-1
  isBeat: boolean;
}

interface FrequencyBand {
  bass: number; lowMid: number; mid: number; highMid: number; treble: number;
}
```

---

## 5. Uso de `ref`

```tsx
const synthRef = useRef<ChladniSynthHandle>(null);

<ChladniSynthesizerOptimized ref={synthRef} />

// Exportar imagen al pulsar un botón
<button onClick={() => synthRef.current?.exportPNG()}>
  Descargar PNG
</button>
```

---

## 6. Eventos y flujo de trabajo recomendado

1. **Integración musical** envía `onAudioDataUpdate → Example.tsx`.  
2. `Example.tsx` decide si actualizar visual (`audioResponsive`).  
3. **Sintetizador** recibe nuevos props y se re-renderiza (o ajusta shaders).  
4. **AdvancedControls** puede disparar `onPresetSave/Load`, alterar el estado global y manipular MIDI.

---

## 7. Tabla resumen

| Componente | Props clave | Métodos | Eventos |
|------------|-------------|---------|---------|
| Synth | `initialN`, `initialM`, `colorMode` | `exportPNG`, `reset` | – |
| SynthOptimized | + `particleDensity`, `useWorker` | _mismos que Synth_ | `onFrame`, `onPerformanceDrop` |
| AdvancedControls | Flags `enable…` | – | `onPresetSave`, `onPresetLoad` |
| MusicIntegration | `onAudioDataUpdate`, `onBeatDetect` | `startMicrophone`, `loadAudioFile`, `startRecording` | ver props |

---

### © 2025 – Chladni Visual Synthesizer  
Licencia MIT
