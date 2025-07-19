import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- Configuración simplificada ---
const RAND_NM = 20; // Valores máximos para parámetros n y m
const SHUFFLE_INTERVAL = 300; // frames entre cambios automáticos
const FFT_SIZE = 2048; // Tamaño de FFT para análisis de audio

// Densidad de partículas más conservadora para mejor rendimiento
const PARTICLE_DENSITY = {
  low: 5000,
  medium: 10000,
  high: 20000,
  ultra: 50000
};

// --- Tipos ---
interface Particle {
  x: number;
  y: number;
  color: string;
}

interface ChladniParams {
  n: number;
  m: number;
}

interface AudioData {
  analyzer: AnalyserNode;
  dataArray: Uint8Array;
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null;
}

// Mantenemos la misma interfaz de props para compatibilidad
export interface ChladniSynthesizerOptimizedProps {
  initialN?: number;
  initialM?: number;
  colorMode?: 'spectrum' | 'amplitude' | 'frequency';
  useWebGL?: boolean;
  particleDensity?: 'low' | 'medium' | 'high' | 'ultra';
  useOffscreenCanvas?: boolean;
  useWorker?: boolean;
  fpsLimit?: number;
  /** Sensibilidad al audio (1-100) */
  sensitivity?: number;
  /** Indica si se ha detectado un beat para efectos visuales */
  beatDetected?: boolean;
  /** Muestra/oculta la superposición de controles interna. */
  showControls?: boolean;
}

