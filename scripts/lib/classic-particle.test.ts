import { describe, expect, test } from "bun:test";
import { classicDdtDimensions, readClassicParticleSource } from "./classic-particle";

class FixtureWriter {
  private readonly bytes: number[] = [];

  byte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  bytesOf(values: readonly number[]): void {
    for (const value of values) this.byte(value);
  }

  int32(value: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setInt32(0, value, true);
    this.bytesOf(bytes);
  }

  float32(value: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, value, true);
    this.bytesOf(bytes);
  }

  floats(values: readonly number[]): void {
    for (const value of values) this.float32(value);
  }

  string(value: string): void {
    this.int32(value.length);
    for (const character of value) {
      const code = character.charCodeAt(0);
      this.byte(code);
      this.byte(code >>> 8);
    }
  }

  finish(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

function particleFixture(): Uint8Array {
  const writer = new FixtureWriter();
  writer.int32(12);
  writer.bytesOf([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0]);
  writer.int32(20);
  writer.int32(0);
  const emitter = Array.from({ length: 32 }, () => 0);
  emitter[2] = 0.8;
  emitter[10] = 8;
  emitter[11] = 0.2;
  emitter[12] = 1.1;
  emitter[16] = 1;
  emitter[22] = 5;
  writer.floats(emitter);
  writer.bytesOf([0, 0, 1, 0]);
  writer.int32(0);
  const shape = Array.from({ length: 12 }, () => 0);
  shape[7] = -45;
  shape[9] = 90;
  writer.floats(shape);
  writer.bytesOf([0, 0, 0, 0]);
  writer.int32(1);
  writer.int32(0);
  writer.int32(0);
  writer.int32(0);
  writer.int32(1);
  writer.bytesOf([255, 255, 255, 0, 255, 255, 255, 0]);
  writer.floats([0, 0, 1, 0]);
  writer.bytesOf([0, 0, 0, 0]);
  writer.int32(3);
  writer.floats([1, 0, 0, 0]);
  writer.bytesOf([0, 0, 0, 0]);
  writer.int32(2);
  writer.floats([6, 0, 1, 0, 1, 0, 1, 0, 1.5, 0]);
  writer.bytesOf([0, 0, 0, 0]);
  writer.int32(0);
  writer.int32(0);
  writer.floats([0, 0, 1]);
  writer.bytesOf([255, 255, 255, 0]);
  writer.bytesOf([1, 1, 1, 0]);
  writer.floats(Array.from({ length: 20 }, () => 0));
  writer.int32(0);
  writer.int32(-1);
  writer.floats([0, 0]);
  writer.string("");
  writer.float32(1);
  writer.string("Special G Nemean Lion SoundWave.tga");
  writer.floats([0, 0, 0, 0.2, 0.3, 0.1, 5, 5, 0, 0, 0, 0]);
  writer.floats([0, 0, 0, 1, 1, 0, 0, 0]);
  return writer.finish();
}

describe("Classic particle source reader", () => {
  test("reads the emitter, material, appearance, and stage records", () => {
    expect(readClassicParticleSource(particleFixture())).toEqual({
      version: 12,
      loop: true,
      syncWithAttackAnimation: true,
      maxParticles: 20,
      particleLifetimeSeconds: 0.8,
      emissionStartSeconds: 1.1,
      emissionDurationSeconds: 1,
      emissionRatePerSecond: 8,
      emissionRateVariance: 0.2,
      initialVelocity: 5,
      usesSpreader: true,
      shapeType: 0,
      offAxisDegrees: -45,
      offPlaneDegrees: 90,
      materialType: 1,
      baseScale: 6,
      scaleCycleSeconds: 1.5,
      opacityStages: [
        [0, 0, 0, 0.2],
        [0.3, 0.1, 5, 5],
        [0, 0, 0, 0],
      ],
      scaleStages: [
        [0, 0, 0, 1],
        [1, 0, 0, 0],
      ],
      appearanceFiles: ["Special G Nemean Lion SoundWave.tga"],
    });
  });

  test("reads Classic DDT dimensions and rejects unrelated bytes", () => {
    const ddt = new Uint8Array(16);
    ddt.set(new TextEncoder().encode("RTS3"));
    const view = new DataView(ddt.buffer);
    view.setUint32(8, 64, true);
    view.setUint32(12, 32, true);
    expect(classicDdtDimensions(ddt)).toEqual([64, 32]);
    expect(() => classicDdtDimensions(new Uint8Array(16))).toThrow("Not a Classic AoM DDT texture");
  });
});
