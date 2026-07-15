struct Uniforms {
  viewProj: mat4x4f,
  debug: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var walkTex: texture_2d<f32>;
@group(0) @binding(2) var terrainSampler: sampler;
@group(0) @binding(3) var fogTex: texture_2d<f32>;
@group(0) @binding(4) var terrainTex: texture_2d_array<f32>;
@group(0) @binding(5) var terrainBlendTex: texture_2d_array<u32>;
@group(0) @binding(6) var terrainBlendMasks: texture_2d_array<f32>;
@group(0) @binding(7) var fogSampler: sampler;

const SUN_DIR = vec3f(0.466, 0.828, 0.311);
const TERRAIN_TEXTURE_WORLD_SIZE = 8.0;
const BLEND_TEXEL_CENTER = 0.5 / 32.0;
const TERRAIN_BLEND_PASS_COUNT = 3u;
const NO_OVERLAY_MATERIAL = 255u;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
}

@vertex
fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> VertexOut {
  var out: VertexOut;
  out.position = u.viewProj * vec4f(position, 1.0);
  out.worldPos = position;
  out.normal = normal;
  return out;
}

fn rotateBlendUv(uv: vec2f, rotation: u32) -> vec2f {
  var result = uv;

  switch rotation {
    case 1u: {
      result = vec2f(1.0 - uv.y, uv.x);
    }
    case 2u: {
      result = vec2f(1.0 - uv.x, 1.0 - uv.y);
    }
    case 3u: {
      result = vec2f(uv.y, 1.0 - uv.x);
    }
    default: {}
  }

  return result;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  // Interpolated vertex normals are enough at this mesh density; normalize to fix
  // interpolation shrinkage.
  let normal = normalize(in.normal);
  let tile = vec2u(clamp(floor(in.worldPos.xz), vec2f(0.0), vec2f(255.0)));
  let firstBlend = textureLoad(terrainBlendTex, tile, 0, 0);
  let terrainUv = in.worldPos.xz / TERRAIN_TEXTURE_WORLD_SIZE;
  let terrainUvDx = dpdx(terrainUv);
  let terrainUvDy = dpdy(terrainUv);
  var color = textureSample(terrainTex, terrainSampler, terrainUv, i32(firstBlend.x)).rgb;

  for (var blendPass = 0u; blendPass < TERRAIN_BLEND_PASS_COUNT; blendPass += 1u) {
    let blend = textureLoad(terrainBlendTex, tile, i32(blendPass), 0);

    if (blend.y == NO_OVERLAY_MATERIAL) {
      continue;
    }

    let topColor = textureSampleGrad(
      terrainTex,
      terrainSampler,
      terrainUv,
      i32(blend.y),
      terrainUvDx,
      terrainUvDy,
    ).rgb;
    var blendUv = rotateBlendUv(fract(in.worldPos.xz), blend.w);

    // Repeat sampling keeps terrain tiles seamless; clamp mask coordinates to texel
    // centers so the local 32x32 transition never wraps at a cell boundary.
    blendUv = clamp(blendUv, vec2f(BLEND_TEXEL_CENTER), vec2f(1.0 - BLEND_TEXEL_CENTER));
    let blendWeight = textureSampleLevel(
      terrainBlendMasks,
      terrainSampler,
      blendUv,
      i32(blend.z),
      0.0,
    ).r;

    color = mix(color, topColor, blendWeight);
  }

  // tile = floor(world xz) because tiles are 1x1 world units; unwalkable tints red --
  // with WALKABLE_MAX_SLOPE tuned near the rock threshold, red should mostly coincide
  // with rocky slopes.
  if (u.debug.x > 0.5) {
    if (textureLoad(walkTex, tile, 0).x < 0.5) {
      color = mix(color, vec3f(0.75, 0.12, 0.10), 0.45);
    }
  }

  // Classic AoM terrain is brightly ambient-lit with a restrained directional
  // term; preserving that balance keeps the diffuse tiles readable from RTS zoom.
  color *= 0.64 + 0.36 * max(dot(normal, SUN_DIR), 0.0);

  let fog = textureSample(fogTex, fogSampler, clamp(in.worldPos.xz / 256.0, vec2f(0.0), vec2f(1.0))).rg;
  let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let exploredColor = mix(vec3f(luminance), color, 0.45) * 0.55;

  color = mix(exploredColor * fog.x, color, fog.y);

  return vec4f(color, 1.0);
}
