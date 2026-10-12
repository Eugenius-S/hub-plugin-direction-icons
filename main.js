// «Иконки направлений» (владелец 07.10): внутри открытого направления, рядом со статусом, — выбор знака; выбранный стоит
// в списке сессий вместо компаса. Знаки хранятся в этом браузере (localStorage). Места: session.header (кнопка и
// выбор) и sidebar.session (метка, по которой знак встаёт на место компаса в строке; сама метка не видна).
//
// Строку списка и шапку хаб собирает заново на каждом снимке, а root места живёт между снимками: поэтому знак ставим
// после сборки (requestAnimationFrame — до отрисовки, мерцания нет): в строке — вместо знака у имени, в шапке — кнопка
// переезжает перед названием.
//
// Итог хода пришёл, а владелец его ещё не открыл (строка «unread») — знак направления плавно подпрыгивает на 5 px, как
// значок в доке Mac (владелец 12.10); выключается галочкой в «Настройках». Строку пересобирают на каждом снимке — фазу
// прыжка берём от часов страницы, чтобы новый узел продолжал движение, а не начинал заново.
//
// Стиль знака (владелец 12.10): эмодзи или символ системного шрифта — на Mac SF Symbols (шрифт SF Pro), на Windows
// Segoe Fluent Icons (MDL2 на Windows 10); шрифта нет — вкладка «Символы» неактивна. У символа свой цвет или случайный
// (постоянный для направления). Значение в хранилище: строка — эмодзи, { sym, color } — символ (color "" — случайный).
const KEY = "hub.directionIcons";
const DEFAULT = "🧭";
const HOP = 1600;   // мс: один прыжок и пауза — как длительность анимации di-hop в style.css
const FONTS = {
  sf: '"SF Pro", "SF Pro Text", "SF Pro Display", "SF Compact"',
  win: '"Segoe Fluent Icons", "Segoe MDL2 Assets"',
};
const COLORS = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f", "#8d8d86"];
let hub = null, groups = null, symbols = null, openFor = null, font;

const icons = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const valueOf = (name) => icons()[name];
const emojiOf = (name) => (typeof valueOf(name) === "string" && valueOf(name)) || "";
const symOf = (name) => { const v = valueOf(name); return v && typeof v === "object" && typeof v.sym === "string" ? v : null; };

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

const codeOf = (sym) => { for (const g of symbols || []) for (const s of g.icons) if (s.n === sym) return s[symbolFont()]; return null; };
const charOf = (sym) => { const c = codeOf(sym); return c ? String.fromCodePoint(parseInt(c, 16)) : ""; };
function colorOf(name, v) {
  if (v.color) return v.color;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[h % COLORS.length];   // случайный, но постоянный: от имени направления
}

// знак направления в узел: эмодзи текстом или символ своим шрифтом и цветом
function paintIcon(node, name) {
  const v = symOf(name), ch = v && symbolFont() && symbols ? charOf(v.sym) : "";
  node.classList.toggle("di-sym", !!ch);
  node.style.fontFamily = ch ? FONTS[symbolFont()] : "";
  node.style.color = ch ? colorOf(name, v) : "";
  node.textContent = ch || emojiOf(name) || DEFAULT;
}

function save(name, value, close = true) {
  const all = icons();
  if (value && value !== DEFAULT) all[name] = value; else delete all[name];   // компас — по умолчанию, отдельно не хранится
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* нет хранилища */ }
  if (close) openFor = null;
  // перерисовка страницы список обновляет, шапку открытого направления — нет: кнопку и выбор обновляем сами
  for (const r of document.querySelectorAll(".di-slot")) if (r.dataset.name === name) {
    paintIcon(r.querySelector(".di-btn"), name);
    r.querySelector(".di-pop")?.remove();
    sync(r);
  }
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

// ───── список сессий: знак вместо компаса ─────
const hops = () => (hub.option ? hub.option("hop") : true);   // до API 1.12 галочек нет — прыжок включён

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
  const on = row.classList.contains("unread") && hops();
  av.classList.toggle("di-hop", on);
  av.style.animationDelay = on ? `-${Math.round(performance.now() % HOP)}ms` : "";
}

function renderRow(root, snap, { session }) {
  root.classList.add("di-mark");
  if (!isDirection(session, snap)) { delete root.dataset.icon; return; }
  root.dataset.name = session.name;
  if (valueOf(session.name)) root.dataset.icon = "1"; else delete root.dataset.icon;
  requestAnimationFrame(() => paintRow(root));
}

