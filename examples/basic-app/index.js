"use strict";

const path = require("node:path");
const { AppWindow } = require("../..");

const window = new AppWindow({
  title: "NanoTron Basic App",
  width: 800,
  height: 600,
  resizable: true
});

window.loadFile(path.join(__dirname, "index.html"));

window.bind("getSystemInfo", () => ({
  platform: process.platform,
  arch: process.arch,
  node: process.version
}));

window.show();
