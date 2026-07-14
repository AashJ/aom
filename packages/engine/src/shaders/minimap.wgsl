struct Uniforms {
  rect: vec4f,
}

struct DotUniforms {
  halfSize: vec2f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;
@group(0) @binding(3) var fogTex: texture_2d<f32>;
@group(0) @binding(0) var<uniform> u2: DotUniforms;

// Keep in sync with units.wgsl.
const PLAYER_PALETTE = array<vec3f, 4>(
  vec3f(0.32, 0.48, 0.85),
  vec3f(0.82, 0.26, 0.20),
  vec3f(0.30, 0.68, 0.34),
  vec3f(0.88, 0.72, 0.25),
);

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOut {
  // The game camera's yaw is fixed at 45°, so the square world reads as a diamond on
  // screen. Match that player orientation: the ground-projected view direction (+x+z)
  // is the diamond top. The frustum-footprint chunk must reuse this exact mapping:
  // top    rect(0.5, 1.0) -> uv(1.0, 1.0) world (256, 256)
  // right  rect(1.0, 0.5) -> uv(0.0, 1.0) world (0, 256)
  // bottom rect(0.5, 0.0) -> uv(0.0, 0.0) world (0, 0)
  // left   rect(0.0, 0.5) -> uv(1.0, 0.0) world (256, 0)
  var corners = array<vec2f, 6>(
    vec2f(0.5, 1.0),
    vec2f(1.0, 0.5),
    vec2f(0.5, 0.0),
    vec2f(0.5, 0.0),
    vec2f(0.0, 0.5),
    vec2f(0.5, 1.0),
  );
  var uvs = array<vec2f, 6>(
    vec2f(1.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0),
  );
  let corner = corners[i];
  let clip = mix(u.rect.xy, u.rect.zw, corner);

  var out: VertexOut;
  out.position = vec4f(clip, 0.0, 1.0);
  out.uv = uvs[i];
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let terrain = textureSample(tex, samp, in.uv);
  let fog = textureSample(fogTex, samp, in.uv).rg;
  let luminance = dot(terrain.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let explored = mix(vec3f(luminance), terrain.rgb, 0.45) * 0.55;
  let color = mix(explored * fog.x, terrain.rgb, fog.y);

  return vec4f(color, terrain.a);
}

@vertex
fn vs_line(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  return vec4f(pos, 0.0, 1.0);
}

@fragment
fn fs_line() -> @location(0) vec4f {
  return vec4f(0.92, 0.95, 1.0, 1.0);
}

struct DotOut {
  @builtin(position) position: vec4f,
  @location(0) selected: f32,
  @location(1) owner: f32,
}

@vertex
fn vs_dot(
  @builtin(vertex_index) i: u32,
  @location(0) center: vec2f,
  @location(1) selected: f32,
  @location(2) owner: f32,
) -> DotOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let pos = center + corners[i] * u2.halfSize;

  var out: DotOut;
  out.position = vec4f(pos, 0.0, 1.0);
  out.selected = selected;
  out.owner = owner;
  return out;
}

@fragment
fn fs_dot(in: DotOut) -> @location(0) vec4f {
  // Dots are 2-3 px, pure dark hues vanish on the terrain texture.
  let owner = u32(in.owner);
  // Neutral resources read as map features, not a fourth player.
  let base = select(mix(PLAYER_PALETTE[owner % 4u], vec3f(1.0), 0.25), vec3f(0.25, 0.5, 0.2), owner == 255u);
  let highlight = vec3f(1.0, 0.85, 0.3);
  return vec4f(mix(base, highlight, in.selected), 1.0);
}
