import { TYPE_GREEK_FORTRESS } from "@aom/sim";
import constructionAUrl from "../../../assets/units/greek/fortress/construction-a.glb?url";
import constructionBUrl from "../../../assets/units/greek/fortress/construction-b.glb?url";
import constructionCUrl from "../../../assets/units/greek/fortress/construction-c.glb?url";
import cypressUrl from "../../../assets/units/greek/fortress/cypress.glb?url";
import deathUrl from "../../../assets/units/greek/fortress/death.glb?url";
import iconUrl from "../../../assets/units/greek/fortress/icon.png";
import idleUrl from "../../../assets/units/greek/fortress/idle.glb?url";
import longBrickUrl from "../../../assets/units/greek/fortress/long-brick.glb?url";
import mediumBrickUrl from "../../../assets/units/greek/fortress/medium-brick.glb?url";
import smallBrickUrl from "../../../assets/units/greek/fortress/small-brick.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const constructionBricks = [
  {
    model: "greekFortressLongBrick",
    targetNode: "Dummy_attachpoint",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekFortressLongBrick",
    targetNode: "Dummy_face",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekFortressMediumBrick",
    targetNode: "Dummy_chin",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekFortressMediumBrick",
    targetNode: "Dummy_leftfoot",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekFortressSmallBrick",
    targetNode: "Dummy_lefthand",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "greekFortressSmallBrick",
    targetNode: "Dummy_leftleg",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_GREEK_FORTRESS,
  key: "greek-fortress",
  presentation: {
    kind: "model",
    worldHeight: 5.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekFortressIdle"]),
      construction: loop(
        ["greekFortressConstructionA", "greekFortressConstructionB", "greekFortressConstructionC"],
        "construction-stage",
      ),
      death: once(["greekFortressDeath"]),
    },
  },
  models: [
    {
      key: "greekFortressIdle",
      url: idleUrl,
      grounded: true,
      attachments: [
        {
          model: "greekFortressCypress",
          targetNode: "Dummy_leftfoot",
          hotspotNode: "Dummy_hotspot",
        },
        {
          model: "greekFortressCypress",
          targetNode: "Dummy_rightfoot",
          hotspotNode: "Dummy_hotspot",
        },
      ],
    },
    {
      key: "greekFortressConstructionA",
      url: constructionAUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    {
      key: "greekFortressConstructionB",
      url: constructionBUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    {
      key: "greekFortressConstructionC",
      url: constructionCUrl,
      grounded: true,
      attachments: constructionBricks,
    },
    { key: "greekFortressDeath", url: deathUrl, grounded: true },
    { key: "greekFortressCypress", url: cypressUrl, grounded: false },
    { key: "greekFortressLongBrick", url: longBrickUrl, grounded: false },
    { key: "greekFortressMediumBrick", url: mediumBrickUrl, grounded: false },
    { key: "greekFortressSmallBrick", url: smallBrickUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.fortress, death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
