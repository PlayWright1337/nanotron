# NanoTron

Tiny Electron-like desktop framework for Node.js powered by the system WebView.

NanoTron lets you build desktop apps with HTML, CSS, and JavaScript while keeping the runtime small. Instead of bundling Chromium, it uses Microsoft Edge WebView2 on Windows, WKWebView on macOS, and WebKitGTK on Linux.

## Status

NanoTron is an early MVP. The public API is already usable for experiments, internal tools, prototypes, and small desktop products. The project currently focuses on Windows first because the packaged WebView2 loader and frameless window controls are implemented there.

## Features

- Native desktop window from Node.js
- Local HTML, inline HTML, and remote URL loading
- RPC bridge from WebView JavaScript to Node.js with `window.bind`
- JavaScript execution from Node.js into the WebView
- Frameless Windows windows with custom HTML titlebars
- Window controls for minimize, maximize, restore, drag, close, and destroy
- WebView2 loader discovery for x64, arm64, and x86
- Windows single executable packaging through Node SEA
- Copyable examples for basic windows, notes, custom chrome, and food ordering

## Installation

From this repository:

```bash
npm install
npm run build
npm run example
```

From another local project:

```bash
npm install ../nanotron
```

When published to npm:

```bash
npm install nanotron
```

## Requirements

- Node.js 18 or newer for development
- Native build tools supported by `node-gyp`
- Windows 10/11 with Microsoft Edge WebView2 Runtime
- macOS with WebKit
- Linux with GTK 3 and WebKitGTK 4

Users of a packaged Windows executable do not need Node.js installed. They still need Microsoft Edge WebView2 Runtime because NanoTron intentionally uses the system WebView.

## Quick Start

```javascript
"use strict";

const path = require("node:path");
const { AppWindow } = require("nanotron");

const window = new AppWindow({
  title: "My App",
  width: 900,
  height: 640,
  resizable: true
});

window.loadFile(path.join(__dirname, "index.html"));

window.bind("getSystemInfo", () => ({
  platform: process.platform,
  arch: process.arch,
  node: process.version
}));

window.show();
```

Inside `index.html`:

```html
<main id="app"></main>
<script>
  async function renderSystemInfo() {
    const systemInfo = await window.getSystemInfo();
    document.getElementById("app").textContent = JSON.stringify(systemInfo, null, 2);
  }

  renderSystemInfo();
</script>
```

## Examples

```bash
npm run example
npm run example:notes
npm run example:menu
npm run example:food
```

The food ordering example is the densest app-style demo. It includes a custom titlebar, menu catalog, cart, checkout form, order history, and Node-side order handling.

## API

### `new AppWindow(options)`

Creates a native window.

```javascript
const window = new AppWindow({
  title: "App",
  width: 900,
  height: 640,
  resizable: true,
  debug: false,
  frameless: false
});
```

Options:

| Name | Type | Default |
| --- | --- | --- |
| `title` | `string` | `"NanoTron"` |
| `width` | `number` | `800` |
| `height` | `number` | `600` |
| `resizable` | `boolean` | `true` |
| `debug` | `boolean` | `false` |
| `frameless` | `boolean` | `false` |
| `frame` | `boolean` | `true` |

`frame: false` is accepted as an Electron-style alias for `frameless: true`.

### `window.loadURL(url)`

Loads a remote or local URL.

```javascript
window.loadURL("http://localhost:5173");
```

### `window.loadFile(filePath)`

Loads a local HTML file.

```javascript
window.loadFile(path.join(__dirname, "index.html"));
```

### `window.loadHTML(html)`

Loads an inline HTML string.

```javascript
window.loadHTML("<h1>Hello</h1>");
```

### `window.navigate(content)`

Loads HTML when the string starts with markup, otherwise treats the string as a URL.

```javascript
window.navigate("https://example.com");
window.navigate("<h1>Hello</h1>");
```

### `window.setTitle(title)`

Changes the native window title.

```javascript
window.setTitle("Updated title");
```

### `window.webContents.executeJavaScript(code)`

Runs JavaScript inside the WebView.

```javascript
window.webContents.executeJavaScript("document.body.dataset.ready = 'true'");
```

### `window.bind(name, handler)`

Exposes a Node.js function to the frontend as `window[name]`.

```javascript
window.bind("readConfig", () => ({
  theme: "dark",
  locale: "en"
}));
```

Frontend:

```html
<script>
  async function main() {
    const config = await window.readConfig();
    console.log(config);
  }

  main();
</script>
```

