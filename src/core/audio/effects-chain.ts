import * as Tone from 'tone';

export type EffectType = 'reverb' | 'delay' | 'distortion' | 'chorus' | 'compressor' | 'eq';

export interface EffectConfig {
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export const DEFAULT_EFFECT_PARAMS: Record<EffectType, Record<string, number>> = {
  reverb: { decay: 2.5, wet: 0.3 },
  delay: { delayTime: 0.25, feedback: 0.3, wet: 0.2 },
  distortion: { distortion: 0.4, wet: 0.5 },
  chorus: { frequency: 1.5, depth: 0.7, wet: 0.3 },
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 },
  eq: { low: 0, mid: 0, high: 0 },
};

export function createEffect(config: EffectConfig): Tone.ToneAudioNode {
  switch (config.type) {
    case 'reverb': {
      const effect = new Tone.Reverb({
        decay: config.params.decay ?? 2.5,
        wet: config.params.wet ?? 0.3,
      });
      return effect;
    }
    case 'delay': {
      const effect = new Tone.FeedbackDelay({
        delayTime: config.params.delayTime ?? 0.25,
        feedback: config.params.feedback ?? 0.3,
        wet: config.params.wet ?? 0.2,
      });
      return effect;
    }
    case 'distortion': {
      const effect = new Tone.Distortion({
        distortion: config.params.distortion ?? 0.4,
        wet: config.params.wet ?? 0.5,
      });
      return effect;
    }
    case 'chorus': {
      const effect = new Tone.Chorus({
        frequency: config.params.frequency ?? 1.5,
        depth: config.params.depth ?? 0.7,
        wet: config.params.wet ?? 0.3,
      }).start();
      return effect;
    }
    case 'compressor': {
      const effect = new Tone.Compressor({
        threshold: config.params.threshold ?? -24,
        ratio: config.params.ratio ?? 4,
        attack: config.params.attack ?? 0.003,
        release: config.params.release ?? 0.25,
      });
      return effect;
    }
    case 'eq': {
      const effect = new Tone.EQ3({
        low: config.params.low ?? 0,
        mid: config.params.mid ?? 0,
        high: config.params.high ?? 0,
      });
      return effect;
    }
  }
}

export class TrackEffectsChain {
  private effects: Map<EffectType, { node: Tone.ToneAudioNode; config: EffectConfig }> = new Map();
  private source: Tone.ToneAudioNode;

  constructor(source: Tone.ToneAudioNode) {
    this.source = source;
  }

  addEffect(config: EffectConfig) {
    this.removeEffect(config.type);
    if (!config.enabled) return;
    const node = createEffect(config);
    this.effects.set(config.type, { node, config });
    this.rebuildChain();
  }

  removeEffect(type: EffectType) {
    const existing = this.effects.get(type);
    if (existing) {
      existing.node.dispose();
      this.effects.delete(type);
      this.rebuildChain();
    }
  }

  updateEffect(type: EffectType, params: Record<string, number>) {
    const existing = this.effects.get(type);
    if (existing) {
      this.addEffect({ ...existing.config, params: { ...existing.config.params, ...params } });
    }
  }

  private rebuildChain() {
    this.source.disconnect();
    const nodes = Array.from(this.effects.values())
      .filter((e) => e.config.enabled)
      .map((e) => e.node);

    if (nodes.length === 0) {
      this.source.toDestination();
    } else {
      let current: Tone.ToneAudioNode = this.source;
      for (const node of nodes) {
        current.connect(node);
        current = node;
      }
      current.toDestination();
    }
  }

  dispose() {
    for (const { node } of this.effects.values()) {
      node.dispose();
    }
    this.effects.clear();
  }

  getConfigs(): EffectConfig[] {
    return Array.from(this.effects.values()).map((e) => e.config);
  }
}
