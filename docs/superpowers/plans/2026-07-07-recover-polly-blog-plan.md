# Recover thepollyproject.org Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover all content from the Wayback Machine snapshot of thepollyproject.org into Markdown, and rebuild it as a Jekyll site ready to deploy on GitHub Pages under the App-vNext org with the custom domain restored.

**Architecture:** A throwaway Python migration tool (not committed) parses cached Wayback HTML for the 16 posts + About page, converts bodies to Markdown (resolving GitHub Gist embeds via the GitHub API and downloading images via Wayback's image snapshots), and writes Jekyll-format files directly into a new Jekyll site (Minima theme) that is version-controlled from the start.

**Tech Stack:** Python 3 (`requests`, `beautifulsoup4`, `markdownify`, `pytest`) for migration; Ruby + Jekyll + the `github-pages` gem + Minima theme for the site; giscus for comments.

## Global Constraints

- Site repo root: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org` (already `git init`-ed; POSIX equivalent for shell commands: `/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org`).
- The migration tool lives under `tools/migrate/` inside the site repo but is **gitignored** — never commit it (per design spec).
- No GitHub Actions workflow — the site must build on GitHub Pages' native Jekyll pipeline (Minima + `github-pages` gem only, no unsupported plugins).
- Every commit to the site repo uses real content only — no placeholder text.
- Cached Wayback HTML for all 16 posts + About page already exists at
  `C:\Users\HP\AppData\Local\Temp\claude\D--Dropbox--Personal--Projects-AppvNext-Polly\a52c63b0-9151-48fc-abe5-d88ea19db4b2\scratchpad\wayback\` (POSIX: `/c/Users/HP/AppData/Local/Temp/claude/D--Dropbox--Personal--Projects-AppvNext-Polly/a52c63b0-9151-48fc-abe5-d88ea19db4b2/scratchpad/wayback/`), one file per post named `<slug_path_with_underscores>.html`, plus `about.html`. A `manifest.json` with title/author/date/gist/image metadata for the 16 posts already exists alongside it at `...scratchpad\manifest.json`.

---

### Task 1: Migration tool workspace

**Files:**
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\cache\` (copy of cached Wayback HTML)
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\manifest.json`
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\.gitignore`

**Interfaces:**
- Produces: `tools/migrate/cache/*.html` (17 files: 16 posts + `about.html`), `tools/migrate/manifest.json` (list of post entries), consumed by Tasks 2–9.

- [ ] **Step 1: Copy cached Wayback HTML into the repo's migration workspace**

```bash
mkdir -p "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate/cache"
cp "/c/Users/HP/AppData/Local/Temp/claude/D--Dropbox--Personal--Projects-AppvNext-Polly/a52c63b0-9151-48fc-abe5-d88ea19db4b2/scratchpad/wayback/"*.html \
   "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate/cache/"
cp "/c/Users/HP/AppData/Local/Temp/claude/D--Dropbox--Personal--Projects-AppvNext-Polly/a52c63b0-9151-48fc-abe5-d88ea19db4b2/scratchpad/manifest.json" \
   "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate/manifest.json"
ls "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate/cache" | wc -l
```

Expected: file count is 20 (16 posts + `about.html` + the three ad-hoc `post1.html`/`post_code.html`/`post_code2.html` research fixtures are extra — that's fine, they're unused by `run.py` and gitignored anyway).

- [ ] **Step 2: Create `.gitignore` so the migration tool and Jekyll build output never get committed**

```
_site/
.jekyll-cache/
.jekyll-metadata
.bundle/
vendor/
tools/
```

Write this to `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\.gitignore`.

- [ ] **Step 3: Verify pip dependencies are importable**

```bash
python3 -c "import requests, bs4, markdownify, pytest; print('deps ok')"
```

Expected: `deps ok` (these were already installed in this environment; if `ModuleNotFoundError` occurs on a different machine, run `python3 -m pip install requests beautifulsoup4 markdownify pytest` first).

- [ ] **Step 4: Commit the `.gitignore`**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git add .gitignore
git commit -m "Add .gitignore for Jekyll build output and migration tooling"
```

---

### Task 2: Post field extraction (`extract_post_fields`)

**Files:**
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\lib.py`
- Test: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\test_lib.py`

**Interfaces:**
- Produces: `extract_post_fields(html: str) -> dict` with keys `title: str`, `author: str | None`, `date: str | None` (ISO `YYYY-MM-DD`), `body_html: str` (featured image, if any, prepended to the post-content inner HTML). Consumed by Tasks 4, 5, 6, 9.

- [ ] **Step 1: Write the failing test**

Create `tools/migrate/test_lib.py`:

```python
import os
from lib import extract_post_fields

CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")


def read_fixture(name):
    with open(os.path.join(CACHE_DIR, name), encoding="utf-8", errors="ignore") as f:
        return f.read()


def test_extract_post_fields_v8_release():
    html = read_fixture("2023_09_28_polly-v8-officially-released.html")
    fields = extract_post_fields(html)
    assert fields["title"] == "Polly v8 officially released"
    assert fields["author"] == "Joel Hulen"
    assert fields["date"] == "2023-09-28"
    assert "Polly-v8.png" in fields["body_html"]
    assert "Introduction to Polly v8" in fields["body_html"]


def test_extract_post_fields_about_page_has_no_date_or_author():
    html = read_fixture("about.html")
    fields = extract_post_fields(html)
    assert fields["title"] == "The elevator pitch: Who or what is Polly?"
    assert fields["date"] is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'lib'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `tools/migrate/lib.py`:

```python
from datetime import datetime

from bs4 import BeautifulSoup


def extract_post_fields(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    article = soup.find("article")

    title_tag = article.find(class_="post-title")
    title = title_tag.get_text(strip=True)

    author = None
    author_tag = article.find(class_="author")
    if author_tag:
        a = author_tag.find("a")
        author = a.get_text(strip=True) if a else None

    date = None
    date_tag = article.find(class_="date")
    if date_tag:
        date = datetime.strptime(date_tag.get_text(strip=True), "%B %d, %Y").strftime("%Y-%m-%d")

    body_parts = []
    featured = article.find(class_="featured-media")
    if featured:
        img = featured.find("img")
        if img:
            body_parts.append(str(img))
    content = article.find(class_="post-content")
    body_parts.append(content.decode_contents())

    return {
        "title": title,
        "author": author,
        "date": date,
        "body_html": "\n".join(body_parts),
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

The migration tool is gitignored, so there is nothing to commit for this task — confirm it stays untracked:

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git status --short
```

Expected: no `tools/` entries appear (ignored).

---

### Task 3: HTML → Markdown conversion (`html_to_markdown`)

**Files:**
- Modify: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\lib.py`
- Test: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\test_lib.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `html_to_markdown(body_html: str) -> str`. Consumed by Task 9 (orchestrator).

- [ ] **Step 1: Write the failing test**

Append to `tools/migrate/test_lib.py`:

```python
from lib import html_to_markdown


def test_html_to_markdown_headings_bold_links_code():
    html = (
        '<h2 id="introductiontopollyv8">Introduction to Polly v8</h2>'
        '<p>Polly v8 has landed with a <strong>bang</strong>. '
        'See <a href="https://www.pollydocs.org/">the docs</a>. '
        'Use <code>ResiliencePipeline</code> for everything.</p>'
    )
    markdown = html_to_markdown(html)
    assert "## Introduction to Polly v8" in markdown
    assert "**bang**" in markdown
    assert "[the docs](https://www.pollydocs.org/)" in markdown
    assert "`ResiliencePipeline`" in markdown


def test_html_to_markdown_blockquote():
    html = "<blockquote><p>Important note.</p></blockquote>"
    markdown = html_to_markdown(html)
    assert "> Important note." in markdown
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k html_to_markdown
```

Expected: FAIL with `ImportError: cannot import name 'html_to_markdown'`.

- [ ] **Step 3: Write minimal implementation**

Add to `tools/migrate/lib.py`:

```python
from markdownify import ATX
from markdownify import markdownify as _markdownify


def html_to_markdown(body_html: str) -> str:
    return _markdownify(body_html, heading_style=ATX, bullets="-").strip()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k html_to_markdown
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

Gitignored — no commit needed (verify with `git status --short` as in Task 2 Step 5 if in doubt).

---

### Task 4: GitHub Gist embed resolution

**Files:**
- Modify: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\lib.py`
- Test: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\test_lib.py`

**Interfaces:**
- Produces:
  - `extract_gist_placeholders(body_html: str) -> tuple[str, dict[str, tuple[str, str]]]` — replaces each `<script src=".../gist.github.com/USER/ID.js">` tag with a unique `<p>GISTPLACEHOLDER{n}</p>` marker; returns the modified HTML and a `{placeholder_token: (user, gist_id)}` map.
  - `render_gist_markdown(gist_id: str, fetch_gist) -> str` — calls `fetch_gist(gist_id)` (expected to return the GitHub API's `files` dict: `{filename: {"content": str, "language": str | None}}`) and renders one fenced code block per file.
  - `substitute_gist_placeholders(markdown_text: str, mapping: dict, fetch_gist) -> str` — replaces each placeholder token in already-converted Markdown with its rendered gist code block.
  - `fetch_gist_from_api(gist_id: str) -> dict` — the real network-backed `fetch_gist` implementation, hitting `https://api.github.com/gists/{id}`.
- Consumed by Task 9 (orchestrator).

- [ ] **Step 1: Write the failing test**

Append to `tools/migrate/test_lib.py`:

```python
from lib import (
    extract_gist_placeholders,
    render_gist_markdown,
    substitute_gist_placeholders,
)


def test_extract_gist_placeholders_handles_direct_and_wayback_prefixed_urls():
    html = (
        '<p>Before</p>'
        '<script src="https://gist.github.com/reisenberger/0a04b88b99ecda4f3f259780d222c7e6.js"></script>'
        '<p>Between</p>'
        '<script src="/web/20250215130749js_/https://gist.github.com/reisenberger/3b58f2b1ea6499171245e17d3802ed82.js"></script>'
    )
    new_html, mapping = extract_gist_placeholders(html)
    assert "<script" not in new_html
    assert len(mapping) == 2
    tokens = list(mapping.keys())
    assert mapping[tokens[0]] == ("reisenberger", "0a04b88b99ecda4f3f259780d222c7e6")
    assert mapping[tokens[1]] == ("reisenberger", "3b58f2b1ea6499171245e17d3802ed82")
    assert tokens[0] in new_html
    assert tokens[1] in new_html


def _fake_fetch_gist(gist_id):
    return {
        "example.cs": {
            "content": "Console.WriteLine(\"hi\");",
            "language": "C#",
        }
    }


def test_render_gist_markdown_produces_fenced_code_block():
    markdown = render_gist_markdown("anyid", _fake_fetch_gist)
    assert markdown == '```c#\nConsole.WriteLine("hi");\n```'


def test_substitute_gist_placeholders_replaces_tokens_in_markdown():
    mapping = {"GISTPLACEHOLDER0": ("reisenberger", "anyid")}
    markdown = "Before\n\nGISTPLACEHOLDER0\n\nAfter"
    result = substitute_gist_placeholders(markdown, mapping, _fake_fetch_gist)
    assert "```c#" in result
    assert "GISTPLACEHOLDER0" not in result
    assert result.startswith("Before")
    assert result.endswith("After")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k gist
```

Expected: FAIL with `ImportError`.

- [ ] **Step 3: Write minimal implementation**

Add to `tools/migrate/lib.py`:

```python
import re

import requests

GIST_SCRIPT_RE = re.compile(
    r'<script src="[^"]*gist\.github\.com/([\w-]+)/([0-9a-f]+)\.js"[^>]*></script>'
)


def extract_gist_placeholders(body_html: str):
    mapping = {}
    counter = {"n": 0}

    def replace(m):
        token = f"GISTPLACEHOLDER{counter['n']}"
        counter["n"] += 1
        mapping[token] = (m.group(1), m.group(2))
        return f"<p>{token}</p>"

    new_html = GIST_SCRIPT_RE.sub(replace, body_html)
    return new_html, mapping


def render_gist_markdown(gist_id: str, fetch_gist) -> str:
    files = fetch_gist(gist_id)
    blocks = []
    for info in files.values():
        lang = (info.get("language") or "").lower()
        content = info["content"].rstrip("\n")
        blocks.append(f"```{lang}\n{content}\n```")
    return "\n\n".join(blocks)


def substitute_gist_placeholders(markdown_text: str, mapping: dict, fetch_gist) -> str:
    for token, (_user, gist_id) in mapping.items():
        markdown_text = markdown_text.replace(token, render_gist_markdown(gist_id, fetch_gist))
    return markdown_text


def fetch_gist_from_api(gist_id: str) -> dict:
    resp = requests.get(f"https://api.github.com/gists/{gist_id}", timeout=15)
    resp.raise_for_status()
    return resp.json()["files"]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k gist
```

Expected: 3 passed.

- [ ] **Step 5: Verify `fetch_gist_from_api` works against a real, still-live gist**

```bash
python3 -c "from lib import fetch_gist_from_api; files = fetch_gist_from_api('0a04b88b99ecda4f3f259780d222c7e6'); print(list(files.keys())); print(list(files.values())[0]['content'][:60])"
```

Expected output includes a filename like `CustomPollyPolicies.PartII.snippet2.cs` and content starting with `protected override async Task<TResult> ImplementationAsync(`.

- [ ] **Step 6: Commit**

Gitignored — no commit needed.

---

### Task 5: Image reference extraction and link rewriting

**Files:**
- Modify: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\lib.py`
- Test: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\test_lib.py`

**Interfaces:**
- Produces:
  - `extract_image_refs(body_html: str) -> list[str]` — unique `img src` values that reference `/content/images/`.
  - `to_download_url(src: str) -> str` — normalizes a possibly-relative (`/web/...`) src into an absolute `https://web.archive.org/...` URL.
  - `local_image_path(src: str) -> str` — the path fragment after `/content/images/`, e.g. `2023/09/Polly-v8.png`.
  - `rewrite_image_links(markdown_text: str, src_to_local: dict[str, str]) -> str` — replaces each original `src` string in the Markdown with `/assets/images/{local_path}`.
- Consumed by Task 9 (orchestrator).

- [ ] **Step 1: Write the failing test**

Append to `tools/migrate/test_lib.py`:

```python
from lib import (
    extract_image_refs,
    local_image_path,
    rewrite_image_links,
    to_download_url,
)


def test_extract_image_refs_dedupes_and_filters():
    html = (
        '<img src="/web/20250217232425im_/https://thepollyproject.org/content/images/2016/10/Polly-Logo@2x.png">'
        '<img src="/web/20250217232425im_/https://thepollyproject.org/content/images/2016/10/Polly-Logo@2x.png">'
        '<img src="/web/20250217232425im_/https://thepollyproject.org/assets/images/favicon.ico">'
    )
    refs = extract_image_refs(html)
    assert refs == [
        "/web/20250217232425im_/https://thepollyproject.org/content/images/2016/10/Polly-Logo@2x.png"
    ]


def test_to_download_url_handles_relative_and_absolute():
    assert to_download_url("/web/123im_/https://thepollyproject.org/content/images/x.png") == (
        "https://web.archive.org/web/123im_/https://thepollyproject.org/content/images/x.png"
    )
    absolute = "https://web.archive.org/web/123im_/https://thepollyproject.org/content/images/x.png"
    assert to_download_url(absolute) == absolute


def test_local_image_path_extracts_path_after_content_images():
    src = "/web/20250217232425im_/https://thepollyproject.org/content/images/2023/09/Polly-v8.png"
    assert local_image_path(src) == "2023/09/Polly-v8.png"


def test_rewrite_image_links_replaces_src_with_local_asset_path():
    src = "/web/1im_/https://thepollyproject.org/content/images/2023/09/Polly-v8.png"
    markdown = f"![Polly v8]({src})"
    result = rewrite_image_links(markdown, {src: "2023/09/Polly-v8.png"})
    assert result == "![Polly v8](/assets/images/2023/09/Polly-v8.png)"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k image
```

Expected: FAIL with `ImportError`.

- [ ] **Step 3: Write minimal implementation**

Add to `tools/migrate/lib.py`:

```python
IMG_SRC_RE = re.compile(r'<img[^>]+src="([^"]+)"')


def extract_image_refs(body_html: str) -> list:
    srcs = IMG_SRC_RE.findall(body_html)
    seen = []
    for s in srcs:
        if "/content/images/" in s and s not in seen:
            seen.append(s)
    return seen


def to_download_url(src: str) -> str:
    if src.startswith("/web/"):
        return "https://web.archive.org" + src
    return src


def local_image_path(src: str) -> str:
    m = re.search(r"/content/images/([^\"?]+)", src)
    return m.group(1)


def rewrite_image_links(markdown_text: str, src_to_local: dict) -> str:
    for src, local_path in src_to_local.items():
        markdown_text = markdown_text.replace(src, f"/assets/images/{local_path}")
    return markdown_text
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k image
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

Gitignored — no commit needed.

---

### Task 6: Post file builder (`build_post_file`)

**Files:**
- Modify: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\lib.py`
- Test: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\test_lib.py`

**Interfaces:**
- Produces: `build_post_file(title: str, author: str | None, date: str | None, markdown_body: str, layout: str = "post") -> str` — full file content (YAML front matter + body). Consumed by Task 9.

- [ ] **Step 1: Write the failing test**

Append to `tools/migrate/test_lib.py`:

```python
from lib import build_post_file


def test_build_post_file_includes_front_matter_and_body():
    content = build_post_file(
        title="Polly v8 officially released",
        author="Joel Hulen",
        date="2023-09-28",
        markdown_body="Polly v8 is here!",
    )
    assert content.startswith("---\nlayout: post\n")
    assert 'title: "Polly v8 officially released"' in content
    assert "author: Joel Hulen" in content
    assert "date: 2023-09-28" in content
    assert content.strip().endswith("Polly v8 is here!")


def test_build_post_file_omits_missing_author_and_date():
    content = build_post_file(
        title="The elevator pitch: Who or what is Polly?",
        author=None,
        date=None,
        markdown_body="Polly is a resilience library.",
        layout="page",
    )
    assert "layout: page" in content
    assert "author:" not in content
    assert "date:" not in content
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k build_post_file
```

Expected: FAIL with `ImportError`.

- [ ] **Step 3: Write minimal implementation**

Add to `tools/migrate/lib.py`:

```python
def build_post_file(title: str, author, date, markdown_body: str, layout: str = "post") -> str:
    lines = ["---", f"layout: {layout}", f'title: "{title}"']
    if author:
        lines.append(f"author: {author}")
    if date:
        lines.append(f"date: {date}")
    lines.append("---")
    return "\n".join(lines) + "\n\n" + markdown_body.strip() + "\n"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -m pytest test_lib.py -v -k build_post_file
```

Expected: 2 passed. Then run the full suite to confirm nothing regressed:

```bash
python3 -m pytest test_lib.py -v
```

Expected: 13 passed.

- [ ] **Step 5: Commit**

Gitignored — no commit needed.

---

### Task 7: Image downloader (live network)

**Files:**
- Modify: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\lib.py`

**Interfaces:**
- Produces: `download_image(url: str, dest_path: str) -> None` — downloads `url` to `dest_path`, creating parent directories as needed; raises on failure after 2 attempts (caller in Task 9 handles the failure). Consumed by Task 9.

- [ ] **Step 1: Write the implementation**

Add to `tools/migrate/lib.py`:

```python
import os
import time


def download_image(url: str, dest_path: str) -> None:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    last_error = None
    for attempt in range(2):
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                f.write(resp.content)
            return
        except Exception as e:  # noqa: BLE001 - deliberately broad, caller decides fallback
            last_error = e
            time.sleep(1)
    raise last_error
```

- [ ] **Step 2: Verify it works against a real, known-good Wayback image snapshot**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 -c "
from lib import download_image
download_image(
    'https://web.archive.org/web/20250217232425im_/https://thepollyproject.org/content/images/2016/10/Polly-Logo@2x.png',
    'cache/_test_download/Polly-Logo@2x.png',
)
import os
print('bytes:', os.path.getsize('cache/_test_download/Polly-Logo@2x.png'))
"
```

Expected: `bytes: 16786` (matches the original file's known size).

- [ ] **Step 3: Clean up the test download**

```bash
rm -rf "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate/cache/_test_download"
```

- [ ] **Step 4: Commit**

Gitignored — no commit needed.

---

### Task 8: Jekyll site scaffold

**Files:**
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\Gemfile`
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\_config.yml`
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\CNAME`
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\index.md`

**Interfaces:**
- Produces: the Jekyll site skeleton that Task 9's generated `_posts/*.md`, `about.md`, and `assets/images/*` files (and Task 10's layout/include) plug into.

- [ ] **Step 1: Create the Gemfile**

Write to `Gemfile`:

```ruby
source "https://rubygems.org"

gem "github-pages", group: :jekyll_plugins
gem "webrick", "~> 1.8"
```

- [ ] **Step 2: Create the Jekyll config**

Write to `_config.yml`:

```yaml
title: The Polly Project
description: >-
  News, releases, and deep dives from the team behind Polly, the .NET
  resilience and transient-fault-handling library.
url: "https://thepollyproject.org"
baseurl: ""
theme: minima
minima:
  skin: classic
plugins:
  - jekyll-feed
```

- [ ] **Step 3: Create the CNAME file for the custom domain**

Write to `CNAME` (single line, no trailing content):

```
thepollyproject.org
```

- [ ] **Step 4: Create the home page**

Write to `index.md`:

```markdown
---
layout: home
---
```

- [ ] **Step 5: Verify the files are well-formed**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
python3 -c "import yaml, pathlib; yaml.safe_load(pathlib.Path('_config.yml').read_text())" 2>&1 || python3 -m pip install pyyaml && python3 -c "import yaml, pathlib; print(yaml.safe_load(pathlib.Path('_config.yml').read_text()))"
```

Expected: prints the parsed config dict with no errors (confirms valid YAML).

- [ ] **Step 6: Commit**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git add Gemfile _config.yml CNAME index.md
git commit -m "Scaffold Jekyll site with Minima theme and custom domain"
```

---

### Task 9: Migration orchestrator — generate all posts, about page, and images

**Files:**
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\tools\migrate\run.py`

**Interfaces:**
- Consumes: every function from `lib.py` (Tasks 2–7) and `tools/migrate/manifest.json` (Task 1).
- Produces: `_posts/YYYY-MM-DD-slug.md` (16 files), `about.md`, and `assets/images/**` in the site repo root.

- [ ] **Step 1: Write the orchestrator**

Create `tools/migrate/run.py`:

```python
import json
import os

from lib import (
    build_post_file,
    download_image,
    extract_gist_placeholders,
    extract_image_refs,
    extract_post_fields,
    fetch_gist_from_api,
    html_to_markdown,
    local_image_path,
    rewrite_image_links,
    substitute_gist_placeholders,
    to_download_url,
)

TOOL_DIR = os.path.dirname(__file__)
CACHE_DIR = os.path.join(TOOL_DIR, "cache")
SITE_DIR = os.path.dirname(TOOL_DIR)


def slug_from_path(slug_path: str) -> str:
    return slug_path.rsplit("/", 1)[-1]


def process_body(body_html: str) -> str:
    body_html, gist_mapping = extract_gist_placeholders(body_html)

    image_refs = extract_image_refs(body_html)
    src_to_local = {}
    for src in image_refs:
        local_rel = local_image_path(src)
        dest_path = os.path.join(SITE_DIR, "assets", "images", *local_rel.split("/"))
        try:
            download_image(to_download_url(src), dest_path)
            src_to_local[src] = local_rel
        except Exception as e:  # noqa: BLE001
            body_html = body_html.replace(
                src, f"{src}<!-- TODO: recover manually - image download failed: {e} -->"
            )

    markdown_body = html_to_markdown(body_html)
    markdown_body = rewrite_image_links(markdown_body, src_to_local)

    try:
        markdown_body = substitute_gist_placeholders(markdown_body, gist_mapping, fetch_gist_from_api)
    except Exception as e:  # noqa: BLE001
        markdown_body += f"\n\n<!-- TODO: recover manually - gist fetch failed: {e} -->\n"

    return markdown_body


def main():
    with open(os.path.join(TOOL_DIR, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)

    posts_dir = os.path.join(SITE_DIR, "_posts")
    os.makedirs(posts_dir, exist_ok=True)

    for entry in manifest:
        slug_path = entry["slug_path"]
        cache_file = os.path.join(CACHE_DIR, slug_path.replace("/", "_") + ".html")
        with open(cache_file, encoding="utf-8", errors="ignore") as f:
            html = f.read()

        fields = extract_post_fields(html)
        markdown_body = process_body(fields["body_html"])
        file_content = build_post_file(
            title=fields["title"],
            author=fields["author"],
            date=fields["date"],
            markdown_body=markdown_body,
        )

        out_path = os.path.join(posts_dir, f"{fields['date']}-{slug_from_path(slug_path)}.md")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(file_content)
        print("wrote", out_path)

    # About page
    with open(os.path.join(CACHE_DIR, "about.html"), encoding="utf-8", errors="ignore") as f:
        about_html = f.read()
    about_fields = extract_post_fields(about_html)
    about_markdown = process_body(about_fields["body_html"])
    about_content = build_post_file(
        title=about_fields["title"],
        author=None,
        date=None,
        markdown_body=about_markdown,
        layout="page",
    )
    about_path = os.path.join(SITE_DIR, "about.md")
    with open(about_path, "w", encoding="utf-8") as f:
        f.write(about_content)
    print("wrote", about_path)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the full migration**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org/tools/migrate"
python3 run.py
```

Expected: 17 `wrote ...` lines (16 posts + `about.md`), no unhandled exceptions.

- [ ] **Step 3: Verify output counts and completeness**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
ls _posts | wc -l
find assets/images -type f | wc -l
grep -rl "TODO: recover manually" _posts about.md || echo "no unresolved TODOs"
```

Expected: `_posts` has 16 files; `assets/images` has at least 8 unique files (the manifest lists several images reused across posts, e.g. the avatar and logo); no `TODO: recover manually` matches (every image and gist was successfully recovered per the design research) — the `echo` fallback should print `no unresolved TODOs`.

- [ ] **Step 4: Spot-check one post with recovered gist code**

```bash
grep -A3 '```c#' "_posts/2019-02-13-authoring-a-proactive-polly-policy-custom-policies-part-ii.md" | head -8
```

Expected: shows real C# code (e.g. `protected override async Task<TResult> ImplementationAsync(`), not a placeholder or `GISTPLACEHOLDER` token.

- [ ] **Step 5: Commit the recovered content**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git add _posts about.md assets
git commit -m "Recover all 16 blog posts, About page, and images from Wayback Machine"
```

---

### Task 10: Post/page layout with giscus comments

**Files:**
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\_layouts\post.html`
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\_includes\giscus.html`

**Interfaces:**
- Consumes: `page.title`, `page.date`, `page.author`, `content` (standard Jekyll post variables set by Task 9's front matter).
- Produces: rendered post pages with a giscus comment widget below the content.

- [ ] **Step 1: Create the giscus include**

Write to `_includes/giscus.html`:

```html
<script src="https://giscus.app/client.js"
        data-repo="App-vNext/thepollyproject.org"
        data-repo-id="REPLACE_WITH_REPO_ID"
        data-category="Comments"
        data-category-id="REPLACE_WITH_CATEGORY_ID"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="preferred_color_scheme"
        data-lang="en"
        crossorigin="anonymous"
        async>
</script>
```

- [ ] **Step 2: Create the post layout**

Write to `_layouts/post.html`:

```html
---
layout: default
---
<article class="post">
  <header class="post-header">
    <h1 class="post-title">{{ page.title }}</h1>
    <p class="post-meta">
      {{ page.date | date: "%B %-d, %Y" }}
      {% if page.author %} • {{ page.author }}{% endif %}
    </p>
  </header>
  <div class="post-content">
    {{ content }}
  </div>
</article>

{% include giscus.html %}
```

- [ ] **Step 3: Commit**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git add _layouts/post.html _includes/giscus.html
git commit -m "Add post layout with giscus comments"
```

---

### Task 11: Install Ruby + Jekyll locally

**Files:** none (environment setup only).

- [ ] **Step 1: Install Ruby with the MSYS2 dev toolchain via winget**

```powershell
winget install --id RubyInstallerTeam.RubyWithDevKit.3.3 --source winget --accept-package-agreements --accept-source-agreements
```

Expected: installer completes successfully. Close and reopen the shell afterward so `PATH` picks up Ruby.

- [ ] **Step 2: Verify Ruby and gem are on PATH**

```powershell
ruby -v
gem -v
```

Expected: prints a Ruby 3.3.x version and a RubyGems version, no "command not found".

- [ ] **Step 3: Install Bundler and Jekyll**

```powershell
gem install bundler jekyll
```

Expected: both gems install without error.

- [ ] **Step 4: Install site dependencies**

```powershell
cd "D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org"
bundle install
```

Expected: resolves and installs `github-pages`, `minima`, `jekyll-feed`, `webrick`, and their dependencies; ends with `Bundle complete!`.

- [ ] **Step 5: Add the Linux platform to the lockfile so it also builds on GitHub's Linux runners**

```powershell
bundle lock --add-platform x86_64-linux
```

Expected: `Gemfile.lock` is updated to include the `x86_64-linux` platform alongside the local one, preventing a "your bundle only supports platforms..." failure on GitHub Pages' build servers.

- [ ] **Step 6: Commit the lockfile**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git add Gemfile.lock
git commit -m "Add Gemfile.lock with local and Linux platforms"
```

---

### Task 12: Local build and visual verification

**Files:** none (verification only).

- [ ] **Step 1: Build the site and check for errors**

```powershell
cd "D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org"
bundle exec jekyll build --trace
```

Expected: `Generating... done` with no `Liquid Exception` or `Error` lines. If a code block inside a post contains literal `{{` or `{%` (Liquid syntax) that Jekyll tries to interpret, wrap that specific post's front matter content with `{% raw %}...{% endraw %}` around the offending fenced block and rebuild.

- [ ] **Step 2: Serve the site locally**

```powershell
cd "D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org"
bundle exec jekyll serve --detach
```

Expected: prints `Server address: http://127.0.0.1:4000` and returns control (detached).

- [ ] **Step 3: Verify the homepage lists all 16 posts**

```bash
curl -s http://127.0.0.1:4000/ | grep -oE 'href="/[0-9]{4}/[0-9]{2}/[0-9]{2}/[a-z0-9-]+/"' | sort -u | wc -l
```

Expected: `16` (accounting for pagination, Minima's default `paginate` is unset so all posts render on one page — if the count is lower, add `paginate: 20` and `paginate_path: "/page:num/"` to `_config.yml`, rerun `bundle exec jekyll build`, and recheck).

- [ ] **Step 4: Visually verify the homepage and a post with a recovered image and gist code in a browser**

Use the Playwright browser tool: navigate to `http://127.0.0.1:4000/`, take a screenshot, then navigate to `http://127.0.0.1:4000/2019/02/13/authoring-a-proactive-polly-policy-custom-policies-part-ii/` and take a screenshot. Confirm the homepage lists posts with readable titles/dates, and the post page shows recovered images inline and syntax-highlighted C# code blocks (not raw HTML, broken image icons, or `GISTPLACEHOLDER` tokens).

- [ ] **Step 5: Stop the local server**

```powershell
Get-Process ruby | Where-Object { $_.Path -like "*jekyll*" -or $true } | Select-Object -First 1 | Stop-Process -Force
```

If that doesn't find it, list Ruby processes and stop the one bound to port 4000:

```powershell
Get-NetTCPConnection -LocalPort 4000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

---

### Task 13: README and handoff

**Files:**
- Create: `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org\README.md`

- [ ] **Step 1: Write the README**

Write to `README.md`:

```markdown
# thepollyproject.org

Source for the Polly project blog, rebuilt as a Jekyll site after the
original Azure-hosted site was lost. Content was recovered from the
[Wayback Machine snapshot](https://web.archive.org/web/20250224010614/https://www.thepollyproject.org/)
— see `docs/superpowers/specs/2026-07-07-recover-polly-blog-design.md` for
details on what was recovered and how.

## Local development

```
bundle install
bundle exec jekyll serve
```

Then open http://127.0.0.1:4000/.

## Deploying

1. Create a new repo under the App-vNext GitHub org (e.g.
   `App-vNext/thepollyproject.org`) and push this directory to its default
   branch.
2. In the repo's Settings → Pages, set the source to the default branch
   (root). GitHub Pages will build it automatically via Jekyll — no Actions
   workflow needed.
3. In Settings → Pages → Custom domain, enter `thepollyproject.org` (the
   `CNAME` file already sets this, but GitHub needs it configured on the repo
   too so it provisions HTTPS).
4. At your DNS provider, point `thepollyproject.org` at GitHub Pages: an
   `ALIAS`/`ANAME` (or `A` records to GitHub's documented Pages IPs) for the
   apex domain, matching [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
5. Enable **Discussions** on the new repo (Settings → General → Features →
   Discussions), then create a "Comments" discussion category.
6. Go to https://giscus.app, fill in the repo name, and copy the generated
   `data-repo-id` and `data-category-id` values into
   `_includes/giscus.html`, replacing `REPLACE_WITH_REPO_ID` and
   `REPLACE_WITH_CATEGORY_ID`. Commit and push.
```

- [ ] **Step 2: Commit**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git add README.md
git commit -m "Add README with local dev and deployment instructions"
```

- [ ] **Step 3: Final review of the repo**

```bash
cd "/d/Dropbox (Personal)/Projects/AppvNext/thepollyproject.org"
git log --oneline
git status --short
```

Expected: a clean working tree (only gitignored `tools/`, `_site/`, `.bundle/` etc. untracked, if anything) and a commit history covering: gitignore, site scaffold, recovered content, giscus layout, Gemfile.lock, README.
