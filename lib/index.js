"use strict";

const path = require("node:path");

const DEFAULT_WINDOW_TITLE = "NanoTron";
const DEFAULT_WINDOW_WIDTH = 800;
const DEFAULT_WINDOW_HEIGHT = 600;
const MINIMUM_WINDOW_SIZE = 1;
const HTML_PREFIX_PATTERN = /^\s*</u;
const FILE_URL_PREFIX = "file://";
const WINDOWS_PLATFORM = "win32";
const WINDOWS_X64_ARCHITECTURE = "x64";
const WINDOWS_ARM64_ARCHITECTURE = "arm64";
const WINDOWS_IA32_ARCHITECTURE = "ia32";
const WINDOWS_X64_LOADER_DIRECTORY = "win-x64";
const WINDOWS_ARM64_LOADER_DIRECTORY = "win-arm64";
const WINDOWS_X86_LOADER_DIRECTORY = "win-x86";

class NanotronError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

class NativeAddonLoadError extends NanotronError {}

class WindowLifecycleError extends NanotronError {}

class WindowValidationError extends NanotronError {}

const nativeAddon = loadNativeAddon();

class AppWindow {
  constructor(options = {}) {
    const normalizedOptions = normalizeWindowOptions(options);
    this.nativeWindow = new nativeAddon.NativeWindow(normalizedOptions);
    this.destroyed = false;
    this.webContents = {
      executeJavaScript: (code) => this.executeJavaScript(code)
    };
  }

  setTitle(title) {
    this.ensureAlive();
    this.nativeWindow.setTitle(normalizeString(title, "title"));
    return this;
  }

  loadURL(url) {
    this.ensureAlive();
    this.nativeWindow.loadURL(normalizeString(url, "url"));
    return this;
  }

  loadFile(filePath) {
    const absolutePath = path.resolve(normalizeString(filePath, "filePath"));
    return this.loadURL(`${FILE_URL_PREFIX}${absolutePath.replaceAll("\\", "/")}`);
  }

  loadHTML(html) {
    this.ensureAlive();
    this.nativeWindow.loadHTML(normalizeString(html, "html"));
    return this;
  }

  navigate(content) {
    const normalizedContent = normalizeString(content, "content");
    return HTML_PREFIX_PATTERN.test(normalizedContent)
      ? this.loadHTML(normalizedContent)
      : this.loadURL(normalizedContent);
  }

  executeJavaScript(code) {
    this.ensureAlive();
    this.nativeWindow.executeJavaScript(normalizeString(code, "code"));
    return this;
  }

  minimize() {
    this.ensureAlive();
    this.nativeWindow.minimize();
    return this;
  }

  maximize() {
    this.ensureAlive();
    this.nativeWindow.maximize();
    return this;
  }

  restore() {
    this.ensureAlive();
    this.nativeWindow.restore();
    return this;
  }

  toggleMaximize() {
    this.ensureAlive();
    return this.nativeWindow.toggleMaximize();
  }

  isMaximized() {
    this.ensureAlive();
    return this.nativeWindow.isMaximized();
  }

  beginDrag() {
    this.ensureAlive();
    this.nativeWindow.beginDrag();
    return this;
  }

  bind(name, handler) {
    this.ensureAlive();
    const bindingName = normalizeBindingName(name);

    if (typeof handler !== "function") {
      throw new WindowValidationError("Binding handler must be a function");
    }

    this.nativeWindow.bind(bindingName, (serializedArguments) => {
      const parsedArguments = parseBindingArguments(serializedArguments, bindingName);
      const result = handler(...parsedArguments);

      if (isPromiseLike(result)) {
        throw new WindowValidationError(`Binding "${bindingName}" returned a Promise while the native loop is blocking`);
      }

      return JSON.stringify(result ?? null);
    });

    return this;
  }

  unbind(name) {
    this.ensureAlive();
    this.nativeWindow.unbind(normalizeBindingName(name));
    return this;
  }

  show() {
    this.ensureAlive();
    this.nativeWindow.runLoop();
    this.destroyed = true;
    return this;
  }

  runLoop() {
    return this.show();
  }

  close() {
    if (!this.destroyed) {
      this.nativeWindow.close();
    }

    return this;
  }

  destroy() {
    if (!this.destroyed) {
      this.nativeWindow.destroy();
      this.destroyed = true;
    }

    return this;
  }

  ensureAlive() {
    if (this.destroyed) {
      throw new WindowLifecycleError("Window has already been destroyed");
    }
  }
}

let defaultWindow = null;

function createWindow(title = DEFAULT_WINDOW_TITLE, width = DEFAULT_WINDOW_WIDTH, height = DEFAULT_WINDOW_HEIGHT, resizable = true) {
  defaultWindow = new AppWindow({ title, width, height, resizable });
  return defaultWindow;
}

