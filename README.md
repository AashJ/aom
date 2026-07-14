# AoM Online

An experimental browser RTS inspired by *Age of Mythology*. It explores using AI models to recreate the behavior and feel of legacy software through iterative implementation.

## Built with

TypeScript, Bun, React, TanStack Router, Tailwind CSS, WebGPU, Hono, WebSockets, and Turborepo.

## Architecture

- `apps/web` — React shell and HUD
- `apps/server` — Bun/Hono multiplayer server
- `packages/engine` — custom WebGPU renderer, input, and game loop
- `packages/sim` — deterministic 20 Hz simulation
- `packages/relay` — lockstep networking and desync detection
- `packages/ui` — shared UI components

The simulation is isolated from rendering and I/O. The engine consumes simulation snapshots, while the relay distributes ordered player commands so every client advances the same world state.

## Run

```sh
bun install
bun run dev
```
