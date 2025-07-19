import React, { useState, useEffect, useRef } from 'react';
import CustomVerticalFader from './CustomVerticalFader';
import CustomHorizontalFader from './CustomHorizontalFader';
import SimpleHorizontalFader from './SimpleHorizontalFader';

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
  const [audioSource, setAudioSource] = useState<'mic' | 'file' | 'demo'>('mic');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.7);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
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
  const handleAudioSourceChange = (source: 'mic' | 'file' | 'demo') => {
    stopAudio();
    setAudioSource(source);
    
    if (source === 'mic') {
      startMicrophone();
    } else if (source === 'demo') {
      loadDemoAudio();
    }
  };
  
  // Manejador para cambio de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      loadAudioFile(files[0]);
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
      {/* ====== AUDIO SOURCE MODULE ====== */}
      <div className="industrial-module">
        <div className="industrial-module-header">
          <span className="industrial-module-title">Audio Source</span>
          {isPlaying && <span className="industrial-led industrial-led-on"></span>}
        </div>
        <div className="industrial-module-content">
          {/* Source Selection */}
          <div className="industrial-radio-group">
            <label className="industrial-radio-label">
              <input
                type="radio"
                className="industrial-radio"
                checked={audioSource === 'mic'}
                onChange={() => handleAudioSourceChange('mic')}
              />
              <span className="industrial-radio-text">MIC</span>
            </label>
            
            <label className="industrial-radio-label">
              <input
                type="radio"
                className="industrial-radio"
                checked={audioSource === 'file'}
                onChange={() => handleAudioSourceChange('file')}
              />
              <span className="industrial-radio-text">FILE</span>
            </label>
            
            <label className="industrial-radio-label">
              <input
                type="radio"
                className="industrial-radio"
                checked={audioSource === 'demo'}
                onChange={() => handleAudioSourceChange('demo')}
              />
              <span className="industrial-radio-text">DEMO</span>
            </label>
          </div>
          
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
          
          {/* Playback Controls - REORGANIZED: Separate Play/Stop from Volume */}
          <div className="industrial-mt-md">
            {/* Line 1: Play/Stop buttons */}
            <div className="industrial-flex industrial-justify-center industrial-mb-sm">
              <div className="industrial-button-group">
                <button
                  className="industrial-button"
                  onClick={playAudio}
                  disabled={isPlaying}
                >
                  <span className="industrial-icon industrial-icon-play"></span>
                  Play
                </button>
                
                <button
                  className="industrial-button"
                  onClick={stopAudio}
                  disabled={!isPlaying}
                >
                  <span className="industrial-icon industrial-icon-stop"></span>
                  Stop
                </button>
              </div>
            </div>
            
            {/* Line 2: Volume Control with more space */}
            <div className="industrial-flex industrial-items-center industrial-gap-md">
              <span className="industrial-label">VOL:</span>
              <div className="industrial-flex-grow">
                <SimpleHorizontalFader
                  min={0}
                  max={1}
                  value={volume}
                  onChange={setVolume}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ====== 5-BAND EQUALIZER MODULE ====== */}
      <div className="industrial-module industrial-mt-md">
        <div className="industrial-module-header">
          <span className="industrial-module-title">5-Band Equalizer</span>
        </div>
        <div className="industrial-module-content">
          <div className="industrial-flex industrial-justify-between industrial-gap-md">
            {/* Bass EQ */}
            <CustomVerticalFader
              label="BASS"
              min={-12}
              max={12}
              value={eqBands.bass}
              onChange={(value) => handleEqBandChange('bass', value)}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            />
            
            {/* Low-Mid EQ */}
            <CustomVerticalFader
              label="L-MID"
              min={-12}
              max={12}
              value={eqBands.lowMid}
              onChange={(value) => handleEqBandChange('lowMid', value)}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            />
            
            {/* Mid EQ */}
            <CustomVerticalFader
              label="MID"
              min={-12}
              max={12}
              value={eqBands.mid}
              onChange={(value) => handleEqBandChange('mid', value)}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            />
            
            {/* High-Mid EQ */}
            <CustomVerticalFader
              label="H-MID"
              min={-12}
              max={12}
              value={eqBands.highMid}
              onChange={(value) => handleEqBandChange('highMid', value)}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            />
            
            {/* Treble EQ */}
            <CustomVerticalFader
              label="HIGH"
              min={-12}
              max={12}
              value={eqBands.treble}
              onChange={(value) => handleEqBandChange('treble', value)}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}dB`}
            />
          </div>
          
          {/* Reset EQ Button */}
          <div className="industrial-flex industrial-justify-center industrial-mt-md">
            <button
              className="industrial-button"
              onClick={resetEq}
            >
              <span className="industrial-icon industrial-icon-reset"></span>
              Reset EQ
            </button>
          </div>
        </div>
      </div>
      
      {/* ====== AUDIO ANALYSIS MODULE ====== */}
      <div className="industrial-module industrial-mt-md">
        <div className="industrial-module-header">
          <span className="industrial-module-title">Audio Analysis</span>
          {beatDetected && <span className="industrial-led industrial-led-on industrial-pulse"></span>}
        </div>
        <div className="industrial-module-content">
          {/* Real-time Audio Data - REORGANIZED for better spacing */}
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
            
            {/* Third row: Threshold control on its own line */}
            <div className="industrial-flex industrial-items-center industrial-gap-sm industrial-mb-md">
              <span className="industrial-data-label">THRESH:</span>
              <div className="industrial-flex-grow">
                <SimpleHorizontalFader
                  min={0}
                  max={1}
                  value={beatThreshold}
                  onChange={setBeatThreshold}
                />
              </div>
            </div>
            
            {/* Fourth row: Sensitivity control on its own line */}
            <div className="industrial-flex industrial-items-center industrial-gap-sm">
              <span className="industrial-label">SENS:</span>
              <div className="industrial-flex-grow">
                <SimpleHorizontalFader
                  min={1}
                  max={100}
                  value={sensitivity}
                  onChange={setSensitivity}
                />
              </div>
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
        </div>
      </div>
    </div>
  );
};

export default IndustrialMusicIntegration;
