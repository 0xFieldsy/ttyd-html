# ttyd-html

A reimplementation of [ttyd](https://github.com/tsl0922/ttyd)'s web frontend on a modern toolchain.

## Usage

```sh
npm install
npm run build
ttyd -W -I dist/index.html bash
```

The terminal uses the device color-scheme preference by default. Its URL override is `?dark=true` or `?dark=false`.

## Development

```sh
ttyd -W bash  # backend on :7681
npm start     # dev server on :5173 (proxies /token and /ws to backend)
```

### Baking the page into the binary

`-I dist/index.html` is the easy path, but ttyd also compiles its frontend in [`src/html.h`](https://github.com/tsl0922/ttyd/blob/main/src/html.h), which is just the gzipped page as an `unsigned char index_html[]` array plus its compressed and uncompressed lengths. ttyd serves those bytes verbatim to clients that accept gzip and inflates them for clients that don't. `npm run build:header` regenerates that header file.

To compile ttyd on Debian/Ubuntu/Mint, first install its build tools and libraries:

```sh
sudo apt install build-essential cmake libjson-c-dev libssl-dev libuv1-dev libwebsockets-dev zlib1g-dev
```

Clone the upstream repo:

```sh
gh repo clone tsl0922/ttyd /path/to/ttyd
```

Generate the page and header in this repo:

```sh
npm run build
npm run build:header
```

Build the binary:

```sh
cp dist/html.h /path/to/ttyd/src/html.h
cmake -B /path/to/ttyd/build -S /path/to/ttyd -DCMAKE_BUILD_TYPE=Release
cmake --build /path/to/ttyd/build
```

Install:

```sh
sudo cmake --install /path/to/ttyd/build
```

## Upstream Differences

- **React 19 instead of Preact.** Class components became function components; the `@bind` decorator became arrow-function class properties.
- **Vite single-file build instead of Webpack and Gulp `inline-source`.** `vite-plugin-singlefile` plus `assetsInlineLimit: Infinity` produces the same self-contained page.
- **Tailwind 4 instead of SCSS.** The layout rules are utility classes on the elements themselves. Two exceptions live in `src/index.css`: the `@theme` color tokens, and the import of `@xterm/xterm/css/xterm.css`.
- **On-screen key dock.** Pins a bar of keys to the bottom of the screen: Ctrl, Escape, Tab, `~`, `/`, `|`, `-` and the arrows. Disable with `?showDock=false`
- **Edge-to-edge on mobile.** The page is sized with `dvh` rather than `100%`, so mobile URL bars can't hide the bottom rows, and the viewport meta uses `viewport-fit=cover` with `interactive-widget=resizes-content`.
- **Upgraded unicode with grapheme clusters.** `@xterm/addon-unicode-graphemes` replaces `@xterm/addon-unicode11`, so ZWJ sequences, skin-tone modifiers, flags and combining marks occupy one cell group.
- **Durable reconnects.** Keeps retrying with jittered exponential backoff and reconnects immediately on `visibilitychange` or `online`.
- **No terminal file-transfer support.** Zmodem and trzsz client options are ignored (prefer [copyparty](https://github.com/9001/copyparty)).
- **No canvas renderer.** WebGL or DOM. Canvas was removed in xterm v6.
- **Biome instead of ESLint/Prettier.**
- **No `whatwg-fetch` polyfill.**
