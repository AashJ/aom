// The only sim->engine channel. The engine reads snapshots, never World.
import { RESOURCE_COUNT } from "./ecs/types";
import { unitIdAt, type World } from "./ecs/world";

export interface RenderSnapshot {
  tick: number;
  count: number;
  ids: Uint32Array;
  posX: Float32Array;
  posZ: Float32Array;
  selected: Uint8Array;
  owner: Uint8Array;
  unitType: Uint8Array;
  hp: Uint16Array;
  buildProgress: Uint16Array;
  trainType: Uint8Array;
  trainRemaining: Uint16Array;
  carried: Uint16Array;
  stockpiles: Uint32Array;
  winner: number;
}

export function createSnapshot(capacity: number): RenderSnapshot {
  return {
    tick: 0,
    count: 0,
    ids: new Uint32Array(capacity),
    posX: new Float32Array(capacity),
    posZ: new Float32Array(capacity),
    selected: new Uint8Array(capacity),
    owner: new Uint8Array(capacity),
    unitType: new Uint8Array(capacity),
    hp: new Uint16Array(capacity),
    buildProgress: new Uint16Array(capacity),
    trainType: new Uint8Array(capacity),
    trainRemaining: new Uint16Array(capacity),
    carried: new Uint16Array(capacity),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    winner: -1,
  };
}

export function writeSnapshot(world: World, out: RenderSnapshot): void {
  out.tick = world.tick;
  out.count = world.count;
  // HP bars and the win banner are 4a/4b consumers.
  out.winner = world.winner;
  // Full copy each write: 2 KB at 20 Hz is negligible.
  out.stockpiles.set(world.stockpiles);

  for (let i = 0; i < world.count; i += 1) {
    // The renderer will use id equality to decide interpolate-vs-snap once swap-remove exists;
    // picking uses it to convert screen hits into command ids.
    out.ids[i] = unitIdAt(world, i);
    // f64 sim state narrows to f32 at this boundary: render precision is enough for pixels,
    // while sim keeps f64.
    out.posX[i] = world.posX[i]!;
    out.posZ[i] = world.posZ[i]!;
    // Copies selected, not selectable; selectable only means the unit may be selected.
    out.selected[i] = world.selected[i]!;
    // Renderer tints by owner in the next chunk.
    out.owner[i] = world.owner[i]!;
    // The renderer picks sprites by type.
    out.unitType[i] = world.unitType[i]!;
    out.hp[i] = world.hp[i]!;
    out.buildProgress[i] = world.buildProgress[i]!;
    // Production progress for the build-bar UI.
    out.trainType[i] = world.trainType[i]!;
    out.trainRemaining[i] = world.trainRemaining[i]!;
    out.carried[i] = world.carried[i]!;
  }
}
