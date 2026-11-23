# Professional README standard

The section order below is the default. Drop a section only when the project
has nothing for it; never leave an empty heading. Rename a heading only to match
the project's own vocabulary (for example "Modules" instead of "Architecture").

## Length budget

- Target 150-400 lines for an application or CLI; 80-200 for a library.
- Above 250 lines, add a table of contents after the badges.
- Anything longer than one screen on a single topic moves to `docs/` with a
  one-paragraph summary and a link. Do not create those docs in this skill;
  link only to files that exist, and list missing ones in the report.

## Section order

1. **Header**: optional centered logo or hero image (existing asset only,
   file present in the repository), `# <project name>` using the `name` fact
   from the parent (manifest name, else Git remote name, else directory
   name, as the parent resolved and cited it), then one bold sentence
   that says what it is and who it is for. A second plain sentence may say what
   it is not, when confusion is likely (fork vs. plugin, client vs. server).
2. **Badges**: only badges whose value comes from a real source: release/version
   from the manifest or tags, license from `LICENSE`, CI status from an actual
   workflow, supported runtime from `engines` or equivalent. No "maintained",
   "awesome" or placeholder badges. An existing badge of that kind is
   removed and the removal recorded in `leads.md`; an existing factual badge
   whose value is stale is replaced with the sourced value. A fact passed as
   `absent` gets no badge.
3. **Table of contents**: only when the length budget requires it.
4. **Why / What it provides**: the problem and the outcome, in the user's
   terms. A feature table (`Area | Feature | What you get`) beats a bullet
   list once there are more than five features. Every row cites evidence.
5. **Requirements**: runtime and version (from `engines`, `requires-python`,
   `rust-version`, `go` directive), OS constraints, external services, and
   accounts. State what is optional.
6. **Install**: the shortest verified path first, alternatives after. Exact
   commands in fenced blocks with the language tag. If install is from source,
   use the parent's `repository URL` fact for the clone URL. When that fact
   is `absent`, omit source-clone instructions; if that leaves no install
   path backed by a `run`, exit-0 command, publication is blocked per
   SKILL.md step 3, not papered over with a guessed URL.
7. **Quick start**: the single smallest thing that proves it works, with the
   expected output or observable result. For a library this is an import and a
   call; for a CLI, one command; for a service, start it and hit one endpoint.
8. **Usage**: the main workflows, each as a short subsection: goal, command or
   code, what happens. Group by user task, not by source module.
9. **Configuration**: a table of keys (`Key | Default | Effect | Where`), file
   locations, environment variables, and precedence. Defaults come from code,
   not from memory.
10. **Architecture / How it works**: only for projects with more than one
    moving part. One paragraph plus a module table or a text diagram. Point to
    the directories a contributor opens first.
11. **Development**: clone, install dev dependencies, build, test, lint, and
    the release procedure if contributors run it. All commands verified.
12. **Troubleshooting / FAQ**: only entries backed by an issue, a code path, or
    a reproduced symptom.
13. **Contributing**: link `CONTRIBUTING.md` when it exists; otherwise two
    sentences on how to open an issue or PR and which checks must pass.
14. **License**: the SPDX name from `LICENSE` and the holder line if present.
15. **Acknowledgments / Credits**: upstream projects, bundled third-party work
    with their licenses, sponsors. Required when the repository vendors code.

## Writing rules

- Audience first: assume a competent engineer who has never seen the project.
  Define a term the first time it appears or link to where it is defined.
- Lead with outcomes, then mechanisms. "Routes requests to the account with
  the most remaining quota" before "implements a scheduler".
- One idea per paragraph; three to five sentences maximum.
- Commands are copy-pasteable: no `$` prompt prefix, no `...` elisions, real
  paths. Show expected output when it is short and stable.
- Prefer tables for anything with three or more parallel attributes.
- Relative links for files in the repository; absolute links for everything
  else. Check that every target exists.
- No emoji in headings; no marketing superlatives; no roadmap promises
  phrased as features. Planned work goes under a clearly labeled "Roadmap"
  subsection only if the repository has a roadmap file to cite.
- Past tense for history belongs in the changelog, not here.
- Keep the voice consistent: second person for instructions ("run", "set"),
  third person for descriptions ("the CLI reads").

## Quality checklist (parent and reviewer both apply it)

| # | Check | Fails when |
| --- | --- | --- |
| Q1 | Every claim maps to an `observed` or `declared` packet line | A sentence cites a `lead`, or nothing |
| Q2 | Every command has a `run`, exit-0 entry in `commands.md` | A command has no entry, or its entry is `failed` or `not run`; annotations such as "unverified" do not cure this |
| Q3 | Header sentence states what and for whom | Reader cannot say who should install it |
| Q4 | Quick start proves the install worked | It only repeats install, or has no observable result |
| Q5 | Configuration defaults match code | Any default differs from the source |
| Q6 | Section order follows the standard; omitted sections noted in the report | Empty heading, or an unexplained missing section |
| Q7 | Links and images resolve | A relative target is absent |
| Q8 | Length within budget; TOC present when required | Over budget without links out |
| Q9 | Evidence-supported assets still present; every removal or replacement is recorded in `leads.md` with a reason | A supported badge, logo, notice, or user-named section vanished, or an unsupported one was removed without a `leads.md` entry |
| Q10 | No unsupported adjectives or roadmap-as-feature | "fast", "secure", "soon" without a cited source |
| Q11 | Version, runtime and license agree with manifests | Any of the three disagrees |
| Q12 | Old README claims the code no longer supports are listed in the report | A stale claim was silently dropped or silently kept |
