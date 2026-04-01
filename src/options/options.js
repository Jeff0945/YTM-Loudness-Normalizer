/**
 * Options page for YTM Loudness Normalizer
 */

const BROWSER = typeof browser !== "undefined" ? browser : chrome;
const STORAGE_KEY = "ytm_target_db";

const targetDbSlider = document.getElementById("targetDb");
const targetDbNumber = document.getElementById("targetDbNumber");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");

/**
 * Load saved target dB value
 */
async function loadSettings() {
  try {
    const data = await BROWSER.storage.local.get(STORAGE_KEY);
    const value = data[STORAGE_KEY] || "-14";
    targetDbSlider.value = value;
    targetDbNumber.value = value;
  } catch (err) {
    showStatus("Failed to load settings", "error");
  }
}

/**
 * Clamp and validate dB value
 */
function normalizeValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(-60, Math.min(-7, n));
}

/**
 * Save target dB value to storage
 */
async function saveSettings(value) {
  try {
    await BROWSER.storage.local.set({ [STORAGE_KEY]: value });
    showStatus("Saved successfully!", "success");
  } catch (err) {
    showStatus("Failed to save settings", "error");
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  setTimeout(() => {
    statusEl.className = "status";
  }, 3000);
}

function normalizeAndValidate() {
  const normalized = normalizeValue(targetDbNumber.value);
  if (normalized === null) {
    showStatus("Please enter a valid number.", "error");
    return;
  }
  targetDbNumber.value = String(normalized);
  targetDbSlider.value = String(normalized);

  return normalized;
}

/**
 * Sync slider and number input
 */
targetDbSlider.addEventListener("input", (e) => {
  targetDbNumber.value = e.target.value;
});

targetDbNumber.addEventListener("input", (e) => {
  targetDbSlider.value = e.target.value;
});

targetDbNumber.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    await saveSettings(String(normalizeAndValidate()));
  }
});

saveBtn.addEventListener("click", async () => {
  await saveSettings(String(normalizeAndValidate()));
});

// Initialize
loadSettings();
