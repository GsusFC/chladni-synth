// Type definitions for Web MIDI API
// Based on the W3C specification: https://webaudio.github.io/web-midi-api/

declare namespace WebMidi {
  interface MIDIOptions {
    sysex?: boolean;
    software?: boolean;
  }

  interface MIDIAccess extends EventTarget {
    inputs: MIDIInputMap;
    outputs: MIDIOutputMap;
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    sysexEnabled: boolean;
  }

  interface MIDIConnectionEvent extends Event {
    port: MIDIPort;
  }

  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
  }

  interface MIDIPort extends EventTarget {
    id: string;
    manufacturer?: string;
    name?: string;
    type: 'input' | 'output';
    version?: string;
    state: 'connected' | 'disconnected';
    connection: 'open' | 'closed' | 'pending';
    onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    /**
     * Some runtimes expose `onmidimessage` directly on `MIDIPort` (e.g. when
     * narrowing types dynamically). Although the official spec defines this
     * handler only on `MIDIInput`, we declare it here as optional so that
     * TypeScript code accessing `port.onmidimessage` on a generic `MIDIPort`
     * does not produce type errors.
     */
    onmidimessage?: ((event: MIDIMessageEvent) => void) | null;
    open(): Promise<MIDIPort>;
    close(): Promise<MIDIPort>;
  }

  interface MIDIInput extends MIDIPort {
    type: 'input';
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }

  interface MIDIOutput extends MIDIPort {
    type: 'output';
    send(data: number[] | Uint8Array, timestamp?: number): void;
    clear(): void;
  }

  interface MIDIInputMap {
    size: number;
    entries(): IterableIterator<[string, MIDIInput]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<MIDIInput>;
    forEach(callback: (value: MIDIInput, key: string, map: MIDIInputMap) => void, thisArg?: any): void;
    get(id: string): MIDIInput | undefined;
    has(id: string): boolean;
  }

  interface MIDIOutputMap {
    size: number;
    entries(): IterableIterator<[string, MIDIOutput]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<MIDIOutput>;
    forEach(callback: (value: MIDIOutput, key: string, map: MIDIOutputMap) => void, thisArg?: any): void;
    get(id: string): MIDIOutput | undefined;
    has(id: string): boolean;
  }
}

interface Navigator {
  requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
}
