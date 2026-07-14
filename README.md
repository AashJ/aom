# AoM Online

A recreation of *Age of Mythology* in the browser. It is an experiment in using AI models to recreate the behavior and feel of legacy software through iterative implementation.

## Architecture

- `apps/web` — browser shell and HUD
- `apps/server` — multiplayer room server
- `packages/engine` — renderer, input, and game loop
- `packages/sim` — deterministic 20 Hz simulation
- `packages/relay` — lockstep networking and desync detection
- `packages/ui` — shared UI components

The simulation is isolated from rendering and I/O. The engine consumes simulation snapshots, while the relay distributes ordered player commands so every client advances the same world state.

## Run

```sh
bun install
bun run dev
```
