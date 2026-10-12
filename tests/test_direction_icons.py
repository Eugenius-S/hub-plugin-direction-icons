"""Плагин «Иконки направлений»: манифест, набор знаков и то, на чём держится поведение. Стандартная библиотека, без
хаба, сети и браузера. Запуск: python3 -m unittest discover -s tests"""
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


class Manifest(unittest.TestCase):
    def test_manifest_is_complete(self):
        man = json.loads(read("hub-plugin.json"))
        self.assertEqual((man["name"], man["web"], man["hub"]), ("direction-icons", "main.js", "^1.10"))   # hub.redraw — 1.10
        for key in ("icon", "description", "why", "version"):
            self.assertTrue(str(man.get(key) or "").strip(), key)
        for key in ("icon", "web"):
            self.assertTrue(os.path.isfile(os.path.join(ROOT, man[key])), man[key])


class Emoji(unittest.TestCase):
    def test_set_is_unique_and_has_the_default_compass(self):
        groups = json.loads(read("emoji.json"))
        icons = [i for g in groups for i in g["icons"]]
        self.assertGreaterEqual(len(icons), 60)
        self.assertEqual(len(icons), len(set(icons)))
        self.assertIn("🧭", icons)   # знак хаба по умолчанию — его можно вернуть выбором
        self.assertTrue(all(g["title"] and g["icons"] for g in groups))


class Symbols(unittest.TestCase):
    def test_set_has_codes_for_mac_and_windows(self):
        # владелец 12.10: стиль — эмодзи или символьный шрифт (Mac — SF Symbols, Windows — Segoe Fluent Icons)
        groups = json.loads(read("symbols.json"))
        icons = [i for g in groups for i in g["icons"]]
        self.assertTrue(all(g["title"] and g["icons"] for g in groups))
        self.assertEqual(len({i["n"] for i in icons}), len(icons))
        for font, lo, hi, least in (("sf", 0x100000, 0x10FFFD, 60), ("win", 0xE000, 0xF8FF, 40)):
            codes = [int(i[font], 16) for i in icons if font in i]
            self.assertGreaterEqual(len(codes), least, font)
            self.assertEqual(len(codes), len(set(codes)), font)   # без двойников в сетке
            self.assertTrue(all(lo <= c <= hi for c in codes), font)   # личная зона Unicode шрифта
        self.assertTrue(all("sf" in i or "win" in i for i in icons))

    def test_symbol_tab_is_off_without_the_font(self):
        js = read("main.js")
        self.assertIn('"Segoe Fluent Icons"', js)
        self.assertIn('"SF Pro"', js)
        self.assertIn('if (id === "sym" && !f) b.disabled = true', js)
        self.assertIn("COLORS[h % COLORS.length]", js)
        # владелец 12.10: знак — в направлении, стиль, цвет и прыжок — в «Настройках»
        self.assertNotIn("di-tab", js)

    def test_settings_block_and_every_sidebar_icon(self):
        # владелец 12.10: своя вкладка уехала на вторую строку — блок во вкладке «Настройки» (API 1.13), на старом
        # хабе — короткая своя; стиль — у всех знаков списка (специалисты, направления, исполнители); менять знак
        # можно у специалистов и направлений
        js = read("main.js")
        self.assertIn('hub.addOptions({ title: "Иконки"', js)
        self.assertIn('hub.addSettings({ id: "direction-icons", title: "Иконки"', js)
        self.assertIn('blockInSettings = () => api(13)', js)
        self.assertIn('tab: "theme"', js)                               # владелец 12.10: настройки — во вкладке «Тема» (1.14)
        self.assertIn('kind === "agent" || kind === "direction" || kind === "hub"', js)    # editable, и хаб (владелец 12.10)
        self.assertIn('s.kind === "hub" ? "hub"', js)
        self.assertIn('hub: ["", "house"]', js)                         # у хаба эмодзи нет, символ — дом
        self.assertIn('s.role === "agent" ? "agent"', js)
        self.assertIn('"🎨": "paintpalette"', js)                       # символ — по эмодзи сессии
        symbols = {i["n"] for g in json.loads(read("symbols.json")) for i in g["icons"]}
        mapped = set(re.findall(r'": "([a-z.]+)"', js[js.index("BY_EMOJI"):js.index("};", js.index("BY_EMOJI"))]))
        self.assertEqual(mapped - symbols, set())                       # каждый символ карты есть в наборе   # «случайный» — постоянный для направления, не мигает
        self.assertIn('load("symbols.json")', js)


class Source(unittest.TestCase):
    def test_places_and_storage(self):
        js = read("main.js")
        self.assertIn('hub.addSlot("session.header"', js)    # выбор — внутри открытого направления
        self.assertIn('hub.addSlot("sidebar.session"', js)   # знак — в списке сессий
        self.assertIn('"hub.directionIcons"', js)            # хранится в этом браузере
        self.assertNotIn("innerHTML", js)
        self.assertNotIn("eval(", js)

    def test_the_button_stands_before_the_title(self):
        # владелец 07.10: иконка слева, перед названием направления (было — после статуса)
        js = read("main.js")
        self.assertIn('":scope > h2"', js)
        self.assertIn("title.before(root)", js)
        self.assertNotIn("pill.after(root)", js)

    def test_unread_direction_hops_and_can_be_switched_off(self):
        # владелец 12.10: итог не прочитан — знак плавно прыгает на 5 px, как в доке Mac; выключить можно в настройках
        js, css = read("main.js"), read("style.css")
        self.assertIn('classList.contains("unread")', js)
        self.assertIn('s.hop !== false', js)                       # по умолчанию включено
        self.assertIn('settings().hop', js)
        self.assertIn("translateY(-5px)", css)
        self.assertIn("prefers-reduced-motion", css)
        hop = int(re.search(r"const HOP = (\d+)", js).group(1))
        self.assertIn(f"animation: di-hop {hop}ms infinite", css)  # фаза из часов страницы — та же длительность

    def test_javascript_parses(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("нет node")
        r = subprocess.run([node, "--input-type=module", "--check"], input=read("main.js"), capture_output=True,
                           text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
