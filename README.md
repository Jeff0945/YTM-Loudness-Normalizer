# YTM Loudness Normalizer

Normalize YouTube Music playback loudness to your preferred target level.

This browser extension reads YouTube Music loudness metadata and applies a gain correction in real time using the Web Audio API.

## Features

- Normalize playback toward a chosen loudness target
- Presets:
  - Aggressive (`-7 dB`)
  - Loud (`-11 dB`)
  - Balanced (`-14 dB`, default)
  - Quiet (`-19 dB`)
  - Custom (`-60 dB` to `-7 dB`)
- Instant enable/disable toggle
- Live updates when settings change
- "Nerd stats" overlay rows for:
  - Extension status
  - Post-YouTube loudness
  - Target loudness
  - Applied gain

## How it works

1. A page-injected script (`src/content/inject.js`) observes YouTube Music network responses (`fetch` and `XMLHttpRequest`) and extracts `loudnessDb`.
2. The content script (`src/content/content.js`) receives loudness messages and computes normalization values.
3. The audio engine (`src/content/audio-normalizer.js`) wires the page `<video>` element into an `AudioContext` + `GainNode` graph.
4. Gain is smoothed with `setTargetAtTime` for less abrupt changes.
5. Settings are persisted in extension storage and updated live from the options page.

Normalization snapshot logic is based on:

- `postYtDb = min(-7, loudnessDb - 7)`
- `adjustmentDb = targetDb - postYtDb`
- `gainLinear = clamp(10^(adjustmentDb/20), 0.01, 4.0)`

## Project structure

- `src/content/content.js` — main orchestration
- `src/content/inject.js` — loudness extraction hook
- `src/content/audio-normalizer.js` — audio graph and gain application
- `src/content/message-handler.js` — storage + message handling
- `src/content/stats-overlay.js` — YouTube Music nerd stats integration
- `src/options/options.html` — options UI
- `src/options/options.js` — options logic
- `src/manifest-chrome.json` — Chrome MV3 manifest
- `src/manifest-firefox.json` — Firefox MV3 manifest
- `webpack.config.cjs` — dual build output (`dist/chrome`, `dist/firefox`)

## Requirements

- Node.js (current LTS recommended)
- npm
- Chrome and/or Firefox for loading the unpacked extension

## Install dependencies

```bat
npm install
```

## Development

Build once:

```bat
npm run build
```

Watch mode:

```bat
npm run dev
```

Lint:

```bat
npm run lint
```

Format:

```bat
npm run format
```

## Build output

After build, extension artifacts are generated in:

- `dist/chrome`
- `dist/firefox`

## Load unpacked extension

### Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/chrome`

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/firefox/manifest.json`

## Packaging

Create zip files for both browsers:

```bat
npm run zip
```

Or individually:

```bat
npm run zip:chrome
npm run zip:firefox
```

Release helpers (version bump + build + zip):

```bat
npm run release:patch
npm run release:minor
npm run release:major
```

## Permissions

From manifests (`src/manifest-chrome.json`, `src/manifest-firefox.json`):

- `storage` — persist user settings
- Host permission: `https://music.youtube.com/*` — run on YouTube Music pages only

## Notes / limitations

- Extension logic relies on YouTube Music response shapes containing `loudnessDb`; upstream changes may affect detection.
- Audio processing starts after a user gesture when required by browser autoplay/audio policies.
- Gain is clamped to avoid extreme amplification/attenuation.

## License

See `LICENSE`.
