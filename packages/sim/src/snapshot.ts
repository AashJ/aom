// The only sim->engine channel. The engine reads snapshots, never World.
import type { World } from "./ecs/world";

export interface RenderSnapshot {
  tick: number;
  count: number;
  posX: Float32Array;
  posZ: Float32Array;
  selected: Uint8Array;
}

export function createSnapshot(capacity: number): RenderSnapshot {
  return {
    tick: 0,
    count: 0,
    posX: new Float32Array(capacity),
    posZ: new Float32Array(capacity),
    selected: new Uint8Array(capacity),
  };
}

export function writeSnapshot(world: World, out: RenderSnapshot): void {
  out.tick = world.tick;
  out.count = world.count;

  for (let i = 0; i < world.count; i += 1) {
    // f64 sim state narrows to f32 at this boundary: render precision is enough for pixels,
    // while sim keeps f64.
    out.posX[i] = world.posX[i]!;
    out.posZ[i] = world.posZ[i]!;
    out.selected[i] = world.selectable[i]!;
  }
}
