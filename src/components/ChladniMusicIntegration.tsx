import React, { useState, useEffect, useRef, useCallback } from 'react';

// Interfaces para las propiedades del componente
interface ChladniMusicIntegrationProps {
  onAudioDataUpdate?: (data: AudioAnalysisData) => void;
  onFrequencyBandChange?: (band: FrequencyBand) => void;
  onAmplitudeChange?: (amplitude: number) => void;
  onBeatDetect?: () => void;
  initialVolume?: number;
  autoStart?: boolean;
  showSpectrogram?: boolean;
  showWaveform?: boolean;
}

// Datos de análisis de audio
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

// Bandas de frecuencia para el ecualizador
interface FrequencyBand {
  bass: number;     // 20-250 Hz
  lowMid: number;   // 250-500 Hz
  mid: number;      // 500-2000 Hz
  highMid: number;  // 2000-4000 Hz
  treble: number;   // 4000-20000 Hz
}

// Configuración del ecualizador
interface EqualizerSettings {
  bands: FrequencyBand;
  preAmp: number;
}

// Tipo para el origen del audio
type AudioSource = 'none' | 'microphone' | 'file' | 'demo';

// Tipo para el estado de reproducción
type PlaybackState = 'stopped' | 'playing' | 'paused';

// Configuración del analizador de audio
interface AnalyzerConfig {
  fftSize: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
}

