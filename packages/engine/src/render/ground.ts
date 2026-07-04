import groundWgsl from "../shaders/ground.wgsl?raw";

export interface GroundRenderer {
  draw(pass: GPURenderPassEncoder, queue: GPUQueue, viewProj: Float32Array): void;
}

export function createGroundRenderer(device: GPUDevice, format: GPUTextureFormat): GroundRenderer {
  const module = device.createShaderModule({ code: groundWgsl });
  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module },
    fragment: { module, targets: [{ format }] },
    // Cull nothing until terrain owns the final winding and back-face policy.
    primitive: { topology: "triangle-list", cullMode: "none" },
  });
  const bindGroup = device.createBindGroup({
    // Auto layout is fine while exactly one pipeline consumes these uniforms.
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    draw(pass, queue, viewProj): void {
      // The math module stores column-major mat4s, so GPU upload needs no transpose.
      queue.writeBuffer(uniformBuffer, 0, viewProj);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
    },
  };
}
