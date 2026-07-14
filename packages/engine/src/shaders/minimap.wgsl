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

struct FrameOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
}

@vertex
fn vs_frame(@builtin(vertex_index) i: u32) -> FrameOut {
  // The terrain diamond ends at Manhattan radius 0.5. Extending the frame to 0.555
  // leaves a broad enough bevel to match the classic HUD without changing hit testing.
  var corners = array<vec2f, 6>(
    vec2f(0.5, 1.055),
    vec2f(1.055, 0.5),
    vec2f(0.5, -0.055),
    vec2f(0.5, -0.055),
    vec2f(-0.055, 0.5),
    vec2f(0.5, 1.055),
  );
  let local = corners[i];

  var out: FrameOut;
  out.position = vec4f(mix(u.rect.xy, u.rect.zw, local), 0.0, 1.0);
  out.local = local;
  return out;
}

@fragment
fn fs_frame(in: FrameOut) -> @location(0) vec4f {
  let diamondRadius = abs(in.local.x - 0.5) + abs(in.local.y - 0.5);
  let bevel = clamp((diamondRadius - 0.5) / 0.055, 0.0, 1.0);
  let innerBronze = vec3f(0.16, 0.105, 0.045);
  let agedGold = vec3f(0.68, 0.54, 0.25);
  let limestone = vec3f(0.78, 0.72, 0.52);
  let outerBronze = vec3f(0.20, 0.135, 0.055);
  var color = mix(innerBronze, agedGold, smoothstep(0.0, 0.22, bevel));

  color = mix(color, limestone, smoothstep(0.22, 0.48, bevel));
  color = mix(color, agedGold, smoothstep(0.58, 0.75, bevel));
  color = mix(color, outerBronze, smoothstep(0.78, 1.0, bevel));

  // Light from the upper-left gives each edge the chunky carved bevel of the original UI.
  let directionalLight = 0.88 + (in.local.y - in.local.x) * 0.12;
  let stoneGrain = sin((in.local.x + in.local.y) * 170.0) * 0.018;
  return vec4f(color * directionalLight + vec3f(stoneGrain), 1.0);
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  let terrain = textureSample(tex, samp, in.uv);
  let fog = textureSample(fogTex, samp, in.uv).rg;
  let luminance = dot(terrain.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let explored = mix(vec3f(luminance), terrain.rgb, 0.42) * 0.58;
  let color = mix(explored * fog.x, terrain.rgb, fog.y);

  return vec4f(color, terrain.a);
}

@vertex
fn vs_line(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  return vec4f(pos, 0.0, 1.0);
}

@fragment
fn fs_line() -> @location(0) vec4f {
  return vec4f(1.0, 0.88, 0.42, 1.0);
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
  // Pure dark hues vanish on the terrain texture, so classic-style pips get a white lift.
  let owner = u32(in.owner);
  // Neutral resources read as map features, not a fourth player.
  let base = select(mix(PLAYER_PALETTE[owner % 4u], vec3f(1.0), 0.32), vec3f(0.28, 0.56, 0.18), owner == 255u);
  let highlight = vec3f(1.0, 0.85, 0.3);
  return vec4f(mix(base, highlight, in.selected), 1.0);
}
