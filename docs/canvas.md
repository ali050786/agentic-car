# The Canvas (template-5)

The Canvas designs every slide around its content instead of pouring the copy
into a fixed template. It keeps the two things the classic templates are good
at: colors come from the palette or brand kit, and every word is editable in
place.

## How it fits together

```
copy (v2 pipeline)            design (per slide)                  color (at render time)
headline, body, list …   +    layout tree + deck style       +    palette → named roles
        │                           │                                   │
        └──────────────► renderCanvas() → SVG with one HTML foreignObject ◄──┘
                                    │
                        browser fits text (fit.ts)
```

- **Content** stays in the slide's normal fields (`slots`). Designs never
  contain words; text nodes point at fields (`headline`, `body`, `x.<key>` for
  short design labels stored in `slots.extras`).
- **Design** is a small tree in the Canvas layout language
  (`core/design/canvas/types.ts`): stacks, grids, text, lists, numbers,
  charts, icons, rules, badges, meta (page numbers, swipe), plus background
  decorations. The deck-level **style** (direction, font pair, corners,
  heading case, headline accent) lives on every design.
- **Color** is a role (`ink`, `accent`, `onAccent`, `surface` …) resolved from
  the theme when rendering, with contrast repaired automatically
  (`tokens.ts → resolvePalette`, `render.ts → readable`).

## Files

| File | What it does |
| --- | --- |
| `core/design/canvas/types.ts` | The layout language, stored design shapes |
| `core/design/canvas/tokens.ts` | Font pairs, type scale, directions, palette roles |
| `core/design/canvas/render.ts` | Design + content → HTML/SVG pieces |
| `core/design/canvas/archetypes.ts` | The layout library (27 layouts), deck variety, color moments |
| `core/design/canvas/lint.ts` | Sanitizes AI trees, guarantees every field is shown, estimates fit |
| `core/design/canvas/fit.ts` | Browser text fitting (`--fit` binary search) |
| `core/design/canvas/style.ts` | Picks a look from the user's words or the topic (no model) |
| `core/design/canvas/index.ts` | `renderCanvasSlide`, `designFor`, storage helpers |
| `core/agents/v2/design.ts` | Design Director + per-slide composer |
| `components/artifact/canvasControls.ts` | Studio operations (restyle, fonts, shuffle, color fill) |
| `components/studio/useCanvasFit.ts` | Fits slides after render and when fonts load |

## Creating a deck

1. **Design Director** (one `planner` call) starts as soon as the outline
   exists, while the copy is being written: direction, fonts, corners,
   accent, a layout from the library for each slide, a one-line visual idea
   per slide, and 1–2 full-color slides. When the draft copy is ready the
   plan is repaired against the real words in code (valid layouts, no
   neighbouring repeats, lawful color moments). The user's own words about
   the look ("make it minimal") always win.
2. The studio shows the draft right away with library layouts in the
   director's look.
3. **Composer** (one `writer` call per slide, all at once) shapes each
   slide's layout for the draft words while the editor reviews the copy.
   Every tree is linted; trees that need heavy text shrinking (estimated
   fit < 72%) or many repairs fall back to the library draft. The composed
   layouts replace the library ones in the studio as soon as their labels
   pass moderation.
4. **Refit.** After the review, each layout is checked against the final
   words: unchanged slides keep theirs; a revised slide keeps its layout if
   it still shows every field, fits, and its labels are still valid;
   otherwise only that slide is composed again.
5. Design labels (`extras`) go through the same banned-word, emoji and
   moderation checks as the copy, and may not contain numbers the slide
   doesn't already have.

`DESIGN_DIRECTOR=off` / `DESIGN_COMPOSER=off` switch the models off; the deck
is then designed from the library alone.

## Storage

- A Canvas deck is saved as `templateType: 'template1'` plus
  `theme.designMode = 'canvas'` (the attribute only accepts the classic
  values). Save paths call `stampTheme` / `appToDbTemplate`; load paths call
  `resolveAppTemplate`.
- Library layouts are stored as **recipes** (`{ ref, archetype, seed, style }`,
  ~150 bytes) and rebuilt from the slide's current words at render time.
  Composed layouts are stored in full. `compactDesigns` turns the largest
  trees into recipes if a deck's slides JSON would exceed 60k characters.
- `designFor` re-picks a library layout if a slide changed kind (e.g. a stat
  became a body slide) and adds nodes for any field the words gained later.

## Editing

- Text: click to edit, as before. "Key: detail" texts are two editable parts
  that are joined back on save.
- Design panel → **Layout** tab: look (instant library layouts), fonts,
  corners, heading case, key-phrase treatment, shuffle a slide's layout,
  color fill, and "Redesign with AI" (sent through the chat).
- Chat: `redesign` action for specific slides, `set_direction`,
  `set_fonts`, `set_corners`, and switching templates. Copy edits keep the
  slide's design; inserted and regenerated slides are designed in the deck's
  look; every change is undoable.

## Tests and previews

```
npx tsx tests/canvas/test-canvas.ts      # renderer, library, lint, storage, mapping
npx tsx tests/v2/test-design-v2.ts       # design agents in the create/edit pipelines
npx tsx tests/canvas/preview.ts          # tests/canvas/out/preview.html, every direction
```
