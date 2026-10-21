# Icons — Agents Hub plugin

A sign of its own for the hub, specialists and directions, and one style for all signs of the session list.

The UI is in English by default and in Russian when the hub language is Russian.

**Where to choose what:**
- **The sign of a direction, specialist or hub — in its chat:** open it; to the left of the title in the header there is a
  button with the sign. Click it and pick from the set (emoji, plus "Custom sign…"). "Reset" brings back the hub sign.
- **Style and color — in the "Look" tab:** Settings → Look → the "Icons" block. The hop of an unread direction is there too.

- Style applies to all signs of the list (hub, specialists, directions, workers), Settings → Look → the "Icons" block:
  emoji or symbols of the system font — SF Symbols on Mac (needs the SF Pro font from developer.apple.com/fonts), Segoe
  Fluent Icons on Windows (Segoe MDL2 Assets on Windows 10); with no font "Symbols" is inactive. The symbol color (from a
  set, your own, or "random", stable per session) and the hop are there too. A symbol with no choice of its own follows the
  session emoji (🎨 → palette), otherwise the sign of its role. The header only has the sign picker in the current style;
  switching the style does not lose a symbol. The symbol set is `symbols.json`.
- The button is for the hub, specialists and directions; workers have none. The hub has no default emoji (a "+" button), its
  symbol is a house.
- The session emoji is its icon in the hub (the same one you pick in the list row menu): a pick from the header is written
  to the hub and seen everywhere; emoji that used to live only in the browser move to the hub by themselves, once. The
  symbol, color and hop are only in this browser; if the icon in the hub was changed after a symbol was chosen, the symbol
  yields to it.
- The header has one button: the session icon by the title that the hub draws itself (with its palette) is replaced by it, so
  there are not two pickers in a row. The palette in the list row menu (right click) stays with the hub.
- It closes on a click outside or Esc. The plugin has no network and no process.
- A direction or specialist finished its turn and you have not opened it yet: the sign in the list smoothly hops by 5 px,
  like an icon in the Mac dock. It can be turned off in Settings → Look → "Icons".

## Install

Settings → Plugins → paste the link to this repository → "Check and install". Needs a hub with plugin API 1.16 (the session
icon of its own); the block in the "Look" tab needs 1.14, in "Settings" 1.13, and on an older hub there is a tab of its own,
"Icons".

## How it works

Slots `session.header` (the button and the picker) and `sidebar.session` (an invisible mark by a session row). The hub
rebuilds the list row and the header on every snapshot, so the sign takes its place after the rebuild, before paint: in a
row, in place of the sign by the name; in the header, the button stands before the title. The set of signs is `emoji.json`;
the emoji pick is `POST /api/session/icon`.

## Language

UI strings are in `STR` at the top of `main.js` (`en`, `ru`), picked by `hub.lang` at the moment of use; any other language
falls back to English. Group titles in `emoji.json` and `symbols.json` are English; the Russian ones are in `STR.ru.groups`.

## Tests

`python3 -m unittest discover -s tests` — standard library, no hub and no browser.

Code — MIT.

Icon — [3D Fluency](https://icons8.com/icons/3d-fluency) by Icons8.
