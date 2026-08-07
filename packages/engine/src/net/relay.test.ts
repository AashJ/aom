import { describe, expect, test } from "bun:test";
import {
  CHEAT_ADD_FOOD,
  COMMAND_ADVANCE_AGE,
  COMMAND_CHEAT,
  COMMAND_CANCEL_TRAIN,
  COMMAND_BUILD_GATE,
  COMMAND_MOVE,
  COMMAND_DROP_OFF_RELIC,
  COMMAND_GARRISON,
  COMMAND_PICK_UP_RELIC,
  COMMAND_PLACE,
  COMMAND_PLACE_WALL,
  COMMAND_PRAY,
  COMMAND_UNGARRISON,
  COMMAND_STOP,
  COMMAND_TRADE,
  COMMAND_TOWN_BELL,
  GOD_HERMES,
} from "@aom/sim";
import { PROTOCOL_VERSION, type ClientMessage } from "@aom/relay";
import { createRelaySink, getLobbyRole, relayUrlForRoom } from "./relay";

describe("multiplayer lobby role", () => {
  test("stays joining until the relay identifies this player", () => {
    expect(getLobbyRole([], -1)).toBe("joining");
    expect(getLobbyRole([{ id: 0, name: "host" }], -1)).toBe("joining");
  });

  test("assigns the lowest active player id as host", () => {
    const players = [
      { id: 3, name: "host" },
      { id: 7, name: "guest" },
    ];

    expect(getLobbyRole(players, 3)).toBe("host");
    expect(getLobbyRole(players, 7)).toBe("guest");
  });

  test("follows host migration in the rendered roster", () => {
    expect(getLobbyRole([{ id: 7, name: "new host" }], 7)).toBe("host");
  });
});

describe("relay connection URL", () => {
  test("routes the WebSocket to the room's Durable Object", () => {
    expect(relayUrlForRoom("wss://relay.example.com/ws", "duel-a/b c")).toBe(
      "wss://relay.example.com/ws?room=duel-a%2Fb+c",
    );
    expect(relayUrlForRoom("ws://localhost:3002/ws?trace=1", "duel-local")).toBe(
      "ws://localhost:3002/ws?trace=1&room=duel-local",
    );
  });
});

describe("relay sink", () => {
  test("submitPlace sends rotation and assigned builders", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitPlace(27, 40, 41, 1, [3, 5]);

    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [
          {
            type: COMMAND_PLACE,
            buildingType: 27,
            tileX: 40,
            tileZ: 41,
            rotation: 1,
            builderIds: [3, 5],
          },
        ],
      },
    ]);
  });

  test("submitWallLine sends deterministic fixed-point endpoints", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitWallLine(201, 160, 320, 352, 320, [3, 5]);

    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [
          {
            type: COMMAND_PLACE_WALL,
            connectorType: 201,
            startXFixed: 160,
            startZFixed: 320,
            endXFixed: 352,
            endZFixed: 320,
            builderIds: [3, 5],
          },
        ],
      },
    ]);
  });

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

  test("submitPray sends the tickless Villagers and Temple", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitPray([3, 5], 17);

    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_PRAY, unitIds: [3, 5], targetId: 17 }],
      },
    ]);
  });

  test("submits tickless relic pickup and Temple drop-off commands", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitPickUpRelic([3], 17);
    sink.submitDropOffRelic([3], 21);

    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_PICK_UP_RELIC, unitIds: [3], targetId: 17 }],
      },
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_DROP_OFF_RELIC, unitIds: [3], targetId: 21 }],
      },
    ]);
  });

  test("submitCancelTrain sends the producer and queue position", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));

    sink.submitCancelTrain(17, 2);

    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_CANCEL_TRAIN, buildingId: 17, queueIndex: 2 }],
      },
    ]);
  });

  test("submits tickless garrison and ungarrison commands", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));
    sink.submitGarrison([3, 5], 17);
    sink.submitUngarrison(17);
    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_GARRISON, unitIds: [3, 5], targetId: 17 }],
      },
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_UNGARRISON, containerId: 17 }],
      },
    ]);
  });

  test("submits a tickless reversible Town Bell order", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));
    sink.submitTownBell(17);
    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_TOWN_BELL, buildingId: 17 }],
      },
    ]);
  });

  test("submits tickless wall-to-gate conversion", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));
    sink.submitBuildGate(17);
    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_BUILD_GATE, wallId: 17 }],
      },
    ]);
  });

  test("submits tickless caravan trade routes", () => {
    const sent: ClientMessage[] = [];
    const sink = createRelaySink((message) => sent.push(message));
    sink.submitTrade([3, 5], 17);
    expect(sent).toEqual([
      {
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_TRADE, unitIds: [3, 5], targetId: 17 }],
      },
    ]);
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
