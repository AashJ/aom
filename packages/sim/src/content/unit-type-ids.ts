// Explicit, append-only ids. File order never determines gameplay identity.
// Retired pre-M11 generic ids remain permanently unavailable so stable identity is
// append-only. Runtime content uses culture-specific ids and exposes no aliases.
export const TYPE_MILITIA = 1;
export const TYPE_TREE = 2;
export const TYPE_BERRY = 3;
export const TYPE_GOLD_MINE = 7;
export const TYPE_RELIC = 8;

// Greek and Egyptian playable-roster reservations. Definitions land independently.
export const TYPE_GREEK_VILLAGER = 16;
export const TYPE_EGYPTIAN_LABORER = 17;
export const TYPE_GREEK_TOWN_CENTER = 18;
export const TYPE_EGYPTIAN_TOWN_CENTER = 19;
export const TYPE_GREEK_HOUSE = 20;
export const TYPE_EGYPTIAN_HOUSE = 21;
export const TYPE_GREEK_MILITARY_ACADEMY = 22;
export const TYPE_EGYPTIAN_BARRACKS = 23;
export const TYPE_GREEK_ARCHERY_RANGE = 24;
export const TYPE_GREEK_STABLE = 25;
export const TYPE_GREEK_FORTRESS = 26;
export const TYPE_GREEK_DOCK = 27;
export const TYPE_GREEK_MARKET = 28;
export const TYPE_EGYPTIAN_TEMPLE = 29;
export const TYPE_EGYPTIAN_MIGDOL_STRONGHOLD = 30;
export const TYPE_EGYPTIAN_SIEGE_WORKS = 31;
export const TYPE_EGYPTIAN_DOCK = 32;
export const TYPE_EGYPTIAN_MARKET = 33;
export const TYPE_GREEK_TEMPLE = 34;

export const TYPE_HOPLITE = 64;
export const TYPE_HYPASPIST = 65;
export const TYPE_HIPPIKON = 66;
export const TYPE_PRODROMOS = 67;
export const TYPE_MYRMIDON = 68;
export const TYPE_SPEARMAN = 69;
export const TYPE_AXEMAN = 70;
export const TYPE_CAMELRY = 71;
export const TYPE_WAR_ELEPHANT = 72;

export const TYPE_KATASKOPOS = 80;
export const TYPE_TOXOTES = 81;
export const TYPE_PELTAST = 82;
export const TYPE_GASTRAPHETES = 83;
export const TYPE_HETAIROI = 84;
export const TYPE_PETROBOLOS = 85;
export const TYPE_HELEPOLIS = 86;
export const TYPE_GREEK_CARAVAN = 87;
export const TYPE_GREEK_FISHING_SHIP = 88;
export const TYPE_GREEK_TRANSPORT_SHIP = 89;
export const TYPE_TRIREME = 90;
export const TYPE_PENTEKONTER = 91;
export const TYPE_JUGGERNAUT = 92;

export const TYPE_JASON = 96;
export const TYPE_ODYSSEUS = 97;
export const TYPE_HERACLES = 98;
export const TYPE_BELLEROPHON = 99;
export const TYPE_THESEUS = 100;
export const TYPE_HIPPOLYTA = 101;
export const TYPE_ATALANTA = 102;
export const TYPE_POLYPHEMUS = 103;
export const TYPE_AJAX = 104;
export const TYPE_CHIRON = 105;
export const TYPE_ACHILLES = 106;
export const TYPE_PERSEUS = 107;

export const TYPE_PEGASUS = 112;
export const TYPE_MINOTAUR = 113;
export const TYPE_CENTAUR = 114;
export const TYPE_CYCLOPS = 115;
export const TYPE_NEMEAN_LION = 116;
export const TYPE_MANTICORE = 117;
export const TYPE_HYDRA = 118;
export const TYPE_SCYLLA = 119;
export const TYPE_MEDUSA = 120;
export const TYPE_COLOSSUS = 121;
export const TYPE_CHIMERA = 122;
export const TYPE_CARCINOS = 123;
export const TYPE_GREEK_TITAN = 124;

