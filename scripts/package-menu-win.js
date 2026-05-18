"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const distributionDirectory = path.join(projectRoot, "dist", "standalone");
const seaConfigPath = path.join(distributionDirectory, "sea-config.json");
const seaBlobPath = path.join(distributionDirectory, "nanotron-menu.blob");
const executablePath = path.join(distributionDirectory, "nanotron-menu.exe");
const nodeExecutablePath = process.execPath;
const postjectCliPath = path.join(projectRoot, "node_modules", "postject", "dist", "cli.js");
const currentArchitecture = process.arch;
const webView2LoaderName = getWebView2LoaderName(currentArchitecture);

fs.rmSync(distributionDirectory, { recursive: true, force: true });
fs.mkdirSync(distributionDirectory, { recursive: true });

const seaConfig = {
  main: path.join(projectRoot, "examples", "custom-menu-app", "standalone.js"),
  output: seaBlobPath,
  disableExperimentalSEAWarning: true,
  assets: {
    "nanotron.node": path.join(projectRoot, "build", "Release", "nanotron.node"),
    "nanotron-lib.js": path.join(projectRoot, "lib", "index.js"),
    "WebView2Loader.dll": path.join(projectRoot, "vendor", "webview2", webView2LoaderName, "WebView2Loader.dll"),
    "custom-menu-index.html": path.join(projectRoot, "examples", "custom-menu-app", "index.html")
  }
};

fs.writeFileSync(seaConfigPath, `${JSON.stringify(seaConfig, null, 2)}\n`);
execFileSync(nodeExecutablePath, ["--experimental-sea-config", seaConfigPath], { stdio: "inherit" });
fs.copyFileSync(nodeExecutablePath, executablePath);
execFileSync(nodeExecutablePath, [
  postjectCliPath,
  executablePath,
  "NODE_SEA_BLOB",
  seaBlobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
], { stdio: "inherit" });

console.log(executablePath);

function getWebView2LoaderName(architecture) {
  if (architecture === "x64") {
    return "win-x64";
  }

  if (architecture === "arm64") {
    return "win-arm64";
  }

  if (architecture === "ia32") {
    return "win-x86";
  }

  throw new Error(`Unsupported Windows architecture: ${architecture}`);
}
