# AoM Online — Architecture

An Age of Mythology–style RTS for the browser. Guiding constraints, in priority order:

1. **Extremely performant.** 60fps minimum on a mid-tier laptop, with headroom for thousands of units later. Performance is a feature we design for, not tune in afterward.
2. **Build sequentially.** Every milestone is a small, playable, verifiable increment. No speculative systems — but boundaries that would be brutal to retrofit (determinism, sim/render split) are designed in from day one.

**Milestone 1 (complete):** frontend only. A 3D terrain map you can pan, zoom, and edge-scroll around, with dummy units, marquee selection, a minimap, and a perf HUD. No gameplay, no networking, no backend.

**Milestone 3 (complete):** gameplay sim — commands and movement. Built **before** M2 (meshes/animation) on purpose: movement needs no art, exercises the deterministic-sim investment, and finally binds right-click. M2's meshes then land on units that already behave. See its section below.

**Milestone 4 (feature-complete; two-machine exit run pending):** lockstep netcode — two browsers, one deterministic world. The command queue, tick stamping, and `hashWorld` were built as this milestone's seams; M4 added transport and pacing around them. The sim itself changed zero lines of gameplay logic. See its section below.

**Milestone 5 (feature-complete; networked exit run pending):** players & combat — the first game. Ownership, command validation, damage, death, and a winner. Chosen over the old "fog + economy" sketch because both of those _require_ ownership and entity lifecycle, and combat is the smallest increment that makes the sandbox a playable 1v1. See its section below.

**Milestone 6 (complete):** economy & buildings — the full loop. Gather → stockpile → build → train → fight. The design bet held: nearly everything reuses M5 machinery (resource nodes are entities, gathering and construction are the strike seam with different effects, the unit-type table becomes the content spine). See its section below.

**Milestone 7 (current focus):** fog of war — deterministic visibility becomes gameplay state, while WebGPU owns only presentation. Unexplored terrain is black, explored terrain remains dim, and current vision gates enemies, neutral resources, picking, commands, acquisition, and the minimap. See its section below.

---

## Decisions

| Decision    | Choice                                              | Rationale                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perspective | **True 3D** (heightmap terrain, fixed-angle camera) | Authentic AoM feel; camera rotation and real terrain become possible later. Costs more per milestone than 2D isometric — accepted trade-off.                                                                                                                                                                                                                                                                           |
| Renderer    | **Custom, WebGPU only**                             | Full control over every draw call and byte on the GPU; no library overhead between us and the hardware. WebGPU (not WebGL2) for explicit pipelines, cheap draw submission, and compute shaders later (culling, fog of war, skinning). No WebGL2 fallback — a dual-backend RHI would roughly double renderer effort. Supported: Chrome/Edge, Safari 26+, recent Firefox. Unsupported browsers get a clear error screen. |
| Camera      | **Fixed pitch/yaw, pan + zoom**                     | Classic RTS camera. Simpler culling, picking, and minimap math. Yaw rotation can be added later without structural rework (nothing may assume axis-aligned view).                                                                                                                                                                                                                                                      |
| Simulation  | **Deterministic lockstep-ready from day 1**         | "Online" means lockstep multiplayer eventually: identical inputs must produce identical state on every client. Retrofitting determinism into a float-soup sim is a rewrite; designing for it now costs almost nothing in M1.                                                                                                                                                                                           |
| UI shell    | **React for chrome only**                           | React renders menus, HUD, routes. It never participates in the frame loop and never re-renders per frame. The game is one canvas owned by imperative code.                                                                                                                                                                                                                                                             |

Rejected alternatives, for the record: 2D isometric sprites (cheapest path to performance, but not AoM), PixiJS/Three.js (faster start, less control), Canvas 2D (can't hit the perf bar), WebGPU+WebGL2 dual backend (too much surface area for a sequential build).

---

## The three layers

```
┌────────────────────────────────────────────────────────┐
│ apps/web — React shell                                 │
│ routes, menus, HUD chrome, mounts the canvas once      │
└───────────────▲────────────────────────────────────────┘
                │ imperative handle (start/stop/resize), low-Hz stats
┌───────────────┴────────────────────────────────────────┐
│ @aom/engine — WebGPU renderer + input + camera + loop  │
│ owns the canvas, runs rAF, interpolates & draws        │
└───────────────▲────────────────────────────────────────┘
                │ reads RenderSnapshots (one-way)
┌───────────────┴────────────────────────────────────────┐
│ @aom/sim — deterministic simulation                    │
│ fixed 20 Hz tick, ECS/SoA state, no DOM, no GPU, no IO │
└────────────────────────────────────────────────────────┘
```

**The load-bearing rule:** `@aom/sim` imports nothing from `@aom/engine` or the DOM. The engine reads sim output only through `RenderSnapshot`s. The shell talks to the engine only through a small imperative handle. Violations of this boundary are bugs even when they work.

### Monorepo layout (new packages in bold)

```
apps/web              React shell — routes, HUD components, canvas mount
packages/
  engine/             @aom/engine  ← new
  sim/                @aom/sim     ← new
  ui/                 @aom/ui      (existing shadcn components — menus/HUD)
  env/, config/       (existing)
```

Both new packages extend `@aom/config/tsconfig.base.json` like the existing ones. WGSL shaders live next to their pipelines and are imported as strings via Vite `?raw`.

```
packages/engine/src/
  gpu/        device init, canvas configuration, buffer/texture helpers, pipeline cache
  render/     frame loop, passes: terrain, units, overlay(minimap+marquee), culling
  camera/     RTS camera, ground-plane math, frustum
  input/      pointer + keyboard → intents (pan, zoom, select)
  math/       f32 vec3/mat4 (column-major), AABB, plane, frustum — render-side only
  shaders/    *.wgsl

packages/sim/src/
  math/       deterministic math (see rules below), seeded PRNG (PCG32)
  ecs/        World: SoA typed-array component stores, entity ids, queries
  snapshot/   writes RenderSnapshot from sim state
  world/      tick(), M1 components: Position, Selectable
```

---

## Simulation design (lockstep-ready)

### Fixed timestep

- Sim ticks at a fixed **20 Hz** (50 ms), decoupled from rendering. The frame loop runs an accumulator: consume input → run zero or more `sim.tick()`s → render with interpolation factor `alpha = accumulator / TICK_MS`.
- The renderer interpolates entity transforms between the previous and current tick snapshots. Sim never knows the frame rate exists.
- Spiral-of-death guard: cap ticks per frame (e.g. 5); beyond that, slow the game clock rather than freeze the tab.

### Determinism rules

ECMAScript specifies exact IEEE 754 semantics for `+ - * /`, `Math.sqrt`, `Math.fround`, and comparisons — those are bit-identical across engines and platforms. Everything else transcendental is implementation-defined. So inside `@aom/sim`:

- **Allowed:** `+ - * /`, `Math.sqrt`, `Math.fround`, `Math.abs/min/max/floor/ceil/trunc/sign`, integer ops, comparisons.
- **Banned:** `Math.sin/cos/tan/atan2/pow/exp/log/random`, `Date.now`, iteration over objects/Maps/Sets where order isn't guaranteed by insertion, any read of wall-clock time or DOM state.
- Trig, when gameplay needs it, comes from our own table/polynomial implementations in `sim/math`.
- All randomness comes from a seeded **PCG32** PRNG owned by the World.
- Entity iteration order is fixed (dense index order), so results don't depend on hash ordering.
- Escape hatch: if cross-engine float drift is ever observed in practice, `sim/math` is the single place to swap in Q16.16 fixed-point. Nothing outside `sim/math` does raw arithmetic on gameplay quantities that would make that swap painful.

### ECS: structure-of-arrays

Component data lives in preallocated typed arrays indexed by entity id — cache-friendly linear iteration, zero per-tick allocation, and trivially hashable for future desync detection:

```ts
// M1 components — deliberately minimal
positionX: Float64Array; // sim-space, deterministic math only
positionZ: Float64Array;
selectableFlags: Uint8Array;
```

No archetype machinery, no events, no reactive queries in M1. Grow it when a milestone demands it. (`bitecs` is the reference point if we ever want to adopt instead of build.)

### RenderSnapshot

The only sim→engine channel. A pair of preallocated buffers (previous tick / current tick), swapped each tick — no allocation, no copying entity objects:

```ts
interface RenderSnapshot {
  tick: number;
  count: number;
  posX: Float32Array; // f64 sim state narrowed to f32 at the boundary
  posZ: Float32Array;
  selected: Uint8Array;
}
```

Future lockstep slots in _around_ this design, not through it: a command queue feeds `tick()`, state hashes compare across clients. Not built in M1 — just not precluded.

---

## Rendering design

### Frame structure

One `requestAnimationFrame` loop in `@aom/engine`, one command encoder per frame, passes in order:

1. **Terrain pass** — depth-tested, one draw per visible chunk.
2. **Unit pass** — one instanced draw for all visible units.
3. **Overlay pass** — minimap (textured quad + viewport polygon + unit dots), selection rings/tints, drawn in the same canvas. No second WebGPU context.

The selection **marquee rectangle** itself is a DOM element positioned by the input layer — it's 2D screen-space chrome, and DOM is free here.

Zero-allocation discipline in the hot path: scratch vectors/matrices are module-level and reused; per-frame GPU data goes through persistent staging `ArrayBuffer`s + `queue.writeBuffer`. No object literals, closures, or array spreads inside the frame loop. GC pauses are frame drops.

### Terrain

- Heightmap grid: M1 map is **256×256 tiles**, world XZ plane, +Y up. Heights generated procedurally at load (seeded value noise — render-side only in M1, so determinism rules don't apply yet; it moves into sim when gameplay reads terrain).
- Split into **32×32-tile chunks** (8×8 = 64 chunks). Each chunk is one vertex/index buffer pair (33×33 verts), one draw call.
- **Culling:** per-chunk AABB vs. camera frustum on the CPU. 64 AABB tests per frame is nothing; GPU compute culling is a later optimization once entity counts justify it.
- M1 look: no textures. Vertex color from height + slope, plus a subtle shader-drawn tile grid so camera motion reads clearly. Texture splatting is a later milestone.

### Units (dummy, M1)

- **1,000 units** at seeded-random positions as instanced colored boxes: one pipeline, one draw call, per-instance data = `{posX, posZ, selectedFlag}` (Y sampled from terrain height on the render side).
- Instance buffer rewritten each frame from the interpolated snapshot — at 1k units that's ~12 KB/frame, negligible.
- Selected units render with a tint plus a ground ring (same instanced draw, flag-driven in the shader).

### Camera

- Perspective projection (vertical FOV ~45°). Fixed **pitch −55°**, fixed **yaw 45°** (classic RTS diagonal) — both are config constants, and no code may assume an axis-aligned view direction, so unlocking rotation later is a feature, not a refactor.
- Camera state is just `target: vec3` (a point on the ground plane) + `distance` (dolly along the fixed view direction). Pan moves `target` in the ground plane; zoom changes `distance`, clamped (e.g. 12–80 world units).
- **Zoom-to-cursor:** intersect the cursor ray with the ground plane before and after the distance change; shift `target` so the ground point under the cursor stays put.
- `target` clamped to map bounds. Pan/zoom apply light exponential smoothing on the render side (sim-irrelevant, so smoothing is allowed to be non-deterministic).

### Input mapping (M1)

| Input                             | Action                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| Mouse at screen edge              | Edge-scroll pan                                            |
| WASD / arrows                     | Pan                                                        |
| Middle-drag (or right-drag in M1) | Grab-pan the map                                           |
| Wheel                             | Zoom to cursor                                             |
| Left click                        | Select unit under cursor (ray vs. per-unit AABB)           |
| Left drag                         | Marquee select (project unit centers to screen, rect test) |

Input handlers translate raw DOM events into _intents_ consumed once per frame — no game logic in event callbacks. Right-click is left unbound on purpose; it becomes the command button when gameplay arrives.

### Picking

M1 is pure CPU: unproject cursor → ray vs. ground plane for terrain, ray vs. AABB over the 1k units for clicks, screen-space rect test for the marquee. GPU id-buffer picking is the known upgrade path when unit counts and mesh complexity grow.

### Minimap

- Top-down colorized height texture (256×256) generated **once** at load.
- Drawn in the overlay pass: quad in a screen corner, camera frustum footprint (frustum ∩ ground plane → quadrilateral outline), unit dots as instanced points.
- Click/drag on the minimap region maps UV → world XZ and jumps `camera.target`.

### Perf HUD

A plain DOM element (not React state — no re-render churn) updated ~4 Hz:

- FPS + CPU frame time (avg / p99 over a rolling window)
- GPU frame time via `timestamp-query` when the adapter supports it
- Draw calls, instances drawn, visible chunk count
- `performance.memory.usedJSHeapSize` where available (Chrome)

This ships in M1 _early_ (step 4 below) so every subsequent step is measured as it lands.

### Device & lifecycle

- `navigator.gpu` missing or `requestAdapter()` null → React error screen naming supported browsers. No fallback renderer.
- Handle `device.lost` (log + full reinit), canvas resize via `ResizeObserver` at `devicePixelRatio` (recreate depth texture and reconfigure the context on change).
- The engine exposes a small handle to React: `createGame(canvas) → { start(), stop(), dispose(), onStats(cb) }`. The `/game` route mounts the canvas in a `useEffect` exactly once; StrictMode double-mount is handled by `dispose()` being idempotent.

---

## Performance budgets (M1 acceptance bar)

Measured on a mid-tier laptop (integrated GPU), 1080p:

| Metric                        | Budget                                                                  |
| ----------------------------- | ----------------------------------------------------------------------- |
| Frame time                    | ≤ 8 ms CPU+GPU typical, 60fps minimum sustained while panning + zooming |
| Draw calls / frame            | < 100 (expected: ~64 chunk + 1 unit + ~4 overlay)                       |
| Per-frame allocations in loop | 0 (verify: no sawtooth in the heap graph while idle-panning)            |
| Sim tick (1k entities)        | < 0.5 ms                                                                |
| Cold load to first frame      | < 2 s                                                                   |

---

## Milestone 1 — sequential build order

Each step lands independently, runs via `bun dev` (port 3001), and is verifiable in the browser before the next begins.

1. **WebGPU bootstrap.** `@aom/engine` package; device init, canvas config, resize, clear-color frame loop with the fixed-timestep accumulator (sim tick is a no-op stub). `/game` route mounts it. _Verify: clear color at 60fps, resize works, unsupported-browser error screen._
2. **Camera + ground plane.** Math module, RTS camera, a flat grid-shaded plane. Pan (edge/keys/drag) and zoom-to-cursor. _Verify: cursor-anchored zoom, clamped pan._
3. **Terrain.** Heightmap generation, chunked meshes, per-chunk frustum culling, height/slope coloring. _Verify: hills render, visible-chunk count drops when zoomed in._
4. **Perf HUD.** Timing, draw-call and chunk counters, timestamp queries. _Verify against the budget table; keep it on screen for all later steps._
5. **Sim skeleton + dummy units.** `@aom/sim` package: ECS stores, PCG32, tick loop, snapshot double-buffer; 1k instanced units rendered with interpolation (give units a slow deterministic drift so interpolation is visibly exercised). _Verify: smooth motion at 20 Hz tick / 144 Hz display; sim tick under budget._
6. **Picking + marquee.** Ray picking, DOM marquee rect, screen-space rect select, selection rendering. _Verify: click and drag-select at full frame rate._
7. **Minimap.** Height texture, overlay pass, frustum footprint, unit dots, click-to-jump. _Verify: footprint matches the main view; jump is instant._

**Exit criteria:** all budgets met with 256×256 terrain + 1,000 units while continuously panning, zooming, and marquee-selecting.

---

## Milestone 3 — gameplay sim: commands & movement

Scope: right-click move orders for selected units, pathfinding around unwalkable terrain, groups that arrive without stacking on a point. No combat, no economy, no buildings, no networking — but every design below is a seam M4's lockstep plugs into rather than a thing it replaces.

### Decisions

| Decision      | Choice                                                                | Rationale                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command flow  | **All gameplay mutations enter through a tick-stamped command queue** | The lockstep seam. Commands are plain serializable data (numbers/arrays only — that IS the future wire format), stamped for a tick, applied at that tick's start. Single-player is a loopback queue; M4 swaps the transport, not the design. The engine never mutates gameplay state directly again. |
| Pathfinding   | **Flow fields over a 256×256 walkability grid**                       | Group moves are the RTS common case: one field serves every unit ordered to the same target, so cost is per-_command_, not per-unit. Per-unit A\* scales with selection size — wrong shape for marquee-select-and-move. Fields are cached by goal cell.                                              |
| Walkability   | **Slope threshold on a sim-owned heightmap**                          | Gameplay now reads terrain, so heightmap generation moves into `@aom/sim` (closes the parked "terrain ownership" question — the existing generator already uses only determinism-legal ops). Steep = unwalkable. The engine receives heights once at init; rendering is unchanged.                   |
| Movement      | **Flow-field seek + arrival + soft separation; no hard collision**    | Steering needs only `+ - * / sqrt` — no trig, so no sim/math table work yet. Separation via a spatial hash keeps groups from collapsing to a point; true collision resolution is deferred until combat makes it matter.                                                                              |
| Unit identity | **Commands address units by entity index**                            | Indices are stable while nothing dies. Generational ids arrive with combat (M-later); designing them now is speculative.                                                                                                                                                                             |
| Selection     | **Stays in World for now, excluded from state hashing**               | Selection is per-client UI state, not shared sim state — in lockstep it must never enter the hash or the command stream's effects. Excluding it from `hashWorld` now documents that boundary without a disruptive move.                                                                              |

### Command queue

- `Command` = flat numeric data: `{ tick, type, ...payload }`. M3 types: `Move { unitIds[], targetX, targetZ }`, `Stop { unitIds[] }`.
- The engine issues commands for `currentTick + 1` via `enqueueCommand(world, cmd)` (engine→sim imports are the legal direction). The queue applies everything stamped for tick T at the start of `tick(T)`, in issue order (multiplayer adds a player-id tiebreak later — noted, not built).
- Determinism test shape this enables: two worlds, same seed, same scripted command list → identical state hashes forever. This becomes the core regression test of the whole milestone.

### Movement pipeline (inside each tick, fixed order, zero allocation)

1. Apply this tick's commands → units get a goal (a shared reference to that target's flow field).
2. Flow-field lookup at the unit's cell → desired direction (fields store unit direction pairs, no angles).
3. Separation: query the spatial hash for neighbors within ~1 unit, accumulate a soft push (fixed iteration order).
4. Integrate: blend desired + separation, clamp speed (single speed constant in M3), arrive-and-stop within a radius of the goal; clamp to walkable.

### Flow fields

- Integration field: Dijkstra outward from the goal cell over the walkability grid — integer costs (10 straight / 14 diagonal, `Uint32`), Dial's bucket queue instead of a binary heap (edge costs are small integers, so buckets beat log-n; measured ~5× faster). Directions are recorded at relaxation time (the relax that sets a cell's final cost is its optimal predecessor) as normalized `(dx, dz)` `Float32Array` pairs from an 8-entry table — no separate derivation pass. Diagonals require both adjacent orthogonals walkable (no corner cutting).
- Built on command application, cached keyed by goal cell, small LRU (a handful of fields — groups share). Build budget below; if a 256×256 build can't hit it, the fallback is a coarser field grid (128×128) — noted, only if measured over budget.

