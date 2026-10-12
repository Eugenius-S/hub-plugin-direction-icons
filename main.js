// «Иконки направлений» (владелец 07.10): внутри открытого направления, рядом со статусом, — выбор знака; выбранный стоит
// в списке сессий вместо компаса. Знаки хранятся в этом браузере (localStorage). Места: session.header (кнопка и
// выбор) и sidebar.session (метка, по которой знак встаёт на место компаса в строке; сама метка не видна).
//
// Строку списка и шапку хаб собирает заново на каждом снимке, а root места живёт между снимками: поэтому знак ставим
// после сборки (requestAnimationFrame — до отрисовки, мерцания нет): в строке — вместо знака у имени, в шапке — кнопка
// переезжает перед названием.
//
// Итог хода пришёл, а владелец его ещё не открыл (строка «unread») — знак направления плавно подпрыгивает на 5 px, как
// значок в доке Mac (владелец 12.10). Строку пересобирают на каждом снимке — фазу прыжка берём от часов страницы, чтобы
// новый узел продолжал движение, а не начинал заново.
//
// Стиль знака (владелец 12.10): эмодзи или символ системного шрифта — на Mac SF Symbols (шрифт SF Pro), на Windows
// Segoe Fluent Icons (MDL2 на Windows 10); шрифта нет — стиль «Символы» неактивен. Стиль, цвет символов (свой или
// случайный — постоянный для направления) и прыжок — общие, вкладка «Настройки» → «Иконки направлений»; в направлении —
// только выбор его знака в текущем стиле. У направления хранятся оба знака: { emoji, sym } — смена стиля их не теряет.
const KEY = "hub.directionIcons";
const SET = "hub.directionIcons.settings";
const DEFAULT = "🧭";
const COMPASS = { sf: "100dcc", win: "e812" };   // компас по умолчанию в стиле «Символы»: location.north.circle / MapCompassTop
const HOP = 1600;   // мс: один прыжок и пауза — как длительность анимации di-hop в style.css
const FONTS = {
  sf: '"SF Pro", "SF Pro Text", "SF Pro Display", "SF Compact"',
  win: '"Segoe Fluent Icons", "Segoe MDL2 Assets"',
};
const COLORS = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f", "#8d8d86"];
let hub = null, groups = null, symbols = null, openFor = null, font;

const readJSON = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* нет хранилища */ } };
const icons = () => readJSON(KEY);
// знак направления: строка (до 1.3) — эмодзи; { sym, color } (1.2) — символ, его цвет теперь общий из настроек
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

const glyph = (code) => String.fromCodePoint(parseInt(code, 16));
const codeOf = (sym) => { for (const g of symbols || []) for (const s of g.icons) if (s.n === sym) return s[symbolFont()]; return null; };
function colorOf(name) {
  const c = settings().color;
  if (c) return c;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[h % COLORS.length];   // случайный, но постоянный: от имени направления
}

// знак направления в узел: в стиле «Символы» — символ шрифтом и цветом, иначе эмодзи
function paintIcon(node, name) {
  const e = entry(name), code = symbolStyle() ? (e.sym && codeOf(e.sym)) || COMPASS[symbolFont()] : "";
  node.classList.toggle("di-sym", !!code);
  node.style.fontFamily = code ? FONTS[symbolFont()] : "";
  node.style.color = code ? colorOf(name) : "";
  node.textContent = code ? glyph(code) : e.emoji || DEFAULT;
}

// знак в текущем стиле: эмодзи — e.emoji, символ — e.sym; второй остаётся
function save(name, patch) {
  const all = icons(), e = { ...entry(name), ...patch };
  if (e.emoji === DEFAULT) e.emoji = "";   // компас — по умолчанию, отдельно не хранится
  for (const k of Object.keys(e)) if (!e[k]) delete e[k];
  if (Object.keys(e).length) all[name] = e; else delete all[name];
  writeJSON(KEY, all);
  openFor = null;
  repaint();
}

// перерисовка страницы список обновляет, шапку открытого направления — нет: кнопку и выбор обновляем сами
function repaint() {
  for (const r of document.querySelectorAll(".di-slot")) if (r.dataset.name) {
    paintIcon(r.querySelector(".di-btn"), r.dataset.name);
    r.querySelector(".di-pop")?.remove();
    sync(r);
  }
  if (settingsRoot) paintSettings(settingsRoot);
  hub.redraw ? hub.redraw() : dispatchEvent(new Event("hub-redraw"));
}
// направление — как его видит хаб: не специалист и не хаб, ведёт бэклог или есть в списке направлений
const isDirection = (s, snap) => !!s && s.kind !== "hub" && s.role !== "agent" && (!!s.backlog || (snap?.directions || []).includes(s.name));

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

// ───── список сессий: знак вместо компаса ─────
function paintRow(root) {
  const row = root.closest(".srow"), av = row?.querySelector(".nm .avatar");
  if (!av) return;
  if (root.dataset.icon) {
    av.className = "avatar";   // не знак темы (kit-img): картинкой он не станет
    av.style.backgroundImage = "";
    av.removeAttribute("role");
    av.removeAttribute("aria-label");
    paintIcon(av, root.dataset.name);
  }
  // прыгает, пока итог не прочитан: метку «unread» строке ставит хаб (у открытой сейчас сессии её нет)
  const on = row.classList.contains("unread") && settings().hop;
  av.classList.toggle("di-hop", on);
  av.style.animationDelay = on ? `-${Math.round(performance.now() % HOP)}ms` : "";
}

function renderRow(root, snap, { session }) {
  root.classList.add("di-mark");
  if (!isDirection(session, snap)) { delete root.dataset.icon; return; }
  root.dataset.name = session.name;
  if (symbolStyle() || entry(session.name).emoji) root.dataset.icon = "1"; else delete root.dataset.icon;
  requestAnimationFrame(() => paintRow(root));
}

