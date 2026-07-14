const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export const MAX_MODEL_MORPH_TARGETS = 20;

interface GltfAccessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
}

interface GltfBufferView {
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices: number;
  material?: number;
  targets?: Array<Record<string, number>>;
}

interface GltfMesh {
  primitives: GltfPrimitive[];
}

interface GltfMaterial {
  name?: string;
  alphaCutoff?: number;
  alphaMode?: string;
  pbrMetallicRoughness?: {
    baseColorTexture?: { index: number };
  };
}

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

interface GltfAnimation {
  channels: Array<{
    sampler: number;
    target: { node: number; path: "translation" | "rotation" | "scale" | "weights" };
  }>;
  samplers: Array<{ input: number; output: number; interpolation?: string }>;
}

interface GltfJson {
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  meshes: GltfMesh[];
  materials?: GltfMaterial[];
  textures?: Array<{ source?: number }>;
  images?: Array<{ bufferView?: number; mimeType?: string }>;
  nodes?: GltfNode[];
  animations?: GltfAnimation[];
}

export interface ModelPrimitiveData {
  positions: Float32Array;
  normals: Float32Array;
  texcoords: Float32Array;
  indices: Uint16Array | Uint32Array;
  morphPositions: readonly Float32Array[];
  morphNormals: readonly Float32Array[];
  materialIndex: number;
}

export interface ModelMaterialData {
  image: ImageBitmap | null;
  pixelTransform: "none" | "multiply-player-color";
  alpha: { mode: "opaque" } | { mode: "mask"; cutoff: number };
}

export interface ClassicModelRequirements {
  requiredNodes?: readonly string[];
}

export interface ModelKeyframeTrack {
  times: Float32Array;
  values: Float32Array;
  components: number;
}

export interface ModelNodeData {
  name: string;
  parent: number;
  translation: Float32Array;
  rotation: Float32Array;
  scale: Float32Array;
  translationTrack?: ModelKeyframeTrack;
  rotationTrack?: ModelKeyframeTrack;
  scaleTrack?: ModelKeyframeTrack;
}

export interface ModelMorphTrack {
  times: Float32Array;
  weights: Float32Array;
  targetCount: number;
}

export interface ModelAsset {
  primitives: readonly ModelPrimitiveData[];
  materials: readonly ModelMaterialData[];
  nodes: readonly ModelNodeData[];
  nodeIndexByName: ReadonlyMap<string, number>;
  morphTrack: ModelMorphTrack | null;
  duration: number;
  groundOffset: number;
}

function invalidClassicModel(source: string, detail: string): never {
  throw new Error(`Invalid Classic model ${source}: ${detail}`);
}

function requiredIndex(value: number | undefined, source: string, label: string): number {
  if (!Number.isInteger(value) || value! < 0) {
    invalidClassicModel(source, `${label} is missing`);
  }
  return value!;
}

function componentCount(type: string): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      throw new Error(`Unsupported glTF accessor type: ${type}`);
  }
}

function componentSize(componentType: number): number {
  switch (componentType) {
    case 5121:
      return 1;
    case 5123:
      return 2;
    case 5125:
    case 5126:
      return 4;
    default:
      throw new Error(`Unsupported glTF component type: ${componentType}`);
  }
}

function parseClassicGltfJson(jsonText: string, source: string): GltfJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    invalidClassicModel(source, "JSON chunk is malformed");
  }

  const gltf = parsed as Partial<GltfJson> | null;
  if (!gltf || !Array.isArray(gltf.accessors) || !Array.isArray(gltf.bufferViews)) {
    invalidClassicModel(source, "accessors and buffer views are required");
  }
  if (!Array.isArray(gltf.meshes)) invalidClassicModel(source, "meshes are required");
  return gltf as GltfJson;
}

function classicAccessor(
  gltf: GltfJson,
  index: number | undefined,
  source: string,
  label: string,
  type: string,
  componentTypes: readonly number[],
): GltfAccessor {
  const accessor = gltf.accessors[requiredIndex(index, source, label)];
  if (
    !accessor ||
    accessor.type !== type ||
    !componentTypes.includes(accessor.componentType) ||
    !Number.isInteger(accessor.count) ||
    accessor.count <= 0 ||
    !gltf.bufferViews[accessor.bufferView]
  ) {
    invalidClassicModel(source, `${label} must reference a ${type} accessor`);
  }
  return accessor;
}

