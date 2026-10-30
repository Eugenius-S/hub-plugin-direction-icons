// "Icons": a sign of its own for directions and specialists. It is picked in the header of the open session, to the left
// of the title; the chosen one stands in the session list in place of the hub's sign. Signs are kept in this browser
// (localStorage). Slots: session.header (the button and the picker) and sidebar.session (a mark by which the sign takes
// its place in the row; the mark itself is invisible).
//
// The session emoji belongs to the core (v1.1: its own icon, event session.iconed, POST /api/session/icon): a pick in the
// header is written there, is seen everywhere (Telegram, another machine, another browser), and the list and header draw
// the core icon. What stays here: outline symbols, color and hop; the core knows nothing about them. A symbol remembers
// the core emoji it was picked at: if the core icon changed later, the symbol yields to it (the newer wins). A local emoji
// from older versions moves to the core once, if the session has no icon of its own there yet.
//
// The hub rebuilds the list row and the header on every snapshot, while the slot root lives between snapshots, so the
// sign is placed after the rebuild (requestAnimationFrame: before paint, no flicker): in a row, in place of the sign by the
// name; in the header, the button moves in front of the title.
//
// A turn result has arrived and the owner has not opened it yet (the row has "unread"): the session sign (direction,
// specialist, worker) smoothly hops by 5 px, like an icon in the Mac dock. The row is rebuilt on every snapshot, so the hop
// phase is taken from the page clock: a new node continues the motion instead of starting over.
//
// Style, for all signs of the list: specialists, directions, workers. Emoji or a symbol: an outline Icons8 icon (the
// m_outlined pack, like every icon of the page) drawn from its SVG path in the text color, the same on every OS.
// A symbol with no choice of its own follows the session emoji (a palette for the artist emoji), otherwise the sign of its
// role. Style, symbol color (its own or random, stable per session) and hop: a block in the Settings tab (API 1.13; on an
// old hub, a tab of its own, "Icons").
//
// The Clean theme (class th-clean on <html>) hides the signs of the list and draws a character picture for every session in the
// feed. There the plugin does not replace the picture: the button shows it, and the picker gets a group "Avatars" (the set is
// avatars.json + the avatars folder) next to the emoji. The choice is kept in this browser (its own key) and puts the chosen
// picture into the feed in place of the theme one; Reset gives the theme picture back. In the standard theme none of this exists.
//
// UI strings: en by default, ru when the hub language is Russian; the language is picked at use time by hub.lang.
const STR = {
  en: {
    icons: "Icons",
    icons_hint: "Session list signs: style, symbol color, hop",
    icon: "Icon",
    icon_pick: "Choose icon",
    own_emoji: "Custom sign…",
    emoji_prompt: "Emoji",
    reset: "Reset",
    avatars: "Avatars",
    foot_hint: "Style, color and hop: Settings → {tab}",
    tab_look: "Look",
    tab_icons: "Icons",
    style_emoji: "Emoji",
    style_sym: "Symbols",
    set_style: "Style for all signs of the list",
    hint_sym: "Symbols: outline icons, the same on every system. The sign of the hub, a specialist or a direction is set with the button to the left of the title in its header.",
    rnd_title: "Random: its own for each session",
    own_color: "Custom color",
    set_color: "Symbol color",
    set_hop: "Hop",
    hop_label: "The icon hops while the result is unread",
    hop_hint: "Like an icon in the Mac dock: a direction or specialist finished its turn and you have not opened it yet",
    groups: {},
  },
  ru: {
    icons: "Иконки",
    icons_hint: "Знаки списка сессий: стиль, цвет символов, прыжок",
    icon: "Иконка",
    icon_pick: "Выбрать иконку",
    own_emoji: "Свой знак…",
    emoji_prompt: "Эмодзи",
    reset: "Как было",
    avatars: "Аватарки",
    foot_hint: "Стиль, цвет и прыжок: «Настройки» → «{tab}»",
    tab_look: "Вид",
    tab_icons: "Иконки",
    style_emoji: "Эмодзи",
    style_sym: "Символы",
    set_style: "Стиль для всех знаков списка",
    hint_sym: "Символы: контурные значки, одинаковые в любой системе. Знак хаба, специалиста или направления выбирается кнопкой слева от названия в его шапке.",
    rnd_title: "Случайный: свой у каждой сессии",
    own_color: "Свой цвет",
    set_color: "Цвет символов",
    set_hop: "Прыжок",
    hop_label: "Иконка прыгает, пока итог не прочитан",
    hop_hint: "Как значок в доке Mac: направление или специалист закончили ход, а вы его ещё не открыли",
    // titles of the groups in emoji.json and symbols.json (English there)
    groups: {
      "Directions": "Направления", "Work": "Работа", "Creative": "Творчество", "Tech": "Технологии",
      "Nature and animals": "Природа и животные", "Food and misc": "Еда и разное",
      "Create": "Создание", "Code": "Код", "Data": "Данные", "People": "Люди", "Money": "Деньги", "World": "Мир",
    },
  },
};
// hub is set in register(); hub.lang is read on every call, never at module load
const lang = () => (STR[hub?.lang] ? hub.lang : "en");
const t = (k, v) => {
  let r = STR[lang()][k] ?? STR.en[k] ?? k;
  for (const n in v) r = r.replaceAll(`{${n}}`, v[n]);
  return r;
};
const groupTitle = (g) => STR[lang()].groups[g.title] ?? g.title;
const KEY = "hub.directionIcons";
const SET = "hub.directionIcons.settings";
const IMG = "hub.directionIcons.img";   // Clean: { session: { img: file of avatars.json, for: the core emoji it was picked at } }
const COMPASS = "compass";   // direction compass in the "Symbols" style
const ROLE = { agent: ["🤖", "person"], direction: ["🧭", null], other: ["", "hammer"], hub: ["", "house"] };   // the hub sign and the role symbol
const HUB_EMOJI = "🧠";   // the hub icon in the core until it has its own
const HOP = 1600;   // ms: one hop and a pause, same as the di-hop animation duration in style.css
const COLORS = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f", "#8d8d86"];
// session emoji -> a symbol of the same meaning (hub signs of specialists and the emoji.json set)
const BY_EMOJI = {
  "🎯": "target", "🚀": "airplane", "🛰": "satellite", "🗺": "map", "📍": "location", "🏁": "flag", "🌍": "globe", "🔭": "binoculars",
  "🧩": "puzzlepiece", "🏗": "crane", "⚙": "gearshape", "🛠": "hammer", "🧪": "atom", "📦": "shippingbox", "📝": "doc.text",
  "📊": "chart.bar", "📈": "chart.line.uptrend.xyaxis", "📣": "megaphone", "💬": "quote.bubble", "📧": "envelope",
  "📚": "books.vertical", "🗂": "folder", "📅": "calendar", "💡": "lightbulb", "🔍": "magnifyingglass", "🧾": "receipt",
  "💼": "briefcase", "🏷": "tag", "🔔": "bell", "📌": "pin", "🎨": "paintpalette", "🖌": "paintbrush", "✏": "pencil",
  "✍": "scribble.variable", "📐": "pencil.and.ruler", "🎬": "film", "🎞": "photo.reel", "📷": "camera", "🎵": "music.note", "🎧": "headphones",
  "🎮": "gamecontroller", "🖼": "photo", "✨": "sparkles", "🌈": "sparkles", "🪄": "sparkles", "🎭": "face.smiling",
  "🧵": "scribble.variable", "💻": "laptopcomputer", "🧑‍💻": "laptopcomputer", "👨‍💻": "laptopcomputer", "👩‍💻": "laptopcomputer",
  "🖥": "desktopcomputer", "📱": "smartphone", "🤖": "cpu", "🧠": "brain", "🔌": "plug", "🔋": "battery", "🌐": "network",
  "🔒": "lock", "🔑": "key", "🛡": "shield", "🧬": "dna", "⚡": "bolt", "🔧": "wrench", "🪛": "hammer", "🧰": "toolbox",
  "🌱": "leaf", "🌳": "tree", "🌸": "leaf", "🍀": "leaf", "🔥": "flame", "💧": "drop", "🌙": "moon", "☀": "sun.max", "⭐": "star",
  "❄": "snowflake", "🐱": "cat", "🐶": "dog", "🦊": "pawprint", "🐼": "pawprint", "🐙": "fish", "🦋": "bird",
  "☕": "cup.and.saucer", "🍕": "pizza", "🍩": "fork.knife", "🍎": "apple", "🧁": "fork.knife", "🎁": "gift",
  "🏆": "trophy", "💎": "crown", "❤": "heart", "💜": "heart", "💙": "heart", "💚": "heart",
};
let hub = null, asked = new Set(), groups = null, symbols = null, avatars = null, openFor = null;