// ───── шапка направления: кнопка и выбор ─────
function button(cls, text, onClick) {
  const b = hub.el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function emojiTab(pop, name) {
  for (const g of groups || []) {
    pop.append(hub.el("div", "di-title", g.title));
    const grid = hub.el("div", "di-grid");
    for (const e of g.icons) {
      const b = button("di-opt", e, () => save(name, e));
      b.setAttribute("aria-pressed", String(!symOf(name) && (emojiOf(name) || DEFAULT) === e));
      grid.append(b);
    }
    pop.append(grid);
  }
  const own = button("btn quiet di-own", "Свой знак…", () => {
    const v = (window.prompt("Эмодзи для направления", emojiOf(name) || DEFAULT) || "").trim();
    if (v) save(name, [...v].slice(0, 2).join(""));   // один знак, иногда из двух символов (флаг, составной)
  });
  const reset = button("btn quiet di-own", "Вернуть компас", () => save(name, ""));
  const foot = hub.el("div", "di-foot");
  foot.append(own, reset);
  pop.append(foot);
}

function symbolTab(pop, name, state) {
  const cur = symOf(name), fam = FONTS[symbolFont()];
  const colors = hub.el("div", "di-colors");
  const pickColor = (c) => { state.color = c; if (cur) save(name, { sym: cur.sym, color: c }, false); else redrawPop(pop, name, state); };
  const rnd = button("di-swatch di-rnd", "", () => pickColor(""));
  rnd.title = "Случайный: свой у каждого направления";
  rnd.setAttribute("aria-pressed", String(!state.color));
  colors.append(rnd);
  for (const c of COLORS) {
    const s = button("di-swatch", "", () => pickColor(c));
    s.style.background = c;
    s.title = c;
    s.setAttribute("aria-pressed", String(state.color === c));
    colors.append(s);
  }
  const own = hub.el("input", "di-swatch di-own-color");
  own.type = "color";
  own.title = "Свой цвет";
  own.value = state.color && !COLORS.includes(state.color) ? state.color : "#888888";
  own.setAttribute("aria-pressed", String(!!state.color && !COLORS.includes(state.color)));
  own.addEventListener("change", () => pickColor(own.value));
  colors.append(own);
  pop.append(hub.el("div", "di-title", "Цвет"), colors);
  const color = colorOf(name, { color: state.color });
  for (const g of symbols || []) {
    const list = g.icons.filter((s) => s[symbolFont()]);
    if (!list.length) continue;
    pop.append(hub.el("div", "di-title", g.title));
    const grid = hub.el("div", "di-grid");
    for (const s of list) {
      const b = button("di-opt di-sym", String.fromCodePoint(parseInt(s[symbolFont()], 16)), () => save(name, { sym: s.n, color: state.color }));
      b.style.fontFamily = fam;
      b.style.color = color;
      b.title = s.n;
      b.setAttribute("aria-pressed", String(cur?.sym === s.n));
      grid.append(b);
    }
    pop.append(grid);
  }
}

function redrawPop(pop, name, state) {
  const fresh = popover(name, state);
  pop.replaceWith(fresh);
}

function popover(name, state = null) {
  const cur = symOf(name);
  state = state || { tab: cur && symbolFont() ? "sym" : "emoji", color: cur?.color || "" };
  const pop = hub.el("div", "di-pop");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Иконка направления");
  const tabs = hub.el("div", "di-tabs");
  for (const [id, label] of [["emoji", "Эмодзи"], ["sym", "Символы"]]) {
    const t = button("di-tab", label, () => { state.tab = id; redrawPop(pop, name, state); });
    t.setAttribute("aria-pressed", String(state.tab === id));
    if (id === "sym" && !symbolFont()) {
      t.disabled = true;
      t.title = "Нет шрифта символов: на Mac — SF Pro (developer.apple.com/fonts), на Windows — Segoe Fluent Icons";
    }
    tabs.append(t);
  }
  pop.append(tabs);
  if (state.tab === "sym" && symbolFont()) symbolTab(pop, name, state); else emojiTab(pop, name);
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

export default function register(h) {
  hub = h;
  hub.addStyle("style.css");
  hub.addSlot("session.header", { id: "pick", order: 5, render: renderHead });
  hub.addSlot("sidebar.session", { id: "mark", render: renderRow });
  hub.addOptions?.({ title: "Иконки направлений", options: [
    { key: "hop", label: "Иконка прыгает, пока итог не прочитан", hint: "Как значок в доке Mac: направление закончило ход, а вы его ещё не открыли", on: true },
  ] });
  // символы рисуются после загрузки набора — перерисовать, чтобы встали вместо запасного знака
  Promise.all([load("emoji.json"), load("symbols.json")]).then(([e, s]) => {
    groups = e; symbols = s;
    hub.redraw ? hub.redraw() : dispatchEvent(new Event("hub-redraw"));
    for (const r of document.querySelectorAll(".di-slot")) if (r.dataset.name) paintIcon(r.querySelector(".di-btn"), r.dataset.name);
  });
  // клик мимо выбора и Esc закрывают его; другая вкладка поменяла знаки — перерисовать
  document.addEventListener("click", (e) => {
    // путь события, а не target: вкладка и цвет перестраивают выбор, и нажатая кнопка к этому моменту уже вне страницы
    if (openFor && !e.composedPath().some((n) => n.classList?.contains("di-slot"))) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openFor) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  addEventListener("storage", (e) => { if (e.key === KEY) hub.redraw ? hub.redraw() : dispatchEvent(new Event("hub-redraw")); });
}
