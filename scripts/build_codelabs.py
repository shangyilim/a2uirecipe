"""Export CODELAB.md and CODELAB_GCP_CLOUDSHELL.md to static HTML via claat."""

from __future__ import annotations

import html
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT_DIR / "docs"
CLAAT_DEFAULT_PATH = Path.home() / "go" / "bin" / "claat"

STEP_DURATIONS: dict[str, str] = {
    "1.": "02:00",
    "2.": "05:00",
    "3.": "03:00",
    "4.": "05:00",
    "5.": "05:00",
    "6.": "04:00",
    "7.": "08:00",
    "8.": "10:00",
    "9.": "05:00",
    "10.": "03:00",
    "11.": "01:00",
}

ALERT_CLASSES = {
    "TIP": "positive",
    "NOTE": "positive",
    "IMPORTANT": "positive",
    "WARNING": "negative",
    "CAUTION": "negative",
}


@dataclass(frozen=True)
class CodelabSpec:
    source_file: str
    codelab_id: str
    summary: str
    categories: str
    feedback_link: str


CODELABS = [
    CodelabSpec(
        source_file="CODELAB.md",
        codelab_id="a2ui-recipe-codelab",
        summary=(
            "Build an interactive AI culinary recipe assistant with Google ADK "
            "and A2UI v1.0, progressing from plain text to BasicCatalog rendering "
            "and a formal Custom Culinary Catalog."
        ),
        categories="adk,a2ui,gemini,react",
        feedback_link="https://github.com/shangyilim/a2uirecipe/issues",
    ),
    CodelabSpec(
        source_file="CODELAB_GCP_CLOUDSHELL.md",
        codelab_id="a2ui-recipe-codelab-cloudshell",
        summary=(
            "Build and run an interactive AI culinary recipe assistant with Google ADK "
            "and A2UI v1.0 directly inside Google Cloud Shell."
        ),
        categories="adk,a2ui,cloud-shell,gemini,react",
        feedback_link="https://github.com/shangyilim/a2uirecipe/issues",
    ),
]


def find_claat() -> str:
    for candidate in (shutil.which("claat"), "/usr/local/bin/claat", str(CLAAT_DEFAULT_PATH)):
        if candidate and Path(candidate).exists():
            return candidate
    raise FileNotFoundError(
        "claat binary not found on PATH, /usr/local/bin/claat, or ~/go/bin/claat."
    )


def convert_github_alerts(lines: list[str]) -> list[str]:
    """Convert GitHub-style > [!TIP]/[NOTE]/[WARNING] blockquotes to claat <aside> blocks."""
    out: list[str] = []
    i = 0
    alert_re = re.compile(r"^>\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\s*$")
    while i < len(lines):
        m = alert_re.match(lines[i])
        if not m:
            out.append(lines[i])
            i += 1
            continue

        kind = ALERT_CLASSES[m.group(1)]
        body_lines: list[str] = []
        i += 1
        while i < len(lines) and lines[i].lstrip().startswith(">"):
            stripped = re.sub(r"^>\s?", "", lines[i])
            body_lines.append(stripped)
            i += 1

        out.append(f'<aside class="{kind}">')
        out.append("")
        if len(body_lines) > 1 and body_lines[0].startswith("**") and body_lines[1].strip():
            out.append(body_lines[0])
            out.append("")
            out.extend(body_lines[1:])
        else:
            out.extend(body_lines)
        out.append("")
        out.append("</aside>")
        out.append("")
    return out


def rewrite_remote_images(lines: list[str]) -> list[str]:
    """Avoid claat's nil DriveClient panic on remote https:// image URLs."""
    img_re = re.compile(r"!\[([^\]]*)\]\((https?://[^)]+)\)")
    return [img_re.sub(r"*Screenshot: [\1](\2)*", line) for line in lines]


