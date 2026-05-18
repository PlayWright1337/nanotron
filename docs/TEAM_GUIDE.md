# NanoTron для команды

Этот документ нужен для разработчиков, которые впервые открывают проект и хотят понять, как на нем писать приложения без Electron.

## Идея

NanoTron дает Node.js-приложению нативное окно и WebView. Интерфейс пишется обычным HTML, CSS и браузерным JavaScript. Привилегированная логика остается в Node.js: файловая система, локальные базы, сетевые запросы, системные API и упаковка приложения.

Главное отличие от Electron: NanoTron не тащит с собой Chromium. На Windows используется Microsoft Edge WebView2, на macOS используется WKWebView, на Linux используется WebKitGTK.

## Как думать об архитектуре приложения

Разделяйте приложение на две части.

Node.js-часть:

- создает окно через `AppWindow`;
- загружает `index.html` или URL dev-сервера;
- держит состояние, работу с файлами, базами и ОС;
- открывает команды для интерфейса через `window.bind`;
- управляет окном: закрытие, перетаскивание, сворачивание, разворачивание.

WebView-часть:

- рисует интерфейс;
- хранит локальное UI-состояние;
- вызывает функции из Node.js через `window.someCommand`;
- не получает прямой доступ к файловой системе и системным API.

## Базовый запуск

```bash
npm install
npm run build
npm run example
```

Проверка API без открытия полноценного приложения:

```bash
npm run smoke
```

## Где что лежит

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
├─ binding.gyp
└─ package.json
```

## Публичный API

Главная точка входа:

```javascript
const { AppWindow } = require("nanotron");
```

Создание окна:

```javascript
const window = new AppWindow({
  title: "My Product",
  width: 1100,
  height: 740,
  resizable: true,
  frameless: true
});
```

Загрузка локального интерфейса:

```javascript
window.loadFile(path.join(__dirname, "index.html"));
```

Загрузка dev-сервера:

```javascript
window.loadURL("http://localhost:5173");
```

Команды из интерфейса в Node.js:

```javascript
window.bind("saveOrder", (payload) => {
  return saveOrder(payload);
});
```

В браузерном коде:

```javascript
const savedOrder = await window.saveOrder(orderPayload);
```

## Кастомная верхняя панель

Для собственного меню и кнопок окна включайте `frameless: true`. После этого стандартная рамка Windows убирается, а кнопки рисуются в HTML.

Node.js-сторона:

```javascript
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

WebView-сторона:

```javascript
titlebarElement.addEventListener("mousedown", (event) => {
  if (event.button === 0 && !event.target.closest("button")) {
    window.beginWindowDrag();
  }
});

closeButton.addEventListener("click", () => window.closeWindow());
```

Готовый пример лежит в `examples/custom-menu-app`.

## Пример плотного приложения

`examples/food-order-app` показывает более реалистичную структуру: витрина блюд, корзина, оформление заказа, локальное состояние, кастомные кнопки окна и обмен данными между интерфейсом и Node.js.

Запуск:

```bash
npm run example:food
```

## Как подключить существующий фронтенд

Если у команды уже есть Vite, React, Vue, Svelte или другой фронтенд, во время разработки можно загрузить dev-сервер:

```javascript
window.loadURL("http://localhost:5173");
```

Для продакшена собирайте фронтенд и открывайте итоговый `index.html`:

```javascript
window.loadFile(path.join(__dirname, "dist", "index.html"));
```

Все операции, которые нельзя доверять браузерной части, переносите в `window.bind`.

## Сборка EXE

Команда:

```bash
npm run package:menu:win
```

Результат:

```text
dist/standalone/nanotron-menu.exe
```

Такой файл запускается у пользователей без установленного Node.js. На Windows все равно нужен Microsoft Edge WebView2 Runtime. На Windows 10/11 он обычно уже есть, но установщик продукта должен проверять его наличие.

## Что нельзя делать

- Не кладите бизнес-логику в HTML, если ей нужен доступ к системе.
- Не возвращайте Promise из `window.bind`, текущий нативный цикл ожидает синхронный результат.
- Не коммитьте `node_modules`, `build`, `dist` и собранные `.exe`.
- Не используйте Electron API напрямую, их здесь нет.
- Не храните секреты в интерфейсе.

## Минимальный шаблон приложения

```text
my-app/
├─ package.json
└─ src/
   ├─ main.js
   └─ index.html
```

`main.js`:

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

window.bind("getRuntimeInfo", () => ({
  platform: process.platform,
  arch: process.arch,
  node: process.version
}));

window.show();
```

`index.html`:

```html
<main id="app"></main>
<script>
  async function render() {
    const runtimeInfo = await window.getRuntimeInfo();
    document.getElementById("app").textContent = JSON.stringify(runtimeInfo, null, 2);
  }

  render();
</script>
```
