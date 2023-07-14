import {
  AssetPromise,
  AssetType,
  Engine,
  EngineConfiguration,
  GLCapabilityType,
  LoadItem,
  Loader,
  Logger,
  ResourceManager,
  Texture,
  Texture2D,
  TextureCube,
  TextureCubeFace,
  TextureFormat,
  resourceLoader
} from "@galacean/engine-core";
import { BinomialLLCTranscoder } from "./transcoder/BinomialLLCTranscoder";
import { KTX2Container } from "./KTX2Container";
import { KhronosTranscoder } from "./transcoder/KhronosTranscoder";
import { KTX2TargetFormat } from "./KTX2TargetFormat";
import { WebGLEngine } from "@galacean/engine-rhi-webgl";
import { MathUtil } from "@galacean/engine-math";
import { TranscodeResult } from "./transcoder/AbstractTranscoder";

@resourceLoader(AssetType.KTX, ["ktx2"])
export class KTX2Loader extends Loader<Texture2D | TextureCube> {
  private static _binomialLLCTranscoder: BinomialLLCTranscoder;
  private static _khronosTranscoder: KhronosTranscoder;
  private static _supportedMap = {
    [KTX2TargetFormat.ASTC]: [GLCapabilityType.astc],
    [KTX2TargetFormat.ETC]: [GLCapabilityType.etc],
    [KTX2TargetFormat.DXT]: [GLCapabilityType.s3tc],
    [KTX2TargetFormat.PVRTC]: [GLCapabilityType.pvrtc, GLCapabilityType.pvrtc_webkit]
  };

  /**
   * Destroy ktx2 transcoder worker.
   */
  static destroy(): void {
    if (this._binomialLLCTranscoder) this._binomialLLCTranscoder.destroy();
    if (this._khronosTranscoder) this._khronosTranscoder.destroy();
    this._binomialLLCTranscoder = null;
    this._khronosTranscoder = null;
  }

  private static _decideTargetFormat(
    engine: Engine,
    ktx2Container: KTX2Container,
    formatPriorities?: KTX2TargetFormat[]
  ): KTX2TargetFormat {
    // @ts-ignore
    const renderer = engine._hardwareRenderer as WebGLRenderer;

    const targetFormat = this._detectSupportedFormat(renderer, formatPriorities) as KTX2TargetFormat;

    if (
      targetFormat === KTX2TargetFormat.PVRTC &&
      (!MathUtil.isPowerOf2(ktx2Container.pixelWidth) ||
        !MathUtil.isPowerOf2(ktx2Container.pixelHeight) ||
        ktx2Container.pixelWidth !== ktx2Container.pixelHeight)
    ) {
      Logger.warn("PVRTC image need power of 2 and width===height, downgrade to RGBA8");
      return KTX2TargetFormat.RGBA8;
    }

    if (targetFormat === null) {
      Logger.warn("Can't support any compressed texture, downgrade to RGBA8");
      return KTX2TargetFormat.RGBA8;
    }
    // TODO support bc7: https://github.com/galacean/engine/issues/1371
    return targetFormat;
  }

  private static _detectSupportedFormat(
    renderer: any,
    formatPriorities: KTX2TargetFormat[] = [
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.DXT,
      KTX2TargetFormat.PVRTC
    ]
  ): KTX2TargetFormat | null {
    for (let i = 0; i < formatPriorities.length; i++) {
      const capabilities = this._supportedMap[formatPriorities[i]];
      for (let j = 0; j < capabilities.length; j++) {
        if (renderer.canIUse(capabilities[j])) {
          return formatPriorities[i];
        }
      }
    }
    return null;
  }

  private static _getBinomialLLCTranscoder(workerCount: number = 4) {
    return (this._binomialLLCTranscoder ??= new BinomialLLCTranscoder(workerCount));
  }

  private static _getKhronosTranscoder(workerCount: number = 4) {
    return (this._khronosTranscoder ??= new KhronosTranscoder(workerCount, KTX2TargetFormat.ASTC));
  }

  override initialize(engine: Engine, configuration: EngineConfiguration): Promise<void> {
    if (configuration.ktx2Loader) {
      const options = configuration.ktx2Loader;
      if (
        // @ts-ignore
        KTX2Loader._detectSupportedFormat(engine._hardwareRenderer, options.formatPriorities) === KTX2TargetFormat.ASTC
      ) {
        return KTX2Loader._getKhronosTranscoder(options.workerCount).init();
      } else {
        return KTX2Loader._getBinomialLLCTranscoder(options.workerCount).init();
      }
    }
  }

