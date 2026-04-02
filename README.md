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
- Nerd stats overlay rows for:
  - Extension status
  - Post-YouTube loudness
  - Target loudness
  - Applied gain

## How it works

1. A page-injected script (`src/content/inject.js`) hooks `fetch` and `XMLHttpRequest` responses and extracts `loudnessDb`.
2. The main content script (`src/content/content.js`) receives loudness messages and computes normalization values.
3. The audio engine (`src/content/audio-normalizer.js`) wires the page `<video>` element into an `AudioContext` + `GainNode` graph.
4. Gain is smoothed with `setTargetAtTime` to reduce abrupt changes.
5. Settings are stored in extension storage and updated live from the options page.

Normalization logic is based on:

- `postYtDb = min(-7, loudnessDb - 7)`
- `adjustmentDb = targetDb - postYtDb`
- `gainLinear = clamp(10^(adjustmentDb/20), 0.01, 4.0)`

## Project structure

- `src/content/content.js` — main orchestration
- `src/content/inject.js` — loudness extraction hook
- `src/content/audio-normalizer.js` — audio graph and gain application
- `src/content/message-handler.js` — storage + message handling
- `src/content/stats-overlay.js` — YouTube Music nerd stats integration
- `src/content/constants.js` — shared constants
- `src/content/utils.js` — logging, formatting, and math helpers
- `src/options/options.html` — options UI
- `src/options/options.js` — options logic
- `src/options/options.css` — options page styling
- `src/manifest-chrome.json` — Chrome MV3 manifest
- `src/manifest-firefox.json` — Firefox MV3 manifest
- `webpack.config.cjs` — dual build output (`dist/chrome`, `dist/firefox`)

## Requirements

### Supported operating systems

This project can be built on:

- Windows 10 / Windows 11
- macOS
- Linux

### Build environment

You will need:

- Node.js
- npm (included with Node.js)
- A terminal / command prompt
- Chrome and/or Firefox for loading and testing the unpacked extension

### Required program version

#### Node.js

Install a current **Node.js LTS** release.

Recommended version:
- Use the latest available LTS version for your platform

Installation:
- Download Node.js from https://nodejs.org/
- Install the LTS version
- Verify the installation:

```bat
node -v
npm -v
```

If Node.js and npm print version numbers, your build environment is ready.

## Step-by-step build instructions

Follow these steps to build an exact local copy of the extension from source:

1. **Get the source code**
    - Clone or download this repository.
    - Make sure the root folder contains `package.json`, `webpack.config.cjs`, and the `src/` directory.

2. **Install dependencies**
    - Open a terminal in the project root.
    - Run:

```bat
npm install
```

3. **Build the extension**
    - Run the main build script:

```bat
npm run build
```

This generates browser-specific output in:
- `dist/chrome`
- `dist/firefox`

4. **Package the built extension**
    - Run the packaging script to create release archives:

```bat
npm run zip
```

This creates zip files under `dist/`.

5. **Load the unpacked extension**
    - Chrome: load the `dist/chrome` folder as an unpacked extension.
    - Firefox: load `dist/firefox/manifest.json` as a temporary add-on.

## Build scripts

The build process is defined in `package.json` and `webpack.config.cjs`.

### Main scripts

- `npm run build` — compiles the extension into browser-specific `dist/` folders
- `npm run zip` — packages both browser builds into zip archives
- `npm run release:build` — runs the full build + packaging flow

### Browser-specific packaging

- `npm run zip:chrome`
- `npm run zip:firefox`

### Version bump helpers

- `npm run release:patch`
- `npm run release:minor`
- `npm run release:major`

If you want a single command that performs the full technical build and packaging process, use:

```bat
npm run release:build
```

## Development commands

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

After building, the generated extension files are placed here:

- `dist/chrome`
- `dist/firefox`

Each build contains:

- a browser-specific `manifest.json`
- the compiled content scripts
- the injected script
- the options page assets

## Load the extension

### Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/chrome` folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/firefox/manifest.json`

## Permissions

From the manifests (`src/manifest-chrome.json`, `src/manifest-firefox.json`):

- `storage` — persist user settings
- `https://music.youtube.com/*` host permission — run on YouTube Music pages only

## Notes and limitations

- The extension relies on YouTube Music response payloads containing `loudnessDb`; upstream changes may affect detection.
- Audio processing starts after a user gesture when required by browser autoplay policies.
- Gain is clamped to avoid extreme amplification or attenuation.
- The Firefox build includes a `browser_specific_settings.gecko.id` entry in `src/manifest-firefox.json`.

## Troubleshooting

### `node` or `npm` is not recognized
Install Node.js from https://nodejs.org/ and reopen your terminal.

### Build succeeds but the extension does not appear to work
- Make sure you loaded the built output from `dist/chrome` or `dist/firefox`
- Reload the extension after rebuilding
- Open YouTube Music in a tab that matches `https://music.youtube.com/*`

### No loudness values appear
- The extension depends on YouTube Music network responses that include loudness metadata
- Try reloading the page and starting playback again

## License

See `LICENSE`.