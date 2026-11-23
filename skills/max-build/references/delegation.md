# Delegation: spawn or not, cheapest capable lane, escalation

Read this in Phase 3 before spawning anything, and whenever a unit fails.

## Spawn or stay local

A child is a full session: it re-reads context, re-plans and reports. In the
2026-11-16 bench ([bench.md](bench.md)) one child cost 0.7M to 4.5M tokens.
Spawn only when one of these holds:

- Independent units whose parallel run finishes sooner than doing them in
  sequence, after paying each child's startup.
- Heavy evidence (wide search, big logs, external docs) that would flood the
  coordinator's context.
- A separate perspective is the point: a critic, an adversary, an independent
  oracle.

Otherwise stay local and batch the work into `eval` cells. Never spawn a child
to verify your own work's routine checks, and never to wait on something.

## Cost tiers

Categories route to models configured in the host's OmO config
(`categories.<name>.models` in `omo.jsonc`); read it once per session to know
the real order. On the default routing seen on 2026-11-16 the order, cheapest
first, was:

| Tier | Lane | Model class seen |
| --- | --- | --- |
| 0 | Local `eval` cells, `completion` with `smol` | no child session |
| 1 | `explore`, `librarian` (read-only agents); `quick` | small fast model |
| 2 | `unspecified-low` | mid model, medium reasoning |
| 3 | `writing`, `visual-engineering` | strong model tuned for prose or visuals |
| 4 | `deep-low`, `unspecified-high`, `artistry` | top general model, high reasoning |
| 5 | `deep-high`, `ultrabrain`, `architect` | the most expensive model at maximum reasoning |

## Pick the cheapest capable lane

| Unit | Start at | Never start at |
| --- | --- | --- |
| Find code, history or config facts | `explore` (or local `eval` when one wave covers it) | any implementation lane |
| External docs, library or API facts | `librarian`, or `context7` locally | tier 4-5 |
| Mechanical edit with exact steps (rename, add a field, apply a recipe), or a codemod run | local, else `quick` | tier 3-5 |
| Implementation that follows an existing pattern in the repo | local, else `quick` with the pattern file named, else `unspecified-low` | tier 5 |
| Implementation that needs judgment the child can settle from what it reads | `unspecified-low` or `deep-low` | tier 5 |
| UI, styling, layout | local with `frontend` and `visual-qa`; else `visual-engineering` | tier 5 |
| Docs, reports, prose | local; else `writing` | tier 4-5 |
| A decision evidence cannot settle (trade-off, cross-boundary contract, no pattern to copy) | `deep-high`, with the decision named in the brief | below tier 4 |
| Proof-shaped logic or a hard algorithm | `ultrabrain`, goal only | below tier 4 |
| System design across many sources, advisory | `architect`, marked advisory-only | implementation lanes |

Rules:

- Pick the lowest tier that can do the unit. A tier 4-5 lane needs a one-line
  reason in the brief and the ledger naming the judgment the cheaper lanes
  lack.
- Q's prompt prefers many small `quick` units over `unspecified-low`. That
  holds for mechanical units with exact steps; a unit that needs judgment goes
  to the lowest lane that has that judgment, or `quick` will guess.
- Read-only work (questions, reviews, report-only requests) spawns only
  read-only lanes: `explore`, `librarian`, or `architect` marked advisory-only.
  Never an implementation lane.
- Never pass `model` together with `category`. Routing may fall back to another
  model when quota runs out; record the model each child actually ran on.

## Escalate inside the run, one step at a time

Escalation is automatic: never ask the user to approve a stronger lane. Move up
one step only on evidence, carry the findings forward, and drop back down for
the next unit once the hard one is done.

| Evidence | Escalate to |
| --- | --- |
| A `quick` or `unspecified-low` child fails its check after one fix round, or reports a judgment it could not make | the next tier up (`deep-low` for implementation) with its findings and the failing output |
| A `deep-low` child returns `ESCALATE: deep-high` or names a decision evidence cannot settle | `deep-high` with the same brief plus that decision |
| Two fixes on one premise fail the same check | first test the premise locally ([judgment.md](judgment.md)); escalate only if the premise itself needs deeper reasoning |
| Local work hits a unit that is hard logic or a contested design | the matching tier 5 lane for that unit only |
| `completion` with `smol` gives inconsistent or malformed answers | `default`, then `slow` |
| An `explore` or `librarian` lookup returns nothing useful twice | another source first (`context7`, `web_search`, local package source), then `ulw-research` |
| Size S work turns out to touch many files or modules | size M (goal, evidence children, parallel `quick`) |
| A self-audit at size S finds a risk it cannot settle | `review-work` |

De-escalate: a unit that succeeded at a lower tier sets the starting tier for
similar units. Never escalate the whole run because one unit was hard. Record
each escalation and its outcome in the ledger, and in memory when it reveals a
pattern (for example "units touching X need `deep-low`").

## Brief shape

Every child prompt starts with `TASK:` and states DELIVERABLE, SCOPE (exact
files it may write), VERIFY (the C# it must pass) and STOP WHEN. Add the
restated goal, forbidden scope, and `load_skills` for the native skills the job
triggers ([native.md](native.md)). A `quick` brief also lists numbered steps.
Ask each child to return `ESCALATE: <lane> because <decision>` instead of
guessing when its lane cannot settle something. Run independent children in one
`task` batch with `run_in_background: true` and check each artifact yourself
when it lands.
