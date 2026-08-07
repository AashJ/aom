import { describe, expect, test } from "bun:test";
import { TYPE_PETSUCHOS } from "@aom/sim";
import { BEAM_PRESENTATIONS } from "../content/generated/unit-media";
import { beamPresentationActive } from "./beam-renderer";

describe("beam presentation", () => {
  test("starts at the source Attack tag and ends with the charging cycle", () => {
    const definition = BEAM_PRESENTATIONS[TYPE_PETSUCHOS];
    expect(definition).toBeDefined();
    expect(beamPresentationActive(definition!, 34, 0)).toBe(false);
    expect(beamPresentationActive(definition!, 33, 0)).toBe(true);
    expect(beamPresentationActive(definition!, 1, 0.5)).toBe(true);
    expect(beamPresentationActive(definition!, 0, 0)).toBe(false);
  });
});