const readJSON = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* no storage */ } };
const icons = () => readJSON(KEY);
// what is kept here per session: sym is the symbol, for is the core emoji it was picked at; emoji (before 1.7) is only
// for moving to the core. A plain string (before 1.3) is an emoji
function stored(name) {
  const v = icons()[name];
  if (typeof v === "string") return { emoji: v };
  return v && typeof v === "object" ? { emoji: typeof v.emoji === "string" ? v.emoji : "", sym: typeof v.sym === "string" ? v.sym : "",
    for: typeof v.for === "string" ? v.for : "" } : {};
}
// the session symbol if it still holds: if the core icon changed after the pick, the core wins (base is the core icon now)
const symOf = (name, base) => { const e = stored(name); return e.sym && (!e.for || e.for === base) ? e.sym : ""; };

// ───── the Clean theme: the avatar of a session ─────
const inClean = () => document.documentElement.classList.contains("th-clean");
// the picked avatar (a file of the set) if it still holds: same rule as for a symbol, a newer core icon wins
const imgOf = (name, base) => { const e = readJSON(IMG)[name]; return e && avatars?.includes(e.img) && (!e.for || e.for === base) ? e.img : ""; };
const imgUrl = (file) => `url("${hub.url(`avatars/${file}`)}")`;
function writeImg(name, file, base) {
  const all = readJSON(IMG);
  if (file) all[name] = { img: file, for: base }; else delete all[name];
  writeJSON(IMG, all);
}
// the picture the theme draws for a session (its pictureFor): the picture of the core emoji or one of the set by a hash of the name
const themeKit = () => {
  try { return JSON.parse(localStorage.getItem("hub.theme") || "null")?.theme?.avatars_url || {}; } catch { return {}; /* no theme */ }
};
const ownEmoji = (name) => (hub.snapshot?.()?.sessions || []).find((x) => x.name === name)?.icon;
const hashOf = (name) => {
  let h = 5381;
  for (const ch of name) h = ((h << 5) + h + ch.codePointAt(0)) >>> 0;
  return h;
};
const themePic = (name) => {
  const kit = themeKit(), pool = Object.values(kit).filter((u) => /\.jpe?g\b/.test(u)), own = ownEmoji(name);
  const url = (own && kit[own]) || pool[hashOf(name) % pool.length];
  return url ? `url("${url}")` : "";
};
// the grey avatars (files grey-*.png of the set): the default picture of a direction, so a new one never gets a colored avatar
// the owner may want for something else; the colored ones are for picking by hand
const greyList = () => (avatars || []).filter((f) => f.startsWith("grey-"));
// the default picture in Clean: a direction takes a grey avatar by a hash of its name (unless the core gave it an emoji the theme
// has a picture for), any other session keeps the theme picture. The grey one is shown in the feed too (see swap)
const defaultImg = (name, kind) => {
  const grey = greyList();
  return kind === "direction" && grey.length && !themeKit()[ownEmoji(name)] ? grey[hashOf(name) % grey.length] : "";
};
// what the session looks like in Clean: the picked avatar, else the default grey one of a direction, else the theme picture
const cleanPic = (name, base, kind) => {
  const f = imgOf(name, base) || defaultImg(name, kind);
  return f ? imgUrl(f) : themePic(name);
};

