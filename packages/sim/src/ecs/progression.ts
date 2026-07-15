// Stable progression ids are shared by world state, content requirements,
// snapshots, and future age-up commands.
export const AGE_ARCHAIC = 0;
export const AGE_CLASSICAL = 1;
export const AGE_HEROIC = 2;
export const AGE_MYTHIC = 3;
export const AGE_COUNT = 4;
export const AGE_NAMES = ["Archaic Age", "Classical Age", "Heroic Age", "Mythic Age"] as const;

// The first progression slice is Greek and defaults to Zeus. Major and minor
// gods share one stable id space for future prerequisite checks.
export const GOD_ZEUS = 0;
export const GOD_POSEIDON = 1;
export const GOD_HADES = 2;
export const GOD_ATHENA = 3;
export const GOD_HERMES = 4;
export const NO_GOD = 255;

export const NO_AGE = 255;
