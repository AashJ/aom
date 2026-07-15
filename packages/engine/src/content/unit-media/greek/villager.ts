import { TYPE_GREEK_VILLAGER } from "@aom/sim";
import axeUrl from "../../../assets/models/attachments-a-axe-hatchet.glb?url";
import basketUrl from "../../../assets/models/attachments-a-basket.glb?url";
import hammerUrl from "../../../assets/models/tool-hammer.glb?url";
import pickaxeUrl from "../../../assets/models/tool-pickaxe-miners.glb?url";
import femaleBuildUrl from "../../../assets/models/villager-g-female-build.glb?url";
import femaleChopUrl from "../../../assets/models/villager-g-female-chop.glb?url";
import femaleHarvestUrl from "../../../assets/models/villager-g-female-harvest.glb?url";
import femaleIdleUrl from "../../../assets/models/villager-g-female-idle.glb?url";
import femaleMineUrl from "../../../assets/models/villager-g-female-mine.glb?url";
import femalePrayAUrl from "../../../assets/models/villager-g-female-pray-a.glb?url";
import femalePrayBUrl from "../../../assets/models/villager-g-female-pray-b.glb?url";
import femaleWalkUrl from "../../../assets/models/villager-g-female-walk.glb?url";
import maleBuildUrl from "../../../assets/models/villager-g-male-build.glb?url";
import maleChopUrl from "../../../assets/models/villager-g-male-chop.glb?url";
import maleHarvestUrl from "../../../assets/models/villager-g-male-harvest.glb?url";
import maleIdleUrl from "../../../assets/models/villager-g-male-idle.glb?url";
import maleMineUrl from "../../../assets/models/villager-g-male-mine.glb?url";
import malePrayAUrl from "../../../assets/models/villager-g-male-pray-a.glb?url";
import malePrayBUrl from "../../../assets/models/villager-g-male-pray-b.glb?url";
import maleWalkUrl from "../../../assets/models/villager-g-male-walk.glb?url";
import iconUrl from "../../../assets/villager.png";
import { AUDIO_CUES } from "../../../audio/assets";
import {
  actionCycle,
  loop,
  type ModelAttachmentDefinition,
  type UnitMediaDefinition,
} from "../../unit-media-schema";

const pickaxe: readonly ModelAttachmentDefinition[] = [
  { model: "pickaxe", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
];
const basket: readonly ModelAttachmentDefinition[] = [
  { model: "basket", targetNode: "Dummy_lefthand", hotspotNode: "Dummy_hotspot" },
];
const axe: readonly ModelAttachmentDefinition[] = [
  { model: "axeHatchet", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
];
const hammer: readonly ModelAttachmentDefinition[] = [
  { model: "hammer", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
];

export const definition = {
  type: TYPE_GREEK_VILLAGER,
  key: "greek-villager",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["villagerMaleIdle", "villagerFemaleIdle"]),
      walk: loop(["villagerMaleWalk", "villagerFemaleWalk"]),
      gatherGold: actionCycle(["villagerMaleMine", "villagerFemaleMine"]),
      gatherFood: actionCycle(["villagerMaleHarvest", "villagerFemaleHarvest"]),
      gatherWood: actionCycle(["villagerMaleChop", "villagerFemaleChop"]),
      build: actionCycle(["villagerMaleBuild", "villagerFemaleBuild"]),
      pray: loop([
        "villagerMalePrayA",
        "villagerFemalePrayA",
        "villagerMalePrayB",
        "villagerFemalePrayB",
      ]),
    },
  },
  models: [
    { key: "villagerMaleIdle", url: maleIdleUrl, grounded: true },
    { key: "villagerFemaleIdle", url: femaleIdleUrl, grounded: true },
    { key: "villagerMaleWalk", url: maleWalkUrl, grounded: true },
    { key: "villagerFemaleWalk", url: femaleWalkUrl, grounded: true },
    { key: "villagerMaleMine", url: maleMineUrl, grounded: true, attachments: pickaxe },
    { key: "villagerFemaleMine", url: femaleMineUrl, grounded: true, attachments: pickaxe },
    { key: "villagerMaleHarvest", url: maleHarvestUrl, grounded: true, attachments: basket },
    { key: "villagerFemaleHarvest", url: femaleHarvestUrl, grounded: true, attachments: basket },
    { key: "villagerMaleChop", url: maleChopUrl, grounded: true, attachments: axe },
    { key: "villagerFemaleChop", url: femaleChopUrl, grounded: true, attachments: axe },
    { key: "villagerMaleBuild", url: maleBuildUrl, grounded: true, attachments: hammer },
    { key: "villagerFemaleBuild", url: femaleBuildUrl, grounded: true, attachments: hammer },
    { key: "villagerMalePrayA", url: malePrayAUrl, grounded: true },
    { key: "villagerFemalePrayA", url: femalePrayAUrl, grounded: true },
    { key: "villagerMalePrayB", url: malePrayBUrl, grounded: true },
    { key: "villagerFemalePrayB", url: femalePrayBUrl, grounded: true },
    { key: "pickaxe", url: pickaxeUrl, grounded: false },
    { key: "basket", url: basketUrl, grounded: false },
    { key: "axeHatchet", url: axeUrl, grounded: false },
    { key: "hammer", url: hammerUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: AUDIO_CUES.villagerSelect,
    acknowledge: AUDIO_CUES.villagerAcknowledge,
    attackAcknowledge: AUDIO_CUES.villagerAttack,
    gatherFood: AUDIO_CUES.villagerForage,
    gatherWood: AUDIO_CUES.villagerLumber,
    gatherGold: AUDIO_CUES.villagerMine,
    repair: AUDIO_CUES.villagerRepair,
    created: AUDIO_CUES.villagerCreate,
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
