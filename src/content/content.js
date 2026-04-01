const ext = typeof browser !== "undefined" ? browser : chrome;

const script = document.createElement("script");
script.src = ext.runtime.getURL("content/inject.js");
script.onload = () => script.remove();
script.onerror = () => console.error("[YTM] inject.js failed to load");
(document.head || document.documentElement).appendChild(script);

let audioCtx;
let gainNode;
let sourceNode;
let wiredVideo;

const DEFAULT_TARGET_DB = -14;
const MIN_LOUDNESS_DB = -60;
const MAX_LOUDNESS_DB = 10;
const MIN_GAIN = 0.01;
const MAX_GAIN = 4.0;

let userTargetDb = DEFAULT_TARGET_DB;

let lastLoudnessDb = null;

let audioUnlocked = false;

let lastApplied = {
  rawLoudnessDb: null,
  postYtDb: null,
  targetDb: null,
  gainLinear: null,
  gainDb: null,
};

let statsUpdateScheduled = false;

const STATS_IDS = {
  ytDividerLabel: "ytm-ln-divider-label",
  ytDividerValue: "ytm-ln-divider-value",
  statusLabel: "ytm-ln-status-label",
  statusValue: "ytm-ln-status-value",
  afterYtLabel: "ytm-ln-afteryt-label",
  afterYtValue: "ytm-ln-afteryt-value",
  targetLabel: "ytm-ln-target-label",
  targetValue: "ytm-ln-target-value",
  gainLabel: "ytm-ln-gain-label",
  gainValue: "ytm-ln-gain-value",
};

function formatDb(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

function formatGain(value) {
  return Number.isFinite(value) ? (value * 100).toFixed(0) : "--";
}

function computeNormalizationSnapshot(loudnessDb) {
  const postYtDb = Math.min(-7, loudnessDb - 7);
  const adjustmentDb = userTargetDb - postYtDb;
  const gainLinear = clamp(Math.pow(10, adjustmentDb / 20), MIN_GAIN, MAX_GAIN);
  const gainDb = 20 * Math.log10(gainLinear);

  return {
    rawLoudnessDb: loudnessDb,
    postYtDb,
    targetDb: userTargetDb,
    gainLinear,
    gainDb,
  };
}

function findStatsContainer() {
  return document.querySelector("ytmusic-nerd-stats");
}

function ensureRow(container, labelId, valueId, labelText) {
  let label = container.querySelector(`#${labelId}`);
  let value = container.querySelector(`#${valueId}`);

  if (!label) {
    label = document.createElement("div");
    label.id = labelId;
    label.className = "label style-scope ytmusic-nerd-stats";
    label.textContent = labelText;
    container.appendChild(label);
  }

  if (!value) {
    value = document.createElement("div");
    value.id = valueId;
    value.className = "value style-scope ytmusic-nerd-stats";
    container.appendChild(value);
  }

  return { label, value };
}

function ensureStatsRows(container) {
  return {
    ytDivider: ensureRow(
      container,
      STATS_IDS.ytDividerLabel,
      STATS_IDS.ytDividerValue,
      "--------------------------------------------------------------------------------",
    ),
    status: ensureRow(
      container,
      STATS_IDS.statusLabel,
      STATS_IDS.statusValue,
      "YTM Normalizer",
    ),
    afterYt: ensureRow(
      container,
      STATS_IDS.afterYtLabel,
      STATS_IDS.afterYtValue,
      "Post-YT loudness",
    ),
    target: ensureRow(
      container,
      STATS_IDS.targetLabel,
      STATS_IDS.targetValue,
      "Target normalization",
    ),
    gain: ensureRow(
      container,
      STATS_IDS.gainLabel,
      STATS_IDS.gainValue,
      "Applied gain",
    ),
  };
}

function updateStatsOverlay() {
  const container = findStatsContainer();
  if (!container) return;

  const rows = ensureStatsRows(container);

  let localLastApplied = { ...lastApplied };

  if (!Number.isFinite(localLastApplied.postYtDb)) {
    rows.status.value.textContent = "Waiting for loudness data...";
    rows.afterYt.value.textContent = "-- dB";
    rows.target.value.textContent = `${formatDb(userTargetDb)} dB`;
    rows.gain.value.textContent = "--";
    return;
  }

  rows.status.value.textContent = "Enabled";
  rows.afterYt.value.textContent = `${formatDb(localLastApplied.postYtDb)} dB`;
  rows.target.value.textContent = `${formatDb(localLastApplied.targetDb)} dB`;
  rows.gain.value.textContent = `${formatGain(localLastApplied.gainLinear)}% (${formatDb(localLastApplied.gainDb)} dB)`;
}

function scheduleStatsOverlayUpdate() {
  if (statsUpdateScheduled) return;
  statsUpdateScheduled = true;
  requestAnimationFrame(() => {
    statsUpdateScheduled = false;
    updateStatsOverlay();
  });
}

function nodeLooksLikeStatsHost(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node;

  if (el.matches?.("ytmusic-nerd-stats")) return true;
  return !!el.querySelector?.("ytmusic-nerd-stats");
}

const statsObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== "childList") continue;
    for (const n of m.addedNodes) {
      if (nodeLooksLikeStatsHost(n)) {
        scheduleStatsOverlayUpdate();
        return;
      }
    }
  }
});

