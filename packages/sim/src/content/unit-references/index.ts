import { UNIT_ROSTER } from "../unit-roster";
import { validateUnitReferences, type UnitReferenceSpec } from "../unit-reference-schema";
import { GATE_A_UNIT_REFERENCES } from "./gate-a";
import { GATE_B_UNIT_REFERENCES } from "./gate-b";
import { GATE_C_UNIT_REFERENCES } from "./gate-c";
import { GATE_C_MYTH_UNIT_REFERENCES } from "./gate-c-myth";

export const UNIT_REFERENCE_SPECS = [
  ...GATE_A_UNIT_REFERENCES,
  ...GATE_B_UNIT_REFERENCES,
  ...GATE_C_UNIT_REFERENCES,
  ...GATE_C_MYTH_UNIT_REFERENCES,
] as const satisfies readonly UnitReferenceSpec[];

validateUnitReferences(UNIT_ROSTER, UNIT_REFERENCE_SPECS);

const referencesByKey = new Map<string, UnitReferenceSpec>(
  UNIT_REFERENCE_SPECS.map((reference) => [reference.key, reference]),
);

export function unitReferenceEntry(key: string): UnitReferenceSpec | undefined {
  return referencesByKey.get(key);
}

export { GATE_A_UNIT_REFERENCES } from "./gate-a";
export { GATE_B_UNIT_REFERENCES } from "./gate-b";
export { GATE_C_UNIT_REFERENCES } from "./gate-c";
export { GATE_C_MYTH_UNIT_REFERENCES } from "./gate-c-myth";