// Componente principal
const ChladniMusicIntegration: React.FC<ChladniMusicIntegrationProps> = ({
  onAudioDataUpdate,
  onFrequencyBandChange,
  onAmplitudeChange,
  onBeatDetect,
  initialVolume = 0.7,
  autoStart = false,
  showSpectrogram = true,
  showWaveform = true,
}) => {
  // Referencias para el contexto de audio y elementos relacionados
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const equalizerNodesRef = useRef<BiquadFilterNode[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasSpectrogramRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWaveformRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Estado para la configuración del analizador
  const [analyzerConfig] = useState<AnalyzerConfig>({
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    minDecibels: -90,
    maxDecibels: -10,
  });
  
  // Estados para el control de audio
  const [audioSource, setAudioSource] = useState<AudioSource>('none');
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [volume, setVolume] = useState<number>(initialVolume);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [audioFileName, setAudioFileName] = useState<string>('');
  // Sólo necesitamos el setter para actualizar la URL del archivo de audio
  const [, setAudioFileUrl] = useState<string>('');
  // Sólo necesitamos el setter para indicar acceso al micrófono
  const [, setMicrophoneAccess] = useState<boolean | null>(null);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [audioError, setAudioError] = useState<string | null>(null);
  
  // Estado para el ecualizador
  const [equalizerSettings, setEqualizerSettings] = useState<EqualizerSettings>({
    bands: {
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
    },
    preAmp: 0,
  });
  
  // Estado para los datos de análisis de audio
  const [audioData, setAudioData] = useState<AudioAnalysisData>({
    frequencyData: new Uint8Array(),
    timeDomainData: new Uint8Array(),
    dominantFrequency: 0,
    averageAmplitude: 0,
    bassLevel: 0,
    midLevel: 0,
    trebleLevel: 0,
    isBeat: false,
  });
  
  // Estado para la detección de beats
  const [beatDetectionConfig] = useState({
    threshold: 1.5,
    decay: 0.98,
    minBeatInterval: 250, // ms
  });
  const beatEnergyRef = useRef<number>(0);
  const lastBeatTimeRef = useRef<number>(0);
  
  // Inicializar el contexto de audio
  const initAudioContext = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        // Crear el contexto de audio
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
        
        // Crear el nodo de ganancia para el control de volumen
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = volume;
        
        // Crear el analizador
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = analyzerConfig.fftSize;
        analyserRef.current.smoothingTimeConstant = analyzerConfig.smoothingTimeConstant;
        analyserRef.current.minDecibels = analyzerConfig.minDecibels;
        analyserRef.current.maxDecibels = analyzerConfig.maxDecibels;
        
        // Crear los nodos del ecualizador
        createEqualizerNodes();
        
        // Conectar los nodos
        connectNodes();
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      setAudioError('No se pudo inicializar el contexto de audio');
      return false;
    }
  }, [volume, analyzerConfig]);
  
  // Crear los nodos del ecualizador
  const createEqualizerNodes = useCallback(() => {
    if (!audioContextRef.current) return;
    
    // Limpiar nodos existentes
    equalizerNodesRef.current = [];
    
    // Crear filtros para cada banda de frecuencia
    const bassFilter = audioContextRef.current.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 250;
    bassFilter.gain.value = equalizerSettings.bands.bass;
    
    const lowMidFilter = audioContextRef.current.createBiquadFilter();
    lowMidFilter.type = 'peaking';
    lowMidFilter.frequency.value = 400;
    lowMidFilter.Q.value = 1;
    lowMidFilter.gain.value = equalizerSettings.bands.lowMid;
    
    const midFilter = audioContextRef.current.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = equalizerSettings.bands.mid;
    
    const highMidFilter = audioContextRef.current.createBiquadFilter();
    highMidFilter.type = 'peaking';
    highMidFilter.frequency.value = 3000;
    highMidFilter.Q.value = 1;
    highMidFilter.gain.value = equalizerSettings.bands.highMid;
    
    const trebleFilter = audioContextRef.current.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 4000;
    trebleFilter.gain.value = equalizerSettings.bands.treble;
    
    equalizerNodesRef.current = [
      bassFilter,
      lowMidFilter,
      midFilter,
      highMidFilter,
      trebleFilter,
    ];
  }, [equalizerSettings.bands]);
  
  // Conectar los nodos de audio
  const connectNodes = useCallback(() => {
    if (!audioContextRef.current || !gainNodeRef.current || !analyserRef.current) return;
    
    // Desconectar nodos existentes
    try {
      gainNodeRef.current.disconnect();
      analyserRef.current.disconnect();
      equalizerNodesRef.current.forEach(node => node.disconnect());
    } catch (e) {
      // Ignorar errores de desconexión
    }
    
    // Conectar nodos en cadena
    if (equalizerNodesRef.current.length > 0) {
      // Conectar el nodo de ganancia al primer nodo del ecualizador
      gainNodeRef.current.connect(equalizerNodesRef.current[0]);
      
      // Conectar los nodos del ecualizador en serie
      for (let i = 0; i < equalizerNodesRef.current.length - 1; i++) {
        equalizerNodesRef.current[i].connect(equalizerNodesRef.current[i + 1]);
      }
      
      // Conectar el último nodo del ecualizador al analizador
      equalizerNodesRef.current[equalizerNodesRef.current.length - 1].connect(analyserRef.current);
    } else {
      // Si no hay nodos de ecualizador, conectar directamente
      gainNodeRef.current.connect(analyserRef.current);
    }
    
    // Conectar el analizador a la salida
    analyserRef.current.connect(audioContextRef.current.destination);
  }, []);
  
  // Actualizar la configuración del analizador
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.fftSize = analyzerConfig.fftSize;
      analyserRef.current.smoothingTimeConstant = analyzerConfig.smoothingTimeConstant;
      analyserRef.current.minDecibels = analyzerConfig.minDecibels;
      analyserRef.current.maxDecibels = analyzerConfig.maxDecibels;
    }
  }, [analyzerConfig]);
  
  // Actualizar el volumen
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);
  
  // Actualizar el ecualizador
  useEffect(() => {
    if (equalizerNodesRef.current.length > 0) {
      equalizerNodesRef.current[0].gain.value = equalizerSettings.bands.bass;
      equalizerNodesRef.current[1].gain.value = equalizerSettings.bands.lowMid;
      equalizerNodesRef.current[2].gain.value = equalizerSettings.bands.mid;
      equalizerNodesRef.current[3].gain.value = equalizerSettings.bands.highMid;
      equalizerNodesRef.current[4].gain.value = equalizerSettings.bands.treble;
    }
  }, [equalizerSettings.bands]);
  
  // Iniciar automáticamente si se especifica
  useEffect(() => {
    if (autoStart) {
      initAudioContext();
      startDemoAudio();
    }
    
    return () => {
      stopAudioAnalysis();
      cleanupAudio();
    };
  }, [autoStart, initAudioContext]);
  
  // Obtener dispositivos de audio
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setMicrophoneDevices(audioInputs);
        
        if (audioInputs.length > 0 && !selectedMicrophoneId) {
          setSelectedMicrophoneId(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error enumerating audio devices:', error);
      }
    };
    
    getAudioDevices();
  }, []);
  
  // Limpiar recursos de audio al desmontar el componente
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      cleanupAudio();
    };
  }, []);
  
  // Limpiar recursos de audio
  const cleanupAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignorar errores de desconexión
      }
      sourceRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };
  
  // Iniciar el análisis de audio
  const startAudioAnalysis = () => {
    if (!analyserRef.current) return;
    
    // Crear arrays para los datos de frecuencia y dominio de tiempo
    const frequencyDataLength = analyserRef.current.frequencyBinCount;
    const frequencyData = new Uint8Array(frequencyDataLength);
    const timeDomainData = new Uint8Array(frequencyDataLength);
    
    // Función para analizar los datos de audio
    const analyzeAudio = () => {
      if (!analyserRef.current) return;
      
      // Obtener datos de frecuencia y dominio de tiempo
      analyserRef.current.getByteFrequencyData(frequencyData);
      analyserRef.current.getByteTimeDomainData(timeDomainData);
      
      // Calcular el nivel promedio de amplitud (0-1)
      let sum = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        sum += frequencyData[i];
      }
      const averageAmplitude = sum / (frequencyData.length * 255);
      
      // Calcular los niveles de frecuencia para diferentes bandas
      const bassEnd = Math.floor(frequencyData.length * 0.1);
      const midEnd = Math.floor(frequencyData.length * 0.5);
      
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
      
      for (let i = 0; i < bassEnd; i++) {
        bassSum += frequencyData[i];
      }
      
      for (let i = bassEnd; i < midEnd; i++) {
        midSum += frequencyData[i];
      }
      
      for (let i = midEnd; i < frequencyData.length; i++) {
        trebleSum += frequencyData[i];
      }
      
      const bassLevel = bassSum / (bassEnd * 255);
      const midLevel = midSum / ((midEnd - bassEnd) * 255);
      const trebleLevel = trebleSum / ((frequencyData.length - midEnd) * 255);
      
      // Encontrar la frecuencia dominante
      let maxValue = 0;
      let maxIndex = 0;
      
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      
      // Convertir el índice a frecuencia (Hz)
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const dominantFrequency = maxIndex * sampleRate / (analyserRef.current.fftSize);
      
      // Detección de beats
      const currentEnergy = bassLevel * 3 + midLevel;
      const isBeat = detectBeat(currentEnergy);
      
      // Actualizar los datos de audio
      const newAudioData: AudioAnalysisData = {
        frequencyData,
        timeDomainData,
        dominantFrequency,
        averageAmplitude,
        bassLevel,
        midLevel,
        trebleLevel,
        isBeat,
      };
      
      setAudioData(newAudioData);
      
      // Notificar a los componentes padres
      if (onAudioDataUpdate) {
        onAudioDataUpdate(newAudioData);
      }
      
      if (onAmplitudeChange) {
        onAmplitudeChange(averageAmplitude);
      }
      
      if (onFrequencyBandChange) {
        onFrequencyBandChange({
          bass: bassLevel,
          lowMid: bassLevel * 0.7 + midLevel * 0.3,
          mid: midLevel,
          highMid: midLevel * 0.3 + trebleLevel * 0.7,
          treble: trebleLevel,
        });
      }
      
      if (isBeat && onBeatDetect) {
        onBeatDetect();
      }
      
      // Dibujar visualizaciones
      if (showSpectrogram) {
        drawSpectrogram(frequencyData);
      }
      
      if (showWaveform) {
        drawWaveform(timeDomainData);
      }
      
      // Continuar el bucle de análisis
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };
    
    // Iniciar el bucle de análisis
    analyzeAudio();
  };
  
  // Detener el análisis de audio
  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
  
  // Detectar beats en el audio
  const detectBeat = (currentEnergy: number): boolean => {
    const now = Date.now();
    const energyThreshold = beatEnergyRef.current * beatDetectionConfig.threshold;
    
    // Actualizar la energía con decay
    beatEnergyRef.current = Math.max(
      currentEnergy,
      beatEnergyRef.current * beatDetectionConfig.decay
    );
    
    // Detectar beat si la energía supera el umbral y ha pasado suficiente tiempo
    if (
      currentEnergy > energyThreshold &&
      now - lastBeatTimeRef.current > beatDetectionConfig.minBeatInterval
    ) {
      lastBeatTimeRef.current = now;
      return true;
    }
    
    return false;
  };
  
  // Dibujar el espectrograma
  const drawSpectrogram = (frequencyData: Uint8Array) => {
    const canvas = canvasSpectrogramRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar el canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Configuración
    const barWidth = canvas.width / frequencyData.length;
    const barSpacing = 1;
    const barWidthWithSpacing = barWidth - barSpacing;
    
    // Dibujar cada barra de frecuencia
    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * canvas.height;
      
      // Calcular el color basado en la frecuencia
      const hue = i / frequencyData.length * 360;
      ctx.fillStyle = `hsl(${hue}, 100%, ${50 + (frequencyData[i] / 255) * 30}%)`;
      
      // Dibujar la barra
      ctx.fillRect(
        i * barWidth,
        canvas.height - barHeight,
        barWidthWithSpacing,
        barHeight
      );
    }
  };
  
  // Dibujar la forma de onda
  const drawWaveform = (timeDomainData: Uint8Array) => {
    const canvas = canvasWaveformRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar el canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Configuración
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
    ctx.beginPath();
    
    // Dibujar la forma de onda
    const sliceWidth = canvas.width / timeDomainData.length;
    let x = 0;
    
    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 128.0;
      const y = v * canvas.height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };
  
  // Iniciar la captura de micrófono
  const startMicrophone = async () => {
    if (!initAudioContext()) return;
    
    try {
      // Detener cualquier fuente de audio actual
      stopCurrentAudioSource();
      
      // Solicitar acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      
      // Crear la fuente de audio del micrófono
      if (audioContextRef.current && gainNodeRef.current) {
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(gainNodeRef.current);
        
        // Actualizar el estado
        setAudioSource('microphone');
        setPlaybackState('playing');
        setMicrophoneAccess(true);
        setAudioError(null);
        
        // Iniciar el análisis de audio
        startAudioAnalysis();
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setMicrophoneAccess(false);
      setAudioError('No se pudo acceder al micrófono');
    }
  };
  
  // Cargar y reproducir un archivo de audio
  const loadAudioFile = (file: File) => {
    if (!initAudioContext()) return;
    
    try {
      // Detener cualquier fuente de audio actual
      stopCurrentAudioSource();
      
      // Crear un elemento de audio
      const audioElement = new Audio();
      audioElement.controls = true;
      audioElementRef.current = audioElement;
      
      // Crear una URL para el archivo
      const fileUrl = URL.createObjectURL(file);
      audioElement.src = fileUrl;
      
      // Configurar eventos
      audioElement.onloadedmetadata = () => {
        if (audioContextRef.current && gainNodeRef.current) {
          // Crear la fuente de audio
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
          sourceRef.current.connect(gainNodeRef.current);
          
          // Actualizar el estado
          setAudioSource('file');
          setAudioFileName(file.name);
          setAudioFileUrl(fileUrl);
          setAudioError(null);
          
          // Reproducir el audio
          audioElement.play().then(() => {
            setPlaybackState('playing');
            startAudioAnalysis();
          }).catch(error => {
            console.error('Error playing audio:', error);
            setAudioError('No se pudo reproducir el audio');
          });
        }
      };
      
      audioElement.onerror = () => {
        console.error('Error loading audio file');
        setAudioError('No se pudo cargar el archivo de audio');
      };
      
      audioElement.onended = () => {
        setPlaybackState('stopped');
      };
    } catch (error) {
      console.error('Error loading audio file:', error);
      setAudioError('No se pudo cargar el archivo de audio');
    }
  };
  
  // Reproducir un archivo de audio de demostración
  const startDemoAudio = () => {
    if (!initAudioContext()) return;
    
    try {
      // Detener cualquier fuente de audio actual
      stopCurrentAudioSource();
      
      // Crear un oscilador para la demostración
      if (audioContextRef.current && gainNodeRef.current) {
        const oscillator = audioContextRef.current.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
        
        // Crear un LFO para modular la frecuencia
        const lfo = audioContextRef.current.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.5, audioContextRef.current.currentTime);
        
        const lfoGain = audioContextRef.current.createGain();
        lfoGain.gain.setValueAtTime(50, audioContextRef.current.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        
        // Conectar el oscilador
        oscillator.connect(gainNodeRef.current);
        sourceRef.current = oscillator;
        
        // Iniciar los osciladores
        oscillator.start();
        lfo.start();
        
        // Actualizar el estado
        setAudioSource('demo');
        setPlaybackState('playing');
        setAudioError(null);
        
        // Iniciar el análisis de audio
        startAudioAnalysis();
      }
    } catch (error) {
      console.error('Error starting demo audio:', error);
      setAudioError('No se pudo iniciar el audio de demostración');
    }
  };
  
  // Detener la fuente de audio actual
  const stopCurrentAudioSource = () => {
    // Detener el análisis de audio
    stopAudioAnalysis();
    
    // Detener la fuente de audio actual
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        
        // Si es un oscilador, detenerlo
        if (sourceRef.current instanceof OscillatorNode) {
          sourceRef.current.stop();
        }
      } catch (e) {
        // Ignorar errores de desconexión
      }
      sourceRef.current = null;
    }
    
    // Detener el elemento de audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    
    // Actualizar el estado
    setPlaybackState('stopped');
  };
  
  // Controlar la reproducción de audio
  const togglePlayback = () => {
    if (!audioElementRef.current || audioSource !== 'file') return;
    
    if (playbackState === 'playing') {
      audioElementRef.current.pause();
      setPlaybackState('paused');
      stopAudioAnalysis();
    } else {
      audioElementRef.current.play();
      setPlaybackState('playing');
      startAudioAnalysis();
    }
  };
  
  // Controlar el volumen
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };
  
  // Controlar el silenciamiento
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Controlar el ecualizador
  const handleEqualizerChange = (band: keyof FrequencyBand, value: number) => {
    setEqualizerSettings(prev => ({
      ...prev,
      bands: {
        ...prev.bands,
        [band]: value,
      },
    }));
  };
  
  // Restablecer el ecualizador
  const resetEqualizer = () => {
    setEqualizerSettings({
      bands: {
        bass: 0,
        lowMid: 0,
        mid: 0,
        highMid: 0,
        treble: 0,
      },
      preAmp: 0,
    });
  };
  
  // Iniciar la grabación de audio
  const startRecording = () => {
    if (!audioContextRef.current || isRecording) return;
    
    try {
      // Crear un destino de grabación
      const destination = audioContextRef.current.createMediaStreamDestination();
      
      // Conectar el analizador al destino de grabación
      if (analyserRef.current) {
        analyserRef.current.connect(destination);
      }
      
      // Crear un grabador de medios
      const recorder = new MediaRecorder(destination.stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      
      // Configurar eventos
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        // Crear un blob con los datos grabados
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        
        // Crear una URL para el blob
        const url = URL.createObjectURL(blob);
        
        // Crear un enlace de descarga
        const a = document.createElement('a');
        a.href = url;
        a.download = `chladni-audio-${Date.now()}.webm`;
        a.click();
        
        // Limpiar
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordingTime(0);
      };
      
      // Iniciar la grabación
      recorder.start(100);
      setIsRecording(true);
      
      // Actualizar el tiempo de grabación
      const startTime = Date.now();
      const updateRecordingTime = () => {
        if (isRecording) {
          setRecordingTime(Date.now() - startTime);
          setTimeout(updateRecordingTime, 1000);
        }
      };
      updateRecordingTime();
    } catch (error) {
      console.error('Error starting recording:', error);
      setAudioError('No se pudo iniciar la grabación');
    }
  };
  
  // Detener la grabación de audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  // Formatear el tiempo de grabación
  const formatRecordingTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 1000 / 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="chladni-music-integration">
      <div className="audio-controls">
        <div className="audio-source-controls">
          <h3>Fuente de Audio</h3>
          <div className="audio-buttons">
            <button
              onClick={startMicrophone}
              className={audioSource === 'microphone' ? 'active' : ''}
              disabled={playbackState === 'playing' && audioSource === 'microphone'}
            >
              Micrófono
            </button>
            
            <label className="file-input-button">
              Archivo de Audio
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    loadAudioFile(file);
                  }
                }}
              />
            </label>
            
            <button
              onClick={startDemoAudio}
              className={audioSource === 'demo' ? 'active' : ''}
              disabled={playbackState === 'playing' && audioSource === 'demo'}
            >
              Demo
            </button>
            
            <button
              onClick={stopCurrentAudioSource}
              disabled={playbackState === 'stopped'}
            >
              Detener
            </button>
          </div>
          
          {audioSource === 'microphone' && microphoneDevices.length > 1 && (
            <div className="microphone-selector">
              <label>Dispositivo:</label>
              <select
                value={selectedMicrophoneId}
                onChange={(e) => setSelectedMicrophoneId(e.target.value)}
              >
                {microphoneDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Micrófono ${device.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {audioSource === 'file' && audioElementRef.current && (
            <div className="file-controls">
              <div className="file-info">
                <span>{audioFileName}</span>
              </div>
              <div className="playback-controls">
                <button onClick={togglePlayback}>
                  {playbackState === 'playing' ? 'Pausar' : 'Reproducir'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="volume-controls">
          <h3>Volumen</h3>
          <div className="volume-slider">
            <button
              onClick={toggleMute}
              className={isMuted ? 'muted' : ''}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              disabled={isMuted}
            />
            <span>{Math.round(volume * 100)}%</span>
          </div>
        </div>
        
        <div className="equalizer-controls">
          <h3>Ecualizador</h3>
          <div className="equalizer-sliders">
            <div className="equalizer-band">
              <label>Graves</label>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={equalizerSettings.bands.bass}
                onChange={(e) => handleEqualizerChange('bass', parseInt(e.target.value))}
              />
              <span>{equalizerSettings.bands.bass > 0 ? '+' : ''}{equalizerSettings.bands.bass} dB</span>
            </div>
            
            <div className="equalizer-band">
              <label>Medios-Graves</label>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={equalizerSettings.bands.lowMid}
                onChange={(e) => handleEqualizerChange('lowMid', parseInt(e.target.value))}
              />
              <span>{equalizerSettings.bands.lowMid > 0 ? '+' : ''}{equalizerSettings.bands.lowMid} dB</span>
            </div>
            
            <div className="equalizer-band">
              <label>Medios</label>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={equalizerSettings.bands.mid}
                onChange={(e) => handleEqualizerChange('mid', parseInt(e.target.value))}
              />
              <span>{equalizerSettings.bands.mid > 0 ? '+' : ''}{equalizerSettings.bands.mid} dB</span>
            </div>
            
            <div className="equalizer-band">
              <label>Medios-Agudos</label>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={equalizerSettings.bands.highMid}
                onChange={(e) => handleEqualizerChange('highMid', parseInt(e.target.value))}
              />
              <span>{equalizerSettings.bands.highMid > 0 ? '+' : ''}{equalizerSettings.bands.highMid} dB</span>
            </div>
            
            <div className="equalizer-band">
              <label>Agudos</label>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={equalizerSettings.bands.treble}
                onChange={(e) => handleEqualizerChange('treble', parseInt(e.target.value))}
              />
              <span>{equalizerSettings.bands.treble > 0 ? '+' : ''}{equalizerSettings.bands.treble} dB</span>
            </div>
          </div>
          
          <button onClick={resetEqualizer} className="reset-button">
            Restablecer EQ
          </button>
        </div>
        
        <div className="recording-controls">
          <h3>Grabación</h3>
          <div className="recording-buttons">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={playbackState !== 'playing'}
                className="record-button"
              >
                Iniciar Grabación
              </button>
            ) : (
              <>
                <button
                  onClick={stopRecording}
                  className="stop-button"
                >
                  Detener Grabación
                </button>
                <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="visualizations">
        {showSpectrogram && (
          <div className="visualization-container">
            <h3>Espectrograma</h3>
            <canvas
              ref={canvasSpectrogramRef}
              width={512}
              height={200}
              className="spectrogram-canvas"
            />
            <div className="frequency-labels">
              <span>20 Hz</span>
              <span>100 Hz</span>
              <span>1 kHz</span>
              <span>10 kHz</span>
              <span>20 kHz</span>
            </div>
          </div>
        )}
        
        {showWaveform && (
          <div className="visualization-container">
            <h3>Forma de Onda</h3>
            <canvas
              ref={canvasWaveformRef}
              width={512}
              height={200}
              className="waveform-canvas"
            />
          </div>
        )}
      </div>
      
      <div className="audio-info">
        <div className="audio-levels">
          <div className="audio-level">
            <label>Graves:</label>
            <div className="level-bar">
              <div
                className="level-fill"
                style={{ width: `${audioData.bassLevel * 100}%` }}
              />
            </div>
            <span>{Math.round(audioData.bassLevel * 100)}%</span>
          </div>
          
          <div className="audio-level">
            <label>Medios:</label>
            <div className="level-bar">
              <div
                className="level-fill"
                style={{ width: `${audioData.midLevel * 100}%` }}
              />
            </div>
            <span>{Math.round(audioData.midLevel * 100)}%</span>
          </div>
          
          <div className="audio-level">
            <label>Agudos:</label>
            <div className="level-bar">
              <div
                className="level-fill"
                style={{ width: `${audioData.trebleLevel * 100}%` }}
              />
            </div>
            <span>{Math.round(audioData.trebleLevel * 100)}%</span>
          </div>
        </div>
        
        <div className="audio-metrics">
          <div className="metric">
            <label>Frecuencia Dominante:</label>
            <span>{audioData.dominantFrequency.toFixed(1)} Hz</span>
          </div>
          
          <div className="metric">
            <label>Amplitud Promedio:</label>
            <span>{Math.round(audioData.averageAmplitude * 100)}%</span>
          </div>
          
          <div className="metric beat-indicator">
            <label>Beat:</label>
            <div className={`beat-light ${audioData.isBeat ? 'active' : ''}`} />
          </div>
        </div>
      </div>
      
      {audioError && (
        <div className="audio-error">
          <p>{audioError}</p>
        </div>
      )}
      
      <style>{`
        .chladni-music-integration {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 8px;
          padding: 16px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 12px;
          font-size: 1.1em;
          color: rgba(255, 255, 255, 0.9);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 6px;
        }
        
        .audio-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .audio-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        button {
          background: rgba(60, 60, 60, 0.5);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }
        
        button:hover {
          background: rgba(80, 80, 80, 0.5);
        }
        
        button:active {
          transform: scale(0.98);
        }
        
        button.active {
          background: rgba(0, 120, 255, 0.5);
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .file-input-button {
          position: relative;
          display: inline-block;
          background: rgba(60, 60, 60, 0.5);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .file-input-button:hover {
          background: rgba(80, 80, 80, 0.5);
        }
        
        .file-input-button input[type="file"] {
          position: absolute;
          top: 0;
          left: 0;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        
        .microphone-selector {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .microphone-selector select {
          flex: 1;
          background: rgba(30, 30, 30, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 6px;
        }
        
        .file-controls {
          margin-top: 12px;
        }
        
        .file-info {
          margin-bottom: 8px;
          font-size: 0.9em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .volume-slider {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .volume-slider button {
          padding: 4px 8px;
          min-width: 36px;
        }
        
        .volume-slider button.muted {
          background: rgba(255, 0, 0, 0.3);
        }
        
        .volume-slider input[type="range"] {
          flex: 1;
        }
        
        .equalizer-sliders {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
        }
        
        .equalizer-band {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .equalizer-band label {
          width: 100px;
          font-size: 0.9em;
        }
        
        .equalizer-band input[type="range"] {
          flex: 1;
        }
        
        .equalizer-band span {
          width: 50px;
          text-align: right;
          font-size: 0.9em;
        }
        
        .reset-button {
          margin-top: 8px;
        }
        
        .recording-buttons {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .record-button {
          background: rgba(255, 0, 0, 0.5);
        }
        
        .record-button:hover {
          background: rgba(255, 0, 0, 0.7);
        }
        
        .stop-button {
          background: rgba(255, 0, 0, 0.7);
          animation: pulse 1.5s infinite;
        }
        
        .recording-time {
          font-family: monospace;
          font-size: 1.2em;
        }
        
        .visualizations {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .visualization-container {
          background: rgba(20, 20, 20, 0.5);
          border-radius: 4px;
          padding: 12px;
        }
        
        canvas {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        
        .frequency-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 0.8em;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .audio-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        
        .audio-levels {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .audio-level {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .audio-level label {
          width: 70px;
          font-size: 0.9em;
        }
        
        .level-bar {
          flex: 1;
          height: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          overflow: hidden;
        }
        
        .level-fill {
          height: 100%;
          background: linear-gradient(90deg, #00bcd4, #3f51b5);
          transition: width 0.1s ease-out;
        }
        
        .audio-level span {
          width: 40px;
          text-align: right;
          font-size: 0.9em;
        }
        
        .audio-metrics {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .metric {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .metric label {
          width: 160px;
          font-size: 0.9em;
        }
        
        .beat-light {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: background-color 0.1s;
        }
        
        .beat-light.active {
          background: #00bcd4;
          box-shadow: 0 0 10px #00bcd4;
        }
        
        .audio-error {
          margin-top: 16px;
          padding: 12px;
          background: rgba(255, 0, 0, 0.1);
          border-left: 4px solid rgba(255, 0, 0, 0.5);
          border-radius: 4px;
        }
        
        .audio-error p {
          margin: 0;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        @media (max-width: 768px) {
          .audio-controls,
          .visualizations,
          .audio-info {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ChladniMusicIntegration;
