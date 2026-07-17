struct Uniforms {
  viewProj: mat4x4f,
  right: vec4f,
  up: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var particleSampler: sampler;
@group(0) @binding(2) var particleTexture: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) opacity: f32,
}

@vertex
fn vs(
  @location(0) local: vec2f,
  @location(1) uv: vec2f,
  @location(2) instancePosition: vec3f,
  @location(3) size: f32,
  @location(4) opacity: f32,
) -> VertexOut {
  let world = instancePosition
    + normalize(u.right.xyz) * local.x * size
    + normalize(u.up.xyz) * local.y * size;
  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  out.uv = uv;
  out.opacity = opacity;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let texel = textureSample(particleTexture, particleSampler, in.uv);
  return vec4f(texel.rgb * in.opacity, in.opacity);
}
