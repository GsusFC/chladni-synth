import React, { useState, useCallback } from 'react';
import { PianoKey, PianoNote } from './types/PianoTypes';

interface PianoKeyboardProps {
  keys: PianoKey[];
  onKeyPress: (note: PianoNote, velocity: number) => void;
  onKeyRelease: (note: PianoNote) => void;
  disabled?: boolean;
  className?: string;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  keys,
  onKeyPress,
  onKeyRelease,
  disabled = false,
  className = ''
}) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  const handleMouseDown = useCallback((note: PianoNote, event: React.MouseEvent) => {
    if (disabled) return;
    
    event.preventDefault();
    const noteKey = `${note.note}${note.octave}`;
    
    if (!pressedKeys.has(noteKey)) {
      setPressedKeys(prev => new Set(prev).add(noteKey));
      onKeyPress(note, 0.7); // Velocity fija por ahora
    }
  }, [disabled, pressedKeys, onKeyPress]);

  const handleMouseUp = useCallback((note: PianoNote) => {
    if (disabled) return;
    
    const noteKey = `${note.note}${note.octave}`;
    setPressedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(noteKey);
      return newSet;
    });
    onKeyRelease(note);
  }, [disabled, onKeyRelease]);

  const handleMouseLeave = useCallback((note: PianoNote) => {
    // Soltar la tecla si el mouse sale del área
    handleMouseUp(note);
  }, [handleMouseUp]);

  const renderKey = (key: PianoKey, index: number) => {
    const noteKey = `${key.note.note}${key.note.octave}`;
    const isPressed = pressedKeys.has(noteKey);
    const isSharp = key.note.isSharp;

    const keyClasses = [
      'piano-key',
      isSharp ? 'piano-key-sharp' : 'piano-key-natural',
      isPressed ? 'piano-key-pressed' : '',
      disabled ? 'piano-key-disabled' : ''
    ].filter(Boolean).join(' ');

    return (
      <div
        key={noteKey}
        className={keyClasses}
        onMouseDown={(e) => handleMouseDown(key.note, e)}
        onMouseUp={() => handleMouseUp(key.note)}
        onMouseLeave={() => handleMouseLeave(key.note)}
        data-note={noteKey}
        style={{
          // Posicionamiento para teclas sostenidas
          ...(isSharp && {
            position: 'absolute',
            zIndex: 2,
            left: `${(index - 0.5) * (100 / keys.filter(k => !k.note.isSharp).length)}%`,
            width: '60%',
            height: '60%'
          })
        }}
      >
        <span className="piano-key-label">
          {key.note.note}
          <sub>{key.note.octave}</sub>
        </span>
      </div>
    );
  };

  // Separar teclas naturales y sostenidas para renderizado
  const naturalKeys = keys.filter(key => !key.note.isSharp);
  const sharpKeys = keys.filter(key => key.note.isSharp);

  return (
    <div className={`piano-keyboard ${className}`}>
      {/* Teclas naturales (blancas) */}
      <div className="piano-natural-keys">
        {naturalKeys.map((key, index) => renderKey(key, index))}
      </div>
      
      {/* Teclas sostenidas (negras) - posicionadas absolutamente */}
      <div className="piano-sharp-keys">
        {sharpKeys.map((key, index) => {
          // Calcular posición basada en la tecla natural anterior
          const naturalIndex = naturalKeys.findIndex(nKey => 
            nKey.note.octave === key.note.octave && 
            getNaturalKeyBefore(key.note.note) === nKey.note.note
          );
          return renderKey(key, naturalIndex);
        })}
      </div>
    </div>
  );
};

// Helper para obtener la tecla natural anterior a una sostenida
const getNaturalKeyBefore = (sharpNote: string): string => {
  const mapping: Record<string, string> = {
    'C#': 'C',
    'D#': 'D',
    'F#': 'F',
    'G#': 'G',
    'A#': 'A'
  };
  return mapping[sharpNote] || 'C';
};

export default PianoKeyboard;
