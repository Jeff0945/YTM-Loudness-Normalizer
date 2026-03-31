(function () {
    if (window.__ytm_fetch_hooked) return;
    window.__ytm_fetch_hooked = true;

    let lastLoudness;

    function postLoudness(value) {
        if (!Number.isFinite(value)) return;
        if (value === lastLoudness) return;
        lastLoudness = value;

        window.postMessage(
            {
                type: "YTM_LOUDNESS",
                value: value
            },
            window.location.origin
        );
    }

    function extractLoudness(data) {
        const loudness = data?.playerConfig?.audioConfig?.loudnessDb ?? undefined;

        if (typeof loudness === 'number') {
            postLoudness(loudness);
        }
    }

    function tryParseAndExtract(text) {
        if (typeof text !== "string") return;
        if (!text.includes("\"loudnessDb\"")) return;

        try {
            const data = JSON.parse(text);
            extractLoudness(data);
        } catch (err) {
            // Ignore non-JSON payloads.
        }
    }

    // Hook fetch while preserving native behavior.
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const p = originalFetch.apply(this, args);

        p.then((response) => {
            try {
                const clone = response.clone();
                clone.text().then(tryParseAndExtract).catch(function () {});
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
    }

    xhrProto.send = function () {
        this.addEventListener("loadend", function () {
            try {
                if (this.readyState !== 4) return;
                if (this.responseType && this.responseType !== "text") return;
                if (typeof this.responseText !== "string") return;

                tryParseAndExtract(this.responseText);
            } catch (err) {}
        });

        return originalSend.apply(this, arguments);
    }
})();