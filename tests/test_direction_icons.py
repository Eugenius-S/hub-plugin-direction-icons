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


class Source(unittest.TestCase):
    def test_places_and_storage(self):
        js = read("main.js")
        self.assertIn('hub.addSlot("session.header"', js)    # выбор — внутри открытого направления
        self.assertIn('hub.addSlot("sidebar.session"', js)   # знак — в списке сессий
        self.assertIn('"hub.directionIcons"', js)            # хранится в этом браузере
        self.assertNotIn("innerHTML", js)
        self.assertNotIn("eval(", js)

    def test_javascript_parses(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("нет node")
        r = subprocess.run([node, "--input-type=module", "--check"], input=read("main.js"), capture_output=True,
                           text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
