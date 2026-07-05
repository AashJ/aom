export const VILLAGER_IDLE_FRAME = 0;
export const VILLAGER_WALK_FIRST_FRAME = 1;
export const VILLAGER_WALK_FRAME_COUNT = 6;
export const VILLAGER_ATLAS_COLUMNS = 7;

const SIM_TICK_HZ = 20;
const WALK_FPS = 8;
const MOVING_EPSILON_SQ = 1e-8;

export interface VillagerAnimationFrameInput {
  prevX: number;
  prevZ: number;
  currX: number;
  currZ: number;
  tick: number;
  alpha: number;
  unitIndex: number;
}

export function villagerAnimationFrame(input: VillagerAnimationFrameInput): number {
  const dx = input.currX - input.prevX;
  const dz = input.currZ - input.prevZ;

  if (dx * dx + dz * dz <= MOVING_EPSILON_SQ) {
    return VILLAGER_IDLE_FRAME;
  }

  const phase = (input.unitIndex % VILLAGER_WALK_FRAME_COUNT) * 0.23;
  const frameClock = (input.tick + input.alpha) * (WALK_FPS / SIM_TICK_HZ) + phase;

  return VILLAGER_WALK_FIRST_FRAME + (Math.floor(frameClock) % VILLAGER_WALK_FRAME_COUNT);
}
