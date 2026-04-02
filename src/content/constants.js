/**
 * Configuration and constants for YTM Loudness Normalizer
 */

export const BROWSER = typeof browser !== "undefined" ? browser : chrome;

export const AUDIO_CONFIG = {
  DEFAULT_TARGET_DB: -14, // legacy/effective fallback
  DEFAULT_TARGET_PRESET: "balanced",
  DEFAULT_CUSTOM_TARGET_DB: -14,
  DEFAULT_NORMALIZATION_ENABLED: true,

  MIN_TARGET_DB: -60,
  MAX_TARGET_DB: -7,

  MIN_LOUDNESS_DB: -60,
  MAX_LOUDNESS_DB: 10,

  MIN_GAIN: 0.01,
  MAX_GAIN: 4.0,
  GAIN_RAMP_TIME: 0.25, // seconds
  YT_APPLIED_LOUDNESS_REDUCTION: 7, // dB
};

export const TARGET_PRESET_VALUES = Object.freeze({
  aggressive: -7,
  loud: -11,
  balanced: -14,
  quiet: -19,
});

export const STORAGE_KEYS = {
  TARGET_DB: "ytm_target_db", // legacy key kept for migration fallback
  NORMALIZATION_ENABLED: "ytm_normalization_enabled",
  TARGET_PRESET: "ytm_target_preset",
  CUSTOM_TARGET_DB: "ytm_custom_target_db",
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
