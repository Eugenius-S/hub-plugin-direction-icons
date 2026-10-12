// «Иконки» (владелец 07.10, 12.10): свой знак у направлений и специалистов — выбор в шапке открытой сессии, слева перед
// названием; выбранный стоит в списке сессий вместо знака хаба. Знаки хранятся в этом браузере (localStorage). Места:
// session.header (кнопка и выбор) и sidebar.session (метка, по которой знак встаёт на место в строке; сама метка не видна).
//
// Строку списка и шапку хаб собирает заново на каждом снимке, а root места живёт между снимками: поэтому знак ставим
// после сборки (requestAnimationFrame — до отрисовки, мерцания нет): в строке — вместо знака у имени, в шапке — кнопка
// переезжает перед названием.
//
// Итог хода пришёл, а владелец его ещё не открыл (строка «unread») — знак сессии (направления, специалиста, исполнителя)
// плавно подпрыгивает на 5 px, как значок в доке Mac (владелец 12.10). Строку пересобирают на каждом снимке — фазу
// прыжка берём от часов страницы, чтобы новый узел продолжал движение, а не начинал заново.
//
// Стиль (владелец 12.10) — на все знаки списка: специалисты, направления, исполнители. Эмодзи или символ системного
// шрифта — на Mac SF Symbols (шрифт SF Pro), на Windows Segoe Fluent Icons (MDL2 на Windows 10); шрифта нет — стиль
// «Символы» неактивен. Символ без своего выбора — по эмодзи сессии (🎨 → палитра), иначе знак её роли. Стиль, цвет
// символов (свой или случайный — постоянный для сессии) и прыжок — блоком во вкладке «Настройки» (API 1.13; на старом
// хабе — своя вкладка «Иконки»). У сессии хранятся оба знака: { emoji, sym } — смена стиля их не теряет.
const KEY = "hub.directionIcons";
const SET = "hub.directionIcons.settings";
const COMPASS = { sf: "100dcc", win: "e812" };   // компас направления в стиле «Символы»: location.north.circle / MapCompassTop
const ROLE = { agent: ["🤖", "person"], direction: ["🧭", null], other: ["", "hammer"], hub: ["", "house"] };   // знак хаба и символ роли
const HOP = 1600;   // мс: один прыжок и пауза — как длительность анимации di-hop в style.css
const FONTS = {
  sf: '"SF Pro", "SF Pro Text", "SF Pro Display", "SF Compact"',
  win: '"Segoe Fluent Icons", "Segoe MDL2 Assets"',
};
const COLORS = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f", "#8d8d86"];
// эмодзи сессии → символ того же смысла (знаки хаба у специалистов и набор emoji.json)
const BY_EMOJI = {
  "🎯": "target", "🚀": "airplane", "🛰": "globe", "🗺": "map", "📍": "location", "🏁": "flag", "🌍": "globe", "🔭": "binoculars",
  "🧩": "puzzlepiece", "🏗": "hammer", "⚙": "gearshape", "🛠": "hammer", "🧪": "atom", "📦": "shippingbox", "📝": "doc.text",
  "📊": "chart.bar", "📈": "chart.line.uptrend.xyaxis", "📣": "megaphone", "💬": "quote.bubble", "📧": "envelope",
  "📚": "books.vertical", "🗂": "folder", "📅": "calendar", "💡": "lightbulb", "🔍": "magnifyingglass", "🧾": "doc.text",
  "💼": "briefcase", "🏷": "tag", "🔔": "bell", "📌": "pin", "🎨": "paintpalette", "🖌": "paintbrush", "✏": "pencil",
  "✍": "scribble.variable", "📐": "pencil.and.ruler", "🎬": "film", "🎞": "film", "📷": "camera", "🎵": "music.note", "🎧": "music.note",
  "🎮": "gamecontroller", "🖼": "photo", "✨": "sparkles", "🌈": "sparkles", "🪄": "wand.and.stars", "🎭": "face.smiling",
  "🧵": "scribble.variable", "💻": "laptopcomputer", "🧑‍💻": "laptopcomputer", "👨‍💻": "laptopcomputer", "👩‍💻": "laptopcomputer",
  "🖥": "desktopcomputer", "📱": "laptopcomputer", "🤖": "cpu", "🧠": "brain", "🔌": "bolt", "🔋": "bolt", "🌐": "network",
  "🔒": "lock", "🔑": "key", "🛡": "shield", "🧬": "atom", "⚡": "bolt", "🔧": "hammer", "🪛": "hammer", "🧰": "briefcase",
  "🌱": "leaf", "🌳": "tree", "🌸": "leaf", "🍀": "leaf", "🔥": "flame", "💧": "drop", "🌙": "moon", "☀": "sun.max", "⭐": "star",
  "❄": "snowflake", "🐱": "pawprint", "🐶": "pawprint", "🦊": "pawprint", "🐼": "pawprint", "🐙": "fish", "🦋": "bird",
  "☕": "cup.and.saucer", "🍕": "fork.knife", "🍩": "fork.knife", "🍎": "fork.knife", "🧁": "fork.knife", "🎁": "gift",
  "🏆": "trophy", "💎": "crown", "❤": "heart", "💜": "heart", "💙": "heart", "💚": "heart",
};
let hub = null, groups = null, symbols = null, openFor = null, font;

