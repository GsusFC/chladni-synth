// Tipos para el piano MIDI virtual
export interface PianoNote {
  note: string;
  frequency: number;
  octave: number;
  isSharp: boolean;
}

export interface PianoKey {
  note: PianoNote;
  isPressed: boolean;
  velocity: number;
}

export interface PianoConfig {
  startOctave: number;
  endOctave: number;
  volume: number;
  sustain: boolean;
  polyphony: number;
}

export interface PianoSynthOptions {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  waveform: OscillatorType;
}

export interface PianoAudioData {
  frequency: number;
  amplitude: number;
  isPlaying: boolean;
  activeNotes: string[];
}

// Mapeo de notas a frecuencias (A4 = 440Hz)
export const NOTE_FREQUENCIES: Record<string, number> = {
  'C': 261.63,
  'C#': 277.18,
  'D': 293.66,
  'D#': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#': 369.99,
  'G': 392.00,
  'G#': 415.30,
  'A': 440.00,
  'A#': 466.16,
  'B': 493.88
};

// Calcular frecuencia para cualquier octava
export const getFrequency = (note: string, octave: number): number => {
  const baseFreq = NOTE_FREQUENCIES[note];
  if (!baseFreq) return 440; // Fallback a A4
  
  // A4 está en la octava 4, ajustar según la octava deseada
  const octaveMultiplier = Math.pow(2, octave - 4);
  return baseFreq * octaveMultiplier;
};

// Generar todas las notas para un rango de octavas
export const generatePianoKeys = (startOctave: number, endOctave: number): PianoKey[] => {
  const keys: PianoKey[] = [];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  for (let octave = startOctave; octave <= endOctave; octave++) {
    for (const noteName of noteNames) {
      const frequency = getFrequency(noteName, octave);
      keys.push({
        note: {
          note: noteName,
          frequency,
          octave,
          isSharp: noteName.includes('#')
        },
        isPressed: false,
        velocity: 0
      });
    }
  }
  
  return keys;
};
