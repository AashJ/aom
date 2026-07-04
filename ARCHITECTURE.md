# AoM Online — Architecture

An Age of Mythology–style RTS for the browser. Guiding constraints, in priority order:

1. **Extremely performant.** 60fps minimum on a mid-tier laptop, with headroom for thousands of units later. Performance is a feature we design for, not tune in afterward.
2. **Build sequentially.** Every milestone is a small, playable, verifiable increment. No speculative systems — but boundaries that would be brutal to retrofit (determinism, sim/render split) are designed in from day one.

**Milestone 1 (complete):** frontend only. A 3D terrain map you can pan, zoom, and edge-scroll around, with dummy units, marquee selection, a minimap, and a perf HUD. No gameplay, no networking, no backend.

**Milestone 3 (current focus):** gameplay sim — commands and movement. Built **before** M2 (meshes/animation) on purpose: movement needs no art, exercises the deterministic-sim investment, and finally binds right-click. M2's meshes then land on units that already behave. See its section below.

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

- Integration field: Dijkstra/BFS (8-neighbor, diagonal cost √2 as a constant) outward from the goal cell over the walkability grid, `Uint16` costs; then a direction field: per cell, the neighbor-descent direction stored as a normalized `(dx, dz)` pair (`Int8` quantized or two `Float32Array`s — decided at implementation).
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
- Lockstep input-delay scheme (fixed delay vs. rollback) — M4's first design question.
- When selection moves out of World into a client-local store (likely M4, when hashing goes live).

---

## Later milestones (direction, not commitments)

M2 real unit meshes + animation (instanced skinning; blocked on the asset-pipeline question) → M4 lockstep netcode: command transport, tick hashing, desync detection, backend service → M5 fog of war (compute), economy/buildings, and onward.

## Open questions (parked, on purpose)

- Asset pipeline for M2: glTF ingestion, texture compression (KTX2/Basis), where art comes from.
- Terrain ownership: heightmap moves into sim (deterministic generation) once gameplay reads height/slope.
- Camera yaw rotation: when to unlock, and its minimap implications.
- WebGPU on older Safari/Firefox installs: revisit an error-screen-vs-fallback decision only if real users demand it.
