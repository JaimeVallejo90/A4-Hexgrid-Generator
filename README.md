# A4 Hexgrid Generator

A single-page A4 hex grid generator with a focused desktop layout. All measurements are in millimeters and scaled to true A4 size (210 x 297 mm). Designed for GitHub Pages.

## Features
- Hexgrid or hexflower layouts
- True millimeter sizing on an A4 page (portrait or landscape)
- Live preview and export
- Presets (`Default`, `Mausritter` with 28mm hex size)
- Collapsible side panels (click panel titles)
- Scrollable side columns for smaller desktop heights (e.g. 1080p)
- Config persistence:
  - URL query param (`?seed=v1...`) for short shareable seed links
  - backward compatibility for older `?cfg=...` links
  - localStorage restore on reload
- Export options:
  - PNG White (keeps colors, white background)
  - PNG Transparent (keeps colors, transparent background)
  - PDF White (keeps colors, white page)

## Local development
- Open `index.html` directly in the browser.
- For GitHub Pages, push these static files as-is.

## Try it
https://jaimevallejo90.github.io/A4-Hexgrid-Generator/
