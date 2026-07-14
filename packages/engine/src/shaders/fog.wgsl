@group(0) @binding(0) var rawFog: texture_2d<u32>;
@group(0) @binding(1) var filteredFog: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn cs(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(rawFog, 0);

  if (id.x >= size.x || id.y >= size.y) {
    return;
  }

  var explored = 0.0;
  var visible = 0.0;

  for (var dz = -1; dz <= 1; dz += 1) {
    for (var dx = -1; dx <= 1; dx += 1) {
      let samplePos = vec2u(
        clamp(vec2i(id.xy) + vec2i(dx, dz), vec2i(0), vec2i(size) - vec2i(1)),
      );
      let state = textureLoad(rawFog, samplePos, 0).x;

      explored += select(0.0, 1.0, state >= 1u);
      visible += select(0.0, 1.0, state >= 2u);
    }
  }

  textureStore(filteredFog, id.xy, vec4f(explored / 9.0, visible / 9.0, 0.0, 1.0));
}
