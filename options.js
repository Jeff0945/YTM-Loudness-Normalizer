const ext = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_TARGET_DB = -14;
const MIN_LOUDNESS_DB = -60;
const MAX_LOUDNESS_DB = 10;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

async function loadOptions() {
    const input = document.getElementById("targetDb");
    try {
        const data = await ext.storage.local.get("ytm_target_db");
        const raw = Number(data.ytm_target_db);
        const value = Number.isFinite(raw)
            ? clamp(raw, MIN_LOUDNESS_DB, MAX_LOUDNESS_DB)
            : DEFAULT_TARGET_DB;
        input.value = String(value);
    } catch (err) {
        input.value = String(DEFAULT_TARGET_DB);
    }
}

async function saveOptions() {
    const input = document.getElementById("targetDb");
    const status = document.getElementById("status");

    const raw = Number(input.value);
    const value = Number.isFinite(raw)
        ? clamp(raw, MIN_LOUDNESS_DB, MAX_LOUDNESS_DB)
        : DEFAULT_TARGET_DB;

    input.value = String(value);

    try {
        await ext.storage.local.set({ ytm_target_db: value });
        status.textContent = "Saved.";
        setTimeout(() => {
            status.textContent = "";
        }, 1200);
    } catch (err) {
        status.textContent = "Failed to save.";
    }
}

document.getElementById("saveBtn").addEventListener("click", () => {
    void saveOptions();
});

void loadOptions();