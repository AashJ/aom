struct Uniforms {
  viewProj: mat4x4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var heightTex: texture_2d<f32>;

const SUN_DIR = vec3f(0.466, 0.828, 0.311);

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) part: f32,
  @location(2) selected: f32,
}

fn terrainHeight(worldXZ: vec2f) -> f32 {
  let clamped = clamp(worldXZ, vec2f(0.0), vec2f(256.0));
  let p0 = vec2u(floor(clamped));
  let p1 = min(p0 + vec2u(1u), vec2u(256u));
  let f = clamped - vec2f(p0);
  // textureLoad is legal in vertex stages and in non-uniform control flow; no derivatives are involved.
  let h00 = textureLoad(heightTex, vec2u(p0.x, p0.y), 0).x;
  let h10 = textureLoad(heightTex, vec2u(p1.x, p0.y), 0).x;
  let h01 = textureLoad(heightTex, vec2u(p0.x, p1.y), 0).x;
  let h11 = textureLoad(heightTex, vec2u(p1.x, p1.y), 0).x;
  let hx0 = mix(h00, h10, f.x);
  let hx1 = mix(h01, h11, f.x);

  return mix(hx0, hx1, f.y);
}

@vertex
fn vs(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) part: f32,
  @location(3) instancePos: vec3f,
  @location(4) selected: f32,
) -> VertexOut {
  let hidden = part * (1.0 - step(0.5, selected));
  // Hidden ring verts collapse to zero-area triangles, so one draw serves selected
  // and unselected units without shader branching cost.
  let local = position * (1.0 - hidden);
  var world = vec3f(local.x * 0.6, local.y * 1.2, local.z * 0.6) + instancePos;

  if (part > 0.5) {
    let ringWorldXZ = instancePos.xz + local.xz * 0.6;
    // Each ring vertex sits on the terrain under it, not under the unit center; collapsed verts
    // all sample the unit center, staying degenerate.
    world = vec3f(ringWorldXZ.x, terrainHeight(ringWorldXZ) + 0.08, ringWorldXZ.y);
  }

  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  out.normal = normal;
  out.part = part;
  out.selected = selected;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  if (in.part > 0.5) {
    // Geometry replaced the discard trick.
    return vec4f(1.0, 0.85, 0.3, 1.0);
  }

  let normal = normalize(in.normal);
  var color = vec3f(0.30, 0.44, 0.72);

  color = mix(color, vec3f(0.95, 0.9, 0.5), in.selected * 0.6);
  color *= 0.45 + 0.55 * max(dot(normal, SUN_DIR), 0.0);

  return vec4f(color, 1.0);
}
