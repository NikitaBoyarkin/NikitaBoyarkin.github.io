#!/usr/bin/env python3
"""check_site.py — validate the built Astro portfolio.

Checks:
- Required pages exist in dist/.
- All internal links in dist/ HTML resolve to existing files.
- Profile image exists and is under a size threshold.
- Images referenced in HTML exist in dist/.
- Required assets are present in index.html.
"""

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
MAX_PROFILE_KB = 500


class LinkExtractor(HTMLParser):
    def __init__(self, page: Path):
        super().__init__()
        self.page = page
        self.links: list[tuple[str, int]] = []
        self.srcs: list[tuple[str, int]] = []
        self.ids: set[str] = set()

    def error(self, message):
        pass

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        line = self.getpos()[0]
        if "href" in attr:
            self.links.append((attr["href"], line))
        if "src" in attr:
            self.srcs.append((attr["src"], line))
        if "id" in attr:
            self.ids.add(attr["id"])


def is_internal(url: str) -> bool:
    return bool(url) and not url.startswith(
        ("http://", "https://", "//", "mailto:", "tel:", "#", "data:")
    )


def strip_fragment(url: str) -> str:
    return url.split("#")[0]


def resolve_relative(page: Path, url: str) -> Path:
    url = strip_fragment(url)
    if url.startswith("/"):
        # Site is served from the domain root (user Pages site, no base prefix).
        base = ""
        if base and url.startswith(base):
            url = url[len(base) :]
        return (DIST / url.lstrip("/")).resolve()
    return (page.parent / url).resolve()


def check_required_pages() -> int:
    errors = 0
    required = [
        DIST / "index.html",
        DIST / "about" / "index.html",
        DIST / "writing" / "index.html",
        DIST / "contact" / "index.html",
        DIST / "projects" / "rfm" / "index.html",
        DIST / "projects" / "bot" / "index.html",
        DIST / "projects" / "cohort" / "index.html",
        DIST / "projects" / "volta" / "index.html",
        DIST / "projects" / "volta" / "funnel" / "index.html",
        DIST / "projects" / "volta" / "ab" / "index.html",
        DIST / "projects" / "volta" / "retention" / "index.html",
        DIST / "projects" / "volta" / "segmentation" / "index.html",
        DIST / "projects" / "sql" / "index.html",
        DIST / "projects" / "garden" / "index.html",
        DIST / "projects" / "site" / "index.html",
        DIST / "posts" / "bayesian-ab-testing" / "index.html",
        DIST / "posts" / "cohort-retention-guide" / "index.html",
        DIST / "posts" / "rfm-segmentation-practical" / "index.html",
        DIST / "posts" / "telegram-reporting-bot" / "index.html",
        DIST / "posts" / "data-analyst-portfolio-checklist" / "index.html",
        DIST / "posts" / "ab-calibration-simulation" / "index.html",
        DIST / "posts" / "cohort-triangles-retention" / "index.html",
        DIST / "posts" / "sql-window-functions" / "index.html",
        DIST / "posts" / "volta-neobank-case-study" / "index.html",
        DIST / "glossary" / "index.html",
        # EN locale (prefixDefaultLocale: false → EN under /en/)
        DIST / "en" / "index.html",
        DIST / "en" / "about" / "index.html",
        DIST / "en" / "projects" / "volta" / "index.html",
        DIST / "en" / "projects" / "volta" / "funnel" / "index.html",
        DIST / "en" / "projects" / "volta" / "ab" / "index.html",
        DIST / "en" / "projects" / "volta" / "retention" / "index.html",
        DIST / "en" / "projects" / "volta" / "segmentation" / "index.html",
        DIST / "en" / "projects" / "rfm" / "index.html",
        DIST / "en" / "projects" / "cohort" / "index.html",
        DIST / "en" / "projects" / "bot" / "index.html",
        DIST / "en" / "projects" / "sql" / "index.html",
        DIST / "en" / "projects" / "garden" / "index.html",
        DIST / "en" / "projects" / "site" / "index.html",
        DIST / "en" / "glossary" / "index.html",
    ]
    print(f"Checking {len(required)} required page(s)...")
    for path in required:
        if not path.exists():
            print(f"  ERROR: missing required page {path.relative_to(DIST)}")
            errors += 1
        else:
            print(f"  OK    {path.relative_to(DIST)}")
    return errors


