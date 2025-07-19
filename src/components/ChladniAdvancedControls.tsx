import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChladniSynthesizer, { ChladniSynthesizerProps } from './ChladniSynthesizer';


// Extended props with advanced features
interface AdvancedChladniProps extends ChladniSynthesizerProps {
  enableCustomEquations?: boolean;
  enablePresets?: boolean;
  enableMIDI?: boolean;
  enablePostProcessing?: boolean;
  enableRecording?: boolean;
  onPresetSave?: (preset: ChladniPreset) => void;
  onPresetLoad?: (preset: ChladniPreset) => void;
  initialPresets?: ChladniPreset[];
}

// Types for advanced features
interface ChladniPreset {
  id: string;
  name: string;
  equation: string | null;
  equationType: 'standard' | 'custom';
  n: number;
  m: number;
  colorMode: string;
  particleSize: number;
  particleOpacity: number;
  sensitivity: number;
  postProcessing: PostProcessingSettings;
  midiMappings: MIDIMapping[];
  createdAt: number;
}

interface PostProcessingSettings {
  enabled: boolean;
  blur: number;
  glow: number;
  contrast: number;
  brightness: number;
  saturation: number;
  hueRotate: number;
  invert: boolean;
}

interface MIDIMapping {
  controlId: number;
  paramName: string;
  min: number;
  max: number;
}

interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
  type: 'input' | 'output';
}

interface RecordingSettings {
  format: 'gif' | 'webm' | 'mp4' | 'png';
  quality: number;
  framerate: number;
  duration: number;
}

