---
name: side-hustle
description: "Plan lawful extra income: freelancing, bug bounty, hackathons. Use when asked to start or grow a no-capital side hustle. Not for tax advice (tax-advisor)."
version: 1.1.0
license: MIT
metadata:
  agentskills:
    tags: [income, freelancing, bug-bounty, planning]
---

# Side Hustle

The goal is net cash in the user's hands, not activity. Start with a cash lane that can pay soon,
add one compounding lane, and reinvest only money the user has actually earned.

This is an operating plan, not a promise. No lane has a guaranteed payout. Report ranges only when a
source supports them, and label every estimate.

## Inputs

Establish only what changes the plan:

- three things the user can deliver now, with evidence (shipped work, portfolio, repo, certification);
- hours per week and preferred schedule;
- country and payout method, for platform eligibility and tax records;
- language(s) and time zone;
- existing audience, accounts, or reputation;
- risk tolerance and hard limits;
- starting capital: default is zero, and this skill does not spend the user's existing savings.

If the user cannot name a deliverable, use a short skills inventory before choosing a lane.

## Choose lanes

Expected value is `(payout range x realistic win probability) / hours to cash`, not the biggest
headline prize. Use the user's evidence to choose; do not invent conversion rates.

| Lane | Time to first cash | Variance | Capital | Best fit | Main risk |
| --- | --- | --- | --- | --- | --- |
| Freelance service | Days to weeks | Low-medium | 0 | A skill someone already pays for | Scope creep, late payment |
| Authorized bug bounty | Weeks to months | High | 0 | Security skill and patience | Out-of-scope testing, duplicates |
| Online hackathon | Days to weeks | High | 0 | Builders who can demo fast | Eligibility, IP terms, lost weekend |
| Productized service | Weeks to months | Medium | 0 | Repeatable delivery | Slow first sale |
| Content or micro-product | Months | Medium-high | 0 | Existing audience | No audience, slow compounding |
| Stocks or crypto | Immediate | High | Earned cash only | A patient, risk-aware investor | Losses, taxes, leverage |

Default sequence:

1. Pick one **cash lane**: freelancing or authorized bug bounty.
2. Pick one **compounding lane**: productized service, content, or a small product.
3. Do not start stocks or crypto until the cash lane has produced money, taxes are set aside, and a
   cash buffer exists. Never use borrowed money or leverage.

## Freelancing playbook

1. **Narrow the offer.** One buyer, one painful job, one deliverable. "I build X for Y" beats "I do
   design, development, and marketing".
2. **Build three proofs.** A real sample, a case study, or a public artifact for each claim. Do not
   invent client work.
3. **Make the profile findable.** Headline, outcome, proof, process, price range, availability. Use
   the `browser` skill for signed-in platforms and `ultimate-browsing` for a blocked listing.
4. **Do targeted outreach.** Twenty specific proposals or messages per week beats mass spam. Mention
   the buyer's actual problem, the deliverable, the price range, and a next step.
5. **Qualify before proposing.** Budget, decision maker, deadline, scope, and what "done" means.
6. **Use a fixed-scope agreement.** Deliverables, revisions, timeline, payment schedule, IP, and what
   is out of scope. A deposit before work is normal.
7. **Deliver, collect a testimonial, raise the price.** Track hours and effective hourly rate.

Proposals and client messages need approval of the exact text and destination (see Boundaries).

## Authorized bug bounty playbook

Only test programs that publish a written scope and authorization. A public URL is not authorization.

1. Read the program scope, rules, disclosure policy, and prohibited techniques.
2. Use a separate research account and the least intrusive test that proves the issue.
3. Never access other users' data, run denial-of-service tests, use social engineering, or test
   out-of-scope assets. Stop when scope is ambiguous.
4. Reproduce on a lab or the in-scope asset; capture the minimum evidence; redact secrets and personal
   data.
5. Report: summary, affected asset, preconditions, reproduction, impact, evidence, suggested fix.
6. Track submission status, duplicates, and payout terms. Respect the disclosure timeline.

Practice on intentionally vulnerable labs before a live program. Do not buy "bounty secrets" or use
automated scanners against a target without permission.

## Online hackathon playbook

- Prefer online events with clear eligibility and judging criteria.
- Read the IP and licensing terms before submitting.
- Pick a problem the user can demo in three minutes and ship in the available time.
- Reuse a project template, but do not reuse another team's code without a license.
- Submit the required repo, demo video, and write-up before the deadline.
- Treat prizes as uncertain; the durable return is a shipped artifact and a network.

## Stocks and crypto without new capital

This is not financial advice. The user decides; the agent does not trade, transfer, or custody funds.

- Fund only from cash actually earned by the side hustle, after tax set-aside and an emergency buffer.
- Never use margin, leverage, borrowed money, or a credit card.
- No guaranteed-return schemes, paid signal groups, or "risk-free" yield claims.
- Start with broad, low-cost diversified funds before speculative single assets.
- If the user wants crypto, cap it as a small speculative allocation and expect loss; keep records.
- Paper trade first and write down the rule for entry, exit, and maximum loss.
- Follow local tax and reporting rules; do not help evade them.

## 30/60/90 plan

### Days 1-14: set the table

- Pick one cash lane and one compounding lane.
- Write the offer, three proofs, and a price range.
- Create or update one profile per chosen platform.
- Send 20 targeted proposals or messages; log every one.
- Shortlist five authorized bounty programs or one online hackathon.
- Create the income ledger from [assets/income-ledger.md](assets/income-ledger.md).

### Days 15-30: first signal

- Deliver the first paid piece or submit two to three bounty reports.
- Ship one hackathon or productized-service artifact.
- Review hours, replies, conversion, and cash in/out.
- Kill the channel with no signal; double the one with signal.

### Days 31-90: repeat and raise

- Raise the price or narrow the niche after the first proof.
- Turn the repeatable part into a template or productized offer.
- Reinvest a fixed percentage of earned cash only after tax set-aside and buffer.
- Keep a weekly review: cash, hours, pipeline, and next action.

## Boundaries and approvals

- Do not create accounts, submit applications, send client messages, or spend money without explicit
  approval of the exact action.
- No unauthorized security testing, fake reviews, spam, plagiarism, MLM, gambling, borrowed money, or
  tax evasion.
- Do not promise income or a timeline. Use ranges and label estimates.
- Do not present this plan as legal, tax, or investment advice. Point the user to a qualified local
  professional for their situation.
- If a platform's current fees, eligibility, or terms matter, verify them at the source before relying
  on them. The platform playbooks are in [references/lanes.md](references/lanes.md).

## Output

Deliver:

1. the chosen cash lane and compounding lane, with the reason and the rejected alternatives;
2. the offer, three proofs, and the first profile changes;
3. the first five actions with dates and hours;
4. the first ten opportunities with URLs, deadlines, eligibility, and payout terms;
5. the ledger and weekly review cadence;
6. the excluded lanes and the reason.

## Stop condition

Stop when the user has a lane choice, a first offer, five scheduled actions, a ledger, and a list of
actions that require their approval. If the user has not approved account creation, outreach, or
spending, stop before those actions and report them as pending.
