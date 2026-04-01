/**
 * Utility functions for logging, formatting, and math
 */

import { LOG_PREFIX } from "./constants.js";

/**
 * Log with consistent prefix
 */
export function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

/**
 * Log warning with consistent prefix
 */
export function warn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

/**
 * Log error with consistent prefix
 */
export function error(...args) {
  console.error(LOG_PREFIX, ...args);
}

/**
 * Format a dB value to 1 decimal place or "--"
 */
export function formatDb(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

/**
 * Format a linear gain as a percentage
 */
export function formatGain(value) {
  return Number.isFinite(value) ? (value * 100).toFixed(0) : "--";
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert linear gain to dB
 */
export function linearToDb(linear) {
  return 20 * Math.log10(linear);
}

/**
 * Convert dB to linear gain
 */
export function dbToLinear(db) {
  return Math.pow(10, db / 20);
}