  /**
   * @internal
   */
  load(
    item: LoadItem & { params?: KTX2Params },
    resourceManager: ResourceManager
  ): AssetPromise<Texture2D | TextureCube> {
    return this.request<ArrayBuffer>(item.url!, { type: "arraybuffer" }).then((buffer) => {
      const ktx2Container = new KTX2Container(buffer);
      const formatPriorities = item.params?.formatPriorities;
      const targetFormat = KTX2Loader._decideTargetFormat(resourceManager.engine, ktx2Container, formatPriorities);
      let transcodeResultPromise: Promise<any>;
      if (targetFormat === KTX2TargetFormat.ASTC && ktx2Container.isUASTC) {
        const khronosWorker = KTX2Loader._getKhronosTranscoder();
        transcodeResultPromise = khronosWorker.init().then(() => khronosWorker.transcode(ktx2Container));
      } else {
        const binomialLLCWorker = KTX2Loader._getBinomialLLCTranscoder();
        transcodeResultPromise = binomialLLCWorker.init().then(() => binomialLLCWorker.transcode(buffer, targetFormat));
      }
      return transcodeResultPromise.then((result) => {
        const { width, height, faces } = result;
        const faceCount = faces.length;
        const mipmaps = faces[0];
        const mipmap = mipmaps.length > 1;
        const engineFormat = this._getEngineTextureFormat(targetFormat, result);
        let texture: Texture;
        if (faceCount !== 6) {
          texture = new Texture2D(resourceManager.engine, width, height, engineFormat, mipmap);
          for (let mipLevel = 0; mipLevel < mipmaps.length; mipLevel++) {
            const { data } = mipmaps[mipLevel];
            (texture as Texture2D).setPixelBuffer(data, mipLevel);
          }
        } else {
          texture = new TextureCube(resourceManager.engine, height, engineFormat, mipmap);
          for (let i = 0; i < faces.length; i++) {
            const faceData = faces[i];
            for (let mipLevel = 0; mipLevel < mipmaps.length; mipLevel++) {
              (texture as TextureCube).setPixelBuffer(TextureCubeFace.PositiveX + i, faceData[mipLevel].data, mipLevel);
            }
          }
        }
        const params = ktx2Container.keyValue["GalaceanTextureParams"] as Uint8Array;
        if (params) {
          texture.wrapModeU = params[0];
          texture.wrapModeV = params[1];
          texture.filterMode = params[2];
          texture.anisoLevel = params[3];
        }
        return texture as Texture2D | TextureCube;
      });
    });
  }

  private _getEngineTextureFormat(basisFormat: KTX2TargetFormat, transcodeResult: TranscodeResult) {
    const { hasAlpha } = transcodeResult;
    switch (basisFormat) {
      case KTX2TargetFormat.ASTC:
        return TextureFormat.ASTC_4x4;
      case KTX2TargetFormat.ETC:
        return hasAlpha ? TextureFormat.ETC2_RGBA8 : TextureFormat.ETC2_RGB;
      case KTX2TargetFormat.DXT:
        return hasAlpha ? TextureFormat.DXT5 : TextureFormat.DXT1;
      case KTX2TargetFormat.PVRTC:
        return hasAlpha ? TextureFormat.PVRTC_RGBA4 : TextureFormat.PVRTC_RGB4;
      case KTX2TargetFormat.RGBA8:
        return TextureFormat.R8G8B8A8;
    }
  }
}

/**
 * KTX2 loader params interface.
 */
export interface KTX2Params {
  /** Transcoder Format priorities, default is ASTC/ETC/DXT/PVRTC/RGBA8. */
  formatPriorities: KTX2TargetFormat[];
}

declare module "@galacean/engine-core" {
  interface EngineConfiguration {
    /** ktx2 options */
    ktx2Loader?: {
      /** Worker count for transcoder, default is 4. */
      workerCount?: number;
      /** Transcoder Format priorities, default is ASTC/ETC/DXT/PVRTC/RGBA8. */
      formatPriorities?: KTX2TargetFormat[];
    };
  }
}
