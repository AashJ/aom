import ambientBirdUrl from "../assets/audio/ambient/ambientbird.wav";
import ambientWindUrl from "../assets/audio/ambient/ambientwind.wav";
import ambientWoodsUrl from "../assets/audio/ambient/ambientwoods.wav";
import battleIWishUrl from "../assets/audio/music/IWISHI_1.mp3";
import battleOiThatPopsUrl from "../assets/audio/music/OI_THA_1.mp3";
import battleRotLoafUrl from "../assets/audio/music/ROTLOA_1.mp3";
import battleFireBrigadeUrl from "../assets/audio/music/THEFIR_1.mp3";
import peacefulBeholdUrl from "../assets/audio/music/BEHOLD_1.mp3";
import peacefulPotatoesUrl from "../assets/audio/music/EATYOU_1.mp3";
import peacefulFlavorCatsUrl from "../assets/audio/music/FLAVOR_1.mp3";
import greekCultureUrl from "../assets/audio/music/GREEKT_1.mp3";
import egyptianCultureUrl from "../assets/audio/music/NDNILE_1.mp3";
import peacefulSlacksUrl from "../assets/audio/music/NEVERM_1.mp3";
import peacefulBalladUrl from "../assets/audio/music/THEBAL_1.mp3";
import peacefulSlaysenfliteUrl from "../assets/audio/music/_FINEL_1.mp3";
import barracksUrl from "../assets/audio/ui/barracks.wav";
import houseUrl from "../assets/audio/ui/house.wav";
import interfaceClickUrl from "../assets/audio/ui/interface_click.wav";
import loseUrl from "../assets/audio/ui/lose.wav";
import settlementUrl from "../assets/audio/ui/settlement.wav";
import winUrl from "../assets/audio/ui/win.wav";
import villagerAttackUrl from "../assets/audio/units/gvma.wav";
import villagerForageUrl from "../assets/audio/units/gvmfo.wav";
import villagerLumberUrl from "../assets/audio/units/gvml.wav";
import villagerMineUrl from "../assets/audio/units/gvmm.wav";
import villagerAcknowledge1Url from "../assets/audio/units/gvmm1.wav";
import villagerAcknowledge2Url from "../assets/audio/units/gvmm2.wav";
import villagerAcknowledge3Url from "../assets/audio/units/gvmm3.wav";
import villagerAcknowledge4Url from "../assets/audio/units/gvmm4.wav";
import villagerRepairUrl from "../assets/audio/units/gvmr.wav";
import villagerSelect1Url from "../assets/audio/units/gvms1.wav";
import villagerSelect2Url from "../assets/audio/units/gvms2.wav";
import villagerSelect3Url from "../assets/audio/units/gvms3.wav";
import villagerSelect4Url from "../assets/audio/units/gvms4.wav";
import egyptianVillagerAttackUrl from "../assets/audio/units/evma.wav";
import egyptianVillagerForageUrl from "../assets/audio/units/evmfo.wav";
import egyptianVillagerLumberUrl from "../assets/audio/units/evml.wav";
import egyptianVillagerMineUrl from "../assets/audio/units/evmm.wav";
import egyptianVillagerAcknowledge1Url from "../assets/audio/units/evmm1.wav";
import egyptianVillagerAcknowledge2Url from "../assets/audio/units/evmm2.wav";
import egyptianVillagerAcknowledge3Url from "../assets/audio/units/evmm3.wav";
import egyptianVillagerAcknowledge4Url from "../assets/audio/units/evmm4.wav";
import egyptianVillagerRepairUrl from "../assets/audio/units/evmr.wav";
import egyptianVillagerSelect1Url from "../assets/audio/units/evms1.wav";
import egyptianVillagerSelect2Url from "../assets/audio/units/evms2.wav";
import egyptianVillagerSelect3Url from "../assets/audio/units/evms3.wav";
import egyptianVillagerSelect4Url from "../assets/audio/units/evms4.wav";
import maleDeath1Url from "../assets/audio/units/maledie1.wav";
import maleDeath2Url from "../assets/audio/units/maledie2.wav";
import maleDeath3Url from "../assets/audio/units/maledie3.wav";
import maleDeath4Url from "../assets/audio/units/maledie4.wav";
import maleDeath5Url from "../assets/audio/units/maledie5.wav";
import maleDeath6Url from "../assets/audio/units/maledie6.wav";
import militaryCreateUrl from "../assets/audio/units/militarycreate.wav";
import villagerCreateUrl from "../assets/audio/units/villagercreate.wav";
import build1Url from "../assets/audio/world/build1.wav";
import build2Url from "../assets/audio/world/build2.wav";
import build3Url from "../assets/audio/world/build3.wav";
import build4Url from "../assets/audio/world/build4.wav";
import build5Url from "../assets/audio/world/build5.wav";
import buildingDeathUrl from "../assets/audio/world/buildingdeath.wav";
import forage1Url from "../assets/audio/world/meatgather1.wav";
import forage2Url from "../assets/audio/world/meatgather2.wav";
import mine1Url from "../assets/audio/world/mine1.wav";
import mine2Url from "../assets/audio/world/mine2.wav";
import mine3Url from "../assets/audio/world/mine3.wav";
import swing1Url from "../assets/audio/world/swing1.wav";
import swing2Url from "../assets/audio/world/swing2.wav";
import swing3Url from "../assets/audio/world/swing3.wav";
import fleshHit1Url from "../assets/audio/world/swordonflesh1.wav";
import fleshHit2Url from "../assets/audio/world/swordonflesh2.wav";
import fleshHit3Url from "../assets/audio/world/swordonflesh3.wav";
import fleshHit4Url from "../assets/audio/world/swordonflesh4.wav";
import woodHit1Url from "../assets/audio/world/swordonwood1.wav";
import woodHit2Url from "../assets/audio/world/swordonwood2.wav";
import woodHit3Url from "../assets/audio/world/swordonwood3.wav";
import woodHit4Url from "../assets/audio/world/swordonwood4.wav";
import woodHit5Url from "../assets/audio/world/swordonwood5.wav";
import treeFall1Url from "../assets/audio/world/treefall.wav";
import treeFall2Url from "../assets/audio/world/treefall2.wav";
import treeFall3Url from "../assets/audio/world/treefall3.wav";
import chop1Url from "../assets/audio/world/woodchop1.wav";
import chop2Url from "../assets/audio/world/woodchop2.wav";
import chop3Url from "../assets/audio/world/woodchop3.wav";

