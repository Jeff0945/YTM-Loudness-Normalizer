(function () {
  if (window.__ytm_fetch_hooked) return;
  window.__ytm_fetch_hooked = true;

  let lastLoudness;

  const LOUDNESS_RE = /"loudnessDb"\s*:\s*(-?\d+(?:\.\d+)?)/;
  const URL_HINT_RE = /(youtubei\/v1\/player|youtubei\/v1\/next|watch|player)/i;
  const MAX_PARSE_BYTES = 1_500_000; // skip huge payload parse to reduce jank

  function postLoudness(value) {
    if (!Number.isFinite(value)) return;
    if (value === lastLoudness) return;
    lastLoudness = value;

    window.postMessage(
      {
        type: "YTM_LOUDNESS",
        value: value,
      },
      window.location.origin,
    );
  }

  function findLoudnessDeep(root) {
    if (!root || typeof root !== "object") return undefined;

    const stack = [root];
    let visited = 0;
    const VISIT_LIMIT = 5000;

    while (stack.length && visited < VISIT_LIMIT) {
      const node = stack.pop();
      visited++;

      if (!node || typeof node !== "object") continue;

      if (typeof node.loudnessDb === "number") {
        return node.loudnessDb;
      }

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) stack.push(node[i]);
      } else {
        for (const key in node) stack.push(node[key]);
      }
    }

    return undefined;
  }

  function stripXssiPrefix(text) {
    // Common YouTube prefix: )]}'
    if (text.startsWith(")]}'")) {
      const nl = text.indexOf("\n");
      if (nl !== -1) return text.slice(nl + 1);
    }
    return text;
  }

  function extractFromTextFast(text) {
    const m = LOUDNESS_RE.exec(text);
    if (!m) return false;
    postLoudness(Number(m[1]));
    return true;
  }

  function parseAndExtract(text) {
    if (typeof text !== "string") return;
    if (!text.includes('"loudnessDb"')) return;

    // Fast path first: avoid full parse for common case.
    if (extractFromTextFast(text)) return;

    if (text.length > MAX_PARSE_BYTES) return;

    // Yield before heavier work to reduce UI contention.
    setTimeout(() => {
      try {
        const cleaned = stripXssiPrefix(text);
        const data = JSON.parse(cleaned);
        const loudness = findLoudnessDeep(data);
        if (typeof loudness === "number") {
          postLoudness(loudness);
        }
      } catch (err) {
        // Ignore non-JSON payloads.
      }
    }, 0);
  }

  function shouldInspect(url, contentType) {
    const u = String(url || "");
    const ct = String(contentType || "").toLowerCase();

    if (URL_HINT_RE.test(u)) return true;

    return ct.includes("application/json");
  }

  // Hook fetch while preserving native behavior.
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const p = originalFetch.apply(this, args);

    p.then((response) => {
      try {
        const url = response && response.url;
        const contentType =
          response && response.headers
            ? response.headers.get("content-type")
            : "";

        if (!shouldInspect(url, contentType)) return;

        const clone = response.clone();
        clone
          .text()
          .then(parseAndExtract)
          .catch(function () {});
      } catch (err) {}
    }).catch(function () {});

    return p;
  };

  // Patch XHR prototype methods instead of replacing constructor.
  const xhrProto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (!xhrProto) return;

  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;

  xhrProto.open = function (method, url) {
    this.__ytm_url = url;
    return originalOpen.apply(this, arguments);
  };

  xhrProto.send = function () {
    this.addEventListener("loadend", function () {
      try {
        if (this.readyState !== 4) return;

        const contentType = this.getResponseHeader
          ? this.getResponseHeader("content-type")
          : "";

        if (!shouldInspect(this.__ytm_url, contentType)) return;

        if (
          this.responseType === "json" &&
          this.response &&
          typeof this.response === "object"
        ) {
          const loudness = findLoudnessDeep(this.response);
          if (typeof loudness === "number") postLoudness(loudness);
          return;
        }

        if (
          this.responseType &&
          this.responseType !== "text" &&
          this.responseType !== ""
        )
          return;
        if (typeof this.responseText !== "string") return;

        parseAndExtract(this.responseText);
      } catch (err) {}
    });

    return originalSend.apply(this, arguments);
  };
})();
