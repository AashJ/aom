import type { BeamAttack } from "../content/unit-type-schema";
import { isEntityVisibleTo } from "../visibility";
import { resolveDamage } from "./combat";
import { resolveStableId } from "./id";
import { setFacingToward } from "./navigation";
import { effectiveAttackDamageMultiplier, effectiveAttackRange } from "./unit-age";
import { UNIT_TYPES } from "./types";
import type { World } from "./world";

export function tickActiveBeamAttack(
  world: World,
  attacker: number,
  attack: BeamAttack,
  neutralOwner: number,
  dealDamage: (world: World, index: number, damage: number, sourceIndex: number) => void,
): boolean {
  world.moving[attacker] = 0;
  world.unitField[attacker] = null;

  const target = resolveStableId(world, world.attackTarget[attacker]!);
  const targetVisible = target >= 0 && isEntityVisibleTo(world, world.owner[attacker]!, target);
  if (targetVisible) {
    setFacingToward(world, attacker, world.posX[target]!, world.posZ[target]!);
  }

  const remaining = world.attackCooldown[attacker]!;
  if (remaining === 0) {
    world.beamActionActive[attacker] = 0;
    world.beamActionImpactPending[attacker] = 0;
    return false;
  }
  const next = remaining - 1;
  world.attackCooldown[attacker] = next;

  if (
    world.beamActionImpactPending[attacker] === 1 &&
    next === attack.cooldownTicks - attack.impactDelayTicks
  ) {
    world.beamActionImpactPending[attacker] = 0;
    if (
      target >= 0 &&
      world.dying[target] === 0 &&
      world.hp[target]! > 0 &&
      world.owner[target] !== world.owner[attacker] &&
      world.owner[target] !== neutralOwner &&
      targetVisible
    ) {
      const targetStats = UNIT_TYPES[world.unitType[target]!]!;
      const dx = world.posX[target]! - world.posX[attacker]!;
      const dz = world.posZ[target]! - world.posZ[attacker]!;
      const attackerStats = UNIT_TYPES[world.unitType[attacker]!]!;
      const age = world.playerAge[world.owner[attacker]!]!;
      const reach = effectiveAttackRange(attackerStats, attack, age) + targetStats.bodyRadius;
      if (dx * dx + dz * dz <= reach * reach) {
        const ageMultiplier = effectiveAttackDamageMultiplier(attackerStats, age);
        dealDamage(world, target, resolveDamage(attack, targetStats) * ageMultiplier, attacker);

        const chain = attack.chain;
        if (chain !== undefined && chain.maxTargets > 1) {
          const hitTargets = [target];
          let previous = target;
          let chainMultiplier = 1;
          while (hitTargets.length < chain.maxTargets) {
            let nextTarget = -1;
            let nextDistanceSq = Number.POSITIVE_INFINITY;
            for (let candidate = 0; candidate < world.count; candidate += 1) {
              if (
                candidate === attacker ||
                hitTargets.includes(candidate) ||
                world.dying[candidate] === 1 ||
                world.hp[candidate]! <= 0 ||
                world.owner[candidate] === world.owner[attacker] ||
                world.owner[candidate] === neutralOwner
              ) {
                continue;
              }
              const chainDx = world.posX[candidate]! - world.posX[previous]!;
              const chainDz = world.posZ[candidate]! - world.posZ[previous]!;
              const distanceSq = chainDx * chainDx + chainDz * chainDz;
              if (distanceSq > chain.radius * chain.radius) continue;
              if (
                distanceSq < nextDistanceSq ||
                (distanceSq === nextDistanceSq &&
                  (nextTarget < 0 || world.handleOf[candidate]! < world.handleOf[nextTarget]!))
              ) {
                nextTarget = candidate;
                nextDistanceSq = distanceSq;
              }
            }
            if (nextTarget < 0) break;
            hitTargets.push(nextTarget);
            previous = nextTarget;
            chainMultiplier *= chain.damageMultiplier;
            const chainedStats = UNIT_TYPES[world.unitType[nextTarget]!]!;
            dealDamage(
              world,
              nextTarget,
              resolveDamage(attack, chainedStats) * ageMultiplier * chainMultiplier,
              attacker,
            );
          }
        }
      }
    }
  }

  if (next === 0) {
    world.beamActionActive[attacker] = 0;
    world.beamActionImpactPending[attacker] = 0;
    return false;
  }
  return true;
}
