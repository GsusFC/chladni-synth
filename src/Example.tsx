import React, { useState } from 'react';
/* Industrial/technical stylesheet */
import './styles-industrial.css';
import ChladniSynthesizer from './components/ChladniSynthesizer';
import ChladniSynthesizerOptimized from './components/ChladniSynthesizerOptimized';
import ChladniAdvancedControls from './components/ChladniAdvancedControls';
import ChladniMusicIntegration from './components/ChladniMusicIntegration';

// Interfaces para los datos de audio
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

interface FrequencyBand {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
}

// Componente de ejemplo para mostrar el Sintetizador Visual Chladni
const Example: React.FC = () => {
  // Estado para controlar qué modo de renderizado usar
  const [renderMode, setRenderMode] = useState<'basic' | 'optimized'>('basic');
  // Estado para controlar qué panel de controles mostrar
  const [controlPanel, setControlPanel] = useState<'basic' | 'advanced' | 'music'>('basic');
  // Estado para controlar parámetros del sintetizador
  const [n, setN] = useState<number>(5);
  const [m, setM] = useState<number>(3);
  const [colorMode, setColorMode] = useState<'spectrum' | 'amplitude' | 'frequency'>('spectrum');
  const [sensitivity, setSensitivity] = useState<number>(50);
  // Estado para datos de audio
  const [audioData, setAudioData] = useState<AudioAnalysisData | null>(null);
  const [audioResponsive, setAudioResponsive] = useState<boolean>(false);
  const [beatDetected, setBeatDetected] = useState<boolean>(false);
  
  // Detectar si el dispositivo es de alto rendimiento
  const isHighPerformanceDevice = (): boolean => {
    // Usar hardwareConcurrency como heurística para capacidad de rendimiento
    // `navigator.hardwareConcurrency` puede ser undefined; aseguramos un booleano estricto
    return (navigator.hardwareConcurrency ?? 0) >= 4;
  };

  // Manejar cambios en los datos de audio
  const handleAudioDataUpdate = (data: AudioAnalysisData) => {
    setAudioData(data);
    
    // Si el modo audio-responsivo está activo, actualizar parámetros
    if (audioResponsive) {
      // Mapear la amplitud del bajo a los parámetros n y m
      const newN = Math.max(1, Math.min(20, Math.floor(data.bassLevel * 20) + 1));
      const newM = Math.max(1, Math.min(20, Math.floor(data.midLevel * 15) + 1));
      
      if (Math.abs(newN - n) > 1) setN(newN);
      if (Math.abs(newM - m) > 1) setM(newM);
    }
  };
  
  // Manejar cambios en las bandas de frecuencia
  const handleFrequencyBandChange = (_bands: FrequencyBand) => {
    // Podríamos usar esto para mapear diferentes bandas a diferentes aspectos visuales
  };
  
  // Manejar cambios en la amplitud
  const handleAmplitudeChange = (amplitude: number) => {
    setSensitivity(amplitude * 100);
  };
  
  // Manejar detección de beats
  const handleBeatDetect = () => {
    setBeatDetected(true);
    
    // Si el modo audio-responsivo está activo, cambiar parámetros en el beat
    if (audioResponsive) {
      // Cambiar aleatoriamente los parámetros n y m en cada beat
      setN(Math.floor(Math.random() * 15) + 1);
      setM(Math.floor(Math.random() * 10) + 1);
    }
    
    // Resetear el estado de beat después de un breve período
    setTimeout(() => {
      setBeatDetected(false);
    }, 100);
  };
  
  // Alternar el modo audio-responsivo
  const toggleAudioResponsive = () => {
    setAudioResponsive(!audioResponsive);
  };

  return (
    <div className="industrial-container">
      {/* ================= HEADER ================= */}
      <header className="industrial-header">
        <h1 className="industrial-title">Sintetizador Visual Chladni</h1>

        {/* ----- Render-mode selector ----- */}
        <div className="industrial-button-group industrial-justify-center industrial-mt-sm">
          <button
            className={`industrial-button ${renderMode === 'basic' ? 'industrial-button-active' : ''}`}
            onClick={() => setRenderMode('basic')}
          >
            Básico
          </button>
          <button
            className={`industrial-button ${renderMode === 'optimized' ? 'industrial-button-active' : ''}`}
            onClick={() => setRenderMode('optimized')}
          >
            Optimizado
          </button>
        </div>
        
        {/* ----- Control-panel selector ----- */}
        <div className="industrial-button-group industrial-justify-center industrial-mt-sm">
          <button
            className={`industrial-button ${controlPanel === 'basic' ? 'industrial-button-active' : ''}`}
            onClick={() => setControlPanel('basic')}
          >
            Básicos
          </button>
          <button
            className={`industrial-button ${controlPanel === 'advanced' ? 'industrial-button-active' : ''}`}
            onClick={() => setControlPanel('advanced')}
          >
            Avanzados
          </button>
          <button
            className={`industrial-button ${controlPanel === 'music' ? 'industrial-button-active' : ''}`}
            onClick={() => setControlPanel('music')}
          >
            Musical
          </button>
        </div>
        
        {audioResponsive && (
          <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <span style={{ 
              display: 'inline-block',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: '#6d28d9',
              fontSize: '0.75rem',
              animation: beatDetected ? 'pulse 1.5s infinite' : 'none'
            }}>
              Modo Audio-Responsivo Activo
            </span>
          </div>
        )}
      </header>
      
      {/* ================= MAIN (70/30 columns) ================= */}
      <main className="industrial-main">
        {/* ------- Visualization Area ------- */}
        <div className="industrial-visualization">
          {renderMode === 'basic' ? (
            <ChladniSynthesizer 
              initialN={n}
              initialM={m}
              colorMode={colorMode}
              sensitivity={sensitivity}
              showControls={false}
            />
          ) : (
            <ChladniSynthesizerOptimized
              initialN={n}
              initialM={m}
              colorMode={colorMode}
              sensitivity={sensitivity}
              showControls={true}
              useWebGL={true}
              particleDensity={'ultra'}
              useOffscreenCanvas={false}
              useWorker={false}
              fpsLimit={60}
              beatDetected={beatDetected}
            />
          )}
        </div>

        {/* ------- Controls Column (modules) ------- */}
        <div className="industrial-controls">
          {/* Basic Controls Panel */}
          {controlPanel === 'basic' && (
            <div className="industrial-module">
              <div className="industrial-module-header">
                <span className="industrial-module-title">Controles Básicos</span>
              </div>
              <div className="industrial-module-content">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'white', 
                    marginBottom: '0.25rem' 
                  }}>
                    Parámetro n: {n}
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={n} 
                    onChange={(e) => setN(parseInt(e.target.value))} 
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'white', 
                    marginBottom: '0.25rem' 
                  }}>
                    Parámetro m: {m}
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={m} 
                    onChange={(e) => setM(parseInt(e.target.value))} 
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'white', 
                    marginBottom: '0.5rem' 
                  }}>
                    Modo de Color:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: colorMode === 'spectrum' ? '#2563eb' : '#374151'
                      }}
                      onClick={() => setColorMode('spectrum')}
                    >
                      Espectro
                    </button>
                    <button 
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: colorMode === 'amplitude' ? '#2563eb' : '#374151'
                      }}
                      onClick={() => setColorMode('amplitude')}
                    >
                      Amplitud
                    </button>
                    <button 
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: colorMode === 'frequency' ? '#2563eb' : '#374151'
                      }}
                      onClick={() => setColorMode('frequency')}
                    >
                      Frecuencia
                    </button>
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'white', 
                    marginBottom: '0.25rem' 
                  }}>
                    Sensibilidad: {sensitivity}%
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={sensitivity} 
                    onChange={(e) => setSensitivity(parseInt(e.target.value))} 
                    style={{ width: '100%' }}
                  />
                </div>
                
                <button 
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    backgroundColor: audioResponsive ? '#6d28d9' : '#374151',
                    width: '100%'
                  }}
                  onClick={toggleAudioResponsive}
                >
                  {audioResponsive ? 'Desactivar Modo Audio-Responsivo' : 'Activar Modo Audio-Responsivo'}
                </button>
              </div>
            </div>
          )}
          
          {/* Advanced Controls Panel */}
          {controlPanel === 'advanced' && (
            <div className="industrial-module">
              <div className="industrial-module-header">
                <span className="industrial-module-title">Controles Avanzados</span>
              </div>
              <div className="industrial-module-content">
                <ChladniAdvancedControls 
                  initialN={n}
                  initialM={m}
                  colorMode={colorMode}
                  enableCustomEquations={true}
                  enablePresets={true}
                  enableMIDI={true}
                  enableRecording={true}
                  onPresetSave={(preset) => {
                    console.log('Preset saved:', preset);
                    // Aquí podríamos guardar el preset en localStorage o en una base de datos
                  }}
                  onPresetLoad={(preset) => {
                    console.log('Preset loaded:', preset);
                    // Implementar lógica para cargar presets
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Music Integration Panel */}
          {controlPanel === 'music' && (
            <div className="industrial-module">
              <div className="industrial-module-header">
                <span className="industrial-module-title">Integración Musical</span>
              </div>
              <div className="industrial-module-content">
                <ChladniMusicIntegration 
                  onAudioDataUpdate={handleAudioDataUpdate}
                  onFrequencyBandChange={handleFrequencyBandChange}
                  onAmplitudeChange={handleAmplitudeChange}
                  onBeatDetect={handleBeatDetect}
                  initialVolume={0.7}
                  autoStart={false}
                  showSpectrogram={true}
                  showWaveform={true}
                />
                
                <div style={{ marginTop: '1rem' }}>
                  <button 
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                      backgroundColor: audioResponsive ? '#6d28d9' : '#374151',
                      width: '100%'
                    }}
                    onClick={toggleAudioResponsive}
                  >
                    {audioResponsive ? 'Desactivar Modo Audio-Responsivo' : 'Activar Modo Audio-Responsivo'}
                  </button>
                </div>
                
                {audioData && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                    borderRadius: '4px' 
                  }}>
                    <h3 style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 'bold', 
                      marginBottom: '0.5rem', 
                      color: 'white' 
                    }}>
                      Datos de Audio
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      Frecuencia Dominante: {audioData.dominantFrequency.toFixed(1)} Hz
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      Amplitud: {(audioData.averageAmplitude * 100).toFixed(1)}%
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      Nivel de Graves: {(audioData.bassLevel * 100).toFixed(1)}%
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      Nivel de Medios: {(audioData.midLevel * 100).toFixed(1)}%
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                      Nivel de Agudos: {(audioData.trebleLevel * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* System Status Panel - Only visible in optimized mode */}
          {renderMode === 'optimized' && (
            <div className="industrial-module">
              <div className="industrial-module-header">
                <span className="industrial-module-title">Estado del Sistema</span>
              </div>
              <div className="industrial-module-content">
                <div className="industrial-status-bar">
                  <span className="industrial-status-item">
                    <span className="industrial-status-label">PARTICLES:</span>
                    <span className="industrial-status-value">50.000</span>
                  </span>
                  <span className="industrial-status-item">
                    <span className="industrial-status-label">RENDER:</span>
                    <span className="industrial-status-value">GL</span>
                  </span>
                  <span className="industrial-status-item">
                    <span className="industrial-status-label">FPS:</span>
                    <span className="industrial-status-value">60</span>
                  </span>
                </div>
                
                <div className="industrial-status-bar industrial-mt-sm">
                  <span className="industrial-status-item">
                    <span className="industrial-status-label">AUDIO:</span>
                    <span className={`industrial-led ${audioResponsive ? 'industrial-led-on' : ''}`}></span>
                  </span>
                  <span className="industrial-status-item">
                    <span className="industrial-status-label">BEAT:</span>
                    <span className={`industrial-led ${beatDetected ? 'industrial-led-on industrial-pulse' : ''}`}></span>
                  </span>
                  <span className="industrial-status-item">
                    <span className="industrial-status-label">OFFSCREEN:</span>
                    <span className="industrial-led"></span>
                  </span>
                </div>
                
                <div className="industrial-mt-md">
                  <p className="industrial-data-label">Modo: {renderMode.toUpperCase()}</p>
                  <p className="industrial-data-label">Densidad: ULTRA (50.000 partículas)</p>
                  <p className="industrial-data-label">WebGL: ACTIVO</p>
                  <p className="industrial-data-label">Worker: INACTIVO</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* ================= FOOTER / STATUS BAR ================= */}
      <footer className="industrial-footer">
        <div className="industrial-status-bar">
          <span>[FPS:60]</span>
          <span>[Audio:{audioResponsive ? 'ON' : 'OFF'}]</span>
          <span>[Mode:{renderMode.toUpperCase()}]</span>
        </div>
        <span className="industrial-text-center">
          Ernst Chladni · 1756-1827
        </span>
      </footer>
    </div>
  );
};

export default Example;
