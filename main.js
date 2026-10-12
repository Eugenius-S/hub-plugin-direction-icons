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
const KEY = "hub.directionIcons";
const DEFAULT = "🧭";
const HOP = 1600;   // мс: один прыжок и пауза — как длительность анимации di-hop в style.css
let hub = null, groups = null, openFor = null;

const icons = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const iconOf = (name) => (typeof icons()[name] === "string" && icons()[name]) || "";
function setIcon(name, value) {
  const all = icons();
  if (value && value !== DEFAULT) all[name] = value; else delete all[name];   // компас — по умолчанию, отдельно не хранится
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* нет хранилища */ }
  openFor = null;
  // перерисовка страницы список обновляет, шапку открытого направления — нет: кнопку обновляем сами
  for (const r of document.querySelectorAll(".di-slot")) if (r.dataset.name === name) r.querySelector(".di-btn").textContent = iconOf(name) || DEFAULT;
  hub.redraw ? hub.redraw() : dispatchEvent(new Event("hub-redraw"));
}
// направление — как его видит хаб: не специалист и не хаб, ведёт бэклог или есть в списке направлений
const isDirection = (s, snap) => !!s && s.kind !== "hub" && s.role !== "agent" && (!!s.backlog || (snap?.directions || []).includes(s.name));

async function loadGroups() {
  try {
    const r = await fetch(hub.url("emoji.json"));
    groups = r.ok ? await r.json() : [];
  } catch { groups = []; }
}

// ───── список сессий: знак вместо компаса ─────
function paintRow(root) {
  const icon = root.dataset.icon;
  const av = root.closest(".srow")?.querySelector(".nm .avatar");
  if (!icon || !av) return;
  av.className = "avatar";   // не знак темы (kit-img): картинкой он не станет
  av.style.backgroundImage = "";
  av.removeAttribute("role");
  av.removeAttribute("aria-label");
  av.textContent = icon;
}

const hops = () => (hub.option ? hub.option("hop") : true);   // до API 1.12 галочек нет — прыжок включён

// прыгает, пока итог не прочитан: метку «unread» строке ставит хаб (у открытой сейчас сессии её нет)
function hopRow(root) {
  const row = root.closest(".srow"), av = row?.querySelector(".nm .avatar");
  if (!av) return;
  const on = row.classList.contains("unread") && hops();
  av.classList.toggle("di-hop", on);
  av.style.animationDelay = on ? `-${Math.round(performance.now() % HOP)}ms` : "";
}

function renderRow(root, snap, { session }) {
  root.classList.add("di-mark");
  const direction = isDirection(session, snap);
  const icon = direction ? iconOf(session.name) : "";
  if (icon) root.dataset.icon = icon; else delete root.dataset.icon;
  if (direction) requestAnimationFrame(() => { if (icon) paintRow(root); hopRow(root); });
}

// ───── шапка направления: кнопка и выбор ─────
function pick(root, name, value) {
  setIcon(name, value);
  root.querySelector(".di-pop")?.remove();
}

function popover(root, name) {
  const pop = hub.el("div", "di-pop");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Иконка направления");
  for (const g of groups || []) {
    pop.append(hub.el("div", "di-title", g.title));
    const grid = hub.el("div", "di-grid");
    for (const e of g.icons) {
      const b = hub.el("button", "di-opt", e);
      b.type = "button";
      b.setAttribute("aria-pressed", String((iconOf(name) || DEFAULT) === e));
      b.addEventListener("click", () => pick(root, name, e));
      grid.append(b);
    }
    pop.append(grid);
  }
  const own = hub.el("button", "btn quiet di-own", "Свой знак…");
  own.type = "button";
  own.addEventListener("click", () => {
    const v = (window.prompt("Эмодзи для направления", iconOf(name) || DEFAULT) || "").trim();
    if (v) pick(root, name, [...v].slice(0, 2).join(""));   // один знак, иногда из двух символов (флаг, составной)
  });
  const reset = hub.el("button", "btn quiet di-own", "Вернуть компас");
  reset.type = "button";
  reset.addEventListener("click", () => pick(root, name, ""));
  const foot = hub.el("div", "di-foot");
  foot.append(own, reset);
  pop.append(foot);
  return pop;
}

function renderHead(root, snap, { session }) {
  root.classList.add("di-slot");
  if (!isDirection(session, snap)) { root.replaceChildren(); root.hidden = true; return; }
  root.hidden = false;
  const name = session.name;
  let btn = root.querySelector(".di-btn");
  if (!btn) {
    btn = hub.el("button", "di-btn");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFor = openFor === root.dataset.name ? null : root.dataset.name;
      sync(root);
    });
    root.replaceChildren(btn);
  }
  root.dataset.name = name;
  btn.textContent = iconOf(name) || DEFAULT;
  btn.title = "Иконка направления — выбрать";
  btn.setAttribute("aria-expanded", String(openFor === name));
  sync(root);
  requestAnimationFrame(() => {   // слева, перед названием (владелец 07.10), а не у правого края
    const title = root.parentElement?.querySelector(":scope > h2");
    if (title && title.previousElementSibling !== root) title.before(root);
  });
}

function sync(root) {
  const name = root.dataset.name, pop = root.querySelector(".di-pop");
  root.querySelector(".di-btn")?.setAttribute("aria-expanded", String(openFor === name));
  if (openFor === name && !pop) root.append(popover(root, name));
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
  loadGroups();
  // клик мимо выбора и Esc закрывают его; другая вкладка поменяла знаки — перерисовать
  document.addEventListener("click", (e) => {
    if (openFor && !e.target.closest?.(".di-slot")) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openFor) { openFor = null; document.querySelectorAll(".di-slot").forEach(sync); }
  });
  addEventListener("storage", (e) => { if (e.key === KEY) hub.redraw ? hub.redraw() : dispatchEvent(new Event("hub-redraw")); });
}
