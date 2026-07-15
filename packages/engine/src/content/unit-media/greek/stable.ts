import { TYPE_GREEK_STABLE } from "@aom/sim";
import constructionAUrl from "../../../assets/units/greek/stable/construction-a.glb?url";
import constructionBUrl from "../../../assets/units/greek/stable/construction-b.glb?url";
import constructionCUrl from "../../../assets/units/greek/stable/construction-c.glb?url";
import deathUrl from "../../../assets/units/greek/stable/death.glb?url";
import flagUrl from "../../../assets/units/greek/stable/flag.glb?url";
import iconUrl from "../../../assets/units/greek/stable/icon.png";
import idleUrl from "../../../assets/units/greek/stable/idle.glb?url";
import longBrickUrl from "../../../assets/units/greek/stable/long-brick.glb?url";
import mediumBrickUrl from "../../../assets/units/greek/stable/medium-brick.glb?url";
import smallBrickUrl from "../../../assets/units/greek/stable/small-brick.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const constructionBricks = [
  {
    model: "greekStableLongBrick",
    targetNode: "Dummy_attachpoint",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekStableLongBrick",
    targetNode: "Dummy_face",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekStableMediumBrick",
    targetNode: "Dummy_chin",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekStableMediumBrick",
    targetNode: "Dummy_leftfoot",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekStableSmallBrick",
    targetNode: "Dummy_lefthand",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekStableSmallBrick",
    targetNode: "Dummy_leftleg",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_GREEK_STABLE,
  key: "greek-stable",
  presentation: {
    kind: "model",
    worldHeight: 4.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekStableIdle"]),
      construction: loop(
        ["greekStableConstructionA", "greekStableConstructionB", "greekStableConstructionC"],
        "construction-stage",
      ),
      death: once(["greekStableDeath"]),
    },
  },
  models: [
    {
      key: "greekStableIdle",
      url: idleUrl,
      grounded: true,
      attachments: [
        {
          model: "greekStableFlag",
          targetNode: "Dummy_attachpoint",
          hotspotNode: "Dummy_hotspot",
        },
      ],
    },
    {
      key: "greekStableConstructionA",
      url: constructionAUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    {
      key: "greekStableConstructionB",
      url: constructionBUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    {
      key: "greekStableConstructionC",
      url: constructionCUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    { key: "greekStableDeath", url: deathUrl, grounded: true },
    { key: "greekStableFlag", url: flagUrl, grounded: false },
    { key: "greekStableLongBrick", url: longBrickUrl, grounded: false },
    { key: "greekStableMediumBrick", url: mediumBrickUrl, grounded: false },
    { key: "greekStableSmallBrick", url: smallBrickUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.stable, death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
