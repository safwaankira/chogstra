// Tone.js audio engine: turns ChogSounds + patterns into a playing band.
// Browser only. Import it dynamically after a user tap (see app/lab/lab.tsx).

import * as Tone from "tone";
import {
  DRUM_TUNING,
  FAMILY_TONE,
  FLAVOUR_SETTINGS,
  ROLE_OCTAVE,
  ROOM_SETTINGS,
  SHAPE_ENVELOPE,
  SPARKLE_SETTINGS,
  type ChogSound,
  type Room,
} from "./mapping";
import { C_MINOR_PENTATONIC, DRUM_PIECES, STEPS, decodePattern, degreeToMidi, type Scale } from "./music";

export const BPM = 90;

export type Part = { sound: ChogSound; pattern: bigint };
export type NoteListener = (tokenId: number, step: number) => void;

type Voice = { trigger: (time: number, degree: number) => void; dispose: () => void };

const midiToFreq = (midi: number) => Tone.Frequency(midi, "midi").toFrequency();

class Mixer {
  readonly limiter = new Tone.Limiter(-1).toDestination();
  readonly master = new Tone.Gain(0.8).connect(this.limiter);
  private rooms = new Map<Room, Tone.Reverb>();
  private shimmer: Tone.PitchShift | null = null;

  room(room: Room): Tone.Reverb {
    let reverb = this.rooms.get(room);
    if (!reverb) {
      reverb = new Tone.Reverb({ decay: ROOM_SETTINGS[room].decay, wet: 1 }).connect(this.master);
      this.rooms.set(room, reverb);
    }
    return reverb;
  }

  shimmerBus(): Tone.PitchShift {
    if (!this.shimmer) {
      const tail = new Tone.Reverb({ decay: 6, wet: 1 }).connect(this.master);
      this.shimmer = new Tone.PitchShift({ pitch: 12, wet: 1 }).connect(tail);
    }
    return this.shimmer;
  }

  dispose() {
    this.rooms.forEach((r) => r.dispose());
    this.shimmer?.dispose();
    this.master.dispose();
    this.limiter.dispose();
  }
}

