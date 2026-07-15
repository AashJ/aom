import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const COMPRESSED_TAG = "l33t";

export interface XmbNode {
  readonly name: string;
  readonly value: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmbNode[];
}

class XmbReader {
  private offset = 0;
  private readonly chunkEnds: number[] = [];

  constructor(private readonly data: Buffer) {}

  readRoot(): XmbNode {
    this.enterChunk("X1");
    const version = this.readTaggedUint32("XR");
    const nodeNames = version >= 2 ? this.readNameTable() : null;
    const attributeNames = version >= 3 ? this.readNameTable() : null;
    const root = this.readNode(version, nodeNames, attributeNames);
    this.leaveChunk("X1");

    if (this.offset !== this.data.length) {
      throw new Error(`XMB has ${this.data.length - this.offset} unread bytes.`);
    }

    return root;
  }

  private readNode(
    version: number,
    nodeNames: readonly string[] | null,
    attributeNames: readonly string[] | null,
  ): XmbNode {
    this.enterChunk("XN");
    const value = this.readUnicodeString();
    const name =
      version === 0 ? this.readUnicodeString() : this.nameAt(nodeNames, this.readInt32(), "node");

    if (version === 0) this.readInt32();
    if (version >= 8) this.readInt32();

    const attributes: Record<string, string> = {};
    const attributeCount = this.readCount("attribute");
    for (let index = 0; index < attributeCount; index += 1) {
      const attributeName =
        version === 0
          ? this.readUnicodeString()
          : this.nameAt(attributeNames, this.readInt32(), "attribute");
      attributes[attributeName] = this.readUnicodeString();
    }

    const children: XmbNode[] = [];
    const childCount = this.readCount("child");
    for (let index = 0; index < childCount; index += 1) {
      children.push(this.readNode(version, nodeNames, attributeNames));
    }

    this.leaveChunk("XN");
    return { name, value, attributes, children };
  }

  private readNameTable(): readonly string[] {
    const count = this.readCount("name");
    const names: string[] = [];
    for (let index = 0; index < count; index += 1) names.push(this.readUnicodeString());
    return names;
  }

  private nameAt(names: readonly string[] | null, index: number, kind: string): string {
    const name = names?.[index];
    if (name === undefined) throw new Error(`XMB ${kind} name index ${index} is invalid.`);
    return name;
  }

  private readTaggedUint32(expectedTag: string): number {
    const { size } = this.readChunkHeader(expectedTag);
    if (size !== 4) throw new Error(`XMB ${expectedTag} chunk has invalid size ${size}.`);
    return this.readUint32();
  }

  private enterChunk(expectedTag: string): void {
    const { size } = this.readChunkHeader(expectedTag);
    const end = this.offset + size;
    const parentEnd = this.chunkEnds.at(-1);
    if (end > this.data.length || (parentEnd !== undefined && end > parentEnd)) {
      throw new Error(`XMB ${expectedTag} chunk exceeds its container.`);
    }
    this.chunkEnds.push(end);
  }

  private leaveChunk(expectedTag: string): void {
    const end = this.chunkEnds.pop();
    if (end === undefined || this.offset !== end) {
      throw new Error(`XMB ${expectedTag} chunk ended at ${this.offset}; expected ${end}.`);
    }
  }

  private readChunkHeader(expectedTag: string): { size: number } {
    this.requireBytes(6);
    const tag = this.data.toString("ascii", this.offset, this.offset + 2);
    this.offset += 2;
    const size = this.readInt32();
    if (tag !== expectedTag) throw new Error(`Expected XMB tag ${expectedTag}; found ${tag}.`);
    if (size < 0) throw new Error(`XMB ${tag} chunk has negative size ${size}.`);
    return { size };
  }

  private readUnicodeString(): string {
    const characterCount = this.readCount("string character");
    const byteCount = characterCount * 2;
    this.requireBytes(byteCount);
    const value = this.data.toString("utf16le", this.offset, this.offset + byteCount);
    this.offset += byteCount;
    return value;
  }

  private readCount(kind: string): number {
    const count = this.readInt32();
    if (count < 0) throw new Error(`XMB ${kind} count ${count} is invalid.`);
    return count;
  }

  private readInt32(): number {
    this.requireBytes(4);
    const value = this.data.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  private readUint32(): number {
    this.requireBytes(4);
    const value = this.data.readUint32LE(this.offset);
    this.offset += 4;
    return value;
  }

  private requireBytes(count: number): void {
    if (this.offset + count > this.data.length) throw new Error("Unexpected end of XMB data.");
  }
}

export function decodeXmb(input: Buffer): XmbNode {
  const compressed = input.toString("ascii", 0, 4) === COMPRESSED_TAG;
  const data = compressed ? inflateSync(input.subarray(8)) : input;

  if (compressed) {
    const declaredLength = input.readInt32LE(4);
    if (data.length !== declaredLength) {
      throw new Error(`XMB inflated to ${data.length} bytes; expected ${declaredLength}.`);
    }
  }

  return new XmbReader(data).readRoot();
}

export function readXmbFile(path: string): XmbNode {
  return decodeXmb(readFileSync(path));
}

export function descendants(node: XmbNode, name: string): XmbNode[] {
  const matches: XmbNode[] = [];
  const pending = [node];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.name === name) matches.push(current);
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      pending.push(current.children[index]!);
    }
  }
  return matches;
}

export function child(node: XmbNode, name: string): XmbNode | undefined {
  return node.children.find((candidate) => candidate.name === name);
}
