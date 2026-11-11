"""Run: python3 -m unittest discover -s tests"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "claude-usage", "mods", "claude-usage", "statusline.py")
INPUT = {
    "model": {"display_name": "Opus"},
    "rate_limits": {
        "five_hour": {"used_percentage": 17.4, "resets_at": 1794409200},
        "seven_day": {"used_percentage": 18, "resets_at": 1794686400},
    },
}


class StatusLineTest(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.TemporaryDirectory()
        self.cache = os.path.join(self.home.name, ".cache", "claude-usage", "limits.json")

    def tearDown(self):
        self.home.cleanup()

    def run_script(self, payload, *args):
        env = dict(os.environ, HOME=self.home.name, USERPROFILE=self.home.name)
        text = payload if isinstance(payload, str) else json.dumps(payload)
        return subprocess.run([sys.executable, "-I", SCRIPT, *args], input=text, capture_output=True, text=True, env=env, timeout=20)

    def test_saves_limits_and_prints_nothing(self):
        r = self.run_script(INPUT)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, "")
        saved = json.load(open(self.cache))
        self.assertEqual(saved["five_hour"], {"used_percentage": 17.4, "resets_at": 1794409200})
        self.assertEqual(saved["seven_day"]["used_percentage"], 18.0)
        self.assertIsInstance(saved["updated_at"], int)
        self.assertIsInstance(saved["tz_offset_min"], int)

    def test_saves_only_rate_limits(self):
        payload = dict(INPUT, workspace={"current_dir": "/secret/project"}, session_id="abc", transcript_path="/x.jsonl")
        self.run_script(payload)
        saved = json.load(open(self.cache))
        self.assertEqual(set(saved), {"five_hour", "seven_day", "updated_at", "tz_offset_min"})

    def test_keeps_last_cache_without_rate_limits(self):
        self.run_script(INPUT)
        before = open(self.cache).read()
        r = self.run_script({"model": {"display_name": "Opus"}})
        self.assertEqual(r.returncode, 0)
        self.assertEqual(open(self.cache).read(), before)

    def test_no_cache_without_rate_limits(self):
        self.run_script({"rate_limits": {"five_hour": {"used_percentage": "bad"}}})
        self.assertFalse(os.path.exists(self.cache))

    def test_invalid_json_does_not_fail(self):
        r = self.run_script("not json")
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout, "")
        self.assertFalse(os.path.exists(self.cache))

    def test_summary(self):
        r = self.run_script(INPUT, "--summary")
        self.assertEqual(r.stdout.strip(), "Opus · session 17% · week 18%")

    def test_then_forwards_input_to_existing_status_line(self):
        cmd = f'{sys.executable} -I -c "import sys,json; print(json.load(sys.stdin)[\'model\'][\'display_name\'], \'ok\')"'
        r = self.run_script(INPUT, "--then", cmd)
        self.assertEqual(r.stdout.strip(), "Opus ok")
        self.assertTrue(os.path.exists(self.cache))


if __name__ == "__main__":
    unittest.main()
