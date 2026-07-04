struct Uniforms {
  viewProj: mat4x4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

const MAP_EXTENT = 256.0;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldXZ: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOut {
  // WGSL forbids dynamic indexing into module-scope const arrays, so keep the
  // generated plane corners function-local.
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0),
    vec2f(MAP_EXTENT, 0.0),
    vec2f(0.0, MAP_EXTENT),
    vec2f(0.0, MAP_EXTENT),
    vec2f(MAP_EXTENT, 0.0),
    vec2f(MAP_EXTENT, MAP_EXTENT),
  );
  let worldXZ = corners[i];

  var out: VertexOut;
  out.position = u.viewProj * vec4f(worldXZ.x, 0.0, worldXZ.y, 1.0);
  out.worldXZ = worldXZ;
  return out;
}

// Screen-space derivatives keep grid lines about 1px at any zoom with no
// texture sampling or aliasing.
fn gridIntensity(worldXZ: vec2f, cell: f32) -> f32 {
  let coord = worldXZ / cell;
  let g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  return 1.0 - min(min(g.x, g.y), 1.0);
}

@fragment
fn fs(@location(0) worldXZ: vec2f) -> @location(0) vec4f {
  let fine = gridIntensity(worldXZ, 1.0) * 0.5;
  let coarse = gridIntensity(worldXZ, 8.0) * 0.6;
  var color = vec3f(0.13, 0.17, 0.13);

  color = mix(color, vec3f(0.21, 0.26, 0.21), fine);
  color = mix(color, vec3f(0.28, 0.34, 0.30), coarse);

  return vec4f(color, 1.0);
}