// ───── шапка направления: кнопка и выбор знака в текущем стиле ─────
function popover(name) {
  const e = entry(name), sym = symbolStyle();
  const pop = hub.el("div", "di-pop");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Иконка направления");
  for (const g of (sym ? symbols : groups) || []) {
    const list = sym ? g.icons.filter((s) => s[symbolFont()]) : g.icons;
    if (!list.length) continue;
    pop.append(hub.el("div", "di-title", g.title));
    const grid = hub.el("div", "di-grid");
    for (const s of list) {
      const b = sym ? button("di-opt di-sym", glyph(s[symbolFont()]), () => save(name, { sym: s.n }))
        : button("di-opt", s, () => save(name, { emoji: s }));
      if (sym) { b.style.fontFamily = FONTS[symbolFont()]; b.style.color = colorOf(name); b.title = s.n; }
      b.setAttribute("aria-pressed", String(sym ? e.sym === s.n : (e.emoji || DEFAULT) === s));
      grid.append(b);
    }
    pop.append(grid);
  }
  const foot = hub.el("div", "di-foot");
  if (!sym) foot.append(button("btn quiet di-own", "Свой знак…", () => {
    const v = (window.prompt("Эмодзи для направления", e.emoji || DEFAULT) || "").trim();
    if (v) save(name, { emoji: [...v].slice(0, 2).join("") });   // один знак, иногда из двух символов (флаг, составной)
  }));
  foot.append(button("btn quiet di-own", "Вернуть компас", () => save(name, sym ? { sym: "" } : { emoji: "" })));
  pop.append(foot, hub.el("div", "di-hint", "Стиль, цвет и прыжок — «Настройки» → «Иконки направлений»"));
  return pop;
}

function renderHead(root, snap, { session }) {
  root.classList.add("di-slot");
  if (!isDirection(session, snap)) { root.replaceChildren(); root.hidden = true; return; }
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
  root.dataset.name = name;
  paintIcon(btn, name);
  btn.title = "Иконка направления — выбрать";
  sync(root);
  requestAnimationFrame(() => {   // слева, перед названием (владелец 07.10), а не у правого края
    const title = root.parentElement?.querySelector(":scope > h2");
    if (title && title.previousElementSibling !== root) title.before(root);
  });
}

function sync(root) {
  const name = root.dataset.name, pop = root.querySelector(".di-pop");
  root.querySelector(".di-btn")?.setAttribute("aria-expanded", String(openFor === name));
  if (openFor === name && !pop) root.append(popover(name));
  else if (openFor !== name && pop) pop.remove();
}

// ───── «Настройки» → «Иконки направлений»: стиль, цвет символов, прыжок ─────
let settingsRoot = null;

function paintSettings(root) {
  settingsRoot = root;
  const s = settings(), f = symbolFont();
  const style = hub.el("div", "seg");
  for (const [id, label] of [["emoji", "Эмодзи"], ["sym", "Символы"]]) {
    const b = button(null, label, () => setSettings({ style: id }));
    b.setAttribute("aria-pressed", String((id === "sym" ? symbolStyle() : !symbolStyle())));
    if (id === "sym" && !f) b.disabled = true;
    style.append(b);
  }
  const rows = [hub.el("div", "di-set-title", "Стиль"), style,
    hub.el("p", "hint", f ? `Символы — ${f === "sf" ? "SF Symbols (шрифт SF Pro)" : "Segoe Fluent Icons"}; знак у каждого направления выбирается в его шапке, кнопкой слева от названия.`
      : "Символов нет: нужен шрифт SF Pro (Mac, developer.apple.com/fonts) или Segoe Fluent Icons (Windows).")];
  if (symbolStyle()) {
    const colors = hub.el("div", "di-colors");
    const rnd = button("di-swatch di-rnd", "", () => setSettings({ color: "" }));
    rnd.title = "Случайный: свой у каждого направления";
    rnd.setAttribute("aria-pressed", String(!s.color));
    colors.append(rnd);
    for (const c of COLORS) {
      const b = button("di-swatch", "", () => setSettings({ color: c }));
      b.style.background = c;
      b.title = c;
      b.setAttribute("aria-pressed", String(s.color === c));
      colors.append(b);
    }
    const own = hub.el("input", "di-swatch di-own-color");
    own.type = "color";
    own.title = "Свой цвет";
    own.value = s.color && !COLORS.includes(s.color) ? s.color : "#888888";
    own.setAttribute("aria-pressed", String(!!s.color && !COLORS.includes(s.color)));
    own.addEventListener("change", () => setSettings({ color: own.value }));
    colors.append(own);
    rows.push(hub.el("div", "di-set-title", "Цвет символов"), colors);
  }
  const hop = hub.el("label", "opt");
  const box = hub.el("input");
  box.type = "checkbox";
  box.checked = s.hop;
  box.addEventListener("change", () => setSettings({ hop: box.checked }));
  hop.append(box, document.createTextNode(" Иконка прыгает, пока итог не прочитан"));
  rows.push(hub.el("div", "di-set-title", "Прыжок"), hop,
    hub.el("p", "hint", "Как значок в доке Mac: направление закончило ход, а вы его ещё не открыли."));
  root.classList.add("di-set");
  root.replaceChildren(...rows);
}

export default function register(h) {
  hub = h;
  hub.addStyle("style.css");
  hub.addSlot("session.header", { id: "pick", order: 5, render: renderHead });
  hub.addSlot("sidebar.session", { id: "mark", render: renderRow });
  hub.addSettings({ id: "direction-icons", title: "Иконки направлений", render: (root) => { if (!root.contains(document.activeElement)) paintSettings(root); } });
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