function classicMaterialSemantics(
  gltf: GltfJson,
  materialIndex: number,
  source: string,
): Omit<ModelMaterialData, "image"> & { imageIndex: number | undefined } {
  const material = gltf.materials?.[materialIndex];
  if (!material) invalidClassicModel(source, `material ${materialIndex} is missing`);
  const alphaMode = material.alphaMode ?? "OPAQUE";
  if (alphaMode !== "OPAQUE" && alphaMode !== "MASK") {
    invalidClassicModel(source, `material ${materialIndex} uses unsupported ${alphaMode} alpha`);
  }
  if (alphaMode === "MASK" && !Number.isFinite(material.alphaCutoff ?? 0.5)) {
    invalidClassicModel(source, `material ${materialIndex} has an invalid alpha cutoff`);
  }

  const transform = material.name?.toLowerCase().match(/(?:pixel|color|texture)xform\d+/)?.[0];
  if (transform !== undefined && transform !== "pixelxform1") {
    invalidClassicModel(source, `material ${materialIndex} uses unsupported ${transform}`);
  }
  const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
  const imageIndex = textureIndex === undefined ? undefined : gltf.textures?.[textureIndex]?.source;
  if (textureIndex !== undefined && (imageIndex === undefined || !gltf.images?.[imageIndex])) {
    invalidClassicModel(source, `material ${materialIndex} has an invalid texture reference`);
  }
  const imageBufferView =
    imageIndex === undefined ? undefined : gltf.images![imageIndex]!.bufferView;
  if (
    imageIndex !== undefined &&
    (imageBufferView === undefined || !gltf.bufferViews[imageBufferView])
  ) {
    invalidClassicModel(source, `material ${materialIndex} has an invalid image buffer view`);
  }

  return {
    imageIndex,
    pixelTransform: transform === "pixelxform1" ? "multiply-player-color" : "none",
    alpha:
      alphaMode === "MASK"
        ? { mode: "mask", cutoff: material.alphaCutoff ?? 0.5 }
        : { mode: "opaque" },
  };
}

