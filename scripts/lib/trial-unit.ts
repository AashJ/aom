import type { XmbNode } from "./xmb";

export type TrialAttackActionName = "HandAttack" | "RangedAttack" | "Gore";

export interface TrialActionReader {
  readonly parameters: readonly XmbNode[];
  numericParameter(name: string, type?: string): number;
}

export function readTrialAction(
  unit: XmbNode,
  actionName: TrialAttackActionName,
): TrialActionReader {
  const action = unit.children.find(
    (candidate) => candidate.name === "action" && candidate.attributes.name === actionName,
  );
  if (action === undefined) throw new Error(`${unit.attributes.name} has no Trial ${actionName}.`);
  const parameters = action.children.filter((candidate) => candidate.name === "param");

  return {
    parameters,
    numericParameter(name, type) {
      const parameter = parameters.find(
        (candidate) =>
          candidate.attributes.name === name &&
          (type === undefined || candidate.attributes.type === type),
      );
      const value = Number(parameter?.attributes.value1);
      if (parameter === undefined || !Number.isFinite(value)) {
        const descriptor = type === undefined ? name : `${name} ${type}`;
        throw new Error(`${unit.attributes.name} has no numeric ${descriptor}.`);
      }
      return value;
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function animationTagFraction(source: string, action: string, tag: string): number {
  const actionStart = source.search(new RegExp(`\\banim\\s+${escapeRegExp(action)}\\b`, "i"));
  const openBrace = source.indexOf("{", actionStart);
  if (actionStart < 0 || openBrace < 0) throw new Error(`No ${action} animation.`);

  let depth = 0;
  let closeBrace = -1;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        closeBrace = index;
        break;
      }
    }
  }
  if (closeBrace < 0) throw new Error(`Unterminated ${action} animation.`);
  const body = source.slice(openBrace, closeBrace + 1);
  const match = body.match(
    new RegExp(`\\btag\\s+${escapeRegExp(tag)}\\s+([0-9.]+)\\s+true\\b`, "i"),
  );
  const fraction = Number(match?.[1]);
  if (!Number.isFinite(fraction)) throw new Error(`${action} has no repeating ${tag} tag.`);
  return fraction;
}