export const TYPE_SLINGER = 128;
export const TYPE_CHARIOT_ARCHER = 129;
export const TYPE_SIEGE_TOWER = 131;
export const TYPE_CATAPULT = 132;
export const TYPE_MERCENARY = 133;
export const TYPE_EGYPTIAN_CARAVAN = 134;
export const TYPE_EGYPTIAN_FISHING_SHIP = 135;
export const TYPE_EGYPTIAN_TRANSPORT_SHIP = 136;
export const TYPE_KEBENIT = 137;
export const TYPE_RAMMING_GALLEY = 138;
export const TYPE_WAR_BARGE = 139;
export const TYPE_PHARAOH = 140;
export const TYPE_PRIEST = 141;
export const TYPE_SON_OF_OSIRIS = 142;

export const TYPE_ANUBITE = 144;
export const TYPE_SPHINX = 145;
export const TYPE_WADJET = 146;
export const TYPE_PETSUCHOS = 147;
export const TYPE_ROC = 148;
export const TYPE_SCARAB = 149;
export const TYPE_MUMMY = 150;
export const TYPE_PHOENIX = 151;
export const TYPE_AVENGER = 152;
export const TYPE_SCORPION_MAN = 153;
export const TYPE_LEVIATHAN = 154;
export const TYPE_WAR_TURTLE = 155;
export const TYPE_EGYPTIAN_TITAN = 156;
export const TYPE_MERCENARY_CAVALRY = 157;

export const MAX_RESERVED_UNIT_TYPE_ID = TYPE_MERCENARY_CAVALRY;

// Every independently authored playable Greek/Egyptian unit lane. Workers,
// buildings, and resource nodes are shared foundation content rather than
// agentic unit packs. The canonical roster must cover this reservation exactly.
export const RESERVED_ROSTER_UNIT_TYPE_IDS = [
  TYPE_MILITIA,
  TYPE_HOPLITE,
  TYPE_HYPASPIST,
  TYPE_HIPPIKON,
  TYPE_PRODROMOS,
  TYPE_MYRMIDON,
  TYPE_SPEARMAN,
  TYPE_AXEMAN,
  TYPE_CAMELRY,
  TYPE_WAR_ELEPHANT,
  TYPE_KATASKOPOS,
  TYPE_TOXOTES,
  TYPE_PELTAST,
  TYPE_GASTRAPHETES,
  TYPE_HETAIROI,
  TYPE_PETROBOLOS,
  TYPE_HELEPOLIS,
  TYPE_GREEK_CARAVAN,
  TYPE_GREEK_FISHING_SHIP,
  TYPE_GREEK_TRANSPORT_SHIP,
  TYPE_TRIREME,
  TYPE_PENTEKONTER,
  TYPE_JUGGERNAUT,
  TYPE_JASON,
  TYPE_ODYSSEUS,
  TYPE_HERACLES,
  TYPE_BELLEROPHON,
  TYPE_THESEUS,
  TYPE_HIPPOLYTA,
  TYPE_ATALANTA,
  TYPE_POLYPHEMUS,
  TYPE_AJAX,
  TYPE_CHIRON,
  TYPE_ACHILLES,
  TYPE_PERSEUS,
  TYPE_PEGASUS,
  TYPE_MINOTAUR,
  TYPE_CENTAUR,
  TYPE_CYCLOPS,
  TYPE_NEMEAN_LION,
  TYPE_MANTICORE,
  TYPE_HYDRA,
  TYPE_SCYLLA,
  TYPE_MEDUSA,
  TYPE_COLOSSUS,
  TYPE_CHIMERA,
  TYPE_CARCINOS,
  TYPE_GREEK_TITAN,
  TYPE_SLINGER,
  TYPE_CHARIOT_ARCHER,
  TYPE_SIEGE_TOWER,
  TYPE_CATAPULT,
  TYPE_MERCENARY,
  TYPE_EGYPTIAN_CARAVAN,
  TYPE_EGYPTIAN_FISHING_SHIP,
  TYPE_EGYPTIAN_TRANSPORT_SHIP,
  TYPE_KEBENIT,
  TYPE_RAMMING_GALLEY,
  TYPE_WAR_BARGE,
  TYPE_PHARAOH,
  TYPE_PRIEST,
  TYPE_SON_OF_OSIRIS,
  TYPE_ANUBITE,
  TYPE_SPHINX,
  TYPE_WADJET,
  TYPE_PETSUCHOS,
  TYPE_ROC,
  TYPE_SCARAB,
  TYPE_MUMMY,
  TYPE_PHOENIX,
  TYPE_AVENGER,
  TYPE_SCORPION_MAN,
  TYPE_LEVIATHAN,
  TYPE_WAR_TURTLE,
  TYPE_EGYPTIAN_TITAN,
  TYPE_MERCENARY_CAVALRY,
] as const;
