import { resampleGlbMorphTargets } from "./lib/glb-morphs";

const [inputPath, outputPath = inputPath, rawLimit = "20"] = Bun.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: bun scripts/resample-classic-morphs.ts <input.glb> [output.glb] [limit]");
}

const limit = Number(rawLimit);
if (!Number.isInteger(limit)) throw new RangeError("Morph-target limit must be an integer.");
const input = new Uint8Array(await Bun.file(inputPath).arrayBuffer());
const output = resampleGlbMorphTargets(input, limit);
await Bun.write(outputPath, output);
console.log(`Wrote ${outputPath} with at most ${limit} morph targets.`);
