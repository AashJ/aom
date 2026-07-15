import { TYPE_EGYPTIAN_LABORER } from "@aom/sim";
import axeUrl from "../../../assets/models/attachments-a-axe-hatchet.glb?url";
import basketUrl from "../../../assets/models/attachments-a-basket.glb?url";
import hammerUrl from "../../../assets/models/tool-hammer.glb?url";
import pickaxeUrl from "../../../assets/models/tool-pickaxe-miners.glb?url";
import femaleBuildUrl from "../../../assets/models/egyptian-villager-female-build.glb?url";
import femaleChopUrl from "../../../assets/models/egyptian-villager-female-chop.glb?url";
import femaleHarvestUrl from "../../../assets/models/egyptian-villager-female-harvest.glb?url";
import femaleIdleUrl from "../../../assets/models/egyptian-villager-female-idle.glb?url";
import femaleMineUrl from "../../../assets/models/egyptian-villager-female-mine.glb?url";
import femaleWalkUrl from "../../../assets/models/egyptian-villager-female-walk.glb?url";
import maleBuildUrl from "../../../assets/models/egyptian-villager-male-build.glb?url";
import maleChopUrl from "../../../assets/models/egyptian-villager-male-chop.glb?url";
import maleHarvestUrl from "../../../assets/models/egyptian-villager-male-harvest.glb?url";
import maleIdleUrl from "../../../assets/models/egyptian-villager-male-idle.glb?url";
import maleMineUrl from "../../../assets/models/egyptian-villager-male-mine.glb?url";
import maleWalkUrl from "../../../assets/models/egyptian-villager-male-walk.glb?url";
import iconUrl from "../../../assets/villager.png";
import { AUDIO_CUES, EGYPTIAN_VILLAGER_CUES } from "../../../audio/assets";
import {
  actionCycle,
  loop,
  type ModelAttachmentDefinition,
  type UnitMediaDefinition,
} from "../../unit-media-schema";

const pickaxe: readonly ModelAttachmentDefinition[] = [
  { model: "egyptianPickaxe", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
];
const basket: readonly ModelAttachmentDefinition[] = [
  { model: "egyptianBasket", targetNode: "Dummy_lefthand", hotspotNode: "Dummy_hotspot" },
];
const axe: readonly ModelAttachmentDefinition[] = [
  { model: "egyptianAxeHatchet", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
];
const hammer: readonly ModelAttachmentDefinition[] = [
  { model: "egyptianHammer", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
];

export const definition = {
  type: TYPE_EGYPTIAN_LABORER,
  key: "egyptian-laborer",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianVillagerMaleIdle", "egyptianVillagerFemaleIdle"]),
      walk: loop(["egyptianVillagerMaleWalk", "egyptianVillagerFemaleWalk"]),
      gatherGold: actionCycle(["egyptianVillagerMaleMine", "egyptianVillagerFemaleMine"]),
      gatherFood: actionCycle(["egyptianVillagerMaleHarvest", "egyptianVillagerFemaleHarvest"]),
      gatherWood: actionCycle(["egyptianVillagerMaleChop", "egyptianVillagerFemaleChop"]),
      build: actionCycle(["egyptianVillagerMaleBuild", "egyptianVillagerFemaleBuild"]),
    },
  },
  models: [
    { key: "egyptianVillagerMaleIdle", url: maleIdleUrl, grounded: true },
    { key: "egyptianVillagerFemaleIdle", url: femaleIdleUrl, grounded: true },
    { key: "egyptianVillagerMaleWalk", url: maleWalkUrl, grounded: true },
    { key: "egyptianVillagerFemaleWalk", url: femaleWalkUrl, grounded: true },
    {
      key: "egyptianVillagerMaleMine",
      url: maleMineUrl,
      grounded: true,
      attachments: pickaxe,
    },
    {
      key: "egyptianVillagerFemaleMine",
      url: femaleMineUrl,
      grounded: true,
      attachments: pickaxe,
    },
    {
      key: "egyptianVillagerMaleHarvest",
      url: maleHarvestUrl,
      grounded: true,
      attachments: basket,
    },
    {
      key: "egyptianVillagerFemaleHarvest",
      url: femaleHarvestUrl,
      grounded: true,
      attachments: basket,
    },
    {
      key: "egyptianVillagerMaleChop",
      url: maleChopUrl,
      grounded: true,
      attachments: axe,
    },
    {
      key: "egyptianVillagerFemaleChop",
      url: femaleChopUrl,
      grounded: true,
      attachments: axe,
    },
    {
      key: "egyptianVillagerMaleBuild",
      url: maleBuildUrl,
      grounded: true,
      attachments: hammer,
    },
    {
      key: "egyptianVillagerFemaleBuild",
      url: femaleBuildUrl,
      grounded: true,
      attachments: hammer,
    },
    { key: "egyptianPickaxe", url: pickaxeUrl, grounded: false },
    { key: "egyptianBasket", url: basketUrl, grounded: false },
    { key: "egyptianAxeHatchet", url: axeUrl, grounded: false },
    { key: "egyptianHammer", url: hammerUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: EGYPTIAN_VILLAGER_CUES.villagerSelect,
    acknowledge: EGYPTIAN_VILLAGER_CUES.villagerAcknowledge,
    attackAcknowledge: EGYPTIAN_VILLAGER_CUES.villagerAttack,
    gatherFood: EGYPTIAN_VILLAGER_CUES.villagerForage,
    gatherWood: EGYPTIAN_VILLAGER_CUES.villagerLumber,
    gatherGold: EGYPTIAN_VILLAGER_CUES.villagerMine,
    repair: EGYPTIAN_VILLAGER_CUES.villagerRepair,
    created: AUDIO_CUES.villagerCreate,
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