const ChladniSynthesizerOptimized: React.FC<ChladniSynthesizerOptimizedProps> = (props) => {
  const {
    initialN = 5,
    initialM = 3,
    colorMode = 'spectrum',
    useWebGL = true,
    particleDensity = 'medium',
    useOffscreenCanvas = false,
    useWorker = false,
    fpsLimit = 60,
    sensitivity = 50,
    beatDetected = false
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDataRef = useRef<AudioData | null>(null);
  const audioFileRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Referencias WebGL
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const buffersRef = useRef<{
    position: WebGLBuffer | null;
    color: WebGLBuffer | null;
    count: number;
  }>({ position: null, color: null, count: 0 });

  // Referencias Web Worker y OffscreenCanvas
  const workerRef = useRef<Worker | null>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);
  const isOffscreenSupported = useRef<boolean>(false);

  // Detectar soporte para OffscreenCanvas
  useEffect(() => {
    isOffscreenSupported.current = typeof OffscreenCanvas !== 'undefined';
  }, []);
  const particlesRef = useRef<Particle[]>([]);
  const chladniParamsRef = useRef<ChladniParams>({ n: initialN, m: initialM });
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Estados para la UI
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<'microphone' | 'file'>('microphone');
  const [sensitivityState, setSensitivity] = useState<number>(sensitivity);
  const [nParam, setNParam] = useState<number>(initialN);
  const [mParam, setMParam] = useState<number>(initialM);
  const [autoShuffle, setAutoShuffle] = useState<boolean>(false);
  const [selectedColorMode, setSelectedColorMode] = useState<string>(colorMode);
  const [particleSize, setParticleSize] = useState<number>(2);
  const [particleOpacity, setParticleOpacity] = useState<number>(0.8);
  const [actualFPS, setActualFPS] = useState<number>(0);

  // --- WebGL Shaders ---
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec4 a_color;

    uniform mat3 u_matrix;
    uniform float u_pointSize;

    varying vec4 v_color;

    void main() {
      vec3 position = u_matrix * vec3(a_position, 1.0);
      gl_Position = vec4(position.xy, 0.0, 1.0);
      gl_PointSize = u_pointSize;
      v_color = a_color;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec4 v_color;

    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
      if(length(coord) > 0.5) {
        discard;
      }

      gl_FragColor = v_color;
    }
  `;

  // --- WebGL Helper Functions ---
  const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      console.error("Could not compile shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
      console.error("Could not link program:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  // --- Funciones matemáticas y auxiliares ---
  const PI = Math.PI;
  const cos = Math.cos;

  // Función Chladni: calcula el valor en un punto (x,y) para parámetros n,m
  const chladni = (x: number, y: number, n: number, m: number): number => {
    const L = 2; // Espacio de coordenadas [-1, 1]
    return cos(n * PI * x / L) * cos(m * PI * y / L) - cos(m * PI * x / L) * cos(n * PI * y / L);
  };
  
  // Genera nuevos parámetros aleatorios
  const shuffle = () => {
    const n = Math.floor(Math.random() * RAND_NM) + 1;
    let m = Math.floor(Math.random() * RAND_NM) + 1;
    
    // Evitar n=m para patrones más interesantes
    while (m === n) {
      m = Math.floor(Math.random() * RAND_NM) + 1;
    }
    
    chladniParamsRef.current = { n, m };
    setNParam(n);
    setMParam(m);
  };

  // Limitar un valor entre mínimo y máximo
  const constrain = (val: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, val));
  };

  // --- Inicialización WebGL ---
  const initWebGL = (canvas: HTMLCanvasElement): boolean => {
    try {
      const gl = canvas.getContext('webgl2') ||
                 canvas.getContext('webgl') ||
                 canvas.getContext('experimental-webgl') as WebGLRenderingContext;

      if (!gl) {
        console.warn('WebGL not supported, falling back to Canvas 2D');
        return false;
      }

      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

      if (!vertexShader || !fragmentShader) {
        console.error('Failed to create shaders');
        return false;
      }

      const program = createProgram(gl, vertexShader, fragmentShader);

      if (!program) {
        console.error('Failed to create WebGL program');
        return false;
      }

      // Create buffers
      const positionBuffer = gl.createBuffer();
      const colorBuffer = gl.createBuffer();

      if (!positionBuffer || !colorBuffer) {
        console.error('Failed to create WebGL buffers');
        return false;
      }

      // Store references
      glRef.current = gl;
      programRef.current = program;
      buffersRef.current = {
        position: positionBuffer,
        color: colorBuffer,
        count: 0
      };

      // Enable blending for transparency
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      return true;
    } catch (error) {
      console.error('Error initializing WebGL:', error);
      return false;
    }
  };

  // Convertir datos de frecuencia a color (Canvas 2D)
  const getColorFromFrequency = (value: number, max: number): string => {
    const normalizedValue = value / max;

    switch (selectedColorMode) {
      case 'spectrum':
        // Mapear valor a matiz HSL (0-360)
        const hue = normalizedValue * 360;
        return `hsla(${hue}, 100%, 50%, ${particleOpacity})`;

      case 'amplitude':
        // Colores más brillantes para amplitudes más altas
        const brightness = 40 + normalizedValue * 60;
        return `rgba(20, 100, ${brightness}%, ${particleOpacity})`;

      case 'frequency':
        // Diferentes matices para diferentes bandas de frecuencia
        if (value < (max / 3)) {
          // Baja (rojo)
          return `rgba(255, 50, 50, ${particleOpacity})`;
        } else if (value < (max * 2 / 3)) {
          // Media (verde)
          return `rgba(50, 255, 50, ${particleOpacity})`;
        } else {
          // Alta (azul)
          return `rgba(50, 50, 255, ${particleOpacity})`;
        }

      default:
        return `rgba(255, 255, 255, ${particleOpacity})`;
    }
  };

  // Convertir datos de frecuencia a color (WebGL - retorna array RGBA)
  const getColorFromFrequencyWebGL = (value: number, max: number): [number, number, number, number] => {
    const normalizedValue = Math.min(value / max, 1);
    const alpha = 0.8;

    let r = 1, g = 1, b = 1;

    switch (selectedColorMode) {
      case 'spectrum':
        // Convertir HSL a RGB
        const hue = normalizedValue * 360;
        const c = 1; // Chroma (saturation = 100%)
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = 0.5 - c / 2; // Lightness = 50%

        if (hue < 60) { r = c; g = x; b = 0; }
        else if (hue < 120) { r = x; g = c; b = 0; }
        else if (hue < 180) { r = 0; g = c; b = x; }
        else if (hue < 240) { r = 0; g = x; b = c; }
        else if (hue < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        r += m; g += m; b += m;
        break;

      case 'amplitude':
        const brightness = 0.4 + normalizedValue * 0.6;
        r = 0.2; g = 1; b = brightness;
        break;

      case 'frequency':
        if (value < (max / 3)) {
          r = 1; g = 0.2; b = 0.2;
        } else if (value < (max * 2 / 3)) {
          r = 0.2; g = 1; b = 0.2;
        } else {
          r = 0.2; g = 0.2; b = 1;
        }
        break;

      default:
        r = 1; g = 1; b = 1;
    }

    return [r, g, b, alpha];
  };

  // --- Web Worker Functions ---
  const initWorker = (): boolean => {
    try {
      if (!useWorker || !isOffscreenSupported.current) {
        return false;
      }

      const canvas = canvasRef.current;
      if (!canvas) return false;

      // Create OffscreenCanvas
      const offscreen = canvas.transferControlToOffscreen();
      offscreenCanvasRef.current = offscreen;

      // Create Worker
      const worker = new Worker('/chladni-worker.js');
      workerRef.current = worker;

      // Set up worker message handler
      worker.onmessage = (event) => {
        const { type, data } = event.data;

        switch (type) {
          case 'initialized':
            console.log('Worker WebGL initialized');
            // Send initial particles
            worker.postMessage({
              type: 'setParticles',
              data: particlesRef.current
            });
            // Start animation
            worker.postMessage({ type: 'start' });
            break;

          case 'requestAudioData':
            // Send audio data to worker
            let audioInfluence = 0;
            let frequencyData: Uint8Array | null = null;

            if (isPlaying && audioDataRef.current) {
              audioDataRef.current.analyzer.getByteFrequencyData(audioDataRef.current.dataArray);
              frequencyData = audioDataRef.current.dataArray;

              const sum = frequencyData.reduce((acc, val) => acc + val, 0);
              audioInfluence = sum / frequencyData.length / 255 * (sensitivityState / 50);
            }

            worker.postMessage({
              type: 'audioData',
              data: { audioInfluence, frequencyData }
            });
            break;

          case 'error':
            console.error('Worker error:', data);
            break;
        }
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
      };

      // Initialize worker
      worker.postMessage({
        type: 'init',
        data: {
          canvas: offscreen,
          particleSize,
          particleOpacity,
          colorMode: selectedColorMode
        }
      }, [offscreen]);

      return true;
    } catch (error) {
      console.error('Error initializing worker:', error);
      return false;
    }
  };

  const updateWorkerSettings = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'updateSettings',
        data: {
          particleSize,
          particleOpacity,
          colorMode: selectedColorMode
        }
      });
    }
  };

  const updateWorkerParams = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'updateParams',
        data: chladniParamsRef.current
      });
    }
  };

  // Inicializar audio context y analizador
  const initAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = FFT_SIZE;
      analyzer.smoothingTimeConstant = 0.8; // Suavizado para mejor efecto visual
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioDataRef.current = {
        analyzer,
        dataArray,
        source: null
      };
      
      if (audioSource === 'microphone') {
        await initMicrophoneInput();
      }
      
      setIsPlaying(true);
    } catch (error) {
      console.error("Error inicializando audio:", error);
      setIsPlaying(false);
    }
  };
  /* ------------------------------------------------------------------
     INITIALISATION:  create particles, set up resize, start loop
  -------------------------------------------------------------------*/
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* ---------- minimal WebGL init (optional) ---------- */
    if (useWebGL && !glRef.current) {
      initWebGL(canvas);
    }

    /* ---------- initial particles ---------- */
    createParticles();

    /* ---------- resize handling ---------- */
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr  = window.devicePixelRatio || 1;
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      if (glRef.current) glRef.current.viewport(0, 0, canvas.width, canvas.height);
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    /* ---------- start render loop ---------- */
    lastFrameTimeRef.current = performance.now();
    renderFrame();

    /* ---------- cleanup ---------- */
    return () => {
      ro.disconnect();
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (audioContextRef.current)  audioContextRef.current.close();
    };
  }, [createParticles, renderFrame, useWebGL]);

  /* ------------------------------------------------------------------
     RENDER ONLY THE CANVAS – controls live elsewhere
  -------------------------------------------------------------------*/
  return (
    <div className="industrial-chladni-container">
      <canvas ref={canvasRef} className="industrial-canvas" />
    </div>
  );
  // Manejar archivo de audio
  const handleAudioFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audioFileRef.current = audio;
    
    if (audioContextRef.current && audioDataRef.current) {
      // Detener fuente anterior si existe
      if (audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      
      audio.oncanplay = () => {
        if (!audioContextRef.current || !audioDataRef.current) return;
        
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(audioDataRef.current.analyzer);
        source.connect(audioContextRef.current.destination); // Conectar a altavoces
        audioDataRef.current.source = source;
        
        if (isPlaying) {
          audio.play();
        }
      };
    }
  };

  // Alternar reproducción de audio
  const toggleAudio = () => {
    if (isPlaying) {
      if (audioSource === 'file' && audioFileRef.current) {
        audioFileRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (!audioDataRef.current) {
        initAudio();
      } else if (audioSource === 'file' && audioFileRef.current) {
        audioFileRef.current.play();
        setIsPlaying(true);
      } else {
        setIsPlaying(true);
      }
    }
  };

  // Cambiar fuente de audio
  const handleSourceChange = (source: 'microphone' | 'file') => {
    setAudioSource(source);
    if (isPlaying) {
      if (source === 'microphone') {
        if (audioFileRef.current) {
          audioFileRef.current.pause();
        }
        initMicrophoneInput();
      }
      // La entrada de archivo se manejará cuando se seleccione un archivo
    }
  };

  // Manejar cambios de parámetros
  const handleParamChange = (param: 'n' | 'm', value: number) => {
    if (param === 'n') {
      setNParam(value);
    } else {
      setMParam(value);
    }
    
    chladniParamsRef.current = {
      n: param === 'n' ? value : nParam,
      m: param === 'm' ? value : mParam
    };
  };

  // Renderizado WebGL
  const renderWebGL = (particles: Particle[], audioInfluence: number, frequencyData: Uint8Array | null) => {
    const gl = glRef.current;
    const program = programRef.current;
    const buffers = buffersRef.current;

    if (!gl || !program || !buffers.position || !buffers.color) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (particles.length === 0) return;

    // Prepare position and color data
    const positions = new Float32Array(particles.length * 2);
    const colors = new Float32Array(particles.length * 4);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Position
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = p.y;

      // Color
      let colorArray: [number, number, number, number];
      if (frequencyData && isPlaying) {
        const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
        const value = frequencyData[binIndex];
        colorArray = getColorFromFrequencyWebGL(value, 255);
      } else {
        colorArray = [1, 1, 1, particleOpacity];
      }

      colors[i * 4] = colorArray[0];
      colors[i * 4 + 1] = colorArray[1];
      colors[i * 4 + 2] = colorArray[2];
      colors[i * 4 + 3] = colorArray[3];
    }

    // Update WebGL buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    buffers.count = particles.length;

    // Draw particles
    gl.useProgram(program);

    // Set up position attribute
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set up color attribute
    const colorLocation = gl.getAttribLocation(program, "a_color");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Set up uniforms
    const matrixLocation = gl.getUniformLocation(program, "u_matrix");
    const pointSizeLocation = gl.getUniformLocation(program, "u_pointSize");

    // Create transformation matrix (identity for now)
    const matrix = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];

    gl.uniformMatrix3fv(matrixLocation, false, matrix);

    // Adjust point size based on beat detection
    let finalPointSize = particleSize;
    if (beatDetected) {
      finalPointSize *= 1.5;
    }

    gl.uniform1f(pointSizeLocation, finalPointSize);

    // Draw
    gl.drawArrays(gl.POINTS, 0, buffers.count);
  };

  // Crear partículas
  const createParticles = useCallback(() => {
    const particleCount = PARTICLE_DENSITY[particleDensity];
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        x: Math.random() * 2 - 1, // [-1, 1]
        y: Math.random() * 2 - 1, // [-1, 1]
        color: `rgba(255, 255, 255, ${particleOpacity})`
      });
    }

    particlesRef.current = newParticles;
    return newParticles;
  }, [particleDensity, particleOpacity]);

  // Función principal de renderizado
  const renderFrame = useCallback(() => {
    // Solicitar siguiente frame primero para mejor rendimiento
    animationFrameId.current = requestAnimationFrame(renderFrame);
    
    // Limitación de FPS
    if (fpsLimit) {
      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;
      const fpsInterval = 1000 / fpsLimit;
      
      if (elapsed < fpsInterval) {
        return;
      }
      
      // Calcular FPS real
      setActualFPS(Math.round(1000 / elapsed));
      lastFrameTimeRef.current = now - (elapsed % fpsInterval);
    }
    
    frameCountRef.current++;
    if (autoShuffle && frameCountRef.current % SHUFFLE_INTERVAL === 0) {
      shuffle();
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Obtener dimensiones del canvas
    //  canvas.width / height están en píxeles físicos (multiplicados por DPR)
    //  Convertimos a unidades CSS lógicas para que coincidan con el sistema
    //  de coordenadas ya escalado mediante ctx.scale(dpr, dpr).
    const dpr = window.devicePixelRatio || 1;
    const width  = canvas.width  / dpr;
    const height = canvas.height / dpr;
    
    // Omitir si el canvas no tiene dimensiones
    if (width === 0 || height === 0) return;
    
    const particles = particlesRef.current;
    
    // Actualizar partículas basado en audio si está disponible
    let audioInfluence = 0;
    let frequencyData: Uint8Array | null = null;
    
    if (isPlaying && audioDataRef.current) {
      audioDataRef.current.analyzer.getByteFrequencyData(audioDataRef.current.dataArray);
      frequencyData = audioDataRef.current.dataArray;

      // Calcular amplitud promedio
      const sum = Array.from(frequencyData).reduce((acc, val) => acc + val, 0);
      audioInfluence = sum / frequencyData.length / 255 * (sensitivityState / 50);
    } else {
      // Simular movimiento suave sin audio para testing y visualización
      audioInfluence = 0.1 + Math.sin(Date.now() * 0.001) * 0.05;
    }
    
    // Si está usando Worker, no renderizar en main thread
    if (useWorker && workerRef.current) {
      return; // Worker maneja el renderizado
    }

    // Decidir entre WebGL y Canvas 2D en main thread
    const useWebGLRendering = useWebGL && glRef.current && programRef.current;

    if (useWebGLRendering) {
      // Renderizado WebGL
      renderWebGL(particles, audioInfluence, frequencyData);
      return;
    }

    // Fallback a Canvas 2D
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    
    // Actualizar partículas
    const { n, m } = chladniParamsRef.current;
    
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const scale = Math.min(width, height) / 2.0;
    
    // Efecto de pulso para beat detection
    let particleSizeMultiplier = 1.0;
    if (beatDetected) {
      particleSizeMultiplier = 1.5;
    }
    
    // Actualizar y dibujar cada partícula
    particles.forEach(p => {
      // Lógica de actualización de partículas con influencia de audio
      const speed = 0.035 * (1 + audioInfluence);
      const vibrationMax = 0.003 * (1 + audioInfluence * 2);
      const vibrationX = Math.random() * 2 * vibrationMax - vibrationMax;
      const vibrationY = Math.random() * 2 * vibrationMax - vibrationMax;
      const randomNum = Math.random() * 0.7 - 0.2;
      
      const amount = chladni(p.x, p.y, n, m);
      
      // Descenso estocástico de gradiente con influencia de audio
      if (amount >= 0) {
        if (chladni(p.x + vibrationMax, p.y, n, m) >= amount) {
          p.x -= randomNum * amount * speed + vibrationX;
        } else {
          p.x += randomNum * amount * speed + vibrationX;
        }
        if (chladni(p.x, p.y + vibrationMax, n, m) >= amount) {
          p.y -= randomNum * amount * speed + vibrationY;
        } else {
          p.y += randomNum * amount * speed + vibrationY;
        }
      } else { // amount < 0
        if (chladni(p.x + vibrationMax, p.y, n, m) <= amount) {
          p.x += randomNum * amount * speed + vibrationX;
        } else {
          p.x -= randomNum * amount * speed + vibrationX;
        }
        if (chladni(p.x, p.y + vibrationMax, n, m) <= amount) {
          p.y += randomNum * amount * speed + vibrationY;
        } else {
          p.y -= randomNum * amount * speed + vibrationY;
        }
      }
      
      // Mantener partículas dentro de los límites
      p.x = constrain(p.x, -1, 1);
      p.y = constrain(p.y, -1, 1);
      
      // Color basado en datos de frecuencia de audio
      if (frequencyData && isPlaying) {
        // Mapear posición de partícula a bin de frecuencia
        const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
        const value = frequencyData[binIndex];
        p.color = getColorFromFrequency(value, 255);
      } else {
        p.color = `rgba(255, 255, 255, ${particleOpacity})`;
      }
      
      // Dibujar partícula
      ctx.fillStyle = p.color;
      const finalSize = particleSize * particleSizeMultiplier;
      ctx.fillRect(p.x * scale, p.y * scale, finalSize, finalSize);
    });
    
    ctx.restore();
  }, [isPlaying, audioSource, sensitivityState, particleSize, particleOpacity, selectedColorMode, autoShuffle, fpsLimit, beatDetected]);

  // Efecto de inicialización
  useEffect(() => {
    // Configurar canvas
    const canvas = canvasRef.current;
      // Intentar inicializar Worker con OffscreenCanvas primero (solo si ambos están habilitados)
      if (useWorker && useOffscreenCanvas && isOffscreenSupported.current) {
        const workerInitialized = initWorker();
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      let width = rect.width;
      let height = rect.height;
      
      // Asegurar dimensiones mínimas
      if (width < 100) width = canvas.parentElement?.offsetWidth || 800;
      if (height < 100) height = canvas.parentElement?.offsetHeight || 600;
      
      // Actualizar tamaño del canvas
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      // Configurar contexto según el modo de renderizado
      if (useWorker && workerRef.current) {
        // Enviar resize al worker
        workerRef.current.postMessage({
          type: 'resize',
          data: {
            width: canvas.width,
            height: canvas.height
          }
        });
      } else if (useWebGL && glRef.current) {
        // WebGL viewport
        glRef.current.viewport(0, 0, canvas.width, canvas.height);
      } else if (useOffscreenCanvas && isOffscreenSupported.current && !useWorker) {
        // OffscreenCanvas sin worker
        if (offscreenCanvasRef.current) {
          offscreenCanvasRef.current.width = canvas.width;
          offscreenCanvasRef.current.height = canvas.height;

          if (glRef.current) {
            glRef.current.viewport(0, 0, canvas.width, canvas.height);
          }
        }
      } else {
        // Canvas 2D scaling
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };
    
    // Observador de redimensionamiento
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      resizeCanvas();
    });
    
    // Forzar redimensionamiento inicial
    setTimeout(resizeCanvas, 0);
    
    resizeObserver.observe(canvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    
    setupCanvas();
    
    // Iniciar bucle de animación
    lastFrameTimeRef.current = performance.now();
    renderFrame();
    
    return () => {
      resizeObserver.disconnect();

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }

      // Limpiar Web Worker
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'stop' });
        workerRef.current.terminate();
        workerRef.current = null;
      }

      // Limpiar recursos de audio
      if (audioDataRef.current && audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [createParticles, renderFrame]);
  
  // Efecto para detección de beat
  useEffect(() => {
    if (beatDetected && autoShuffle) {
      shuffle();
    }
  }, [beatDetected, autoShuffle]);

  // Efecto para actualizar configuraciones del Worker
  useEffect(() => {
    updateWorkerSettings();
  }, [particleSize, particleOpacity, selectedColorMode]);

  // Efecto para actualizar parámetros Chladni del Worker
  useEffect(() => {
    updateWorkerParams();
  }, [nParam, mParam]);

  // Debug: verificar showControls
  console.log('ChladniSynthesizerOptimized showControls:', showControls);

  return (
    <div className="industrial-chladni-container">
      <canvas ref={canvasRef} className="industrial-canvas" />

      {/* Controles superpuestos */}
      {showControls && (
        <div className="industrial-module industrial-overlay">
          <div className="industrial-module-header">
            <span className="industrial-module-title">Controles Chladni</span>
          </div>
          <div className="industrial-module-content">
            {/* Controles de audio */}
            <div className="industrial-flex industrial-justify-between industrial-mb-md">
              <button 
                className="industrial-button"
                onClick={toggleAudio}
              >
                <span className={`industrial-icon ${isPlaying ? 'industrial-icon-stop' : 'industrial-icon-play'}`}></span>
                {isPlaying ? 'Detener Audio' : 'Iniciar Audio'}
              </button>
              
              <div className="industrial-radio-group">
                <label className="industrial-radio-label">
                  <input 
                    type="radio" 
                    className="industrial-radio"
                    checked={audioSource === 'microphone'} 
                    onChange={() => handleSourceChange('microphone')} 
                  />
                  <span>Micrófono</span>
                </label>
                <label className="industrial-radio-label">
                  <input 
                    type="radio" 
                    className="industrial-radio"
                    checked={audioSource === 'file'} 
                    onChange={() => handleSourceChange('file')} 
                  />
                  <span>Archivo</span>
                </label>
              </div>
            </div>
            
            {audioSource === 'file' && (
              <div className="industrial-file-input-container industrial-mb-md">
                <input 
                  type="file" 
                  id="audio-file" 
                  accept="audio/*" 
                  onChange={handleAudioFile} 
                  className="industrial-file-input" 
                />
                <label htmlFor="audio-file" className="industrial-button">
                  <span className="industrial-icon industrial-icon-upload"></span>
                  Seleccionar Audio
                </label>
              </div>
            )}
            
            {/* Control de sensibilidad */}
            <div className="industrial-flex industrial-items-center industrial-gap-sm industrial-mb-md">
              <span className="industrial-label">SENS:</span>
              <div className="industrial-flex-grow">
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={sensitivityState} 
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  className="industrial-fader-horizontal"
                />
              </div>
              <span className="industrial-value">{sensitivityState}%</span>
            </div>
            
            {/* Parámetros Chladni */}
            <div className="industrial-data-grid industrial-mb-md">
              <div className="industrial-data-row">
                <span className="industrial-data-label">N:</span>
                <input 
                  type="number" 
                  min="1" 
                  max={RAND_NM} 
                  value={nParam} 
                  onChange={(e) => handleParamChange('n', parseInt(e.target.value))}
                  className="industrial-input industrial-w-16"
                />
                
                <span className="industrial-data-label industrial-ml-md">M:</span>
                <input 
                  type="number" 
                  min="1" 
                  max={RAND_NM} 
                  value={mParam} 
                  onChange={(e) => handleParamChange('m', parseInt(e.target.value))}
                  className="industrial-input industrial-w-16"
                />
                
                <button 
                  onClick={shuffle}
                  className="industrial-button industrial-ml-md"
                >
                  <span className="industrial-icon industrial-icon-random"></span>
                  Aleatorio
                </button>
              </div>
            </div>
            
            {/* Checkbox para auto shuffle */}
            <div className="industrial-flex industrial-items-center industrial-mb-md">
              <label className="industrial-checkbox-label">
                <input 
                  type="checkbox" 
                  className="industrial-checkbox"
                  checked={autoShuffle} 
                  onChange={(e) => setAutoShuffle(e.target.checked)} 
                />
                <span>Auto Shuffle</span>
              </label>
            </div>
            
            {/* Controles visuales */}
            <div className="industrial-flex industrial-items-center industrial-gap-sm industrial-mb-md">
              <span className="industrial-label">COLOR:</span>
              <select 
                value={selectedColorMode} 
                onChange={(e) => setSelectedColorMode(e.target.value)}
                className="industrial-select"
              >
                <option value="spectrum">Espectro</option>
                <option value="amplitude">Amplitud</option>
                <option value="frequency">Bandas de Frecuencia</option>
              </select>
            </div>
            
            <div className="industrial-flex industrial-items-center industrial-gap-sm industrial-mb-md">
              <span className="industrial-label">TAMAÑO:</span>
              <div className="industrial-flex-grow">
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  step="0.5"
                  value={particleSize} 
                  onChange={(e) => setParticleSize(parseFloat(e.target.value))}
                  className="industrial-fader-horizontal"
                />
              </div>
              <span className="industrial-value">{particleSize}</span>
            </div>
            
            <div className="industrial-flex industrial-items-center industrial-gap-sm">
              <span className="industrial-label">OPACIDAD:</span>
              <div className="industrial-flex-grow">
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1"
                  value={particleOpacity} 
                  onChange={(e) => setParticleOpacity(parseFloat(e.target.value))}
                  className="industrial-fader-horizontal"
                />
              </div>
              <span className="industrial-value">{particleOpacity.toFixed(1)}</span>
            </div>
            
            {/* Información de rendimiento */}
            <div className="industrial-status-bar industrial-mt-md">
              <span className="industrial-status-item">
                <span className="industrial-status-label">FPS:</span>
                <span className="industrial-status-value">{actualFPS}</span>
              </span>
              <span className="industrial-status-item">
                <span className="industrial-status-label">PART:</span>
                <span className="industrial-status-value">{PARTICLE_DENSITY[particleDensity].toLocaleString()}</span>
              </span>
              <span className="industrial-status-item">
                <span className="industrial-status-label">AUDIO:</span>
                <span className={`industrial-led ${isPlaying ? 'industrial-led-on' : ''}`}></span>
              </span>
              <span className="industrial-status-item">
                <span className="industrial-status-label">BEAT:</span>
                <span className={`industrial-led ${beatDetected ? 'industrial-led-on industrial-pulse' : ''}`}></span>
              </span>
              <span className="industrial-status-item">
                <span className="industrial-status-label">RENDER:</span>
                <span className="industrial-status-value">
                  {useWorker && workerRef.current ? 'WRK' :
                   useWebGL && glRef.current ? 'GL' : '2D'}
                </span>
              </span>
              <span className="industrial-status-item">
                <span className="industrial-status-label">OFFSCREEN:</span>
                <span className={`industrial-led ${useOffscreenCanvas && isOffscreenSupported.current ? 'industrial-led-on' : ''}`}></span>
              </span>
              <span className="industrial-status-item">
                <span className="industrial-status-label">PARTICLES:</span>
                <span className="industrial-status-value">{PARTICLE_DENSITY[particleDensity].toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChladniSynthesizerOptimized;
