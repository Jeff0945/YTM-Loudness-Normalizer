/**
 * YTM Loudness Normalizer - Main Content Script
 *
 * Orchestrates audio normalization and stats display for YouTube Music
 */

import { BROWSER } from "./constants.js";
import { AudioNormalizer } from "./audio-normalizer.js";
import { StatsOverlay } from "./stats-overlay.js";
import { MessageHandler } from "./message-handler.js";
import { log, error } from "./utils.js";

// Initialize injected script for loudness API access
const script = document.createElement("script");
script.src = BROWSER.runtime.getURL("content/inject.js");
script.onload = () => script.remove();
script.onerror = () => error("inject.js failed to load");
(document.head || document.documentElement).appendChild(script);

// ============================================================================
// State Management
// ============================================================================

const audio = new AudioNormalizer();
const stats = new StatsOverlay();

let normalizationEnabled = true;
let userTargetDb = -14;
let lastSnapshot = null;

let lastVideoSrc = "";
let activeVideo = null;
let videoObserver = null;

// ============================================================================
// Helper Functions
// ============================================================================

function resetForNewSong() {
  lastSnapshot = null;
  audio.lastLoudnessDb = null;
  stats.lastSnapshot = null;
  stats.update(null, userTargetDb, normalizationEnabled);
}

function handleVideoMaybeChanged() {
  const video = document.querySelector("video");
  if (!video) return;

  // Rebind if YTM swapped the element
  if (video !== activeVideo) {
    activeVideo = video;
    lastVideoSrc = "";

    const onMediaChange = () => {
      const src = video.currentSrc || video.src || "";
      if (!src || src === lastVideoSrc) return;

      lastVideoSrc = src;
      resetForNewSong();
    };

    // Store handler on the element so we can avoid duplicate listeners
    if (!video.__ytmNormalizerBound) {
      video.__ytmNormalizerBound = true;

      video.addEventListener("loadstart", onMediaChange, { passive: true });
      video.addEventListener("loadedmetadata", onMediaChange, { passive: true });
      video.addEventListener("emptied", onMediaChange, { passive: true });
      video.addEventListener("play", onMediaChange, { passive: true });
    }

    // Prime once immediately
    onMediaChange();
    return;
  }

  const src = video.currentSrc || video.src || "";
  if (!src || src === lastVideoSrc) return;

  lastVideoSrc = src;
  resetForNewSong();
}

function setupVideoWatcher() {
  const scan = () => handleVideoMaybeChanged();

  videoObserver = new MutationObserver(() => {
    scan();
  });

  if (document.body) {
    videoObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        videoObserver.observe(document.body, { childList: true, subtree: true });
        scan();
      },
      { once: true }
    );
  }

  scan();
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Main initialization sequence
 */
async function init() {
  log("Initializing...");

  // Load persisted storage
  const settings = await MessageHandler.loadUserSettings();
  normalizationEnabled = settings.enabled;
  userTargetDb = settings.targetDb;
  log("Settings loaded:", {
    enabled: normalizationEnabled,
    targetDb: userTargetDb,
    preset: settings.preset,
  });

  setupMessageListeners();
  setupStorageListeners();
  setupAudioUnlockListeners();
  setupStatsObserver();
  setupVideoWatcher();

  log("Initialization complete");
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle loudness messages from injected script
 */
function setupMessageListeners() {
  MessageHandler.onLoudnessMessage(async (loudnessDb) => {
    await handleLoudnessMessage(loudnessDb);
  });
}

/**
 * Process incoming loudness value
 */
async function handleLoudnessMessage(loudnessDb) {
  audio.lastLoudnessDb = loudnessDb;

  const snapshot = audio.computeNormalization(loudnessDb, userTargetDb);
  lastSnapshot = snapshot;
  stats.update(snapshot, userTargetDb, normalizationEnabled);

  // If audio isn't ready, wait for a gesture to unlock it
  if (!audio.isUnlocked) return;

  const video = document.querySelector("video");
  if (!video || !video.currentSrc) return;

  try {
    const wired = await audio.wireVideo(video);
    if (!wired) return;

    audio.applyGain(normalizationEnabled ? snapshot.gainLinear : 1);
  } catch (err) {
    error("Failed to apply gain:", err.message);
  }
}

// ============================================================================
// Storage Handling
// ============================================================================

/**
 * Handle storage changes from options page
 */
function setupStorageListeners() {
  MessageHandler.onStorageChange(async (settings) => {
    normalizationEnabled = settings.enabled;
    userTargetDb = settings.targetDb;

    log("Settings updated:", {
      enabled: normalizationEnabled,
      targetDb: userTargetDb,
      preset: settings.preset,
    });

    // Reapply normalization immediately if audio is available
    await reapplyNormalization();

    // Update stats display
    if (lastSnapshot) {
      stats.update(lastSnapshot, userTargetDb, normalizationEnabled);
    } else {
      stats.update(null, userTargetDb, normalizationEnabled);
    }
  });
}

/**
 * Recompute and apply gain with current loudness and target
 */
async function reapplyNormalization() {
  if (!Number.isFinite(audio.lastLoudnessDb)) return;

  const video = document.querySelector("video");
  if (!video || !video.currentSrc) return;

  try {
    const wired = await audio.wireVideo(video);
    if (!wired) return;

    if (!normalizationEnabled) {
      audio.applyGain(1);
      return;
    }

    if (!Number.isFinite(audio.lastLoudnessDb)) return;

    const snapshot = audio.computeNormalization(audio.lastLoudnessDb, userTargetDb);
    lastSnapshot = snapshot;
    audio.applyGain(snapshot.gainLinear);
  } catch (err) {
    error("Failed to reapply normalization:", err.message);
  }
}

// ============================================================================
// Audio Unlock
// ============================================================================

/**
 * Listen for user gestures to unlock audio
 */
function setupAudioUnlockListeners() {
  MessageHandler.onUserGesture(async () => {
    await handleAudioUnlock();
  });
}

/**
 * Attempt to unlock audio and apply normalization if ready
 */
async function handleAudioUnlock() {
  try {
    const unlocked = await audio.unlock();
    if (!unlocked) return;

    const video = document.querySelector("video");
    if (!video || !video.currentSrc) return;

    const wired = await audio.wireVideo(video);
    if (!wired) return;

    if (!normalizationEnabled) {
      audio.applyGain(1);
      return;
    }

    if (!Number.isFinite(audio.lastLoudnessDb)) return;

    const snapshot = audio.computeNormalization(audio.lastLoudnessDb, userTargetDb);
    lastSnapshot = snapshot;
    audio.applyGain(snapshot.gainLinear);
  } catch (err) {
    error("Audio unlock failed:", err.message);
  }
}

// ============================================================================
// Stats Display
// ============================================================================

/**
 * Set up observer for nerd stats container
 */
function setupStatsObserver() {
  stats.observeContainer(() => {
    if (lastSnapshot) {
      stats.update(lastSnapshot, userTargetDb, normalizationEnabled);
    } else {
      stats.update(null, userTargetDb, normalizationEnabled);
    }
  });

  // Initial attempt to display stats if container already exists
  if (lastSnapshot) {
    stats.scheduleUpdate(() => {
      stats.update(lastSnapshot, userTargetDb, normalizationEnabled);
    });
  }
}

// ============================================================================
// Start
// ============================================================================

void init();
