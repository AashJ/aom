struct Uniforms {
  rect: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

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
  return textureSample(tex, samp, in.uv);
}
