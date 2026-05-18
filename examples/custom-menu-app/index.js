"use strict";

const path = require("node:path");
const { AppWindow } = require("../..");

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

window.loadFile(path.join(__dirname, "index.html"));

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
