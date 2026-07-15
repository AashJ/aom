import { describe, expect, test } from "bun:test";
import { animationTagFraction, readTrialAction } from "./trial-unit";
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
            attributes: { name: "Damage", type: "Pierce", value1: "6.5" },
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
    expect(() => action.numericParameter("Damage", "Hack")).toThrow(
      "Toxotes has no numeric Damage Hack.",
    );
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
