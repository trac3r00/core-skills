# Contributing

## Local checks

Run the complete repository checks before opening a pull request:

```sh
python3 skills/skill-picker/scripts/generate_catalogue.py --check
pytest tests/
node --test skills/*/test/*.test.mjs
```

Skills need complete frontmatter, focused instructions, and deterministic
tests for executable behavior. Do not add credentials, personal data, or
generated catalogue edits by hand; regenerate `catalogue.json` with the
checked-in generator.

## Licensing

Every skill in this repository is authored by trac3r00 and released under
the MIT License. The detection rules in `comment-checker` are adapted from
oh-my-opencode / oh-my-claudecode.

## Pull requests

Keep changes scoped, explain user-visible behavior, and document validation.
New skills must be self-contained and must not depend on an unpinned external
repository except through an explicit, documented submodule or install step.