function validateClassicModelContract(
  gltf: GltfJson,
  source: string,
  requirements: ClassicModelRequirements,
): void {
  const primitives = gltf.meshes[0]?.primitives;
  if (!primitives?.length) invalidClassicModel(source, "mesh 0 must contain visible primitives");

  let morphCount: number | undefined;
  for (let primitiveIndex = 0; primitiveIndex < primitives.length; primitiveIndex += 1) {
    const primitive = primitives[primitiveIndex]!;
    const prefix = `primitive ${primitiveIndex}`;
    const positions = classicAccessor(
      gltf,
      primitive.attributes?.POSITION,
      source,
      `${prefix} POSITION`,
      "VEC3",
      [5126],
    );
    const normals = classicAccessor(
      gltf,
      primitive.attributes?.NORMAL,
      source,
      `${prefix} NORMAL`,
      "VEC3",
      [5126],
    );
    const texcoords = classicAccessor(
      gltf,
      primitive.attributes?.TEXCOORD_0,
      source,
      `${prefix} TEXCOORD_0`,
      "VEC2",
      [5126],
    );
    classicAccessor(
      gltf,
      primitive.indices,
      source,
      `${prefix} indices`,
      "SCALAR",
      [5121, 5123, 5125],
    );
    if (normals.count !== positions.count || texcoords.count !== positions.count) {
      invalidClassicModel(source, `${prefix} vertex attribute counts do not match`);
    }
    classicMaterialSemantics(
      gltf,
      requiredIndex(primitive.material, source, `${prefix} material`),
      source,
    );

    const targets = primitive.targets ?? [];
    if (targets.length > MAX_MODEL_MORPH_TARGETS) {
      invalidClassicModel(
        source,
        `${prefix} has ${targets.length} morph targets; the renderer supports ${MAX_MODEL_MORPH_TARGETS}`,
      );
    }
    if (morphCount === undefined) morphCount = targets.length;
    else if (morphCount !== targets.length) {
      invalidClassicModel(source, "visible primitives must share one morph target count");
    }
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
      const target = targets[targetIndex]!;
      const targetPositions = classicAccessor(
        gltf,
        target.POSITION,
        source,
        `${prefix} morph ${targetIndex} POSITION`,
        "VEC3",
        [5126],
      );
      const targetNormals = classicAccessor(
        gltf,
        target.NORMAL,
        source,
        `${prefix} morph ${targetIndex} NORMAL`,
        "VEC3",
        [5126],
      );
      if (targetPositions.count !== positions.count || targetNormals.count !== positions.count) {
        invalidClassicModel(source, `${prefix} morph ${targetIndex} vertex count does not match`);
      }
    }
  }

  const nodes = gltf.nodes ?? [];
  const nodeNames = new Set(nodes.map((node) => node.name?.toLowerCase()).filter(Boolean));
  for (const requiredNode of requirements.requiredNodes ?? []) {
    if (!nodeNames.has(requiredNode.toLowerCase())) {
      invalidClassicModel(source, `required attachment node ${requiredNode} is missing`);
    }
  }
  for (let parent = 0; parent < nodes.length; parent += 1) {
    for (const child of nodes[parent]!.children ?? []) {
      if (!nodes[child])
        invalidClassicModel(source, `node ${parent} has an invalid child reference`);
    }
  }

  if ((gltf.animations?.length ?? 0) > 1) {
    invalidClassicModel(source, "only one animation is supported per model");
  }
  const animation = gltf.animations?.[0];
  if (!animation) return;
  for (let channelIndex = 0; channelIndex < animation.channels.length; channelIndex += 1) {
    const channel = animation.channels[channelIndex]!;
    const sampler = animation.samplers[channel.sampler];
    if (!sampler)
      invalidClassicModel(source, `animation channel ${channelIndex} sampler is missing`);
    if (sampler.interpolation !== undefined && sampler.interpolation !== "LINEAR") {
      invalidClassicModel(
        source,
        `animation channel ${channelIndex} uses unsupported ${sampler.interpolation} interpolation`,
      );
    }
    const node = nodes[channel.target.node];
    if (!node) invalidClassicModel(source, `animation channel ${channelIndex} node is missing`);
    const path = channel.target.path;
    if (path !== "translation" && path !== "rotation" && path !== "scale" && path !== "weights") {
      invalidClassicModel(source, `animation channel ${channelIndex} path is unsupported`);
    }
    const times = classicAccessor(
      gltf,
      sampler.input,
      source,
      `animation channel ${channelIndex} input`,
      "SCALAR",
      [5126],
    );
    const outputType = path === "weights" ? "SCALAR" : path === "rotation" ? "VEC4" : "VEC3";
    const values = classicAccessor(
      gltf,
      sampler.output,
      source,
      `animation channel ${channelIndex} output`,
      outputType,
      [5126],
    );
    if (path === "weights") {
      if (node.mesh !== 0 || !morphCount || values.count !== times.count * morphCount) {
        invalidClassicModel(source, "weights animation does not match visible mesh morphs");
      }
    } else if (values.count !== times.count) {
      invalidClassicModel(source, `animation channel ${channelIndex} output count does not match`);
    }
  }
}

function readComponent(view: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5121:
      return view.getUint8(offset);
    case 5123:
      return view.getUint16(offset, true);
    case 5125:
      return view.getUint32(offset, true);
    case 5126:
      return view.getFloat32(offset, true);
    default:
      throw new Error(`Unsupported glTF component type: ${componentType}`);
  }
}

