# Gate A melee assignment manifest

The sole machine-readable source of truth is
`packages/sim/src/content/unit-roster.ts`. This document is the task-facing Gate A view; if the two
disagree, stop fan-out and fix the canonical roster first. IDs, keys, producers, command slots,
god gates, foundation owners, status, and lane names are integration-owned and frozen before a
contributor starts.

## Implemented ordinary-melee packs

| Lane                    |  ID | Unit         | Culture  | Producer / command slot            | God      | Status      |
| ----------------------- | --: | ------------ | -------- | ---------------------------------- | -------- | ----------- |
| `greek-hoplite`         |  64 | Hoplite      | Greek    | Military Academy / 0               | Any      | Implemented |
| `greek-hypaspist`       |  65 | Hypaspist    | Greek    | Military Academy / 1               | Any      | Implemented |
| `greek-hippikon`        |  66 | Hippikon     | Greek    | Stable / 0                         | Any      | Implemented |
| `greek-prodromos`       |  67 | Prodromos    | Greek    | Stable / 1                         | Any      | Implemented |
| `greek-myrmidon`        |  68 | Myrmidon     | Greek    | Military Academy / 2; Fortress / 2 | Zeus     | Implemented |
| `greek-hetairoi`        |  84 | Hetairoi     | Greek    | Stable / 2; Fortress / 2           | Poseidon | Implemented |
| `egyptian-spearman`     |  69 | Spearman     | Egyptian | Barracks / 0                       | Any      | Implemented |
| `egyptian-axeman`       |  70 | Axeman       | Egyptian | Barracks / 1                       | Any      | Implemented |
| `egyptian-camelry`      |  71 | Camelry      | Egyptian | Migdol Stronghold / 1              | Any      | Implemented |
| `egyptian-war-elephant` |  72 | War Elephant | Egyptian | Migdol Stronghold / 2              | Any      | Implemented |

“Ready” means the existing direct-hit ground-melee contract can represent the base unit faithfully.
Technology upgrades remain a later progression slice; a pack must pin the Extended Edition / The
Titans base-unit values and must not import Retold balance.

## Serially blocked packs

| Lane                         | Foundation owner           |  ID | Unit              | Blocker                                                             |
| ---------------------------- | -------------------------- | --: | ----------------- | ------------------------------------------------------------------- |
| `militia`                    | `serial-death-spawn-units` |   1 | Militia           | Poseidon building-destruction spawn and exceptional creation rules. |
| `greek-kataskopos`           | `serial-starting-units`    |  80 | Kataskopos        | Starting-only creation; Classic players cannot train replacements.  |
| `egyptian-mercenary`         | `serial-temporary-units`   | 133 | Mercenary         | Deterministic 45-second lifetime and exceptional removal rules.     |
| `egyptian-mercenary-cavalry` | `serial-temporary-units`   | 157 | Mercenary Cavalry | Deterministic 45-second lifetime and exceptional removal rules.     |

Blocked units must not receive simplified Gate A implementations. Their substrate lands serially,
with command, simulation, snapshot, hash, presentation, and determinism coverage, before their packs
can fan out.

## Fan-out rule

Assign one ready lane per contributor using [UNIT_PACK_TEMPLATE.md](UNIT_PACK_TEMPLATE.md). A lane
that discovers a missing shared capability stops and reports it to the integration owner; it does not
edit shared runtime files or add a unit-specific escape hatch.