Handlers must return synchronously in the current MVP. Return strings, numbers, booleans, arrays, objects, or `null`.

### `window.unbind(name)`

Removes a frontend binding.

```javascript
window.unbind("readConfig");
```

### Window Lifecycle

```javascript
window.show();
window.runLoop();
window.close();
window.destroy();
```

`show` and `runLoop` start the native GUI loop and block the Node.js thread until the window closes. `close` asks the active loop to exit. `destroy` releases the native window immediately.

### Window Controls

```javascript
window.minimize();
window.maximize();
window.restore();
window.toggleMaximize();
window.isMaximized();
window.beginDrag();
```

These methods are useful for frameless windows with custom HTML titlebars.

## Custom Menus And Buttons

NanoTron does not expose Electron's native `Menu` APIs yet. The production-friendly pattern today is to render menus and window controls in HTML, then route commands into Node.js with `bind`.

Node.js:

```javascript
const window = new AppWindow({
  title: "Custom Chrome",
  width: 980,
  height: 680,
  frameless: true
});

window.bind("minimizeWindow", () => {
  window.minimize();
  return true;
});

window.bind("toggleMaximizeWindow", () => {
  return window.toggleMaximize();
});

window.bind("beginWindowDrag", () => {
  window.beginDrag();
  return true;
});

window.bind("closeWindow", () => {
  window.close();
  return true;
});
```

Frontend:

```html
<header id="titlebar">
  <button type="button" id="minimize-button">-</button>
  <button type="button" id="maximize-button">□</button>
  <button type="button" id="close-button">×</button>
</header>
<script>
  document.getElementById("minimize-button").addEventListener("click", () => window.minimizeWindow());
  document.getElementById("maximize-button").addEventListener("click", () => window.toggleMaximizeWindow());
  document.getElementById("close-button").addEventListener("click", () => window.closeWindow());
  document.getElementById("titlebar").addEventListener("mousedown", (event) => {
    if (event.button === 0 && !event.target.closest("button")) {
      window.beginWindowDrag();
    }
  });
</script>
```

See `examples/custom-menu-app` for a complete copyable implementation.

## Project Structure

```text
nanotron/
├─ lib/
│  └─ index.js
├─ src/
│  ├─ addon.cpp
│  ├─ webview.h
│  ├─ webview/
│  └─ webview2/
├─ vendor/
│  └─ webview2/
├─ examples/
│  ├─ basic-app/
│  ├─ notes-app/
│  ├─ custom-menu-app/
│  └─ food-order-app/
├─ scripts/
│  └─ package-menu-win.js
├─ docs/
│  └─ TEAM_GUIDE.md
├─ binding.gyp
└─ package.json
```

`lib/index.js` is the public JavaScript API. It validates input, loads the native addon, configures the WebView2 loader path on Windows, and exposes `AppWindow`.

`src/addon.cpp` is the Node-API bridge. It wraps `webview_t`, forwards lifecycle calls, and connects frontend RPC calls to Node.js handlers.

`src/webview` contains the vendored upstream `webview` headers. `src/webview2` contains Microsoft WebView2 headers. `vendor/webview2` contains loader DLLs needed by Windows builds.

## Building A Windows EXE

NanoTron can package the custom menu example as a Windows executable with Node.js embedded through Node SEA.

```bash
npm run package:menu:win
```

Output:

```text
dist/standalone/nanotron-menu.exe
```

The packaging script embeds:

| Asset | Purpose |
| --- | --- |
| `node.exe` | Embedded Node.js runtime |
| `nanotron.node` | Native NanoTron addon |
| `WebView2Loader.dll` | Microsoft WebView2 loader |
| `custom-menu-index.html` | Application UI |
| `nanotron-lib.js` | NanoTron JavaScript API |

Native addons and loader DLLs are extracted to the user's temp directory at startup because Windows cannot load native dynamic libraries directly from SEA memory assets.

## Connecting Existing Sources

You can migrate an existing HTML/CSS/JS application into NanoTron:

1. Put frontend files into an app folder.
2. Create a Node.js entry file.
3. Open the entry HTML with `window.loadFile`.
4. Replace Electron-specific APIs with `window.bind` calls.
5. Keep privileged logic on the Node.js side.

For Vite, React, Vue, Svelte, or another frontend stack, use the dev server during development:

```javascript
window.loadURL("http://localhost:5173");
```

For production, build the frontend and load the generated `index.html`.

## Team Guide

Detailed onboarding notes for developers are in `docs/TEAM_GUIDE.md`.

## License

MIT