function buildVoice(sound: ChogSound, mixer: Mixer, scale: Scale): Voice {
  const nodes: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => unknown }>(n: T) => (nodes.push(n), n);

  // Output chain: filter -> flavour -> effect -> pan -> volume -> master (+ room send)
  const volume = keep(new Tone.Volume(sound.volumeDb)).connect(mixer.master);
  const roomSend = keep(new Tone.Gain(ROOM_SETTINGS[sound.room].wet)).connect(mixer.room(sound.room));
  volume.connect(roomSend);
  const panner = keep(new Tone.Panner(sound.pan)).connect(volume);

  let effectIn: Tone.ToneAudioNode = panner;
  switch (sound.effect) {
    case "distortion":
      effectIn = keep(new Tone.Distortion({ distortion: 0.45, wet: 0.6 })).connect(panner);
      break;
    case "echo":
      effectIn = keep(new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.32, wet: 0.3 })).connect(panner);
      break;
    case "chorus":
      effectIn = keep(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.5 }).start()).connect(panner);
      break;
    case "phaser":
      effectIn = keep(new Tone.Phaser({ frequency: 0.4, octaves: 3, baseFrequency: 400, wet: 0.5 })).connect(panner);
      break;
    case "shimmer": {
      const send = keep(new Tone.Gain(0.35)).connect(mixer.shimmerBus());
      panner.connect(send);
      break;
    }
    case "dry":
      break;
  }

  let flavourIn: Tone.ToneAudioNode = effectIn;
  if (sound.flavour === "spooky") {
    const { vibratoHz, vibratoDepth } = FLAVOUR_SETTINGS.spooky;
    flavourIn = keep(new Tone.Vibrato(vibratoHz, vibratoDepth)).connect(effectIn);
  } else if (sound.flavour === "glitch") {
    flavourIn = keep(new Tone.BitCrusher(FLAVOUR_SETTINGS.glitch.bits)).connect(effectIn);
  }

  const filter = keep(new Tone.Filter({ type: "lowpass", frequency: sound.cutoffHz, Q: 1 })).connect(flavourIn);

  const env = SHAPE_ENVELOPE[sound.shape];
  const sparkle =
    sound.sparkle === "none"
      ? null
      : (() => {
          const s = SPARKLE_SETTINGS[sound.sparkle];
          const synth = keep(
            new Tone.FMSynth({
              harmonicity: s.harmonicity,
              modulationIndex: s.modulationIndex,
              envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 },
              modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
              volume: s.volumeDb,
            }),
          ).connect(panner);
          return { synth, semitonesUp: s.semitonesUp };
        })();

  const dispose = () => nodes.forEach((n) => n.dispose());

  if (sound.role === "drums") {
    const tuning = DRUM_TUNING[sound.range];
    const k = env.drumDecayScale;
    const noise = FAMILY_TONE[sound.family].drumNoise;
    const kick = keep(new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4 * k, sustain: 0, release: 0.2 } })).connect(flavourIn);
    const tom = keep(new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.3 * k, sustain: 0, release: 0.2 }, volume: -4 })).connect(filter);
    const snare = keep(new Tone.NoiseSynth({ noise: { type: noise }, envelope: { attack: 0.001, decay: 0.16 * k, sustain: 0 }, volume: -6 })).connect(filter);
    const hat = keep(
      new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, envelope: { attack: 0.001, decay: 0.05 * k, release: 0.01 }, volume: -22 }),
    ).connect(filter);
    const openHat = keep(
      new Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, envelope: { attack: 0.001, decay: 0.3 * k, release: 0.1 }, volume: -24 }),
    ).connect(filter);
    // Rare+ second layer: a clap on the snare; Epic+ also a ride on the kick.
    const clap = sound.layer === "none" ? null : keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.003, decay: 0.12, sustain: 0 }, volume: -12 })).connect(filter);
    const ride =
      sound.layer === "harmony" || sound.layer === "signature"
        ? keep(new Tone.MetalSynth({ harmonicity: 3.1, modulationIndex: 16, resonance: 6000, envelope: { attack: 0.001, decay: 0.5, release: 0.2 }, volume: -28 })).connect(filter)
        : null;

    return {
      dispose,
      trigger(time, degree) {
        const piece = DRUM_PIECES[degree];
        if (piece === "kick") {
          kick.triggerAttackRelease(tuning.kick, "8n", time);
          ride?.triggerAttackRelease(tuning.hatHz * 2, "16n", time);
          sparkle?.synth.triggerAttackRelease(midiToFreq(84), "16n", time);
        } else if (piece === "snare") {
          snare.triggerAttackRelease("16n", time);
          clap?.triggerAttackRelease("16n", time + 0.01);
        } else if (piece === "hat") hat.triggerAttackRelease(tuning.hatHz, "32n", time, 0.8);
        else if (piece === "openhat") openHat.triggerAttackRelease(tuning.hatHz, "8n", time, 0.8);
        else tom.triggerAttackRelease(tuning.tom, "8n", time);
      },
    };
  }

  const octave = ROLE_OCTAVE[sound.role][sound.range];
  const oscillator = { type: sound.oscillator } as Tone.OmniOscillatorOptions;
  const envelope = { attack: env.attack, decay: env.decay, sustain: env.sustain, release: env.release };
  const makeSynth = (volume: number, detune = 0) =>
    sound.role === "chords"
      ? keep(new Tone.PolySynth(Tone.Synth, { oscillator, envelope, volume, detune })).connect(filter)
      : keep(new Tone.Synth({ oscillator, envelope, volume, detune })).connect(filter);

  const main = makeSynth(0);
  // Skull: a detuned twin a few cents off, for the haunted wobble.
  const twin = sound.flavour === "spooky" ? makeSynth(-4, FLAVOUR_SETTINGS.spooky.detuneSpreadCents) : null;
  const octaveLayer = sound.layer === "octave" || sound.layer === "signature" ? makeSynth(-9) : null;
  const harmonyLayer = sound.layer === "harmony" || sound.layer === "signature" ? makeSynth(-8) : null;

  const notesFor = (degree: number, shift = 0) => {
    const degrees = sound.role === "chords" ? [degree, degree + 2, degree + 4] : [degree];
    return degrees.map((d) => midiToFreq(degreeToMidi(scale, d, octave) + shift));
  };
  const play = (synth: Tone.Synth | Tone.PolySynth, freqs: number[], time: number) => {
    if (synth instanceof Tone.PolySynth) synth.triggerAttackRelease(freqs, env.duration, time);
    else synth.triggerAttackRelease(freqs[0], env.duration, time);
  };

  return {
    dispose,
    trigger(time, degree) {
      play(main, notesFor(degree), time);
      if (twin) play(twin, notesFor(degree), time);
      if (octaveLayer) play(octaveLayer, notesFor(degree, 12), time);
      if (harmonyLayer) play(harmonyLayer, notesFor(degree + 2), time);
      if (sparkle) sparkle.synth.triggerAttackRelease(midiToFreq(degreeToMidi(scale, degree, octave) + sparkle.semitonesUp), "16n", time);
    },
  };
}

export class BandEngine {
  private mixer: Mixer | null = null;
  private voices: Voice[] = [];
  private sequence: Tone.Sequence<number> | null = null;

  /** Must be called from a user gesture (click/tap). */
  async start() {
    await Tone.start();
    if (!this.mixer) this.mixer = new Mixer();
    Tone.getTransport().bpm.value = BPM;
  }

  /** Replace whatever is playing with these parts, looping forever. */
  play(parts: Part[], onNote: NoteListener, scale: Scale = C_MINOR_PENTATONIC) {
    if (!this.mixer) throw new Error("BandEngine.start() must be called first");
    this.stop();
    const mixer = this.mixer;
    const voices = parts.map((p) => ({ voice: buildVoice(p.sound, mixer, scale), steps: decodePattern(p.pattern), tokenId: p.sound.tokenId }));
    this.voices = voices.map((v) => v.voice);

    const steps = Array.from({ length: STEPS }, (_, i) => i);
    this.sequence = new Tone.Sequence<number>(
      (time, step) => {
        for (const v of voices) {
          const s = v.steps[step];
          if (!s.on) continue;
          v.voice.trigger(time, s.degree);
          Tone.getDraw().schedule(() => onNote(v.tokenId, step), time);
        }
      },
      steps,
      "16n",
    ).start(0);

    const transport = Tone.getTransport();
    transport.position = 0;
    transport.start("+0.1");
  }

  stop() {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    Tone.getDraw().cancel();
    this.sequence?.dispose();
    this.sequence = null;
    // Let release tails ring briefly before tearing the voices down.
    const old = this.voices;
    this.voices = [];
    setTimeout(() => old.forEach((v) => v.dispose()), 1500);
  }

  dispose() {
    this.stop();
    setTimeout(() => this.mixer?.dispose(), 1600);
  }
}
