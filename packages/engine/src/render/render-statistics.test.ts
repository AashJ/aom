import { describe, expect, test } from "bun:test";
import {
  addRendererStatistics,
  recordDraw,
  resetRendererStatistics,
  type RendererStatistics,
} from "./render-statistics";

describe("renderer statistics", () => {
  test("counts each submitted instance once per draw call", () => {
    const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };

    recordDraw(statistics, 3);
    recordDraw(statistics, 3);
    recordDraw(statistics, 1);

    expect(statistics).toEqual({ drawCalls: 3, instances: 7 });
  });

  test("aggregates and resets renderer-owned results", () => {
    const statistics: RendererStatistics = { drawCalls: 1, instances: 4 };

    addRendererStatistics(statistics, { drawCalls: 2, instances: 6 });
    expect(statistics).toEqual({ drawCalls: 3, instances: 10 });

    resetRendererStatistics(statistics);
    expect(statistics).toEqual({ drawCalls: 0, instances: 0 });
  });
});
