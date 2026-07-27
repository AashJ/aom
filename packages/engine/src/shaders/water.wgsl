struct Uniforms {
  viewProj: mat4x4f,
  params: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var fogTex: texture_2d<f32>;
@group(0) @binding(2) var fogSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
}

@vertex
fn vs(@location(0) position: vec2f) -> VertexOut {
  var out: VertexOut;
  let worldPosition = vec3f(position.x, u.params.y, position.y);
  out.position = u.viewProj * vec4f(worldPosition, 1.0);
  out.worldPos = worldPosition;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let time = u.params.x;
  let waveA = sin(in.worldPos.x * 0.31 + in.worldPos.z * 0.17 + time * 1.15);
  let waveB = sin(in.worldPos.x * -0.13 + in.worldPos.z * 0.37 - time * 0.83);
  let ripple = waveA * 0.5 + waveB * 0.5;
  let deep = vec3f(0.055, 0.205, 0.245);
  let lit = vec3f(0.12, 0.38, 0.40);
  var color = mix(deep, lit, ripple * 0.5 + 0.5);
  let glint = pow(max(0.0, ripple), 10.0) * 0.22;
  color += vec3f(glint * 0.7, glint * 0.85, glint);

  let fog = textureSample(
    fogTex,
    fogSampler,
    clamp(in.worldPos.xz / 256.0, vec2f(0.0), vec2f(1.0)),
  ).rg;
  let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let explored = mix(vec3f(luminance), color, 0.5) * 0.55;
  color = mix(explored * fog.x, color, fog.y);

  return vec4f(color, 0.82);
}
