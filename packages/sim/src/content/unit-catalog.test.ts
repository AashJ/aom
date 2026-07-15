import { describe, expect, test } from "bun:test";
import * as unitTypeIds from "./unit-type-ids";
import * as progressionIds from "../ecs/progression";
import {
  BUILD_OPTIONS_BY_WORKER,
  TRAIN_OPTIONS_BY_PRODUCER,
  UNIT_TYPE_DEFINITIONS,
  UNIT_TYPES,
} from "./generated/unit-types";
import {
  MAX_RESERVED_UNIT_TYPE_ID,
  TYPE_BERRY,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_LABORER,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TITAN,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GOLD_MINE,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MILITIA,
  TYPE_SPEARMAN,
  TYPE_TREE,
} from "./unit-type-ids";

describe("unit type catalog", () => {
  test("protects the complete Greek and Egyptian god id space", () => {
    const godIds = Object.entries(progressionIds)
      .filter(([key, value]) => key.startsWith("GOD_") && typeof value === "number")
      .sort(([, left], [, right]) => (left as number) - (right as number));

    expect(godIds.map(([key]) => key)).toEqual([
      "GOD_ZEUS",
      "GOD_POSEIDON",
      "GOD_HADES",
      "GOD_ATHENA",
      "GOD_HERMES",
      "GOD_RA",
      "GOD_BAST",
      "GOD_PTAH",
      "GOD_ARES",
      "GOD_APOLLO",
      "GOD_DIONYSUS",
      "GOD_APHRODITE",
      "GOD_ARTEMIS",
      "GOD_HEPHAESTUS",
      "GOD_HERA",
      "GOD_ISIS",
      "GOD_SET",
      "GOD_ANUBIS",
      "GOD_THOTH",
      "GOD_SEKHMET",
      "GOD_HATHOR",
      "GOD_NEPHTHYS",
      "GOD_OSIRIS",
      "GOD_HORUS",
    ]);
    expect(godIds.map(([, value]) => Number(value))).toEqual(
      Array.from({ length: 24 }, (_, id) => id),
    );
  });

  test("protects every reserved Greek and Egyptian id from accidental renumbering", () => {
    const reservationSnapshot = Object.entries(unitTypeIds)
      .filter(([key, value]) => key.startsWith("TYPE_") && typeof value === "number")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    expect(reservationSnapshot).toBe(`TYPE_ACHILLES=106
TYPE_AJAX=104
TYPE_ANUBITE=144
TYPE_ATALANTA=102
TYPE_AVENGER=152
TYPE_AXEMAN=70
TYPE_BELLEROPHON=99
TYPE_BERRY=3
TYPE_CAMELRY=71
TYPE_CARCINOS=123
TYPE_CATAPULT=132
TYPE_CENTAUR=114
TYPE_CHARIOT_ARCHER=129
TYPE_CHIMERA=122
TYPE_CHIRON=105
TYPE_COLOSSUS=121
TYPE_CYCLOPS=115
TYPE_EGYPTIAN_BARRACKS=23
TYPE_EGYPTIAN_CARAVAN=134
TYPE_EGYPTIAN_DOCK=32
TYPE_EGYPTIAN_FISHING_SHIP=135
TYPE_EGYPTIAN_HOUSE=21
TYPE_EGYPTIAN_LABORER=17
TYPE_EGYPTIAN_MARKET=33
TYPE_EGYPTIAN_MIGDOL_STRONGHOLD=30
TYPE_EGYPTIAN_SIEGE_WORKS=31
TYPE_EGYPTIAN_TEMPLE=29
TYPE_EGYPTIAN_TITAN=156
TYPE_EGYPTIAN_TOWN_CENTER=19
TYPE_EGYPTIAN_TRANSPORT_SHIP=136
TYPE_GASTRAPHETES=83
TYPE_GOLD_MINE=7
TYPE_GREEK_ARCHERY_RANGE=24
TYPE_GREEK_CARAVAN=87
TYPE_GREEK_DOCK=27
TYPE_GREEK_FISHING_SHIP=88
TYPE_GREEK_FORTRESS=26
TYPE_GREEK_HOUSE=20
TYPE_GREEK_MARKET=28
TYPE_GREEK_MILITARY_ACADEMY=22
TYPE_GREEK_STABLE=25
TYPE_GREEK_TEMPLE=34
TYPE_GREEK_TITAN=124
TYPE_GREEK_TOWN_CENTER=18
TYPE_GREEK_TRANSPORT_SHIP=89
TYPE_GREEK_VILLAGER=16
TYPE_HELEPOLIS=86
TYPE_HERACLES=98
TYPE_HETAIROI=84
TYPE_HIPPIKON=66
TYPE_HIPPOLYTA=101
TYPE_HOPLITE=64
TYPE_HYDRA=118
TYPE_HYPASPIST=65
TYPE_JASON=96
TYPE_JUGGERNAUT=92
TYPE_KATASKOPOS=80
TYPE_KEBENIT=137
TYPE_LEVIATHAN=154
TYPE_MANTICORE=117
TYPE_MEDUSA=120
TYPE_MERCENARY=133
TYPE_MERCENARY_CAVALRY=157
TYPE_MILITIA=1
TYPE_MINOTAUR=113
TYPE_MUMMY=150
TYPE_MYRMIDON=68
TYPE_NEMEAN_LION=116
TYPE_ODYSSEUS=97
TYPE_PEGASUS=112
TYPE_PELTAST=82
TYPE_PENTEKONTER=91
TYPE_PERSEUS=107
TYPE_PETROBOLOS=85
TYPE_PETSUCHOS=147
TYPE_PHARAOH=140
TYPE_PHOENIX=151
TYPE_POLYPHEMUS=103
TYPE_PRIEST=141
TYPE_PRODROMOS=67
TYPE_RAMMING_GALLEY=138
TYPE_ROC=148
TYPE_SCARAB=149
TYPE_SCORPION_MAN=153
TYPE_SCYLLA=119
TYPE_SIEGE_TOWER=131
TYPE_SLINGER=128
TYPE_SON_OF_OSIRIS=142
TYPE_SPEARMAN=69
TYPE_SPHINX=145
TYPE_THESEUS=100
TYPE_TOXOTES=81
TYPE_TREE=2
TYPE_TRIREME=90
TYPE_WADJET=146
TYPE_WAR_BARGE=139
TYPE_WAR_ELEPHANT=72
TYPE_WAR_TURTLE=155`);
  });

  test("keeps current and Gate A identity reservations stable", () => {
    expect([
      TYPE_MILITIA,
      TYPE_TREE,
      TYPE_BERRY,
      TYPE_GOLD_MINE,
      TYPE_GREEK_VILLAGER,
      TYPE_EGYPTIAN_LABORER,
      TYPE_GREEK_TOWN_CENTER,
      TYPE_EGYPTIAN_TOWN_CENTER,
      TYPE_GREEK_HOUSE,
      TYPE_EGYPTIAN_HOUSE,
      TYPE_GREEK_MILITARY_ACADEMY,
      TYPE_EGYPTIAN_BARRACKS,
      TYPE_EGYPTIAN_TEMPLE,
      TYPE_GREEK_TEMPLE,
      TYPE_HOPLITE,
      TYPE_SPEARMAN,
      TYPE_EGYPTIAN_TITAN,
    ]).toEqual([1, 2, 3, 7, 16, 17, 18, 19, 20, 21, 22, 23, 29, 34, 64, 69, 156]);
    expect(MAX_RESERVED_UNIT_TYPE_ID).toBeLessThan(0xffff);
  });

  test("emits implemented definitions once in numeric-id order", () => {
    const ids = UNIT_TYPE_DEFINITIONS.map((definition) => definition.id);
    const keys = UNIT_TYPE_DEFINITIONS.map((definition) => definition.key);

    expect(ids).toEqual([...ids].sort((left, right) => left - right));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of UNIT_TYPE_DEFINITIONS) {
      expect(UNIT_TYPES[definition.id]).toBe(definition);
    }
  });

  test("derives every producer and worker command from content-owned relationships", () => {
    for (const definition of UNIT_TYPE_DEFINITIONS) {
      for (const relationship of definition.trainedAt) {
        expect(TRAIN_OPTIONS_BY_PRODUCER[relationship.type]).toContainEqual({
          type: definition.id,
          commandSlot: relationship.commandSlot,
        });
      }

      for (const relationship of definition.builtBy) {
        expect(BUILD_OPTIONS_BY_WORKER[relationship.type]).toContainEqual({
          type: definition.id,
          commandSlot: relationship.commandSlot,
        });
      }
    }
  });
});
