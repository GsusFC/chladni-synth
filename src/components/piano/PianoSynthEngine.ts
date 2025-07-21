import { PianoNote, PianoSynthOptions, PianoAudioData } from './types/PianoTypes';

export class PianoSynthEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeOscillators: Map<string, { oscillator: OscillatorNode; gain: GainNode }> = new Map();
  private synthOptions: PianoSynthOptions = {
    attack: 0.01,
    decay: 0.3,
    sustain: 0.7,
    release: 1.0,
    waveform: 'sine'
  };

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    try {
      // Solo inicializar si estamos en el navegador
      if (typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          this.audioContext = new AudioContext();
          this.setupAudioNodes();
        }
      }
    } catch (error) {
      console.error('Error inicializando AudioContext:', error);
    }
  }

  private setupAudioNodes() {
    if (!this.audioContext) return;

    // Crear nodo de ganancia maestro
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);

    // Crear analizador para integración con sistema existente
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    // Conectar nodos
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  // Método para obtener el analizador (integración con sistema existente)
  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  // Método para conectar a un nodo externo (integración con sistema existente)
  public connectTo(destination: AudioNode): void {
    if (this.analyser) {
      this.analyser.connect(destination);
    }
  }

  // Tocar una nota
  public playNote(note: PianoNote, velocity: number = 0.7): void {
    if (!this.audioContext || !this.masterGain) return;

    const noteKey = `${note.note}${note.octave}`;
    
    // Si la nota ya está sonando, pararla primero
    this.stopNote(note);

    try {
      // Crear oscilador
      const oscillator = this.audioContext.createOscillator();
      oscillator.frequency.setValueAtTime(note.frequency, this.audioContext.currentTime);
      oscillator.type = this.synthOptions.waveform;

      // Crear envelope (ADSR)
      const noteGain = this.audioContext.createGain();
      const now = this.audioContext.currentTime;
      
      // Attack
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(velocity, now + this.synthOptions.attack);
      
      // Decay
      noteGain.gain.linearRampToValueAtTime(
        velocity * this.synthOptions.sustain, 
        now + this.synthOptions.attack + this.synthOptions.decay
      );

      // Conectar nodos
      oscillator.connect(noteGain);
      noteGain.connect(this.masterGain);

      // Iniciar oscilador
      oscillator.start(now);

      // Guardar referencia para poder parar la nota
      this.activeOscillators.set(noteKey, { oscillator, gain: noteGain });

    } catch (error) {
      console.error('Error tocando nota:', error);
    }
  }

  // Parar una nota
  public stopNote(note: PianoNote): void {
    if (!this.audioContext) return;

    const noteKey = `${note.note}${note.octave}`;
    const activeNote = this.activeOscillators.get(noteKey);

    if (activeNote) {
      try {
        const now = this.audioContext.currentTime;
        
        // Release
        activeNote.gain.gain.cancelScheduledValues(now);
        activeNote.gain.gain.setValueAtTime(activeNote.gain.gain.value, now);
        activeNote.gain.gain.linearRampToValueAtTime(0, now + this.synthOptions.release);

        // Parar oscilador después del release
        activeNote.oscillator.stop(now + this.synthOptions.release);

        // Limpiar referencia
        this.activeOscillators.delete(noteKey);
      } catch (error) {
        console.error('Error parando nota:', error);
      }
    }
  }

  // Parar todas las notas
  public stopAllNotes(): void {
    for (const [noteKey, activeNote] of this.activeOscillators) {
      try {
        if (this.audioContext) {
          const now = this.audioContext.currentTime;
          activeNote.gain.gain.cancelScheduledValues(now);
          activeNote.gain.gain.setValueAtTime(activeNote.gain.gain.value, now);
          activeNote.gain.gain.linearRampToValueAtTime(0, now + 0.1); // Release rápido
          activeNote.oscillator.stop(now + 0.1);
        }
      } catch (error) {
        console.error('Error parando nota:', noteKey, error);
      }
    }
    this.activeOscillators.clear();
  }

  // Configurar volumen maestro
  public setMasterVolume(volume: number): void {
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  // Configurar opciones de síntesis
  public setSynthOptions(options: Partial<PianoSynthOptions>): void {
    this.synthOptions = { ...this.synthOptions, ...options };
  }

  // Obtener datos de audio para análisis
  public getAudioData(): PianoAudioData | null {
    if (!this.analyser) return null;

    const isPlaying = this.activeOscillators.size > 0;
    const activeNotes = Array.from(this.activeOscillators.keys());

    // Si no hay notas activas, devolver datos en silencio
    if (!isPlaying) {
      return {
        frequency: 0,
        amplitude: 0,
        isPlaying: false,
        activeNotes: []
      };
    }

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    // Calcular frecuencia dominante y amplitud
    let maxValue = 0;
    let maxIndex = 0;
    let totalAmplitude = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const value = frequencyData[i];
      totalAmplitude += value;

      if (value > maxValue) {
        maxValue = value;
        maxIndex = i;
      }
    }

    const sampleRate = this.audioContext?.sampleRate || 44100;
    const dominantFrequency = maxIndex * sampleRate / this.analyser.fftSize;
    const averageAmplitude = totalAmplitude / frequencyData.length / 255;

    // Solo devolver datos si hay amplitud significativa
    const threshold = 0.001; // Umbral mínimo de amplitud
    if (averageAmplitude < threshold) {
      return {
        frequency: 0,
        amplitude: 0,
        isPlaying: false,
        activeNotes: []
      };
    }

    return {
      frequency: dominantFrequency,
      amplitude: averageAmplitude,
      isPlaying: true,
      activeNotes
    };
  }

  // Limpiar recursos
  public dispose(): void {
    this.stopAllNotes();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioContext = null;
    this.masterGain = null;
    this.analyser = null;
  }
}
