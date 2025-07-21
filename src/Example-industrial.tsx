import React, { useState, useEffect } from 'react';
import './styles-industrial.css';
import ChladniSynthesizerOptimized from './components/ChladniSynthesizerOptimized';
import IndustrialMusicIntegration from './components/IndustrialMusicIntegration';
import IndustrialCard from './components/ui/IndustrialCard';
import IndustrialButtonGroup from './components/ui/IndustrialButtonGroup';
import CustomVerticalFader from './components/CustomVerticalFader';
import IndustrialVerticalFader from './components/ui/IndustrialVerticalFader';
import IndustrialHorizontalFader from './components/ui/IndustrialHorizontalFader';
// Piano virtual (opcional - se puede comentar para deshabilitar)
import IndustrialPiano from './components/piano/IndustrialPiano';
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

// Interface FrequencyBand eliminada - no se usa

// Componente de ejemplo industrial para mostrar el Sintetizador Visual Chladni
const ExampleIndustrial: React.FC = () => {
  // Estado para controlar qué panel de controles mostrar
  const [controlPanel, setControlPanel] = useState<'basic' | 'advanced' | 'music'>('basic');
  // Estado para controlar parámetros del sintetizador
  const [n, setN] = useState<number>(5);
  const [m, setM] = useState<number>(3);
  const [colorMode, setColorMode] = useState<'spectrum' | 'amplitude' | 'frequency'>('spectrum');
  const [sensitivity, setSensitivity] = useState<number>(50);
  // Estados para controles adicionales de partículas
  const [particleDensity, setParticleDensity] = useState<'low' | 'medium' | 'high' | 'ultra'>('medium');
  const [particleSize, setParticleSize] = useState<number>(2);
  const [particleOpacity, setParticleOpacity] = useState<number>(0.8);
  const [autoShuffle, setAutoShuffle] = useState<boolean>(false);
  const [canvasShape, setCanvasShape] = useState<'square' | 'circle'>('square');

  // Estados para controles hardcodeados (ahora ajustables)
  const [particleSpeed, setParticleSpeed] = useState<number>(0.035);
  const [vibrationIntensity, setVibrationIntensity] = useState<number>(0.003);
  const [randomnessFactor, setRandomnessFactor] = useState<number>(0.7);
  const [beatPulseIntensity, setBeatPulseIntensity] = useState<number>(1.5);

  // Estados para efectos visuales avanzados
  const [particleShape, setParticleShape] = useState<'square' | 'circle' | 'triangle' | 'star'>('square');
  const [blendMode, setBlendMode] = useState<'normal' | 'additive' | 'multiply'>('normal');
  const [trailEffect, setTrailEffect] = useState<number>(0.0);

  // Estado para datos de audio
  const [audioData, setAudioData] = useState<AudioAnalysisData | null>(null);
  const [audioResponsive, setAudioResponsive] = useState<boolean>(false);
  const [beatDetected, setBeatDetected] = useState<boolean>(false);

  // Estados para control de audio expandido eliminados - usar pestaña Musical
  // Estado para FPS (para la status bar)
  const [fps, setFps] = useState<number>(60);
  
  // Funciones de audio eliminadas - usar pestaña Musical

  // Funciones eliminadas: getParticleDensityInfo, isHighPerformanceDevice - no se usan
  
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

  // Adaptador para datos del piano
  const handlePianoAudioDataUpdate = (pianoData: any) => {
    // Solo procesar datos si hay notas activas
    const isReallyPlaying = pianoData.isPlaying && pianoData.activeNotes && pianoData.activeNotes.length > 0;
    const amplitude = isReallyPlaying ? pianoData.amplitude : 0;
    const frequency = isReallyPlaying ? pianoData.frequency : 0;

    // Crear datos de frecuencia simulados solo si hay audio activo
    const frequencyData = new Uint8Array(1024);
    const timeDomainData = new Uint8Array(1024);

    if (isReallyPlaying && amplitude > 0) {
      // Simular datos de frecuencia basados en la nota activa
      const normalizedAmplitude = Math.min(amplitude * 255, 255);
      const frequencyBin = Math.floor((frequency / 22050) * 512); // Mapear frecuencia a bin

      // Llenar algunos bins alrededor de la frecuencia principal
      for (let i = Math.max(0, frequencyBin - 5); i <= Math.min(1023, frequencyBin + 5); i++) {
        const distance = Math.abs(i - frequencyBin);
        frequencyData[i] = Math.max(0, normalizedAmplitude - (distance * 20));
      }

      // Simular datos de dominio temporal
      for (let i = 0; i < timeDomainData.length; i++) {
        timeDomainData[i] = 128 + Math.sin(i * frequency * 0.001) * amplitude * 127;
      }
    }

    // Convertir datos del piano al formato AudioAnalysisData
    const adaptedData: AudioAnalysisData = {
      frequencyData,
      timeDomainData,
      dominantFrequency: frequency,
      averageAmplitude: amplitude,
      bassLevel: amplitude * (frequency < 250 ? 0.8 : 0.1),
      midLevel: amplitude * (frequency >= 250 && frequency <= 2000 ? 0.8 : 0.2),
      trebleLevel: amplitude * (frequency > 2000 ? 0.8 : 0.1),
      isBeat: isReallyPlaying
    };

    // Debug logging
    if (isReallyPlaying) {
      console.log('🎹 Piano activo:', {
        frequency: frequency.toFixed(1),
        amplitude: amplitude.toFixed(3),
        activeNotes: pianoData.activeNotes
      });
    }

    // Solo actualizar si hay cambios significativos o si se detiene el audio
    if (isReallyPlaying || amplitude === 0) {
      handleAudioDataUpdate(adaptedData);
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
      </header>
      
      {/* ================= MAIN (70/30 columns) ================= */}
      <main className="industrial-main">
        {/* ------- Visualization Area (70%) ------- */}
        <div className="industrial-visualization">
          <ChladniSynthesizerOptimized
            initialN={n}
            initialM={m}
            colorMode={colorMode}
            sensitivity={sensitivity}
            showControls={false}
            useWebGL={true}
            particleDensity={particleDensity}
            particleSize={particleSize}
            particleOpacity={particleOpacity}
            autoShuffle={autoShuffle}
            canvasShape={canvasShape}
            beatDetected={beatDetected}
            particleSpeed={particleSpeed}
            vibrationIntensity={vibrationIntensity}
            randomnessFactor={randomnessFactor}
            audioData={audioData}
            beatPulseIntensity={beatPulseIntensity}
            particleShape={particleShape}
            blendMode={blendMode}
            trailEffect={trailEffect}
          />
        </div>

        {/* ------- Controls Column (30%) ------- */}
        <div className="industrial-controls industrial-sidebar">
          {/* Control Panel Tabs */}
          <div className="industrial-sidebar-tabs">
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

          {/* Basic Controls Module */}
          {controlPanel === 'basic' && (
            <>
              <IndustrialCard
                title="Parámetros Chladni"
                headerActions={audioResponsive ? <span className="industrial-led industrial-led-on"></span> : null}
              >
                {/* Core Chladni Parameters */}
                <div className="industrial-flex industrial-gap-lg industrial-justify-center">
                  <IndustrialVerticalFader
                    label="PARAM N"
                    min={1}
                    max={20}
                    value={n}
                    onChange={setN}
                    formatValue={(v) => v.toString().padStart(2, '0')}
                    defaultValue={3}
                    height={100}
                  />

                  <IndustrialVerticalFader
                    label="PARAM M"
                    min={1}
                    max={20}
                    value={m}
                    onChange={setM}
                    formatValue={(v) => v.toString().padStart(2, '0')}
                    defaultValue={4}
                    height={100}
                  />
                </div>
            </IndustrialCard>

            <IndustrialCard title="Modo de Color">
              <IndustrialButtonGroup
                options={[
                  { value: 'spectrum', label: 'Espectro' },
                  { value: 'amplitude', label: 'Amplitud' },
                  { value: 'frequency', label: 'Frecuencia' }
                ]}
                value={colorMode}
                onChange={(value) => setColorMode(value as 'spectrum' | 'amplitude' | 'frequency')}
              />
            </IndustrialCard>

            <IndustrialCard title="Densidad de Partículas">
              <IndustrialButtonGroup
                options={[
                  { value: 'low', label: 'Baja (5K)' },
                  { value: 'medium', label: 'Media (10K)' },
                  { value: 'high', label: 'Alta (20K)' },
                  { value: 'ultra', label: 'Ultra (50K)' }
                ]}
                value={particleDensity}
                onChange={(value) => {
                  console.log('🔘 Cambiando densidad a:', value);
                  setParticleDensity(value as 'low' | 'medium' | 'high' | 'ultra');
                }}
              />
            </IndustrialCard>

            <IndustrialCard title="Forma del Canvas">
              <IndustrialButtonGroup
                options={[
                  { value: 'square', label: 'Cuadrado', icon: '⬜' },
                  { value: 'circle', label: 'Círculo', icon: '🔵' }
                ]}
                value={canvasShape}
                onChange={(value) => setCanvasShape(value as 'square' | 'circle')}
              />
            </IndustrialCard>
            </>
          )}
          
          {/* Advanced Controls Module */}
          {controlPanel === 'advanced' && (
            <>
              <IndustrialCard title="Apariencia">
                <div className="industrial-flex industrial-gap-lg industrial-justify-center">
                    <IndustrialVerticalFader
                      label="TAMAÑO"
                      min={1}
                      max={10}
                      value={particleSize}
                      onChange={setParticleSize}
                      formatValue={(v) => `${v}px`}
                      defaultValue={3}
                      height={100}
                    />

                    <IndustrialVerticalFader
                      label="OPACIDAD"
                      min={0.1}
                      max={1.0}
                      value={particleOpacity}
                      onChange={setParticleOpacity}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      defaultValue={0.8}
                      height={100}
                    />
                </div>
              </IndustrialCard>

              <IndustrialCard title="Física y Movimiento">
                <div className="industrial-fader-row">
                    <IndustrialVerticalFader
                      label="VELOCIDAD"
                      value={particleSpeed}
                      min={0.005}
                      max={0.1}
                      onChange={setParticleSpeed}
                      unit=""
                      precision={3}
                      defaultValue={0.02}
                      height={100}
                    />
                    <IndustrialVerticalFader
                      label="VIBRACIÓN"
                      value={vibrationIntensity}
                      min={0.0005}
                      max={0.01}
                      onChange={setVibrationIntensity}
                      unit=""
                      precision={4}
                      defaultValue={0.002}
                      height={100}
                    />
                    <IndustrialVerticalFader
                      label="ALEATORIEDAD"
                      value={randomnessFactor}
                      min={0.1}
                      max={2.0}
                      onChange={setRandomnessFactor}
                      unit=""
                      precision={1}
                      defaultValue={1.0}
                      height={100}
                    />
                    <IndustrialVerticalFader
                      label="PULSO BEAT"
                      value={beatPulseIntensity}
                      min={1.0}
                      max={5.0}
                      onChange={setBeatPulseIntensity}
                      unit="x"
                      precision={1}
                      defaultValue={2.0}
                      height={100}
                    />
                    <IndustrialVerticalFader
                      label="ESTELA"
                      min={0.0}
                      max={1.0}
                      value={trailEffect}
                      onChange={setTrailEffect}
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      precision={2}
                      defaultValue={0.1}
                      height={100}
                    />
                </div>
              </IndustrialCard>

              <IndustrialCard title="Automatización">
                <div className="industrial-flex industrial-items-center industrial-gap-sm">
                    <span className="industrial-label">AUTO SHUFFLE:</span>
                    <button
                      className={`industrial-button ${autoShuffle ? 'industrial-button-active' : ''}`}
                      onClick={() => setAutoShuffle(!autoShuffle)}
                    >
                      {autoShuffle ? 'ON' : 'OFF'}
                    </button>
                </div>
              </IndustrialCard>

              <IndustrialCard title="Efectos Visuales">
                {/* Particle Shape */}
                <div className="industrial-mb-md">
                  <div className="industrial-flex industrial-items-center industrial-gap-sm industrial-mb-sm">
                    <span className="industrial-label">FORMA:</span>
                  </div>
                  <IndustrialButtonGroup
                    options={[
                      { value: 'square', label: 'Cuadrado', icon: '⬜' },
                      { value: 'circle', label: 'Círculo', icon: '🔵' },
                      { value: 'triangle', label: 'Triángulo', icon: '🔺' },
                      { value: 'star', label: 'Estrella', icon: '⭐' }
                    ]}
                    value={particleShape}
                    onChange={(value) => setParticleShape(value as 'square' | 'circle' | 'triangle' | 'star')}
                  />
                </div>

                {/* Blend Mode */}
                <div>
                  <div className="industrial-flex industrial-items-center industrial-gap-sm industrial-mb-sm">
                    <span className="industrial-label">MEZCLA:</span>
                  </div>
                  <IndustrialButtonGroup
                    options={[
                      { value: 'normal', label: 'Normal' },
                      { value: 'additive', label: 'Aditivo', icon: '✨' },
                      { value: 'multiply', label: 'Multiplicar', icon: '🌑' }
                    ]}
                    value={blendMode}
                    onChange={(value) => setBlendMode(value as 'normal' | 'additive' | 'multiply')}
                  />
                </div>
              </IndustrialCard>

              {/* Beat Detection Indicator */}
              {beatDetected && (
                <IndustrialCard title="Estado">
                  <div className="industrial-flex industrial-items-center industrial-gap-sm">
                    <span className="industrial-led industrial-led-on industrial-pulse"></span>
                    <span className="industrial-label">BEAT DETECTADO</span>
                  </div>
                </IndustrialCard>
              )}
            </>
          )}
          
          {/* Music Integration Module */}
          {controlPanel === 'music' && (
            <>
              <IndustrialCard
                title="Respuesta Global"
                headerActions={
                  <div className="industrial-flex industrial-items-center industrial-gap-sm">
                    {beatDetected && (
                      <span className="industrial-led industrial-led-on industrial-pulse"></span>
                    )}
                    <span className="industrial-label">AUTO:</span>
                    <button
                      className={`industrial-button ${audioResponsive ? 'industrial-button-primary' : ''}`}
                      onClick={toggleAudioResponsive}
                    >
                      {audioResponsive ? 'ON' : 'OFF'}
                    </button>
                    <span className={`industrial-led ${audioResponsive ? 'industrial-led-on' : ''}`}></span>
                  </div>
                }
              >
                <div className="industrial-flex industrial-justify-center">
                  <IndustrialVerticalFader
                    label="SENSITIVITY"
                    min={1}
                    max={100}
                    value={sensitivity}
                    onChange={setSensitivity}
                    formatValue={(v) => `${v}%`}
                    defaultValue={50}
                    height={100}
                  />
                </div>
              </IndustrialCard>

              <IndustrialMusicIntegration
                onAudioDataUpdate={handleAudioDataUpdate}
                audioResponsive={audioResponsive}
                onToggleAudioResponsive={toggleAudioResponsive}
                showWaveform={true}
              />
              
              {audioData && (
                <IndustrialCard title="Datos de Audio">
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
                </IndustrialCard>
              )}
            </>
          )}
        </div>
      </main>

      {/* ================= PIANO VIRTUAL (OPCIONAL) ================= */}
      <IndustrialPiano
        onAudioDataUpdate={handlePianoAudioDataUpdate}
        disabled={false}
        startOctave={3}
        endOctave={5}
      />

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
            <span className="industrial-status-value">OPTIMIZED</span>
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
