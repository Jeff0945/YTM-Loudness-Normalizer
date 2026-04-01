/**
 * Audio graph management and normalization logic
 */

import { AUDIO_CONFIG } from "./constants.js";
import { clamp, dbToLinear, linearToDb, warn } from "./utils.js";

export class AudioNormalizer {
  constructor() {
    this.audioCtx = null;
    this.gainNode = null;
    this.sourceNode = null;
    this.wiredVideo = null;
    this.isUnlocked = false;
    this.lastLoudnessDb = null;
  }

  /**
   * Initialize AudioContext and gain node
   */
  initAudioContext() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
      }
      return this.audioCtx;
    } catch (err) {
      warn("Failed to create AudioContext:", err.message);
      return null;
    }
  }

  /**
   * Resume AudioContext and mark as unlocked
   */
  async unlock() {
    try {
      const ctx = this.initAudioContext();
      if (!ctx) return false;

      if (ctx.state !== "running") {
        await ctx.resume();
      }

      this.isUnlocked = ctx.state === "running";
      return this.isUnlocked;
    } catch (err) {
      warn("Failed to unlock audio:", err.message);
      return false;
    }
  }

  /**
   * Wire video element to gain node
   */
  async wireVideo(video) {
    if (!this.isUnlocked || !this.audioCtx || !this.gainNode) {
      return false;
    }

    try {
      if (this.wiredVideo !== video) {
        if (this.sourceNode) {
          this.sourceNode.disconnect();
        }
        this.sourceNode = this.audioCtx.createMediaElementSource(video);
        this.sourceNode.connect(this.gainNode);
        this.wiredVideo = video;
      }
      return true;
    } catch (err) {
      warn("Failed to wire video:", err.message);
      return false;
    }
  }

  /**
   * Compute normalization parameters given raw loudness from YouTube
   */
  computeNormalization(loudnessDb, userTargetDb) {
    const postYtDb = Math.min(
      -AUDIO_CONFIG.YT_APPLIED_LOUDNESS_REDUCTION,
      loudnessDb - AUDIO_CONFIG.YT_APPLIED_LOUDNESS_REDUCTION
    );
    const adjustmentDb = userTargetDb - postYtDb;
    const gainLinear = clamp(
      dbToLinear(adjustmentDb),
      AUDIO_CONFIG.MIN_GAIN,
      AUDIO_CONFIG.MAX_GAIN
    );
    const gainDb = linearToDb(gainLinear);

    return {
      rawLoudnessDb: loudnessDb,
      postYtDb,
      targetDb: userTargetDb,
      gainLinear,
      gainDb,
    };
  }

  /**
   * Apply gain to the audio graph
   */
  applyGain(gainLinear) {
    if (!this.gainNode || !this.audioCtx) {
      return;
    }

    this.gainNode.gain.setTargetAtTime(
      gainLinear,
      this.audioCtx.currentTime,
      AUDIO_CONFIG.GAIN_RAMP_TIME
    );
  }

  /**
   * Validate loudness value is in expected range
   */
  isValidLoudness(loudnessDb) {
    return loudnessDb >= AUDIO_CONFIG.MIN_LOUDNESS_DB && loudnessDb <= AUDIO_CONFIG.MAX_LOUDNESS_DB;
  }
}
