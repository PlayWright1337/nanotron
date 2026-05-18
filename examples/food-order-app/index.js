"use strict";

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { AppWindow } = require("../..");

const orders = [];

const window = new AppWindow({
  title: "Forkline Kitchen",
  width: 1180,
  height: 760,
  resizable: true,
  frameless: true
});

window.loadFile(path.join(__dirname, "index.html"));

window.bind("getRestaurantState", () => ({
  restaurant: {
    name: "Forkline Kitchen",
    city: "Moscow",
    deliveryMinutes: "25-40",
    minimumOrder: 900,
    serviceFee: 99
  },
  orders
}));

window.bind("placeOrder", (payload) => {
  const order = normalizeOrder(payload);
  orders.unshift(order);
  return order;
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

window.show();

function normalizeOrder(payload) {
  const parsedPayload = payload && typeof payload === "object" ? payload : {};
  const items = Array.isArray(parsedPayload.items) ? parsedPayload.items : [];
  const total = Number(parsedPayload.total);

  if (items.length === 0) {
    throw new Error("Order must include at least one item");
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Order total is invalid");
  }

  return {
    id: randomUUID(),
    customerName: String(parsedPayload.customerName || "Guest").trim(),
    address: String(parsedPayload.address || "Pickup").trim(),
    paymentMethod: String(parsedPayload.paymentMethod || "card").trim(),
    items,
    total,
    createdAt: new Date().toISOString(),
    status: "accepted"
  };
}