// Main component
const ChladniAdvancedControls: React.FC<AdvancedChladniProps> = ({
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
  initialPresets = [],
}) => {
  // State for UI tabs
  const [activeTab, setActiveTab] = useState<string>('equation');
  
  // Base Chladni parameters
  const [nParam, setNParam] = useState<number>(initialN);
  const [mParam, setMParam] = useState<number>(initialM);
  const [sensitivity, setSensitivity] = useState<number>(50);
  const [selectedColorMode, setSelectedColorMode] = useState<string>(colorMode);
  const [particleSize, setParticleSize] = useState<number>(1);
  const [particleOpacity, setParticleOpacity] = useState<number>(0.8);
  const [autoShuffle, setAutoShuffle] = useState<boolean>(false);
  
  // Custom equation state
  const [equationType, setEquationType] = useState<'standard' | 'custom'>('standard');
  const [customEquation, setCustomEquation] = useState<string>('');
  const [equationError, setEquationError] = useState<string | null>(null);
  const [equationPreview, setEquationPreview] = useState<string>('');
  
  // Presets state
  const [presets, setPresets] = useState<ChladniPreset[]>(initialPresets);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string>('');
  
  // MIDI state
  const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
  const [midiDevices, setMidiDevices] = useState<MIDIDevice[]>([]);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState<string | null>(null);
  const [midiMappings, setMidiMappings] = useState<MIDIMapping[]>([]);
  const [midiLearning, setMidiLearning] = useState<string | null>(null);
  const [lastMidiMessage, setLastMidiMessage] = useState<{ controller: number, value: number } | null>(null);
  
  // Post-processing state
  const [postProcessing, setPostProcessing] = useState<PostProcessingSettings>({
    enabled: false,
    blur: 0,
    glow: 0,
    contrast: 100,
    brightness: 100,
    saturation: 100,
    hueRotate: 0,
    invert: false
  });
  
  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>({
    format: 'webm',
    quality: 0.8,
    framerate: 30,
    duration: 5
  });
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Standard Chladni equation (for reference)
  const standardChladniEquation = 'cos(n*π*x/L)*cos(m*π*y/L) - cos(m*π*x/L)*cos(n*π*y/L)';
  
  // Initialize MIDI if enabled
  useEffect(() => {
    if (!enableMIDI) return;
    
    const initMIDI = async () => {
      try {
        if (navigator.requestMIDIAccess) {
          const access = await navigator.requestMIDIAccess();
          setMidiAccess(access);
          
          // List available MIDI devices
          const devices: MIDIDevice[] = [];
          access.inputs.forEach(input => {
            devices.push({
              id: input.id,
              name: input.name || 'Unknown Device',
              manufacturer: input.manufacturer || 'Unknown Manufacturer',
              state: input.state,
              connection: input.connection,
              type: 'input'
            });
          });
          
          setMidiDevices(devices);
          
          // Setup MIDI message handlers
          access.inputs.forEach(input => {
            input.onmidimessage = handleMIDIMessage;
          });
          
          // Listen for device connection/disconnection
          access.onstatechange = handleMIDIStateChange;
        } else {
          console.log('Web MIDI API not supported in this browser');
        }
      } catch (error) {
        console.error('Error accessing MIDI devices:', error);
      }
    };
    
    initMIDI();
    
    return () => {
      // Clean up MIDI listeners
      if (midiAccess) {
        midiAccess.inputs.forEach(input => {
          input.onmidimessage = null;
        });
        midiAccess.onstatechange = null;
      }
    };
  }, [enableMIDI]);
  
  // Handle MIDI device connections/disconnections
  const handleMIDIStateChange = (event: WebMidi.MIDIConnectionEvent) => {
    const device = event.port;
    
    if (device.type === 'input') {
      // Update device list
      setMidiDevices(prevDevices => {
        if (device.state === 'connected') {
          // Add or update device
          const existingDeviceIndex = prevDevices.findIndex(d => d.id === device.id);
          if (existingDeviceIndex >= 0) {
            const updatedDevices = [...prevDevices];
            updatedDevices[existingDeviceIndex] = {
              ...updatedDevices[existingDeviceIndex],
              state: device.state,
              connection: device.connection
            };
            return updatedDevices;
          } else {
            // Add new device
            return [
              ...prevDevices,
              {
                id: device.id,
                name: device.name || 'Unknown Device',
                manufacturer: device.manufacturer || 'Unknown Manufacturer',
                state: device.state,
                connection: device.connection,
                type: 'input'
              }
            ];
          }
        } else {
          // Remove disconnected device
          return prevDevices.filter(d => d.id !== device.id);
        }
      });
      
      // Update MIDI message handler
      if (device.state === 'connected') {
        device.onmidimessage = handleMIDIMessage;
      } else {
        device.onmidimessage = null;
      }
    }
  };
  
  // Handle incoming MIDI messages
  const handleMIDIMessage = (event: WebMidi.MIDIMessageEvent) => {
    const [status, data1, data2] = event.data;
    
    // Check if this is a Control Change message (0xB0-0xBF)
    if ((status & 0xF0) === 0xB0) {
      const controller = data1;
      const value = data2;
      
      setLastMidiMessage({ controller, value });
      
      // If we're in MIDI learning mode, create a mapping
      if (midiLearning) {
        const newMapping: MIDIMapping = {
          controlId: controller,
          paramName: midiLearning,
          min: 0,
          max: 100
        };
        
        // Remove any existing mapping for this controller
        setMidiMappings(prevMappings => {
          const filteredMappings = prevMappings.filter(m => m.controlId !== controller);
          return [...filteredMappings, newMapping];
        });
        
        // Exit learning mode
        setMidiLearning(null);
        return;
      }
      
      // Apply the mapping if one exists
      const mapping = midiMappings.find(m => m.controlId === controller);
      if (mapping) {
        // Map MIDI value (0-127) to parameter range
        const normalizedValue = value / 127;
        const mappedValue = mapping.min + normalizedValue * (mapping.max - mapping.min);
        
        // Apply the mapped value to the appropriate parameter
        applyMIDIMapping(mapping.paramName, mappedValue);
      }
    }
  };
  
  // Apply MIDI mapping to parameter
  const applyMIDIMapping = (paramName: string, value: number) => {
    switch (paramName) {
      case 'n':
        setNParam(Math.round(value));
        break;
      case 'm':
        setMParam(Math.round(value));
        break;
      case 'sensitivity':
        setSensitivity(value);
        break;
      case 'particleSize':
        setParticleSize(value);
        break;
      case 'particleOpacity':
        setParticleOpacity(value / 100);
        break;
      case 'blur':
        setPostProcessing(prev => ({ ...prev, blur: value }));
        break;
      case 'glow':
        setPostProcessing(prev => ({ ...prev, glow: value }));
        break;
      case 'contrast':
        setPostProcessing(prev => ({ ...prev, contrast: value }));
        break;
      case 'brightness':
        setPostProcessing(prev => ({ ...prev, brightness: value }));
        break;
      case 'saturation':
        setPostProcessing(prev => ({ ...prev, saturation: value }));
        break;
      case 'hueRotate':
        setPostProcessing(prev => ({ ...prev, hueRotate: value }));
        break;
    }
  };
  
  // Start MIDI learning for a parameter
  const startMIDILearning = (paramName: string) => {
    setMidiLearning(paramName);
  };
  
  // Cancel MIDI learning
  const cancelMIDILearning = () => {
    setMidiLearning(null);
  };
  
  // Select MIDI device
  const selectMIDIDevice = (deviceId: string) => {
    if (!midiAccess) return;
    
    // Deactivate previous device
    if (selectedMidiDevice) {
      const prevDevice = midiAccess.inputs.get(selectedMidiDevice);
      if (prevDevice) {
        prevDevice.onmidimessage = null;
      }
    }
    
    // Activate new device
    const newDevice = midiAccess.inputs.get(deviceId);
    if (newDevice) {
      newDevice.onmidimessage = handleMIDIMessage;
      setSelectedMidiDevice(deviceId);
    }
  };
  
  // Validate custom equation
  const validateEquation = (equation: string): boolean => {
    try {
      // Create a safe function from the equation string
      // This is a simplified validation - in a real app you'd want more robust validation
      const safeEval = new Function('x', 'y', 'n', 'm', 'L', 'Math', 
        `try {
          with(Math) {
            return ${equation};
          }
        } catch(e) {
          return NaN;
        }`
      );
      
      // Test the function with some values
      const result = safeEval(0, 0, 5, 3, 2, Math);
      return !isNaN(result);
    } catch (error) {
      setEquationError(`Error: ${error instanceof Error ? error.message : 'Invalid equation'}`);
      return false;
    }
  };
  
  // Update equation preview
  const updateEquationPreview = () => {
    if (equationType === 'standard') {
      setEquationPreview(standardChladniEquation);
    } else {
      setEquationPreview(customEquation);
    }
  };
  
  // Handle equation change
  const handleEquationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newEquation = e.target.value;
    setCustomEquation(newEquation);
    
    if (validateEquation(newEquation)) {
      setEquationError(null);
      setEquationPreview(newEquation);
    } else {
      setEquationError('Invalid equation. Check syntax.');
    }
  };
  
  // Save current settings as preset
  const savePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }
    
    const newPreset: ChladniPreset = {
      id: `preset_${Date.now()}`,
      name: presetName,
      equation: equationType === 'custom' ? customEquation : null,
      equationType,
      n: nParam,
      m: mParam,
      colorMode: selectedColorMode,
      particleSize,
      particleOpacity,
      sensitivity,
      postProcessing,
      midiMappings: [...midiMappings],
      createdAt: Date.now()
    };
    
    setPresets(prevPresets => [...prevPresets, newPreset]);
    setActivePreset(newPreset.id);
    setPresetName('');
    
    // Save to localStorage
    savePresetsToLocalStorage([...presets, newPreset]);
    
    // Call external handler if provided
    if (onPresetSave) {
      onPresetSave(newPreset);
    }
  };
  
  // Load a preset
  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    
    setNParam(preset.n);
    setMParam(preset.m);
    setSelectedColorMode(preset.colorMode);
    setParticleSize(preset.particleSize);
    setParticleOpacity(preset.particleOpacity);
    setSensitivity(preset.sensitivity);
    
    if (preset.equation && preset.equationType === 'custom') {
      setEquationType('custom');
      setCustomEquation(preset.equation);
    } else {
      setEquationType('standard');
    }
    
    setPostProcessing(preset.postProcessing);
    setMidiMappings(preset.midiMappings);
    setActivePreset(presetId);
    
    // Call external handler if provided
    if (onPresetLoad) {
      onPresetLoad(preset);
    }
  };
  
  // Delete a preset
  const deletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    setPresets(updatedPresets);
    
    if (activePreset === presetId) {
      setActivePreset(null);
    }
    
    // Save to localStorage
    savePresetsToLocalStorage(updatedPresets);
  };
  
  // Save presets to localStorage
  const savePresetsToLocalStorage = (presetsToSave: ChladniPreset[]) => {
    try {
      localStorage.setItem('chladni-presets', JSON.stringify(presetsToSave));
    } catch (error) {
      console.error('Error saving presets to localStorage:', error);
    }
  };
  
  // Load presets from localStorage
  const loadPresetsFromLocalStorage = useCallback(() => {
    try {
      const savedPresets = localStorage.getItem('chladni-presets');
      if (savedPresets) {
        setPresets(JSON.parse(savedPresets));
      }
    } catch (error) {
      console.error('Error loading presets from localStorage:', error);
    }
  }, []);
  
  // Load saved presets on component mount
  useEffect(() => {
    if (enablePresets) {
      loadPresetsFromLocalStorage();
    }
  }, [enablePresets, loadPresetsFromLocalStorage]);
  
  // Update equation preview when equation type changes
  useEffect(() => {
    updateEquationPreview();
  }, [equationType, customEquation]);
  
  // Start recording
  const startRecording = () => {
    if (!canvasRef.current || isRecording) return;
    
    try {
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(recordingSettings.framerate);
      const options = {
        mimeType: `video/${recordingSettings.format === 'webm' ? 'webm' : 'mp4'}`,
        videoBitsPerSecond: recordingSettings.quality * 5000000
      };
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: `video/${recordingSettings.format === 'webm' ? 'webm' : 'mp4'}`
        });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = `chladni-recording-${Date.now()}.${recordingSettings.format}`;
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordingProgress(0);
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Set up progress tracking
      const duration = recordingSettings.duration * 1000; // Convert to ms
      const interval = 100; // Update every 100ms
      let elapsed = 0;
      
      const progressInterval = setInterval(() => {
        elapsed += interval;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setRecordingProgress(progress);
        
        if (elapsed >= duration) {
          clearInterval(progressInterval);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, interval);
      
      // Stop recording after duration
      setTimeout(() => {
        clearInterval(progressInterval);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, duration);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  // Take screenshot
  const takeScreenshot = () => {
    if (!canvasRef.current) return;
    
    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');
      
      // Create download link
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = `chladni-screenshot-${Date.now()}.png`;
      a.click();
      
      // Clean up
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }
  };
  
  // Generate CSS filters for post-processing
  const getPostProcessingStyle = () => {
    if (!postProcessing.enabled) return {};
    
    return {
      filter: `
        blur(${postProcessing.blur}px)
        brightness(${postProcessing.brightness}%)
        contrast(${postProcessing.contrast}%)
        saturate(${postProcessing.saturation}%)
        hue-rotate(${postProcessing.hueRotate}deg)
        ${postProcessing.invert ? 'invert(100%)' : ''}
      `
    };
  };
  
  // Handle canvas reference
  const handleCanvasRef = (el: HTMLElement | null) => {
    if (el) {
      const canvasElement = el.querySelector('canvas');
      if (canvasElement) {
        canvasRef.current = canvasElement;
      }
    }
  };
  
  return (
    <div className="chladni-advanced-controls">
      {/* Tabs navigation */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'equation' ? 'active' : ''}`}
          onClick={() => setActiveTab('equation')}
        >
          Ecuación
        </button>
        {enablePresets && (
          <button 
            className={`tab ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            Preajustes
          </button>
        )}
        {enableMIDI && (
          <button 
            className={`tab ${activeTab === 'midi' ? 'active' : ''}`}
            onClick={() => setActiveTab('midi')}
          >
            MIDI
          </button>
        )}
        {enablePostProcessing && (
          <button 
            className={`tab ${activeTab === 'effects' ? 'active' : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            Efectos
          </button>
        )}
        {enableRecording && (
          <button 
            className={`tab ${activeTab === 'recording' ? 'active' : ''}`}
            onClick={() => setActiveTab('recording')}
          >
            Grabación
          </button>
        )}
      </div>
      
      {/* Tab content */}
      <div className="tab-content">
        {/* Equation tab */}
        {activeTab === 'equation' && (
          <div className="equation-tab">
            <h3>Parámetros de la Ecuación</h3>
            
            <div className="equation-type">
              <label>
                <input 
                  type="radio" 
                  checked={equationType === 'standard'} 
                  onChange={() => setEquationType('standard')} 
                />
                Ecuación Chladni Estándar
              </label>
              
              {enableCustomEquations && (
                <label>
                  <input 
                    type="radio" 
                    checked={equationType === 'custom'} 
                    onChange={() => setEquationType('custom')} 
                  />
                  Ecuación Personalizada
                </label>
              )}
            </div>
            
            {equationType === 'standard' && (
              <div className="standard-params">
                <div className="param-group">
                  <label>Parámetro n:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={nParam} 
                    onChange={(e) => setNParam(parseInt(e.target.value))}
                  />
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={nParam} 
                    onChange={(e) => setNParam(parseInt(e.target.value))}
                  />
                </div>
                
                <div className="param-group">
                  <label>Parámetro m:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={mParam} 
                    onChange={(e) => setMParam(parseInt(e.target.value))}
                  />
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={mParam} 
                    onChange={(e) => setMParam(parseInt(e.target.value))}
                  />
                </div>
                
                <div className="equation-preview">
                  <p>f(x,y) = {standardChladniEquation}</p>
                </div>
              </div>
            )}
            
            {equationType === 'custom' && enableCustomEquations && (
              <div className="custom-equation">
                <p>Ingresa tu ecuación personalizada usando las variables x, y, n, m, L:</p>
                <textarea 
                  value={customEquation} 
                  onChange={handleEquationChange}
                  placeholder="Ejemplo: sin(n*x)*cos(m*y)"
                  rows={4}
                />
                
                {equationError && (
                  <div className="equation-error">
                    {equationError}
                  </div>
                )}
                
                <div className="equation-preview">
                  <p>f(x,y) = {equationPreview || 'Ingresa una ecuación válida'}</p>
                </div>
                
                <div className="equation-help">
                  <h4>Variables disponibles:</h4>
                  <ul>
                    <li><code>x, y</code>: Coordenadas en el rango [-1, 1]</li>
                    <li><code>n, m</code>: Parámetros enteros (controles deslizantes arriba)</li>
                    <li><code>L</code>: Tamaño del espacio (por defecto 2)</li>
                  </ul>
                  
                  <h4>Funciones matemáticas:</h4>
                  <p>Puedes usar todas las funciones de Math: sin, cos, tan, exp, log, sqrt, pow, abs, etc.</p>
                  
                  <h4>Ejemplos:</h4>
                  <ul>
                    <li><code>sin(n*PI*x/L)*sin(m*PI*y/L)</code></li>
                    <li><code>sin(n*x*x)*cos(m*y*y)</code></li>
                    <li><code>sin(n*sqrt(x*x+y*y))</code> (patrón circular)</li>
                  </ul>
                </div>
              </div>
            )}
            
            <div className="shuffle-controls">
              <button onClick={() => {
                const newN = Math.floor(Math.random() * 20) + 1;
                const newM = Math.floor(Math.random() * 20) + 1;
                setNParam(newN);
                setMParam(newM);
              }}>
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
          </div>
        )}
        
        {/* Presets tab */}
        {activeTab === 'presets' && enablePresets && (
          <div className="presets-tab">
            <h3>Preajustes</h3>
            
            <div className="save-preset">
              <input 
                type="text" 
                placeholder="Nombre del preajuste" 
                value={presetName} 
                onChange={(e) => setPresetName(e.target.value)} 
              />
              <button onClick={savePreset}>Guardar actual</button>
            </div>
            
            <div className="presets-list">
              <h4>Preajustes guardados</h4>
              {presets.length === 0 ? (
                <p>No hay preajustes guardados</p>
              ) : (
                <ul>
                  {presets.map(preset => (
                    <li 
                      key={preset.id}
                      className={activePreset === preset.id ? 'active' : ''}
                    >
                      <div className="preset-info">
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-params">n={preset.n}, m={preset.m}</span>
                      </div>
                      <div className="preset-actions">
                        <button onClick={() => loadPreset(preset.id)}>Cargar</button>
                        <button onClick={() => deletePreset(preset.id)}>Eliminar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="presets-export">
              <h4>Exportar/Importar</h4>
              <div className="export-buttons">
                <button onClick={() => {
                  const dataStr = JSON.stringify(presets);
                  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                  
                  const exportName = 'chladni-presets.json';
                  const linkElement = document.createElement('a');
                  linkElement.setAttribute('href', dataUri);
                  linkElement.setAttribute('download', exportName);
                  linkElement.click();
                }}>
                  Exportar preajustes
                </button>
                
                <label className="import-button">
                  Importar preajustes
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const importedPresets = JSON.parse(event.target?.result as string);
                          if (Array.isArray(importedPresets)) {
                            setPresets(prevPresets => [...prevPresets, ...importedPresets]);
                            savePresetsToLocalStorage([...presets, ...importedPresets]);
                          }
                        } catch (error) {
                          console.error('Error parsing imported presets:', error);
                          alert('Error importing presets. Invalid format.');
                        }
                      };
                      reader.readAsText(file);
                    }} 
                  />
                </label>
              </div>
            </div>
          </div>
        )}
        
        {/* MIDI tab */}
        {activeTab === 'midi' && enableMIDI && (
          <div className="midi-tab">
            <h3>Control MIDI</h3>
            
            {!navigator.requestMIDIAccess ? (
              <div className="midi-not-supported">
                <p>Tu navegador no soporta la API Web MIDI.</p>
                <p>Prueba con Chrome, Edge u Opera para usar esta función.</p>
              </div>
            ) : (
              <>
                <div className="midi-devices">
                  <h4>Dispositivos MIDI</h4>
                  {midiDevices.length === 0 ? (
                    <p>No se detectaron dispositivos MIDI. Conecta uno y refresca la página.</p>
                  ) : (
                    <select 
                      value={selectedMidiDevice || ''} 
                      onChange={(e) => selectMIDIDevice(e.target.value)}
                    >
                      <option value="">Selecciona un dispositivo</option>
                      {midiDevices.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name} ({device.manufacturer})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                
                {lastMidiMessage && (
                  <div className="midi-monitor">
                    <h4>Último mensaje MIDI</h4>
                    <p>
                      Control: {lastMidiMessage.controller}, 
                      Valor: {lastMidiMessage.value}
                    </p>
                  </div>
                )}
                
                <div className="midi-mappings">
                  <h4>Asignaciones MIDI</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Parámetro</th>
                        <th>Control #</th>
                        <th>Rango</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Parámetro n</td>
                        <td>
                          {midiMappings.find(m => m.paramName === 'n')?.controlId || '-'}
                        </td>
                        <td>1-20</td>
                        <td>
                          <button 
                            onClick={() => startMIDILearning('n')}
                            className={midiLearning === 'n' ? 'learning' : ''}
                          >
                            {midiLearning === 'n' ? 'Mueve un control...' : 'Asignar'}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Parámetro m</td>
                        <td>
                          {midiMappings.find(m => m.paramName === 'm')?.controlId || '-'}
                        </td>
                        <td>1-20</td>
                        <td>
                          <button 
                            onClick={() => startMIDILearning('m')}
                            className={midiLearning === 'm' ? 'learning' : ''}
                          >
                            {midiLearning === 'm' ? 'Mueve un control...' : 'Asignar'}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Sensibilidad</td>
                        <td>
                          {midiMappings.find(m => m.paramName === 'sensitivity')?.controlId || '-'}
                        </td>
                        <td>0-100</td>
                        <td>
                          <button 
                            onClick={() => startMIDILearning('sensitivity')}
                            className={midiLearning === 'sensitivity' ? 'learning' : ''}
                          >
                            {midiLearning === 'sensitivity' ? 'Mueve un control...' : 'Asignar'}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Tamaño partículas</td>
                        <td>
                          {midiMappings.find(m => m.paramName === 'particleSize')?.controlId || '-'}
                        </td>
                        <td>0.5-5</td>
                        <td>
                          <button 
                            onClick={() => startMIDILearning('particleSize')}
                            className={midiLearning === 'particleSize' ? 'learning' : ''}
                          >
                            {midiLearning === 'particleSize' ? 'Mueve un control...' : 'Asignar'}
                          </button>
                        </td>
                      </tr>
                      {enablePostProcessing && (
                        <>
                          <tr>
                            <td>Brillo</td>
                            <td>
                              {midiMappings.find(m => m.paramName === 'brightness')?.controlId || '-'}
                            </td>
                            <td>0-200</td>
                            <td>
                              <button 
                                onClick={() => startMIDILearning('brightness')}
                                className={midiLearning === 'brightness' ? 'learning' : ''}
                              >
                                {midiLearning === 'brightness' ? 'Mueve un control...' : 'Asignar'}
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td>Resplandor</td>
                            <td>
                              {midiMappings.find(m => m.paramName === 'glow')?.controlId || '-'}
                            </td>
                            <td>0-100</td>
                            <td>
                              <button 
                                onClick={() => startMIDILearning('glow')}
                                className={midiLearning === 'glow' ? 'learning' : ''}
                              >
                                {midiLearning === 'glow' ? 'Mueve un control...' : 'Asignar'}
                              </button>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                  
                  {midiLearning && (
                    <button 
                      className="cancel-learning"
                      onClick={cancelMIDILearning}
                    >
                      Cancelar asignación
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Effects tab */}
        {activeTab === 'effects' && enablePostProcessing && (
          <div className="effects-tab">
            <h3>Efectos Visuales</h3>
            
            <div className="effect-toggle">
              <label>
                <input 
                  type="checkbox" 
                  checked={postProcessing.enabled} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, enabled: e.target.checked }))} 
                />
                Habilitar efectos de post-procesamiento
              </label>
            </div>
            
            <div className={`effects-controls ${postProcessing.enabled ? 'enabled' : 'disabled'}`}>
              <div className="effect-control">
                <label>Desenfoque (px)</label>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  step="0.5"
                  value={postProcessing.blur} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, blur: parseFloat(e.target.value) }))} 
                />
                <span>{postProcessing.blur}px</span>
              </div>
              
              <div className="effect-control">
                <label>Resplandor</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={postProcessing.glow} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, glow: parseInt(e.target.value) }))} 
                />
                <span>{postProcessing.glow}%</span>
              </div>
              
              <div className="effect-control">
                <label>Contraste</label>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={postProcessing.contrast} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, contrast: parseInt(e.target.value) }))} 
                />
                <span>{postProcessing.contrast}%</span>
              </div>
              
              <div className="effect-control">
                <label>Brillo</label>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={postProcessing.brightness} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, brightness: parseInt(e.target.value) }))} 
                />
                <span>{postProcessing.brightness}%</span>
              </div>
              
              <div className="effect-control">
                <label>Saturación</label>
                <input 
                  type="range" 
                  min="0" 
                  max="200" 
                  value={postProcessing.saturation} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, saturation: parseInt(e.target.value) }))} 
                />
                <span>{postProcessing.saturation}%</span>
              </div>
              
              <div className="effect-control">
                <label>Rotación de tono</label>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={postProcessing.hueRotate} 
                  onChange={(e) => setPostProcessing(prev => ({ ...prev, hueRotate: parseInt(e.target.value) }))} 
                />
                <span>{postProcessing.hueRotate}°</span>
              </div>
              
              <div className="effect-control">
                <label>
                  <input 
                    type="checkbox" 
                    checked={postProcessing.invert} 
                    onChange={(e) => setPostProcessing(prev => ({ ...prev, invert: e.target.checked }))} 
                  />
                  Invertir colores
                </label>
              </div>
              
              <button 
                onClick={() => setPostProcessing({
                  enabled: true,
                  blur: 0,
                  glow: 0,
                  contrast: 100,
                  brightness: 100,
                  saturation: 100,
                  hueRotate: 0,
                  invert: false
                })}
              >
                Restablecer efectos
              </button>
            </div>
            
            <div className="effect-presets">
              <h4>Preajustes de efectos</h4>
              <div className="preset-buttons">
                <button onClick={() => setPostProcessing({
                  enabled: true,
                  blur: 2,
                  glow: 50,
                  contrast: 120,
                  brightness: 110,
                  saturation: 120,
                  hueRotate: 0,
                  invert: false
                })}>
                  Neón
                </button>
                
                <button onClick={() => setPostProcessing({
                  enabled: true,
                  blur: 1,
                  glow: 20,
                  contrast: 90,
                  brightness: 80,
                  saturation: 70,
                  hueRotate: 180,
                  invert: false
                })}>
                  Frío
                </button>
                
                <button onClick={() => setPostProcessing({
                  enabled: true,
                  blur: 0,
                  glow: 0,
                  contrast: 150,
                  brightness: 120,
                  saturation: 150,
                  hueRotate: 30,
                  invert: false
                })}>
                  Cálido
                </button>
                
                <button onClick={() => setPostProcessing({
                  enabled: true,
                  blur: 3,
                  glow: 30,
                  contrast: 80,
                  brightness: 100,
                  saturation: 0,
                  hueRotate: 0,
                  invert: false
                })}>
                  Monocromo
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Recording tab */}
        {activeTab === 'recording' && enableRecording && (
          <div className="recording-tab">
            <h3>Grabación y Captura</h3>
            
            <div className="screenshot-section">
              <h4>Captura de pantalla</h4>
              <button onClick={takeScreenshot}>
                Tomar captura de pantalla (PNG)
              </button>
            </div>
            
            <div className="recording-section">
              <h4>Grabación de video</h4>
              
              <div className="recording-settings">
                <div className="setting-group">
                  <label>Formato:</label>
                  <select 
                    value={recordingSettings.format} 
                    onChange={(e) => setRecordingSettings(prev => ({ 
                      ...prev, 
                      format: e.target.value as 'gif' | 'webm' | 'mp4' | 'png' 
                    }))}
                  >
                    <option value="webm">WebM</option>
                    <option value="mp4">MP4</option>
                  </select>
                </div>
                
                <div className="setting-group">
                  <label>Calidad:</label>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1" 
                    step="0.1"
                    value={recordingSettings.quality} 
                    onChange={(e) => setRecordingSettings(prev => ({ 
                      ...prev, 
                      quality: parseFloat(e.target.value) 
                    }))} 
                  />
                  <span>{Math.round(recordingSettings.quality * 100)}%</span>
                </div>
                
                <div className="setting-group">
                  <label>FPS:</label>
                  <input 
                    type="number" 
                    min="10" 
                    max="60" 
                    value={recordingSettings.framerate} 
                    onChange={(e) => setRecordingSettings(prev => ({ 
                      ...prev, 
                      framerate: parseInt(e.target.value) 
                    }))} 
                  />
                </div>
                
                <div className="setting-group">
                  <label>Duración (segundos):</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={recordingSettings.duration} 
                    onChange={(e) => setRecordingSettings(prev => ({ 
                      ...prev, 
                      duration: parseInt(e.target.value) 
                    }))} 
                  />
                </div>
              </div>
              
              <div className="recording-controls">
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    className="start-recording"
                  >
                    Iniciar grabación
                  </button>
                ) : (
                  <div className="recording-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${recordingProgress}%` }}
                      ></div>
                    </div>
                    <button 
                      onClick={stopRecording}
                      className="stop-recording"
                    >
                      Detener grabación
                    </button>
                  </div>
                )}
              </div>
              
              <p className="recording-note">
                La grabación se guardará automáticamente al finalizar.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Main visualization component */}
      <div 
        className="visualization-container"
        style={{
          ...getPostProcessingStyle()
        }}
      >
        <div ref={handleCanvasRef}>
          <ChladniSynthesizer
            initialN={nParam}
            initialM={mParam}
            colorMode={selectedColorMode as any}
          />
        </div>
      </div>
      
      {/* CSS for the component */}
      <style>{`
        .chladni-advanced-controls {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 8px;
          padding: 16px;
          max-height: 80vh;
          overflow-y: auto;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 8px;
        }
        
        .tab {
          background: rgba(60, 60, 60, 0.5);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .tab:hover {
          background: rgba(80, 80, 80, 0.5);
        }
        
        .tab.active {
          background: rgba(0, 120, 255, 0.5);
        }
        
        .tab-content {
          padding: 16px 0;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 1.2em;
        }
        
        h4 {
          margin-top: 16px;
          margin-bottom: 8px;
          font-size: 1em;
          color: rgba(255, 255, 255, 0.8);
        }
        
        /* Equation tab styles */
        .equation-type {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }
        
        .param-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .param-group label {
          width: 100px;
        }
        
        .param-group input[type="number"] {
          width: 60px;
          background: rgba(30, 30, 30, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 4px 8px;
        }
        
        .param-group input[type="range"] {
          flex: 1;
        }
        
        .equation-preview {
          margin: 16px 0;
          padding: 12px;
          background: rgba(30, 30, 30, 0.5);
          border-radius: 4px;
          font-family: monospace;
        }
        
        .custom-equation textarea {
          width: 100%;
          background: rgba(30, 30, 30, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 8px;
          font-family: monospace;
          resize: vertical;
        }
        
        .equation-error {
          color: #ff4d4d;
          margin: 8px 0;
          padding: 8px;
          background: rgba(255, 0, 0, 0.1);
          border-radius: 4px;
        }
        
        .equation-help {
          margin-top: 16px;
          padding: 12px;
          background: rgba(30, 30, 30, 0.5);
          border-radius: 4px;
          font-size: 0.9em;
        }
        
        .equation-help code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 4px;
          border-radius: 3px;
        }
        
        .equation-help ul {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        .shuffle-controls {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 16px;
        }
        
        /* Presets tab styles */
        .save-preset {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .save-preset input {
          flex: 1;
          background: rgba(30, 30, 30, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 8px;
        }
        
        .presets-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .presets-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: rgba(40, 40, 40, 0.5);
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .presets-list li:hover {
          background: rgba(60, 60, 60, 0.5);
        }
        
        .presets-list li.active {
          background: rgba(0, 120, 255, 0.2);
          border-left: 3px solid rgba(0, 120, 255, 0.8);
        }
        
        .preset-info {
          display: flex;
          flex-direction: column;
        }
        
        .preset-name {
          font-weight: bold;
        }
        
        .preset-params {
          font-size: 0.8em;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .preset-actions {
          display: flex;
          gap: 8px;
        }
        
        .presets-export {
          margin-top: 24px;
        }
        
        .export-buttons {
          display: flex;
          gap: 8px;
        }
        
        .import-button {
          position: relative;
          display: inline-block;
          background: rgba(60, 60, 60, 0.5);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .import-button:hover {
          background: rgba(80, 80, 80, 0.5);
        }
        
        .import-button input[type="file"] {
          position: absolute;
          top: 0;
          left: 0;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        
        /* MIDI tab styles */
        .midi-not-supported {
          padding: 16px;
          background: rgba(255, 0, 0, 0.1);
          border-radius: 4px;
          margin-bottom: 16px;
        }
        
        .midi-devices select {
          width: 100%;
          background: rgba(30, 30, 30, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 16px;
        }
        
        .midi-monitor {
          padding: 12px;
          background: rgba(30, 30, 30, 0.5);
          border-radius: 4px;
          margin-bottom: 16px;
        }
        
        .midi-mappings table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        
        .midi-mappings th {
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .midi-mappings td {
          padding: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .midi-mappings button.learning {
          background: rgba(255, 165, 0, 0.5);
          animation: pulse 1.5s infinite;
        }
        
        .cancel-learning {
          background: rgba(255, 0, 0, 0.5);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        /* Effects tab styles */
        .effects-controls.disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        
        .effect-control {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .effect-control label {
          width: 120px;
        }
        
        .effect-control input[type="range"] {
          flex: 1;
        }
        
        .effect-control span {
          width: 50px;
          text-align: right;
        }
        
        .effect-presets {
          margin-top: 24px;
        }
        
        .preset-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        /* Recording tab styles */
        .screenshot-section,
        .recording-section {
          margin-bottom: 24px;
        }
        
        .recording-settings {
          margin-bottom: 16px;
        }
        
        .setting-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .setting-group label {
          width: 120px;
        }
        
        .setting-group select,
        .setting-group input[type="number"] {
          background: rgba(30, 30, 30, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 4px 8px;
        }
        
        .recording-progress {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: rgba(0, 120, 255, 0.8);
          transition: width 0.3s;
        }
        
        .start-recording {
          background: rgba(0, 180, 0, 0.5);
        }
        
        .stop-recording {
          background: rgba(255, 0, 0, 0.5);
        }
        
        .recording-note {
          font-size: 0.9em;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 16px;
        }
        
        /* Visualization container */
        .visualization-container {
          position: relative;
          width: 100%;
          height: 500px;
          background: black;
          overflow: hidden;
          border-radius: 8px;
        }
        
        /* General button styles */
        button {
          background: rgba(60, 60, 60, 0.5);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        button:hover {
          background: rgba(80, 80, 80, 0.5);
        }
        
        /* Animations */
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChladniAdvancedControls;
