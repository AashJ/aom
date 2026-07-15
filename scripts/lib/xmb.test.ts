import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { child, decodeXmb, descendants } from "./xmb";

function int32(value: number): Buffer {
  const output = Buffer.alloc(4);
  output.writeInt32LE(value);
  return output;
}

function uint32(value: number): Buffer {
  const output = Buffer.alloc(4);
  output.writeUint32LE(value);
  return output;
}

function unicode(value: string): Buffer {
  return Buffer.concat([int32(value.length), Buffer.from(value, "utf16le")]);
}

function chunk(tag: string, body: Buffer): Buffer {
  return Buffer.concat([Buffer.from(tag, "ascii"), int32(body.length), body]);
}

function node(
  nameIndex: number,
  value: string,
  attributes: readonly [nameIndex: number, value: string][],
  children: readonly Buffer[],
): Buffer {
  return chunk(
    "XN",
    Buffer.concat([
      unicode(value),
      int32(nameIndex),
      int32(attributes.length),
      ...attributes.flatMap(([attributeName, attributeValue]) => [
        int32(attributeName),
        unicode(attributeValue),
      ]),
      int32(children.length),
      ...children,
    ]),
  );
}

function fixture(): Buffer {
  const hp = node(2, "115.0000", [], []);
  const unit = node(
    1,
    "",
    [
      [0, "439"],
      [1, "Hoplite"],
    ],
    [hp],
  );
  const root = node(0, "", [], [unit]);
  const nameTable = ["proto", "unit", "maxhitpoints"];
  const attributeTable = ["id", "name"];
  return chunk(
    "X1",
    Buffer.concat([
      chunk("XR", uint32(3)),
      int32(nameTable.length),
      ...nameTable.map(unicode),
      int32(attributeTable.length),
      ...attributeTable.map(unicode),
      root,
    ]),
  );
}

describe("XMB source decoder", () => {
  test("decodes the name tables, attributes, values, and child chunks", () => {
    const root = decodeXmb(fixture());
    const unit = descendants(root, "unit")[0]!;
    expect(root.name).toBe("proto");
    expect(unit.attributes).toEqual({ id: "439", name: "Hoplite" });
    expect(child(unit, "maxhitpoints")?.value).toBe("115.0000");
  });

  test("decodes the Classic l33t zlib envelope and validates its length", () => {
    const raw = fixture();
    const compressed = Buffer.concat([
      Buffer.from("l33t", "ascii"),
      int32(raw.length),
      deflateSync(raw),
    ]);
    expect(decodeXmb(compressed).name).toBe("proto");

    compressed.writeInt32LE(raw.length + 1, 4);
    expect(() => decodeXmb(compressed)).toThrow("expected");
  });
});
