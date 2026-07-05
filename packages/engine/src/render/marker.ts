import { VERTS_PER_ROW } from "@aom/sim";
import { DEPTH_FORMAT } from "../gpu/device";
import markerWgsl from "../shaders/marker.wgsl?raw";

export interface MarkerRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    x: number,
    z: number,
    progress: number,
    kind: number,
  ): void;
}

const RING_SEGMENTS = 24;
const RING_INNER = 0.85;
const RING_OUTER = 1.0;
const RING_INDEX_COUNT = 144;

export function createMarkerRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  heights: Float32Array,
): MarkerRenderer {
  const vertexData = new Float32Array((RING_SEGMENTS + 1) * 2 * 2);
  const indexData = new Uint16Array(RING_INDEX_COUNT);

  for (let s = 0; s <= RING_SEGMENTS; s += 1) {
    const angle = (s / RING_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const offset = s * 4;

    vertexData[offset] = cos * RING_INNER;
    vertexData[offset + 1] = sin * RING_INNER;
    vertexData[offset + 2] = cos * RING_OUTER;
    vertexData[offset + 3] = sin * RING_OUTER;
  }

  for (let s = 0; s < RING_SEGMENTS; s += 1) {
    const i0 = s * 2;
    const o0 = i0 + 1;
    const i1 = i0 + 2;
    const o1 = i0 + 3;
    const offset = s * 6;

    indexData[offset] = i0;
    indexData[offset + 1] = i1;
    indexData[offset + 2] = o1;
    indexData[offset + 3] = i0;
    indexData[offset + 4] = o1;
    indexData[offset + 5] = o0;
  }

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const uniformStaging = new Float32Array(20);
  const uniformBuffer = device.createBuffer({
    size: uniformStaging.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const heightTexture = device.createTexture({
    size: [VERTS_PER_ROW, VERTS_PER_ROW],
    format: "r32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const module = device.createShaderModule({ code: markerWgsl });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }],
        },
      ],
    },
    fragment: {
      module,
      targets: [
        {
          format,
          // FS outputs premultiplied color.
          blend: {
            color: { operation: "add", srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            alpha: { operation: "add", srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
    // Mountains occlude the marker, but a transient effect must never write depth.
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "less" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: heightTexture.createView() },
    ],
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);
  // The 264 KB copy buys module independence over cross-renderer texture sharing.
  device.queue.writeTexture(
    { texture: heightTexture },
    heights,
    { bytesPerRow: VERTS_PER_ROW * 4, rowsPerImage: VERTS_PER_ROW },
    { width: VERTS_PER_ROW, height: VERTS_PER_ROW },
  );

  return {
    draw(pass, queue, viewProj, x, z, progress, kind): void {
      uniformStaging.set(viewProj);
      uniformStaging[16] = x;
      uniformStaging[17] = z;
      uniformStaging[18] = progress;
      uniformStaging[19] = kind;
      queue.writeBuffer(uniformBuffer, 0, uniformStaging);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      pass.drawIndexed(RING_INDEX_COUNT);
    },
  };
}
