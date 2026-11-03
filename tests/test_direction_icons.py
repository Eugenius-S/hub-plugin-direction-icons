"""The "Direction icons" plugin: the manifest, the set of signs and what the behavior rests on. Standard library, no hub,
network or browser. Run: python3 -m unittest discover -s tests"""
import json
import os
import re
import shutil
import struct
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def node_eval(lang, code):
    """Run the STR table and t() from main.js in node for a given hub.lang; `code` is a JS expression, result as JSON."""
    node = shutil.which("node")
    if not node:
        raise unittest.SkipTest("no node")
    js = read("main.js")
    src = js[js.index("const STR = {"):js.index("\n", js.index("const groupTitle"))]
    prog = f"const hub = {{ lang: {json.dumps(lang)} }};\n{src}\nconsole.log(JSON.stringify({code}));"
    r = subprocess.run([node, "-e", prog], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


class Manifest(unittest.TestCase):
    def test_manifest_is_complete(self):
        man = json.loads(read("hub-plugin.json"))
        self.assertEqual((man["name"], man["web"], man["hub"]), ("direction-icons", "main.js", "^1.16"))   # own_icon on a session is 1.16
        for key in ("icon", "description", "why", "version"):
            self.assertTrue(str(man.get(key) or "").strip(), key)
        for key in ("icon", "web"):
            self.assertTrue(os.path.isfile(os.path.join(ROOT, man[key])), man[key])

    def test_description_is_english_with_a_russian_translation(self):
        man = json.loads(read("hub-plugin.json"))
        for key in ("description", "why"):
            self.assertFalse(re.search(r"[\u0400-\u04ff]", man[key]), key)       # the base text is English
            self.assertTrue(re.search(r"[\u0400-\u04ff]", man["i18n"]["ru"][key]), key)


class Emoji(unittest.TestCase):
    def test_set_is_unique_and_has_the_default_compass(self):
        groups = json.loads(read("emoji.json"))
        icons = [i for g in groups for i in g["icons"]]
        self.assertGreaterEqual(len(icons), 60)
        self.assertEqual(len(icons), len(set(icons)))
        self.assertIn("🧭", icons)   # the default hub sign, it can be brought back by a pick
        self.assertTrue(all(g["title"] and g["icons"] for g in groups))


class Symbols(unittest.TestCase):
    def test_set_has_an_outline_svg_path_for_every_symbol(self):
        # the style is emoji or a symbol: an outline Icons8 icon (m_outlined), its path in a 24x24 box, the same on every OS
        groups = json.loads(read("symbols.json"))
        icons = [i for g in groups for i in g["icons"]]
        self.assertTrue(all(g["title"] and g["icons"] for g in groups))
        self.assertGreaterEqual(len(icons), 100)
        self.assertEqual(len({i["n"] for i in icons}), len(icons))
        for i in icons:
            self.assertEqual(set(i), {"n", "d"}, i["n"])
            self.assertRegex(i["d"], r"^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$", i["n"])   # a path, nothing else (it goes into an SVG)
        self.assertEqual(len({i["d"] for i in icons}), len(icons))   # no two names with the same picture
        names = {i["n"] for i in icons}
        for need in ("person", "person.2", "person.3", "house", "hammer", "compass"):
            self.assertIn(need, names)

    def test_symbols_need_no_font(self):
        js = read("main.js")
        for gone in ("Segoe", "SF Pro", "symbolFont", "FONTS", "fontFamily", "hint_nofont"):
            self.assertNotIn(gone, js, gone)
        self.assertIn('createElementNS(SVG, "path")', js)           # drawn from the path of the set
        self.assertIn("const colorOf = () => settings().color;", js)   # no color of its own: the glyph takes the theme color from CSS
        css = read("style.css")
        self.assertIn(".di-svg", css)
        self.assertIn("fill: currentColor", css)
        # the sign is set in the direction; style, color and hop are in Settings
        self.assertNotIn("di-tab", js)

    def test_settings_block_and_every_sidebar_icon(self):
        # a tab of its own wrapped to the second line: a block in the Settings tab (API 1.13), on an old
        # hub a short tab of its own; the style covers all list signs (specialists, directions, workers); the sign
        # can be changed for specialists and directions
        js = read("main.js")
        self.assertIn('hub.addOptions({ title: t("icons")', js)
        self.assertIn('hub.addSettings({ id: "direction-icons", title: t("icons")', js)
        self.assertIn('blockInSettings = () => api(13)', js)
        self.assertIn('tab: "theme"', js)                               # settings are in the theme tab (1.14)
        self.assertIn('kind === "agent" || kind === "direction" || kind === "hub"', js)    # editable, the hub too
        self.assertIn('s.kind === "hub" ? "hub"', js)
        self.assertIn('hub: ["", "house"]', js)                         # the hub has no emoji, its symbol is a house
        self.assertIn('s.role === "agent" ? "agent"', js)
        self.assertIn('"🎨": "paintpalette"', js)                       # the symbol follows the session emoji
        symbols = {i["n"] for g in json.loads(read("symbols.json")) for i in g["icons"]}
        mapped = set(re.findall(r'": "([a-z.]+)"', js[js.index("BY_EMOJI"):js.index("};", js.index("BY_EMOJI"))]))
        self.assertEqual(mapped - symbols, set())                       # every symbol of the map is in the set
        self.assertIn('load("symbols.json")', js)
        # different emoji of the hub specialists and of the picker must not become one symbol (1.9.1: the film strip and
        # the clapperboard were both "film")
        pairs = re.findall(r'"([^"]+)": "([a-z.]+)"', js[js.index("BY_EMOJI"):js.index("};", js.index("BY_EMOJI"))])
        by = dict((e.replace("️", ""), n) for e, n in pairs)
        distinct = ["🎞", "🎬", "🎨", "🪄", "✍", "🧪", "📊",
                    "📷", "🎵", "🎧", "💻", "📱", "🔌", "🔋",
                    "🔧", "🏗", "🧬", "🧾", "🧰", "🛰", "🐱",
                    "🐶", "🍕", "🍎"]
        self.assertEqual(len({by[e] for e in distinct}), len(distinct))


class Source(unittest.TestCase):
    def test_places_and_storage(self):
        js = read("main.js")
        self.assertIn('hub.addSlot("session.header"', js)    # the picker is inside the open direction
        self.assertIn('hub.addSlot("sidebar.session"', js)   # the sign is in the session list
        self.assertIn('"hub.directionIcons"', js)            # kept in this browser
        self.assertNotIn("innerHTML", js)
        self.assertNotIn("eval(", js)

    def test_the_button_stands_before_the_title(self):
        # the icon is on the left, before the direction title (it used to be after the status)
        js = read("main.js")
        self.assertIn('":scope > h2"', js)
        self.assertIn("title.before(root)", js)
        self.assertNotIn("pill.after(root)", js)

    def test_unread_direction_hops_and_can_be_switched_off(self):
        # the result is unread: the sign smoothly hops by 5 px, like in the Mac dock; it can be turned off in settings
        js, css = read("main.js"), read("style.css")
        self.assertIn('classList.contains("unread")', js)
        self.assertIn('s.hop !== false', js)                       # on by default
        self.assertIn('settings().hop', js)
        self.assertIn("translateY(-5px)", css)
        self.assertIn("prefers-reduced-motion", css)
        hop = int(re.search(r"const HOP = (\d+)", js).group(1))
        self.assertIn(f"animation: di-hop {hop}ms infinite", css)  # the phase comes from the page clock: the same duration

    def test_any_unread_sign_hops_not_only_directions(self):
        # a specialist finished a task: its sign hops too (only directions used to hop)
        js = read("main.js")
        on = re.search(r"const on = (.+);", js).group(1)
        self.assertNotIn('kind === "direction"', on)
        self.assertIn('classList.contains("unread")', on)

    def test_the_emoji_lives_in_the_core(self):
        # 1.7.0: the session icon belongs to the core (POST /api/session/icon, own_icon);
        # the plugin writes the emoji there and does not override it with one from localStorage
        js = read("main.js")
        self.assertIn('hub.post("/api/session/icon"', js)
        self.assertNotIn("e.emoji || base", js)                    # the list and header show the core icon, not a local one
        self.assertNotIn("entry(", js)
        self.assertNotIn("emoji: [...v]", js)                      # "Custom sign..." does not write to localStorage

    def test_one_picker_in_the_header(self):
        # the hub v1.1 header has an icon with a palette of its own (.head-av): the plugin button hides it instead of standing next to it
        self.assertIn(".di-slot:not([hidden]) ~ h2 .head-av { display: none; }", read("style.css"))

    def test_a_newer_core_icon_beats_the_local_symbol(self):
        # a symbol remembers the core emoji it was picked at (for); the core icon changed: the symbol yields
        js = read("main.js")
        self.assertIn("e.for === base", js)
        self.assertIn("{ sym, for: base }", js)

    def test_old_local_emoji_moves_to_the_core_once(self):
        # an emoji of older versions goes to the core if it has no icon of its own there; it has one: the core is newer, the local one is dropped
        js = read("main.js")
        self.assertIn("function migrate(snap)", js)
        self.assertIn("if (s.own_icon || e.emoji === s.icon)", js)
        self.assertIn('"own_icon" in s', js)                       # an old hub without core icons: leave it alone
        self.assertIn("asked.has(s.name)", js)                     # a core refusal is not repeated

    def test_javascript_parses(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("no node")
        r = subprocess.run([node, "--input-type=module", "--check"], input=read("main.js"), capture_output=True,
                           text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stderr)


class CleanAvatars(unittest.TestCase):
    """The Clean theme: its own character avatars in the feed. The plugin adds a set of avatars to the picker and keeps the
    theme's own picture; in the standard theme nothing changes."""

    def names(self):
        names = json.loads(read("avatars.json"))
        self.assertIsInstance(names, list)
        return names

    def test_every_listed_avatar_is_a_png_file_of_the_plugin(self):
        # the page serves only .html .css .js .svg .json .png .woff2 from /ext/<plugin>/, so the set is png (a jpg is not served)
        names = self.names()
        self.assertGreaterEqual(len(names), 4)
        self.assertEqual(len(names), len(set(names)))
        for n in names:
            self.assertRegex(n, r"^[a-z0-9]+(-[a-z0-9]+)*\.png$", n)
            with open(os.path.join(ROOT, "avatars", n), "rb") as f:
                head = f.read(24)
            self.assertEqual(head[:8], b"\x89PNG\r\n\x1a\n", n)
            self.assertEqual(struct.unpack(">II", head[16:24]), (160, 160), n)   # the size of the theme set (160x160)

    def test_no_file_outside_the_list(self):
        on_disk = set(os.listdir(os.path.join(ROOT, "avatars")))
        self.assertEqual(on_disk - set(self.names()), set())      # adding is "put the files and the list", no orphans

    def test_the_set_is_loaded_and_offered_only_in_clean(self):
        js = read("main.js")
        self.assertIn('const inClean = () => document.documentElement.classList.contains("th-clean")', js)
        self.assertIn('load("avatars.json")', js)
        self.assertRegex(js, r'if \(inClean\(\)\) \{[^}]*t\("avatars"\)')      # the group is built under the Clean check
        self.assertIn('"hub.directionIcons.img"', js)             # the choice has a key of its own, the old records stay as they were

    def test_the_standard_theme_stays_as_before(self):
        js, css = read("main.js"), read("style.css")
        self.assertNotIn("di-row-av", js + css)                   # the row has no picture of its own any more, in Clean it is the same outline symbol
        for sel in re.findall(r"^([^\n{]*\.di-(?:img|av)[^\n{]*)\{", css, re.M):
            self.assertIn("th-clean", sel, sel)                   # every rule of the avatars is Clean-only (the rest of the CSS is old)
        self.assertRegex(css, r"html\.th-clean \.di-btn \{[^}]*width")

    def test_clean_shows_the_outline_symbol_in_the_list_again(self):
        # 02.11: clean.css hides `.list .srow .nm > .avatar` (only the Hub row is its exception), so the list had no icons
        css = read("style.css")
        rule = re.search(r"html\.th-clean \.list \.srow \.nm > \.avatar\.di-sym \{([^}]*)\}", css)
        self.assertIsNotNone(rule)                                # one class more than the theme's own selector, no !important
        self.assertIn("display: inline-flex", rule.group(1))
        self.assertIn("var(--c-t2, var(--muted-foreground))", rule.group(1))   # the gray of the theme, not our own palette
        self.assertNotIn("!important", rule.group(1))             # the picker rules above have it, the row does not need it
        self.assertIn("html.th-clean .list .srow .nm:has(> .avatar.di-sym, > .avatar.di-pic)", css)

    def test_the_theme_picture_is_replaced_only_where_the_theme_drew_it(self):
        js = read("main.js")
        self.assertIn('.byline .av[data-clean-av]', js)           # the feed avatar of the theme, never a letter or an emoji of the core
        self.assertIn('.byline .av.kit-img', js)                  # and the picture of a theme emoji, which the core draws as background-image
        self.assertIn('.reply-box[data-clean]', js)
        self.assertIn("node.dataset.diImg = \"\"", js)            # what we replaced is marked, so a reset gives the theme picture back
        self.assertIn('"diImg" in node.dataset', js)              # the marker is an empty string: it is checked by key (a falsy value lost the reset)
        self.assertIn('addEventListener("hub-theme"', js)

    def test_sixteen_base_avatars_come_after_the_other_colored_ones(self):
        # the picker is one grid of 8 columns: 24 colored (3 rows) then 16 base (2 rows); the base files start with "base-"
        names = self.names()
        base = [n for n in names if n.startswith("base-")]
        self.assertEqual(len(base), 16)
        self.assertEqual(len(names) - len(base), 24)
        self.assertEqual(names[24:], base)                        # the base rows are the last two

    def test_a_direction_defaults_to_a_base_avatar_and_a_picked_one_stays(self):
        js = read("main.js")
        self.assertIn('f.startsWith("base-")', js)
        self.assertRegex(js, r'kind === "direction" && base\.length')   # only a direction, only when the set has base ones
        self.assertIn("base[hashOf(name) % base.length]", js)     # by a hash of the name, stable per session
        self.assertIn("imgOf(name, s.icon || (kind ? ROLE[kind][0] : \"\")) || defaultImg(name, kind)", js)   # the picked avatar comes first in the feed
        self.assertIn("const picked = imgOf(name, base);", js)    # and in the button
        self.assertIn('"diImg" in node.dataset', js)              # a reset still gives the theme picture back

    def test_the_strings_of_the_set(self):
        self.assertEqual(node_eval("en", 't("avatars")'), "Avatars")
        self.assertEqual(node_eval("ru", 't("avatars")'), "Аватарки")


def node_run(body):
    """Run main.js in node with a fake localStorage and hub; `body` is JS that ends in console.log(JSON.stringify(...))."""
    node = shutil.which("node")
    if not node:
        raise unittest.SkipTest("no node")
    js = read("main.js").replace("export default function register", "function register")
    prog = (
        "const store = {}; const localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };\n"
        "const document = { documentElement: { classList: { contains: () => globalThis.CLEAN } } };\n"
        "globalThis.CLEAN = true;\n"
        + js + "\nhub = { url: (f) => f, snapshot: () => ({ sessions: [] }), redraw() {} };\n"
        "avatars = ['a.png', 'b.png', 'base-1.png']; symbols = [{ title: 'x', icons: [{ n: 'house', d: 'M0' }, { n: 'doc.text', d: 'M1' }] }];\n"
        "repaint = () => {};\n" + body)
    r = subprocess.run([node, "-e", prog], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


class PickOneSign(unittest.TestCase):
    """Owner 02.11: an avatar and an outline symbol can both be picked; the pick stands in the list and in the header, and
    picking one drops the other."""

    def test_picking_an_avatar_drops_the_symbol_and_the_header_shows_it(self):
        r = node_run("saveSym('x', 'house', '🧭'); saveImg('x', 'a.png', '🧭');"
                     "console.log(JSON.stringify({ sym: symOf('x', '🧭'), img: imgOf('x', '🧭'), pic: cleanPic('x', '🧭', 'direction') }));")
        self.assertEqual(r, {"sym": "", "img": "a.png", "pic": 'url("avatars/a.png")'})

    def test_picking_a_symbol_drops_the_avatar_and_the_header_shows_the_symbol(self):
        r = node_run("saveImg('x', 'a.png', '🧭'); saveSym('x', 'house', '🧭');"
                     "console.log(JSON.stringify({ sym: symOf('x', '🧭'), img: imgOf('x', '🧭'), pic: cleanPic('x', '🧭', 'direction') }));")
        self.assertEqual(r, {"sym": "house", "img": "", "pic": ""})   # no picture: the button draws the symbol, even over a base avatar

    def test_reset_gives_the_default_back(self):
        r = node_run("saveImg('x', 'a.png', '🧭'); saveImg('x', '', '🧭');"
                     "console.log(JSON.stringify({ img: imgOf('x', '🧭'), pic: cleanPic('x', '🧭', 'direction') }));")
        self.assertEqual(r["img"], "")
        self.assertNotEqual(r["pic"], 'url("avatars/a.png")')

    def test_the_picker_lights_only_the_real_pick(self):
        js = read("main.js")
        self.assertIn("!imgOf(name, base) && symOf(name, base) === s.n", js)   # not the look() fallback symbol, not under an avatar

    def test_the_picked_avatar_stands_in_the_list_row(self):
        js, css = read("main.js"), read("style.css")
        self.assertIn('av.className = "avatar di-pic"', js)
        self.assertRegex(css, r"html\.th-clean \.list \.srow \.nm > \.avatar\.di-pic \{[^}]*width: 24px")

    def test_a_specialist_shows_the_theme_picture_in_the_list_a_direction_the_outline(self):
        """02.11 (d463226): Clean shows monsters for specialists and gray outline icons for directions."""
        theme = "store['hub.theme'] = JSON.stringify({ theme: { avatars_url: { '🧭': 'k/compass.png', p1: 'k/m1.jpg', p2: 'k/m2.jpg' } } });"
        r = node_run(theme + "console.log(JSON.stringify({"
                     "agent: rowPic('s', 'agent', '🤖', false), direction: rowPic('d', 'direction', '🧭', false),"
                     "own: rowPic('s', 'agent', '🤖', true), hub: rowPic('h', 'hub', '🏠', false) }));")
        self.assertTrue(r["agent"].startswith('url("k/m'), r)
        self.assertEqual((r["direction"], r["own"], r["hub"]), ("", "", ""))

    def test_a_picked_symbol_or_avatar_beats_the_theme_picture_of_a_specialist(self):
        theme = "store['hub.theme'] = JSON.stringify({ theme: { avatars_url: { p1: 'k/m1.jpg' } } });"
        r = node_run(theme + "saveSym('s', 'house', '🤖'); const a = rowPic('s', 'agent', '🤖', false);"
                     "saveImg('s', 'a.png', '🤖'); const b = rowPic('s', 'agent', '🤖', false);"
                     "console.log(JSON.stringify({ a, b }));")
        self.assertEqual(r, {"a": "", "b": 'url("avatars/a.png")'})

    def test_the_row_remembers_an_emoji_the_owner_picked_in_the_core(self):
        self.assertIn('if (session.own_icon) root.dataset.own = "1"', read("main.js"))

    def test_the_outline_glyph_of_the_list_is_a_little_smaller(self):
        css = read("style.css")
        rule = re.search(r"html\.th-clean \.list \.srow \.nm > \.avatar\.di-sym \{([^}]*)\}", css)
        self.assertIsNotNone(rule)
        self.assertIn("font-size: 16px", rule.group(1))


class ThemeLook(unittest.TestCase):
    """02.11 (d452796): the list signs are outline symbols in the style and color of the theme."""

    def test_outline_is_the_default_and_emoji_stays_a_choice(self):
        js = read("main.js")
        self.assertIn('style: s.style === "emoji" ? "emoji" : "sym"', js)
        self.assertIn('color: s.cv === 2 && typeof s.color === "string" ? s.color : ""', js)   # no random palette: empty means the theme color

    def test_a_color_saved_by_an_older_version_is_the_theme_color_again(self):
        """02.11 (d455064): the owner's old #0090ff pick turned every list icon blue once Clean showed them."""
        node = shutil.which("node")
        if not node:
            self.skipTest("no node")
        js = read("main.js")
        src = js[js.index("function settings()"):js.index("const symbolStyle")]
        prog = ("let store = {}; const SET = 'k'; const readJSON = () => store; const writeJSON = (k, v) => { store = v; };"
                "const repaint = () => {};" + src + "const out = [];"
                "store = { style: 'sym', color: '#0090ff', hop: true }; out.push(settings().color);"
                "setSettings({ hop: false }); out.push(settings().color);"
                "setSettings({ color: '#e5484d' }); out.push(settings().color);"
                "console.log(JSON.stringify(out));")
        r = subprocess.run([node, "-e", prog], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout), ["", "", "#e5484d"])

    def test_the_color_comes_from_the_theme_tokens(self):
        css = read("style.css")
        self.assertRegex(css, r"\.srow \.avatar\.di-sym \{ color: var\(--muted-foreground\); \}")
        self.assertRegex(css, r'\.srow\[aria-current="true"\] \.avatar\.di-sym \{ color: var\(--foreground\); \}')

    def test_a_theme_icon_of_the_same_name_is_drawn_as_a_mask(self):
        js, css = read("main.js"), read("style.css")
        self.assertIn('themeFiles("icons_url")', js)
        self.assertIn("const themeIcon = (sym)", js)
        self.assertIn('node.style.setProperty("--di-kit"', js)
        self.assertIn('hub.el("span", "di-mask")', js)
        rule = re.search(r"\.di-mask \{([^}]*)\}", css)
        self.assertIsNotNone(rule)
        self.assertIn("background: currentColor", rule.group(1))
        self.assertIn("mask: var(--di-kit)", rule.group(1))

    def test_the_theme_change_repaints_without_a_reload(self):
        js = read("main.js")
        self.assertIn('addEventListener("hub-theme", repaint)', js)

    def test_one_monochrome_glyph_no_dot_no_badge_no_plate(self):
        js, css = read("main.js"), read("style.css")
        block = re.findall(r"[^\n]*\.avatar\.di-sym[^\n]*(?:\n[^\n{}]*)?", css)
        self.assertTrue(block)
        for line in block:
            for bad in ("background", "border", "box-shadow", "::before", "::after", "radius"):
                self.assertNotIn(bad, line, line)
        for bad in ("di-dot", "di-badge", "di-plate"):
            self.assertNotIn(bad, js + css, bad)

    def test_manifest_descriptions_fit_the_catalog_limit(self):
        man = json.loads(read("hub-plugin.json"))
        self.assertLessEqual(len(man["description"]), 300)
        self.assertLessEqual(len(man["i18n"]["ru"]["description"]), 300)
        self.assertEqual(man["version"], "1.14.1")


class Languages(unittest.TestCase):
    def test_both_tables_have_the_same_keys(self):
        en, ru = node_eval("en", "[Object.keys(STR.en).sort(), Object.keys(STR.ru).sort()]")
        self.assertEqual(en, ru)

    def test_english_is_the_default(self):
        for lang in ("en", "de", "uk", "xx", ""):
            self.assertEqual(node_eval(lang, 't("reset")'), "Reset", lang)
            self.assertEqual(node_eval(lang, 'groupTitle({ title: "Work" })'), "Work", lang)

    def test_russian_when_the_hub_is_russian(self):
        self.assertEqual(node_eval("ru", 't("reset")'), "Как было")
        self.assertEqual(node_eval("ru", 'groupTitle({ title: "Work" })'), "Работа")
        self.assertEqual(node_eval("ru", 't("foot_hint", { tab: t("tab_look") })'),
                         "Стиль, цвет и прыжок: «Настройки» → «Вид»")

    def test_language_is_read_at_use_time(self):
        js = read("main.js")
        self.assertIn("hub?.lang", js)                             # read on every call, not once at module load
        self.assertNotRegex(js, r"const lang = hub")

    def test_substitution_and_fallback_to_the_key(self):
        self.assertEqual(node_eval("en", 't("foot_hint", { tab: "Look" })'), "Style, color and hop: Settings → Look")
        self.assertEqual(node_eval("en", 't("no_such_key")'), "no_such_key")

    def test_group_titles_have_russian_names(self):
        titles = {g["title"] for f in ("emoji.json", "symbols.json") for g in json.loads(read(f))}
        ru = node_eval("ru", "Object.keys(STR.ru.groups)")
        self.assertEqual(titles - set(ru), set())                  # every group title has a Russian name


class PickerScroll(unittest.TestCase):
    """The hub rebuilds the header on every snapshot: the slot root is detached and put back, and a detached scroller loses
    its position. The open picker must keep where the owner scrolled it. A real page in headless Chrome (HUB_TEST_CHROME,
    else the usual places of chrome-headless-shell); none: skipped."""

    @staticmethod
    def chrome():
        import glob
        env = os.environ.get("HUB_TEST_CHROME")
        if env and os.path.isfile(env):
            return env
        for pat in ("~/.config/hub-core/chrome-headless-shell/**/chrome-headless-shell",
                    "~/.cache/puppeteer/chrome-headless-shell/*/*/chrome-headless-shell",
                    "~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell",
                    "~/.cache/ms-playwright/chromium_headless_shell-*/*/headless_shell"):
            found = sorted(glob.glob(os.path.expanduser(pat), recursive=True))
            if found:
                return found[-1]
        return None

    def run_page(self):
        import functools
        import http.server
        import tempfile
        import threading
        import time
        chrome = self.chrome()
        if not chrome:
            raise unittest.SkipTest("no chrome-headless-shell")
        got = []

        class Page(http.server.SimpleHTTPRequestHandler):   # the page posts its result here
            def log_message(self, *a):
                pass

            def do_POST(self):
                got.append(self.rfile.read(int(self.headers.get("Content-Length") or 0)).decode("utf-8"))
                self.send_response(204)
                self.end_headers()
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Page, directory=ROOT))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as prof:   # Chrome may still write as it dies
                proc = subprocess.Popen([chrome, "--no-sandbox", f"--user-data-dir={prof}", "--window-size=800,700",
                                         f"http://127.0.0.1:{srv.server_address[1]}/tests/page/scroll.html"],
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try:
                    end = time.time() + 40
                    while not got and time.time() < end and proc.poll() is None:
                        time.sleep(0.1)
                finally:
                    proc.kill()
                    proc.wait()
        finally:
            srv.shutdown()
            srv.server_close()
        self.assertTrue(got, "the page did not report")
        return json.loads(got[0])

    def test_open_picker_keeps_its_scroll_when_the_header_is_rebuilt(self):
        out = self.run_page()
        self.assertNotIn("error", out)
        self.assertTrue(out["opened"] and out["scrollable"], out)
        self.assertGreater(out["before"], 100, out)               # the harness did scroll the picker
        self.assertTrue(out["stillOpen"], out)
        self.assertEqual(out["after"], out["before"], out)


if __name__ == "__main__":
    unittest.main()