// shared settings; before 1.3 there were none, so whoever already has symbols gets the "Symbols" style
function settings() {
  const s = readJSON(SET);
  return {
    style: s.style === "sym" || s.style === "emoji" ? s.style : Object.keys(icons()).some((n) => stored(n).sym) ? "sym" : "emoji",
    color: typeof s.color === "string" ? s.color : "",
    hop: s.hop !== false,
  };
}
function setSettings(patch) {
  writeJSON(SET, { ...settings(), ...patch });
  repaint();
}

const symbolStyle = () => settings().style === "sym" && !!symbols;

// who the session is: the hub, a specialist, a direction or the rest (workers, ordinary ones)
const isDirection = (s, snap) => !!s && s.kind !== "hub" && s.role !== "agent" && (!!s.backlog || (snap?.directions || []).includes(s.name));
const kindOf = (s, snap) => (!s ? null : s.kind === "hub" ? "hub" : s.role === "agent" ? "agent" : isDirection(s, snap) ? "direction" : "other");
const editable = (kind) => kind === "agent" || kind === "direction" || kind === "hub";   // the sign can be changed for the hub, specialists and directions

// a symbol is the path of an outline icon (viewBox 24), drawn in the text color
const SVG = "http://www.w3.org/2000/svg";
const pathOf = (sym) => { for (const g of symbols || []) for (const s of g.icons) if (s.n === sym) return s.d || null; return null; };
function glyph(d) {
  const svg = document.createElementNS(SVG, "svg"), p = document.createElementNS(SVG, "path");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "di-svg");
  svg.setAttribute("aria-hidden", "true");
  p.setAttribute("d", d);
  svg.append(p);
  return svg;
}
function colorOf(name) {
  const c = settings().color;
  if (c) return c;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[h % COLORS.length];   // random but stable: derived from the session name
}

