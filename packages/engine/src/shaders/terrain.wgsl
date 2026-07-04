struct Uniforms {
  viewProj: mat4x4f,
  debug: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var walkTex: texture_2d<f32>;

const SUN_DIR = vec3f(0.466, 0.828, 0.311);

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

fn gridIntensity(worldXZ: vec2f, cell: f32) -> f32 {
  let coord = worldXZ / cell;
  let g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  return 1.0 - min(min(g.x, g.y), 1.0);
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  // Interpolated vertex normals are enough at this mesh density; normalize to fix
  // interpolation shrinkage.
  let normal = normalize(in.normal);
  let grass = vec3f(0.16, 0.23, 0.13);
  let dryGrass = vec3f(0.24, 0.27, 0.15);
  let rock = vec3f(0.35, 0.33, 0.28);
  var color = mix(grass, dryGrass, smoothstep(2.0, 6.0, in.worldPos.y));

  color = mix(color, rock, smoothstep(6.0, 11.0, in.worldPos.y));
  color = mix(color, rock, 1.0 - smoothstep(0.65, 0.85, normal.y));
  color = mix(color, vec3f(0.42, 0.46, 0.36), gridIntensity(in.worldPos.xz, 1.0) * 0.12);

  // tile = floor(world xz) because tiles are 1x1 world units; unwalkable tints red --
  // with WALKABLE_MAX_SLOPE tuned near the rock threshold, red should mostly coincide
  // with rocky slopes.
  if (u.debug.x > 0.5) {
    let tile = vec2u(clamp(floor(in.worldPos.xz), vec2f(0.0), vec2f(255.0)));

    if (textureLoad(walkTex, tile, 0).x < 0.5) {
      color = mix(color, vec3f(0.75, 0.12, 0.10), 0.45);
    }
  }

  color *= 0.45 + 0.55 * max(dot(normal, SUN_DIR), 0.0);

  return vec4f(color, 1.0);
}
