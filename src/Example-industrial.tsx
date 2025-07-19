import React, { useState, useEffect } from 'react';
import './styles-industrial.css';
import ChladniSynthesizer from './components/ChladniSynthesizer';
import ChladniSynthesizerOptimized from './components/ChladniSynthesizerOptimized';
import IndustrialAdvancedControls from './components/IndustrialAdvancedControls';
import IndustrialMusicIntegration from './components/IndustrialMusicIntegration';
import CustomVerticalFader from './components/CustomVerticalFader';
import IndustrialTabs, { TabItem } from './components/IndustrialTabs';

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

// Componente de ejemplo industrial para mostrar el Sintetizador Visual Chladni
const ExampleIndustrial: React.FC = () => {
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
  // Estado para FPS (para la status bar)
  const [fps, setFps] = useState<number>(60);
  
  // Detectar si el dispositivo es de alto rendimiento
  const isHighPerformanceDevice = (): boolean => {
    // Usar hardwareConcurrency como heurística para capacidad de rendimiento
    return (navigator.hardwareConcurrency ?? 0) >= 4;
  };
  
  // Manejar actualizaciones de datos de audio
  const handleAudioDataUpdate = (data: AudioAnalysisData) => {
    setAudioData(data);
    setBeatDetected(data.isBeat);
    
    if (audioResponsive) {
      // Mapear frecuencia dominante a parámetro n (1-20)
      const newN = Math.max(1, Math.min(20, Math.floor(data.dominantFrequency / 100)));
      setN(newN);
      
      // Mapear amplitud a parámetro m (1-20)
      const newM = Math.max(1, Math.min(20, Math.floor(data.averageAmplitude * 20) + 1));
      setM(newM);
    }
  };
  
  // Alternar modo audio-responsivo
  const toggleAudioResponsive = () => {
    setAudioResponsive(!audioResponsive);
  };

  // Simular actualización de FPS para la status bar
  useEffect(() => {
    const interval = setInterval(() => {
      // Simular variaciones de FPS entre 55-60
      setFps(Math.floor(Math.random() * 6) + 55);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="industrial-container">
      {/* ================= HEADER ================= */}
      <header className="industrial-header">
        <h1 className="industrial-title">Sintetizador Visual Chladni</h1>

        {/* ----- Tabs en una sola línea horizontal ----- */}
        <div className="industrial-tabs-row">
          {/* ----- Render-mode tabs (Basic / Optimized) ----- */}
          <div className="industrial-tabs-group">
            {(() => {
              const renderTabs: TabItem[] = [
                {
                  id: 'basic',
                  label: (
                    <>
                      <span className="industrial-icon industrial-icon-play"></span>
                      Básico
                    </>
                  ),
                  content: null
                },
                {
                  id: 'optimized',
                  label: (
                    <>
                      <span className="industrial-icon industrial-icon-play"></span>
                      Optimizado
                    </>
                  ),
                  content: null
                }
              ];
              return (
                <IndustrialTabs
                  tabs={renderTabs}
                  defaultActiveTab={renderMode}
                  onTabChange={(id) => setRenderMode(id as 'basic' | 'optimized')}
                  size="small"
                  ariaLabel="Selector de modo de renderizado"
                />
              );
            })()}
          </div>

          {/* ----- Separador visual ----- */}
          <div className="industrial-tabs-separator"></div>

          {/* ----- Control-panel tabs (Basic / Advanced / Music) ----- */}
          <div className="industrial-tabs-group">
            {(() => {
              const panelTabs: TabItem[] = [
                { id: 'basic', label: 'Básicos', content: null },
                { id: 'advanced', label: 'Avanzados', content: null },
                { id: 'music', label: 'Musical', content: null }
              ];
              return (
                <IndustrialTabs
                  tabs={panelTabs}
                  defaultActiveTab={controlPanel}
                  onTabChange={(id) => setControlPanel(id as 'basic' | 'advanced' | 'music')}
                  size="small"
                  ariaLabel="Selector de panel de controles"
                />
              );
            })()}
          </div>
        </div>
      </header>
      
      {/* ================= MAIN (70/30 columns) ================= */}
      <main className="industrial-main">
        {/* ------- Visualization Area (70%) ------- */}
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
              showControls={false}
              useWebGL={true}
              particleDensity={isHighPerformanceDevice() ? 'high' : 'medium'}
              useOffscreenCanvas={isHighPerformanceDevice()}
              audioData={audioResponsive ? audioData : undefined}
            />
          )}
        </div>

        {/* ------- Controls Column (30%) ------- */}
        <div className="industrial-controls">
          {/* Basic Controls Module */}
          {controlPanel === 'basic' && (
            <div className="industrial-module">
              <div className="industrial-module-header">
                <span className="industrial-module-title">Basic Controls</span>
                {audioResponsive && <span className="industrial-led industrial-led-on"></span>}
              </div>
              <div className="industrial-module-content">
                {/* Three vertical faders in a row */}
                <div className="industrial-flex industrial-gap-lg industrial-justify-between">
                  <CustomVerticalFader
                    label="PARAM N"
                    min={1}
                    max={20}
                    value={n}
                    onChange={setN}
                    formatValue={(v) => v.toString().padStart(2, '0')}
                  />

                  <CustomVerticalFader
                    label="PARAM M"
                    min={1}
                    max={20}
                    value={m}
                    onChange={setM}
                    formatValue={(v) => v.toString().padStart(2, '0')}
                  />

                  <CustomVerticalFader
                    label="SENSITIVITY"
                    min={1}
                    max={100}
                    value={sensitivity}
                    onChange={setSensitivity}
                    formatValue={(v) => `${v}%`}
                  />
                </div>

                {/* Color Mode Selector */}
                <div className="industrial-mt-md">
                  <div className="industrial-fader-label">COLOR MODE</div>
                  <div className="industrial-button-group industrial-mt-sm">
                    <button 
                      className={`industrial-button ${colorMode === 'spectrum' ? 'industrial-button-active' : ''}`}
                      onClick={() => setColorMode('spectrum')}
                    >
                      Espectro
                    </button>
                    <button 
                      className={`industrial-button ${colorMode === 'amplitude' ? 'industrial-button-active' : ''}`}
                      onClick={() => setColorMode('amplitude')}
                    >
                      Amplitud
                    </button>
                    <button 
                      className={`industrial-button ${colorMode === 'frequency' ? 'industrial-button-active' : ''}`}
                      onClick={() => setColorMode('frequency')}
                    >
                      Frecuencia
                    </button>
                  </div>
                </div>
                
              </div>
            </div>
          )}
          
          {/* Advanced Controls Module */}
          {controlPanel === 'advanced' && (
            <div className="industrial-module">
              <div className="industrial-module-header">
                <span className="industrial-module-title">Advanced Controls</span>
              </div>
              <div className="industrial-module-content">
                <IndustrialAdvancedControls 
                  initialN={n}
                  initialM={m}
                  colorMode={colorMode}
                  enableCustomEquations={true}
                  enablePresets={true}
                  enableMIDI={true}
                  enablePostProcessing={true}
                  enableRecording={true}
                  onPresetSave={(preset) => {
                    console.log('Preset saved:', preset);
                    // Aquí podríamos guardar el preset en localStorage o en una base de datos
                  }}
                  onPresetLoad={(preset) => {
                    console.log('Preset loaded:', preset);
                    setN(preset.n);
                    setM(preset.m);
                    setColorMode(preset.colorMode as 'spectrum' | 'amplitude' | 'frequency');
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Music Integration Module */}
          {controlPanel === 'music' && (
            <>
              <div className="industrial-module">
                <div className="industrial-module-header">
                  {/* Título del módulo */}
                  <span className="industrial-module-title">Music Integration</span>

                  {/* Toggle Audio-Responsive + indicadores */}
                  <div className="industrial-flex industrial-items-center industrial-gap-sm">
                    {/* LED de beat (solo informativo) */}
                    {beatDetected && (
                      <span className="industrial-led industrial-led-on industrial-pulse"></span>
                    )}

                    {/* Toggle global de modo audio-responsivo */}
                    <span className="industrial-label">AUTO:</span>
                    <button
                      className={`industrial-button ${
                        audioResponsive ? 'industrial-button-primary' : ''
                      }`}
                      onClick={toggleAudioResponsive}
                    >
                      {audioResponsive ? 'ON' : 'OFF'}
                    </button>

                    {/* LED de estado ON/OFF */}
                    <span
                      className={`industrial-led ${
                        audioResponsive ? 'industrial-led-on' : ''
                      }`}
                    ></span>
                  </div>
                </div>
                <div className="industrial-module-content">
                  <IndustrialMusicIntegration 
                    onAudioDataUpdate={handleAudioDataUpdate}
                    audioResponsive={audioResponsive}
                    onToggleAudioResponsive={toggleAudioResponsive}
                    showWaveform={true}
                  />
                </div>
              </div>
              
              {audioData && (
                <div className="industrial-module industrial-mt-md">
                  <div className="industrial-module-header">
                    <span className="industrial-module-title">Audio Data</span>
                  </div>
                  <div className="industrial-module-content">
                    <div className="industrial-status-item">
                      <span className="industrial-status-label">FREQ:</span>
                      <span className="industrial-status-value">{audioData.dominantFrequency.toFixed(1)} Hz</span>
                    </div>
                    
                    <div className="industrial-meter-container industrial-mt-sm">
                      <div 
                        className="industrial-meter-bar" 
                        style={{ width: `${audioData.averageAmplitude * 100}%` }}
                      ></div>
                      <div className="industrial-meter-ticks">
                        <div className="industrial-meter-tick"></div>
                        <div className="industrial-meter-tick"></div>
                        <div className="industrial-meter-tick"></div>
                        <div className="industrial-meter-tick"></div>
                        <div className="industrial-meter-tick"></div>
                      </div>
                    </div>
                    
                    <div className="industrial-flex industrial-justify-between industrial-mt-md">
                      <div>
                        <div className="industrial-status-label">BASS</div>
                        <div className="industrial-meter-container" style={{ width: '60px', height: '80px' }}>
                          <div 
                            className="industrial-meter-bar" 
                            style={{ 
                              width: '100%', 
                              height: `${audioData.bassLevel * 100}%`,
                              position: 'absolute',
                              bottom: 0
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="industrial-status-label">MID</div>
                        <div className="industrial-meter-container" style={{ width: '60px', height: '80px' }}>
                          <div 
                            className="industrial-meter-bar" 
                            style={{ 
                              width: '100%', 
                              height: `${audioData.midLevel * 100}%`,
                              position: 'absolute',
                              bottom: 0
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="industrial-status-label">TREBLE</div>
                        <div className="industrial-meter-container" style={{ width: '60px', height: '80px' }}>
                          <div 
                            className="industrial-meter-bar" 
                            style={{ 
                              width: '100%', 
                              height: `${audioData.trebleLevel * 100}%`,
                              position: 'absolute',
                              bottom: 0
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      {/* ================= FOOTER / STATUS BAR ================= */}
      <footer className="industrial-footer">
        <div className="industrial-status-bar">
          <span className="industrial-status-item">
            <span className="industrial-status-label">FPS:</span>
            <span className="industrial-status-value">{fps}</span>
          </span>
          <span className="industrial-status-item">
            <span className="industrial-status-label">AUDIO:</span>
            <span className={`industrial-status-value ${audioResponsive ? 'industrial-status-success' : ''}`}>
              {audioResponsive ? 'ON' : 'OFF'}
            </span>
          </span>
          <span className="industrial-status-item">
            <span className="industrial-status-label">MODE:</span>
            <span className="industrial-status-value">{renderMode.toUpperCase()}</span>
          </span>
          <span className="industrial-status-item">
            <span className="industrial-status-label">N:</span>
            <span className="industrial-status-value">{n}</span>
          </span>
          <span className="industrial-status-item">
            <span className="industrial-status-label">M:</span>
            <span className="industrial-status-value">{m}</span>
          </span>
        </div>
        <span>Ernst Chladni · 1756-1827</span>
      </footer>
    </div>
  );
};

export default ExampleIndustrial;
