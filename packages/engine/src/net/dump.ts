import { hashWorld, type World } from "@aom/sim";

export function dumpWorldState(world: World, tick: number): void {
  const dump = {
    tick,
    hash: hashWorld(world),
    count: world.count,
    posX: Array.from(world.posX.subarray(0, world.count)),
    posZ: Array.from(world.posZ.subarray(0, world.count)),
    velX: Array.from(world.velX.subarray(0, world.count)),
    velZ: Array.from(world.velZ.subarray(0, world.count)),
    moveTargetX: Array.from(world.moveTargetX.subarray(0, world.count)),
    moveTargetZ: Array.from(world.moveTargetZ.subarray(0, world.count)),
    moving: Array.from(world.moving.subarray(0, world.count)),
  };

  console.error("[desync] world state at tick", tick, dump);

  if (typeof document !== "undefined") {
    // Finding WHICH array diverged is 90% of desync debugging — diff two players' dumps.
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `desync-tick${tick}-player.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