def check_internal_links() -> int:
    errors = 0
    html_files = list(DIST.rglob("*.html"))
    print(f"Checking internal links in {len(html_files)} HTML file(s)...")

    # First pass: collect every page's element ids (for in-page anchor checks).
    page_ids: dict[Path, set[str]] = {}
    extractors: dict[Path, LinkExtractor] = {}
    for page in html_files:
        text = page.read_text(encoding="utf-8")
        extractor = LinkExtractor(page)
        try:
            extractor.feed(text)
        except Exception as e:
            print(f"  ERROR parsing {page.relative_to(DIST)}: {e}")
            errors += 1
            continue
        extractors[page] = extractor
        page_ids[page] = extractor.ids

    for page, extractor in extractors.items():
        for url, line in extractor.links + extractor.srcs:
            if not is_internal(url):
                continue
            # Skip CSS/JS assets handled by Astro bundler
            if url.startswith("/_astro/"):
                continue
            fragment = None
            path_part = url
            if "#" in url:
                path_part, fragment = url.split("#", 1)
            target = resolve_relative(page, path_part)
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                print(
                    f"  ERROR {page.relative_to(DIST)}:{line} broken link: {url} -> {target.relative_to(ROOT)}"
                )
                errors += 1
                continue
            if fragment:
                target_ids = page_ids.get(target, set())
                if fragment and fragment not in target_ids:
                    print(
                        f'  ERROR {page.relative_to(DIST)}:{line} broken anchor: {url} (no id="{fragment}" in {target.relative_to(DIST)})'
                    )
                    errors += 1
    return errors


def check_profile_image() -> int:
    errors = 0
    profile_candidates = ["images/00_profile.jpg", "images/00_profile.png"]
    profile = None
    for cand in profile_candidates:
        if (DIST / cand).exists():
            profile = DIST / cand
            break

    if not profile:
        print("  ERROR: profile image not found in dist/images/")
        return 1

    size_kb = profile.stat().st_size / 1024
    print(f"Profile image: {profile.name} ({size_kb:.1f} KB)")
    if size_kb > MAX_PROFILE_KB:
        print(f"  ERROR: profile image exceeds {MAX_PROFILE_KB} KB ({size_kb:.1f} KB)")
        errors += 1
    return errors


def check_index_assets() -> int:
    errors = 0
    index = DIST / "index.html"
    text = index.read_text(encoding="utf-8")
    required = ["_astro/", "theme-toggle"]
    for asset in required:
        if asset not in text:
            print(f"  ERROR: index.html missing reference to {asset}")
            errors += 1
    return errors


def check_metrics_drift() -> int:
    """REQ-031: METRICS.portfolio.projects must match the number of project cards.

    Guards against the 2026-09-05 drift (games card added, metric left at 14).
    Counts .md files in src/content/projects/ and compares with the declared
    value in src/lib/metrics.ts.
    """
    errors = 0
    projects_dir = ROOT / "src" / "content" / "projects"
    metrics_file = ROOT / "src" / "lib" / "metrics.ts"
    if not projects_dir.is_dir() or not metrics_file.is_file():
        print("  ERROR: src/content/projects/ or src/lib/metrics.ts not found")
        return 1
    card_count = len(list(projects_dir.glob("*.md")))
    text = metrics_file.read_text(encoding="utf-8")
    m = re.search(r"portfolio:\s*\{.*?projects:\s*(\d+)", text, re.DOTALL)
    if not m:
        print("  ERROR: could not parse METRICS.portfolio.projects from metrics.ts")
        return 1
    declared = int(m.group(1))
    if card_count != declared:
        print(
            f"  ERROR: metrics drift — {card_count} project cards in src/content/projects/, "
            f"METRICS.portfolio.projects = {declared}"
        )
        errors += 1
    else:
        print(
            f"  OK    project cards ({card_count}) == METRICS.portfolio.projects ({declared})"
        )
    return errors


def check_graph_assets() -> int:
    errors = 0
    graph_files = ["graph.json", "graph-en.json"]
    for name in graph_files:
        if not (DIST / name).exists():
            print(f"  ERROR: missing generated {name} (run 'bun run build')")
            errors += 1
        else:
            print(f"  OK    {name}")
    return errors


def main() -> int:
    if not DIST.exists():
        print("ERROR: dist/ not found. Run 'bun run build' first.")
        return 1

    print("=== Portfolio site validation ===\n")
    errors = 0
    errors += check_required_pages()
    errors += check_internal_links()
    errors += check_profile_image()
    errors += check_index_assets()
    errors += check_graph_assets()
    errors += check_metrics_drift()

    print()
    if errors:
        print(f"FAILED: {errors} error(s)")
        return 1
    print("OK: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