const readJSON = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* нет хранилища */ } };
const icons = () => readJSON(KEY);
// знак сессии: строка (до 1.3) — эмодзи; { sym, color } (1.2) — символ, его цвет теперь общий из настроек
function entry(name) {
  const v = icons()[name];
  if (typeof v === "string") return { emoji: v };
  return v && typeof v === "object" ? { emoji: typeof v.emoji === "string" ? v.emoji : "", sym: typeof v.sym === "string" ? v.sym : "" } : {};
}

// общие настройки; до 1.3 их не было — у кого уже стоят символы, тому стиль «Символы»
function settings() {
  const s = readJSON(SET);
  return {
    style: s.style === "sym" || s.style === "emoji" ? s.style : Object.keys(icons()).some((n) => entry(n).sym) ? "sym" : "emoji",
    color: typeof s.color === "string" ? s.color : "",
    hop: s.hop !== false,
  };
}
function setSettings(patch) {
  writeJSON(SET, { ...settings(), ...patch });
  repaint();
}

// шрифт символов этой машины: глиф шрифта шире/уже запасного — шрифт есть (ширина у двух запасных разная — без совпадений)
function symbolFont() {
  if (font !== undefined) return font;
  const probe = { sf: "\u{100215}", win: "" };   // папка: SF Symbols folder, Segoe Folder
  const ctx = document.createElement("canvas").getContext("2d");
  const width = (fam, ch) => { ctx.font = `32px ${fam}`; return ctx.measureText(ch).width; };
  font = null;
  for (const [k, ch] of Object.entries(probe)) {
    if (["monospace", "serif"].some((b) => width(`${FONTS[k]}, ${b}`, ch) !== width(b, ch))) { font = k; break; }
  }
  return font;
}
const symbolStyle = () => settings().style === "sym" && !!symbolFont() && !!symbols;

// кто сессия: хаб, специалист, направление или остальные (исполнители, обычные)
const isDirection = (s, snap) => !!s && s.kind !== "hub" && s.role !== "agent" && (!!s.backlog || (snap?.directions || []).includes(s.name));
const kindOf = (s, snap) => (!s ? null : s.kind === "hub" ? "hub" : s.role === "agent" ? "agent" : isDirection(s, snap) ? "direction" : "other");
const editable = (kind) => kind === "agent" || kind === "direction" || kind === "hub";   // знак меняют у хаба, специалистов и направлений

const glyph = (code) => String.fromCodePoint(parseInt(code, 16));
const codeOf = (sym) => { for (const g of symbols || []) for (const s of g.icons) if (s.n === sym) return s[symbolFont()] || null; return null; };
function colorOf(name) {
  const c = settings().color;
  if (c) return c;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[h % COLORS.length];   // случайный, но постоянный: от имени сессии
}

// что рисовать: { emoji } или { code } (символ); base — эмодзи хаба у сессии (s.icon или знак роли)
function look(name, kind, base) {
  const e = editable(kind) ? entry(name) : {}, emoji = e.emoji || base || ROLE[kind][0];
  if (!symbolStyle()) return { emoji };
  const code = (e.sym && codeOf(e.sym)) || codeOf(BY_EMOJI[emoji.replace(/️/g, "")])
    || (kind === "direction" ? COMPASS[symbolFont()] : codeOf(ROLE[kind][1]));
  return code ? { code } : { emoji };
}

