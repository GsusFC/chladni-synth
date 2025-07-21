import React, { useRef, useEffect, useState, useCallback } from 'react';

// Interfaces para datos de audio
interface AudioAnalysisData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  dominantFrequency: number;
  averageAmplitude: number;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  isBeat: boolean;
}

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
  // Props de Worker eliminadas - funcionalidad no implementada
  fpsLimit?: number;
  /** Sensibilidad al audio (1-100) */
  sensitivity?: number;
  /** Indica si se ha detectado un beat para efectos visuales */
  beatDetected?: boolean;

  /** Controles de movimiento (antes hardcodeados) */
  /** Velocidad base de movimiento de partículas (0.001-0.1) */
  particleSpeed?: number;
  /** Intensidad de vibración/temblor (0.0001-0.01) */
  vibrationIntensity?: number;
  /** Factor de aleatoriedad en el movimiento (0.1-2.0) */
  randomnessFactor?: number;
  /** Intensidad del pulso en beats (1.0-5.0) */
  beatPulseIntensity?: number;

  /** Efectos visuales avanzados */
  particleShape?: 'square' | 'circle' | 'triangle' | 'star';
  blendMode?: 'normal' | 'additive' | 'multiply';
  trailEffect?: number; // 0.0-1.0, 0 = sin estela, 1 = estela máxima

  /** Controles de audio expandidos */
  audioSource?: 'microphone' | 'file' | 'stream';
  audioFile?: File | null;
  streamUrl?: string;
  isAudioPlaying?: boolean;
  onAudioFileChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAudioSourceChange?: (source: 'microphone' | 'file' | 'stream') => void;
  onToggleAudio?: () => void;
  /** Muestra/oculta la superposición de controles interna. */
  showControls?: boolean;
  /** Tamaño de las partículas (1-10) */
  particleSize?: number;
  /** Opacidad de las partículas (0.1-1.0) */
  particleOpacity?: number;
  /** Activar cambio automático de parámetros */
  autoShuffle?: boolean;
  /** Forma del canvas/placa */
  canvasShape?: 'square' | 'circle';
  /** Datos de audio externos (ej. del piano virtual) */
  audioData?: AudioAnalysisData | null;
}

