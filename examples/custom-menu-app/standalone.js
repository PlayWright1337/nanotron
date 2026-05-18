"use strict";

const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { getRawAsset } = require("node:sea");

const runtimeDirectory = path.join(os.tmpdir(), "nanotron-custom-menu");
const nativeAddonPath = path.join(runtimeDirectory, "nanotron.node");
const nanotronLibraryPath = path.join(runtimeDirectory, "nanotron-lib.js");
const webView2LoaderPath = path.join(runtimeDirectory, "WebView2Loader.dll");
const htmlPath = path.join(runtimeDirectory, "index.html");

fs.mkdirSync(runtimeDirectory, { recursive: true });
writeAsset("nanotron.node", nativeAddonPath);
writeAsset("nanotron-lib.js", nanotronLibraryPath);
writeAsset("WebView2Loader.dll", webView2LoaderPath);
writeAsset("custom-menu-index.html", htmlPath);

process.env.NANOTRON_WEBVIEW2_LOADER_DIR = runtimeDirectory;
process.env.NANOTRON_NATIVE_ADDON_PATH = nativeAddonPath;

const runtimeRequire = createRequire(path.join(runtimeDirectory, "standalone.js"));
const { AppWindow } = runtimeRequire("./nanotron-lib.js");

const applicationState = {
  theme: "dark",
  documentName: "Untitled",
  savedAt: null
};

const window = new AppWindow({
  title: "NanoTron Custom Menu",
  width: 980,
  height: 680,
  resizable: true,
  frameless: true
});

window.loadFile(htmlPath);

window.bind("getApplicationState", () => applicationState);

window.bind("setDocumentName", (documentName) => {
  const normalizedDocumentName = String(documentName).trim() || "Untitled";
  applicationState.documentName = normalizedDocumentName;
  window.setTitle(`NanoTron Custom Menu - ${normalizedDocumentName}`);
  return applicationState;
});

window.bind("saveDocument", (content) => {
  applicationState.savedAt = new Date().toISOString();
  applicationState.lastContentLength = String(content).length;
  return applicationState;
});

window.bind("toggleTheme", () => {
  applicationState.theme = applicationState.theme === "dark" ? "light" : "dark";
  return applicationState;
});

window.bind("showAbout", () => ({
  name: "NanoTron Custom Menu",
  version: "0.1.0",
  platform: process.platform,
  arch: process.arch
}));

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

window.show();

function writeAsset(assetName, targetPath) {
  fs.writeFileSync(targetPath, new Uint8Array(getRawAsset(assetName)));
}
