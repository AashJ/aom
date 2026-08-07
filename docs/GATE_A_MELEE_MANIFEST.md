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

## Hero packs

| Lane                | Foundation owner                 |  ID | Unit        | Status |
| ------------------- | -------------------------------- | --: | ----------- | ------ |
| `greek-achilles`    | `serial-variable-melee-cycles`   | 106 | Achilles    | Ready  |
| `greek-bellerophon` | `serial-jump-special`            |  99 | Bellerophon | Ready  |
| `greek-polyphemus`  | `serial-special-target-taxonomy` | 103 | Polyphemus  | Ready  |
| `greek-perseus`     | `serial-petrification-special`   | 107 | Perseus     | Ready  |

Achilles owns the first hero reuse of unequal source-authored melee cycles. Bellerophon extends the
jump foundation with a source-authored single-cycle, direct-target leap while preserving the
original model's embedded vertical motion. Polyphemus adds generic
huntable/Set-animal taxonomy and frozen/stone special-target exclusions while reusing the charged
melee and thrown-reaction foundations. Perseus adds terminal petrification, special-range command
acquisition, stone death-state presentation, and recursively animated model attachments for his
carried Medusa head and snakes. All four have candidate Classic references, original media, and
determinism coverage and remain `ready` until final ruleset review closes them.

## Exceptional-lifecycle packs

| Lane                         | Foundation owner           |  ID | Unit              | Status |
| ---------------------------- | -------------------------- | --: | ----------------- | ------ |
| `militia`                    | `serial-death-spawn-units` |   1 | Militia           | Ready  |
| `greek-kataskopos`           | `serial-starting-units`    |  80 | Kataskopos        | Ready  |
| `egyptian-mercenary`         | `serial-temporary-units`   | 133 | Mercenary         | Ready  |
| `egyptian-mercenary-cavalry` | `serial-temporary-units`   | 157 | Mercenary Cavalry | Ready  |

These packs have candidate references and complete command, simulation, snapshot, hash,
presentation, and determinism coverage. They remain `ready` until final ruleset review closes them.

## Myth-unit packs

| Lane                | Foundation owner                 |  ID | Unit        | Status      |
| ------------------- | -------------------------------- | --: | ----------- | ----------- |
| `greek-minotaur`    | `serial-myth-unit-lifecycle`     | 113 | Minotaur    | Implemented |
| `greek-nemean-lion` | `serial-area-whirlwind-special`  | 116 | Nemean Lion | Implemented |
| `greek-centaur`     | `serial-charged-ranged-special`  | 114 | Centaur     | Ready       |
| `greek-manticore`   | `serial-charged-ranged-special`  | 117 | Manticore   | Ready       |
| `greek-medusa`      | `serial-petrification-special`   | 120 | Medusa      | Ready       |
| `greek-chimera`     | `serial-projectile-area-effects` | 122 | Chimera     | Ready       |
| `egyptian-anubite`  | `serial-jump-special`            | 144 | Anubite     | Ready       |
| `egyptian-sphinx`   | `serial-area-whirlwind-special`  | 145 | Sphinx      | Ready       |
| `egyptian-wadjet`   | `serial-unit-regeneration`       | 146 | Wadjet      | Ready       |
| `egyptian-scarab`   | `serial-death-area-attacks`      | 149 | Scarab      | Ready       |
| `greek-hydra`       | `serial-hydra-kill-experience`   | 118 | Hydra       | Ready       |

Centaur, Manticore, Medusa, Chimera, Anubite, Sphinx, Wadjet, Scarab, and Hydra have candidate Classic
references and
complete ordinary-cycle, presentation, audio, and determinism coverage. Centaur owns the initial
charged-projectile slice and preserves its guaranteed tracking shot; Manticore adds atomic ordinary
and charged volleys plus impact-centered projectile area damage; Chimera adds source-authored
neutral splash, invisible delivery projectiles, and a forward three-texture fire-breath emitter.
Anubite owns deterministic phased attacker displacement, a locked airborne arc, and landing-area
damage. Sphinx owns the charged area-pulse and source-bound point-particle slice; Wadjet owns persistent regeneration and source-bound particle
projectiles; Scarab owns deterministic constant-radius death damage and chained death processing;
Hydra owns capped lethal-hit experience, per-kill damage scaling, and five source-driven visual
tiers. Medusa reuses terminal petrification from range and adds a source-bound continuously emitting
head glow. They remain `ready` until final ruleset review closes them.

## Siege-unit packs

| Lane                | Foundation owner                              |  ID | Unit       | Status |
| ------------------- | --------------------------------------------- | --: | ---------- | ------ |
| `greek-petrobolos`  | `serial-projectile-area-minimum-range`; siege |  85 | Petrobolos | Ready  |
| `egyptian-catapult` | `serial-projectile-area-minimum-range`; siege | 132 | Catapult   | Ready  |

These packs establish projectile minimum-range retreat, building-priority siege acquisition,
animation-duration DPS scaling, and stable multi-model stone presentation. Classic's splash proto
is visual-only for these units, so neither attack invents an area-damage radius. Catapult also owns
the original Egyptian Siege Works producer required by its canonical training assignment.

## Fan-out rule

Assign one ready lane per contributor using [UNIT_PACK_TEMPLATE.md](UNIT_PACK_TEMPLATE.md). A lane
that discovers a missing shared capability stops and reports it to the integration owner; it does not
edit shared runtime files or add a unit-specific escape hatch.
