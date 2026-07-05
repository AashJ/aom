struct Uniforms {
  viewProj: mat4x4f,
  // Camera basis, extracted CPU-side from viewProj rows 0/1. Those rows are the
  // camera right/up axes scaled by the projection, so normalize before use.
  right: vec4f,
  up: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var spriteSampler: sampler;
@group(0) @binding(3) var spriteTex: texture_2d<f32>;

const VILLAGER_ATLAS_COLUMNS = 7.0;
const VILLAGER_ATLAS_ROWS = 1.0;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
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
  @location(0) local: vec2f,
  @location(1) uv: vec2f,
  @location(2) part: f32,
  @location(3) instancePos: vec3f,
  @location(4) selected: f32,
  @location(5) frameIndex: f32,
) -> VertexOut {
  var world: vec3f;

  if (part > 0.5) {
    // Ring verts reuse local.xy as ground-plane XZ offsets. Unselected rings
    // collapse to the instance origin (zero-area triangles rasterize nothing).
    let ringOffset = local * step(0.5, selected);
    let ringXZ = instancePos.xz + ringOffset;
    world = vec3f(ringXZ.x, terrainHeight(ringXZ) + 0.08, ringXZ.y);
  } else {
    // Billboard: span the quad on the camera's right/up axes so the sprite
    // always faces the view; feet stay anchored at the instance position.
    let right = normalize(u.right.xyz);
    let upAxis = normalize(u.up.xyz);
    world = instancePos + right * local.x + upAxis * local.y;
  }

  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  let frame = clamp(
    floor(frameIndex + 0.5),
    0.0,
    VILLAGER_ATLAS_COLUMNS * VILLAGER_ATLAS_ROWS - 1.0,
  );
  let row = floor(frame / VILLAGER_ATLAS_COLUMNS);
  let column = frame - row * VILLAGER_ATLAS_COLUMNS;

  out.uv = (vec2f(column, row) + uv) / vec2f(VILLAGER_ATLAS_COLUMNS, VILLAGER_ATLAS_ROWS);
  out.part = part;
  out.selected = selected;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  // Sample before any branching: textureSample uses derivatives, which WGSL
  // only allows in uniform control flow. Ring fragments sample uv (0,0) and
  // ignore the result.
  let texel = textureSample(spriteTex, spriteSampler, in.uv);

  if (in.part > 0.5) {
    return vec4f(1.0, 0.85, 0.3, 1.0);
  }

  // Alpha-cut below 0.5 so transparent sprite regions never write depth and
  // punch holes in sprites behind them; blending softens the surviving edge.
  if (texel.a < 0.5) {
    discard;
  }

  var color = texel.rgb;
  color = mix(color, vec3f(1.0, 0.85, 0.3), in.selected * 0.35);
  return vec4f(color, texel.a);
}