function paintIcon(node, name, kind, base) {
  const { emoji, code } = look(name, kind, base);
  node.classList.toggle("di-sym", !!code);
  node.style.fontFamily = code ? FONTS[symbolFont()] : "";
  node.style.color = code ? colorOf(name) : "";
  node.textContent = code ? glyph(code) : emoji;
}

function paintButton(btn, name, kind, base) {
  paintIcon(btn, name, kind, base);
  btn.classList.toggle("di-empty", !btn.textContent);   // у хаба эмодзи по умолчанию нет — кнопка всё равно видна
  if (!btn.textContent) btn.textContent = "+";
}

// знак в текущем стиле: эмодзи — e.emoji, символ — e.sym; второй остаётся
function save(name, patch) {
  const all = icons(), e = { ...entry(name), ...patch };
  for (const k of Object.keys(e)) if (!e[k]) delete e[k];
  if (Object.keys(e).length) all[name] = e; else delete all[name];
  writeJSON(KEY, all);
  openFor = null;
  repaint();
}

// перерисовка страницы список обновляет, шапку открытой сессии — нет: кнопку и выбор обновляем сами
function repaint() {
  for (const r of document.querySelectorAll(".di-slot")) if (r.dataset.name) {
    paintButton(r.querySelector(".di-btn"), r.dataset.name, r.dataset.kind, r.dataset.base);
    r.querySelector(".di-pop")?.remove();
    sync(r);
  }
  if (settingsRoot) paintSettings(settingsRoot);
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

// ───── список сессий: свой знак и стиль ─────
function paintRow(root) {
  const row = root.closest(".srow"), { kind, name } = root.dataset;
  let av = row?.querySelector(".nm .avatar");
  if (!av && kind === "hub" && root.dataset.icon) {   // у строки «Хаб» своего знака нет — ставим
    av = hub.el("span", "avatar");
    row.querySelector(".nm")?.prepend(av, document.createTextNode(" "));
  }
  if (!av) return;   // у сессии нет знака (исполнитель без значка) — нечего менять
  if (root.dataset.icon) {
    av.className = "avatar";   // не знак темы (kit-img): картинкой он не станет
    av.style.backgroundImage = "";
    av.removeAttribute("role");
    av.removeAttribute("aria-label");
    paintIcon(av, name, kind, root.dataset.base);
  }
  // прыгает, пока итог не прочитан: метку «unread» строке ставит хаб (у открытой сейчас сессии её нет)
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
  if (symbolStyle() || (editable(kind) && entry(session.name).emoji)) root.dataset.icon = "1"; else delete root.dataset.icon;
  requestAnimationFrame(() => paintRow(root));
}

// ───── шапка специалиста или направления: кнопка и выбор знака в текущем стиле ─────
function popover(name, kind, base) {
  const e = entry(name), sym = symbolStyle(), cur = look(name, kind, base);
  const pop = hub.el("div", "di-pop");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Иконка");
  for (const g of (sym ? symbols : groups) || []) {
    const list = sym ? g.icons.filter((s) => s[symbolFont()]) : g.icons;
    if (!list.length) continue;
    pop.append(hub.el("div", "di-title", g.title));
    const grid = hub.el("div", "di-grid");
    for (const s of list) {
      const b = sym ? button("di-opt di-sym", glyph(s[symbolFont()]), () => save(name, { sym: s.n }))
        : button("di-opt", s, () => save(name, { emoji: s }));
      if (sym) { b.style.fontFamily = FONTS[symbolFont()]; b.style.color = colorOf(name); b.title = s.n; }
      b.setAttribute("aria-pressed", String(sym ? cur.code === s[symbolFont()] : e.emoji === s));
      grid.append(b);
    }
    pop.append(grid);
  }
  const foot = hub.el("div", "di-foot");
  if (!sym) foot.append(button("btn quiet di-own", "Свой знак…", () => {
    const v = (window.prompt("Эмодзи", e.emoji || "") || "").trim();
    if (v) save(name, { emoji: [...v].slice(0, 2).join("") });   // один знак, иногда из двух символов (флаг, составной)
  }));
  foot.append(button("btn quiet di-own", "Как было", () => save(name, sym ? { sym: "" } : { emoji: "" })));
  pop.append(foot, hub.el("div", "di-hint", `Стиль, цвет и прыжок — «Настройки» → «${inTheme() ? "Тема" : "Иконки"}»`));
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
  btn.title = "Иконка — выбрать";
  sync(root);
  requestAnimationFrame(() => {   // слева, перед названием (владелец 07.10), а не у правого края
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

// ───── настройки: стиль, цвет символов, прыжок ─────
let settingsRoot = null;

function paintSettings(root) {
  settingsRoot = root;
  const s = settings(), f = symbolFont();
  const style = hub.el("div", "seg");
  for (const [id, label] of [["emoji", "Эмодзи"], ["sym", "Символы"]]) {
    const b = button(null, label, () => setSettings({ style: id }));
    b.setAttribute("aria-pressed", String(id === "sym" ? symbolStyle() : !symbolStyle()));
    if (id === "sym" && !f) b.disabled = true;
    style.append(b);
  }
  const rows = [hub.el("div", "di-set-title", "Стиль — для всех знаков списка"), style,
    hub.el("p", "hint", f ? `Символы — ${f === "sf" ? "SF Symbols (шрифт SF Pro)" : "Segoe Fluent Icons"}. Знак хаба, специалиста или направления — кнопкой слева от названия в его шапке.`
      : "Символов нет: нужен шрифт SF Pro (Mac, developer.apple.com/fonts) или Segoe Fluent Icons (Windows).")];
  if (symbolStyle()) {
    const colors = hub.el("div", "di-colors");
    const rnd = button("di-swatch di-rnd", "", () => setSettings({ color: "" }));
    rnd.title = "Случайный: свой у каждой сессии";
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
    own.title = "Свой цвет";
    if (mine) own.style.background = s.color;
    own.setAttribute("aria-pressed", String(mine));
    colors.append(own, pick);
    rows.push(hub.el("div", "di-set-title", "Цвет символов"), colors);
  }
  const hop = hub.el("label", "opt");
  const box = hub.el("input");
  box.type = "checkbox";
  box.checked = s.hop;
  box.addEventListener("change", () => setSettings({ hop: box.checked }));
  const txt = hub.el("span");
  txt.append(document.createTextNode("Иконка прыгает, пока итог не прочитан"),
    hub.el("small", null, "Как значок в доке Mac: направление или специалист закончили ход, а вы его ещё не открыли"));
  hop.append(box, txt);
  rows.push(hub.el("div", "di-set-title", "Прыжок"), hop);
  root.classList.add("di-set");
  root.replaceChildren(...rows);
}

// API 1.14 — блок во вкладке «Тема» (владелец 12.10), 1.13 — в «Настройках» (своя вкладка уезжала на вторую строку);
// раньше — своя вкладка
const api = (minor) => { const [a, b] = String(hub.api || "1.1").split(".").map(Number); return a > 1 || (a === 1 && b >= minor); };
const blockInSettings = () => api(13), inTheme = () => api(14);
const drawSettings = (root) => { if (!root.contains(document.activeElement)) paintSettings(root); };

export default function register(h) {
  hub = h;
  hub.addStyle("style.css");
  hub.addSlot("session.header", { id: "pick", order: 5, render: renderHead });
  hub.addSlot("sidebar.session", { id: "mark", render: renderRow });
  if (blockInSettings()) hub.addOptions({ title: "Иконки", hint: "Знаки списка сессий: стиль, цвет символов, прыжок", tab: "theme", render: drawSettings });
  else hub.addSettings({ id: "direction-icons", title: "Иконки", render: drawSettings });
  // символы рисуются после загрузки набора — перерисовать, чтобы встали вместо запасного знака
  Promise.all([load("emoji.json"), load("symbols.json")]).then(([e, s]) => { groups = e; symbols = s; repaint(); });
  // клик мимо выбора и Esc закрывают его (путь события: нажатая кнопка к этому моменту может быть уже вне страницы);
  // другая вкладка поменяла знаки или настройки — перерисовать
  document.addEventListener("click", (e) => {
    if (openFor && !e.composedPath().some((n) => n.classList?.contains("di-slot"))) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openFor) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  addEventListener("storage", (e) => { if (e.key === KEY || e.key === SET) repaint(); });
}
