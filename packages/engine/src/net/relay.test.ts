import { describe, expect, test } from "bun:test";
import {
  CHEAT_ADD_FOOD,
  COMMAND_ADVANCE_AGE,
  COMMAND_CHEAT,
  COMMAND_MOVE,
  COMMAND_STOP,
  GOD_HERMES,
} from "@aom/sim";
import { PROTOCOL_VERSION, type ClientMessage } from "@aom/relay";
import { createRelaySink } from "./relay";

describe("relay sink", () => {
  test("submitMove sends one versioned, tickless commands message", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((m) => sent.push(m));

    sink.submitMove([3, 7], 120.5, 88);

    expect(sent.length).toBe(1);
    expect(sent[0]).toEqual({
      v: PROTOCOL_VERSION,
      kind: "commands",
      commands: [{ type: COMMAND_MOVE, unitIds: [3, 7], targetX: 120.5, targetZ: 88 }],
    });
    // The wire command must NOT carry an execution tick — the sequencer's turn
    // assignment is the only clock a client is allowed to trust.
    expect("tick" in (sent[0] as { commands: object[] }).commands[0]!).toBe(false);
  });

  test("submitStop sends the stop shape through the same channel", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((m) => sent.push(m));

    sink.submitStop([1]);

    expect(sent.length).toBe(1);
    expect(sent[0]).toEqual({
      v: PROTOCOL_VERSION,
      kind: "commands",
      commands: [{ type: COMMAND_STOP, unitIds: [1] }],
    });
  });

  test("submitAdvanceAge sends the tickless Town Center and minor-god choice", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitAdvanceAge(17, GOD_HERMES);

    expect(sent[0]).toEqual({
      v: PROTOCOL_VERSION,
      kind: "commands",
      commands: [{ type: COMMAND_ADVANCE_AGE, buildingId: 17, minorGod: GOD_HERMES }],
    });
  });

  test("submitCheat sends the tickless numeric cheat id", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitCheat(CHEAT_ADD_FOOD);

    expect(sent[0]).toEqual({
      v: PROTOCOL_VERSION,
      kind: "commands",
      commands: [{ type: COMMAND_CHEAT, cheat: CHEAT_ADD_FOOD }],
    });
  });
});
