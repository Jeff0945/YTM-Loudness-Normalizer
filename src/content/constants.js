/**
 * Configuration and constants for YTM Loudness Normalizer
 */

export const BROWSER = typeof browser !== "undefined" ? browser : chrome;

export const AUDIO_CONFIG = {
  DEFAULT_TARGET_DB: -14,
  MIN_LOUDNESS_DB: -60,
  MAX_LOUDNESS_DB: 10,
  MIN_GAIN: 0.01,
  MAX_GAIN: 4.0,
  GAIN_RAMP_TIME: 0.25, // seconds
  YT_APPLIED_LOUDNESS_REDUCTION: 7, // dB
};

export const STORAGE_KEYS = {
  TARGET_DB: "ytm_target_db",
};

export const MESSAGE_TYPES = {
  LOUDNESS: "YTM_LOUDNESS",
};

export const DOM_IDS = {
  status: "ytm-ln-status",
  afterYt: "ytm-ln-afterYt",
  target: "ytm-ln-target",
  gain: "ytm-ln-gain",
  divider: "ytm-ln-divider",
};

export const DOM_LABELS = {
  status: "YTM Normalizer",
  afterYt: "Post-YT loudness",
  target: "Target normalization",
  gain: "Applied gain",
  divider: "────────────────",
};

export const LOG_PREFIX = "[YTM-LN]";
