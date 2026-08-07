import { TYPE_GREEK_TITAN } from "../../unit-type-ids";
import { CULTURE_GREEK } from "../../unit-type-schema";
import { titanDefinition } from "../../titan-definition";

export const definition = titanDefinition({
  id: TYPE_GREEK_TITAN,
  key: "greek-titan",
  label: "Greek Titan",
  culture: CULTURE_GREEK,
});
