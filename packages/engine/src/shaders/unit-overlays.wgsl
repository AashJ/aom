struct Uniforms {
  viewProj: mat4x4f,
  right: vec4f,
  up: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var heightTex: texture_2d<f32>;

const HP_BAR_GEOMETRY_BASE_HEIGHT = 2.2;
const PLAYER_PALETTE = array<vec3f, 4>(
  vec3f(0.32, 0.48, 0.85),
  vec3f(0.82, 0.26, 0.20),
  vec3f(0.30, 0.68, 0.34),
  vec3f(0.88, 0.72, 0.25),
);

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) part: f32,
  @location(2) owner: f32,
  @location(3) hpFrac: f32,
  @location(4) buildFrac: f32,
}

fn terrainHeight(worldXZ: vec2f) -> f32 {
  let clamped = clamp(worldXZ, vec2f(0.0), vec2f(256.0));
  let p0 = vec2u(floor(clamped));
  let p1 = min(p0 + vec2u(1u), vec2u(256u));
  let f = clamped - vec2f(p0);
  let h00 = textureLoad(heightTex, vec2u(p0.x, p0.y), 0).x;
  let h10 = textureLoad(heightTex, vec2u(p1.x, p0.y), 0).x;
  let h01 = textureLoad(heightTex, vec2u(p0.x, p1.y), 0).x;
  let h11 = textureLoad(heightTex, vec2u(p1.x, p1.y), 0).x;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}

@vertex
fn vs(
  @location(0) baseLocal: vec2f,
  @location(1) uv: vec2f,
  @location(2) part: f32,
  @location(3) instancePos: vec3f,
  @location(4) selected: f32,
  @location(5) owner: f32,
  @location(6) hpFrac: f32,
  @location(7) buildFrac: f32,
  @location(8) sizeH: f32,
  @location(9) ringScale: f32,
) -> VertexOut {
  var local = baseLocal;
  var world: vec3f;

  if (part > 1.5) {
    let show = max(1.0 - step(0.999, hpFrac), 1.0 - step(1.0, buildFrac));
    local = vec2f(local.x, sizeH + local.y - HP_BAR_GEOMETRY_BASE_HEIGHT) * show;
    world = instancePos + normalize(u.right.xyz) * local.x + normalize(u.up.xyz) * local.y;
  } else {
    let radius = max(0.0, ringScale - (1.0 - length(local)));
    let ringOffset = normalize(local) * radius * step(0.5, selected);
    let ringXZ = instancePos.xz + ringOffset;
    world = vec3f(ringXZ.x, terrainHeight(ringXZ) + 0.08, ringXZ.y);
  }

  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  out.uv = uv;
  out.part = part;
  out.owner = owner;
  out.hpFrac = hpFrac;
  out.buildFrac = buildFrac;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  if (in.part > 1.5) {
    let barFrac = select(in.hpFrac, in.buildFrac, in.buildFrac < 1.0);
    let filled = step(in.uv.x, barFrac);
    let color = mix(
      vec3f(0.25, 0.05, 0.05),
      mix(vec3f(0.85, 0.2, 0.15), vec3f(0.3, 0.8, 0.3), barFrac),
      filled,
    );
    return vec4f(color, 1.0);
  }

  return vec4f(mix(PLAYER_PALETTE[u32(in.owner) % 4u], vec3f(1.0), 0.45), 1.0);
}
