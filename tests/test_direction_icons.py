"""The "Direction icons" plugin: the manifest, the set of signs and what the behavior rests on. Standard library, no hub,
network or browser. Run: python3 -m unittest discover -s tests"""
import json
import os
import re
import shutil
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
        self.assertIn("COLORS[h % COLORS.length]", js)
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
                         "Стиль, цвет и прыжок — «Настройки» → «Тема»")

    def test_language_is_read_at_use_time(self):
        js = read("main.js")
        self.assertIn("hub?.lang", js)                             # read on every call, not once at module load
        self.assertNotRegex(js, r"const lang = hub")

    def test_substitution_and_fallback_to_the_key(self):
        self.assertEqual(node_eval("en", 't("foot_hint", { tab: "Look" })'), "Style, color and hop — Settings → Look")
        self.assertEqual(node_eval("en", 't("no_such_key")'), "no_such_key")

    def test_group_titles_have_russian_names(self):
        titles = {g["title"] for f in ("emoji.json", "symbols.json") for g in json.loads(read(f))}
        ru = node_eval("ru", "Object.keys(STR.ru.groups)")
        self.assertEqual(titles - set(ru), set())                  # every group title has a Russian name


if __name__ == "__main__":
    unittest.main()
