# Native OmO configuration contract

This reference records the local contract observed on 2026-09-27 and the
boundaries the planner enforces. Recheck it against the installed host before
creating each new snapshot; host versions can change the schema.

## Observed paths and shapes

- The local install reports `omo-ai` version `5.0.0` and bundles
  `@code-yeongyu/senpi` version `2026.9.26`.
- The model-choice stage writes `~/.omo/omo.jsonc`, falling back to an existing
  `~/.omo/omo.json`. It writes native-harness settings under `[native]`; if the
  existing file has `[senpi]` and no `[native]`, it preserves `[senpi]` as the
  native block rather than creating a competing block.
- Category and agent assignments are named records under
  `[native].categories.<name>` and `[native].agents.<name>`. Both record names
  are schema-driven, not a closed enum. Built-in category examples in the
  installed runtime use `model: "provider/model-id"` and `variant`.
- The parent independently confirmed the installed runtime schema accepts
  `model` strings and `models` fallback arrays containing strings or objects;
  category entries also retain the legacy `fallback_models` field and support
  other target-specific fields. The complete agent/category field schema is not
  exported from the installed `categoryCoverage` runtime module.
- Runtime category availability is derived from `registry.getAvailable()` and
  category fallback chains. A catalog listing is not access evidence.
- `omo auth check --provider <provider> --model <model> --json --no-refresh`
  can provide an access snapshot. A provider-level `ready` status alone does
  not prove model entitlement or sufficient paid API balance. The command's
  default refresh behavior is deliberately not used here.

## Planner boundary

Snapshot v1 requires a versioned `nativeContract` with the exact selected block,
the `models` output field, both known legacy selection fields, and a complete
target inventory copied from the installed host contract. The planner does not
hardcode a role/category enum and does not claim to validate the host's full
strict schema.

If an existing target has `model` or `fallback_models`, the planner leaves that
target unchanged and reports `legacy-selection-fields-present`. This is
deliberate: their precedence can differ by host version, so the planner will not
guess whether either field shadows or augments `models`. Existing per-model
object settings inside `models` also block an automatic replacement rather
than being discarded. All other fields and unlisted custom targets are copied
unchanged into the proposal.

The planner accepts normalized JSON, not JSONC, and only prints a proposal. It
does not read `auth.json`, `models.json`, or live configuration; it does not
refresh credentials, contact a provider, write a config file, or apply a plan.

## Provenance

Locally inspected files:

- `omo-ai/bin/lib/setup-model-choices-import.js`
- `omo-ai/plugin/runtime/category-coverage/index.js`
- `@code-yeongyu/senpi/dist/core/model-config-schema.d.ts`
- `omo-ai/package.json` and `@code-yeongyu/senpi/package.json`

Official upstream schema sources at commit
`4139d615e140f267de4a34e57499fa7a5b8c7e7d` (retrieved by the investigation
agent; not assumed to be byte-identical to the installed version):

- [Category schema](https://github.com/code-yeongyu/oh-my-openagent/blob/4139d615e140f267de4a34e57499fa7a5b8c7e7d/packages/omo-config-core/src/schema/category.ts)
- [Agent schema](https://github.com/code-yeongyu/oh-my-openagent/blob/4139d615e140f267de4a34e57499fa7a5b8c7e7d/packages/omo-config-core/src/schema/agent.ts)
- [OmO config reference](https://github.com/code-yeongyu/oh-my-openagent/blob/4139d615e140f267de4a34e57499fa7a5b8c7e7d/docs/reference/omo-json.md)

When the current installed contract cannot be confirmed, set no candidates or
mark the inventory incomplete. Never fill the gap with a guessed model ID,
field, role, category, benchmark result, or access status.
