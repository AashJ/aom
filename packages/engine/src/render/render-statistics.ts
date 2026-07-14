export interface RendererStatistics {
  drawCalls: number;
  instances: number;
}

export function resetRendererStatistics(statistics: RendererStatistics): void {
  statistics.drawCalls = 0;
  statistics.instances = 0;
}

export function recordDraw(statistics: RendererStatistics, instanceCount: number): void {
  statistics.drawCalls += 1;
  statistics.instances += instanceCount;
}

export function addRendererStatistics(
  target: RendererStatistics,
  source: RendererStatistics,
): void {
  target.drawCalls += source.drawCalls;
  target.instances += source.instances;
}
