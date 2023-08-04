import { IBufferView, IMeshPrimitive } from "../GLTFSchema";
import { registerGLTFExtension } from "../parser/GLTFParser";
import { GLTFParserContext } from "../parser/GLTFParserContext";
import { GLTFExtensionMode, GLTFExtensionParser } from "./GLTFExtensionParser";
import { GLTFExtensionSchema, IGalaceanAnimation } from "./GLTFExtensionSchema";
import { MeshoptDecoder } from "./MeshoptDecoder";

interface MeshOptSchema {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride: number;
  mode: "ATTRIBUTES" | "TRIANGLES" | "INDICES";
  count: number;
  filter: "NONE" | "OCTAHEDRAL" | "QUATERNION" | "EXPONENTIAL";
}

@registerGLTFExtension("EXT_meshopt_compression", GLTFExtensionMode.CreateAndParse)
class EXT_meshopt_compression extends GLTFExtensionParser {
  override createAndParse(
    context: GLTFParserContext,
    schema: MeshOptSchema,
    bufferView: IBufferView,
    _: any
  ): Promise<Uint8Array> {
    const { count, byteStride, mode, filter, buffer, byteLength, byteOffset } = schema;
    return context.getBuffers().then((buffers) => {
      return MeshoptDecoder.decodeGltfBufferAsync(
        count,
        byteStride,
        new Uint8Array(buffers[buffer], byteOffset, byteLength),
        mode,
        filter
      );
    });
  }
}
