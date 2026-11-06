# Design sketches: one topic page (K-NN)

Throwaway mockups to pick a visual direction. All three share the same working playground
(`shared/knn-playground.js`) and draft copy (`shared/content.js`, EN + AR), so only the design differs.

Run: start the `sketches` preview (`.claude/launch.json`) or `python -m http.server 8765 --directory sketches`,
then open http://localhost:8765/001-calm-editorial/ (or 002-lab-split, 003-playful-steps).

| | 001 Calm editorial | 002 Lab split | 003 Playful steps |
|---|---|---|---|
| Stance | Reading first, like a good article | Tool first, like a coding lab | Guided, like a learning app |
| Layout | One column, playground as a wide figure | Topic nav · lesson · sticky playground | Step tabs: Learn → Play → Check → Code |
| Feel | Calm, trustworthy, warm paper | Dark, technical, dense | Bright, rounded, rewarding (confetti) |
| Playground while reading | Scroll to it | Always visible | Own step |
| Best for | Understanding the idea | Experimenting a lot | Beginners who need structure |

**004 Calm + playful** (merge of 001 and 003, the user's pick): calm paper look and serif headings from 001;
step rail (Learn → Play → Check → Code) that follows the scroll, progress bar, playground side panel,
chunky quiz buttons with confetti and the yellow Colab button from 003.

## Round 2 (picked direction: 005, restyled)

New identity: graph paper + plotting ink (cobalt / raspberry data colours, one highlighter yellow), Bricolage Grotesque
display, Atkinson Hyperlegible body, IBM Plex Mono for data. Light + dark mode. Signature: every algorithm is shown by
the line it draws. Engine: `shared/engine.js` (7 real classifiers in JS, shared data store, smooth boundary tracing),
copy in `shared/copy.js`, tokens in `shared/theme.css`.

- `home/` course home: live hero that redraws the same points with each algorithm, the route through the course
  (parts 0–3 and 10, with 4–9 marked as later), and a three-question algorithm picker that links into Compare.
- `006-lesson/` the K-NN lesson in 005's step structure, with train/test scores and ringed test points.
- `compare/` two algorithms side by side on the same points, each with its own setting, plus a verdict.

**005 Playful + calm** (the opposite merge): 003's structure (one step at a time via tabs, Next/Back buttons,
chunky buttons, confetti) dressed in 001's calm paper palette, serif headings, reading width and framed playground.
