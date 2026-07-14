import { GATHER_COOLDOWN_TICKS } from "@aom/sim";

export const VILLAGER_IDLE_FRAME = 0;
export const VILLAGER_WALK_FIRST_FRAME = 1;
export const VILLAGER_WALK_FRAME_COUNT = 6;
export const VILLAGER_ATLAS_COLUMNS = 7;

const SIM_TICK_HZ = 20;
const WALK_FPS = 8;
const MOVING_EPSILON_SQ = 1e-8;

export interface AnimationFrameConfig {
  idleFrame: number;
  walkFirstFrame: number;
  walkFrameCount: number;
}

const VILLAGER_ANIMATION_CONFIG: AnimationFrameConfig = {
  idleFrame: VILLAGER_IDLE_FRAME,
  walkFirstFrame: VILLAGER_WALK_FIRST_FRAME,
  walkFrameCount: VILLAGER_WALK_FRAME_COUNT,
};

export interface VillagerAnimationFrameInput {
  prevX: number;
  prevZ: number;
  currX: number;
  currZ: number;
  tick: number;
  alpha: number;
  unitIndex: number;
}

export interface VillagerGatherAnimationFrameInput {
  cooldown: number;
  alpha: number;
}

export function spriteDirectionRow(
  facing: number,
  cameraViewX: number,
  cameraViewZ: number,
  directions: number,
): number {
  if (directions <= 1) {
    return 0;
  }

  const absX = Math.abs(cameraViewX);
  const absZ = Math.abs(cameraViewZ);
  const diagonalThreshold = 0.414_213_562_373_095_03;
  let cameraSector: number;

  if (absZ <= absX * diagonalThreshold) {
    cameraSector = cameraViewX > 0 ? 2 : 6;
  } else if (absX <= absZ * diagonalThreshold) {
    cameraSector = cameraViewZ > 0 ? 0 : 4;
  } else if (cameraViewX > 0) {
    cameraSector = cameraViewZ > 0 ? 1 : 3;
  } else {
    cameraSector = cameraViewZ > 0 ? 7 : 5;
  }

  const towardCameraSector = (cameraSector + 4) & 7;

  // The imported model's native yaw makes row 1 the front pose. Blender's XY
  // ground plane and the engine's XZ ground plane have opposite screen-space
  // handedness, so atlas rows run opposite the sim's clockwise heading sectors.
  return (towardCameraSector - (facing & 7) + 9) & 7;
}

export function villagerAnimationFrame(
  input: VillagerAnimationFrameInput,
  // Militia shares the layout today; the param is what lets a future type differ.
  config = VILLAGER_ANIMATION_CONFIG,
): number {
  const dx = input.currX - input.prevX;
  const dz = input.currZ - input.prevZ;

  if (dx * dx + dz * dz <= MOVING_EPSILON_SQ) {
    return config.idleFrame;
  }

  const phase = (input.unitIndex % config.walkFrameCount) * 0.23;
  const frameClock = (input.tick + input.alpha) * (WALK_FPS / SIM_TICK_HZ) + phase;

  return config.walkFirstFrame + (Math.floor(frameClock) % config.walkFrameCount);
}

export function villagerGatherAnimationFrame(
  input: VillagerGatherAnimationFrameInput,
  config: AnimationFrameConfig,
): number {
  if (config.walkFrameCount <= 0) {
    return config.idleFrame;
  }

  const cooldown = Math.min(GATHER_COOLDOWN_TICKS, Math.max(0, input.cooldown));
  const ticksSinceStrike = GATHER_COOLDOWN_TICKS - cooldown + input.alpha;
  const frameClock = (ticksSinceStrike * config.walkFrameCount) / GATHER_COOLDOWN_TICKS;

  return config.walkFirstFrame + (Math.floor(frameClock) % config.walkFrameCount);
}