const ChladniSynthesizerOptimized: React.FC<ChladniSynthesizerOptimizedProps> = (props) => {
  console.log('🔍 ChladniSynthesizerOptimized renderizado con props:', { particleDensity: props.particleDensity });

  const {
    initialN = 5,
    initialM = 3,
    colorMode = 'spectrum',
    useWebGL = true,
    particleDensity = 'medium',
    // Props de Worker eliminadas
    fpsLimit = 60,
    sensitivity = 50,
    beatDetected = false,
    particleSize: propParticleSize = 2,
    particleOpacity: propParticleOpacity = 0.8,
    autoShuffle: propAutoShuffle = false,
    canvasShape = 'square',

    // Controles de movimiento (antes hardcodeados)
    particleSpeed = 0.035,
    vibrationIntensity = 0.003,
    randomnessFactor = 0.7,
    beatPulseIntensity = 1.5,

    // Efectos visuales avanzados
    particleShape = 'square',
    blendMode = 'normal',
    trailEffect = 0.0,

    // Datos de audio externos
    audioData = null
  } = props;

  // Referencias principales
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

  // Referencias Web Worker eliminadas - funcionalidad no implementada

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
  const [autoShuffle, setAutoShuffle] = useState<boolean>(propAutoShuffle);
  const [selectedColorMode, setSelectedColorMode] = useState<string>(colorMode);
  const [particleSize, setParticleSize] = useState<number>(propParticleSize);
  const [particleOpacity, setParticleOpacity] = useState<number>(propParticleOpacity);
  const [currentParticleDensity, setCurrentParticleDensity] = useState<'low' | 'medium' | 'high' | 'ultra'>(particleDensity);
  const [currentCanvasShape, setCurrentCanvasShape] = useState<'square' | 'circle'>(canvasShape);
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
    uniform int u_particleShape; // 0=square, 1=circle, 2=triangle, 3=star

    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
      float dist = length(coord);
      float alpha = 1.0;

      if (u_particleShape == 1) { // Circle
        if (dist > 0.5) discard;
        alpha = 1.0 - smoothstep(0.4, 0.5, dist); // Soft edge
      } else if (u_particleShape == 2) { // Triangle
        float angle = atan(coord.y, coord.x);
        float triangleDist = 0.5 / cos(mod(angle + 3.14159/6.0, 2.0*3.14159/3.0) - 3.14159/6.0);
        if (dist > triangleDist * 0.8) discard;
      } else if (u_particleShape == 3) { // Star
        float angle = atan(coord.y, coord.x);
        float starRadius = 0.3 + 0.2 * cos(5.0 * angle);
        if (dist > starRadius) discard;
      } else if (u_particleShape == 0) { // Square (default)
        // No discard, keep square shape
      }

      gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
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

  // Mapear frecuencia de audio a parámetros Chladni
  const getChladniParamsFromFrequency = (frequency: number, amplitude: number): { n: number, m: number } => {
    if (frequency === 0 || amplitude === 0) {
      // Sin audio, usar parámetros base
      return { n: nParam, m: mParam };
    }

    // Mapear frecuencias musicales a patrones Chladni específicos
    // Usar escalas musicales para mapeos más armónicos

    // Frecuencias de notas musicales (C4 = 261.63 Hz como referencia)
    const C4 = 261.63;
    const noteRatio = frequency / C4; // Relación con C4

    // Mapear a octavas musicales (cada octava duplica la frecuencia)
    const octave = Math.log2(Math.max(noteRatio, 0.1)); // Octava relativa a C4

    // Mapear octavas a parámetros N y M de forma musical
    // Octavas bajas (graves) -> patrones simples
    // Octavas altas (agudos) -> patrones complejos

    const baseN = nParam;
    const baseM = mParam;

    // Escalar basado en octava musical (-3 a +3 octavas aproximadamente)
    const octaveScale = Math.max(0.3, Math.min(3.0, 1 + octave * 0.5));

    // Modular N basado en frecuencia
    const modulatedN = Math.max(1, Math.min(20, Math.round(baseN * octaveScale)));

    // Modular M de forma complementaria para crear patrones interesantes
    // Usar la amplitud para añadir variación
    const amplitudeScale = 1 + amplitude * 2; // 1.0 a 3.0
    const modulatedM = Math.max(1, Math.min(20, Math.round(baseM * amplitudeScale / octaveScale)));

    // Asegurar que N y M no sean iguales para patrones más interesantes
    const finalM = modulatedM === modulatedN ? Math.max(1, modulatedM - 1) : modulatedM;

    return { n: modulatedN, m: finalM };
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

  // Verificar si una partícula está dentro de los límites de la forma
  const isInsideShape = (x: number, y: number, shape: string): boolean => {
    switch (shape) {
      case 'square':
        // Canvas cuadrado = cuadrado perfecto sin compensaciones
        const squareSize = 1.0;
        return x >= -squareSize && x <= squareSize && y >= -squareSize && y <= squareSize;

      case 'circle':
        // Canvas cuadrado = círculo perfecto (mismo tamaño que el cuadrado)
        const circleRadius = 1.0;
        return (x * x + y * y) <= (circleRadius * circleRadius);

      default:
        return x >= -1 && x <= 1 && y >= -1 && y <= 1;
    }
  };

  // Función removida: getCanvasAspect() - Ya no necesaria con canvas cuadrado

  // Constrainer específico para cada forma (simplificado)
  const constrainToShape = (x: number, y: number, shape: string): { x: number, y: number } => {
    switch (shape) {
      case 'square':
        // Canvas cuadrado = cuadrado perfecto
        const squareSize = 1.0;
        return {
          x: constrain(x, -squareSize, squareSize),
          y: constrain(y, -squareSize, squareSize)
        };

      case 'circle':
        // Canvas cuadrado = círculo perfecto (mismo tamaño que el cuadrado)
        const circleRadius = 1.0;
        const distance = Math.sqrt(x * x + y * y);
        if (distance > circleRadius) {
          const factor = circleRadius / distance;
          return { x: x * factor, y: y * factor };
        }
        return { x, y };

      default:
        return { x: constrain(x, -1, 1), y: constrain(y, -1, 1) };
    }
  };

  // Función applyBoundaryForce() eliminada - no se usaba

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
    const alpha = particleOpacity;

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

  // Web Worker functions eliminadas - funcionalidad no implementada

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

  // Inicializar entrada de micrófono
  const initMicrophoneInput = async () => {
    try {
      if (!audioContextRef.current || !audioDataRef.current) return;
      
      // Detener fuente anterior si existe
      if (audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioDataRef.current.analyzer);
      audioDataRef.current.source = source;
    } catch (error) {
      console.error("Error accediendo al micrófono:", error);
    }
  };

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

    // Clear canvas with trail effect
    if (trailEffect > 0) {
      // Partial clear for trail effect
      gl.clearColor(0, 0, 0, trailEffect);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Draw a semi-transparent overlay to create fade effect
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Create a full-screen quad with low alpha to fade previous frame
      const fadeAlpha = trailEffect * 0.1; // Adjust fade rate
      gl.clearColor(0, 0, 0, fadeAlpha);
    } else {
      // Normal clear
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

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
    const particleShapeLocation = gl.getUniformLocation(program, "u_particleShape");

    // Create transformation matrix (identity for now)
    const matrix = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];

    gl.uniformMatrix3fv(matrixLocation, false, matrix);

    // Set particle shape
    const shapeValue = particleShape === 'square' ? 0 :
                      particleShape === 'circle' ? 1 :
                      particleShape === 'triangle' ? 2 :
                      particleShape === 'star' ? 3 : 0;
    gl.uniform1i(particleShapeLocation, shapeValue);

    // Set blend mode
    gl.enable(gl.BLEND);
    switch (blendMode) {
      case 'additive':
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      case 'multiply':
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        break;
      case 'normal':
      default:
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }

    // Adjust point size based on beat detection (ahora configurable)
    let finalPointSize = particleSize;
    if (beatDetected) {
      finalPointSize *= beatPulseIntensity;
    }

    gl.uniform1f(pointSizeLocation, finalPointSize);

    // Draw
    gl.drawArrays(gl.POINTS, 0, buffers.count);
  };

  // Generar posición aleatoria dentro de la forma (simplificado)
  const generateRandomPositionInShape = (shape: string): { x: number, y: number } => {
    switch (shape) {
      case 'square':
        // Canvas cuadrado = cuadrado perfecto
        const squareSize = 1.0;
        return {
          x: (Math.random() * 2 - 1) * squareSize,
          y: (Math.random() * 2 - 1) * squareSize
        };

      case 'circle':
        // Canvas cuadrado = círculo perfecto (mismo tamaño que el cuadrado)
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.sqrt(Math.random()) * 1.0; // sqrt para distribución uniforme
        return {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        };

      default:
        return {
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1
        };
    }
  };

  // Crear partículas
  const createParticles = useCallback(() => {
    const particleCount = PARTICLE_DENSITY[currentParticleDensity];
    console.log(`🔄 Creando ${particleCount} partículas (densidad: ${currentParticleDensity}, forma: ${currentCanvasShape})`);

    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const position = generateRandomPositionInShape(currentCanvasShape);
      newParticles.push({
        x: position.x,
        y: position.y,
        color: `rgba(255, 255, 255, ${particleOpacity})`
      });
    }

    particlesRef.current = newParticles;
    console.log(`✅ Partículas creadas: ${particlesRef.current.length} en forma ${currentCanvasShape}`);
    return newParticles;
  }, [currentParticleDensity, currentCanvasShape, particleOpacity]);

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

    // Log ocasional para debug (cada 60 frames)
    if (frameCountRef.current % 60 === 0) {
      console.log(`🎬 Renderizando ${particles.length} partículas (frame ${frameCountRef.current})`);
    }

    // Actualizar partículas basado en audio si está disponible
    let audioInfluence = 0;
    let frequencyData: Uint8Array | null = null;
    let dominantFrequency = 0;

    // Priorizar datos de audio externos (ej. del piano) sobre audio interno
    if (audioData && audioData.averageAmplitude > 0) {
      // Usar datos de audio externos (piano virtual)
      frequencyData = audioData.frequencyData;
      dominantFrequency = audioData.dominantFrequency;
      audioInfluence = audioData.averageAmplitude * (sensitivityState / 50);

      console.log('🎹 Usando datos de piano:', {
        frequency: dominantFrequency.toFixed(1),
        amplitude: audioData.averageAmplitude.toFixed(3),
        influence: audioInfluence.toFixed(3)
      });
    } else if (isPlaying && audioDataRef.current) {
      // Usar audio interno (micrófono/archivo)
      audioDataRef.current.analyzer.getByteFrequencyData(audioDataRef.current.dataArray);
      frequencyData = audioDataRef.current.dataArray;

      // Calcular amplitud promedio
      const sum = Array.from(frequencyData).reduce((acc, val) => acc + val, 0);
      const rawInfluence = sum / frequencyData.length / 255;

      // Calcular frecuencia dominante
      let maxValue = 0;
      let maxIndex = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      dominantFrequency = maxIndex * sampleRate / (2048); // FFT_SIZE

      // Solo aplicar influencia si hay amplitud significativa
      audioInfluence = rawInfluence > 0.01 ? rawInfluence * (sensitivityState / 50) : 0;
    } else {
      // Sin audio = sin movimiento (estado de reposo)
      audioInfluence = 0;
      dominantFrequency = 0;
    }

    // Lógica de Worker eliminada - renderizado siempre en main thread

    // ===== ACTUALIZAR PARTÍCULAS (común para WebGL y Canvas 2D) =====
    // Obtener parámetros Chladni modulados por frecuencia de audio
    const audioModulatedParams = getChladniParamsFromFrequency(dominantFrequency, audioInfluence);
    const { n, m } = audioInfluence > 0 ? audioModulatedParams : chladniParamsRef.current;

    // Debug logging para verificar modulación de parámetros
    if (audioInfluence > 0 && frameCountRef.current % 30 === 0) {
      console.log('🌊 Parámetros Chladni modulados:', {
        frequency: dominantFrequency.toFixed(1),
        amplitude: audioInfluence.toFixed(3),
        originalN: chladniParamsRef.current.n,
        originalM: chladniParamsRef.current.m,
        modulatedN: n,
        modulatedM: m
      });
    }

    // Actualizar posiciones de partículas usando lógica Chladni
    particles.forEach(p => {
      // Guardar posición original
      const originalX = p.x;
      const originalY = p.y;

      // Lógica de actualización de partículas con influencia de audio (ahora configurable)
      const speed = audioInfluence > 0 ? particleSpeed * (1 + audioInfluence) : 0;
      const vibrationMax = audioInfluence > 0 ? vibrationIntensity * (1 + audioInfluence * 2) : 0;
      const vibrationX = audioInfluence > 0 ? Math.random() * 2 * vibrationMax - vibrationMax : 0;
      const vibrationY = audioInfluence > 0 ? Math.random() * 2 * vibrationMax - vibrationMax : 0;
      const randomNum = audioInfluence > 0 ? Math.random() * randomnessFactor - (randomnessFactor * 0.3) : 0;

      const amount = chladni(p.x, p.y, n, m);

      // Calcular nueva posición propuesta
      let newX = p.x;
      let newY = p.y;

      // Descenso estocástico de gradiente con influencia de audio
      if (amount >= 0) {
        if (chladni(p.x + vibrationMax, p.y, n, m) >= amount) {
          newX -= randomNum * amount * speed + vibrationX;
        } else {
          newX += randomNum * amount * speed + vibrationX;
        }
        if (chladni(p.x, p.y + vibrationMax, n, m) >= amount) {
          newY -= randomNum * amount * speed + vibrationY;
        } else {
          newY += randomNum * amount * speed + vibrationY;
        }
      } else { // amount < 0
        if (chladni(p.x + vibrationMax, p.y, n, m) <= amount) {
          newX += randomNum * amount * speed + vibrationX;
        } else {
          newX -= randomNum * amount * speed + vibrationX;
        }
        if (chladni(p.x, p.y + vibrationMax, n, m) <= amount) {
          newY += randomNum * amount * speed + vibrationY;
        } else {
          newY -= randomNum * amount * speed + vibrationY;
        }
      }

      // VERIFICAR si la nueva posición está dentro de los límites ANTES de aplicarla
      if (isInsideShape(newX, newY, currentCanvasShape)) {
        // Si está dentro, usar la nueva posición
        p.x = newX;
        p.y = newY;
      } else {
        // Si se sale, mantener la posición original y aplicar restricción suave
        const constrained = constrainToShape(newX, newY, currentCanvasShape);
        p.x = constrained.x;
        p.y = constrained.y;

        // Log para debug
        if (Math.random() < 0.01) {
          console.log(`🔷 Movimiento BLOQUEADO: (${originalX.toFixed(2)}, ${originalY.toFixed(2)}) -> (${newX.toFixed(2)}, ${newY.toFixed(2)}) [${currentCanvasShape}]`);
        }
      }

      // Actualizar color basado en datos de frecuencia de audio
      if (frequencyData && isPlaying && audioInfluence > 0) {
        // Mapear posición de partícula a bin de frecuencia
        const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
        const value = frequencyData[binIndex];

        // Intensificar el color basado en la influencia del audio
        const intensityMultiplier = 1 + audioInfluence * 3; // Hacer más brillante con audio
        p.color = getColorFromFrequency(Math.min(255, value * intensityMultiplier), 255);
      } else {
        // Sin audio = color base blanco
        p.color = `rgba(255, 255, 255, ${particleOpacity})`;
      }
    });

    // Decidir entre WebGL y Canvas 2D para renderizado
    const useWebGLRendering = useWebGL && glRef.current && programRef.current;

    if (useWebGLRendering) {
      // Renderizado WebGL (partículas ya actualizadas)
      renderWebGL(particles, audioInfluence, frequencyData);
      return;
    }

    // Fallback a Canvas 2D
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    const scale = Math.min(width, height) / 2.0;

    // Efecto de pulso para beat detection (ahora configurable)
    let particleSizeMultiplier = 1.0;
    if (beatDetected) {
      particleSizeMultiplier = beatPulseIntensity;
    }

    // Solo dibujar partículas (ya actualizadas anteriormente)
    particles.forEach(p => {
      // Dibujar partícula
      ctx.fillStyle = p.color;
      const finalSize = particleSize * particleSizeMultiplier;
      ctx.fillRect(p.x * scale, p.y * scale, finalSize, finalSize);
    });
    
    ctx.restore();
  }, [isPlaying, audioSource, sensitivityState, particleSize, particleOpacity, selectedColorMode, autoShuffle, fpsLimit, beatDetected, useWebGL]);

  // Efecto para inicialización
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Inicializar WebGL si está habilitado
    if (useWebGL && !glRef.current) {
      initWebGL(canvas);
    }

    // Crear partículas iniciales
    const initialParticleCount = PARTICLE_DENSITY[currentParticleDensity];
    console.log(`🚀 Inicializando con ${initialParticleCount} partículas (densidad: ${currentParticleDensity})`);
    const initialParticles: Particle[] = [];
    for (let i = 0; i < initialParticleCount; i++) {
      initialParticles.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        color: `rgba(255, 255, 255, ${particleOpacity})`
      });
    }
    particlesRef.current = initialParticles;

    // Configurar redimensionamiento
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Configurar contexto según el modo de renderizado
      if (useWebGL && glRef.current) {
        glRef.current.viewport(0, 0, canvas.width, canvas.height);
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };
    
    // Aplicar redimensionamiento inicial
    resizeCanvas();
    
    // Observador de redimensionamiento
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    
    // Iniciar bucle de animación
    lastFrameTimeRef.current = performance.now();
    renderFrame();
    
    // Limpieza
    return () => {
      resizeObserver.disconnect();
      
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      // Lógica de limpieza de Worker eliminada
      
      // Limpiar recursos de audio
      if (audioDataRef.current && audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [renderFrame, useWebGL]);
  
  // Efecto para detección de beat
  useEffect(() => {
    if (beatDetected && autoShuffle) {
      shuffle();
    }
  }, [beatDetected, autoShuffle]);

  // useEffects de Worker eliminados - funcionalidad no implementada

  // Efectos para sincronizar props con estados internos
  useEffect(() => {
    setParticleSize(propParticleSize);
  }, [propParticleSize]);

  useEffect(() => {
    setParticleOpacity(propParticleOpacity);
  }, [propParticleOpacity]);

  useEffect(() => {
    setAutoShuffle(propAutoShuffle);
  }, [propAutoShuffle]);

  useEffect(() => {
    setSelectedColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    console.log(`🔷 Forma del canvas cambió a: ${canvasShape}`);
    setCurrentCanvasShape(canvasShape);

    // Aplicar clase CSS para cambiar la forma visual
    if (canvasRef.current) {
      console.log(`🎨 Aplicando clase CSS: canvas-shape-${canvasShape}`);
      canvasRef.current.className = `industrial-canvas canvas-shape-${canvasShape}`;
    }
  }, [canvasShape]);

  // Efecto para recrear partículas cuando cambie la forma del canvas
  useEffect(() => {
    console.log(`🔷 Recreando partículas para nueva forma: ${currentCanvasShape}`);
    createParticles();

    // Actualizar clase CSS cuando cambie currentCanvasShape
    if (canvasRef.current) {
      console.log(`🎨 Actualizando clase CSS: canvas-shape-${currentCanvasShape}`);
      canvasRef.current.className = `industrial-canvas canvas-shape-${currentCanvasShape}`;
    }
  }, [currentCanvasShape, createParticles]);

  // Efecto para sincronizar prop con estado interno
  useEffect(() => {
    console.log(`🎯 Prop particleDensity cambió a: ${particleDensity}`);
    setCurrentParticleDensity(particleDensity);
  }, [particleDensity]);

  // Efecto para recrear partículas cuando cambie la densidad interna
  useEffect(() => {
    console.log(`🔄 Estado interno de densidad cambió a: ${currentParticleDensity}`);
    createParticles();
  }, [currentParticleDensity, createParticles]);

  return (
    <div className="industrial-chladni-container">
      <canvas
        ref={canvasRef}
        className={`industrial-canvas canvas-shape-${currentCanvasShape}`}
      />

      {/* Debug info overlay (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <div>Partículas: {particlesRef.current.length.toLocaleString()}</div>
          <div>Densidad: {currentParticleDensity} ({PARTICLE_DENSITY[currentParticleDensity].toLocaleString()})</div>
          <div>Forma: {currentCanvasShape}</div>
          <div>FPS: {actualFPS}</div>
          <div>WebGL: {useWebGL ? 'ON' : 'OFF'}</div>
          <div>Frame: {frameCountRef.current}</div>
        </div>
      )}
    </div>
  );
};

export default ChladniSynthesizerOptimized;
