// Icon art for the React command panel. Militia has no portrait; its walk atlas
// crops to frame 0 via `columns` (CSS background-size trick, no new art needed).
import barracksUrl from "./barracks.png";
import houseUrl from "./house.png";
import militiaUrl from "./militia-walk.png";
import villagerUrl from "./villager.png";
import { TYPE_BARRACKS, TYPE_HOUSE, TYPE_MILITIA, TYPE_TEMPLE, TYPE_VILLAGER } from "@aom/sim";

export interface IconConfig {
  url: string;
  // Horizontal frames in the source image; 1 = plain portrait.
  columns: number;
}

export const TYPE_ICONS: ReadonlyMap<number, IconConfig> = new Map([
  [TYPE_VILLAGER, { url: villagerUrl, columns: 1 }],
  [TYPE_MILITIA, { url: militiaUrl, columns: 7 }],
  [TYPE_HOUSE, { url: houseUrl, columns: 6 }],
  [TYPE_BARRACKS, { url: barracksUrl, columns: 1 }],
  // The Temple simulation type lands before its extracted Greek render asset;
  // keep the command legible with the closest existing Greek building plate.
  [TYPE_TEMPLE, { url: barracksUrl, columns: 1 }],
]);
