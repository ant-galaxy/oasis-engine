import { encoder } from "../..";
import { BufferWriter } from "../../utils/BufferWriter";

@encoder("Texture2D")
export class Texture2DEncoder {
  static encode(bufferWriter: BufferWriter, data: ArrayBuffer[], meta: any) {
    const {
      objectId,
      mipmap = 1,
      filterMode = 1,
      anisoLevel = 1,
      wrapModeU = 1,
      wrapModeV = 1,
      format = 1,
      width,
      height,
      isPixelBuffer = 0
    } = meta;

    // write data
    bufferWriter.writeStr(objectId);
    bufferWriter.writeUint8(mipmap);
    bufferWriter.writeUint8(filterMode);
    bufferWriter.writeUint8(anisoLevel);
    bufferWriter.writeUint8(wrapModeU);
    bufferWriter.writeUint8(wrapModeV);
    bufferWriter.writeUint8(format);
    bufferWriter.writeUint16(width);
    bufferWriter.writeUint16(height);
    bufferWriter.writeUint8(isPixelBuffer);

    // convert to ImageData
    bufferWriter.writeUint8(data.length);
    bufferWriter.writeImagesData(data);

    return bufferWriter.buffer;
  }
}
