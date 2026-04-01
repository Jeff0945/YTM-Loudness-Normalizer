/**
 * Message passing and storage event handling
 */

import { BROWSER, MESSAGE_TYPES, STORAGE_KEYS, AUDIO_CONFIG } from "./constants.js";
import { clamp, warn } from "./utils.js";

export class MessageHandler {
  /**
   * Load user's target dB from storage
   */
  static async loadUserTargetDb() {
    try {
      const data = await BROWSER.storage.local.get(STORAGE_KEYS.TARGET_DB);
      const raw = Number(data[STORAGE_KEYS.TARGET_DB]);
      return Number.isFinite(raw)
        ? clamp(raw, AUDIO_CONFIG.MIN_LOUDNESS_DB, AUDIO_CONFIG.MAX_LOUDNESS_DB)
        : AUDIO_CONFIG.DEFAULT_TARGET_DB;
    } catch (err) {
      warn("Failed to load target dB from storage:", err.message);
      return AUDIO_CONFIG.DEFAULT_TARGET_DB;
    }
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
      if (!changes[STORAGE_KEYS.TARGET_DB]) return;

      const next = Number(changes[STORAGE_KEYS.TARGET_DB].newValue);
      const targetDb = Number.isFinite(next)
        ? clamp(next, AUDIO_CONFIG.MIN_LOUDNESS_DB, AUDIO_CONFIG.MAX_LOUDNESS_DB)
        : AUDIO_CONFIG.DEFAULT_TARGET_DB;

      callback(targetDb);
    });
  }

  /**
   * Listen for user gestures (pointerdown, keydown, touchstart)
   */
  static onUserGesture(callback) {
    const handler = () => callback();
    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
  }
}