### State hashing (M4 prep at ~zero M3 cost)

- `hashWorld(world): number` — FNV-style fold over the gameplay arrays (positions, velocities, move targets, tick), reading `Float64Array` bits exactly; **excludes** selection (per-client). Cheap, and it upgrades every determinism test from "sampled fields look equal" to "entire state is bit-identical".

### Engine-side changes (deliberately small)

- **Right-click binds at last**: press-release under the 4 px threshold = move command at the `screenToGround` point (dropped on ground misses); a longer right-drag stays grab-pan; middle-drag unchanged.
- A brief move-marker at the ordered point (render-side chrome — non-deterministic freedom applies).
- Perf HUD gains a `tick` line (ms per sim tick) — also closes the one budget M1's HUD never displayed.
- `RenderSnapshot` is **unchanged** in M3. Facing/orientation joins the snapshot with M2's meshes.

### Performance budgets (adds to the M1 table)

| Metric                                                            | Budget                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Sim tick, 1k units moving (field lookup + separation + integrate) | < 0.5 ms (the M1 budget holds)                                       |
| Flow-field build, 256×256                                         | < 2 ms, on command application (an occasional spike, never per tick) |
| Command → visible response                                        | ≤ 1 tick (50 ms) + interpolation                                     |

### Milestone 3 — sequential build order

1. **Command queue + straight-line seek.** Queue, Move/Stop commands, right-click binding, seek-and-arrive with no obstacles. _Verify: units walk to the click and stop; scripted-command determinism test (two worlds, equal `hashWorld` every tick)._
2. **Terrain into sim + walkability.** Generator moves to `@aom/sim` (engine consumes the same heights via init handoff — pixels identical), slope-threshold walkability grid, debug overlay toggle to visualize it. _Verify: same seed renders the same map; unwalkable cells tint in the overlay._
3. **Flow fields.** Build + cache + per-unit lookup replaces straight-line seek. _Verify: a group ordered across a cliff routes around it; repeat command hits the field cache; build time under budget._
4. **Separation.** Spatial hash + soft push. _Verify: a 200-unit marquee move arrives as a blob, not a point; tick stays under 0.5 ms._
5. **Feedback polish.** Move marker, HUD tick line, Stop hotkey. _Verify: full loop feels like an RTS._

**Exit criteria:** 1k units, mixed group move orders across obstructed terrain, all budgets met, and the scripted-command determinism test green in CI (`bun test`).

### M3 open questions (parked, on purpose)

- Formations / group cohesion beyond separation (arrival spread is enough for M3).
- Hard collision vs. soft separation only — revisit with combat.
- ~~Lockstep input-delay scheme (fixed delay vs. rollback)~~ — answered in M4: fixed delay, rollback rejected.
- ~~When selection moves out of World~~ — answered in M4: it stays, guarded by the never-branch-on-selected invariant.

---

## Milestone 4 — lockstep netcode

Scope: two or more browsers playing the same match — shared seed, shared command stream, bit-identical worlds, desync detection. No matchmaking service, no reconnect/late-join, no spectators, no cheat hardening. The guiding fact: **only inputs cross the wire.** A move order for 500 units costs the same ~60 bytes as for 5; the per-player bandwidth is measured in KB/s regardless of army size. That economy is why every sim decision since M1 (determinism rules, PCG32, tick-stamped commands, `hashWorld`) was shaped the way it was.

### Decisions

| Decision       | Choice                                                        | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topology       | **WebSocket relay server, not P2P**                           | Browsers have no raw UDP; the real choice is WebSocket vs. WebRTC DataChannel. WebRTC buys unordered delivery at the cost of STUN/TURN and NAT pain — but lockstep _wants_ ordered-reliable, and command traffic is tiny, so TCP head-of-line blocking is tolerable. The relay is also the natural authoritative command orderer. Parked: WebRTC as a later latency optimization.                                                                                                                                                                                                              |
| Pacing scheme  | **Fixed input delay + server-paced turns; rollback rejected** | Commands execute at `issueTick + INPUT_DELAY_TICKS` (start: 4 ticks = 200 ms — genre-native "acknowledgement" feel). Rollback (fighting-game style) requires resimulating many ticks of 1k-unit state per correction — the wrong trade at RTS scale. The relay batches commands into numbered **turns** and broadcasts them on its own 20 Hz clock; a client may simulate tick T only after receiving turn T (possibly empty).                                                                                                                                                                 |
| Relay brain    | **`packages/relay` (`@aom/relay`) — transport-free**          | The protocol types and the turn sequencer are consumed by BOTH ends (the engine's net layer and the server), so they must live in a package, not an app. `@aom/relay` holds: message types, the turn sequencer (commands in → player-id + arrival-order tiebreak → turn batches out), and the room/lobby state model as plain data. It imports `Command` from `@aom/sim` and nothing environmental — no sockets, no Bun APIs, no DB. It is to networking what `@aom/sim` is to gameplay: pure logic, drivable in-process.                                                                      |
| Server shell   | **`apps/server` — Bun.serve + Hono + native WS pub/sub**      | The thin deployable that a package can't be: `Bun.serve` owns the port, native Bun WebSockets own the room broadcast (`ws.subscribe(room)` / `server.publish(room, msg)` — the relay's core primitive, built into the runtime), and Hono owns the HTTP routes. Hono earns its place because the server's HTTP surface is _known_ to grow (saves, accounts, lobby lists) — those live here, behind Hono, never in the package. Invariant: the relay module path imports nothing stateful; DB code and `@aom/relay` never meet in the same import graph except at the server's composition root. |
| Wire format    | **JSON per message in M4; binary parked**                     | Command rates are human-click rates; JSON costs nothing measurable and keeps every message readable in devtools during the milestone where debugging matters most. The protocol is versioned from message one (`v` field) so binary can arrive without a flag day.                                                                                                                                                                                                                                                                                                                             |
| Sim networking | **None. The sim gains zero IO**                               | All transport lives in `@aom/engine` (`src/net/`) behind a `CommandSink` interface: single-player = loopback sink (enqueue locally at `tick + delay`), multiplayer = relay sink (send up, enqueue what comes back). The load-bearing three-layer rule survives M4 untouched.                                                                                                                                                                                                                                                                                                                   |
| Selection      | **Stays in World, with a new invariant**                      | Per-client selection arrays now genuinely diverge between clients. That is safe iff no sim code ever _branches_ on `selected` — selection influences gameplay only by choosing which unitIds go into a command at issue time, on the issuing client. Recorded as an invariant; the full move-out-of-World is deferred until it earns its disruption.                                                                                                                                                                                                                                           |

### New workspaces

```
packages/
  relay/              @aom/relay ← new: protocol types, turn sequencer, room model (pure)
apps/
  server/             ← new: Bun.serve + Hono HTTP + WS pub/sub + (later) DB; imports @aom/relay
```

Dependency directions: `@aom/relay` → `@aom/sim` (Command types only); `@aom/engine` → `@aom/relay` (client side); `apps/server` → `@aom/relay` (server side). The engine and the server never import each other; they meet only on the wire.

### Protocol (client ⇄ server, shapes defined in `@aom/relay`)

- `join { room, name }` → `joined { playerId, players[] }` (room = shareable code; first joiner is host).
- `start { }` (host) → `begin { seed, players[], hashIntervalTicks }` — everyone constructs `createWorld(seed)` and spawns identically; the lobby is the only place state is agreed on.
- `commands { commands: WireCommand[] }` up — **tickless**: wire commands carry no execution time; the sequencer buckets them into the next open turn, and turn N executes at tick N (no client-chosen timing is ever trusted). `turn { turn, commands: PlayerCommand[] }` down — broadcast every 50 ms even when empty (an empty turn is the "you may advance" token). The fixed input delay of step 1's loopback sink is the single-player emulation of this pipeline's natural latency.
- `hash { tick, value }` up at the agreed interval; `desync { tick, players[] }` down when reports disagree.
- Commands gain `playerId` (stamped server-side, not trusted from the client). Within a turn, application order is (playerId, arrival order) — deterministic on every client because the sequencer's output IS the order.

### Tick gating (engine frame loop)

- The accumulator keeps producing "tick debt" from real time, but a tick may only run if its turn has arrived. Debt with no turn → **pause the game clock** (waiting-for-player UI after ~250 ms) rather than freeze the tab; a burst of late turns fast-forwards capped at the existing 5-ticks-per-frame spiral guard.
- Background-tab reality: browsers throttle `requestAnimationFrame` to ~0 in hidden tabs, which would stall every opponent. When `document.hidden`, a `setInterval` fallback keeps consuming turns and ticking the sim (no rendering) so an alt-tabbed player doesn't pause the match.

### Desync handling (M4 = detect, not recover)

- Every `hashIntervalTicks` (default 20 = once/sec), clients report `hashWorld`. The relay compares all reports for a tick; any mismatch → `desync` broadcast → clients freeze the sim and show a banner. Recovery/resync is parked — in M4 a desync is a bug to _fix_, not an event to survive, and the per-tick hash in CI is the tool that keeps it theoretical.
- Dev mode: on desync, clients dump their full gameplay arrays to console/download for diffing — finding _which array_ diverged is 90% of the debugging.

### Testing without a network

- Because the sequencer is a pure package, the "fake relay" in tests is the REAL sequencer — two Worlds + one `@aom/relay` sequencer instance in one process, commands issued from "both players" at staggered turns, hashes compared every tick. Same test teeth as today, now exercising playerId ordering, input delay, and turn batching — with zero sockets to mock. This test is the milestone's spine, exactly as the scripted-command test was M3's, and it lands BEFORE the server exists.

### Performance budgets (adds to the tables above)

| Metric                                     | Budget                                              |
| ------------------------------------------ | --------------------------------------------------- |
| Bandwidth per client, steady play          | < 10 KB/s (typical: < 2)                            |
| Added order latency (input delay)          | 4 ticks = 200 ms, tunable per match                 |
| Waiting-for-player pauses on LAN/same-city | effectively none (turn RTT ≪ 50 ms turn period)     |
| Relay CPU per match                        | negligible — it routes strings and compares numbers |

### Milestone 4 — sequential build order

