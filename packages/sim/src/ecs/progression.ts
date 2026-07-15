// Stable progression ids are shared by world state, content requirements,
// snapshots, and future age-up commands.
export const AGE_ARCHAIC = 0;
export const AGE_CLASSICAL = 1;
export const AGE_HEROIC = 2;
export const AGE_MYTHIC = 3;
export const AGE_COUNT = 4;
export const AGE_NAMES = ["Archaic Age", "Classical Age", "Heroic Age", "Mythic Age"] as const;

// Major and minor gods share one stable id space for prerequisite checks and
// culture-specific presentation.
export const GOD_ZEUS = 0;
export const GOD_POSEIDON = 1;
export const GOD_HADES = 2;
export const GOD_ATHENA = 3;
export const GOD_HERMES = 4;
export const GOD_RA = 5;
export const GOD_BAST = 6;
export const GOD_PTAH = 7;
export const GOD_ARES = 8;
export const GOD_APOLLO = 9;
export const GOD_DIONYSUS = 10;
export const GOD_APHRODITE = 11;
export const GOD_ARTEMIS = 12;
export const GOD_HEPHAESTUS = 13;
export const GOD_HERA = 14;
export const GOD_ISIS = 15;
export const GOD_SET = 16;
export const GOD_ANUBIS = 17;
export const GOD_THOTH = 18;
export const GOD_SEKHMET = 19;
export const GOD_HATHOR = 20;
export const GOD_NEPHTHYS = 21;
export const GOD_OSIRIS = 22;
export const GOD_HORUS = 23;
export const NO_GOD = 255;

export const NO_AGE = 255;
