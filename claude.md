# CLAUDE.md

## Project Context
This is an HTML/CSS/JS poker app deployed to GitHub Pages.

## Build and Deploy
- Always run `npm run build` after making changes.
- Deploy to GitHub Pages after successful builds.

## Styling Rules
- Use CSS variables for colours, spacing, font sizes, and any repeated values. Do not hardcode styles inline or per-component.
- Minimum font size is 10px. Nothing smaller.
- Panels must use shared CSS classes. Do not write bespoke styles for individual panels. If a panel needs something new, add it to the shared styles.

## Code Style
- Keep JS in separate files, not inline in HTML.
- Keep CSS in separate stylesheets, not inline on elements.