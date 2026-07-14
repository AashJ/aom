struct Globals {
  viewProj: mat4x4f,
}

struct Material {
  vertexCount: u32,
  morphCount: u32,
  flags: u32,
  alphaCutoff: f32,
}

const MATERIAL_ALPHA_MASK = 1u;
const MATERIAL_MULTIPLY_PLAYER_COLOR = 2u;

struct MorphValues {
  values: array<vec4f>,
}

@group(0) @binding(0) var<uniform> globals: Globals;
@group(1) @binding(0) var<storage, read> morphPositions: MorphValues;
@group(1) @binding(1) var<storage, read> morphNormals: MorphValues;
@group(1) @binding(2) var modelSampler: sampler;
@group(1) @binding(3) var modelTexture: texture_2d<f32>;
@group(1) @binding(4) var<uniform> material: Material;

const PLAYER_PALETTE = array<vec3f, 4>(
  vec3f(0.32, 0.48, 0.85),
  vec3f(0.82, 0.26, 0.20),
  vec3f(0.30, 0.68, 0.34),
  vec3f(0.88, 0.72, 0.25),
);

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
  @location(2) selected: f32,
  @location(3) owner: f32,
  @location(4) buildFrac: f32,
  @location(5) ghostKind: f32,
}

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) basePosition: vec3f,
  @location(1) baseNormal: vec3f,
  @location(2) uv: vec2f,
  @location(3) instancePosition: vec3f,
  @location(4) instanceFacing: vec2f,
  @location(5) instanceState: vec4f,
  @location(6) morph0: vec4f,
  @location(7) morph1: vec4f,
  @location(8) morph2: vec4f,
  @location(9) local0: vec4f,
  @location(10) local1: vec4f,
  @location(11) local2: vec4f,
  @location(12) local3: vec4f,
) -> VertexOut {
  let weights = array<f32, 12>(
    morph0.x, morph0.y, morph0.z, morph0.w,
    morph1.x, morph1.y, morph1.z, morph1.w,
    morph2.x, morph2.y, morph2.z, morph2.w,
  );
  var position = basePosition;
  var normal = baseNormal;

  for (var morphTarget = 0u; morphTarget < 12u; morphTarget += 1u) {
    if (morphTarget < material.morphCount) {
      let offset = morphTarget * material.vertexCount + vertexIndex;
      position += morphPositions.values[offset].xyz * weights[morphTarget];
      normal += morphNormals.values[offset].xyz * weights[morphTarget];
    }
  }

  let localTransform = mat4x4f(local0, local1, local2, local3);
  let localPosition = localTransform * vec4f(position, 1.0);
  let localNormal = normalize(mat3x3f(local0.xyz, local1.xyz, local2.xyz) * normal);
  let forward = normalize(instanceFacing);
  let right = vec2f(forward.y, -forward.x);
  let worldXZ = instancePosition.xz + right * localPosition.x + forward * localPosition.z;
  let worldPosition = vec3f(worldXZ.x, instancePosition.y + localPosition.y, worldXZ.y);
  let worldNormalXZ = right * localNormal.x + forward * localNormal.z;

  var out: VertexOut;
  out.position = globals.viewProj * vec4f(worldPosition, 1.0);
  out.uv = uv;
  out.normal = normalize(vec3f(worldNormalXZ.x, localNormal.y, worldNormalXZ.y));
  out.selected = instanceState.x;
  out.owner = instanceState.y;
  out.buildFrac = instanceState.z;
  out.ghostKind = instanceState.w;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let texel = textureSample(modelTexture, modelSampler, in.uv);
  let usesAlphaMask = (material.flags & MATERIAL_ALPHA_MASK) != 0u;

  if (usesAlphaMask && texel.a < material.alphaCutoff) {
    discard;
  }

  // glTF OPAQUE materials ignore base-color alpha. The Classic textures also
  // use that channel for legacy material masks, not visibility.
  let opacity = select(1.0, texel.a, usesAlphaMask);

  let sunDirection = normalize(vec3f(-0.45, 0.8, -0.4));
  let diffuse = max(0.0, dot(normalize(in.normal), sunDirection));
  let lighting = 0.58 + diffuse * 0.62;
  var color = texel.rgb;

  if ((material.flags & MATERIAL_MULTIPLY_PLAYER_COLOR) != 0u) {
    color *= mix(vec3f(1.0), PLAYER_PALETTE[u32(in.owner) % 4u], 0.72);
  }

  color *= mix(vec3f(0.55, 0.45, 0.35), vec3f(1.0), in.buildFrac);
  color *= lighting;
  color = mix(color, vec3f(1.0, 0.85, 0.3), in.selected * 0.28);

  if (in.ghostKind > 0.5) {
    let valid = step(in.ghostKind, 1.5);
    color *= mix(vec3f(1.2, 0.4, 0.35), vec3f(0.5, 1.1, 0.6), valid);
    return vec4f(color * 0.55, opacity * 0.55);
  }

  return vec4f(color, opacity);
}
