const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

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
  playerColor: boolean;
  alphaCutoff: number;
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

export async function loadGlbModel(url: string): Promise<ModelAsset> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load model ${url}: ${response.status}`);
  }

  const file = await response.arrayBuffer();
  const header = new DataView(file);

  if (header.byteLength < 20 || header.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error(`Invalid GLB: ${url}`);
  }

  const jsonLength = header.getUint32(12, true);
  const jsonType = header.getUint32(16, true);

  if (jsonType !== JSON_CHUNK) {
    throw new Error(`GLB JSON chunk missing: ${url}`);
  }

  const decodedJson = new TextDecoder().decode(new Uint8Array(file, 20, jsonLength));
  const paddingStart = decodedJson.indexOf(String.fromCharCode(0));
  const jsonText = decodedJson
    .slice(0, paddingStart < 0 ? decodedJson.length : paddingStart)
    .trim();
  const gltf = JSON.parse(jsonText) as GltfJson;
  const binaryHeaderOffset = 20 + jsonLength;

  if (
    binaryHeaderOffset + 8 > file.byteLength ||
    header.getUint32(binaryHeaderOffset + 4, true) !== BIN_CHUNK
  ) {
    throw new Error(`GLB binary chunk missing: ${url}`);
  }

  const binaryLength = header.getUint32(binaryHeaderOffset, true);
  const binaryOffset = binaryHeaderOffset + 8;
  const binary = file.slice(binaryOffset, binaryOffset + binaryLength);
  const visibleMesh = gltf.meshes[0];

  if (!visibleMesh) {
    throw new Error(`GLB has no visible mesh: ${url}`);
  }

  let groundY = Number.POSITIVE_INFINITY;
  const primitives = visibleMesh.primitives.map((primitive): ModelPrimitiveData => {
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
      materialIndex: primitive.material ?? 0,
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
  const materials = (gltf.materials ?? []).map((material): ModelMaterialData => {
    const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index;
    const imageIndex =
      textureIndex === undefined ? undefined : gltf.textures?.[textureIndex]?.source;

    return {
      image: imageIndex === undefined ? null : (images[imageIndex] ?? null),
      playerColor: material.name?.toLowerCase().includes("pixelxform1") ?? false,
      // OPAQUE materials must ignore texture alpha. Classic's converted body
      // textures retain legacy data in that channel, so treating it as opacity
      // removes the villager's skin/body geometry.
      alphaCutoff: material.alphaMode === "MASK" ? (material.alphaCutoff ?? 0.5) : -1,
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
