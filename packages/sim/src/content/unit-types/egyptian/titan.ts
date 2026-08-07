import { TYPE_EGYPTIAN_TITAN } from "../../unit-type-ids";
import { CULTURE_EGYPTIAN, UNIT_CLASS_NON_GREEK_UNIT } from "../../unit-type-schema";
import { titanDefinition } from "../../titan-definition";

export const definition = titanDefinition({
  id: TYPE_EGYPTIAN_TITAN,
  key: "egyptian-titan",
  label: "Egyptian Titan",
  culture: CULTURE_EGYPTIAN,
  additionalClasses: UNIT_CLASS_NON_GREEK_UNIT,
});
