import React, { useState, useEffect, useRef } from 'react';
import IndustrialCard from './ui/IndustrialCard';
import IndustrialButtonGroup from './ui/IndustrialButtonGroup';
import IndustrialVerticalFader from './ui/IndustrialVerticalFader';

// Interfaces para tipos
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

interface EQBands {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
}

interface IndustrialMusicIntegrationProps {
  onAudioDataUpdate?: (data: AudioAnalysisData) => void;
  audioResponsive?: boolean;
  onToggleAudioResponsive?: () => void;
  showWaveform?: boolean;
  showSpectrum?: boolean;
  showControls?: boolean;
}

const IndustrialMusicIntegration: React.FC<IndustrialMusicIntegrationProps> = ({
  onAudioDataUpdate,
  audioResponsive = false,
  onToggleAudioResponsive,
  showWaveform = true,
  showSpectrum = false,
  showControls = true
}) => {
  // Estados para fuente de audio
  const [audioSource, setAudioSource] = useState<'mic' | 'file' | 'demo' | 'stream'>('mic');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.7);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [streamStatus, setStreamStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  
  // Estados para ecualizador
  const [eqBands, setEqBands] = useState<EQBands>({
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0
  });
  
  // Estados para análisis de audio
  const [audioData, setAudioData] = useState<AudioAnalysisData | null>(null);
  const [beatThreshold, setBeatThreshold] = useState<number>(0.5);
  const [sensitivity, setSensitivity] = useState<number>(50);
  const [beatDetected, setBeatDetected] = useState<boolean>(false);
  
  // Referencias para audio
  const audioContext = useRef<AudioContext | null>(null);
  const audioSource_ = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | OscillatorNode | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const audioElement = useRef<HTMLAudioElement | null>(null);
  const animationFrame = useRef<number | null>(null);
  
  // Inicializar audio context
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContext.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        audioContext.current = new AudioContext();
        // Crear nodos de audio
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 2048;
        gainNode.current = audioContext.current.createGain();
        
        // Conectar nodos
        gainNode.current.connect(audioContext.current.destination);
        analyser.current.connect(gainNode.current);
      }
    }
    
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close();
      }
    };
  }, []);
  
  // Efecto para actualizar volumen
  useEffect(() => {
    if (gainNode.current) {
      gainNode.current.gain.value = volume;
    }
  }, [volume]);
  
  // Efecto para iniciar/detener análisis de audio
  useEffect(() => {
    if (isPlaying) {
      startAudioAnalysis();
    } else {
      stopAudioAnalysis();
    }
    
    return () => {
      stopAudioAnalysis();
    };
  }, [isPlaying]);
  
  // Función para iniciar el micrófono
  const startMicrophone = async () => {
    if (!audioContext.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Detener fuente anterior si existe
      if (audioSource_.current) {
        audioSource_.current.disconnect();
      }
      
      // Crear nueva fuente desde micrófono
      audioSource_.current = audioContext.current.createMediaStreamSource(stream);
      audioSource_.current.connect(analyser.current!);
      
      setIsPlaying(true);
      setAudioSource('mic');
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };
  
  // Función para cargar archivo de audio
  const loadAudioFile = (file: File) => {
    if (!audioContext.current) return;
    
    // Detener fuente anterior si existe
    stopAudio();
    
    // Crear elemento de audio
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.loop = true;
    audioElement.current = audio;
    
    // Cuando el audio esté listo
    audio.oncanplaythrough = () => {
      if (!audioContext.current) return;
      
      // Crear nueva fuente desde elemento de audio
      audioSource_.current = audioContext.current.createMediaElementSource(audio);
      audioSource_.current.connect(analyser.current!);
      
      setAudioFile(file);
      setAudioSource('file');
    };
  };
  
  // Función para cargar demo de audio
  const loadDemoAudio = () => {
    if (!audioContext.current) return;
    
    // Detener fuente anterior si existe
    stopAudio();
    
    // Crear elemento de audio con demo
    const audio = new Audio('/demo-audio.mp3'); // Asumiendo que existe este archivo
    audio.loop = true;
    audioElement.current = audio;
    
    // Cuando el audio esté listo
    audio.oncanplaythrough = () => {
      if (!audioContext.current) return;
      
      // Crear nueva fuente desde elemento de audio
      audioSource_.current = audioContext.current.createMediaElementSource(audio);
      audioSource_.current.connect(analyser.current!);
      
      setAudioSource('demo');
    };
  };

  // Función para cargar stream de audio
  const loadAudioStream = (url: string) => {
    if (!audioContext.current || !url.trim()) return;

    setStreamStatus('loading');

    // Detener fuente anterior si existe
    stopAudio();

    // Crear elemento de audio con stream URL
    const audio = new Audio();
    audio.crossOrigin = 'anonymous'; // Para CORS
    audio.src = url;
    audioElement.current = audio;

    // Manejadores de eventos
    audio.oncanplaythrough = () => {
      if (!audioContext.current) return;

      try {
        // Crear nueva fuente desde elemento de audio
        audioSource_.current = audioContext.current.createMediaElementSource(audio);
        audioSource_.current.connect(analyser.current!);

        setStreamStatus('ready');
        setAudioSource('stream');
        console.log('🌐 Stream cargado exitosamente:', url);
      } catch (error) {
        console.error('Error conectando stream:', error);
        setStreamStatus('error');
      }
    };

    audio.onerror = (error) => {
      console.error('Error cargando stream:', error);
      setStreamStatus('error');
    };

    audio.onloadstart = () => {
      setStreamStatus('loading');
    };
  };

  // Función para reproducir audio
  const playAudio = () => {
    if (audioSource === 'mic') {
      startMicrophone();
    } else if (audioElement.current) {
      audioElement.current.play();
      setIsPlaying(true);
    }
  };
  
  // Función para detener audio
  const stopAudio = () => {
    if (audioElement.current) {
      audioElement.current.pause();
      audioElement.current.currentTime = 0;
    }
    
    if (audioSource_.current) {
      audioSource_.current.disconnect();
      audioSource_.current = null;
    }
    
    setIsPlaying(false);
  };
  
  // Función para análisis de audio
  const startAudioAnalysis = () => {
    if (!analyser.current) return;
    
    const frequencyData = new Uint8Array(analyser.current.frequencyBinCount);
    const timeDomainData = new Uint8Array(analyser.current.frequencyBinCount);
    
    const analyze = () => {
      if (!analyser.current) return;
      
      // Obtener datos de frecuencia y tiempo
      analyser.current.getByteFrequencyData(frequencyData);
      analyser.current.getByteTimeDomainData(timeDomainData);
      
      // Calcular frecuencia dominante
      let maxValue = 0;
      let maxIndex = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      
      const dominantFrequency = maxIndex * audioContext.current!.sampleRate / analyser.current.fftSize;
      
      // Calcular amplitud promedio
      let sum = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        sum += Math.abs(timeDomainData[i] - 128) / 128;
      }
      const averageAmplitude = sum / timeDomainData.length;
      
      // Calcular niveles de frecuencia por bandas
      const bassEnd = Math.floor(frequencyData.length * 0.1);
      const lowMidEnd = Math.floor(frequencyData.length * 0.3);
      const midEnd = Math.floor(frequencyData.length * 0.5);
      const highMidEnd = Math.floor(frequencyData.length * 0.7);
      
      let bassSum = 0;
      let lowMidSum = 0;
      let midSum = 0;
      let highMidSum = 0;
      let trebleSum = 0;
      
      for (let i = 0; i < bassEnd; i++) {
        bassSum += frequencyData[i];
      }
      
      for (let i = bassEnd; i < lowMidEnd; i++) {
        lowMidSum += frequencyData[i];
      }
      
      for (let i = lowMidEnd; i < midEnd; i++) {
        midSum += frequencyData[i];
      }
      
      for (let i = midEnd; i < highMidEnd; i++) {
        highMidSum += frequencyData[i];
      }
      
      for (let i = highMidEnd; i < frequencyData.length; i++) {
        trebleSum += frequencyData[i];
      }
      
      const bassLevel = bassSum / (bassEnd * 255);
      const lowMidLevel = lowMidSum / ((lowMidEnd - bassEnd) * 255);
      const midLevel = midSum / ((midEnd - lowMidEnd) * 255);
      const highMidLevel = highMidSum / ((highMidEnd - midEnd) * 255);
      const trebleLevel = trebleSum / ((frequencyData.length - highMidEnd) * 255);
      
      // Detectar beat
      const isBeat = bassLevel > beatThreshold;
      setBeatDetected(isBeat);
      
      // Crear objeto de datos de audio
      const newAudioData: AudioAnalysisData = {
        frequencyData,
        timeDomainData,
        dominantFrequency,
        averageAmplitude,
        bassLevel,
        midLevel,
        trebleLevel,
        isBeat
      };
      
      // Actualizar estado y notificar
      setAudioData(newAudioData);
      if (onAudioDataUpdate) {
        onAudioDataUpdate(newAudioData);
      }
      
      // Continuar análisis
      animationFrame.current = requestAnimationFrame(analyze);
    };
    
    analyze();
  };
  
  // Función para detener análisis
  const stopAudioAnalysis = () => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };
  
  // Manejador para cambio de fuente de audio
  const handleAudioSourceChange = (source: 'mic' | 'file' | 'demo' | 'stream') => {
    stopAudio();
    setAudioSource(source);

    if (source === 'mic') {
      startMicrophone();
    } else if (source === 'demo') {
      loadDemoAudio();
    } else if (source === 'stream') {
      setStreamStatus('idle');
    }
    // Para 'file', el usuario debe seleccionar un archivo
    // Para 'stream', el usuario debe ingresar una URL
  };
  
  // Manejador para cambio de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      loadAudioFile(files[0]);
    }
  };

  // Manejador para cambio de URL de stream
  const handleStreamUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStreamUrl(e.target.value);
  };

  // Manejador para cargar stream
  const handleLoadStream = () => {
    if (streamUrl.trim()) {
      loadAudioStream(streamUrl);
    }
  };

  // Manejador para cambio de banda de EQ
  const handleEqBandChange = (band: keyof EQBands, value: number) => {
    setEqBands(prev => ({
      ...prev,
      [band]: value
    }));
    
    // Aquí iría la lógica para aplicar el EQ al audio
    // (requeriría nodos BiquadFilter para cada banda)
  };
  
  // Manejador para resetear EQ
  const resetEq = () => {
    setEqBands({
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0
    });
  };
  
  return (
    <div className="industrial-music-integration">
      {/* ====== AUDIO SOURCE CARD ====== */}
      <IndustrialCard
        title="Fuente de Audio"
        headerActions={
          <div className="industrial-flex industrial-items-center industrial-gap-sm">
            {isPlaying && <span className="industrial-led industrial-led-on"></span>}
            <button
              className="industrial-button"
              onClick={playAudio}
              disabled={isPlaying}
              title="Play"
              style={{
                fontSize: '1.2em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ▶
            </button>
            <button
              className="industrial-button"
              onClick={stopAudio}
              disabled={!isPlaying}
              title="Stop"
              style={{
                fontSize: '1.2em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ⏹
            </button>
          </div>
        }
      >
        <div className="industrial-flex industrial-gap-lg">
          {/* Columna Izquierda: Fuentes */}
          <div className="industrial-flex-1">
            {/* Source Selection */}
            <IndustrialButtonGroup
              options={[
                { value: 'mic', label: 'MIC', icon: '🎤' },
                { value: 'file', label: 'FILE', icon: '📁' },
                { value: 'demo', label: 'DEMO', icon: '🎵' },
                { value: 'stream', label: 'STREAM', icon: '🌐' }
              ]}
              value={audioSource}
              onChange={(value) => handleAudioSourceChange(value as 'mic' | 'file' | 'demo' | 'stream')}
              size="sm"
            />

            {/* File Input (visible when 'file' is selected) */}
            {audioSource === 'file' && (
              <div className="industrial-file-input-container industrial-mt-sm">
                <input
                  type="file"
                  id="audio-file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="industrial-file-input"
                />
                <label htmlFor="audio-file" className="industrial-button">
                  <span className="industrial-icon industrial-icon-upload"></span>
                  Select Audio File
                </label>
                {audioFile && (
                  <span className="industrial-file-name">{audioFile.name}</span>
                )}
              </div>
            )}

            {/* Stream Input (visible when 'stream' is selected) */}
            {audioSource === 'stream' && (
              <div className="industrial-stream-input-container industrial-mt-sm">
                <div className="industrial-flex industrial-gap-lg">
                  {/* URL Input */}
                  <div className="industrial-flex-1">
                    <div className="industrial-flex industrial-gap-sm">
                      <input
                        type="url"
                        value={streamUrl}
                        onChange={handleStreamUrlChange}
                        placeholder="https://stream.example.com/audio.mp3"
                        className="industrial-text-input industrial-flex-1"
                      />
                      <button
                        className="industrial-button"
                        onClick={handleLoadStream}
                        disabled={!streamUrl.trim() || streamStatus === 'loading'}
                        title={streamStatus === 'loading' ? 'Cargando...' : 'Cargar Stream'}
                      >
                        {streamStatus === 'loading' ? '⏳' : '🌐'}
                      </button>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="industrial-flex industrial-items-center" style={{ minWidth: '120px' }}>
                    <span className={`industrial-status-indicator industrial-status-${streamStatus}`}>
                      {streamStatus === 'idle' && 'IDLE'}
                      {streamStatus === 'loading' && 'LOADING'}
                      {streamStatus === 'ready' && 'READY'}
                      {streamStatus === 'error' && 'ERROR'}
                    </span>
                  </div>
                </div>

                {/* Info Expandible */}
                <details className="industrial-details industrial-mt-md">
                  <summary className="industrial-details-summary">ℹ️ Información de Compatibilidad</summary>
                  <div className="industrial-details-content">
                    <p>
                      <strong>Formatos:</strong> MP3, WAV, OGG, AAC, M4A<br/>
                      <strong>Protocolos:</strong> HTTP/HTTPS<br/>
                      <strong>Nota:</strong> Algunos streams requieren CORS habilitado
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Columna Derecha: Control de Volumen */}
          <div className="industrial-flex industrial-justify-center industrial-items-start" style={{ minWidth: '100px' }}>
            <IndustrialVerticalFader
              label="VOL"
              min={0}
              max={1}
              value={volume}
              onChange={setVolume}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              defaultValue={0.7}
              height={120}
            />
          </div>
        </div>
      </IndustrialCard>

      {/* ====== ECUALIZADOR CARD ====== */}
      <IndustrialCard
        title="Ecualizador 5 Bandas"
        headerActions={
          <button
            className="industrial-button"
            onClick={resetEq}
            title="Reset Equalizer"
          >
            <span className="industrial-icon industrial-icon-reset"></span>
            Reset
          </button>
        }
      >
        <div className="industrial-flex industrial-justify-between industrial-gap-md">
          {/* Bass EQ */}
          <IndustrialVerticalFader
            label="BASS"
            min={-12}
            max={12}
            value={eqBands.bass}
            onChange={(value) => handleEqBandChange('bass', value)}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            defaultValue={0}
            height={100}
          />

          {/* Low-Mid EQ */}
          <IndustrialVerticalFader
            label="L-MID"
            min={-12}
            max={12}
            value={eqBands.lowMid}
            onChange={(value) => handleEqBandChange('lowMid', value)}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            defaultValue={0}
            height={100}
          />

          {/* Mid EQ */}
          <IndustrialVerticalFader
            label="MID"
            min={-12}
            max={12}
            value={eqBands.mid}
            onChange={(value) => handleEqBandChange('mid', value)}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            defaultValue={0}
            height={100}
          />

          {/* High-Mid EQ */}
          <IndustrialVerticalFader
            label="H-MID"
            min={-12}
            max={12}
            value={eqBands.highMid}
            onChange={(value) => handleEqBandChange('highMid', value)}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            defaultValue={0}
            height={100}
          />

          {/* Treble EQ */}
          <IndustrialVerticalFader
            label="HIGH"
            min={-12}
            max={12}
            value={eqBands.treble}
            onChange={(value) => handleEqBandChange('treble', value)}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            defaultValue={0}
            height={100}
          />
        </div>
      </IndustrialCard>

      {/* ====== ANÁLISIS DE AUDIO CARD ====== */}
      <IndustrialCard
        title="Análisis de Audio"
        headerActions={beatDetected ? <span className="industrial-led industrial-led-on industrial-pulse"></span> : null}
      >
        {/* Real-time Audio Data */}
        <div className="industrial-data-grid">
          {/* First row: Frequency and Amplitude */}
          <div className="industrial-data-row industrial-mb-sm">
            <span className="industrial-data-label">FREQ:</span>
            <span className="industrial-data-value">
              {audioData ? `${audioData.dominantFrequency.toFixed(1)}Hz` : '---'}
            </span>

            <span className="industrial-data-label industrial-ml-md">AMP:</span>
            <span className="industrial-data-value">
              {audioData ? `${(audioData.averageAmplitude * 100).toFixed(0)}%` : '---'}
            </span>
          </div>

          {/* Second row: Beat detection */}
          <div className="industrial-data-row industrial-mb-md">
            <span className="industrial-data-label">BEAT:</span>
            <span className={`industrial-led ${beatDetected ? 'industrial-led-on' : ''}`}></span>
          </div>

          {/* Faders Row: Threshold y Sensitivity lado a lado */}
          <div className="industrial-flex industrial-justify-center industrial-gap-lg">
            <IndustrialVerticalFader
              label="THRESH"
              min={0}
              max={1}
              value={beatThreshold}
              onChange={setBeatThreshold}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              defaultValue={0.3}
              height={80}
            />
            <IndustrialVerticalFader
              label="SENS"
              min={1}
              max={100}
              value={sensitivity}
              onChange={setSensitivity}
              formatValue={(v) => `${v}%`}
              defaultValue={50}
              height={80}
            />
          </div>
        </div>

        {/* Visualization Area (optional) */}
        {showWaveform && audioData && (
          <div className="industrial-visualization-container industrial-mt-md">
            <div className="industrial-waveform">
              {/* Canvas for waveform would go here */}
            </div>
          </div>
        )}
      </IndustrialCard>
    </div>
  );
};

export default IndustrialMusicIntegration;
