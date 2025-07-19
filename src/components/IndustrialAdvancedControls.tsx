import React, { useState, useEffect, useRef } from 'react';
import CustomVerticalFader from './CustomVerticalFader';

// Interfaces para tipos
interface Preset {
  id: string;
  name: string;
  n: number;
  m: number;
  frequency: number;
  damping: number;
  colorMode: 'spectrum' | 'amplitude' | 'frequency';
  equation: string;
  isCustom: boolean;
}

interface IndustrialAdvancedControlsProps {
  initialN: number;
  initialM: number;
  colorMode: 'spectrum' | 'amplitude' | 'frequency';
  enableCustomEquations?: boolean;
  enablePresets?: boolean;
  enableMIDI?: boolean;
  enablePostProcessing?: boolean;
  enableRecording?: boolean;
  onPresetSave?: (preset: Preset) => void;
  onPresetLoad?: (preset: Preset) => void;
  onParameterChange?: (param: string, value: number) => void;
  onEquationChange?: (equation: string, isCustom: boolean) => void;
}

const IndustrialAdvancedControls: React.FC<IndustrialAdvancedControlsProps> = ({
  initialN = 5,
  initialM = 3,
  colorMode = 'spectrum',
  enableCustomEquations = true,
  enablePresets = true,
  enableMIDI = true,
  enablePostProcessing = true,
  enableRecording = true,
  onPresetSave,
  onPresetLoad,
  onParameterChange,
  onEquationChange
}) => {
  // Estados para parámetros
  const [n, setN] = useState<number>(initialN);
  const [m, setM] = useState<number>(initialM);
  const [frequency, setFrequency] = useState<number>(440);
  const [damping, setDamping] = useState<number>(0.15);
  
  // Estado para ecuación
  const [isCustomEquation, setIsCustomEquation] = useState<boolean>(false);
  const [equation, setEquation] = useState<string>('sin(n*π*x)*sin(m*π*y)');
  const [customEquation, setCustomEquation] = useState<string>('sin(n*π*x)*sin(m*π*y)');
  
  // Estado para presets
  const [presets, setPresets] = useState<Preset[]>([
    { 
      id: 'default_01', 
      name: 'Default', 
      n: 5, 
      m: 3, 
      frequency: 440, 
      damping: 0.15, 
      colorMode: 'spectrum', 
      equation: 'sin(n*π*x)*sin(m*π*y)',
      isCustom: false
    },
    { 
      id: 'circular_01', 
      name: 'Circular', 
      n: 7, 
      m: 7, 
      frequency: 440, 
      damping: 0.2, 
      colorMode: 'amplitude', 
      equation: 'sin(sqrt(x*x+y*y)*n*π)',
      isCustom: true
    },
    { 
      id: 'spiral_01', 
      name: 'Spiral', 
      n: 3, 
      m: 8, 
      frequency: 520, 
      damping: 0.1, 
      colorMode: 'frequency', 
      equation: 'sin(n*π*x)*cos(m*π*y) + cos(n*π*x)*sin(m*π*y)',
      isCustom: true
    }
  ]);
  const [currentPresetId, setCurrentPresetId] = useState<string>('default_01');
  
  // Estados para MIDI y grabación
  const [midiEnabled, setMidiEnabled] = useState<boolean>(false);
  const [midiChannel, setMidiChannel] = useState<number>(1);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedFrames, setRecordedFrames] = useState<number>(0);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Efectos para notificar cambios
  useEffect(() => {
    if (onParameterChange) {
      onParameterChange('n', n);
    }
  }, [n, onParameterChange]);
  
  useEffect(() => {
    if (onParameterChange) {
      onParameterChange('m', m);
    }
  }, [m, onParameterChange]);
  
  useEffect(() => {
    if (onParameterChange) {
      onParameterChange('frequency', frequency);
    }
  }, [frequency, onParameterChange]);
  
  useEffect(() => {
    if (onParameterChange) {
      onParameterChange('damping', damping);
    }
  }, [damping, onParameterChange]);
  
  useEffect(() => {
    const currentEquation = isCustomEquation ? customEquation : equation;
    if (onEquationChange) {
      onEquationChange(currentEquation, isCustomEquation);
    }
  }, [isCustomEquation, equation, customEquation, onEquationChange]);
  
  // Manejadores
  const handleEquationTypeChange = (isCustom: boolean) => {
    setIsCustomEquation(isCustom);
  };
  
  const handleRandomize = () => {
    const newN = Math.floor(Math.random() * 15) + 1;
    const newM = Math.floor(Math.random() * 15) + 1;
    setN(newN);
    setM(newM);
    setFrequency(Math.floor(Math.random() * 500) + 200);
    setDamping(Math.random() * 0.3 + 0.05);
  };
  
  const handleReset = () => {
    setN(initialN);
    setM(initialM);
    setFrequency(440);
    setDamping(0.15);
    setIsCustomEquation(false);
    setEquation('sin(n*π*x)*sin(m*π*y)');
    setCustomEquation('sin(n*π*x)*sin(m*π*y)');
  };
  
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    setCurrentPresetId(presetId);
    const preset = presets.find(p => p.id === presetId);
    
    if (preset && onPresetLoad) {
      onPresetLoad(preset);
      
      // Actualizar estados locales
      setN(preset.n);
      setM(preset.m);
      setFrequency(preset.frequency);
      setDamping(preset.damping);
      setIsCustomEquation(preset.isCustom);
      if (preset.isCustom) {
        setCustomEquation(preset.equation);
      } else {
        setEquation(preset.equation);
      }
    }
  };
  
  const handleSavePreset = () => {
    const presetName = prompt('Enter preset name:');
    if (!presetName) return;
    
    const newPreset: Preset = {
      id: `preset_${Date.now()}`,
      name: presetName,
      n,
      m,
      frequency,
      damping,
      colorMode,
      equation: isCustomEquation ? customEquation : equation,
      isCustom: isCustomEquation
    };
    
    setPresets([...presets, newPreset]);
    setCurrentPresetId(newPreset.id);
    
    if (onPresetSave) {
      onPresetSave(newPreset);
    }
  };
  
  const handleDeletePreset = () => {
    if (currentPresetId === 'default_01' || currentPresetId === 'circular_01' || currentPresetId === 'spiral_01') {
      alert('Cannot delete default presets');
      return;
    }
    
    const newPresets = presets.filter(p => p.id !== currentPresetId);
    setPresets(newPresets);
    setCurrentPresetId('default_01');
    
    // Cargar el preset por defecto
    const defaultPreset = presets.find(p => p.id === 'default_01');
    if (defaultPreset && onPresetLoad) {
      onPresetLoad(defaultPreset);
    }
  };
  
  const toggleMidi = () => {
    setMidiEnabled(!midiEnabled);
  };
  
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  const startRecording = () => {
    setIsRecording(true);
    setRecordedFrames(0);
    
    recordingInterval.current = setInterval(() => {
      setRecordedFrames(prev => prev + 1);
    }, 100);
  };
  
  const stopRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
  };
  
  const handleExport = () => {
    alert(`Export functionality would save ${recordedFrames} frames`);
    setRecordedFrames(0);
  };
  
  return (
    <div className="industrial-advanced-controls">
      {/* ====== ADVANCED PARAMETERS MODULE ====== */}
      <div className="industrial-module">
        <div className="industrial-module-header">
          <span className="industrial-module-title">Advanced Parameters</span>
        </div>
        <div className="industrial-module-content">
          <div className="industrial-flex industrial-gap-lg industrial-justify-between">
            {/* Parameter N */}
            <CustomVerticalFader
              label="PARAM N"
              min={1}
              max={20}
              value={n}
              onChange={setN}
              formatValue={(v) => v.toString().padStart(2, '0')}
            />
            
            {/* Parameter M */}
            <CustomVerticalFader
              label="PARAM M"
              min={1}
              max={20}
              value={m}
              onChange={setM}
              formatValue={(v) => v.toString().padStart(2, '0')}
            />
            
            {/* Frequency */}
            <CustomVerticalFader
              label="FREQ"
              min={200}
              max={1000}
              value={frequency}
              onChange={setFrequency}
              formatValue={(v) => `${v}Hz`}
            />
            
            {/* Damping */}
            <CustomVerticalFader
              label="DAMP"
              min={0.01}
              max={0.5}
              value={damping}
              onChange={setDamping}
              formatValue={(v) => v.toFixed(2)}
            />
          </div>
        </div>
      </div>
      
      {/* ====== EQUATION CONTROL MODULE ====== */}
      {enableCustomEquations && (
        <div className="industrial-module industrial-mt-md">
          <div className="industrial-module-header">
            <span className="industrial-module-title">Equation Control</span>
          </div>
          <div className="industrial-module-content">
            {/* Equation Type Selection */}
            <div className="industrial-radio-group">
              <label className="industrial-radio-label">
                <input
                  type="radio"
                  className="industrial-radio"
                  checked={!isCustomEquation}
                  onChange={() => handleEquationTypeChange(false)}
                />
                <span className="industrial-radio-text">STANDARD</span>
              </label>
              
              <label className="industrial-radio-label">
                <input
                  type="radio"
                  className="industrial-radio"
                  checked={isCustomEquation}
                  onChange={() => handleEquationTypeChange(true)}
                />
                <span className="industrial-radio-text">CUSTOM</span>
              </label>
            </div>
            
            {/* Equation Display */}
            <div className="industrial-equation-display">
              {isCustomEquation ? (
                <input
                  type="text"
                  className="industrial-input"
                  value={customEquation}
                  onChange={(e) => setCustomEquation(e.target.value)}
                  placeholder="Enter custom equation..."
                />
              ) : (
                <div className="industrial-equation-text">
                  {equation}
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="industrial-button-group industrial-mt-sm">
              <button
                className="industrial-button"
                onClick={handleRandomize}
              >
                <span className="industrial-icon industrial-icon-random"></span>
                Randomize
              </button>
              
              <button
                className="industrial-button"
                onClick={handleReset}
              >
                <span className="industrial-icon industrial-icon-reset"></span>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ====== PRESET MANAGEMENT MODULE ====== */}
      {enablePresets && (
        <div className="industrial-module industrial-mt-md">
          <div className="industrial-module-header">
            <span className="industrial-module-title">Preset Management</span>
          </div>
          <div className="industrial-module-content">
            {/* Preset Selector */}
            <div className="industrial-flex industrial-items-center industrial-gap-sm">
              <span className="industrial-label">CURRENT:</span>
              <select
                className="industrial-select"
                value={currentPresetId}
                onChange={handlePresetChange}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Preset Actions */}
            <div className="industrial-button-group industrial-mt-sm">
              <button
                className="industrial-button"
                onClick={handleSavePreset}
              >
                <span className="industrial-icon industrial-icon-save"></span>
                Save
              </button>
              
              <button
                className="industrial-button"
                onClick={handlePresetChange}
              >
                <span className="industrial-icon industrial-icon-load"></span>
                Load
              </button>
              
              <button
                className="industrial-button"
                onClick={handleDeletePreset}
              >
                <span className="industrial-icon industrial-icon-delete"></span>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ====== MIDI & RECORDING MODULE ====== */}
      {(enableMIDI || enableRecording) && (
        <div className="industrial-module industrial-mt-md">
          <div className="industrial-module-header">
            <span className="industrial-module-title">MIDI & Recording</span>
          </div>
          <div className="industrial-module-content">
            {/* MIDI Controls */}
            {enableMIDI && (
              <div className="industrial-flex industrial-items-center industrial-gap-md industrial-mb-md">
                <div className="industrial-flex industrial-items-center industrial-gap-sm">
                  <span className="industrial-label">MIDI IN:</span>
                  <span 
                    className={`industrial-led ${midiEnabled ? 'industrial-led-on' : ''}`}
                    onClick={toggleMidi}
                  ></span>
                </div>
                
                <div className="industrial-flex industrial-items-center industrial-gap-sm">
                  <span className="industrial-label">CH:</span>
                  <input
                    type="number"
                    className="industrial-input industrial-input-small"
                    value={midiChannel}
                    onChange={(e) => setMidiChannel(parseInt(e.target.value) || 1)}
                    min={1}
                    max={16}
                    disabled={!midiEnabled}
                  />
                </div>
              </div>
            )}
            
            {/* Recording Controls */}
            {enableRecording && (
              <div className="industrial-flex industrial-items-center industrial-gap-sm">
                <span className="industrial-label">REC:</span>
                <span 
                  className={`industrial-led ${isRecording ? 'industrial-led-error industrial-pulse' : ''}`}
                ></span>
                
                <button
                  className="industrial-button"
                  onClick={toggleRecording}
                  disabled={false}
                >
                  {isRecording ? (
                    <span className="industrial-icon industrial-icon-stop"></span>
                  ) : (
                    <span className="industrial-icon industrial-icon-record"></span>
                  )}
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                
                {recordedFrames > 0 && (
                  <span className="industrial-label">{recordedFrames} frames</span>
                )}
                
                <button
                  className="industrial-button"
                  onClick={handleExport}
                  disabled={recordedFrames === 0}
                >
                  <span className="industrial-icon industrial-icon-export"></span>
                  Export
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IndustrialAdvancedControls;