// what to draw: { emoji } or { code } (a symbol); base is the session icon in the core (s.icon, its own or the old one) or the role sign
function look(name, kind, base) {
  const emoji = base || ROLE[kind][0], sym = editable(kind) ? symOf(name, base) : "";
  if (!symbolStyle()) return { emoji: emoji || (kind === "hub" ? HUB_EMOJI : "") };
  const code = (sym && pathOf(sym)) || pathOf(BY_EMOJI[emoji.replace(/️/g, "")])
    || (kind === "direction" ? pathOf(COMPASS) : pathOf(ROLE[kind][1]));
  return code ? { code } : { emoji };
}

function paintIcon(node, name, kind, base) {
  const { emoji, code } = look(name, kind, base);
  node.classList.toggle("di-sym", !!code);
  node.style.color = code ? colorOf(name) : "";
  if (code) node.replaceChildren(glyph(code)); else node.textContent = emoji;
}

function paintButton(btn, name, kind, base) {
  const pic = inClean() && cleanPic(name, base, kind);
  btn.classList.toggle("di-av", !!pic);
  if (pic) {   // Clean: the button is the picture the feed shows for the session
    const img = btn.firstElementChild?.classList.contains("di-img") ? btn.firstElementChild : hub.el("span", "di-img");
    img.style.backgroundImage = pic;
    btn.classList.remove("di-sym", "di-empty");
    btn.style.color = "";
    if (btn.firstChild !== img || btn.childNodes.length > 1) btn.replaceChildren(img);
    return;
  }
  paintIcon(btn, name, kind, base);
  const empty = !btn.firstChild;
  btn.classList.toggle("di-empty", empty);   // the hub has no default emoji, the button is visible anyway
  if (empty) btn.textContent = "+";
}

// the symbol is kept here (with the core emoji it was picked at); empty means back to default
function saveSym(name, sym, base) {
  const all = icons();
  if (sym) all[name] = { sym, for: base }; else delete all[name];
  writeJSON(KEY, all);
  openFor = null;
  repaint();
}

// Clean: the picked avatar of the set; empty means the theme picture
function saveImg(name, file, base) {
  writeImg(name, file, base);
  openFor = null;
  repaint();
}

// the emoji goes to the core: it writes session.iconed and the snapshot reaches all clients; empty means the default icon
async function saveEmoji(name, emoji) {
  openFor = null;
  repaint();
  const r = await hub.post("/api/session/icon", { session: name, icon: emoji || "" });
  if (r.error) window.alert(r.error);
}

// a page redraw updates the list but not the header of the open session: the button and the picker are updated here
function repaint() {
  for (const r of document.querySelectorAll(".di-slot")) if (r.dataset.name) {
    paintButton(r.querySelector(".di-btn"), r.dataset.name, r.dataset.kind, r.dataset.base);
    r.querySelector(".di-pop")?.remove();
    sync(r);
  }
  if (settingsRoot) paintSettings(settingsRoot);
  sweepFeed();
  hub.redraw ? hub.redraw() : dispatchEvent(new Event("hub-redraw"));
}

