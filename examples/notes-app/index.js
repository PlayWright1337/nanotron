"use strict";

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { AppWindow } = require("../..");

const notes = new Map();

const window = new AppWindow({
  title: "NanoTron Notes",
  width: 960,
  height: 680,
  resizable: true
});

window.loadFile(path.join(__dirname, "index.html"));

window.bind("listNotes", () => Array.from(notes.values()));

window.bind("createNote", (title, body) => {
  const note = {
    id: randomUUID(),
    title: String(title).trim(),
    body: String(body).trim(),
    createdAt: new Date().toISOString()
  };

  if (!note.title) {
    throw new Error("Title is required");
  }

  notes.set(note.id, note);
  return note;
});

window.bind("deleteNote", (id) => {
  return notes.delete(String(id));
});

window.bind("getRuntimeInfo", () => ({
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  notes: notes.size
}));

window.show();
