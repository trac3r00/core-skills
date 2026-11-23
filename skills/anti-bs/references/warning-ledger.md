# Warning ledger

One warning, one line. The ledger prevents both silent compliance and repeated moralizing.

## Classify

| Class | Examples | Does an explicit `yes` proceed? |
| --- | --- | --- |
| Advisory | Cost, reputational risk, likely legal exposure, platform preference, style, maintainability | Yes, within the user's authority. Record the acceptance and stop repeating it. |
| Third-party dependency | A credential, account, permission, or approval the agent does not have | Only after the dependency is actually supplied. A `yes` is not the credential. |
| Hard block | Host policy, third-party rights, destructive or irreversible action without authorization, unauthorized access | No. Name the block and the nearest compliant path. |
| Unknown rule | A claimed law or policy with no readable source | No. Mark UNKNOWN and ask for the exact source. |

## Record

```text
Warning: <person, skill, or source>: <specific risk in one sentence>
Class: advisory | third-party | hard block | unknown
Authority: user can accept | needs <credential/permission> | host policy
Action: proceed | wait for <input> | stop and offer <alternative>
```

Keep the ledger in the audit output. Do not repeat the same warning on every turn after the user has
accepted an advisory one.

## `yes` semantics

- `yes` accepts an **advisory** risk for the user's own action. It does not make the action legal,
  safe, reversible, or endorsed by a third party.
- `yes` does not supply a missing credential, grant a third party's permission, or override the host's
  hard policy.
- If the action needs a third party's data or systems, the user must have the authority to grant it.
  The agent must not help evade access controls, CAPTCHAs, rate limits, or authentication.
- If the warning is wrong or unsupported, say so and remove it. Do not keep a warning that has no
  source just because it sounds cautious.

## Examples

```text
Warning: platform terms: automated collection may violate the site's terms for this account.
Class: advisory
Authority: user can accept for their own account
Action: proceed with the least intrusive public route; do not bypass a login, CAPTCHA, or rate limit.
```

```text
Warning: no production credentials: the requested deployment cannot be performed here.
Class: third-party
Authority: needs the deployment credential and target account
Action: wait for the credential; provide the exact command and expected output.
```

```text
Warning: destructive database migration: the request does not authorize deleting production data.
Class: hard block
Authority: host policy and missing explicit authorization
Action: stop; offer a dry run, a backup, and a reversible migration plan.
```

## Common failures

- Repeating "are you sure?" after the user already said yes to an advisory risk.
- Calling a preference a law so the agent can avoid the work.
- Treating a `yes` as permission to touch another person's account or data.
- Omitting the warning entirely and then blaming the user for the outcome.
- Recording a warning but not the action actually taken.
