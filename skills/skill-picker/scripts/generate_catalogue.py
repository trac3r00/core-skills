#!/usr/bin/env python3
"""generate-catalogue: build catalogue.json from the actual skills/ directory.

No hand-maintained duplication — the catalogue is generated from the source
of truth (each skill's SKILL.md frontmatter) and validated against the
directory structure. Run after adding, removing, or renaming any skill.

Usage:
    generate_catalogue.py                    # write catalogue.json to repo root
    generate_catalogue.py --check            # validate without writing (CI gate)
    generate_catalogue.py --json             # print to stdout

Exit codes: 0 ok, 1 catalogue stale/invalid, 2 usage error.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
if not (REPO / "skills").is_dir():
    REPO = Path(__file__).resolve().parent.parent.parent.parent
SKILLS = REPO / "skills"
CATALOGUE = REPO / "catalogue.json"

FM_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)
FIELD_RE = re.compile(r"^(\w+):\s*(.+?)\s*$", re.M)
TAGS_RE = re.compile(r"tags:\s*\[(.+?)\]")

FAMILIES = {
    "guards": ["context-budget", "claim-audit", "open-loops", "subscription-audit", "gate-graph", "skill-decay", "comment-checker"],
    "interop": ["skill-sync", "session-handoff", "session-rules", "usage-audit"],
    "security": ["secret-gate", "skill-audit", "usage-audit"],
    "backend": ["env-gate", "diff-review", "portfolio-audit", "doc-reader", "seo-audit", "resume-audit", "api-tester", "log-analyzer", "json-diff", "repo-audit", "changelog-gen", "code-review", "sec-headers", "net-probe", "sys-health", "graph-tools", "ext-scaffold", "cron-audit"],
    "process": ["astra-init", "anti-bs", "loe", "dft", "fdd", "preflight", "init-rules", "finish-pr", "cleanup-worktrees", "ci-test-rebuild", "cyber-bypass"],
    "creative": ["3d-design", "image-gen", "claude-design", "karpathy-prompt"],
    "power": ["pro-review", "create-skills", "init-readme", "readme-init"],
    "orchestration": ["max-build", "herdr", "watcher", "omo-runner", "optimize-omo-config", "apps-handoff", "browser-aside", "project-sessions", "session-finder", "prompt-builder", "reorient"],
    "macos": ["apple-suite", "apple-home", "apple-tv", "appshot", "finder", "iphone-mirroring", "macos-settings", "moffice", "phone-facetime", "spotify"],
    "connectors": ["discord-messenger", "slack-messenger", "kakao-messenger", "notion", "obsidian-vault", "vaultwarden"],
}

PERSONAS = {
    "coding": ["comment-checker", "secret-gate", "diff-review", "fdd", "anti-bs", "finish-pr"],
    "frontend": ["seo-audit", "claude-design"],
    "backend": ["env-gate", "portfolio-audit", "doc-reader", "diff-review", "api-tester", "log-analyzer", "json-diff"],
    "devops": ["env-gate", "secret-gate", "diff-review", "api-tester", "log-analyzer", "repo-audit", "changelog-gen", "herdr", "ci-test-rebuild", "preflight", "cleanup-worktrees", "sys-health"],
    "agentic": ["skill-sync", "session-handoff", "session-rules", "skill-audit", "skill-decay", "usage-audit", "context-budget", "open-loops", "astra-init", "herdr", "pro-review", "max-build", "watcher", "omo-runner", "project-sessions", "session-finder", "create-skills", "prompt-builder", "reorient", "cyber-bypass"],
    "design": ["seo-audit", "3d-design", "image-gen", "claude-design"],
    "verification": ["claim-audit", "comment-checker", "secret-gate", "skill-audit", "gate-graph", "env-gate", "diff-review", "resume-audit", "seo-audit", "portfolio-audit", "pro-review", "anti-bs", "loe", "dft", "preflight"],
    "career": ["resume-audit", "doc-reader", "side-hustle"],
    "finance": ["portfolio-audit", "subscription-audit"],
    "data": ["json-diff", "log-analyzer"],
    "macos": ["apple-suite", "apple-home", "apple-tv", "appshot", "finder", "iphone-mirroring", "macos-settings", "moffice", "phone-facetime", "spotify", "kakao-messenger"],
    "research": ["session-handoff", "usage-audit", "game-film", "notion", "obsidian-vault"],
    "qa": ["diff-review", "seo-audit", "dft", "preflight"],
    "writing": ["karpathy-prompt", "readme-init", "init-readme"],
}


def parse_skill(skill_dir: Path) -> dict:
    md = skill_dir / "SKILL.md"
    if not md.is_file():
        return {}
    text = md.read_text(errors="replace")
    m = FM_RE.match(text)
    if not m:
        return {}
    fm = m.group(1)
    fields = dict(FIELD_RE.findall(fm))
    tags_m = TAGS_RE.search(fm)
    tags = [t.strip().strip('"') for t in tags_m.group(1).split(",")] if tags_m else []
    has_scripts = (skill_dir / "scripts").is_dir() and any(
        (skill_dir / "scripts").glob("*.py"))
    family = next((f for f, members in FAMILIES.items() if skill_dir.name in members),
                  "other")
    personas = sorted(p for p, members in PERSONAS.items() if skill_dir.name in members)
    return {
        "name": skill_dir.name,
        "description": fields.get("description", ""),
        "version": fields.get("version", ""),
        "license": fields.get("license", ""),
        "tags": tags,
        "family": family,
        "personas": personas,
        "script_backed": has_scripts,
        "path": f"skills/{skill_dir.name}",
    }


def generate() -> dict:
    skills = []
    for d in sorted(SKILLS.iterdir()):
        if not d.is_dir():
            continue
        entry = parse_skill(d)
        if entry:
            skills.append(entry)
    return {
        "version": "1.0.0",
        "count": len(skills),
        "families": {f: [s["name"] for s in skills if s["family"] == f]
                     for f in sorted({s["family"] for s in skills})},
        "personas": {p: [s["name"] for s in skills if p in s["personas"]]
                     for p in sorted(PERSONAS)},
        "skills": skills,
    }


def main() -> int:
    check = "--check" in sys.argv
    to_stdout = "--json" in sys.argv
    cat = generate()

    if check:
        if not CATALOGUE.is_file():
            print("catalogue.json missing — run generate_catalogue.py", file=sys.stderr)
            return 1
        existing = json.loads(CATALOGUE.read_text())
        if existing != cat:
            stale = set(s["name"] for s in cat["skills"]) - set(
                s["name"] for s in existing["skills"])
            extra = set(s["name"] for s in existing["skills"]) - set(
                s["name"] for s in cat["skills"])
            print(f"catalogue.json stale: new={stale or 'none'} removed={extra or 'none'}",
                  file=sys.stderr)
            return 1
        print(f"catalogue.json valid: {cat['count']} skills")
        return 0

    if to_stdout:
        print(json.dumps(cat, indent=2))
        return 0

    CATALOGUE.write_text(json.dumps(cat, indent=2) + "\n")
    print(f"catalogue.json written: {cat['count']} skills, "
          f"{len(cat['families'])} families, {len(cat['personas'])} personas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
