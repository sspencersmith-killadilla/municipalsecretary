# Brand favicon + MIT license

## Favicon
The site still uses the template's default `favicon.ico`, and there is no logo image file. The app's brand mark is the landmark (civic building) icon in deep navy with a warm parchment background.

- Create `public/favicon.svg`: a square navy tile with rounded corners and a simple parchment-colored civic building (pediment, three columns, base), thick strokes so it stays legible at 16-32px.
- Point the root head icon link at `/favicon.svg` (type `image/svg+xml`).
- Delete `public/favicon.ico`.

## MIT license
- Add `LICENSE` at the project root with the standard MIT text, "Copyright (c) 2026 Spencer Smith".
- Set `"license": "MIT"` in `package.json`.
- Add a short "License" section to `README.md`: "MIT, see LICENSE".
- No other license exists in the project, so nothing needs replacing.