export interface AudioCue {
  files: readonly string[];
  volume: number;
  maxVoices: number;
}

function cue(files: readonly string[], volume: number, maxVoices = 3): AudioCue {
  return { files, volume, maxVoices };
}

// These groupings and relative levels mirror the Classic trial's soundsets.xml.
export const AUDIO_CUES = {
  ambient: cue([ambientBirdUrl, ambientWindUrl, ambientWoodsUrl], 0.18, 1),
  barracks: cue([barracksUrl], 1, 1),
  build: cue([build1Url, build2Url, build3Url, build4Url, build5Url], 0.3),
  buildingDeath: cue([buildingDeathUrl], 0.9, 1),
  chop: cue([chop1Url, chop2Url, chop3Url], 0.4),
  defeat: cue([loseUrl], 1, 1),
  fleshHit: cue([fleshHit1Url, fleshHit2Url, fleshHit3Url, fleshHit4Url], 0.4, 1),
  forage: cue([forage1Url, forage2Url], 0.15),
  house: cue([houseUrl], 1, 1),
  interfaceClick: cue([interfaceClickUrl], 1, 2),
  maleDeath: cue(
    [maleDeath1Url, maleDeath2Url, maleDeath3Url, maleDeath4Url, maleDeath5Url, maleDeath6Url],
    0.75,
    2,
  ),
  militaryCreate: cue([militaryCreateUrl], 0.65, 1),
  mine: cue([mine1Url, mine2Url, mine3Url], 0.5),
  settlement: cue([settlementUrl], 1, 1),
  swordSwing: cue([swing1Url, swing2Url, swing3Url], 0.7),
  treeFall: cue([treeFall1Url, treeFall2Url, treeFall3Url], 0.65, 1),
  victory: cue([winUrl], 1, 1),
  villagerAcknowledge: cue(
    [
      villagerAcknowledge1Url,
      villagerAcknowledge2Url,
      villagerAcknowledge3Url,
      villagerAcknowledge4Url,
    ],
    1,
    1,
  ),
  villagerAttack: cue([villagerAttackUrl], 0.85, 1),
  villagerCreate: cue([villagerCreateUrl], 0.65, 1),
  villagerForage: cue([villagerForageUrl], 1, 1),
  villagerLumber: cue([villagerLumberUrl], 1, 1),
  villagerMine: cue([villagerMineUrl], 1, 1),
  villagerRepair: cue([villagerRepairUrl], 1, 1),
  villagerSelect: cue(
    [villagerSelect1Url, villagerSelect2Url, villagerSelect3Url, villagerSelect4Url],
    1,
    1,
  ),
  woodHit: cue([woodHit1Url, woodHit2Url, woodHit3Url, woodHit4Url, woodHit5Url], 0.75, 3),
} as const;

export const EGYPTIAN_VILLAGER_CUES = {
  villagerAcknowledge: cue(
    [
      egyptianVillagerAcknowledge1Url,
      egyptianVillagerAcknowledge2Url,
      egyptianVillagerAcknowledge3Url,
      egyptianVillagerAcknowledge4Url,
    ],
    1,
    1,
  ),
  villagerAttack: cue([egyptianVillagerAttackUrl], 0.85, 1),
  villagerForage: cue([egyptianVillagerForageUrl], 1, 1),
  villagerLumber: cue([egyptianVillagerLumberUrl], 1, 1),
  villagerMine: cue([egyptianVillagerMineUrl], 1, 1),
  villagerRepair: cue([egyptianVillagerRepairUrl], 1, 1),
  villagerSelect: cue(
    [
      egyptianVillagerSelect1Url,
      egyptianVillagerSelect2Url,
      egyptianVillagerSelect3Url,
      egyptianVillagerSelect4Url,
    ],
    1,
    1,
  ),
} as const;

export const CULTURE_MUSIC_TRACKS = {
  egyptian: egyptianCultureUrl,
  greek: greekCultureUrl,
} as const;

export const MUSIC_TRACKS = {
  battle: [battleFireBrigadeUrl, battleOiThatPopsUrl, battleRotLoafUrl, battleIWishUrl],
  peaceful: [
    peacefulPotatoesUrl,
    peacefulSlacksUrl,
    peacefulFlavorCatsUrl,
    peacefulSlaysenfliteUrl,
    peacefulBalladUrl,
    peacefulBeholdUrl,
  ],
} as const;
