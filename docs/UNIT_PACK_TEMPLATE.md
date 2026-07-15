# Gate A unit-pack template

Each parallel task owns one lane from [GATE_A_MELEE_MANIFEST.md](GATE_A_MELEE_MANIFEST.md). The
machine manifest has already chosen identity, producer relationships, command slots, and god gates.
The family-neutral task state and filesystem ownership contract live in
`packages/sim/src/content/unit-roster.ts`.

Create and inspect an open lane through the workcell command:

```sh
bun run unit:lane brief <lane>
bun run unit:lane create <lane> --base <integration-base>
```

The second command refuses blocked and already implemented lanes. It creates an isolated
`.worktrees/<lane>` checkout on `unit/<lane>`; contributors do not work in the integration checkout.

## Files owned by the lane

```text
packages/sim/src/content/unit-types/<culture>/<unit>.ts
packages/sim/src/content/unit-types/<culture>/<unit>.test.ts
packages/engine/src/content/unit-media/<culture>/<unit>.ts
packages/engine/src/assets/units/<culture>/<unit>/...
```

The sim test is required. It pins the Extended Edition / The Titans base-unit contract: identity,
cost, build time, population, hit points, speed, line of sight, armor, direct-hit melee damage and
cooldown, bonuses, age/god/prerequisites, and producer/slot relationships. Add focused behavior tests
there when the pack's data has a meaningful predicate such as a counter bonus.

The media definition owns the icon, model assets, attachments, idle/walk/attack/death actions, and
selection/acknowledgement/attack audio. Every action and attachment must reference a model declared
inside the same media pack. The generator compiles those authored keys to numeric runtime indexes.

## Files the lane does not own

Do not edit the stable-ID catalog, canonical unit roster, schema, generator, generated catalogs, production
or combat runtime, snapshots, renderer/audio/UI systems, architecture documents, or shared catalog
tests. Integration-owned reference specs are also read-only: a lane never changes the expected facts
that validate its implementation. Do not add compatibility aliases, unit-ID switches, behavior
callbacks, or a hand-maintained producer menu.

If faithful implementation needs one of those changes, report the exact missing mechanic and stop the
lane. The integration owner handles that capability as a serial foundation change.

## Validation

From the repository root, run:

```sh
bun run validate:unit-packs
bun test packages/sim/src/content/unit-types/<culture>/<unit>.test.ts
bun test packages/sim/src/content/unit-catalog.test.ts
bun test packages/engine/src/content/unit-media-catalog.test.ts
bun run unit:lane validate <lane> --base <integration-base>
```

`validate:unit-packs` discovers and validates the combined authored pack in memory and leaves the
worktree unchanged. It rejects duplicate IDs/keys/slots, manifest drift, invalid relationships,
missing media/actions/audio, cross-pack model references, and unsupported Gate A combat shapes.

Do not commit generated catalog changes from a parallel lane. After merging all authored packs, the
integration owner runs `bun run generate:unit-catalogs`, reviews the single generated diff, runs
`bun run check:unit-catalogs`, package typechecks, and the full sim/engine/web suites.

The lane validator inspects committed, staged, unstaged, deleted, and untracked paths. A shared file,
another unit pack, or a generated catalog causes the handoff to fail even when the code itself passes.
