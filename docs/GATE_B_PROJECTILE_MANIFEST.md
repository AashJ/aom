# Gate B projectile assignment manifest

The sole machine-readable source of truth is
`packages/sim/src/content/unit-roster.ts`. This document is the task-facing Gate B view; if the two
disagree, stop fan-out and fix the canonical roster first. IDs, keys, producers, command slots, god
gates, foundation owners, status, and lane names are integration-owned and frozen before a
contributor starts. Complete expected values and hashed source evidence come from the candidate
reference printed by `bun run unit:lane brief <lane>`.

## Implemented proof pack

| Lane            |  ID | Unit    | Culture | Producer / command slot | Projectile | Status      |
| --------------- | --: | ------- | ------- | ----------------------- | ---------- | ----------- |
| `greek-toxotes` |  81 | Toxotes | Greek   | Archery Range / 0       | Arrow      | Implemented |

## Ready ordinary-projectile packs

| Lane                      |  ID | Unit           | Culture  | Producer / command slot | God   | Projectile  | Cycle / release ticks | Status |
| ------------------------- | --: | -------------- | -------- | ----------------------- | ----- | ----------- | --------------------: | ------ |
| `greek-peltast`           |  82 | Peltast        | Greek    | Archery Range / 1       | Any   | Javelin     |               30 / 12 | Ready  |
| `greek-gastraphetes`      |  83 | Gastraphetes   | Greek    | Fortress / 2            | Hades | Arrow       |                42 / 7 | Ready  |
| `egyptian-slinger`        | 128 | Slinger        | Egyptian | Barracks / 2            | Any   | Sling stone |                20 / 8 | Ready  |
| `egyptian-chariot-archer` | 129 | Chariot Archer | Egyptian | Migdol Stronghold / 0   | Any   | Arrow       |               30 / 19 | Ready  |

“Ready” means the existing ordinary projectile contract can represent the Classic base unit
faithfully and an integration-owned candidate reference independently fixes its complete expected
definition. Technology upgrades remain a later progression slice; a pack must not import Retold
balance or classification changes.

## Reference lifecycle

The candidate reference is immutable input to the unit lane. The contributor implements only the
four owned pack paths and hands the lane back for integration review. Once the reviewed pack commit
exists, the integration owner changes the reference to `final`, pins that commit and review scope,
marks the roster lane `implemented`, regenerates catalogs, and runs the complete suite. The lifecycle
validator rejects skipping this ordering.

## Fan-out rule

Assign one ready lane per contributor using [UNIT_PACK_TEMPLATE.md](UNIT_PACK_TEMPLATE.md). A lane
that discovers a missing shared capability stops and reports it to the integration owner; it does not
edit shared runtime files or add a unit-specific escape hatch.