scheduleStatsOverlayUpdate();

if (document.body) {
  statsObserver.observe(document.body, { childList: true, subtree: true });
} else {
  window.addEventListener(
    "DOMContentLoaded",
    () => {
      statsObserver.observe(document.body, { childList: true, subtree: true });
    },
    { once: true },
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function loadUserTargetDb() {
  try {
    const data = await ext.storage.local.get("ytm_target_db");
    const raw = Number(data.ytm_target_db);
    userTargetDb = Number.isFinite(raw)
      ? clamp(raw, MIN_LOUDNESS_DB, MAX_LOUDNESS_DB)
      : DEFAULT_TARGET_DB;
  } catch (err) {
    userTargetDb = DEFAULT_TARGET_DB;
  }
}

void loadUserTargetDb();

async function reapplyTargetImmediately() {
  if (!Number.isFinite(lastLoudnessDb)) return;

  const video = document.querySelector("video");
  if (!video || !video.currentSrc) return;

  try {
    await ensureAudioReady(video);
    applyGain(lastLoudnessDb);
  } catch (err) {
    // Ignore and retry on next message/change.
  }
}

if (ext.storage && ext.storage.onChanged) {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.ytm_target_db) return;
    const next = Number(changes.ytm_target_db.newValue);
    userTargetDb = Number.isFinite(next)
      ? clamp(next, MIN_LOUDNESS_DB, MAX_LOUDNESS_DB)
      : DEFAULT_TARGET_DB;

    void reapplyTargetImmediately();
    updateStatsOverlay();
  });
}

async function unlockAudioFromGesture() {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
    }

    if (audioCtx.state !== "running") {
      await audioCtx.resume();
    }

    audioUnlocked = audioCtx.state === "running";
    if (!audioUnlocked) return;

    // If we already have loudness info, apply immediately after unlock.
    const video = document.querySelector("video");
    if (!video || !video.currentSrc) return;

    if (!Number.isFinite(lastLoudnessDb)) return;

    await ensureAudioReady(video);
    applyGain(lastLoudnessDb);
  } catch (err) {
    // keep silent; next gesture retries
  }
}

function installAudioUnlockListeners() {
  const handler = () => {
    void unlockAudioFromGesture();
  };
  window.addEventListener("pointerdown", handler, { passive: true });
  window.addEventListener("keydown", handler, { passive: true });
  window.addEventListener("touchstart", handler, { passive: true });
}

installAudioUnlockListeners();

async function ensureAudioReady(video) {
  if (!audioUnlocked || !audioCtx || !gainNode) return false;

  if (wiredVideo !== video) {
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (err) {}
    }
    sourceNode = audioCtx.createMediaElementSource(video);
    sourceNode.connect(gainNode);
    wiredVideo = video;
  }

  return true;
}

function applyGain(loudnessDb) {
  if (!gainNode || !audioCtx) return;

  if (loudnessDb < MIN_LOUDNESS_DB || loudnessDb > MAX_LOUDNESS_DB) {
    console.debug("[YTM] unusual loudnessDb", loudnessDb);
  }

  const postYt = Math.min(-7, loudnessDb - 7);
  const adjustmentDb = userTargetDb - postYt;
  const gain = clamp(Math.pow(10, adjustmentDb / 20), MIN_GAIN, MAX_GAIN);

  const snapshot = computeNormalizationSnapshot(loudnessDb);
  lastApplied = snapshot;

  gainNode.gain.setTargetAtTime(
    snapshot.gainLinear,
    audioCtx.currentTime,
    0.25,
  );

  updateStatsOverlay();
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || data.type !== "YTM_LOUDNESS") return;
  if (!Number.isFinite(data.value)) return;

  lastLoudnessDb = data.value;
  lastApplied = computeNormalizationSnapshot(data.value);
  updateStatsOverlay();

  const video = document.querySelector("video");
  if (!video || !video.currentSrc) return;

  try {
    const ready = await ensureAudioReady(video);
    if (!ready) return;
    applyGain(data.value);
  } catch (err) {
    // If graph creation fails, skip this event and try again later.
  }
});