function accessorValues(gltf: GltfJson, binary: ArrayBuffer, accessorIndex: number): Float32Array {
  const accessor = gltf.accessors[accessorIndex]!;
  const bufferView = gltf.bufferViews[accessor.bufferView]!;
  const components = componentCount(accessor.type);
  const bytesPerComponent = componentSize(accessor.componentType);
  const packedStride = components * bytesPerComponent;
  const stride = bufferView.byteStride ?? packedStride;
  const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const view = new DataView(binary);
  const values = new Float32Array(accessor.count * components);

  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = baseOffset + element * stride;

    for (let component = 0; component < components; component += 1) {
      values[element * components + component] = readComponent(
        view,
        elementOffset + component * bytesPerComponent,
        accessor.componentType,
      );
    }
  }

  return values;
}

function accessorIndices(
  gltf: GltfJson,
  binary: ArrayBuffer,
  accessorIndex: number,
): Uint16Array | Uint32Array {
  const accessor = gltf.accessors[accessorIndex]!;
  const values = accessorValues(gltf, binary, accessorIndex);

  if (accessor.componentType === 5125) {
    return Uint32Array.from(values);
  }

  if (accessor.componentType === 5121 || accessor.componentType === 5123) {
    return Uint16Array.from(values);
  }

  throw new Error(`Unsupported glTF index component type: ${accessor.componentType}`);
}

function defaultVector(values: number[] | undefined, fallback: readonly number[]): Float32Array {
  return new Float32Array(values ?? fallback);
}

function attachNodeTrack(
  node: ModelNodeData,
  path: "translation" | "rotation" | "scale",
  track: ModelKeyframeTrack,
): void {
  if (path === "translation") node.translationTrack = track;
  else if (path === "rotation") node.rotationTrack = track;
  else node.scaleTrack = track;
}

