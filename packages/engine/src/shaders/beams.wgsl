struct Uniforms {
  viewProj: mat4x4f,
  viewDirection: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var beamSampler: sampler;
@group(0) @binding(2) var beamTexture: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) opacity: f32,
}

@vertex
fn vs(
  @location(0) local: vec2f,
  @location(1) uv: vec2f,
  @location(2) start: vec3f,
  @location(3) width: f32,
  @location(4) end: vec3f,
  @location(5) opacity: f32,
) -> VertexOut {
  let direction = normalize(end - start);
  let crossed = cross(normalize(u.viewDirection.xyz), direction);
  let side = select(vec3f(1.0, 0.0, 0.0), normalize(crossed), length(crossed) > 0.0001);
  let world = mix(start, end, local.x) + side * local.y * width;
  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  out.uv = uv;
  out.opacity = opacity;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let texel = textureSample(beamTexture, beamSampler, in.uv);
  let alpha = texel.a * in.opacity;
  return vec4f(texel.rgb * alpha, alpha);
}
