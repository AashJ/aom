import { describe, expect, test } from "bun:test";
import { animationTagFraction, animationTagFractions, readTrialAction } from "./trial-unit";
import type { XmbNode } from "./xmb";

function unitWithAction(): XmbNode {
  return {
    name: "unit",
    value: "",
    attributes: { name: "Toxotes" },
    children: [
      {
        name: "action",
        value: "",
        attributes: { name: "RangedAttack" },
        children: [
          {
            name: "param",
            value: "",
            attributes: { name: "Damage", type: "Pierce", value1: "6.5", value2: "10" },
            children: [],
          },
        ],
      },
    ],
  };
}

describe("Trial unit source readers", () => {
  test("reads one authored action and its typed numeric parameters", () => {
    const action = readTrialAction(unitWithAction(), "RangedAttack");
    expect(action.numericParameter("Damage", "Pierce")).toBe(6.5);
    expect(action.numericParameter2("Damage", "Pierce")).toBe(10);
    expect(() => action.numericParameter("Damage", "Hack")).toThrow(
      "Toxotes has no numeric Damage Hack.",
    );
    expect(() => action.numericParameter2("Damage", "Hack")).toThrow(
      "Toxotes has no second numeric Damage Hack.",
    );
  });

  test("preserves every repeated tag used by variable attack cycles", () => {
    const source = `
      anim attack {
        tag Attack 0.46 true
        tag Attack 0.43 true
      }
    `;
    expect(animationTagFractions(source, "attack", "Attack")).toEqual([0.46, 0.43]);
  });

  test("scopes an animation tag to the requested balanced action", () => {
    const source = `
      anim Idle { tag Attack 0.1 true }
      anim RangedAttack {
        nested { value 1 }
        tag Attack 0.4 true
      }
      anim Death { tag Attack 0.9 true }
    `;
    expect(animationTagFraction(source, "RangedAttack", "Attack")).toBe(0.4);
  });

  test("rejects missing tags and unterminated action blocks", () => {
    expect(() =>
      animationTagFraction("anim RangedAttack { value 1 }", "RangedAttack", "Attack"),
    ).toThrow("RangedAttack has no repeating Attack tag.");
    expect(() => animationTagFraction("anim RangedAttack {", "RangedAttack", "Attack")).toThrow(
      "Unterminated RangedAttack animation.",
    );
  });
});