1. **CommandSink seam + real input delay, single-player.** Extract the sink interface in the engine; loopback sink schedules at `tick + 4`. _Verify: game feels identical (the marker/acknowledgement absorbs the delay); determinism test passes with delay on._
2. **Relay brain.** `packages/relay`: protocol message types, turn sequencer, room model — pure, no sockets. The two-player fake-relay determinism test lands here, before any server exists. _Verify: `bun test` — sequencer ordering, input delay, and turn batching all pinned in-process._
3. **Server shell + lobby.** `apps/server`: Bun.serve + Hono (health route only for now) + native WS pub/sub wiring the sequencer; join/start/begin + seed handshake. _Verify: two scripted WS clients join a room, receive identical seeds, see a consecutive turn stream, and a submitted command echoes back playerId-stamped (browser tabs join in step 4, which builds the client)._
4. **Turn pipeline.** Engine relay sink + turn broadcasting + tick gating + background-tab fallback. _Verify: right-click in tab A moves units in tab B; kill the server mid-match → both clients pause gracefully._
5. **Hash exchange + desync banner + dev dump.** _Verify: artificially corrupt one client (dev hotkey pokes a position) → desync detected within one hash interval, banner on both, dumps diff to the corrupted array._
6. **Feel + failure polish.** Waiting-UI, ping display on the HUD, clean disconnect handling. _Verify: a 2-player match survives a laptop lid-close-and-reopen on one side (as a pause, not a crash)._

**Exit criteria:** a 2-player match across two machines on real (non-localhost) networking: 1k units each issuing group moves, hash-verified every second for a 10-minute session with zero desyncs, bandwidth under budget, and the fake-relay determinism test green in CI. Lid-close survival means a **brief** suspend on ONE side (the relay and opponent stay up; TCP outlives short sleeps) — long suspends disconnect by design while reconnection stays parked, and the tested behavior there is a clean disconnect message, not a crash or a silent stale lobby.

### M4 open questions (parked, on purpose)

- Hosting/deploy for `apps/server` (and TURN, if WebRTC ever happens) — a milestone-of-ops, not code. If per-room coordination ever wants to be globally distributed, Cloudflare Durable Objects fit the relay's shape — and `@aom/relay` being transport-free is what would make that port cheap.
- Which database, when saves/accounts arrive — an `apps/server` concern by construction; nothing in M4 blocks on it.
- Reconnect and late-join (requires full-state serialization — the SoA layout makes this nearly free when we want it).
- Binary wire format; delta-compressed turns.
- Lockstep's honest weakness: every client holds full world state, so fog-of-war cheating is possible by construction. Server-validated visibility is a different architecture; accepted for now, revisit if the game ever matters competitively.
- Sim-thread migration (Web Worker) if tick cost ever contends with rendering — the sim's zero-DOM discipline makes it worker-portable by construction.

---

## Milestone 5 — players & combat: the first game

Scope: units belong to players; you command only your own; right-click an enemy orders an attack; units deal damage, die, and are removed; last player standing wins. No economy, no buildings, no fog, no ranged units, no meshes. After M5, two people can _play_ — a skirmish with the armies they start with. Orderings considered and rejected: economy-first (deep three-subsystem build with nothing to spend armies on) and fog-first (a compute-shader showpiece with no stakes); both also hard-require the ownership + entity-lifecycle work below, so combat-first builds the foundation _and_ ships a game.

### Decisions

| Decision                  | Choice                                                                | Rationale                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership                 | **`owner: Uint8Array` component; the SIM validates commands**         | A command affecting units the issuing player doesn't own is dropped — deterministically, by every client, inside command application (the relay stays dumb; `playerId` on the turn broadcast is already the trusted identity). This is the first real command validation, and it happens in exactly one place.                                                          |
| Entity identity           | **Generational ids — M3's deferred debt comes due**                   | Death breaks raw-index stability. Each slot gains a `generation: Uint16Array` counter, bumped on reuse; commands and snapshots carry packed ids (`index \| generation << 16`). A stale id (unit died during the input-delay window — an unavoidable race) resolves to a silent, deterministic no-op: ordering a corpse around is not an error and MUST not be a desync. |
| Death & storage           | **Swap-remove keeps the SoA dense**                                   | Dense iteration stays allocation-free and hash-cheap. The last unit moves into the freed slot; generations make dangling references detectable. Deaths are collected during the tick and applied at tick END in descending index order (fixed order — determinism; descending so swaps never disturb a pending removal).                                                |
| Snapshot ids              | **`RenderSnapshot` gains `ids` (+ `owner`, `hp`)**                    | Swap-remove breaks prev/curr index alignment, which interpolation silently assumed. The renderer interpolates a slot only when prev and curr ids match; on mismatch it snaps (the swapped unit pops for one frame — imperceptible, and honest). This is the M5 change most likely to bite silently, hence tested first.                                                 |
| Combat model              | **Auto-acquire + chase + cooldown melee; no projectiles**             | Nearest enemy within aggro radius (spatial hash reused; ties break by id — determinism), chase via direct seek with a leash, instant damage on a tick-counted cooldown. Projectiles/ballistics/ranged are a later milestone; attack-move and stances are parked.                                                                                                        |
| Win condition             | **Annihilation, detected in-sim, part of the hash**                   | `world.winner` set when one owner's army count reaches zero — shared truth, hashed like everything else. The UI learns about it from the snapshot, never computes it.                                                                                                                                                                                                   |
| Player identity on screen | **Owner-indexed palette: sprite tint, minimap dots, selection rings** | Instance data gains `owner`; a small palette constant colors sprites (tint/multiply over the villager sprite — exact recolor technique decided at implementation), minimap dots, and ring colors. Selecting enemy units is allowed (inspection is free); commanding them is what validation drops.                                                                      |

### Sim additions

- Components: `owner: Uint8Array`, `hp: Uint16Array` (integer damage — no float drift questions in combat math), `attackCooldown: Uint16Array` (ticks), `generation: Uint16Array`, plus `COMBAT_*` constants (aggro radius, attack range, damage, cooldown ticks, leash distance).
- New command: `Attack { unitIds[], targetId }` (packed ids). Move/Stop gain id validation + ownership validation.
- Tick pipeline gains a combat phase between commands and movement: acquire (idle units scan for nearest enemy in aggro range) → chase (seek toward target position while outside attack range, leashed) → strike (in range, cooldown elapsed: subtract hp, reset cooldown) → deaths collected → applied at tick end (swap-remove, descending).
- `spawnUnits` splits the army between players at opposite map corners.

### Engine/web changes

- Right-click on an _enemy_ unit issues Attack (pick already finds the unit; owner check routes move-vs-attack). Attack feedback marker in red.
- Units renderer: owner tint + hp bar (small quad above damaged units — same instanced draw, flag-driven like the ring). Minimap dots by owner color.
- Win/loss overlay (React, reads snapshot `winner`), with the match freezing exactly like a desync freeze — the game is simply over.

### Performance budgets (adds)

| Metric                                             | Budget                                       |
| -------------------------------------------------- | -------------------------------------------- |
| Sim tick, 1k units in active combat                | < 0.5 ms (the standing budget holds)         |
| Determinism suite with a full scripted 500v500 war | green in CI, identical winner on both worlds |

### Milestone 5 — sequential build order

1. **Entity lifecycle.** Generational ids, swap-remove death (driven by a test-only kill helper), snapshot `ids`/`owner`/`hp`, renderer snap-on-id-mismatch. _Verify: determinism suite with scripted deaths; no interpolation smear when units die._
2. **Ownership + validation + colors.** Per-player spawns at opposite corners, sim-side command validation, sprite tint + minimap dot colors. _Verify: two tabs — each can select everything but command only their own; a forged command for enemy units is a no-op on both clients._
3. **Combat.** Attack command, auto-acquire, chase + leash, cooldown damage, deaths for real. _Verify: scripted 500v500 battle is hash-identical with the same winner on two worlds; tick under budget mid-battle._
4. **Game feel.** HP bars, attack markers, win/loss overlay, kill-command polish. _Verify: a full 1v1 skirmish over the network ends with a winner banner on both screens and zero desyncs._

**Exit criteria:** two players on two machines fight a 500v500 skirmish to annihilation — deterministic (hash-silent throughout), within tick budget during the biggest engagement, with a correct winner banner on both screens.

### M5 open questions (parked, on purpose)

- Ranged units are a COMMITTED requirement (archers etc.), not a maybe — M5's combat therefore keeps stats in a per-unit-type table from day one and separates "decide to hit" from "apply damage" so projectiles can slot into that seam. Deterministic projectile flight (travel time, dodgeable arrows) remains its own design pass in a later milestone.
- Attack-move, stances, formations — command vocabulary beyond point-and-click.
- Unit types and counters (one unit type in M5; the component layout should not assume it stays that way).
- Whether target acquisition should respect fog once fog exists (it must — noted for the fog milestone).
- Reconnection (carried from M4, unblocked by nothing here).

---

## Milestone 6 — economy & buildings: the full loop

Scope: villagers gather food and wood into per-player stockpiles; players place and villager-construct buildings; buildings train units against costs and a population cap; the economy feeds the war. No gold/favor, no farms, no market, no rally points, no fog. After M6, a match is a real RTS: boom, build, fight. The scoping bet that keeps four subsystems to one milestone: **everything is the M5 machinery wearing new clothes** — a tree is an entity that never moves; chopping it is the strike seam transferring stock instead of subtracting hp; construction is strikes that ADD progress; the `UNIT_TYPES` table built for archers is where trees, town centers, and barracks become rows.

### Decisions