def transform_for_claat(markdown_text: str, spec: CodelabSpec) -> tuple[str, str]:
    """Convert a GitHub CODELAB markdown document into claat-compatible Markdown."""
    lines = markdown_text.splitlines()
    title = spec.codelab_id
    subtitle_lines: list[str] = []
    body_start_idx = 0

    for idx, line in enumerate(lines):
        if line.startswith("# ") and title == spec.codelab_id:
            title = line[2:].strip()
            continue
        if line.startswith("## "):
            body_start_idx = idx
            break
        if line.strip() and line.strip() != "---" and title != spec.codelab_id:
            subtitle_lines.append(line)

    rest_lines = rewrite_remote_images(convert_github_alerts(lines[body_start_idx:]))

    processed_body: list[str] = []
    first_h2_seen = False
    for line in rest_lines:
        processed_body.append(line)
        if line.startswith("## "):
            heading_text = line[3:].strip()
            duration = "03:00"
            for prefix, dur in STEP_DURATIONS.items():
                if heading_text.startswith(prefix):
                    duration = dur
                    break
            processed_body.append(f"Duration: {duration}")
            if not first_h2_seen and subtitle_lines:
                processed_body.append("")
                processed_body.extend(subtitle_lines)
            first_h2_seen = True

    metadata = "\n".join(
        [
            f"authors: Shang Yi",
            f"summary: {spec.summary}",
            f"id: {spec.codelab_id}",
            f"categories: {spec.categories}",
            f"environments: Web",
            f"status: Published",
            f"feedback link: {spec.feedback_link}",
        ]
    )

    output = f"{metadata}\n\n# {title}\n\n" + "\n".join(processed_body) + "\n"
    return title, output


def write_landing_index(exported: list[tuple[CodelabSpec, str]]) -> None:
    """Write docs/index.html linking to all exported static codelabs."""
    cards = []
    for spec, title in exported:
        safe_title = html.escape(title)
        safe_summary = html.escape(spec.summary)
        cards.append(
            f"""
        <a class="card" href="./{spec.codelab_id}/index.html">
          <div class="badge">{html.escape(spec.categories.replace(',', ' · '))}</div>
          <h2>{safe_title}</h2>
          <p>{safe_summary}</p>
          <span class="cta">Start Codelab &rarr;</span>
        </a>"""
        )

    index_html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ADK + A2UI v1.0 Recipe Assistant Codelabs</title>
  <style>
    :root {{
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1e293b;
      background: #f8fafc;
    }}
    body {{
      margin: 0;
      padding: 3rem 1.5rem;
    }}
    main {{
      max-width: 820px;
      margin: 0 auto;
    }}
    h1 {{
      font-size: 2rem;
      margin: 0 0 0.5rem;
      color: #0f172a;
    }}
    .lead {{
      margin: 0 0 2rem;
      color: #475569;
      line-height: 1.6;
    }}
    .grid {{
      display: grid;
      gap: 1.25rem;
    }}
    .card {{
      display: block;
      text-decoration: none;
      color: inherit;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }}
    .card:hover {{
      transform: translateY(-2px);
      border-color: #10b981;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    }}
    .badge {{
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #059669;
      margin-bottom: 0.5rem;
    }}
    .card h2 {{
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      color: #0f172a;
    }}
    .card p {{
      margin: 0 0 1rem;
      color: #475569;
      line-height: 1.55;
      font-size: 0.95rem;
    }}
    .cta {{
      font-weight: 600;
      color: #059669;
      font-size: 0.9rem;
    }}
  </style>
</head>
<body>
  <main>
    <h1>ADK + A2UI v1.0 Codelabs</h1>
    <p class="lead">Select an interactive codelab track below. Generated via Google Codelabs <code>claat</code>.</p>
    <div class="grid">
      {"".join(cards)}
    </div>
  </main>
</body>
</html>
"""
    (DOCS_DIR / "index.html").write_text(index_html, encoding="utf-8")


def main() -> None:
    claat_bin = find_claat()
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    exported: list[tuple[CodelabSpec, str]] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        md_inputs: list[Path] = []
        for spec in CODELABS:
            src_text = (ROOT_DIR / spec.source_file).read_text(encoding="utf-8")
            title, claat_md = transform_for_claat(src_text, spec)
            out_md = tmp_path / f"{spec.codelab_id}.md"
            out_md.write_text(claat_md, encoding="utf-8")
            md_inputs.append(out_md)
            exported.append((spec, title))

        cmd = [claat_bin, "export", "-f", "html", "-o", str(DOCS_DIR), *map(str, md_inputs)]
        print("Running:", " ".join(cmd))
        subprocess.run(cmd, check=True, env={**os.environ, "HOME": str(Path.home())})

    write_landing_index(exported)
    print(f"Exported {len(exported)} codelabs to {DOCS_DIR}")


if __name__ == "__main__":
    main()
