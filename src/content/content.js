const ext = typeof browser !== "undefined" ? browser : chrome;

const script = document.createElement('script');
script.src = ext.runtime.getURL('content/inject.js');
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
        if (video && video.currentSrc) {
            await ensureAudioReady(video); // should only wire source node
            if (Number.isFinite(lastLoudnessDb)) {
                applyGain(lastLoudnessDb);
            }
        }
    } catch (err) {
        // keep silent; next gesture retries
    }
}

function installAudioUnlockListeners() {
    const handler = () => { void unlockAudioFromGesture(); };
    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
}

installAudioUnlockListeners();

async function ensureAudioReady(video) {
    if (!audioUnlocked || !audioCtx || !gainNode) return false;

    if (wiredVideo !== video) {
        if (sourceNode) {
            try { sourceNode.disconnect(); } catch (err) {}
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

    gainNode.gain.setTargetAtTime(
        gain,
        audioCtx.currentTime,
        0.25
    );
}

window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || data.type !== "YTM_LOUDNESS") return;
    if (!Number.isFinite(data.value)) return;

    lastLoudnessDb = data.value;

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