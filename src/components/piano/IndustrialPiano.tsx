import React, { useState, useEffect, useRef, useCallback } from 'react';
import PianoKeyboard from './PianoKeyboard';
import { PianoSynthEngine } from './PianoSynthEngine';
import { generatePianoKeys, PianoNote, PianoKey, PianoAudioData } from './types/PianoTypes';

interface IndustrialPianoProps {
  onAudioDataUpdate?: (audioData: PianoAudioData) => void;
  disabled?: boolean;
  startOctave?: number;
  endOctave?: number;
  className?: string;
}

const IndustrialPiano: React.FC<IndustrialPianoProps> = ({
  onAudioDataUpdate,
  disabled = false,
  startOctave = 3,
  endOctave = 5,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [keys, setKeys] = useState<PianoKey[]>([]);
  const synthEngineRef = useRef<PianoSynthEngine | null>(null);
  const audioDataIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar piano
  useEffect(() => {
    // Generar teclas
    const pianoKeys = generatePianoKeys(startOctave, endOctave);
    setKeys(pianoKeys);

    // Inicializar motor de síntesis
    synthEngineRef.current = new PianoSynthEngine();

    // Configurar volumen inicial
    synthEngineRef.current.setMasterVolume(volume);

    return () => {
      // Limpiar recursos al desmontar
      if (synthEngineRef.current) {
        synthEngineRef.current.dispose();
      }
      if (audioDataIntervalRef.current) {
        clearInterval(audioDataIntervalRef.current);
      }
    };
  }, [startOctave, endOctave, volume]);

  // Configurar análisis de audio en tiempo real
  useEffect(() => {
    if (!onAudioDataUpdate || !synthEngineRef.current) return;

    // Actualizar datos de audio cada 16ms (~60fps) para mejor responsividad
    audioDataIntervalRef.current = setInterval(() => {
      if (synthEngineRef.current) {
        const audioData = synthEngineRef.current.getAudioData();
        if (audioData) {
          onAudioDataUpdate(audioData);
        }
      }
    }, 16);

    return () => {
      if (audioDataIntervalRef.current) {
        clearInterval(audioDataIntervalRef.current);
      }
    };
  }, [onAudioDataUpdate]);

  // Manejar cambios de volumen
  useEffect(() => {
    if (synthEngineRef.current) {
      synthEngineRef.current.setMasterVolume(volume);
    }
  }, [volume]);

  const handleKeyPress = useCallback((note: PianoNote, velocity: number) => {
    if (disabled || !synthEngineRef.current) return;
    synthEngineRef.current.playNote(note, velocity);
  }, [disabled]);

  const handleKeyRelease = useCallback((note: PianoNote) => {
    if (disabled || !synthEngineRef.current) return;
    synthEngineRef.current.stopNote(note);
  }, [disabled]);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handlePanic = useCallback(() => {
    if (synthEngineRef.current) {
      synthEngineRef.current.stopAllNotes();
    }
  }, []);

  return (
    <>
      {/* Botón toggle flotante */}
      <button
        className={`piano-toggle-button ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        title={isOpen ? 'Ocultar Piano' : 'Mostrar Piano'}
        disabled={disabled}
      >
        🎹
      </button>

      {/* Drawer del piano */}
      <div className={`piano-drawer ${isOpen ? 'open' : ''} ${className} industrial-panel`}>
        {/* Header del drawer */}
        <div className="piano-drawer-header">
          <div className="piano-drawer-title">
            🎹 Piano Virtual
          </div>
          
          <div className="industrial-flex industrial-items-center industrial-gap-md">
            {/* Control de volumen */}
            <div className="industrial-flex industrial-items-center industrial-gap-sm">
              <span className="industrial-label">VOL:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="industrial-slider"
                disabled={disabled}
              />
              <span className="industrial-value">{Math.round(volume * 100)}%</span>
            </div>

            {/* Botón panic */}
            <button
              className="industrial-button"
              onClick={handlePanic}
              title="Parar todas las notas"
              disabled={disabled}
            >
              PANIC
            </button>

            {/* Botón cerrar */}
            <button
              className="piano-drawer-toggle"
              onClick={handleToggle}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Teclado del piano */}
        <PianoKeyboard
          keys={keys}
          onKeyPress={handleKeyPress}
          onKeyRelease={handleKeyRelease}
          disabled={disabled}
        />
      </div>
    </>
  );
};

export default IndustrialPiano;
