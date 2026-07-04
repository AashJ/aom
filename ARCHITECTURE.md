# AoM Online — Architecture

An Age of Mythology–style RTS for the browser. Guiding constraints, in priority order:

1. **Extremely performant.** 60fps minimum on a mid-tier laptop, with headroom for thousands of units later. Performance is a feature we design for, not tune in afterward.
2. **Build sequentially.** Every milestone is a small, playable, verifiable increment. No speculative systems — but boundaries that would be brutal to retrofit (determinism, sim/render split) are designed in from day one.

**Milestone 1 (this doc's focus):** frontend only. A 3D terrain map you can pan, zoom, and edge-scroll around, with dummy units, marquee selection, a minimap, and a perf HUD. No gameplay, no networking, no backend.

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

## Later milestones (direction, not commitments)

M2 real unit meshes + animation (instanced skinning) → M3 gameplay sim: movement, flow-field pathfinding, commands (right-click gets bound) → M4 lockstep netcode: command queue, tick hashing, desync detection, backend service → M5 fog of war (compute), economy/buildings, and onward.

## Open questions (parked, on purpose)

- Asset pipeline for M2: glTF ingestion, texture compression (KTX2/Basis), where art comes from.
- Terrain ownership: heightmap moves into sim (deterministic generation) once gameplay reads height/slope.
- Camera yaw rotation: when to unlock, and its minimap implications.
- WebGPU on older Safari/Firefox installs: revisit an error-screen-vs-fallback decision only if real users demand it.
