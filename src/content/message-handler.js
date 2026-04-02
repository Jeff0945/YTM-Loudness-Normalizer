/**
 * Message passing and storage event handling
 */

import {
  BROWSER,
  MESSAGE_TYPES,
  STORAGE_KEYS,
  AUDIO_CONFIG,
  TARGET_PRESET_VALUES,
} from "./constants.js";
import { clamp, warn } from "./utils.js";

const VALID_PRESETS = new Set([...Object.keys(TARGET_PRESET_VALUES), "custom"]);

export class MessageHandler {
  static normalizeTargetDb(raw) {
    return clamp(raw, AUDIO_CONFIG.MIN_TARGET_DB, AUDIO_CONFIG.MAX_TARGET_DB);
  }

  static sanitizePreset(rawPreset) {
    return VALID_PRESETS.has(rawPreset) ? rawPreset : AUDIO_CONFIG.DEFAULT_TARGET_PRESET;
  }

  static resolveTargetDb(preset, customTargetDb) {
    if (preset === "custom") {
      return this.normalizeTargetDb(customTargetDb);
    }

    const presetValue = TARGET_PRESET_VALUES[preset];
    return Number.isFinite(presetValue) ? presetValue : AUDIO_CONFIG.DEFAULT_TARGET_DB;
  }

  /**
   * Load all user settings and resolve effective target dB.
   */
  static async loadUserSettings() {
    try {
      const data = await BROWSER.storage.local.get([
        STORAGE_KEYS.NORMALIZATION_ENABLED,
        STORAGE_KEYS.TARGET_PRESET,
        STORAGE_KEYS.CUSTOM_TARGET_DB,
        STORAGE_KEYS.TARGET_DB, // legacy fallback
      ]);

      const enabled =
        typeof data[STORAGE_KEYS.NORMALIZATION_ENABLED] === "boolean"
          ? data[STORAGE_KEYS.NORMALIZATION_ENABLED]
          : AUDIO_CONFIG.DEFAULT_NORMALIZATION_ENABLED;

      const preset = this.sanitizePreset(data[STORAGE_KEYS.TARGET_PRESET]);

      const customRaw = Number(data[STORAGE_KEYS.CUSTOM_TARGET_DB]);
      const legacyRaw = Number(data[STORAGE_KEYS.TARGET_DB]);

      const customTargetDb = Number.isFinite(customRaw)
        ? this.normalizeTargetDb(customRaw)
        : Number.isFinite(legacyRaw)
          ? this.normalizeTargetDb(legacyRaw)
          : AUDIO_CONFIG.DEFAULT_CUSTOM_TARGET_DB;

      const targetDb = this.resolveTargetDb(preset, customTargetDb);

      return { enabled, preset, customTargetDb, targetDb };
    } catch (err) {
      warn("Failed to load settings from storage:", err.message);
      return {
        enabled: AUDIO_CONFIG.DEFAULT_NORMALIZATION_ENABLED,
        preset: AUDIO_CONFIG.DEFAULT_TARGET_PRESET,
        customTargetDb: AUDIO_CONFIG.DEFAULT_CUSTOM_TARGET_DB,
        targetDb: AUDIO_CONFIG.DEFAULT_TARGET_DB,
      };
    }
  }

  /**
   * Legacy helper kept for compatibility
   */
  static async loadUserTargetDb() {
    const settings = await this.loadUserSettings();
    return settings.targetDb;
  }

  /**
   * Listen for loudness messages from injected script
   */
  static onLoudnessMessage(callback) {
    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || data.type !== MESSAGE_TYPES.LOUDNESS) return;
      if (!Number.isFinite(data.value)) return;

      await callback(data.value);
    });
  }

  /**
   * Listen for storage changes (e.g., target dB updates from options page)
   */
  static onStorageChange(callback) {
    if (!BROWSER.storage || !BROWSER.storage.onChanged) return;

    BROWSER.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      const hasRelevantChange =
        Boolean(changes[STORAGE_KEYS.NORMALIZATION_ENABLED]) ||
        Boolean(changes[STORAGE_KEYS.TARGET_PRESET]) ||
        Boolean(changes[STORAGE_KEYS.CUSTOM_TARGET_DB]) ||
        Boolean(changes[STORAGE_KEYS.TARGET_DB]);

      if (!hasRelevantChange) return;

      void this.loadUserSettings()
        .then((settings) => {
          callback(settings);
        })
        .catch((err) => {
          warn("Failed to process storage change:", err.message);
        });
    });
  }

  /**
   * Listen for user gestures (pointerdown, keydown, touchstart)
   */
  static onUserGesture(callback) {
    const handler = () => callback();
    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
  }
}
