# AoM Online

A recreation of *Age of Mythology* in the browser. It is an experiment in using AI models to recreate the behavior and feel of legacy software through iterative implementation.

## Architecture

- `apps/web` — browser shell and HUD
- `apps/server` — Cloudflare Worker multiplayer relay with one Durable Object per room
- `packages/engine` — renderer, input, and game loop
- `packages/sim` — deterministic 20 Hz simulation
- `packages/relay` — lockstep networking and desync detection
- `packages/ui` — shared UI components

The simulation is isolated from rendering and I/O. The engine consumes simulation snapshots, while the relay distributes ordered player commands so every client advances the same world state.

## Maps

Single-player and multiplayer currently expose two deterministic random maps:

- **Aegean Coast** — the default land map.
- **River Nile** — desert banks separated by a meandering, animated Nile. Player starts, gold, 10-bush far berry patches, and deep-water perch schools follow the Classic random-map profile currently supported by the simulation.

Map generation lives in `packages/sim/src/maps.ts`, so a seed and map id produce the same terrain, water mask, and start locations for every lockstep client. The engine renders water as a separate fog-aware WebGPU pass and uses the same water mask for the minimap, picking surface, and movement-domain navigation.

River Nile's map and water foundation is playable, and its perch schools are populated with their original model and 1,000-food stock. The complete Classic naval loop is not yet available: docks, fishing ships, transport ships, and their gather/transport contracts still need to be implemented, so fish cannot be harvested yet. Land units cannot cross the river or gather fish.

## Run

```sh
bun install
bun run dev
```
