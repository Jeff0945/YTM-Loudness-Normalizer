/**
 * Options page for YTM Loudness Normalizer
 */

const BROWSER = typeof browser !== "undefined" ? browser : chrome;

const STORAGE_KEYS = {
  TARGET_DB_LEGACY: "ytm_target_db",
  NORMALIZATION_ENABLED: "ytm_normalization_enabled",
  TARGET_PRESET: "ytm_target_preset",
  CUSTOM_TARGET_DB: "ytm_custom_target_db",
};

const TARGET_PRESET_VALUES = Object.freeze({
  aggressive: -7,
  loud: -11,
  balanced: -14,
  quiet: -19,
});

const DEFAULTS = {
  enabled: true,
  preset: "balanced",
  customTargetDb: -14,
  minTargetDb: -60,
  maxTargetDb: -7,
};

const normalizationEnabledEl = document.getElementById("normalizationEnabled");
const targetPresetEl = document.getElementById("targetPreset");
const customTargetSectionEl = document.getElementById("customTargetSection");
const targetDbSlider = document.getElementById("targetDb");
const targetDbNumber = document.getElementById("targetDbNumber");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");

let statusTimer = null;

/**
 * Show status message
 */
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  statusTimer = setTimeout(() => {
    statusEl.className = "status";
    statusTimer = null;
  }, 2000);
}

/**
 * Clamp target dB value within allowed range
 */
function clampTargetDb(value) {
  return Math.max(DEFAULTS.minTargetDb, Math.min(DEFAULTS.maxTargetDb, value));
}

/**
 * Normalize and validate target dB value from input
 */
function normalizeTargetDb(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clampTargetDb(n);
}

/**
 * Sanitize preset value, defaulting to "balanced" if invalid
 */
function sanitizePreset(rawPreset) {
  if (rawPreset === "custom") return "custom";
  return Object.prototype.hasOwnProperty.call(TARGET_PRESET_VALUES, rawPreset)
    ? rawPreset
    : DEFAULTS.preset;
}

/**
 * Show or hide custom target dB section based on preset selection
 */
function renderCustomSection(preset) {
  const show = preset === "custom";
  customTargetSectionEl.classList.toggle("hidden", !show);
}

/**
 * Save settings patch to storage with error handling
 */
async function savePatch(patch, successMessage = "Settings updated") {
  try {
    await BROWSER.storage.local.set(patch);
    showStatus(successMessage, "success");
  } catch (err) {
    showStatus("Failed to save settings", "error");
  }
}

/**
 * Load settings from storage and initialize form fields
 */
async function loadSettings() {
  try {
    const data = await BROWSER.storage.local.get([
      STORAGE_KEYS.NORMALIZATION_ENABLED,
      STORAGE_KEYS.TARGET_PRESET,
      STORAGE_KEYS.CUSTOM_TARGET_DB,
      STORAGE_KEYS.TARGET_DB_LEGACY,
    ]);

    const enabled =
      typeof data[STORAGE_KEYS.NORMALIZATION_ENABLED] === "boolean"
        ? data[STORAGE_KEYS.NORMALIZATION_ENABLED]
        : DEFAULTS.enabled;

    const preset = sanitizePreset(data[STORAGE_KEYS.TARGET_PRESET]);

    const customRaw = Number(data[STORAGE_KEYS.CUSTOM_TARGET_DB]);
    const legacyRaw = Number(data[STORAGE_KEYS.TARGET_DB_LEGACY]);
    const customTargetDb = Number.isFinite(customRaw)
      ? clampTargetDb(customRaw)
      : Number.isFinite(legacyRaw)
        ? clampTargetDb(legacyRaw)
        : DEFAULTS.customTargetDb;

    normalizationEnabledEl.checked = enabled;
    targetPresetEl.value = preset;
    targetDbSlider.value = String(customTargetDb);
    targetDbNumber.value = String(customTargetDb);

    renderCustomSection(preset);
  } catch (err) {
    showStatus("Failed to load settings", "error");
  }
}

/**
 * Sync slider and number input values
 */
function syncCustomInputsFromSlider() {
  targetDbNumber.value = targetDbSlider.value;
}

/**
 * Sync slider and number input values
 */
function syncCustomInputsFromNumber() {
  targetDbSlider.value = targetDbNumber.value;
}

/**
 * Handle normalization enabled toggle
 */
normalizationEnabledEl.addEventListener("change", async () => {
  await savePatch(
    { [STORAGE_KEYS.NORMALIZATION_ENABLED]: normalizationEnabledEl.checked },
    normalizationEnabledEl.checked ? "Normalization enabled" : "Normalization disabled"
  );
});

/**
 * Handle preset selection change
 */
targetPresetEl.addEventListener("change", async () => {
  const preset = sanitizePreset(targetPresetEl.value);
  targetPresetEl.value = preset;
  renderCustomSection(preset);

  await savePatch(
    { [STORAGE_KEYS.TARGET_PRESET]: preset },
    preset === "custom" ? "Custom mode selected" : `Preset applied: ${preset}`
  );
});

/**
 * Sync slider and number inputs on user interaction
 */
targetDbSlider.addEventListener("input", syncCustomInputsFromSlider);
targetDbNumber.addEventListener("input", syncCustomInputsFromNumber);

/**
 * Validate and normalize custom target dB on blur
 */
targetDbNumber.addEventListener("blur", () => {
  const normalized = normalizeTargetDb(targetDbNumber.value);
  if (normalized === null) return;
  targetDbNumber.value = String(normalized);
  targetDbSlider.value = String(normalized);
});

/**
 * Validate, normalize, and save custom target dB on save button click
 */
saveBtn.addEventListener("click", async () => {
  const normalized = normalizeTargetDb(targetDbNumber.value);
  if (normalized === null) {
    showStatus("Please enter a valid number.", "error");
    return;
  }

  targetDbNumber.value = String(normalized);
  targetDbSlider.value = String(normalized);

  await savePatch({ [STORAGE_KEYS.CUSTOM_TARGET_DB]: normalized }, "Custom target saved");
});

targetDbNumber.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    saveBtn.click();
  }
});

// Initialize
loadSettings();
