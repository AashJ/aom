import {
  PROJECTILE_ARROW,
  PROJECTILE_BALLISTA_BOLT,
  PROJECTILE_CATAPULT_STONE,
  PROJECTILE_CHIMERA_FIRE,
  PROJECTILE_MANTICORE_BARB,
  PROJECTILE_MUMMY_FLIES,
  PROJECTILE_PRIEST,
  PROJECTILE_PETROBOLOS_STONE,
  PROJECTILE_SLING_STONE,
  PROJECTILE_SPEAR,
  PROJECTILE_WADJET_SPIT,
} from "@aom/sim";
import arrowUrl from "../assets/projectiles/arrow.glb?url";
import ballistaBoltUrl from "../assets/projectiles/ballista-bolt.glb?url";
import arrow1Url from "../assets/projectiles/arrow1.wav";
import arrow2Url from "../assets/projectiles/arrow2.wav";
import arrow3Url from "../assets/projectiles/arrow3.wav";
import arrow4Url from "../assets/projectiles/arrow4.wav";
import arrow5Url from "../assets/projectiles/arrow5.wav";
import catapultAUrl from "../assets/projectiles/catapult-a.glb?url";
import catapultBUrl from "../assets/projectiles/catapult-b.glb?url";
import catapultCUrl from "../assets/projectiles/catapult-c.glb?url";
import catapultAttackUrl from "../assets/projectiles/catapult-attack.wav";
import manticoreBarbsUrl from "../assets/projectiles/manticore-barbs.glb?url";
import manticoreSpecialUrl from "../assets/projectiles/manticore-special.wav";
import mummyFliesUrl from "../assets/projectiles/mummy-flies.png";
import petrobolosAUrl from "../assets/projectiles/petrobolos-a.glb?url";
import petrobolosBUrl from "../assets/projectiles/petrobolos-b.glb?url";
import petrobolosCUrl from "../assets/projectiles/petrobolos-c.glb?url";
import petrobolosAttackUrl from "../assets/projectiles/petrobolos-attack.wav";
import javelinUrl from "../assets/projectiles/javelin.glb?url";
import slingStoneUrl from "../assets/projectiles/sling-stone.glb?url";
import wadjetSpitUrl from "../assets/units/egyptian/wadjet/spit.png";
import wadjetSpitAudioUrl from "../assets/units/egyptian/wadjet/wadjetspit.wav";
import type { ProjectileMediaDefinition } from "./unit-media-schema";

// Stable projectile presentation identities are shared infrastructure. Unit
// packs select one of these types; they never add renderer-side unit switches.
export const PROJECTILE_MEDIA_DEFINITIONS = [
  {
    type: PROJECTILE_ARROW,
    key: "arrow",
    kind: "model",
    models: [{ key: "projectileArrow", url: arrowUrl, grounded: false }],
    flightHeight: 1.15,
    arcHeight: 0.7,
    forwardAxis: "negative-z",
    audio: {
      files: [arrow1Url, arrow2Url, arrow3Url, arrow4Url, arrow5Url],
      volume: 0.3,
      maxVoices: 2,
    },
  },
  {
    type: PROJECTILE_SPEAR,
    key: "javelin",
    kind: "model",
    models: [{ key: "projectileJavelin", url: javelinUrl, grounded: false }],
    flightHeight: 1.1,
    arcHeight: 0.55,
    forwardAxis: "positive-y",
  },
  {
    type: PROJECTILE_SLING_STONE,
    key: "sling-stone",
    kind: "model",
    models: [{ key: "projectileSlingStone", url: slingStoneUrl, grounded: false }],
    flightHeight: 1,
    arcHeight: 0.8,
    forwardAxis: "positive-z",
  },
  {
    type: PROJECTILE_WADJET_SPIT,
    key: "wadjet-spit",
    kind: "particle",
    textureUrl: wadjetSpitUrl,
    flightHeight: 1.1,
    arcHeight: 0,
    blend: "normal",
    particleCount: 16,
    trailLength: 5,
    baseScale: 0.9,
    scaleStart: 0.5,
    scaleEnd: 1,
    peakOpacity: 1,
    audio: { files: [wadjetSpitAudioUrl], volume: 1, maxVoices: 3 },
  },
  {
    type: PROJECTILE_MANTICORE_BARB,
    key: "manticore-barb",
    kind: "model",
    models: [{ key: "projectileManticoreBarb", url: manticoreBarbsUrl, grounded: false }],
    flightHeight: 1.35,
    arcHeight: 0.45,
    forwardAxis: "negative-z",
    audio: { files: [manticoreSpecialUrl], volume: 0.3, maxVoices: 2 },
  },
  {
    type: PROJECTILE_CHIMERA_FIRE,
    key: "chimera-fire-invisible",
    kind: "invisible",
    flightHeight: 0,
    arcHeight: 0,
  },
  {
    type: PROJECTILE_PETROBOLOS_STONE,
    key: "petrobolos-stone",
    kind: "model",
    models: [
      { key: "projectilePetrobolosA", url: petrobolosAUrl, grounded: false },
      { key: "projectilePetrobolosB", url: petrobolosBUrl, grounded: false },
      { key: "projectilePetrobolosC", url: petrobolosCUrl, grounded: false },
    ],
    flightHeight: 1.65,
    arcHeight: 4.5,
    forwardAxis: "positive-z",
    audio: { files: [petrobolosAttackUrl], volume: 1, maxVoices: 2 },
  },
  {
    type: PROJECTILE_CATAPULT_STONE,
    key: "catapult-stone",
    kind: "model",
    models: [
      { key: "projectileCatapultA", url: catapultAUrl, grounded: false },
      { key: "projectileCatapultB", url: catapultBUrl, grounded: false },
      { key: "projectileCatapultC", url: catapultCUrl, grounded: false },
    ],
    flightHeight: 1.8,
    arcHeight: 5.5,
    forwardAxis: "positive-z",
    audio: { files: [catapultAttackUrl], volume: 0.9, maxVoices: 2 },
  },
  {
    type: PROJECTILE_BALLISTA_BOLT,
    key: "ballista-bolt",
    kind: "model",
    models: [{ key: "projectileBallistaBolt", url: ballistaBoltUrl, grounded: false }],
    flightHeight: 1.7,
    arcHeight: 0.45,
    forwardAxis: "positive-z",
  },
  {
    type: PROJECTILE_MUMMY_FLIES,
    key: "mummy-flies",
    kind: "particle",
    textureUrl: mummyFliesUrl,
    flightHeight: 1.45,
    arcHeight: 0,
    blend: "normal",
    particleCount: 10,
    trailLength: 5,
    baseScale: 0.8,
    scaleStart: 0.6,
    scaleEnd: 1,
    peakOpacity: 1,
  },
  {
    type: PROJECTILE_PRIEST,
    key: "priest-projectile-invisible",
    kind: "invisible",
    flightHeight: 0,
    arcHeight: 0,
  },
] as const satisfies readonly ProjectileMediaDefinition[];