export async function loadClassicModelGlb(
  url: string,
  requirements: ClassicModelRequirements = {},
): Promise<ModelAsset> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load model ${url}: ${response.status}`);
  }

  const file = await response.arrayBuffer();
  return parseClassicModelGlb(file, url, requirements);
}

export async function parseClassicModelGlb(
  file: ArrayBuffer,
  source = "<memory>",
  requirements: ClassicModelRequirements = {},
): Promise<ModelAsset> {
  const header = new DataView(file);

  if (header.byteLength < 20 || header.getUint32(0, true) !== GLB_MAGIC) {
    invalidClassicModel(source, "GLB header is missing");
  }
  if (header.getUint32(4, true) !== GLB_VERSION) {
    invalidClassicModel(source, `GLB version must be ${GLB_VERSION}`);
  }
  if (header.getUint32(8, true) !== file.byteLength) {
    invalidClassicModel(source, "GLB declared length does not match the file");
  }

  const jsonLength = header.getUint32(12, true);
  const jsonType = header.getUint32(16, true);

  if (jsonType !== JSON_CHUNK) {
    invalidClassicModel(source, "GLB JSON chunk is missing");
  }
  if (20 + jsonLength + 8 > file.byteLength) {
    invalidClassicModel(source, "GLB JSON chunk lies outside the file");
  }

  const decodedJson = new TextDecoder().decode(new Uint8Array(file, 20, jsonLength));
  const paddingStart = decodedJson.indexOf(String.fromCharCode(0));
  const jsonText = decodedJson
    .slice(0, paddingStart < 0 ? decodedJson.length : paddingStart)
    .trim();
  const gltf = parseClassicGltfJson(jsonText, source);
  const binaryHeaderOffset = 20 + jsonLength;

  if (
    binaryHeaderOffset + 8 > file.byteLength ||
    header.getUint32(binaryHeaderOffset + 4, true) !== BIN_CHUNK
  ) {
    invalidClassicModel(source, "GLB binary chunk is missing");
  }

  const binaryLength = header.getUint32(binaryHeaderOffset, true);
  const binaryOffset = binaryHeaderOffset + 8;
  if (binaryOffset + binaryLength > file.byteLength) {
    invalidClassicModel(source, "GLB binary chunk lies outside the file");
  }
  const binary = file.slice(binaryOffset, binaryOffset + binaryLength);
  validateClassicModelContract(gltf, source, requirements);
  const visibleMesh = gltf.meshes[0];

  let groundY = Number.POSITIVE_INFINITY;
  const primitives = visibleMesh!.primitives.map((primitive): ModelPrimitiveData => {
    const positions = accessorValues(gltf, binary, primitive.attributes.POSITION!);
    const normals = accessorValues(gltf, binary, primitive.attributes.NORMAL!);
    const texcoords = accessorValues(gltf, binary, primitive.attributes.TEXCOORD_0!);
    const morphPositions: Float32Array[] = [];
    const morphNormals: Float32Array[] = [];

    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      groundY = Math.min(groundY, positions[vertex * 3 + 1]!);
    }

    for (const target of primitive.targets ?? []) {
      const positionDelta = accessorValues(gltf, binary, target.POSITION!);
      const normalDelta = accessorValues(gltf, binary, target.NORMAL!);
      morphPositions.push(positionDelta);
      morphNormals.push(normalDelta);

      for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
        groundY = Math.min(groundY, positions[vertex * 3 + 1]! + positionDelta[vertex * 3 + 1]!);
      }
    }

    return {
      positions,
      normals,
      texcoords,
      indices: accessorIndices(gltf, binary, primitive.indices),
      morphPositions,
      morphNormals,
      materialIndex: primitive.material!,
    };
  });

  const imagePromises = (gltf.images ?? []).map(async (image): Promise<ImageBitmap | null> => {
    if (image.bufferView === undefined) return null;
    const bufferView = gltf.bufferViews[image.bufferView]!;
    const start = bufferView.byteOffset ?? 0;
    const bytes = binary.slice(start, start + bufferView.byteLength);
    return createImageBitmap(new Blob([bytes], { type: image.mimeType ?? "image/png" }), {
      // Classic body textures store useful color under zero alpha. Preserve the
      // straight-alpha RGB instead of destroying it during bitmap decode.
      premultiplyAlpha: "none",
    });
  });
  const images = await Promise.all(imagePromises);
  const materials = (gltf.materials ?? []).map((_, materialIndex): ModelMaterialData => {
    const { imageIndex, ...semantics } = classicMaterialSemantics(gltf, materialIndex, source);

    return {
      image: imageIndex === undefined ? null : (images[imageIndex] ?? null),
      ...semantics,
    };
  });
  const sourceNodes = gltf.nodes ?? [];
  const nodes: ModelNodeData[] = sourceNodes.map((node) => ({
    name: node.name ?? "",
    parent: -1,
    translation: defaultVector(node.translation, [0, 0, 0]),
    rotation: defaultVector(node.rotation, [0, 0, 0, 1]),
    scale: defaultVector(node.scale, [1, 1, 1]),
  }));

  for (let parent = 0; parent < sourceNodes.length; parent += 1) {
    for (const child of sourceNodes[parent]!.children ?? []) nodes[child]!.parent = parent;
  }

  const nodeIndexByName = new Map<string, number>();
  for (let i = 0; i < nodes.length; i += 1) nodeIndexByName.set(nodes[i]!.name.toLowerCase(), i);

  let morphTrack: ModelMorphTrack | null = null;
  let duration = 0;
  const animation = gltf.animations?.[0];

  if (animation) {
    const morphTargetCount = primitives[0]?.morphPositions.length ?? 0;

    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler]!;
      const times = accessorValues(gltf, binary, sampler.input);
      const values = accessorValues(gltf, binary, sampler.output);

      for (let frame = 0; frame < times.length; frame += 1) {
        if (!Number.isFinite(times[frame]) || (frame > 0 && times[frame]! <= times[frame - 1]!)) {
          invalidClassicModel(source, "animation input times must be finite and increasing");
        }
      }

      if (times.length > 0) duration = Math.max(duration, times[times.length - 1]!);

      if (channel.target.path === "weights") {
        morphTrack = { times, weights: values, targetCount: morphTargetCount };
        continue;
      }

      const components = channel.target.path === "rotation" ? 4 : 3;
      attachNodeTrack(nodes[channel.target.node]!, channel.target.path, {
        times,
        values,
        components,
      });
    }
  }

  return {
    primitives,
    materials,
    nodes,
    nodeIndexByName,
    morphTrack,
    duration,
    groundOffset: Number.isFinite(groundY) ? -groundY : 0,
  };
}
