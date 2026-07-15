import { TYPE_EGYPTIAN_MIGDOL_STRONGHOLD } from "@aom/sim";
import constructionAUrl from "../../../assets/units/egyptian/migdol-stronghold/construction-a.glb?url";
import constructionBUrl from "../../../assets/units/egyptian/migdol-stronghold/construction-b.glb?url";
import constructionCUrl from "../../../assets/units/egyptian/migdol-stronghold/construction-c.glb?url";
import deathUrl from "../../../assets/units/egyptian/migdol-stronghold/death.glb?url";
import iconUrl from "../../../assets/units/egyptian/migdol-stronghold/icon.png";
import idleUrl from "../../../assets/units/egyptian/migdol-stronghold/idle.glb?url";
import longBrickUrl from "../../../assets/units/egyptian/migdol-stronghold/long-brick.glb?url";
import mediumBrickUrl from "../../../assets/units/egyptian/migdol-stronghold/medium-brick.glb?url";
import smallBrickUrl from "../../../assets/units/egyptian/migdol-stronghold/small-brick.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const constructionBricks = [
  {
    model: "egyptianMigdolLongBrick",
    targetNode: "Dummy_attachpoint",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianMigdolLongBrick",
    targetNode: "Dummy_face",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianMigdolMediumBrick",
    targetNode: "Dummy_chin",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianMigdolMediumBrick",
    targetNode: "Dummy_leftfoot",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianMigdolSmallBrick",
    targetNode: "Dummy_lefthand",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianMigdolSmallBrick",
    targetNode: "Dummy_leftleg",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
  key: "egyptian-migdol-stronghold",
  presentation: {
    kind: "model",
    worldHeight: 5.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianMigdolIdle"]),
      construction: loop(
        [
          "egyptianMigdolConstructionA",
          "egyptianMigdolConstructionB",
          "egyptianMigdolConstructionC",
        ],
        "construction-stage",
      ),
      death: once(["egyptianMigdolDeath"]),
    },
  },
  models: [
    { key: "egyptianMigdolIdle", url: idleUrl, grounded: true },
    {
      key: "egyptianMigdolConstructionA",
      url: constructionAUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    {
      key: "egyptianMigdolConstructionB",
      url: constructionBUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    {
      key: "egyptianMigdolConstructionC",
      url: constructionCUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    { key: "egyptianMigdolDeath", url: deathUrl, grounded: true },
    { key: "egyptianMigdolLongBrick", url: longBrickUrl, grounded: false },
    { key: "egyptianMigdolMediumBrick", url: mediumBrickUrl, grounded: false },
    { key: "egyptianMigdolSmallBrick", url: smallBrickUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.fortress, death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
