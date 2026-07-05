struct Uniforms {
  viewProj: mat4x4f,
  params: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var heightTex: texture_2d<f32>;

struct VertexOut {
  @builtin(position) position: vec4f,
}

// Duplicated by design: shader modules are self-contained; sharing WGSL snippets
// is a build-tooling problem we don't have yet.
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
fn vs(@location(0) local: vec2f) -> VertexOut {
  let radius = mix(0.6, 1.8, u.params.z);
  let worldXZ = u.params.xy + local * radius;
  let world = vec3f(worldXZ.x, terrainHeight(worldXZ) + 0.06, worldXZ.y);

  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  return out;
}

@fragment
fn fs() -> @location(0) vec4f {
  // Same expanding ring, hostile hue.
  let color = mix(vec3f(1.0, 0.85, 0.3), vec3f(0.95, 0.25, 0.18), step(1.5, u.params.w));
  let a = (1.0 - u.params.z) * 0.9;

  return vec4f(color * a, a);
}