function navigate(content) {
  return requireDefaultWindow().navigate(content);
}

function runLoop() {
  return requireDefaultWindow().runLoop();
}

function normalizeWindowOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new WindowValidationError("Window options must be an object");
  }

  return {
    title: normalizeOptionalString(options.title, DEFAULT_WINDOW_TITLE, "title"),
    width: normalizeDimension(options.width, DEFAULT_WINDOW_WIDTH, "width"),
    height: normalizeDimension(options.height, DEFAULT_WINDOW_HEIGHT, "height"),
    resizable: options.resizable ?? true,
    debug: options.debug ?? false,
    frameless: normalizeFramelessOption(options)
  };
}

function normalizeFramelessOption(options) {
  if (options.frameless !== undefined) {
    return Boolean(options.frameless);
  }

  if (options.frame !== undefined) {
    return !Boolean(options.frame);
  }

  return false;
}

function normalizeDimension(value, fallback, name) {
  const candidate = value ?? fallback;

  if (!Number.isInteger(candidate) || candidate < MINIMUM_WINDOW_SIZE) {
    throw new WindowValidationError(`${name} must be a positive integer`);
  }

  return candidate;
}

function normalizeOptionalString(value, fallback, name) {
  return value === undefined ? fallback : normalizeString(value, name);
}

function normalizeString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new WindowValidationError(`${name} must be a non-empty string`);
  }

  return value;
}

function normalizeBindingName(name) {
  const bindingName = normalizeString(name, "name");

  if (!/^[A-Za-z_$][\w$]*$/u.test(bindingName)) {
    throw new WindowValidationError("Binding name must be a valid JavaScript identifier");
  }

  return bindingName;
}

function parseBindingArguments(serializedArguments, bindingName) {
  try {
    const parsedArguments = JSON.parse(serializedArguments);

    if (!Array.isArray(parsedArguments)) {
      throw new WindowValidationError(`Binding "${bindingName}" received invalid arguments`);
    }

    return parsedArguments;
  } catch (error) {
    if (error instanceof WindowValidationError) {
      throw error;
    }

    throw new WindowValidationError(`Binding "${bindingName}" received malformed JSON`, { cause: error });
  }
}

function isPromiseLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.then === "function");
}

function requireDefaultWindow() {
  if (!defaultWindow) {
    throw new WindowLifecycleError("Window has not been created");
  }

  return defaultWindow;
}

function loadNativeAddon() {
  ensureWebView2LoaderPath();

  const addonPaths = [
    process.env.NANOTRON_NATIVE_ADDON_PATH,
    path.join(__dirname, "..", "build", "Release", "nanotron.node"),
    path.join(__dirname, "..", "build", "Debug", "nanotron.node")
  ].filter(Boolean);
  const errors = [];

  for (const addonPath of addonPaths) {
    try {
      return require(addonPath);
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND" && error?.code !== "ERR_DLOPEN_FAILED") {
        throw error;
      }

      errors.push(error);
    }
  }

  throw new NativeAddonLoadError("Native addon is not built. Run npm install or npm run build.", { cause: errors.at(-1) });
}

function ensureWebView2LoaderPath() {
  if (process.platform !== WINDOWS_PLATFORM) {
    return;
  }

  const loaderDirectory = process.env.NANOTRON_WEBVIEW2_LOADER_DIR
    ?? path.join(__dirname, "..", "vendor", "webview2", getWindowsLoaderDirectoryName(process.arch));
  const currentPath = process.env.PATH ?? "";
  const pathEntries = currentPath.split(path.delimiter).filter(Boolean);

  if (!pathEntries.includes(loaderDirectory)) {
    process.env.PATH = [loaderDirectory, ...pathEntries].join(path.delimiter);
  }
}

function getWindowsLoaderDirectoryName(architecture) {
  if (architecture === WINDOWS_X64_ARCHITECTURE) {
    return WINDOWS_X64_LOADER_DIRECTORY;
  }

  if (architecture === WINDOWS_ARM64_ARCHITECTURE) {
    return WINDOWS_ARM64_LOADER_DIRECTORY;
  }

  if (architecture === WINDOWS_IA32_ARCHITECTURE) {
    return WINDOWS_X86_LOADER_DIRECTORY;
  }

  throw new NativeAddonLoadError(`Unsupported Windows architecture: ${architecture}`);
}

module.exports = {
  AppWindow,
  NanotronError,
  NativeAddonLoadError,
  WindowLifecycleError,
  WindowValidationError,
  createWindow,
  navigate,
  runLoop
};
