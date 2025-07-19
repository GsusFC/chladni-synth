import React, { useRef, useEffect, useState } from 'react';

// --- Configuration ---

const xCount = 360;
const yCount = 360;
const PARTICLE_COUNT = xCount * yCount;
const RAND_NM = 20;
const SHUFFLE_INTERVAL = 300; // frames
const FFT_SIZE = 2048;

// --- Types ---

interface Particle {
  x: number;
  y: number;
  color?: string;
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

export interface ChladniSynthesizerProps {
  initialN?: number;
  initialM?: number;
  colorMode?: 'spectrum' | 'amplitude' | 'frequency';
  /** Sensibilidad inicial (1-100) para la influencia del audio */
  sensitivity?: number;
  /** Muestra u oculta la superposición de controles interna */
  showControls?: boolean;
}

const ChladniSynthesizer: React.FC<ChladniSynthesizerProps> = ({
  initialN = 5,
  initialM = 3,
  colorMode = 'spectrum',
  sensitivity: sensitivityProp = 50,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDataRef = useRef<AudioData | null>(null);
  const audioFileRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const chladniParamsRef = useRef<ChladniParams>({ n: initialN, m: initialM });
  const frameCountRef = useRef(0);

  // State for UI controls
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<'microphone' | 'file'>('microphone');
  // Sensibilidad que determina la influencia del audio
  const [sensitivity, setSensitivity] = useState<number>(sensitivityProp);
  const [nParam, setNParam] = useState<number>(initialN);
  const [mParam, setMParam] = useState<number>(initialM);
  const [autoShuffle, setAutoShuffle] = useState<boolean>(true);
  const [selectedColorMode, setSelectedColorMode] = useState<string>(colorMode);
  const [particleSize, setParticleSize] = useState<number>(1);
  const [particleOpacity, setParticleOpacity] = useState<number>(0.8);

  // --- Math & Helper Functions ---

  const PI = Math.PI;
  const cos = Math.cos;
  
  const chladni = (x: number, y: number, n: number, m: number): number => {
    const L = 2; // In the original sketch, the coordinate space is [-1, 1], so L=2.
    return cos(n * PI * x / L) * cos(m * PI * y / L) - cos(m * PI * x / L) * cos(n * PI * y / L);
  };
  
  const shuffle = () => {
    const n = Math.floor(Math.random() * RAND_NM);
    let m = Math.floor(Math.random() * RAND_NM);
    while (m === n) {
      m = Math.floor(Math.random() * RAND_NM);
    }
    chladniParamsRef.current = { n, m };
    setNParam(n);
    setMParam(m);
  };

  const constrain = (val: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, val));
  };

  // Convert frequency data to color
  const getColorFromFrequency = (value: number, max: number): string => {
    switch (selectedColorMode) {
      case 'spectrum':
        // Map value to hue (0-360)
        const hue = (value / max) * 360;
        return `hsla(${hue}, 100%, 50%, ${particleOpacity})`;
      case 'amplitude':
        // Brighter colors for higher amplitudes
        const brightness = 40 + (value / max) * 60;
        return `hsla(220, 100%, ${brightness}%, ${particleOpacity})`;
      case 'frequency':
        // Different hues for different frequency bands
        const frequencyHue = value < (max / 3) ? 0 : // Low (red)
                            value < (max * 2 / 3) ? 120 : // Mid (green)
                            240; // High (blue)
        return `hsla(${frequencyHue}, 100%, 50%, ${particleOpacity})`;
      default:
        return `rgba(255, 255, 255, ${particleOpacity})`;
    }
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
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0;
    let height = 0;

    const createParticles = () => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        newParticles.push({
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1,
          color: 'rgba(255, 255, 255, 0.8)'
        });
      }
      particlesRef.current = newParticles;
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      width = rect.width;
      height = rect.height;

      // Ensure minimum dimensions
      if (width < 100) width = canvas.parentElement?.offsetWidth || 800;
      if (height < 100) height = canvas.parentElement?.offsetHeight || 600;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      if (particlesRef.current.length === 0) {
        createParticles();
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

    const renderFrame = () => {
      animationFrameId.current = requestAnimationFrame(renderFrame);
      if (width === 0 || height === 0) return;
      
      frameCountRef.current++;
      if (autoShuffle && frameCountRef.current % SHUFFLE_INTERVAL === 0) {
        shuffle();
      }
      
      const particles = particlesRef.current;
      const { n, m } = chladniParamsRef.current;
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      // Update particles based on audio if available
      let audioInfluence = 0;
      let frequencyData: Uint8Array | null = null;
      
      if (isPlaying && audioDataRef.current) {
        audioDataRef.current.analyzer.getByteFrequencyData(audioDataRef.current.dataArray);
        frequencyData = audioDataRef.current.dataArray;
        
        // Calculate average amplitude
        const sum = frequencyData.reduce((acc, val) => acc + val, 0);
        audioInfluence = sum / frequencyData.length / 255 * (sensitivity / 50);
      }

      ctx.save();
      ctx.translate(width / 2, height / 2);
      const scale = Math.min(width, height) / 2.0;
      
      particles.forEach((p) => {
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
          p.color = `rgba(255, 255, 255, ${particleOpacity})`;
        }
        
        // Draw particle
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x * scale, p.y * scale, particleSize, particleSize);
      });
      
      ctx.restore();
    };

    renderFrame();

    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      // Clean up audio resources
      if (audioDataRef.current && audioDataRef.current.source) {
        audioDataRef.current.source.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isPlaying, audioSource, sensitivity, particleSize, particleOpacity, selectedColorMode, autoShuffle]);

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
              Microphone
            </label>
            <label>
              <input 
                type="radio" 
                checked={audioSource === 'file'} 
                onChange={() => handleSourceChange('file')} 
              />
              Audio File
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
            <label>Sensitivity:</label>
            <input 
              type="range" 
              min="1" 
              max="100" 
              value={sensitivity} 
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
              Shuffle
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
            <label>Color Mode:</label>
            <select 
              value={selectedColorMode} 
              onChange={(e) => setSelectedColorMode(e.target.value)}
              className="bg-gray-800 px-2 py-1"
            >
              <option value="spectrum">Spectrum</option>
              <option value="amplitude">Amplitude</option>
              <option value="frequency">Frequency Bands</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label>Particle Size:</label>
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
            <label>Opacity:</label>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.1"
              value={particleOpacity} 
              onChange={(e) => setParticleOpacity(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default ChladniSynthesizer;