async function load(file) {
  try {
    const r = await fetch(hub.url(file));
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

function button(cls, text, onClick) {
  const b = hub.el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

// ───── session list: own sign and style ─────
function paintRow(root) {
  if (inClean()) return;   // Clean hides the signs of the list: nothing to change, the row stays the theme's
  const row = root.closest(".srow"), { kind, name } = root.dataset;
  let av = row?.querySelector(".nm .avatar");
  if (!av && kind === "hub" && root.dataset.icon) {   // the "Hub" row has no sign of its own, so we put one
    av = hub.el("span", "avatar");
    row.querySelector(".nm")?.prepend(av, document.createTextNode(" "));
  }
  if (!av) return;   // the session has no sign (a worker without an icon): nothing to change
  if (root.dataset.icon) {
    av.className = "avatar";   // not a theme sign (kit-img): it will not become a picture
    av.style.backgroundImage = "";
    av.removeAttribute("role");
    av.removeAttribute("aria-label");
    paintIcon(av, name, kind, root.dataset.base);
  }
  // hops while the result is unread: the hub puts the "unread" mark on the row (the session open now does not have it)
  const on = row.classList.contains("unread") && settings().hop;
  av.classList.toggle("di-hop", on);
  av.style.animationDelay = on ? `-${Math.round(performance.now() % HOP)}ms` : "";
}

function renderRow(root, snap, { session }) {
  root.classList.add("di-mark");
  const kind = kindOf(session, snap);
  if (!kind) { delete root.dataset.icon; return; }
  root.dataset.name = session.name;
  root.dataset.kind = kind;
  root.dataset.base = session.icon || ROLE[kind][0];
  if (symbolStyle()) root.dataset.icon = "1"; else delete root.dataset.icon;   // an emoji is the core icon, the row is left alone
  migrate(snap);
  requestAnimationFrame(() => paintRow(root));
}

// ───── header of a specialist or direction: the button and the sign picker in the current style ─────
function popover(name, kind, base) {
  const sym = symbolStyle(), cur = look(name, kind, base);
  const pop = hub.el("div", "di-pop");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", t("icon"));
  if (inClean()) {
    const list = avatars || [], cur = imgOf(name, base);
    if (list.length) {
      pop.append(hub.el("div", "di-title", t("avatars")));
      const grid = hub.el("div", "di-grid");
      for (const f of list) {
        const b = button("di-opt di-av-opt", "", () => saveImg(name, f, base));
        const img = hub.el("span", "di-img");
        img.style.backgroundImage = imgUrl(f);
        b.append(img);
        b.title = f.replace(/\.png$/, "");
        b.setAttribute("aria-pressed", String(cur === f));
        grid.append(b);
      }
      pop.append(grid);
    }
  }
  for (const g of (sym ? symbols : groups) || []) {
    const list = sym ? g.icons.filter((s) => s.d) : g.icons;
    if (!list.length) continue;
    pop.append(hub.el("div", "di-title", groupTitle(g)));
    const grid = hub.el("div", "di-grid");
    for (const s of list) {
      const b = sym ? button("di-opt di-sym", "", () => saveSym(name, s.n, base))
        : button("di-opt", s, () => saveEmoji(name, s));
      if (sym) { b.append(glyph(s.d)); b.style.color = colorOf(name); b.title = s.n; }
      b.setAttribute("aria-pressed", String(sym ? cur.code === s.d : cur.emoji === s));
      grid.append(b);
    }
    pop.append(grid);
  }
  const foot = hub.el("div", "di-foot");
  if (!sym) foot.append(button("btn quiet di-own", t("own_emoji"), () => {
    const v = (window.prompt(t("emoji_prompt"), cur.emoji || "") || "").trim();
    if (v) saveEmoji(name, [...v].slice(0, 2).join(""));   // one sign, sometimes of two characters (a flag, a composite); the core will check
  }));
  foot.append(button("btn quiet di-own", t("reset"), () => {
    writeImg(name, "", base);   // the picked avatar goes too (it only exists in Clean)
    return sym ? saveSym(name, "", base) : saveEmoji(name, "");
  }));
  pop.append(foot, hub.el("div", "di-hint", t("foot_hint", { tab: t(inTheme() ? "tab_look" : "tab_icons") })));
  return pop;
}

function renderHead(root, snap, { session }) {
  root.classList.add("di-slot");
  const kind = kindOf(session, snap);
  if (!editable(kind)) { root.replaceChildren(); root.hidden = true; delete root.dataset.name; return; }
  root.hidden = false;
  const name = session.name;
  let btn = root.querySelector(".di-btn");
  if (!btn) {
    btn = button("di-btn", "", (e) => {
      e.stopPropagation();
      openFor = openFor === root.dataset.name ? null : root.dataset.name;
      sync(root);
    });
    btn.setAttribute("aria-haspopup", "dialog");
    root.replaceChildren(btn);
  }
  if (root.dataset.name !== name) root.querySelector(".di-pop")?.remove();
  Object.assign(root.dataset, { name, kind, base: session.icon || ROLE[kind][0] });
  paintButton(btn, name, kind, root.dataset.base);
  btn.title = t("icon_pick");
  sync(root);
  requestAnimationFrame(() => {   // on the left, before the title, not at the right edge
    const title = root.parentElement?.querySelector(":scope > h2");
    if (title && title.previousElementSibling !== root) title.before(root);
  });
}

function sync(root) {
  const name = root.dataset.name, pop = root.querySelector(".di-pop");
  root.querySelector(".di-btn")?.setAttribute("aria-expanded", String(openFor === name));
  if (openFor === name && !pop) root.append(popover(name, root.dataset.kind, root.dataset.base));
  else if (openFor !== name && pop) pop.remove();
}

// ───── Clean: the picked avatar in the feed ─────
// The feed avatar of a session is the theme's picture in one of two forms: the core draws the picture of a theme emoji as
// .av.kit-img (background-image), and the theme itself draws a character as --clean-av on .av[data-clean-av] (and on .clean-av in a
// reply). Where a session has a picked avatar, it goes there; data-di-img marks what we replaced, so after a reset the theme
// picture comes back.
function swap(node, name) {
  const snap = hub.snapshot?.(), s = (snap?.sessions || []).find((x) => x.name === name);
  if (!s) return;
  const kind = kindOf(s, snap), file = imgOf(name, s.icon || (kind ? ROLE[kind][0] : "")) || defaultImg(name, kind);
  if (!file && !("diImg" in node.dataset)) return;   // the marker is an empty string: check the key, not the value
  const pic = file ? imgUrl(file) : themePic(name);
  const kit = node.classList.contains("kit-img");
  if (pic && (kit ? node.style.backgroundImage : node.style.getPropertyValue("--clean-av")) !== pic) {
    if (kit) node.style.backgroundImage = pic; else node.style.setProperty("--clean-av", pic);
  }
  if (file) node.dataset.diImg = ""; else delete node.dataset.diImg;
}
function sweepFeed() {
  if (!inClean()) return;
  for (const av of document.querySelectorAll(".byline .av[data-clean-av], .byline .av.kit-img")) swap(av, av.closest(".byline")?.querySelector(":scope > b")?.textContent?.trim());
  for (const box of document.querySelectorAll(".reply-box[data-clean]")) {
    const a = box.closest(".row")?.querySelector(":scope > .g > .clean-av");
    if (a) swap(a, box.dataset.clean);
  }
}

// ───── move: emoji of older versions (kept only in this browser) go to the core ─────
// The session is in the snapshot and has no icon of its own in the core: send it; it has one: the core is newer, just drop
// the local emoji. Not in the snapshot (another machine, deleted): keep until we meet it. A core refusal is not repeated
// until the page is reloaded.
let migrated = null;
function migrate(snap) {
  if (migrated === snap || !(snap?.sessions || []).some((s) => "own_icon" in s)) return;   // an old hub without core icons: nothing to do
  migrated = snap;
  const all = icons();
  let changed = false;
  for (const s of snap.sessions || []) {
    const e = stored(s.name);
    if (!e.emoji || asked.has(s.name)) continue;
    if (s.own_icon || e.emoji === s.icon) { drop(all, s.name, s.icon); changed = true; continue; }
    asked.add(s.name);
    hub.post("/api/session/icon", { session: s.name, icon: e.emoji }).then((r) => {
      if (r.error) return;
      const now = icons();
      drop(now, s.name, e.emoji);
      writeJSON(KEY, now);
    });
  }
  if (changed) writeJSON(KEY, all);
}
function drop(all, name, base) {   // drop the local emoji; the symbol (if any) stays with the core icon base
  const e = stored(name);
  if (e.sym) all[name] = { sym: e.sym, for: e.for || base }; else delete all[name];
}

// ───── settings: style, symbol color, hop ─────
let settingsRoot = null;

function paintSettings(root) {
  settingsRoot = root;
  const s = settings();
  const style = hub.el("div", "seg");
  for (const [id, label] of [["emoji", t("style_emoji")], ["sym", t("style_sym")]]) {
    const b = button(null, label, () => setSettings({ style: id }));
    b.setAttribute("aria-pressed", String(id === "sym" ? symbolStyle() : !symbolStyle()));
    style.append(b);
  }
  const rows = [hub.el("div", "di-set-title", t("set_style")), style,
    hub.el("p", "hint", t("hint_sym"))];
  if (symbolStyle()) {
    const colors = hub.el("div", "di-colors");
    const rnd = button("di-swatch di-rnd", "", () => setSettings({ color: "" }));
    rnd.title = t("rnd_title");
    rnd.setAttribute("aria-pressed", String(!s.color));
    colors.append(rnd);
    for (const c of COLORS) {
      const b = button("di-swatch", "", () => setSettings({ color: c }));
      b.style.background = c;
      b.title = c;
      b.setAttribute("aria-pressed", String(s.color === c));
      colors.append(b);
    }
    const mine = !!s.color && !COLORS.includes(s.color);
    const pick = hub.el("input", "di-pick");
    pick.type = "color";
    pick.value = mine ? s.color : "#888888";
    pick.addEventListener("change", () => setSettings({ color: pick.value }));
    const own = button("di-swatch di-own-color", mine ? "" : "+", () => pick.click());
    own.title = t("own_color");
    if (mine) own.style.background = s.color;
    own.setAttribute("aria-pressed", String(mine));
    colors.append(own, pick);
    rows.push(hub.el("div", "di-set-title", t("set_color")), colors);
  }
  const hop = hub.el("label", "opt");
  const box = hub.el("input");
  box.type = "checkbox";
  box.checked = s.hop;
  box.addEventListener("change", () => setSettings({ hop: box.checked }));
  const txt = hub.el("span");
  txt.append(document.createTextNode(t("hop_label")),
    hub.el("small", null, t("hop_hint")));
  hop.append(box, txt);
  rows.push(hub.el("div", "di-set-title", t("set_hop")), hop);
  root.classList.add("di-set");
  root.replaceChildren(...rows);
}

// API 1.14: a block in the "Theme" tab, 1.13: in "Settings" (a tab of its own wrapped to the second line);
// earlier: a tab of its own
const api = (minor) => { const [a, b] = String(hub.api || "1.1").split(".").map(Number); return a > 1 || (a === 1 && b >= minor); };
const blockInSettings = () => api(13), inTheme = () => api(14);
const drawSettings = (root) => { if (!root.contains(document.activeElement)) paintSettings(root); };

export default function register(h) {
  hub = h;
  hub.addStyle("style.css");
  hub.addSlot("session.header", { id: "pick", order: 5, render: renderHead });
  hub.addSlot("sidebar.session", { id: "mark", render: renderRow });
  if (blockInSettings()) hub.addOptions({ title: t("icons"), hint: t("icons_hint"), tab: "theme", render: drawSettings });
  else hub.addSettings({ id: "direction-icons", title: t("icons"), render: drawSettings });
  // symbols are drawn once the set is loaded: redraw so they replace the fallback sign
  Promise.all([load("emoji.json"), load("symbols.json"), load("avatars.json")]).then(([e, s, a]) => { groups = e; symbols = s; avatars = a; repaint(); });
  // Clean puts its pictures after the page draws and on every change of the feed: take them over once per frame
  let queued = false;
  new MutationObserver(() => {
    if (!inClean() || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sweepFeed(); });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-clean-av"] });
  addEventListener("hub-theme", repaint);   // the theme changed: the button and the feed follow it (Clean on or off)
  // a click outside the picker and Esc close it (the event path: the pressed button may already be out of the page by now);
  // another tab changed signs or settings: redraw
  document.addEventListener("click", (e) => {
    if (openFor && !e.composedPath().some((n) => n.classList?.contains("di-slot"))) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openFor) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  addEventListener("storage", (e) => { if (e.key === KEY || e.key === SET || e.key === IMG) repaint(); });
}