| Decision          | Choice                                                                        | Rationale                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resource model    | **Table-driven; food + wood ship in M6, gold/favor parked**                   | Each resource is a row (constants), not a subsystem. Two resources already force real tradeoffs (units cost food, buildings cost wood); more rows are content, addable without code. Stockpiles are integer `Uint32Array(players × resources)` — no float questions, hashed like everything else.                                                                                          |
| Resource nodes    | **Entities, owner = NEUTRAL (255), hp = remaining stock**                     | Trees and berry bushes join the SoA as unit-type rows that never move. Free rides: picking, marquee inspection, snapshot, minimap dots, instanced rendering, deterministic map placement from the seed, and even destruction (a depleted node is a death — swap-remove already works). Chopping a tree IS attacking it: the gather verb reuses acquire/chase/strike wholesale.             |
| Gathering         | **Carry + dropoff, not a passive faucet**                                     | Villagers carry up to a capacity, walk to the nearest own dropsite, deposit, and return to their node. The walk is the point: economic geography (where your dropsites sit relative to resources) is the actual RTS decision this milestone exists to create. State machine rides existing components plus a mode byte and a remembered node id.                                           |
| Buildings         | **Entities with a tile footprint stamped into walkability**                   | Placement marks the footprint tiles unwalkable and FLUSHES the flow-field cache + in-flight unit field refs (fields are derived from walkability; a stale cache is a delayed desync). Buildings have hp — combat destroys them with zero new code. Town Center (dropsite, trains villagers, one pre-placed per player), House (+pop cap), Barracks (trains militia). Three types, no more. |
| Construction      | **Villager-built: strikes that add progress**                                 | Placement deducts cost and spawns the building at 0 progress; villagers ordered onto it convert strike ticks into build progress (the strike seam's third costume). Auto-complete timers were considered and rejected — builder allocation is a real economic decision, and the machinery is already paid for.                                                                             |
| Production        | **Single-slot timer per building in the original M6 slice**                   | This historical M6 decision was superseded by Milestone 11's fixed-capacity mixed FIFO and cancel-refund command. The current World has no parallel `trainType` cache; queue slot 0 is authoritative.                                                                                                                                                                                      |
| Population cap    | **Pop = owned units; cap = base + per-house bonus; enforced at Train**        | Computed by scan at command validation (command-rate, cheap). The classic macro rhythm — army size gated by house count — for two typed arrays and one loop.                                                                                                                                                                                                                               |
| Win condition     | **Annihilation now counts units AND buildings**                               | A player with a standing production building can fight back. Neutral entities (nodes) never count. `MATCH_DRAW` semantics unchanged.                                                                                                                                                                                                                                                       |
| Economy on screen | **Stockpiles/pop ride the snapshot; HUD via the existing 4 Hz stats channel** | The sim owns the numbers; the engine latches them into GameStats gauges; React renders a top resource bar the way the perf HUD works — zero per-frame React.                                                                                                                                                                                                                               |

### Sim additions

- `RESOURCES` table (food, wood) + `stockpiles: Uint32Array` on World (hashed). `UNIT_TYPES` grows rows: tree, berry bush, town center, house, barracks — with per-row cost, build ticks, production relationships, footprint, population bonus, and gather yield as applicable. `NEUTRAL_OWNER = 255`.
- Components in the original M6 slice included a single production timer. Milestone 11 supersedes it with `trainRemaining`, `trainQueueLength`, and fixed-stride `trainQueueTypes`; queue slot 0 is the only active type. All join death-swap copying and the hash.
- Commands: `Gather { unitIds, targetId }`, `Build { unitIds, targetId }`, `Place { typeId, tileX, tileZ }`, `Train { buildingId, unitType }`. All validated (ownership, affordability, footprint legality) in command application — one place, deterministic, as always.
- Map generation: forests (tree clusters) and berry patches placed from the seed at world creation, mirrored fairly for both spawn corners. Trees do NOT block walkability in M6 (soft separation only; forests-as-walls parked).
- Walkability edits: building placement/destruction stamps tiles and flushes the field cache — the ONLY runtime walkability mutations; both are command-driven, so every client edits identically.

### Engine/web changes

- Right-click vocabulary by cursor target: resource node → Gather; own under-construction building → Build; enemy → Attack; ground → Move. Marker hue per verb.
- Snapshot gains `unitType` (the renderer finally needs it: per-type sprites/atlas rows — trees, buildings, and units draw from the same instanced pipeline, art permitting) and `buildProgress` (scaffolding tint), plus stockpiles/pop for the HUD.
- Building placement UI: React build bar (appears when a villager or production building is selected); placement enters a ghost mode — engine renders the footprint preview tinted valid/invalid — click issues Place. First real game chrome beyond overlays.
- **Content dependency, flagged honestly:** tree/bush/TC/house/barracks sprites are needed (same atlas pipeline as the villager). Placeholder tinted quads until the art exists — the milestone does not block on it.

### Performance budgets (adds)

| Metric                                                     | Budget                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Sim tick: 1k units + ~500 nodes/buildings, economy running | < 0.5 ms (the standing budget holds)                              |
| Walkability edit (place/destroy building)                  | field-cache flush + rebuild-on-demand; spike < 2 ms, command-rate |
| Full-loop determinism suite (gather→build→train→fight)     | green in CI, identical winner                                     |

### Milestone 6 — sequential build order

1. **Resources, stockpiles, nodes.** RESOURCES table, stockpiles on World/hash/snapshot, node type rows, seeded forest/berry placement, NEUTRAL owner, resource HUD bar (placeholder node art). _Verify: identical node layout from the same seed on two worlds; stockpile visible; nodes pickable._
2. **Town Centers + building plumbing.** Building type rows, footprint stamping + field-cache flush, one TC pre-placed per player at spawn. _Verify: pathing routes around the TC; determinism with walkability edits._
3. **Gathering.** Gather command + villager state machine (chase→strike→carry→dropoff→return). _Verify: right-click a tree, stockpile climbs; the full round-trip loops unattended; determinism test with mixed gather/combat._
4. **Placement.** Place command, cost validation, ghost preview UI, build bar chrome. _Verify: affordable house placement on legal tiles only; ghost tints invalid on occupied/unwalkable/unaffordable._
5. **Construction.** Build verb: villager strikes add progress; completion activates the building (house pop bonus counts). _Verify: multiple villagers build faster; determinism._
6. **Production + pop cap.** Train command, single-slot countdown, adjacent spawn, pop enforcement, train buttons in the build bar. _Verify: TC trains villagers, barracks trains militia, cap blocks at limit, costs deduct._
7. **Loop closure + polish.** Win condition counts buildings, carry indicator, marker hues, constants balance pass. _Verify: a full networked match — boom, build an army, win by annihilation — hash-silent throughout._

**Exit criteria:** two players on two machines play a complete economic match — gather to ~30 villagers, expand with houses, train armies from barracks, fight to annihilation — hash-verified every second with zero desyncs, tick under budget with the full economy running.

### M6 open questions (parked, on purpose)

- Farms (renewable food) and the gold/favor resources — rows in existing tables when wanted.
- Production queues, rally points, cancel-refunds, repair — UX depth on the single-slot skeleton.
- Forests as movement blockers (walkability stamping exists; applying it to trees is a choice about map feel).
- Resource-carry visuals — add resource-specific props held by villagers while hauling, then replace them with full gather/carry/deposit animation sets during the broader animation pass; do not use floating UI badges.
- Garrison, gates, walls — the buildings-as-walkability system supports them structurally; each is its own design pass.
- Where the build-bar UI system goes long-term (`@aom/ui` shadcn components vs. bespoke game chrome).

---

## Milestone 7 — fog of war: scouting becomes gameplay

Scope: each player begins with only the area around their starting force revealed; moving units and completed buildings reveal a circular tile radius; explored terrain remains known but dim; enemy units, enemy buildings, and neutral resource nodes exist on screen, in picking, and on the minimap only while currently visible. No terrain-height or forest occlusion, allies/shared vision, stealth, detection, last-seen building ghosts, or server-side anti-cheat. After M7, scouting and surprise attacks are real decisions instead of role-play on a fully revealed board.

### Decisions

| Decision           | Choice                                                                                  | Rationale                                                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority          | **The deterministic sim owns visibility; GPU fog is presentation only**                 | Visibility changes command validity and combat acquisition, so a compute-only mask would let clients disagree about gameplay. Every client computes every active player's mask from the same hashed world.                                                                                                       |
| Grid/state         | **One 256×256 byte grid per active player: unseen (0), explored (1), visible (2)**      | Tile resolution matches movement, placement, and terrain lookup. The persistent explored bit is history-dependent and therefore joins `hashWorld`; a viewer's 64 KB grid is copied through the existing snapshot boundary.                                                                                       |
| Player ids         | **Dense visibility slots mapped from real server player ids**                           | Lobby churn can produce non-contiguous ids. `spawnUnits(world, count, ownerIds)` registers distinct ids into `playerSlotById`/`playerIds` instead of allocating a 256-player fog atlas.                                                                                                                          |
| Vision sources     | **Per-type circular `lineOfSight` stamped by live owned units and completed buildings** | Sight becomes content data alongside range and footprint. Neutral nodes provide none; foundations provide none until complete; M7 deliberately ignores height, forests, and buildings as occluders.                                                                                                              |
| Entity visibility  | **Unit center tile; any visible footprint tile for buildings**                          | Mobile entities remain cheap to test, while a large building becomes targetable when the player can see any part of it. Own entities remain visible by construction because they are vision sources.                                                                                                             |
| Hidden information | **No entity memory in M7**                                                              | Explored terrain persists, but enemies and resources disappear outside current vision. Last-seen silhouettes require per-viewer remembered entity snapshots and stale-state rules; that is a separate information-design pass.                                                                                   |
| Ordered pursuit    | **Explicit attacks investigate the last-seen position; auto-targets drop immediately**  | A visible `Attack` records the target position in the existing move target. If sight is lost, an ordered attacker goes there without tracking the hidden live position; it resumes if the target is revealed, otherwise clears on arrival. Auto-acquired targets return to normal acquisition as soon as hidden. |
| Presentation       | **Upload authoritative bytes once per sim tick; compute shader softens edges**          | `FogRenderer` converts the hard tile mask into a filtered GPU texture. Terrain and minimap sample it; units, dots, and picking use the snapshot's authoritative per-entity visibility rather than reading GPU state back.                                                                                        |
| Security           | **Visual/gameplay fog, not cheat hardening**                                            | Lockstep clients still hold the full world. Preventing memory inspection requires a server-authoritative visibility architecture and is explicitly outside M7.                                                                                                                                                   |

### Sim additions

- `packages/sim/src/visibility.ts`: `updateVisibility(world)` downgrades visible tiles to explored, then stamps every valid vision source; `isEntityVisibleTo(world, playerId, entityIndex)` is the single command/combat visibility test; `isFootprintVisibleTo(world, playerId, tileX, tileZ, size)` prevents placement from consulting hidden occupancy.
- `World` gains `playerIds`, `playerSlotById`, `playerCount`, and `visibility`; `UnitTypeStats` gains `lineOfSight`. Visibility updates before command application each tick so validation sees the current positions from the last completed movement step.
- `COMMAND_ATTACK` is accepted only while its target is visible to the issuer, and `COMMAND_PLACE` requires its full footprint to be currently visible. Combat acquisition ignores hidden candidates. Explicit targets that disappear use the already-hashed `moveTargetX/Z` as the last-seen position; no new pursuit component is introduced.
- `hashWorld` includes player-slot registration and the complete visibility grids because explored history affects later snapshots and commands.
- `RenderSnapshot` gains a viewer-specific `fog` grid plus `visible` per entity. `writeSnapshot(world, out, viewerId)` copies one player mask and resolves entity visibility once so every engine consumer agrees.

### Engine/render changes

- `packages/engine/src/render/fog.ts` owns the raw visibility texture, filtered texture, compute pipeline, and tick-latched upload. `packages/engine/src/shaders/fog.wgsl` performs presentation-only edge softening.
- `TerrainRenderer` samples the filtered mask: unseen is near-black, explored is desaturated/dim, visible is unchanged. Placement preview and authoritative application both require the full footprint to be currently visible, preventing hidden buildings or walkability from becoming a scouting oracle.
- `UnitsRenderer`, `pickUnit`, and `marqueeSelect` skip entities whose snapshot `visible` byte is zero. An already-selected enemy that disappears renders nothing and cannot receive a new command; its client-local selection bit may remain until the next selection replacement without leaking position.
- `MinimapRenderer` applies the same fog states to its terrain texture and emits dots only for visible entities. The camera footprint remains visible because it is local UI, not world information.
- Device loss recreates `FogRenderer` with the other GPU-owned renderers. No new WebGPU optional feature is required; compute and storage textures are core WebGPU.

### Performance budgets (adds)

| Metric                                            | Budget                                        |
| ------------------------------------------------- | --------------------------------------------- |
| Visibility update, 1k entities / 8 active players | < 1 ms typical; zero allocation               |
| Viewer fog snapshot copy                          | 64 KB/tick; < 0.05 ms                         |
| Fog upload + compute                              | < 0.2 ms GPU, only when snapshot tick changes |
| Render-loop allocations                           | 0; no GPU readback                            |

### Milestone 7 — sequential build order

1. **Visibility state.** Player-slot mapping, per-type sight, three-state grids, deterministic stamping, hashing. _Verify: two worlds reveal identical masks; explored tiles persist after a scout leaves; non-contiguous player ids map correctly._
2. **Gameplay authority.** Attack/placement validation, acquisition gating, explicit last-seen pursuit, and hidden-target release. _Verify: forged blind attacks and placements are no-ops; preview cannot probe hidden occupancy; auto-targets never see through fog; explicit orders investigate but never track hidden coordinates._
3. **Snapshot + interaction.** Viewer fog and per-entity visibility, hidden-unit filtering in click/marquee/command routing. _Verify: hidden enemies cannot be selected or commanded; own units remain controllable._
4. **World presentation.** Raw upload, compute-softened mask, terrain states, device-loss recreation. _Verify: black → explored → visible transitions have stable soft edges while moving a scout._
5. **Minimap + entity presentation.** Filter world sprites and minimap dots through the same snapshot truth. _Verify: no enemy/resource dot or sprite leaks outside current vision; camera footprint stays visible._
6. **Networked exit run.** Scout, lose/reacquire targets, destroy nodes/buildings under fog, and finish a match. _Verify: hashes remain silent, full tick stays within budget, and no visual/input surface reveals hidden live state._

**Exit criteria:** two networked players can scout, surprise, retreat into fog, investigate last-seen positions, and complete an economic match with identical hashes; terrain, sprites, picking, commands, acquisition, and minimap all agree on visibility with no hidden-position leaks.

### M7 open questions (parked, on purpose)

- Last-seen enemy building/resource silhouettes and stale destruction/depletion semantics.
- Terrain, forest, wall, or elevation-based line-of-sight occlusion.
- Allied/shared vision, spies, stealth, and detection.
- Server-authoritative visibility if competitive cheat resistance ever justifies abandoning pure lockstep knowledge.

---

## Milestone 8 — AoM progression foundation: resources and rules data

Scope: establish the shared simulation state required for an original-AoM-style Greek Archaic → Classical progression slice without implementing age advancement itself yet. The economy expands from Food/Wood to the canonical Food/Wood/Gold/Favor ledger; finite Gold Mines reuse the existing resource-node gathering loop; every player gains authoritative age and god-progression state; and content receives data-driven availability requirements so later age advancement can unlock units and buildings without command-specific conditionals.

### Decisions

| Decision           | Choice                                                                                       | Rationale                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial culture    | **One Greek vertical slice first**                                                           | Greek prayer is the simplest later Favor loop, and finishing one culture end to end exposes the real extension points before Egyptian/Norse asymmetry multiplies unfinished systems.                                     |
| Resource ledger    | **Food, Wood, Gold, Favor are fixed deterministic resource ids**                             | Costs, carrying, stockpiles, snapshots, hashes, and UI all need one stable ordering. Gold behaves like a gathered material; Favor shares the ledger but is generated by culture mechanics rather than neutral map nodes. |
| Gold               | **Finite neutral Gold Mines reuse entity HP as remaining stock**                             | Trees and berry bushes already prove the gather/deplete/swap-remove model. A `resource = GOLD` content row adds the third material without a second economy state machine.                                               |
| Player progression | **The sim owns per-player age, major god, and chosen minor gods**                            | These values determine legal production and construction, so they are hashed gameplay state. Every player begins in the Archaic Age; actual advancement and minor-god choice commands land in the next milestone slice.  |
| Availability rules | **Content data declares required age and prerequisites; one sim query answers availability** | Build menus, training UI, and authoritative command validation must agree. Centralizing the rule prevents separate UI and command conditionals from drifting as the tech tree grows.                                     |
| Snapshot boundary  | **Expose the viewing player's progression alongside the four-resource ledger**               | The engine and React UI remain snapshot consumers. They should not inspect `World` to decide which actions appear, even before the age-up UI exists.                                                                     |
| Determinism        | **New progression state and all four stockpiles join `hashWorld`**                           | Age and god choices affect future legal commands. A disagreement must be reported when state changes, not later when one client accepts production that another rejects.                                                 |

### Simulation changes

- Extend the resource ids and `RESOURCE_COUNT` to `FOOD`, `WOOD`, `GOLD`, and `FAVOR`; preserve the existing owner-major stockpile layout and carried-resource representation.
- Add a Gold Mine content type and current-map constrained starting/medium/far placements. Counts, geometric ranges, and Gold-Mine-to-Gold-Mine spacing are map content rather than universal engine rules; trees and berries require only a two-tile non-overlap gap. Placement is seeded but not mirrored, with reachability retained only to reject sealed terrain pockets. Gathering, depletion, retargeting, hauling, and deposit continue through the existing villager state machine.
- Add per-player progression state for current age, selected major god, and minor-god choices by age. Initialize players to Archaic with no minor gods chosen.
- Extend content rules with required age and prerequisite metadata. Authoritative Place/Train validation and UI availability consume the same sim-owned query; locked content remains a silent deterministic no-op if forged onto the command stream.
- Include progression state in `hashWorld`; extend `RenderSnapshot` with viewer age/god progression and the expanded stockpile copy.

### Sequential build order

1. **Four-resource ledger (complete).** Gold/Favor ids, cost columns, stockpiles, carrying, hashing, snapshots, and HUD counters now preserve the existing Food/Wood behavior while establishing the full ledger. _Verified: existing economy tests remain unchanged in meaning; non-contiguous player ids receive isolated four-resource rows; Gold changes affect the hash._
2. **Gold Mines (complete).** Seeded, map-profiled starting/medium/far mines now use the resource-node path, with profile-owned Gold Mine spacing and a separate two-tile tree/berry gap. _Verified: seed 1337 gives each player all required slots without mirrored coordinates; mine spacing and resource-node non-overlap hold; villagers mine, haul, deposit, deplete, and retarget through the existing deterministic loop._
3. **Player progression state (complete).** Active players now receive owner-id-indexed Archaic age, Greek major-god, and age-keyed minor-god state; progression joins the deterministic hash and viewing-player snapshot. _Verified: equal worlds initialize and hash identically; every progression field changes the hash; non-contiguous player ids retain independent state and viewer snapshots regardless of dense visibility slots._
4. **Availability rules (complete).** Content rows now declare required age and completed-building prerequisites; one sim-owned query gates authoritative Place/Train handling, engine previews/actions, and command-menu disabled state from viewer snapshots. _Verified: forged Archaic Barracks and Militia orders are no-ops without cost; the same orders become legal in Classical; incomplete prerequisites remain locked in viewer snapshots and completed ones unlock._

**Exit criteria:** a networked match has deterministic Food/Wood/Gold/Favor ledgers, mineable finite Gold deposits, hashed per-player Archaic/god state, and a single authoritative availability rule ready for Town Center age advancement. No age-up command, minor-god choice UI, Temple prayer, myth unit, hero, or god power is included in this slice.

### Deferred directly to the next progression slices

- Villager prayer at the Greek Temple as the first Favor-generation mechanic.
- The first Classical human unit, Greek hero, myth unit, and single-use god power.
- Infantry/cavalry/archer counters, armor and damage classes, and deterministic ranged projectiles.
- Map-seed validation/regeneration for starts whose reachable terrain component cannot satisfy a required resource band; placement currently rejects such a seed rather than spawning unreachable or out-of-profile mines.

---

## Milestone 9 — Extended Edition Classical advance

Scope: complete the first playable Archaic → Classical progression loop using Extended Edition / The Titans rules. Greeks construct a Temple, select a completed Town Center, pay 400 Food, choose one of Zeus's Classical minor gods, and research the advance for 60 seconds before Classical content unlocks.

### Decisions

| Decision           | Choice                                                                      | Rationale                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruleset            | **Extended Edition / The Titans**                                           | This is the project's progression baseline. The Classical Town Center unlock from The Titans remains in the content table.                                       |
| Research ownership | **Building-owned research order**                                           | The Town Center owns the research id, choice, and countdown; player progression stores only completed ages/gods, and one active age order is allowed per player. |
| Minor gods         | **Zeus chooses Athena or Hermes in the command**                            | The authoritative sim validates the major/minor-god pairing and commits the choice only when the research completes.                                             |
| Production         | **Research and unit training share the building production step**           | An active research order occupies the producer; queued Villagers resume on the completion tick and new train orders are rejected while it is busy.               |
| Destruction        | **Destroying the researching Town Center cancels and refunds the 400 Food** | This follows the Classic technology-queue refund behavior and prevents stale packed ids from completing research after the owning building is gone.              |

### Sequential build order

1. **Temple content (complete).** Greek Temples cost 150 Wood and 150 Gold, take 40 seconds for one Villager to construct, and satisfy the completed-building prerequisite for the Classical advance.
2. **Deterministic age research (complete).** One canonical age rule supplies producer, prerequisites, cost, duration, and major/minor-god choices to command validation and UI availability. `COMMAND_ADVANCE_AGE` starts a building-owned research order; its in-flight state is hashed and projected through the viewer snapshot.
3. **Engine and multiplayer boundary (complete).** Loopback commands receive the standard input delay; relay commands remain tickless and carry only the Town Center and minor-god ids. Protocol versioning prevents older clients from silently dropping the new command.
4. **HUD flow (complete).** Villagers can place the Temple, a selected Town Center exposes the Classical command with prerequisite rollover help, the choice panel offers Athena or Hermes, and the top-center bar follows authoritative research progress.

**Exit criteria:** both single-player and networked matches can deterministically pay for, research, display, and complete the Zeus Classical advance; Classical availability unlocks only on completion and the chosen minor god is stored in player progression.

### Deferred directly to the next progression slices

- Athena/Hermes god powers, free Classical myth-unit spawn, myth technologies, and trainable Minotaur/Centaur content.
- Extracted Greek Temple and minor-god portrait art; the current Temple presentation temporarily uses the existing Greek Barracks sprite plate.

---

## Milestone 10 — Greek Temple prayer and Favor

Scope: make Favor a playable Greek economy by tasking Villagers to completed Temples. Active worshipers across all of a player's Temples feed the original pre-Retold diminishing-return curve; Zeus retains his 20% prayer bonus and 200-Favor cap.

### Decisions

| Decision     | Choice                                                                 | Rationale                                                                                                                       |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Interaction  | **Right-click a completed owned Temple with Greek Villagers selected** | This matches Classic's normal worker-task interaction and keeps prayer out of a separate modal command flow.                    |
| Scaling      | **One global praying-Villager count per player**                       | Classic diminishing returns apply across all Temples, so additional Temples add safe prayer space rather than resetting income. |
| Determinism  | **Fixed-point fractional Favor is authoritative and hashed**           | Integer stockpiles still expose whole resources while clients agree on the exact tick the next Favor becomes spendable.         |
| Presentation | **Selected-task prayer count and snapshot-derived Favor per minute**   | The HUD reports selection status locally and the same capped production rate the sim is applying, without reimplementing it.    |

### Sequential build order

1. **Prayer task (complete).** `COMMAND_PRAY` targets a completed owned Temple; the deterministic sim filters the order to Greek Villagers and counts only worshipers who have reached the building.
2. **Classic Favor curve (complete).** Pre-Retold diminishing returns are quantized to fixed-point rates, Zeus receives +20%, fractional progress joins the hash, and income stops at the Classic 200/100 caps.
3. **Task-lifecycle coverage (next).** Pin interruption, Temple destruction, retasking, stale packed ids, and two-client convergence with focused tests.
4. **Presentation and HUD feedback (complete).** Praying Villagers use the original Greek male/female A/B prayer animations, the selected-Villager status shows prayer, and the resource panel displays the current authoritative Favor-per-minute rate.

**Exit criteria:** Greek Villagers can be assigned, interrupted, and retasked at Temples in single-player and multiplayer; both clients generate identical capped Favor on identical ticks; Temple loss clears affected worshipers; and the HUD never estimates a rate different from the sim.

### Deferred directly to the next progression slices

- Greek prayer acknowledgement audio.
- Athena/Hermes god powers, free Classical myth-unit spawn, myth technologies, and trainable Minotaur/Centaur content.

---

## Milestone 11 — Parallel unit-content foundation

**Scope:** build the shared data, production, presentation, and validation seams required for multiple contributors to add Greek and Egyptian units without editing the same authored source files. This milestone proves the workflow with two ordinary direct-hit ground melee units, then opens the complete roster subset that satisfies the same contract; it does not attempt to unlock every unit family at once.

The Milestone 9 ruleset decision remains authoritative: unit data targets the Extended Edition / The Titans balance baseline, not Retold. Unit behavior must match the original game; the parallelization seam is an ownership change, not permission to generalize away unit-specific mechanics.

### Decisions

| Question                 | Decision                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel ownership       | One unit pack owns one sim definition, one engine media definition, its unique assets, and focused behavior coverage. Unit contributors do not edit shared registries or generic systems.                                                                                                             |
| Stable identity          | Reserve explicit 16-bit numeric IDs for the complete Greek and Egyptian unit roster, their culture-specific producer buildings, and the remaining Greek/Egyptian gods before parallel work starts. IDs are append-only and never derived from file order.                                             |
| Culture-specific content | Replace generic shared identities where the games differ: Greek Villager and Egyptian Laborer are distinct unit types, and Greek/Egyptian military buildings are distinct producer types. Shared visuals or stats may be referenced, but gameplay identity is not.                                    |
| Catalog assembly         | A build-time generator discovers unit/media definition modules and emits static registries in stable numeric-ID order. Generated files are integration-owned; contributors may regenerate locally for validation but do not include generated diffs in unit packs.                                    |
| Runtime lookup           | The sim and engine use dense O(1) catalog lookup by stable ID. Authored model keys are validated and compiled once to numeric model/action/attachment indexes; no filesystem discovery, dynamic imports, string-key maps, or catalog allocation occurs in tick/render hot paths.                      |
| Relationship ownership   | A trainable unit declares `trainedAt` relationships and command slots; a constructible building declares `builtBy` relationships and command slots. Generated reverse indexes preserve `{ type, commandSlot }`, including god-exclusive alternatives that intentionally share a cell.                 |
| Production               | Producers use a fixed-capacity, mixed-type FIFO. Queue slot 0 is the sole authoritative active type; `trainRemaining` belongs to it. `COMMAND_CANCEL_TRAIN` removes by queue index, compacts deterministically, and refunds that entry's full declared cost.                                          |
| Gate A combat            | A row declares exactly one primary `attack` or `null`; Gate A accepts only `kind: "melee"`. The contract owns direct-hit damage classes, armor, range/cooldown, and class/culture bonus predicates; parallel optional attack fields, arrays of ignored variants, and speculative kinds are forbidden. |
| Presentation             | The engine owns per-unit models/actions/icon/audio. Deaths cross the sim boundary as explicit per-tick snapshot events with identity and transform; renderer/audio consumers never infer gameplay outcomes from a missing live entity.                                                                |
| Exceptional mechanics    | Do not add a generic behavior/plugin hook in anticipation of heroes, myth units, siege, ships, or flying units. Each family opens only after one faithful vertical slice establishes its actual deterministic state and ownership seam.                                                               |
| Merge ownership          | An integration owner regenerates catalogs once after combining unit packs, resolves ID/catalog validation failures, and runs the full deterministic and presentation suites.                                                                                                                          |

### Unit-pack contract

A Gate A melee unit pack has an intentionally narrow authored surface:

```
packages/sim/src/content/unit-types/<culture>/<unit>.ts
packages/engine/src/content/unit-media/<culture>/<unit>.ts
packages/engine/src/assets/units/<culture>/<unit>/...
packages/sim/src/content/unit-types/<culture>/<unit>.test.ts  # required pinned-ruleset contract
```

The sim definition declares the stable type ID, display key, culture, unit classes, costs, build time, population cost, movement and vision values, age/god/prerequisite requirements, `trainedAt` relationships with command slots, one discriminated `attack` (or `null`), armor, and counter bonuses. A constructible building owns its corresponding `builtBy` relationships and slots. Definitions contain no renderer, DOM, audio, or asset imports.

The engine media definition declares the icon/portrait, GLB model and scale, idle/walk/attack/death animation clips, selection presentation, and acknowledgement/selection/attack audio pools. It contains no gameplay numbers and cannot alter command legality or combat results.

A unit pack is complete when its exact pinned-ruleset data is represented, it trains from the correct producer through the generic command path, it renders and animates through the media catalog, and its authored files can be merged without changing another unit pack or a shared hand-maintained table. Passing the Gate A eligibility contract is a prerequisite; proximity-based attack range alone does not make an exceptional unit a Gate A unit.

### Serial foundation — simulation

1. **Freeze stable IDs.** Add an explicit unit/building ID catalog covering the Greek and Egyptian roster planned after M11. Widen type storage in world components, commands/codecs, production queues, snapshots, and hashes to 16 bits before assigning IDs. Extend the god ID catalog for all Greek and Egyptian major/minor gods. Generators fail on duplicate IDs, missing media for implemented units, and accidental renumbering.
2. **Split culture identities.** Migrate the current generic Villager and Barracks identities to Greek Villager / Egyptian Laborer and culture-specific producer buildings. Existing entities, commands, snapshots, and tests move directly to the new IDs; no compatibility alias remains in the runtime.
3. **Expand `UnitTypeStats`.** Add stable key, label, culture, classes, movement speed, population cost, armor, one nullable discriminated `attack`, required god, and authored `trainedAt` / `builtBy` relationships with command slots. Gate A attacks use `kind: "melee"`; resource nodes and buildings remain in the same immutable type catalog with `attack: null`.
4. **Generate reverse indexes.** Compile authored relationships into ordered `TRAIN_OPTIONS_BY_PRODUCER` and `BUILD_OPTIONS_BY_WORKER` catalogs that preserve both type and command slot. Validation rejects illegal slot collisions, culture-incompatible relationships, missing endpoints, and a trainable/buildable type with no legal source.
5. **Make core mechanics type-driven.** Replace `UNIT_SPEED`, worker-type equality checks, one-pop-per-entity counting, flat damage, and the single `trains` field with catalog-driven values/classes and generated relationship indexes. Gather/build/repair/pray eligibility is class-based but remains sim-authoritative.
6. **Generalize production.** Replace the producer's count-only/single-type queue assumption with a fixed-capacity FIFO of 16-bit unit type IDs. Slot 0 is canonical; no duplicated active-type component exists. `COMMAND_TRAIN` and `COMMAND_CANCEL_TRAIN` carry the requested type/index; enqueue, cancellation/refund, completion, resource debit, and population reservation use that entry's definition.
7. **Complete deterministic state handling.** Add queue contents and any new gameplay component fields to construction, death-swap copying, snapshots, serialization, and `hashWorld`. Two identical worlds receiving the same mixed queue and combat commands must hash identically every tick.
8. **Keep availability authoritative.** Extend the existing sim availability query to evaluate culture, age, god, producer, and prerequisite buildings. Commands and UI consume the same result; the client never reconstructs unlock rules.

The serial proof producers are the Greek Military Academy and Egyptian Barracks. Each building declares the correct worker relationship and command slot, while its generated train menu is initially empty. Greek Villagers and Egyptian Laborers receive the derived build options, and both buildings are complete production entities before unit lanes begin. Adding Hoplite and Spearman later populates those producers through the unit-owned relationships without editing either building.

### Serial foundation — engine and UI

1. **Generate media registries.** Add a deterministic generator that emits static imports for sim definitions and engine media definitions, sorted by numeric ID. A check mode fails when generated output is stale; no generator runs inside the game loop.
2. **Replace central type switches.** `model-presentation`, icon lookup, selection geometry, and unit audio resolve through `UnitMediaDefinition`. Shared renderer/audio primitives remain central; per-unit choices move into the unit's media file.
3. **Render generic actions.** The generator compiles authored model/action/attachment keys to numeric indexes. The renderer selects idle, walk, attack, and death clips from those runtime definitions using authoritative snapshot state/timing. Death animations and audio start from explicit death events, not snapshot disappearance.
4. **Make command panels list-driven.** Selection summaries expose the selected worker's legal build types and producer's legal train types plus ordered queue entries. The command panel maps those lists into stable grid cells and issues the existing generic build/train commands.
5. **Keep media failure visible.** Missing required media is a catalog validation error for an implemented unit. Development-only geometric fallback remains available for diagnosis, but it is not accepted by M11 exit criteria for the proof units.

### Generator and merge contract

- Source discovery accepts only definition modules under the two unit-pack roots above, excludes tests, and emits deterministic output independent of filesystem enumeration order.
- Sim and media entries must agree on type ID and content key; every implemented non-resource unit has exactly one of each.
- Generated registries are checked in so a clean checkout remains buildable. Unit contributors may regenerate them locally to run broad checks, then exclude those generated diffs from their commits.
- The integration owner combines all authored packs, runs the generator once, reviews the complete generated diff, and owns that single catalog commit.
- `bun run validate:unit-packs` loads and validates authored packs without writing generated files. Integration CI runs the checked-in generator in check mode and fails on catalog drift, duplicate IDs/keys/slots, manifest drift, missing definitions/media, invalid relationships, cross-pack model references, unsupported Gate A combat shapes, or references to unimplemented prerequisite content.

### Parallel work opened by M11

After the serial foundation lands, two independent proof lanes run in separate worktrees:

| Lane     | Unit     | Required proof                                                                                                                                                            |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greek    | Hoplite  | Exact pinned-ruleset cost/stats/classes, trained from the Greek Military Academy, correct population/queue behavior, direct-hit melee combat, model/actions/icon/audio.   |
| Egyptian | Spearman | Exact pinned-ruleset cost/stats/classes, trained from the Egyptian Barracks, correct population/queue behavior, direct-hit melee combat and bonuses, model/actions/audio. |

Neither lane may edit a shared authored source file. Any missing shared capability discovered by a lane is reported back to the integration owner and lands as a reviewed serial foundation change before the lane consumes it. Unit packs do not smuggle shared mechanics into their definition or media files.

Once both proof lanes integrate cleanly, every Greek or Egyptian unit that passes the Gate A eligibility contract may be assigned one unit per contributor under the same contract.

### Gate A eligibility contract

A unit is eligible for the first parallel melee wave only when all of the following are true:

- It uses ordinary ground navigation, occupancy, separation, targeting, and pursuit.
- Every gameplay attack is a direct-hit melee attack resolved through the shared attack, armor, damage-class, and counter-bonus data. It has no projectile, area/splash damage, charge, throw, delayed impact, or special attack.
- Its complete gameplay variation is expressible through common immutable data: cost, build time, population, speed, hit points, line of sight, armor, one direct-hit `attack` with `kind: "melee"`, damage classes, bonuses, age/god/prerequisites, producer relationships, and command slots.
- It enters play through the normal deterministic production queue. It has no free-age-up spawn, transformation, temporary lifetime, death-spawn, or other exceptional creation/removal rule.
- It has no hero uniqueness/revival/regeneration rule, myth-unit favor/lifecycle rule, active ability, passive aura, healing/empowerment behavior, siege-only behavior, or formation-sensitive mechanic.
- Its presentation uses the shared selection plus idle, walk, attack, and death action contract without unit-specific renderer or audio control flow.

Infantry, cavalry, or elephants may enter Gate A when they pass every condition; the visual body or movement speed does not decide eligibility. Workers are part of the serial foundation because gather/build/repair/pray behavior is already shared infrastructure, not a parallel combat-unit pack. A melee-range unit that fails even one condition is assigned to the gate for its missing mechanic rather than receiving a simplified Gate A implementation.

Before fan-out, the integration owner audits the non-hero, non-myth Greek and Egyptian melee candidates and publishes fixed machine-readable roster entries containing each unit's stable ID, culture, producer, command slot, owner lane, status, and exact blocker when closed. Hero and myth families are categorically Gate C and do not receive individual Gate A lanes. The sole source of truth is `packages/sim/src/content/unit-roster.ts`; [the task-facing Gate A view](docs/GATE_A_MELEE_MANIFEST.md) and [unit-pack template](docs/UNIT_PACK_TEMPLATE.md) are derived instructions. Parallel work begins only from that roster.

### Family gates

| Gate | Unit families                                                                                        | Required substrate before parallel packs open                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | Ordinary direct-hit ground melee units that pass the eligibility contract                            | M11 foundation, roster audit, and Hoplite/Spearman proof complete.                                                                              |
| B    | Archers, ranged heroes, ranged myth units, and projectile siege                                      | Deterministic projectile entities, launch/impact timing, misses, area damage, animation timing, snapshot/hash coverage, and one vertical slice. |
| C    | Heroes and myth units                                                                                | Faithful hero limits/revival, myth-vs-hero bonuses, favor costs, special attacks, lifecycle state, and one representative vertical slice.       |
| D    | Non-projectile siege, formation-sensitive counters, or units with charged/special deterministic acts | The exact mechanic exists in the sim with command, snapshot, hash, presentation, and focused determinism coverage.                              |
| E    | Ships, transports, amphibious units, and flying units                                                | Water/air navigation, occupancy, embark/disembark or flight targeting rules, visibility, and renderer/camera support.                           |

The first unit that needs a new deterministic mechanic is a serial feature slice, not a parallel content pack. Subsequent units may parallelize only after that mechanic's contract is explicit and proven.

### Performance and determinism budgets

- Catalog lookup is a direct indexed read with no per-tick object creation.
- Production queues use fixed-capacity typed storage; queue operations do not allocate in `World.step()`.
- Unit classes, armor, damage classes, and bonuses compile to numeric masks/dense arrays used directly by combat.
- Registry generation and validation are build-time work only.
- The existing 20 Hz tick budget remains green at the Milestone 1 benchmark scale after the two proof units and mixed queues are active.
- Two-world determinism tests cover mixed-type training, cancellation/completion, per-type movement, population reservation, bonuses/armor, deaths, and queue compaction.

### Build order

1. Reserve 16-bit IDs, widen type-ID storage/codecs, and add catalog/code-generation checks.
2. Split culture-specific workers/buildings and migrate snapshots/tests.
3. Land the expanded sim schema and type-driven movement, population, eligibility, armor, and direct-hit damage.
4. Land mixed-type production queues plus availability, snapshot, hash, and UI queue support.
5. Land the engine media schema, generated registry, generic presentation/audio consumers, and list-driven command panels.
6. Freeze the unit-pack template, Gate A eligibility contract, and validation commands.
7. Audit the Greek/Egyptian melee roster and publish the fixed Gate A assignment/exclusion manifest.
8. Implement Hoplite and Spearman in parallel worktrees without shared authored-file edits.
9. Integrate once, regenerate catalogs, run the complete suite, audit the merged diff for ownership violations, and release the remaining Gate A manifest entries for parallel implementation.

### Exit criteria

- Stable 16-bit Greek/Egyptian unit and building IDs plus Greek/Egyptian god IDs are reserved and protected against renumbering.
- Greek Villager/Egyptian Laborer and their culture-specific proof producers replace the old generic identities end to end.
- Mixed-type queues, per-type movement/population/combat, culture/god availability, snapshots, death copying, and `hashWorld` are deterministic and covered.
- Model presentation, icons, action clips, selection geometry, and audio contain no Hoplite/Spearman type switch or central hand-added entry.
- Hoplite and Spearman are authored in disjoint unit packs, train through the real UI, fight with their exact ordinary-unit rules, and render with production media.
- Integrating both proof lanes requires only adding their authored files/assets and one integration-owned registry generation; their `trainedAt` relationships populate the existing producers without either lane modifying a shared authored source file.
- Every non-hero, non-myth Greek/Egyptian melee candidate has a reviewed Gate A eligibility result; each exclusion names the exact missing mechanic and later gate rather than accepting a simplified implementation. Hero and myth families remain categorically Gate C.
- Every eligible entry has a stable ID, producer/slot assignment, and isolated unit-pack task brief ready to hand to a parallel contributor.
- Catalog validation, sim tests, engine/web tests, typecheck, formatting, and two-world determinism checks pass.
- The 20 Hz simulation budget remains green at the established benchmark scale.

### Explicitly deferred

Projectile simulation; hero limits/revival; myth-unit favor/lifecycle rules; special attacks; area/splash damage; charged, thrown, or delayed-impact actions; temporary or exceptional spawn/death rules; technology upgrades; formation bonuses; siege-specific behavior; naval, transport, amphibious, and flying movement; garrisoning; and any melee-range unit whose correct behavior depends on those systems.

---

## Milestone 12 — Agentic roster workcells and fidelity foundation

**Scope:** turn the M11 unit-pack seam into a repeatable agent workcell. This milestone does not unlock a new gameplay family. It makes unit eligibility, ownership, provenance, isolation, and handoff machine-checkable so later family foundations can open parallel waves without relying on prompt discipline or a shared Git worktree.

### Decisions

| Question               | Decision                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task source            | `UNIT_ROSTER` is the sole family-neutral task queue. Every lane has a stable identity, family/gate, status, exact blocker, foundation owner, frozen assignment when open, and derived owned paths. References join by the same stable key; no second manifest or status model exists. A blocked lane cannot be launched.                    |
| Implementation state   | `blocked`, `ready`, and `implemented` are distinct. Shared substrate and assignment audits move a lane to `ready`; only integration moves it to `implemented`. A checked-in definition does not silently redefine roster state.                                                                                                             |
| Filesystem isolation   | One ready lane runs in one Git worktree on one `unit/<lane>` branch. Agents never share the integration checkout, index, or `HEAD`. Worktrees live under the ignored `.worktrees/` root by default.                                                                                                                                         |
| Ownership enforcement  | Validation computes committed, staged, unstaged, deleted, type-changed, and untracked paths with NUL-safe Git output relative to the integration base. Every changed path must match the lane's exact file or directory ownership declaration, and ownership declarations cannot overlap across lanes.                                      |
| Fidelity authority     | Reference specs are integration-owned inputs, outside every unit lane. A discriminated family contract pins every runtime-significant field. References join to roster identity and assignment by stable key, and unit contributors cannot edit the expected facts that judge them.                                                         |
| Raw proprietary inputs | Extracted game archives remain ignored under `private-assets/`. Tracked references contain normalized facts, hashes, structured Trial-to-final deltas, and a final-ruleset review commit—not proprietary archives. Local verification derives every Trial-comparable gameplay field and rejects missing, unnecessary, or inaccurate deltas. |
| Family validation      | Catalog integrity remains generic. Each gameplay family adds its own eligibility/reference validator only after a serial vertical slice establishes the real contract. There is no universal behavior callback or agent-authored plugin seam.                                                                                               |
| Integration ownership  | Agents hand back one lane commit. Integration cherry-picks accepted commits, updates roster state, regenerates catalogs once, and runs the broad suite. Automated integration is deferred until the isolated handoff is proven.                                                                                                             |

### Tracked workcell artifacts

- `packages/sim/src/content/unit-roster.ts` — family-neutral task state and owned-path declarations.
- `packages/sim/src/content/unit-references/` — integration-owned normalized fidelity specs.
- `scripts/unit-lane.ts` — lane listing, self-contained briefs, worktree creation, and ownership/focused validation.
- `scripts/lib/xmb.ts` plus `scripts/verify-unit-sources.ts` — local verification of hashed Trial proto and asset-inventory provenance.

The first infrastructure slice registered every existing Gate A assignment plus the ordinary Greek/Egyptian projectile candidates. C0 now expands the same canonical roster across every reserved hero, myth, siege, trade, naval, and exceptional-lifecycle identity before those family foundations open. Blocked entries may record source-derived producer relationships, but only the family audit and candidate-reference transition freezes them for fan-out.

### Workcell lifecycle

1. Integration lands the family substrate, completes the roster audit, freezes producer/slot/god assignments, and creates the reference spec.
2. Integration changes a lane from `blocked` to `ready`.
3. `bun run unit:lane create <lane> --base <integration-base>` creates `.worktrees/<lane>` on `unit/<lane>` and emits the lane brief.
4. The contributor edits only the declared pack files/assets. A missing shared capability stops the lane.
5. `bun run unit:lane validate <lane> --base <integration-base>` requires the expected isolated branch, a nonempty complete authored pack, a sim definition, media definition, focused test, asset changes, and a matching reference; it then rejects ownership violations and runs the focused sim/catalog/media tests.
6. The contributor returns one commit. Integration reviews and cherry-picks it, changes the lane to `implemented`, regenerates catalogs, and runs the full suite.

### Exit criteria

- Every registered lane has unique identity and ownership; every blocked lane names its exact shared blocker.
- No ready lane lacks a frozen producer assignment or integration-owned reference spec.
- Worktree creation refuses blocked or already implemented lanes.
- Ownership validation catches shared schemas, manifests, generated catalogs, other unit packs, deletions, and untracked files outside the lane.
- Every implemented Gate A pack matches a separately owned final-ruleset reference.
- Local provenance verification resolves the pinned Trial proto unit and root animation against the expected source hashes.
- Unit-pack validation, catalogs, focused workcell tests, type checks, lint, formatting, and the complete deterministic/presentation suites remain green.

---

## Milestone 13 — Deterministic projectile foundation and ranged workcells

**Scope:** establish the shared Gate B substrate for ordinary Greek and Egyptian projectile units, prove it with one serial ranged vertical slice, then open only the ranged lanes whose complete Classic behavior fits that contract. This milestone does not make ranged heroes, myth units, or projectile siege ordinary content packs merely because they share a projectile model.

### Decisions

| Question               | Decision                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary attack shape   | `UnitTypeStats.attack` is exactly one discriminated `melee` or `projectile` attack, or `null`. Damage classes, armor, bonuses, range, aggro, and cooldown remain shared. Projectile-only timing and flight data exist only on `kind: "projectile"`; parallel nullable attack fields and renderer-derived delivery behavior are forbidden.                                                              |
| Projectile ownership   | `World.projectiles` is a dedicated fixed-capacity authoritative SoA, not a selectable unit and not a renderer particle. Every entry has a monotonically assigned ID, source/target stable IDs, owner/source type, queued release tick, fixed launch/impact positions, impact tick, and expiry state. Derived spatial/render state is not duplicated.                                                   |
| Attack timing          | Starting the attack cycle sets the unit cooldown and queues a release. The release tick comes from authored animation timing. At release, the projectile captures the target's current point; flight duration is `ceil(distance / speed * TICK_HZ)` and is capped by the authored lifespan. New releases cannot advance during the tick that queued them.                                              |
| Accuracy and dodging   | B2 uses the hashed 2002 Classic Trial proto/executable as the working projectile authority so ranged implementation can proceed without an unavailable EE install. Accuracy, aim accumulation, square miss spread, one-time release tracking, unintended damage, and body filtering follow that evidence. Extended Edition 2.8 becomes a later compatibility audit rather than a lane-opening blocker. |
| Collision families     | The first substrate supports intended-target point impact and deterministic expiry. Unintentional path collisions, their damage multiplier, obstruction rules, area/splash damage, minimum-range retreat/alternate attacks, and siege collision are explicit later serial slices. No lane needing one of them becomes `ready` early.                                                                   |
| Snapshot and hash      | Queued and in-flight lifecycle state, including `nextId`, is folded into `hashWorld`. Snapshots expose only released projectiles with stable ID, projectile type, interpolable position/facing/progress, owner, and visibility. The engine never reads `World`, reconstructs an impact, or infers a projectile from an attack animation.                                                               |
| Presentation identity  | A stable projectile type crosses the snapshot boundary. Shared projectile media owns arrow, spear/javelin, sling-stone, and later siege visuals; unit media owns the attack animation and its release timing. Source unit IDs and gameplay attack data do not become renderer switches.                                                                                                                |
| Parallel workcell gate | A ranged lane stays `blocked` until the serial vertical slice proves every behavior it needs, its producer/slot and independently owned candidate reference are frozen, its projectile type/media exists, and focused validation rejects omitted projectile fields. Definition presence alone never opens a lane. The candidate becomes a commit-pinned final reference only after integration review. |

### Foundation slices

1. **B1 — authoritative point projectiles.** Migrate the primary attack contract to the discriminated union; add queued release, fixed flight/impact, intended-target collision, moving-target dodge, lifespan expiry, snapshot projection, catalog validation, complete hashing, and focused two-world tests. No content lane opens on B1 alone.
2. **B2 — Classic accuracy and collision fidelity.** Mirror the authored `CollidesWithProjectiles` body policy, reuse the deterministic unit grid, and prove swept contact. Implement the hashed Classic hit score, aim accumulation, square miss sampling, release-time lead, deterministic earliest unintended path hit, unintentional damage multiplier, and current ownership filtering without an all-units quadratic scan. Record EE 2.8 comparison as a later compatibility audit.
3. **B3 — projectile presentation.** Add stable projectile media definitions and models, render snapshot projectiles with interpolation and launch/arc/impact presentation, bind release timing to the authored attack action, and cover device recreation/model-registry validation. The shared presentation substrate is implemented; B5 supplies the first authored unit animation/release proof.
4. **B4 — area and minimum-range contracts.** Establish separately discriminated impact-area and minimum-range behaviors with focused determinism coverage before any siege or other lane needing them can open. Ordinary projectile packs do not carry ignored area fields.
5. **B5 — serial Toxotes vertical slice.** Implement the correct Greek Archery Range producer plus Toxotes end to end through production, commands, fog, combat, snapshot, renderer, audio, and final-ruleset reference verification. Keep it integration-owned until the family seam survives review.
6. **B6 — ranged roster release.** Audit all five ordinary Greek/Egyptian projectile candidates against the proven contract, freeze producer/slot/projectile assignments and references, mark only eligible lanes `ready`, and generate isolated lane briefs. The four post-Toxotes lanes passed this audit, were implemented in isolated worktrees, and are now integrated through final references pinned to their reviewed commits; a unit with an unproven mechanic remains blocked with that exact mechanic named.

### B2 fidelity evidence boundary

- **Working ruleset authority:** the local Classic Trial proto (`464520f1ea00b36e1872bf5a59831408c819c205e56f055c7b2e8bdf53719da2`) and extracted Trial executable (`5975176380f29104c66e49fa7dc73d2a24221612190de630258f8523f7825366`). Unit references must cite the exact proto row; engine behavior must stay covered by focused tests. EE 2.8 evidence, when available, is a compatibility audit and may trigger a coordinated foundation/reference revision, but does not block Classic lanes now.
- **Pinned ordinary values:** Toxotes, Peltast, Slinger, and Chariot Archer author `Accuracy 0.8`, `AccuracyReductionFactor 1.5`, `AimBonus 15`, `SpreadFactor 0.25`, `MaxSpread 5`, `TrackRating 5`, and `UnintentionalDamageMultiplier 0.3`. The Trial `Crossbowman` row uses `Accuracy 0.6` with the other six values unchanged. The hashed Greek inventory maps the shipped `Gastraphetes` roster name to `crossbowman_anim.txt`, while the Trial proto retains the internal `Crossbowman` identity; that explicit delta closes the identity seam without renaming the public content key.
- **Pinned engine shape:** hit score is `accuracy * 100 - distance * accuracyReductionFactor + priorShots * aimBonus`; only scores in `(0, 100]` consume an inclusive integer roll. Misses sample X and Z independently from a square whose half-width is `min(distance * SpreadFactor, MaxSpread) * (100 - clamp(priorShots * AimBonus, 0, 100)) / 100`. A target moving below `TrackRating` is led once at release by direct travel time; faster targets retain the captured point. The earliest swept solid body wins, stable ID breaks equal-contact ties, an unintended body receives the authored multiplier, and same-owner bodies are ignored.
- **Implemented B2 contract:** projectile solidity is explicit per unit type; resource nodes are not solid merely because they have a body radius; accuracy uses the shared hashed PCG stream; and aim history plus queued prior-shot count are authoritative hashed state. One canonical attack-cycle transition derives source, owner, target, prior-shot, release, and cooldown state from live units—callers cannot forge queue metadata or partially advance aim. Swept contact uses the shared deterministic grid visitor with reusable query scratch, and its catalog radius bound is computed once outside the tick loop; continuous contact cannot tunnel between ticks.
- **Deferred compatibility boundary:** alliances do not exist in the current simulation, so B2 proves same-owner pass-through and enemy/neutral authored-body obstruction. Diplomacy must extend that relationship predicate before teams or alliances ship. EE 2.8 values and behavior remain an explicit later audit, not silent assumptions in unit packs.

### B3 presentation boundary

- **Shared media registry:** arrow, javelin, and sling-stone identities compile into the same generated named-model registry as unit media. Arrow (`80c8760e899405cbfcf7b7b0a60c0474c6e19cd45073269d78fbb84c3fd07daf`) and javelin (`7b4bacc9dcdeff9cd84dc0538be4f69a1ae0ef5b03b899b7931409bd9363f6ea`) are converted Classic attachment models. The Classic `Sling Stone` proto has no animation/model reference; its explicit shared media entry uses a small neutral pebble mesh rather than pretending the equipped sling is the projectile.
- **Canonical renderer path:** visible released projectiles are batched through the existing model GPU pipeline. Stable snapshot IDs gate interpolation across dense swap-removal; position, facing, owner, and progress come only from the snapshot. A render-only parabola adds height without changing collision or hashes, and per-model axis metadata normalizes the original attachment orientations.
- **Lifecycle timing:** no model exists before the sim exposes a released projectile, and the model disappears on the authoritative impact/expiry boundary. Unit attack animation remains driven by the same authoritative cooldown that queues the release; B5 pins Toxotes' `Attack` animation tag to `launchDelayTicks` and proves the first complete release/flight/impact sequence.
- **Device recreation:** projectile models are part of `MODEL_CONFIGS`, so initial GPU creation and the existing device-loss rebuild execute one registry-loading path. Catalog tests require complete stable projectile coverage and parse every model contract.

### B5 serial Toxotes boundary

- **Implemented gameplay slice:** the Greek Archery Range is a distinct Classical-age 4×4 producer at Greek villager build slot 6; Toxotes occupies its authored train slot 0. The generated reverse catalogs, production commands, availability rules, fog, snapshot, and generic renderer/audio paths need no Toxotes switch.
- **Pinned Classic timing:** the hashed Trial Toxotes row supplies the projectile and balance fields. Its one-second reload is `20` ticks, and the source animation's `Attack 0.40` tag is `launchDelayTicks: 8`. Focused sim and presentation tests prove the pre-release snapshot gap, release boundary, stable arrow identity, and 0.40 attack-clip phase.
- **Exact-unit bonuses:** the discriminated `DamageBonus.target` represents either a logical class predicate or one named proto identity. Toxotes' `0.9×` Raiding Cavalry modifier is preserved without inventing a broad class; B6 may reuse the exact-unit target for Throwing Axeman, Hypaspist, and Axeman counters.
- **Known presentation asset gap:** the Trial includes the Greek Archery Range proto, portrait, and completion sound but not its Greek model archive. The producer media entry deliberately isolates an existing Classic Greek-building stand-in behind one named model asset. B5 remains integration-owned and is not considered visually complete until a legally sourced Classic Archery Range model replaces that stand-in; this does not alter simulation or open B6 lanes early.
- **Reference freeze ordering:** the reviewed implementation commit `5614ca84f2407d2c5bea9872950669cc90b82e80` is pinned by the integration-owned Toxotes reference, so its roster lane is implemented. Future projectile references must preserve this ordering; a foundation or presentation commit may not stand in as unit-review evidence.

### B6 ranged roster release

- **Two-phase reference ownership:** a `ready` lane must have an integration-owned `candidate` reference containing the complete expected definition plus hashed proto, inventory, and animation-release evidence. A contributor may read but never edit it. An `implemented` lane must instead have a `final` reference whose review points at the commit containing the reviewed unit pack. Validation rejects ready lanes with final references, implemented lanes with candidate references, blocked lanes with references, and open lanes without references.
- **Integrated lanes:** Peltast is Greek Archery Range slot 1 with the javelin projectile and a `30`-tick cycle / `12`-tick release. Gastraphetes is the Hades-only Greek Fortress unique-unit slot 2 with the arrow projectile and a `42`-tick cycle / `7`-tick release. Slinger is Egyptian Barracks slot 2 with the sling-stone projectile and a `20`-tick cycle / `8`-tick release. Chariot Archer is Egyptian Migdol Stronghold slot 0 with the arrow projectile and a `30`-tick cycle / `19`-tick release. Each final reference pins the reviewed implementation commit.
- **Classic classification:** the final references preserve the Trial logical classes rather than importing Retold recategorization. In particular, Chariot Archer is a human military archer and non-Greek unit, not cavalry. Peltast and Slinger retain their exact named counter modifiers, and Gastraphetes retains pierce-plus-crush damage rather than inventing an impact-area attack.
- **Launch contract:** each contributor lane owned only its sim definition/test, media definition, and asset directory. `bun run unit:lane brief <lane>` exposed the frozen candidate contract; `bun run unit:lane create <lane> --base <integration-base>` created the isolated branch/worktree; and `bun run unit:lane validate <lane> --base <integration-base>` rejected shared-file edits, missing pack files, reference drift, or an incomplete unit pack. Integration alone promoted references and roster status, then regenerated the shared catalogs.

### Exit criteria

- Queued releases, in-flight projectiles, impact/removal, expiry, misses, moving-target dodges, collision ordering, and any opened impact-area behavior are deterministic and hash-sensitive.
- Projectile launch and impact never apply immediate ranged damage, never read renderer state, and survive source/target death plus dense unit swap-removal through stable IDs.
- Snapshots expose enough stable state for interpolation and fog-correct visibility without exposing queued pre-release shots or making presentation authoritative.
- The renderer presents the serial projectile and its release/flight/impact timing from generated media with no Toxotes type switch.
- Toxotes trains from the faithful producer/slot and passes its separately owned final-ruleset reference, focused combat/presentation tests, catalog validation, and two-world determinism tests.
- Every ordinary-projectile lane was completed using only its owned sim definition, media definition, assets, and focused test; contributors did not edit shared projectile code, schemas, roster references, or generated catalogs.
- Every projectile hero, myth, siege, or exceptional ranged unit still names and waits on its additional family gate.

---

## Milestone 14 — Complete roster graph and Gate C eligibility

**Scope:** register the complete reserved Greek/Egyptian unit task graph before implementing another gameplay family, then define the smallest faithful hero vertical slice that can open the next parallel wave. C0 changes orchestration and architecture only: every newly registered lane remains blocked until its complete family substrate and independently owned candidate reference exist.

### Decisions

| Question                   | Decision                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compound prerequisites     | A lane owns ordered `gates` and `foundationLanes` arrays. Ranged heroes are B+C, special ranged myth units are B+C+D, flying or aquatic myth units include E, and naval projectile siege can be B+D+E. Gate A remains exclusive because it describes only the already-proven ordinary direct-hit family.                             |
| Complete identity boundary | `RESERVED_ROSTER_UNIT_TYPE_IDS` enumerates every independently authored Greek/Egyptian unit pack while excluding shared workers, buildings, and resource nodes. Module initialization and focused tests require `UNIT_ROSTER` to cover that reservation exactly once.                                                                |
| Source of task state       | `UNIT_ROSTER` remains the only machine-readable status, assignment, dependency, and ownership queue. [The full roster manifest](docs/UNIT_ROSTER_MANIFEST.md) is deterministic generated output and check mode rejects drift; it is not a second task source.                                                                        |
| Blocked assignments        | C0 records the Classic producer relationships and command positions available from the local proto audit so dependency planning is concrete. They are not launch authority: the family audit must re-verify them in a candidate reference before changing a lane to `ready`.                                                         |
| First hero slice           | Jason is the serial C1 proof. He exercises Greek major-god/age availability, per-type uniqueness across live and queued state, retraining after death, hero-vs-myth damage, relic pickup/drop state, production, hashing/snapshots, and generic media without also requiring projectiles or a charged special attack.                |
| First parallel hero wave   | After Jason integrates, the ordinary Greek heroes whose behavior is fully represented by C1 may receive candidate references and isolated lanes. Odysseus, Hippolyta, and Chiron additionally consume the proven B projectile foundation. Bellerophon, Polyphemus, and Perseus remain blocked on their exact Gate D special actions. |

### C0 — roster registration

1. Replace the scalar gate/foundation fields with ordered compound prerequisites and teach briefs, list output, validation, and ownership tests to expose them.
2. Register all `76` reserved workcells with stable identity, culture, family, gods, source-derived producer relationships when applicable, exact blockers, and disjoint owned paths.
3. Split culture-specific future-roster data away from the family-neutral schema/facade so adding identities cannot grow one central conditional file.
4. Generate `docs/UNIT_ROSTER_MANIFEST.md` from the canonical roster and include drift checking in unit-pack and repository checks.
5. Keep all `61` new lanes blocked. C0 does not create placeholder definitions, media, references, or generated catalog entries for unimplemented units.

### C1 — serial Jason hero foundation

1. Add explicit immutable hero traits and counter relationships rather than inferring hero behavior from names or type IDs.
2. Enforce one live-or-queued Greek hero of a given identity per player, release that limit deterministically on death, and allow faithful retraining through the Greek Town Center and Fortress.
3. Implement relic pickup, carrying, dropping, death release, snapshot, and hash state as shared hero infrastructure; Jason may not silently omit his shipped `PickUp`/`DropOff` actions.
4. Prove hero damage against myth units through the shared class/bonus contract, including armor and deterministic direct-hit combat.
5. Add Jason’s separately owned final-ruleset reference, original media, producer commands, availability/UI integration, focused two-world tests, and final review commit.
6. Before any Greek age-three hero lane opens, replace the earlier compact Fortress slot `2` assignment for Myrmidon, Hetairoi, and Gastraphetes with Classic Fortress column `6`, update their reviewed definitions/references, and prove that hero columns `0–3`, siege columns `4–5`, and major-god unique column `6` do not collide.

### C2 — hero fan-out release

- Audit every Greek hero against the C1 contract and B projectile contract, publish complete candidate references, and mark only fully represented lanes `ready`.
- **Audit result:** Odysseus, Heracles, Theseus, Hippolyta, Atalanta, Ajax, and Chiron fit the shared C1/B contracts and may fan out. Achilles remains blocked: his Classic root action selects three mounted attack clips with unequal durations, so a fixed `cooldownTicks`/damage pair cannot reproduce both its per-cycle timing and DPS-scaled hit damage. A shared deterministic variable-cycle contract must own selection, damage scaling, hashing, and presentation before that lane opens.
- A contributor still owns only its definition/test, media definition, and asset directory. Hero limits, relics, projectile mechanics, roster state, references, and catalogs remain integration-owned.
- Egyptian Pharaoh, Priest, and Son of Osiris remain blocked until their automatic lifecycle, healing, empowerment, conversion, transformation, and chain-attack foundations exist.
- Myth units remain blocked until a separate serial myth slice establishes favor cost, hero counters, special-action/recharge state, and one representative end-to-end pack.

### C3 — serial Minotaur myth and charged-action foundation (complete)

Minotaur is the first myth candidate because its ordinary movement, production, and direct-hit attack already fit the shared ground-unit substrate while its Gore action establishes one narrow Gate D mechanic. This slice targets the Age of Mythology Classic row and original media; Retold area/weight behavior and later Extended Edition balance changes are not valid substitutes.

1. **Myth-unit contract.** A trainable myth unit uses the existing explicit `UNIT_CLASS_MYTH`, Favor cost, age/minor-god availability, Temple relationship, and population queue. Hero-vs-myth bonuses remain attack-owned predicates. Do not add an empty myth-traits object, a name/id inference, or a parallel lifecycle store when these authored fields already determine the behavior.
2. **Charged melee shape.** `UnitTypeStats.specialAttack` is an optional discriminated union independent from the primary `attack`. The first and only opened kind is `charged-melee`, owning damage, armor/bonus resolution, reach, OR-ed target predicates, recharge ticks, full action ticks, and impact delay. Future throws, jumps, petrification, area pulses, and projectile specials do not enter this shape until a representative unit proves their additional state.
3. **Authoritative action state.** Each live unit owns a fixed-capacity recharge, action-remaining timer, stable target id, and impact-pending bit. Gore starts ready, consumes its charge only at the source animation's impact tag, cancels an escaped/invalid pre-impact target without consuming the charge, and finishes recovery without depending on a live target. While the action is active, the attacker is movement-locked and crowd separation does not slide the attacker/victim pair apart; the victim can still actively escape, and the impact revalidates authored reach. Spawn, interruption, swap-remove, snapshots, and `hashWorld` cover every field.
4. **Presentation boundary.** The snapshot exposes the active action timer. Generated media selects the original Gore clip and drives it from the authoritative action cycle; audio detects the transition into that state and plays the original Gore cue. Rendering and audio never infer a special from unit identity or hit-point loss.
5. **Thrown target reaction.** A target reaction is an authoritative per-unit discriminated store, independent from the attacker's charged-action state. One exhaustive reaction policy owns ticking, order execution, position control, and ground-separation participation; unsupported stored kinds fail immediately instead of becoming permanent locks. The first opened kind is `thrown`: it owns the normalized horizontal direction, sampled throw parameters, bounce progress, current ballistic arc, height above terrain, and exclusive execution lock. Its single installation boundary atomically interrupts an active charged wind-up and any unreleased projectile, but an already-fired projectile remains authoritative. Ordinary orders may replace the victim's pending intent while it is airborne, but cannot interrupt the reaction or execute until its final landing. The victim remains damageable and targetable; only its movement, task work, attacks, and separation response are suspended. Every future reaction kind must prove why these semantics fit before sharing the store.
6. **Classic Gore throw evidence.** The pinned Trial executable (`AOM.EXE`, SHA-256 `5975176380f29104c66e49fa7dc73d2a24221612190de630258f8523f7825366`) closes the engine-behavior gap left by proto and animation data. Gore's hit handler at `0x79ba67` normalizes target-minus-attacker in the horizontal plane, consumes the synchronized RNG stream in fixed order, and installs unit action `29` (`BUnitThrownAction`) on the victim. The saved thrown-action fields and handler at `0x787b00` pin distance `8 + random[0,2)`, one or two random bounce steps, max height `6 + random[0,2)`, max velocity `12 + random[0,4)`, `mNumberBouncesDone = -1`, and the default ballistic style. The ballistic helper derives horizontal/vertical velocity and gravity from those values; an invalid initial landing becomes the source's `0.1`-unit horizontal fallback, while each completed landing either starts the next successively shorter/lower arc or terminates when the bounce counter is exhausted or the next landing is invalid. C3 reproduces that algebra with determinism-safe arithmetic and the shared hashed RNG stream; it does not substitute a visual knockback.
7. **Final evidence and closeout.** The local Trial proto pins the Classic gameplay row and target set; the original root animation pins a 47% impact in the two-second Gore clip; the executable pins the target reaction above. Commit `688bf8f860a84bd36efff52efb358dd10d675f17` is the final ruleset review boundary. The reference is `final`, the roster lane is `implemented`, and the temporary multiplayer Minotaur spawn is removed so ordinary match starts no longer contain test-only content.

### C4 — post-C3 hero/myth eligibility audit

**Scope:** audit every remaining Greek/Egyptian hero and myth lane against the proven C1 hero, B projectile, and C3 charged-melee/thrown-reaction contracts. C4 changes task orchestration and blockers only. It does not widen `SpecialAttack`, create placeholder references, or mark a lane `ready` because part of its behavior resembles Minotaur.

The audit uses the pinned local Trial proto and original root animation inventory. Proto action identity is evidence for grouping future work, not proof that two actions with the same name have identical target, movement, damage, or immunity semantics. Each group still needs one serial vertical slice before sibling lanes can fan out.

| Audit group             | Lanes                                                                                             | C4 disposition                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proven C3 contract      | Minotaur                                                                                          | Implemented and final. It is the only current myth lane whose complete Classic behavior fits the shipped contracts.                                                                                                                                                                                                                            |
| Gore extension          | Polyphemus                                                                                        | Still blocked. `Gore` can reuse charged-melee and thrown-reaction state, but its Classic target set adds Huntable and every MythUnit plus frozen/stone immunity predicates that the current taxonomy cannot express.                                                                                                                           |
| JumpAttack              | Bellerophon, Anubite                                                                              | Shared `serial-jump-special` candidate. Needs attacker launch/landing, collision, target revalidation, damage timing, recharge, hash/snapshot state, and presentation.                                                                                                                                                                         |
| WhirlwindAttack         | Nemean Lion, Sphinx, Avenger, Scorpion Man                                                        | Shared `serial-area-whirlwind-special` candidate. Needs deterministic area enumeration, per-action movement, damage timing, recharge, and presentation. Nemean Lion is the preferred serial proof because it requires neither projectile nor Gate E substrate; siblings remain blocked until its contract is proven against their source rows. |
| ChargedRangedAttack     | Centaur, Manticore; Chimera after area impact exists                                              | Shared `serial-charged-ranged-special` candidate on top of Gate B. Needs release ownership, target revalidation, recharge, projectile fan-out, and presentation. Chimera additionally needs deterministic projectile-area effects.                                                                                                             |
| FreezeAttack            | Perseus, Medusa                                                                                   | Shared `serial-petrification-special` candidate. Needs target/immunity rules and authoritative terminal petrification/death semantics; the thrown-reaction store is not a generic status-effect store.                                                                                                                                         |
| Pickup/throw            | Cyclops                                                                                           | May reuse the released-victim thrown reaction, but still needs pickup containment, attacker/victim synchronization, release, impact damage, and immunity rules. It remains a serial slice.                                                                                                                                                     |
| Gate E movement         | Pegasus, Scylla, Carcinos, Roc, Leviathan, War Turtle                                             | C3 satisfies only their common myth economy. Air/water navigation, occupancy, targeting, visibility, transport, or naval-special behavior still blocks each lane.                                                                                                                                                                              |
| Identity-specific state | Achilles, Hydra, Colossus, Wadjet, Petsuchos, Scarab, Mummy, Phoenix, Greek Titan, Egyptian Titan | Remain serial: variable attack cycles, head growth, resource eating, regeneration, continuous lightning, siege acquisition, conversion/minions, egg rebirth/flight, or Titan awakening cannot share C3 state without losing fidelity.                                                                                                          |
| Egyptian hero family    | Pharaoh, Priest, Son of Osiris                                                                    | Remain blocked on Egyptian automatic lifecycle, healing/empowerment/conversion/construction, or god-power transformation and chain-attack rules. Greek hero uniqueness is not a faithful substitute.                                                                                                                                           |

**Audit result:** no additional lane becomes `ready` in C4. Canonical roster blockers now name the residual mechanic after C3 instead of continuing to claim that generic myth or special-action infrastructure is missing. The next highest-leverage serial slice is Nemean Lion's area-whirlwind contract; a faithful proof can potentially open Sphinx, Avenger, and Scorpion Man as isolated workcells.

### Exit criteria

- Every reserved Greek/Egyptian unit identity is registered exactly once and every unimplemented lane names all required gates and foundation owners.
- Compound prerequisites survive task listing, self-contained briefs, validation, generated documentation, and future family additions without a unit-specific condition.
- No blocked lane can launch, no blocked definition leaks into generated runtime catalogs, and no reference spec is required before a family contract can express its complete expected state.
- Jason and Minotaur remain the final C1 and C3 serial proofs; completed Greek hero lanes and Minotaur have final references, while every other hero/myth lane retains an evidence-backed residual blocker.
- C4 groups shared future mechanics without marking any lane ready before one faithful representative proves the complete deterministic contract.
- Unit-pack validation, generated-manifest drift checks, complete tests, types, lint, formatting, and deterministic catalog checks remain green.

---

### C5 — serial Nemean Lion variable-cycle and area-pulse foundation (in progress)

**Scope:** use Nemean Lion as the serial proof for two source-required mechanics that the fixed ordinary melee and C3 charged-melee contracts cannot represent: unequal ordinary attack clips whose landed damage scales with cycle duration, and an attacker-centered charged area pulse. This is a Classic fidelity slice, not a generic status/effect system and not permission to approximate every proto action named `WhirlwindAttack` with the same behavior.

1. **Variable ordinary melee cycles.** A melee attack may author a nonempty ordered set of `{ actionTicks, impactDelayTicks }` variants. The simulation chooses one through the shared synchronized RNG stream when an attack begins, movement-locks the attacker through that cycle, lands once at the selected source tag, and scales the DPS-authored damage by `actionTicks / cooldownTicks`. Fixed-cycle units retain their existing zero-RNG path. The chosen variant and pending-impact bit survive interruption, dense copying, snapshots, and `hashWorld`; presentation reads that authoritative variant rather than choosing its own clip.
2. **Charged area-pulse shape.** The second `SpecialAttack` kind owns attacker-centered radius, linear distance falloff, an explicit enemy/neutral relationship mask, ordinary armor/bonus resolution, trigger-target predicates, recharge, action duration, and impact delay. Trigger eligibility and affected-victim relationships are intentionally separate: Nemean Lion must acquire a valid Human or Myth target before roaring, while the pulse damages every authored enemy or neutral unit in range. The fixed-capacity dense entity order is the authoritative enumeration order, and deaths are removed only after that pass.
3. **Action lifecycle.** The C3 recharge/action store remains the sole charged-action state. Area pulse uses the same pre-impact target/reach revalidation, impact-time charge consumption, movement lock, interruption behavior, snapshot, hash, spawn, and swap-remove contracts as charged melee; only its exhaustive impact resolver differs. No parallel cooldown store or per-unit callback is introduced.
4. **Classic evidence.** The pinned Trial row `530` provides the base unit, Whirlwind action, target rates, relationship options, damage, radius, and recharge. Structured final-ruleset deltas pin the shipped `2x` ordinary myth multiplier and `22` Favor cost. The original root animation plus hashed GLBs pin two ordinary cycles at `24` ticks/`46%` impact and `18` ticks/`43%` impact, and the roar at `60` ticks/`40%` impact. The pinned executable area handler at `0x77c6d0` binds attacker centering and linear falloff to the reference instead of leaving those engine-only semantics implicit.
5. **Vertical slice and workcell state.** Nemean Lion is authored end to end as an integration-owned `candidate` reference and `ready` lane while the slice is reviewed. Its definition, two authoritative ordinary attack clips, roar/death/movement media, original audio, icon, source verification, area filtering/falloff tests, deterministic cycle-selection tests, death compaction, and presentation tests are present. Final review changes the reference to `final` and the lane to `implemented`; a checked-in candidate definition alone does not close C5.
6. **Particle presentation and sibling boundary.** Nemean Lion's source PRT and `64x64` additive sound-wave texture are recovered, hash-pinned, parsed by source verification, and compiled into generated media. Keyed source evidence is the sole owner of emitter behavior and its explicit source-to-runtime mapping; the unit media pack owns only the matching effect identity, trigger, and texture URL. Catalog generation rejects missing, extra, duplicated, or unsupported mappings and emits immutable per-unit numeric effect indices, so the renderer never resolves authored string keys or silently skips an invalid effect. Particle evidence is validated independently from the `charged-area-pulse` gameplay discriminator: a gameplay shape does not mandate one presentation technology, and another special kind may still own source-proven particles. The reusable renderer reconstructs the attack-synchronized looping emitter from the authoritative special-action timer and stable entity identity; its `20`-particle capacity, `0.8`-second lifetime, dormancy, emission rate/variance, velocity, scale, opacity, texture, and blend are data rather than unit switches or mutable simulation state. Device recreation rebuilds its GPU resources through the ordinary unit-renderer lifecycle. Sphinx, Avenger, and Scorpion Man remain blocked until their own proto/actions and particles are audited against the proven shape. Matching action names do not prove identical locomotion, target filters, pulse counts, damage timing, poison, or presentation. Achilles likewise remains blocked until a candidate audit proves that the new variable-cycle contract covers its full unit behavior.

### C5 exit criteria

- Fixed-cycle melee behavior and RNG consumption are unchanged, while variable-cycle selection, timing, damage scaling, interruption, copying, snapshots, hashing, animation selection, and two-world determinism are covered.
- Charged area pulses have deterministic relationship filtering, radius/falloff, armor/bonus resolution, deferred removal, action lifecycle, and source-bound evidence with no renderer authority.
- Nemean Lion matches its candidate reference and local evidence, trains from Greek Temple slot `2` under Aphrodite in the Heroic Age, and presents both ordinary cycles plus the source roar action/audio.
- The original roar visual particle is represented through a reusable presentation contract before the candidate becomes final.
- No sibling area-action or variable-cycle lane opens until its complete reference audit passes; each residual blocker names the behavior still outside C5.
- Source verification, generated catalogs/manifest, focused tests, full tests, types, lint, formatting, and deterministic checks remain green before final closeout.

---

## Later milestones (direction, not commitments)

Complete compound roster graph → serial Jason hero foundation → ordinary Greek hero fan-out → serial Minotaur charged/throw slice → area-whirlwind proof and eligible myth fan-out → god powers → naval/air/transport → gates/walls → AI → deterministic physics kernel.

## Open questions (parked, on purpose)

- Asset pipeline for M2: glTF ingestion, texture compression (KTX2/Basis), where art comes from.
- Terrain ownership: heightmap moves into sim (deterministic generation) once gameplay reads height/slope.
- Camera yaw rotation: when to unlock, and its minimap implications.
- WebGPU on older Safari/Firefox installs: revisit an error-screen-vs-fallback decision only if real users demand it.
