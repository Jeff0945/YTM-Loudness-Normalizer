/**
 * Nerd stats overlay display and updates
 */

import { DOM_IDS, DOM_LABELS } from "./constants.js";
import { formatDb, formatGain } from "./utils.js";

export class StatsOverlay {
  constructor() {
    this.updateScheduled = false;
    this.lastSnapshot = null;
  }

  /**
   * Find the ytmusic-nerd-stats container
   */
  findContainer() {
    return document.querySelector("ytmusic-nerd-stats");
  }

  /**
   * Ensure a label/value row exists in the stats container
   */
  ensureRow(container, idBase, labelText) {
    const labelId = `${idBase}-label`;
    const valueId = `${idBase}-value`;

    let label = container.querySelector(`#${labelId}`);
    if (!label) {
      label = document.createElement("div");
      label.id = labelId;
      label.className = "label style-scope ytmusic-nerd-stats";
      label.textContent = labelText;
      container.appendChild(label);
    }

    let value = container.querySelector(`#${valueId}`);
    if (!value) {
      value = document.createElement("div");
      value.id = valueId;
      value.className = "value style-scope ytmusic-nerd-stats";
      container.appendChild(value);
    }

    return { label, value };
  }

  /**
   * Ensure all extension stats rows exist
   */
  ensureAllRows(container) {
    return {
      divider: this.ensureRow(container, DOM_IDS.divider, DOM_LABELS.divider),
      status: this.ensureRow(container, DOM_IDS.status, DOM_LABELS.status),
      afterYt: this.ensureRow(container, DOM_IDS.afterYt, DOM_LABELS.afterYt),
      target: this.ensureRow(container, DOM_IDS.target, DOM_LABELS.target),
      gain: this.ensureRow(container, DOM_IDS.gain, DOM_LABELS.gain),
    };
  }

  /**
   * Update stats display with current snapshot
   */
  update(snapshot, userTargetDb) {
    const container = this.findContainer();
    if (!container) return;

    const rows = this.ensureAllRows(container);
    this.lastSnapshot = snapshot;

    if (!snapshot || !Number.isFinite(snapshot.postYtDb)) {
      rows.status.value.textContent = "Waiting for loudness data...";
      rows.afterYt.value.textContent = "-- dB";
      rows.target.value.textContent = `${formatDb(userTargetDb)} dB`;
      rows.gain.value.textContent = "--";
      return;
    }

    rows.divider.value.textContent = "";
    rows.status.value.textContent = "Enabled";
    rows.afterYt.value.textContent = `${formatDb(snapshot.postYtDb)} dB`;
    rows.target.value.textContent = `${formatDb(snapshot.targetDb)} dB`;
    rows.gain.value.textContent = `${formatGain(snapshot.gainLinear)}% (${formatDb(
      snapshot.gainDb
    )} dB)`;
  }

  /**
   * Schedule update using requestAnimationFrame to debounce
   */
  scheduleUpdate(callback) {
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateScheduled = false;
      callback();
    });
  }

  /**
   * Observe nerd stats container and trigger updates when it appears
   */
  observeContainer(onContainerAdded) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== Node.ELEMENT_NODE) continue;
          if (n.matches?.("ytmusic-nerd-stats") || n.querySelector?.("ytmusic-nerd-stats")) {
            onContainerAdded();
            return;
          }
        }
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          observer.observe(document.body, { childList: true, subtree: true });
        },
        { once: true }
      );
    }

    return observer;
  }
}
