import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- Configuration ---
const RAND_NM = 20;
const SHUFFLE_INTERVAL = 300; // frames
const FFT_SIZE = 2048;

// Particle density presets
const PARTICLE_DENSITY = {
  low: 50000,
  medium: 150000,
  high: 300000,
  ultra: 500000
};

// --- Types ---
interface Particle {
  x: number;
  y: number;
  color?: [number, number, number, number]; // RGBA
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
  /** Muestra/oculta la superposición de controles interna.  */
  showControls?: boolean;
}

// --- WebGL Shaders ---
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  
  uniform mat3 u_matrix;
  uniform float u_pointSize;
  
  varying vec4 v_color;
  
  void main() {
    // Apply transformation matrix
    vec3 position = u_matrix * vec3(a_position, 1.0);
    
    // Convert to clip space
    gl_Position = vec4(position.xy, 0.0, 1.0);
    
    // Set point size
    gl_PointSize = u_pointSize;
    
    // Pass color to fragment shader
    v_color = a_color;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  
  varying vec4 v_color;
  
  void main() {
    // Create circular particles
    vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
    if(length(coord) > 0.5) {
      discard;
    }
    
    gl_FragColor = v_color;
  }
`;

const ChladniSynthesizerOptimized: React.FC<ChladniSynthesizerOptimizedProps> = ({
  initialN = 5,
  initialM = 3,
  colorMode = 'spectrum',
  useWebGL = true,
  particleDensity = 'medium',
  useOffscreenCanvas = false,
  useWorker = false,
  fpsLimit = 60,
  sensitivity = 50,
  beatDetected = false,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDataRef = useRef<AudioData | null>(null);
  const audioFileRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const chladniParamsRef = useRef<ChladniParams>({ n: initialN, m: initialM });
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const bufferInfoRef = useRef<{
    position: WebGLBuffer | null;
    color: WebGLBuffer | null;
    count: number;
  }>({ position: null, color: null, count: 0 });

  // State for UI controls
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<'microphone' | 'file'>('microphone');
  const [sensitivityState, setSensitivity] = useState<number>(sensitivity);
  const [nParam, setNParam] = useState<number>(initialN);
  const [mParam, setMParam] = useState<number>(initialM);
  const [autoShuffle, setAutoShuffle] = useState<boolean>(true);
  const [selectedColorMode, setSelectedColorMode] = useState<string>(colorMode);
  const [particleSize, setParticleSize] = useState<number>(1);
  const [particleOpacity, setParticleOpacity] = useState<number>(0.8);
  const [isWebGLSupported, setIsWebGLSupported] = useState<boolean>(true);
  const [isOffscreenSupported, setIsOffscreenSupported] = useState<boolean>(true);
  const [isWorkerSupported, setIsWorkerSupported] = useState<boolean>(true);
  const [actualFPS, setActualFPS] = useState<number>(0);
  const [renderMode, setRenderMode] = useState<string>('initializing');

  // --- Math & Helper Functions ---
  const PI = Math.PI;
  const cos = Math.cos;
  
  const chladni = (x: number, y: number, n: number, m: number): number => {
    const L = 2; // In the original sketch, the coordinate space is [-1, 1], so L=2.
    return cos(n * PI * x / L) * cos(m * PI * y / L) - cos(m * PI * x / L) * cos(n * PI * y / L);
  };
  
  const shuffle = () => {
    const n = Math.floor(Math.random() * RAND_NM) + 1;
    let m = Math.floor(Math.random() * RAND_NM) + 1;
    while (m === n) {
      m = Math.floor(Math.random() * RAND_NM) + 1;
    }
    chladniParamsRef.current = { n, m };
    setNParam(n);
    setMParam(m);

    // If using worker, send message to update parameters
    if (workerRef.current && useWorker) {
      workerRef.current.postMessage({
        type: 'updateParams',
        data: { n, m }
      });
    }
  };

  const constrain = (val: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, val));
  };

  // Convert frequency data to color
  const getColorFromFrequency = (value: number, max: number): [number, number, number, number] => {
    let r = 1, g = 1, b = 1, a = particleOpacity;
    
    switch (selectedColorMode) {
      case 'spectrum':
        // Map value to hue (0-360)
        const hue = (value / max) * 360;
        // Convert HSL to RGB
        const h = hue / 60;
        const s = 1;
        const l = 0.5;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(h % 2 - 1));
        const m = l - c/2;
        
        if (h >= 0 && h < 1) { r = c; g = x; b = 0; }
        else if (h >= 1 && h < 2) { r = x; g = c; b = 0; }
        else if (h >= 2 && h < 3) { r = 0; g = c; b = x; }
        else if (h >= 3 && h < 4) { r = 0; g = x; b = c; }
        else if (h >= 4 && h < 5) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        r = r + m;
        g = g + m;
        b = b + m;
        break;
        
      case 'amplitude':
        // Brighter colors for higher amplitudes
        const brightness = 0.4 + (value / max) * 0.6;
        r = 0.2;
        g = 0.4;
        b = brightness;
        break;
        
      case 'frequency':
        // Different hues for different frequency bands
        if (value < (max / 3)) {
          // Low (red)
          r = 1;
          g = 0.2;
          b = 0.2;
        } else if (value < (max * 2 / 3)) {
          // Mid (green)
          r = 0.2;
          g = 1;
          b = 0.2;
        } else {
          // High (blue)
          r = 0.2;
          g = 0.2;
          b = 1;
        }
        break;
        
      default:
        r = 1;
        g = 1;
        b = 1;
    }
    
    return [r, g, b, a];
  };

  // Initialize WebGL
  const initWebGL = (canvas: HTMLCanvasElement | OffscreenCanvas): WebGLRenderingContext | null => {
    try {
      // Try to get WebGL2 context first, fall back to WebGL1
      // Fix for OffscreenCanvas by using type assertion
      const gl = (canvas.getContext('webgl2') || 
                  canvas.getContext('webgl') || 
                  canvas.getContext('experimental-webgl' as any)) as WebGLRenderingContext;
      
      if (!gl) {
        console.error("WebGL not supported");
        setIsWebGLSupported(false);
        return null;
      }
      
      // Create shader program
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      
      if (!vertexShader || !fragmentShader) {
        return null;
      }
      
      const program = createProgram(gl, vertexShader, fragmentShader);
      
      if (!program) {
        return null;
      }
      
      programRef.current = program;
      
      // Create buffers
      const positionBuffer = gl.createBuffer();
      const colorBuffer = gl.createBuffer();
      
      bufferInfoRef.current = {
        position: positionBuffer,
        color: colorBuffer,
        count: 0
      };
      
      return gl;
    } catch (error) {
      console.error("Error initializing WebGL:", error);
      setIsWebGLSupported(false);
      return null;
    }
  };

  // Create shader helper
  const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) {
      console.error("Could not create shader");
      return null;
    }
    
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

  // Create program helper
  const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram();
    if (!program) {
      console.error("Could not create program");
      return null;
    }
    
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

  // Initialize audio context and analyzer
  const initAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = FFT_SIZE;
      analyzer.smoothingTimeConstant = 0.8; // Add smoothing for better visual effect
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
      console.error("Error initializing audio:", error);
      setIsPlaying(false);
    }
  };

  // Initialize microphone input
  const initMicrophoneInput = async () => {
    try {
      if (!audioContextRef.current || !audioDataRef.current) return;
      
      // Stop previous source if exists
      if (audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioDataRef.current.analyzer);
      audioDataRef.current.source = source;
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  // Initialize audio file input
  const handleAudioFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audioFileRef.current = audio;
    
    if (audioContextRef.current && audioDataRef.current) {
      // Stop previous source if exists
      if (audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      
      audio.oncanplay = () => {
        if (!audioContextRef.current || !audioDataRef.current) return;
        
        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(audioDataRef.current.analyzer);
        source.connect(audioContextRef.current.destination); // Connect to speakers
        audioDataRef.current.source = source;
        
        if (isPlaying) {
          audio.play();
        }
      };
    }
  };

  // Toggle audio playback
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

  // Switch audio source
  const handleSourceChange = (source: 'microphone' | 'file') => {
    setAudioSource(source);
    if (isPlaying) {
      if (source === 'microphone') {
        if (audioFileRef.current) {
          audioFileRef.current.pause();
        }
        initMicrophoneInput();
      } else {
        // File input will be handled when a file is selected
      }
    }
  };

  // Handle parameter changes
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

    // If using worker, send message to update parameters
    if (workerRef.current && useWorker) {
      workerRef.current.postMessage({
        type: 'updateParams',
        data: { 
          n: param === 'n' ? value : nParam,
          m: param === 'm' ? value : mParam
        }
      });
    }
  };

  // Create particles
  const createParticles = useCallback(() => {
    const particleCount = PARTICLE_DENSITY[particleDensity];
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        color: [1, 1, 1, particleOpacity]
      });
    }
    
    particlesRef.current = newParticles;
    
    // If using worker, send particles to worker
    if (workerRef.current && useWorker) {
      workerRef.current.postMessage({
        type: 'setParticles',
        data: newParticles
      });
    }
    
    return newParticles;
  }, [particleDensity, particleOpacity]);

  // Update particles with WebGL
  const updateParticlesWebGL = (
    gl: WebGLRenderingContext, 
    program: WebGLProgram, 
    particles: Particle[], 
    audioInfluence: number, 
    frequencyData: Uint8Array | null
  ) => {
    const { n, m } = chladniParamsRef.current;
    
    // Update particle positions
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // --- Particle update logic with audio influence ---
      const speed = 0.035 * (1 + audioInfluence);
      const vibrationMax = 0.003 * (1 + audioInfluence * 2);
      const vibrationX = Math.random() * 2 * vibrationMax - vibrationMax;
      const vibrationY = Math.random() * 2 * vibrationMax - vibrationMax;
      const randomNum = Math.random() * 0.7 - 0.2;
      
      const amount = chladni(p.x, p.y, n, m);
      
      // Stochastic gradient descent with audio influence
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
      
      p.x = constrain(p.x, -1, 1);
      p.y = constrain(p.y, -1, 1);
      
      // Color based on audio frequency data
      if (frequencyData && isPlaying) {
        // Map particle position to frequency bin
        const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
        const value = frequencyData[binIndex];
        p.color = getColorFromFrequency(value, 255);
      } else {
        p.color = [1, 1, 1, particleOpacity];
      }
    }
    
    // Prepare data for WebGL
    const positions = new Float32Array(particles.length * 2);
    const colors = new Float32Array(particles.length * 4);
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      positions[i * 2] = p.x;
      positions[i * 2 + 1] = p.y;
      
      if (p.color) {
        colors[i * 4] = p.color[0];
        colors[i * 4 + 1] = p.color[1];
        colors[i * 4 + 2] = p.color[2];
        colors[i * 4 + 3] = p.color[3];
      } else {
        colors[i * 4] = 1;
        colors[i * 4 + 1] = 1;
        colors[i * 4 + 2] = 1;
        colors[i * 4 + 3] = particleOpacity;
      }
    }
    
    // Update WebGL buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfoRef.current.position);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfoRef.current.color);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    
    bufferInfoRef.current.count = particles.length;
    
    // Draw particles
    gl.useProgram(program);
    
    // Set up position attribute
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfoRef.current.position);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set up color attribute
    const colorLocation = gl.getAttribLocation(program, "a_color");
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfoRef.current.color);
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
    gl.uniform1f(pointSizeLocation, particleSize);
    
    // Draw
    gl.drawArrays(gl.POINTS, 0, bufferInfoRef.current.count);
  };

  // Initialize worker
  const initWorker = () => {
    try {
      // Create worker code as blob
      const workerCode = `
        let particles = [];
        let chladniParams = { n: 5, m: 3 };
        let canvas = null;
        let gl = null;
        let program = null;
        let bufferInfo = { position: null, color: null, count: 0 };
        let isRunning = false;
        let particleSize = 1;
        let particleOpacity = 0.8;
        let colorMode = 'spectrum';
        
        // Math functions
        const PI = Math.PI;
        const cos = Math.cos;
        
        const chladni = (x, y, n, m) => {
          const L = 2;
          return cos(n * PI * x / L) * cos(m * PI * y / L) - cos(m * PI * x / L) * cos(n * PI * y / L);
        };
        
        const constrain = (val, min, max) => {
          return Math.max(min, Math.min(max, val));
        };
        
        const getColorFromFrequency = (value, max) => {
          let r = 1, g = 1, b = 1, a = particleOpacity;
          
          switch (colorMode) {
            case 'spectrum':
              const hue = (value / max) * 360;
              const h = hue / 60;
              const s = 1;
              const l = 0.5;
              const c = (1 - Math.abs(2 * l - 1)) * s;
              const x = c * (1 - Math.abs(h % 2 - 1));
              const m = l - c/2;
              
              if (h >= 0 && h < 1) { r = c; g = x; b = 0; }
              else if (h >= 1 && h < 2) { r = x; g = c; b = 0; }
              else if (h >= 2 && h < 3) { r = 0; g = c; b = x; }
              else if (h >= 3 && h < 4) { r = 0; g = x; b = c; }
              else if (h >= 4 && h < 5) { r = x; g = 0; b = c; }
              else { r = c; g = 0; b = x; }
              
              r = r + m;
              g = g + m;
              b = b + m;
              break;
              
            case 'amplitude':
              const brightness = 0.4 + (value / max) * 0.6;
              r = 0.2;
              g = 0.4;
              b = brightness;
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
          
          return [r, g, b, a];
        };
        
        // WebGL helpers
        const createShader = (gl, type, source) => {
          const shader = gl.createShader(type);
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
        
        const createProgram = (gl, vertexShader, fragmentShader) => {
          const program = gl.createProgram();
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
        
        // Initialize WebGL
        const initWebGL = (canvas) => {
          try {
            const gl = canvas.getContext('webgl2') || 
                      canvas.getContext('webgl') || 
                      canvas.getContext('experimental-webgl');
            
            if (!gl) {
              postMessage({ type: 'error', data: 'WebGL not supported' });
              return null;
            }
            
            const vertexShaderSource = \`
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
            \`;
            
            const fragmentShaderSource = \`
              precision mediump float;
              
              varying vec4 v_color;
              
              void main() {
                vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
                if(length(coord) > 0.5) {
                  discard;
                }
                
                gl_FragColor = v_color;
              }
            \`;
            
            const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
            
            if (!vertexShader || !fragmentShader) {
              return null;
            }
            
            const program = createProgram(gl, vertexShader, fragmentShader);
            
            if (!program) {
              return null;
            }
            
            // Create buffers
            const positionBuffer = gl.createBuffer();
            const colorBuffer = gl.createBuffer();
            
            bufferInfo = {
              position: positionBuffer,
              color: colorBuffer,
              count: 0
            };
            
            return { gl, program };
          } catch (error) {
            postMessage({ type: 'error', data: 'Error initializing WebGL: ' + error.message });
            return null;
          }
        };
        
        // Update and render particles
        const updateParticles = (audioInfluence = 0, frequencyData = null) => {
          if (!gl || !program || particles.length === 0) return;
          
          const { n, m } = chladniParams;
          
          // Update particle positions
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            const speed = 0.035 * (1 + audioInfluence);
            const vibrationMax = 0.003 * (1 + audioInfluence * 2);
            const vibrationX = Math.random() * 2 * vibrationMax - vibrationMax;
            const vibrationY = Math.random() * 2 * vibrationMax - vibrationMax;
            const randomNum = Math.random() * 0.7 - 0.2;
            
            const amount = chladni(p.x, p.y, n, m);
            
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
            } else {
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
            
            p.x = constrain(p.x, -1, 1);
            p.y = constrain(p.y, -1, 1);
            
            // Color based on audio frequency data
            if (frequencyData && frequencyData.length > 0) {
              const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
              const value = frequencyData[binIndex];
              p.color = getColorFromFrequency(value, 255);
            } else {
              p.color = [1, 1, 1, particleOpacity];
            }
          }
          
          // Prepare data for WebGL
          const positions = new Float32Array(particles.length * 2);
          const colors = new Float32Array(particles.length * 4);
          
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            positions[i * 2] = p.x;
            positions[i * 2 + 1] = p.y;
            
            if (p.color) {
              colors[i * 4] = p.color[0];
              colors[i * 4 + 1] = p.color[1];
              colors[i * 4 + 2] = p.color[2];
              colors[i * 4 + 3] = p.color[3];
            } else {
              colors[i * 4] = 1;
              colors[i * 4 + 1] = 1;
              colors[i * 4 + 2] = 1;
              colors[i * 4 + 3] = particleOpacity;
            }
          }
          
          // Clear canvas
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          
          // Update WebGL buffers
          gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.position);
          gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
          
          gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.color);
          gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
          
          bufferInfo.count = particles.length;
          
          // Draw particles
          gl.useProgram(program);
          
          // Set up position attribute
          const positionLocation = gl.getAttribLocation(program, "a_position");
          gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.position);
          gl.enableVertexAttribArray(positionLocation);
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
          
          // Set up color attribute
          const colorLocation = gl.getAttribLocation(program, "a_color");
          gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.color);
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
          gl.uniform1f(pointSizeLocation, particleSize);
          
          // Draw
          gl.drawArrays(gl.POINTS, 0, bufferInfo.count);
        };
        
        // Animation loop
        const animate = () => {
          if (!isRunning) return;
          
          // Request next frame first for better performance
          requestAnimationFrame(animate);
          
          // Send message to main thread to get audio data
          postMessage({ type: 'requestAudioData' });
        };
        
        // Message handler
        self.onmessage = (event) => {
          const { type, data } = event.data;
          
          switch (type) {
            case 'init':
              canvas = data.canvas;
              particleSize = data.particleSize;
              particleOpacity = data.particleOpacity;
              colorMode = data.colorMode;
              
              const webglContext = initWebGL(canvas);
              if (webglContext) {
                gl = webglContext.gl;
                program = webglContext.program;
                postMessage({ type: 'initialized' });
              }
              break;
              
            case 'setParticles':
              particles = data;
              break;
              
            case 'updateParams':
              chladniParams = data;
              break;
              
            case 'updateSettings':
              if (data.particleSize !== undefined) particleSize = data.particleSize;
              if (data.particleOpacity !== undefined) particleOpacity = data.particleOpacity;
              if (data.colorMode !== undefined) colorMode = data.colorMode;
              break;
              
            case 'audioData':
              updateParticles(data.audioInfluence, data.frequencyData);
              break;
              
            case 'start':
              isRunning = true;
              animate();
              break;
              
            case 'stop':
              isRunning = false;
              break;
              
            case 'resize':
              if (canvas && data.width && data.height) {
                canvas.width = data.width;
                canvas.height = data.height;
                gl.viewport(0, 0, canvas.width, canvas.height);
              }
              break;
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      
      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setIsWorkerSupported(false);
      };
      
      worker.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'initialized':
            console.log('Worker initialized');
            worker.postMessage({
              type: 'start'
            });
            break;
            
          case 'error':
            console.error('Worker error:', data);
            setIsWorkerSupported(false);
            break;
            
          case 'requestAudioData':
            // Send audio data to worker
            if (isPlaying && audioDataRef.current) {
              audioDataRef.current.analyzer.getByteFrequencyData(audioDataRef.current.dataArray);
              
              // Calculate average amplitude
              const frequencyData = audioDataRef.current.dataArray;
              const sum = frequencyData.reduce((acc, val) => acc + val, 0);
              const audioInfluence = sum / frequencyData.length / 255 * (sensitivityState / 50);
              
              worker.postMessage({
                type: 'audioData',
                data: {
                  audioInfluence,
                  frequencyData: Array.from(frequencyData)
                }
              });
            } else {
              worker.postMessage({
                type: 'audioData',
                data: {
                  audioInfluence: 0,
                  frequencyData: null
                }
              });
            }
            break;
        }
      };
      
      workerRef.current = worker;
      
      return worker;
    } catch (error) {
      console.error('Error creating worker:', error);
      setIsWorkerSupported(false);
      return null;
    }
  };

  // Main rendering function
  const renderFrame = useCallback(() => {
    // Request next frame first for better performance
    animationFrameId.current = requestAnimationFrame(renderFrame);
    
    // FPS limiting
    if (fpsLimit) {
      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;
      const fpsInterval = 1000 / fpsLimit;
      
      if (elapsed < fpsInterval) {
        return;
      }
      
      // Calculate actual FPS
      setActualFPS(Math.round(1000 / elapsed));
      lastFrameTimeRef.current = now - (elapsed % fpsInterval);
    }
    
    frameCountRef.current++;
    if (autoShuffle && frameCountRef.current % SHUFFLE_INTERVAL === 0) {
      shuffle();
    }
    
    // Skip rendering if using worker
    if (useWorker && workerRef.current) {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Skip if canvas has no dimensions
    if (width === 0 || height === 0) return;
    
    const particles = particlesRef.current;
    
    // Update particles based on audio if available
    let audioInfluence = 0;
    let frequencyData: Uint8Array | null = null;
    
    if (isPlaying && audioDataRef.current) {
      audioDataRef.current.analyzer.getByteFrequencyData(audioDataRef.current.dataArray);
      frequencyData = audioDataRef.current.dataArray;
      
      // Calculate average amplitude
      const sum = frequencyData.reduce((acc, val) => acc + val, 0);
      audioInfluence = sum / frequencyData.length / 255 * (sensitivityState / 50);
    }
    
    // Render with WebGL if supported and enabled
    if (useWebGL && glRef.current && programRef.current) {
      const gl = glRef.current;
      
      // Clear canvas
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      // Update and draw particles
      updateParticlesWebGL(gl, programRef.current, particles, audioInfluence, frequencyData);
    } 
    // Fallback to Canvas 2D
    else {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      
      // Update particles
      const { n, m } = chladniParamsRef.current;
      
      ctx.save();
      ctx.translate(width / 2, height / 2);
      const scale = Math.min(width, height) / 2.0;
      
      particles.forEach(p => {
        // --- Particle update logic with audio influence ---
        const speed = 0.035 * (1 + audioInfluence);
        const vibrationMax = 0.003 * (1 + audioInfluence * 2);
        const vibrationX = Math.random() * 2 * vibrationMax - vibrationMax;
        const vibrationY = Math.random() * 2 * vibrationMax - vibrationMax;
        const randomNum = Math.random() * 0.7 - 0.2;
        
        const amount = chladni(p.x, p.y, n, m);
        
        // Stochastic gradient descent with audio influence
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
        
        p.x = constrain(p.x, -1, 1);
        p.y = constrain(p.y, -1, 1);
        
        // Color based on audio frequency data
        let color = 'rgba(255, 255, 255, ' + particleOpacity + ')';
        if (frequencyData && isPlaying) {
          // Map particle position to frequency bin
          const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
          const value = frequencyData[binIndex];
          const [r, g, b, a] = getColorFromFrequency(value, 255);
          color = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
        }
        
        // Draw particle
        ctx.fillStyle = color;
        ctx.fillRect(p.x * scale, p.y * scale, particleSize, particleSize);
      });
      
      ctx.restore();
    }
  }, [isPlaying, audioSource, sensitivityState, particleSize, particleOpacity, selectedColorMode, autoShuffle, useWebGL, fpsLimit]);

  // Setup effect
  useEffect(() => {
    // Feature detection
    const checkFeatureSupport = () => {
      // Check WebGL support
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setIsWebGLSupported(!!gl);
      
      // Check OffscreenCanvas support
      setIsOffscreenSupported(typeof OffscreenCanvas !== 'undefined');
      
      // Check Worker support
      setIsWorkerSupported(typeof Worker !== 'undefined');
    };
    
    checkFeatureSupport();
    
    // Setup canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let gl: WebGLRenderingContext | null = null;
    let worker: Worker | null = null;
    
    const setupCanvas = () => {
      // Use OffscreenCanvas if supported and enabled
      if (useOffscreenCanvas && isOffscreenSupported && 'transferControlToOffscreen' in canvas) {
        const offscreenCanvas = canvas.transferControlToOffscreen();
        offscreenCanvasRef.current = offscreenCanvas;
        
        // If using worker, transfer canvas to worker
        if (useWorker && isWorkerSupported) {
          worker = initWorker();
          if (worker) {
            worker.postMessage({
              type: 'init',
              data: {
                canvas: offscreenCanvas,
                particleSize,
                particleOpacity,
                colorMode: selectedColorMode
              }
            }, [offscreenCanvas]);
            
            // Create particles
            const particles = createParticles();
            worker.postMessage({
              type: 'setParticles',
              data: particles
            });
            
            setRenderMode('worker+offscreen');
          }
        } 
        // Use OffscreenCanvas without worker
        else {
          gl = initWebGL(offscreenCanvas);
          glRef.current = gl;
          
          if (gl) {
            createParticles();
            setRenderMode('offscreen');
          }
        }
      } 
      // Use regular canvas
      else {
        // Use WebGL if enabled
        if (useWebGL && isWebGLSupported) {
          gl = initWebGL(canvas);
          glRef.current = gl;
          
          if (gl) {
            createParticles();
            setRenderMode('webgl');
          } else {
            createParticles();
            setRenderMode('canvas2d');
          }
        } 
        // Use Canvas 2D
        else {
          createParticles();
          setRenderMode('canvas2d');
        }
      }
    };
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      let width = rect.width;
      let height = rect.height;

      // Ensure minimum dimensions
      if (width < 100) width = canvas.parentElement?.offsetWidth || 800;
      if (height < 100) height = canvas.parentElement?.offsetHeight || 600;

      // Update canvas size
      if (!useOffscreenCanvas || !isOffscreenSupported) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        if (gl) {
          gl.viewport(0, 0, canvas.width, canvas.height);
        } else {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(dpr, dpr);
          }
        }
      }
      // If using worker with offscreen canvas, send resize message
      else if (worker && workerRef.current) {
        workerRef.current.postMessage({
          type: 'resize',
          data: {
            width: width * dpr,
            height: height * dpr
          }
        });
      }
      // If using offscreen canvas without worker
      else if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current.width = width * dpr;
        offscreenCanvasRef.current.height = height * dpr;

        if (gl) {
          gl.viewport(0, 0, offscreenCanvasRef.current.width, offscreenCanvasRef.current.height);
        }
      }
    };

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      resizeCanvas();
    });

    // Force initial resize
    setTimeout(resizeCanvas, 0);

    resizeObserver.observe(canvas);
    resizeObserver.observe(canvas.parentElement!);
    setupCanvas();
    
    // Start animation loop if not using worker
    if (!useWorker || !isWorkerSupported || !worker) {
      lastFrameTimeRef.current = performance.now();
      renderFrame();
    }
    
    return () => {
      resizeObserver.disconnect();
      
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      // Clean up worker
      if (worker && workerRef.current) {
        workerRef.current.postMessage({ type: 'stop' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      
      // Clean up audio resources
      if (audioDataRef.current && audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      // Clean up WebGL resources
      if (gl && programRef.current) {
        gl.deleteProgram(programRef.current);
      }
    };
  }, [
    useWebGL, 
    useOffscreenCanvas, 
    useWorker, 
    isWebGLSupported, 
    isOffscreenSupported, 
    isWorkerSupported, 
    createParticles, 
    renderFrame, 
    particleSize, 
    particleOpacity, 
    selectedColorMode
  ]);
  
  // Update worker settings when controls change
  useEffect(() => {
    if (workerRef.current && useWorker) {
      workerRef.current.postMessage({
        type: 'updateSettings',
        data: {
          particleSize,
          particleOpacity,
          colorMode: selectedColorMode
        }
      });
    }
  }, [particleSize, particleOpacity, selectedColorMode, useWorker]);

  // Effect for beat detection
  useEffect(() => {
    if (beatDetected) {
      // Add visual effects when beat is detected
      // For example, you could temporarily increase particle size or change colors
      
      // This could be expanded with more elaborate effects
      if (autoShuffle) {
        shuffle();
      }
    }
  }, [beatDetected, autoShuffle]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      
      {/* Controls overlay */}
      {showControls && (
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Audio controls */}
          <div>
            <button 
              onClick={toggleAudio}
              className="px-4 py-2 bg-blue-600 rounded"
            >
              {isPlaying ? 'Stop Audio' : 'Start Audio'}
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <label>
              <input 
                type="radio" 
                checked={audioSource === 'microphone'} 
                onChange={() => handleSourceChange('microphone')} 
              />
              Micrófono
            </label>
            <label>
              <input 
                type="radio" 
                checked={audioSource === 'file'} 
                onChange={() => handleSourceChange('file')} 
              />
              Archivo de Audio
            </label>
          </div>
          
          {audioSource === 'file' && (
            <div>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleAudioFile} 
                className="text-sm"
              />
            </div>
          )}
          
          {/* Sensitivity slider */}
          <div className="flex items-center gap-2">
            <label>Sensibilidad:</label>
            <input 
              type="range" 
              min="1" 
              max="100" 
              value={sensitivityState} 
              onChange={(e) => setSensitivity(parseInt(e.target.value))}
            />
          </div>
          
          {/* Chladni parameters */}
          <div className="flex items-center gap-2">
            <label>n:</label>
            <input 
              type="number" 
              min="1" 
              max={RAND_NM} 
              value={nParam} 
              onChange={(e) => handleParamChange('n', parseInt(e.target.value))}
              className="w-16 bg-gray-800 px-2"
            />
            <label>m:</label>
            <input 
              type="number" 
              min="1" 
              max={RAND_NM} 
              value={mParam} 
              onChange={(e) => handleParamChange('m', parseInt(e.target.value))}
              className="w-16 bg-gray-800 px-2"
            />
            <button 
              onClick={shuffle}
              className="px-2 py-1 bg-purple-600 rounded text-sm"
            >
              Aleatorio
            </button>
            <label>
              <input 
                type="checkbox" 
                checked={autoShuffle} 
                onChange={(e) => setAutoShuffle(e.target.checked)} 
              />
              Auto Shuffle
            </label>
          </div>
          
          {/* Visual controls */}
          <div className="flex items-center gap-2">
            <label>Modo Color:</label>
            <select 
              value={selectedColorMode} 
              onChange={(e) => setSelectedColorMode(e.target.value)}
              className="bg-gray-800 px-2 py-1"
            >
              <option value="spectrum">Espectro</option>
              <option value="amplitude">Amplitud</option>
              <option value="frequency">Bandas de Frecuencia</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label>Tamaño Partículas:</label>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="0.5"
              value={particleSize} 
              onChange={(e) => setParticleSize(parseFloat(e.target.value))}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label>Opacidad:</label>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.1"
              value={particleOpacity} 
              onChange={(e) => setParticleOpacity(parseFloat(e.target.value))}
            />
          </div>
          
          {/* Performance info */}
          <div className="ml-auto text-xs">
            <div>Modo: {renderMode}</div>
            <div>FPS: {actualFPS}</div>
            <div>Partículas: {PARTICLE_DENSITY[particleDensity].toLocaleString()}</div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default ChladniSynthesizerOptimized;
