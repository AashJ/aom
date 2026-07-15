# Gate A melee assignment manifest

The machine-readable source of truth is
`packages/sim/src/content/gate-a-manifest.ts`. This document is the task-facing view; if the two
disagree, stop fan-out and fix the machine manifest first. IDs, keys, producers, command slots,
god gates, and lane names are integration-owned and frozen before a contributor starts.

## Parallel-ready packs

| Lane                    |  ID | Unit         | Culture  | Producer / command slot            | God      | Status         |
| ----------------------- | --: | ------------ | -------- | ---------------------------------- | -------- | -------------- |
| `greek-hoplite`         |  64 | Hoplite      | Greek    | Military Academy / 0               | Any      | Proof complete |
| `greek-hypaspist`       |  65 | Hypaspist    | Greek    | Military Academy / 1               | Any      | Ready          |
| `greek-hippikon`        |  66 | Hippikon     | Greek    | Stable / 0                         | Any      | Ready          |
| `greek-prodromos`       |  67 | Prodromos    | Greek    | Stable / 1                         | Any      | Ready          |
| `greek-myrmidon`        |  68 | Myrmidon     | Greek    | Military Academy / 2; Fortress / 2 | Zeus     | Ready          |
| `greek-hetairoi`        |  84 | Hetairoi     | Greek    | Stable / 2; Fortress / 2           | Poseidon | Ready          |
| `egyptian-spearman`     |  69 | Spearman     | Egyptian | Barracks / 0                       | Any      | Proof complete |
| `egyptian-axeman`       |  70 | Axeman       | Egyptian | Barracks / 1                       | Any      | Ready          |
| `egyptian-camelry`      |  71 | Camelry      | Egyptian | Migdol Stronghold / 1              | Any      | Ready          |
| `egyptian-war-elephant` |  72 | War Elephant | Egyptian | Migdol Stronghold / 2              | Any      | Ready          |

“Ready” means the existing direct-hit ground-melee contract can represent the base unit faithfully.
Technology upgrades remain a later progression slice; a pack must pin the Extended Edition / The
Titans base-unit values and must not import Retold balance.

## Serially blocked packs

| Lane                       |  ID | Unit              | Blocker                                                             |
| -------------------------- | --: | ----------------- | ------------------------------------------------------------------- |
| `serial-death-spawn-units` |   1 | Militia           | Poseidon building-destruction spawn and exceptional creation rules. |
| `serial-starting-units`    |  80 | Kataskopos        | Starting-only creation; Classic players cannot train replacements.  |
| `serial-temporary-units`   | 133 | Mercenary         | Deterministic 45-second lifetime and exceptional removal rules.     |
| `serial-temporary-units`   | 157 | Mercenary Cavalry | Deterministic 45-second lifetime and exceptional removal rules.     |

Blocked units must not receive simplified Gate A implementations. Their substrate lands serially,
with command, simulation, snapshot, hash, presentation, and determinism coverage, before their packs
can fan out.

## Fan-out rule

Assign one ready lane per contributor using [UNIT_PACK_TEMPLATE.md](UNIT_PACK_TEMPLATE.md). A lane
that discovers a missing shared capability stops and reports it to the integration owner; it does not
edit shared runtime files or add a unit-specific escape hatch.
