# Contributing

## Development Flow

1. Install dependencies with `npm install`.
2. Build the native addon with `npm run build`.
3. Run `npm run smoke`.
4. Launch the smallest relevant example before opening a pull request.

## Code Style

Code in this repository should stay explicit, small, and production-ready. Prefer clear function names, narrow responsibilities, predictable errors, and stable public API behavior.

Do not commit generated output:

- `node_modules`
- `build`
- `dist`
- packaged archives
- local editor files

## Native Changes

Native changes live in `src/addon.cpp`. Rebuild after every native edit:

```bash
npm run build
```

Then run:

```bash
npm run smoke
```

## Example Changes

Examples should remain useful as copyable app foundations:

- `basic-app` for the smallest start
- `notes-app` for simple state
- `custom-menu-app` for frameless windows and custom buttons
- `food-order-app` for a dense production-style interface
