# ttyd-html

Single-file `index.html` frontend for ttyd's `-I/--index` option.

See [`README.md`](./README.md) for the port's relationship to upstream.

## Organization

- `src/components` — app components.
- `src/lib/**/*.ts` — the terminal client and xterm addons.
- `src/index.css` — Tailwind entry. Only `@theme` tokens and the layered xterm.css import belong here.
- `scripts/html-header.mjs` — emits ttyd's `src/html.h` from the build, for compiling the frontend into the binary instead of passing `-I`.
- `test/*.ts` — unit tests.

## Constraints

- The build must stay a single file: no `public/` assets, no code splitting, no runtime fetches. Inline anything new.
- `src/lib` stays framework-free. React only mounts it.
- xterm owns the DOM inside `#terminal-container`, so style it with `[&_.terminal]:` variants rather than writing a descendant rule.
- Options arrive from three places, merged in this order: client defaults in `src/App.tsx`, the server's `SET_PREFERENCES` message, then the URL query string.

## Formatting

Write StandardJS style: 100 columns, two-space indentation, single quotes, no semicolons, and no trailing commas. Quote object keys only where required, keep spaces inside curly braces, and always parenthesize arrow function parameters.

Use erasable TypeScript syntax only: no namespaces, enums, or parameter properties.

## Development

Ask the user to run the dev server and `ttyd` when you need to inspect.

## Commands

- Run `npm run check` or `tsc -p .` to check types.
- Run `npm run lint:fix` or `biome check --fix` to check and fix linting issues.
- Run `npm run test:coverage` or `vitest run --coverage` to run tests.
