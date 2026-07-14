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

const HP_BAR_GEOMETRY_BASE_HEIGHT = 2.2;
// Keep in sync with minimap.wgsl.
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
  @location(2) selected: f32,
  @location(3) owner: f32,
  @location(4) hpFrac: f32,
  @location(5) buildFrac: f32,
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
  @location(0) baseLocal: vec2f,
  @location(1) uv: vec2f,
  @location(2) part: f32,
  @location(3) instancePos: vec3f,
  @location(4) selected: f32,
  @location(5) owner: f32,
  @location(6) hpFrac: f32,
  @location(7) uvU0: f32,
  @location(8) uvUW: f32,
  @location(9) sizeW: f32,
  @location(10) sizeH: f32,
  @location(11) buildFrac: f32,
  @location(12) ringScale: f32,
  @location(13) uvVBottom: f32,
  @location(14) uvV0: f32,
  @location(15) uvVH: f32,
) -> VertexOut {
  var world: vec3f;
  var local = baseLocal;
  let right = normalize(u.right.xyz);
  let upAxis = normalize(u.up.xyz);

  if (part > 1.5) {
    // Billboard: span the quad on the camera's right/up axes so the sprite
    // always faces the view; feet stay anchored at the instance position.
    // Undamaged armies don't render as bars.
    let show = max(1.0 - step(0.999, hpFrac), 1.0 - step(1.0, buildFrac));
    // Bars ride above each sprite's actual height; a tree's bar must not hover mid-canopy.
    local = vec2f(local.x, sizeH + local.y - HP_BAR_GEOMETRY_BASE_HEIGHT) * show;
    world = instancePos + right * local.x + upAxis * local.y;
  } else if (part > 0.5) {
    // Ring verts reuse local.xy as ground-plane XZ offsets. Unselected rings
    // collapse to the instance origin (zero-area triangles rasterize nothing).
    // Scale the ring radius without scaling its stroke thickness. Large-building rings
    // would otherwise become broad filled-looking bands.
    let radius = max(0.0, ringScale - (1.0 - length(local)));
    let ringOffset = normalize(local) * radius * step(0.5, selected);
    let ringXZ = instancePos.xz + ringOffset;
    world = vec3f(ringXZ.x, terrainHeight(ringXZ) + 0.08, ringXZ.y);
  } else {
    // Billboard: span the quad on the camera's right/up axes so the sprite
    // always faces the view; feet stay anchored at the instance position.
    local *= vec2f(sizeW, sizeH);
    world = instancePos + right * local.x + upAxis * local.y;
  }

  var out: VertexOut;
  out.position = u.viewProj * vec4f(world, 1.0);
  if (part > 1.5) {
    out.uv = uv;
  } else if (part > 0.5) {
    out.uv = vec2f(uvU0 + uv.x * uvUW, uv.y);
  } else {
    out.uv = vec2f(uvU0 + uv.x * uvUW, uvV0 + uv.y * uvVH * uvVBottom);
  }
  out.part = part;
  out.selected = selected;
  out.owner = owner;
  out.hpFrac = hpFrac;
  out.buildFrac = buildFrac;
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  // Sample before any branching: textureSample uses derivatives, which WGSL
  // only allows in uniform control flow. Ring fragments sample uv (0,0) and
  // ignore the result.
  let texel = textureSample(spriteTex, spriteSampler, in.uv);

  if (in.part > 1.5) {
    // Unlit UI, like the ring.
    let hpFrac = in.hpFrac;
    // The bar doubles as the construction progress bar; damaged-while-building displays progress, an accepted M6 simplification.
    let barFrac = select(hpFrac, in.buildFrac, in.buildFrac < 1.0);
    let filled = step(in.uv.x, barFrac);
    let color = mix(vec3f(0.25, 0.05, 0.05), mix(vec3f(0.85, 0.2, 0.15), vec3f(0.3, 0.8, 0.3), barFrac), filled);
    return vec4f(color, 1.0);
  }

  if (in.part > 0.5) {
    // Rings only render when selected, so they stay a selection affordance -- owner-hued, white-lifted.
    return vec4f(mix(PLAYER_PALETTE[u32(in.owner) % 4u], vec3f(1.0), 0.45), 1.0);
  }

  // Alpha-cut below 0.5 so transparent sprite regions never write depth and
  // punch holes in sprites behind them; blending softens the surviving edge.
  if (texel.a < 0.5) {
    discard;
  }

  if (in.hpFrac < 0.0) {
    // Green = placeable, red = blocked/unaffordable.
    let ok = step(-1.5, in.hpFrac);
    let color = texel.rgb * mix(vec3f(1.2, 0.4, 0.35), vec3f(0.5, 1.1, 0.6), ok);
    return vec4f(color * 0.55, texel.a * 0.55);
  }

  // Multiply-tint keeps the sprite's own shading; 0.45 keeps faces readable while armies stay unmistakable.
  let scaffold = mix(vec3f(0.55, 0.45, 0.35), vec3f(1.0), in.buildFrac);
  var color = texel.rgb * mix(vec3f(1.0), PLAYER_PALETTE[u32(in.owner) % 4u], 0.45);
  color *= scaffold;
  color = mix(color, vec3f(1.0, 0.85, 0.3), in.selected * 0.35);
  return vec4f(color, texel.a);
}
