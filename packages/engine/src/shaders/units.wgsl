struct Uniforms {
  viewProj: mat4x4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

const SUN_DIR = vec3f(0.466, 0.828, 0.311);

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) selected: f32,
}

@vertex
fn vs(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) instancePos: vec3f,
  @location(3) selected: f32,
) -> VertexOut {
  let world = vec3f(position.x * 0.6, position.y * 1.2, position.z * 0.6) + instancePos;

  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  out.normal = normal;
  out.selected = selected;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  var color = vec3f(0.30, 0.44, 0.72);

  color = mix(color, vec3f(0.95, 0.9, 0.5), in.selected * 0.6);
  color *= 0.45 + 0.55 * max(dot(normal, SUN_DIR), 0.0);

  return vec4f(color, 1.0);
}
