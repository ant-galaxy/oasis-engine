import { Vector4 } from "@oasis-engine/math";
import { Camera } from "../Camera";
import { Component } from "../Component";
import { Entity } from "../Entity";
import { Material } from "../material/Material";
import { BasicRenderPipeline } from "../RenderPipeline/BasicRenderPipeline";
import { RenderContext } from "../RenderPipeline/RenderContext";
import { RenderElement } from "../RenderPipeline/RenderElement";
import { RenderPass } from "../RenderPipeline/RenderPass";
import { RenderBufferDepthFormat } from "../texture/enums/RenderBufferDepthFormat";
import { RenderColorTexture } from "../texture/RenderColorTexture";
import { RenderDepthTexture } from "../texture/RenderDepthTexture";
import { RenderTarget } from "../texture/RenderTarget";
import { Texture } from "../texture/Texture";
import { Texture2D } from "../texture/Texture2D";
import { TextureCubeMap } from "../texture/TextureCubeMap";
import { ProbeConfig } from "./type";

let cacheId = 0;

/**
 * 环境探针类，提供诸如反射折射等需要的功能
 * */
export abstract class Probe extends Component {
  protected readonly cacheId: number;
  private isCube: boolean;
  private oriClipPlane: Vector4[];

  private _camera: Camera;

  /** 优先级 excludeRenderList > renderAll > renderList */
  public excludeRenderList: Material[];
  public renderAll: boolean;
  public renderList: Material[];

  public renderPass: RenderPass;
  protected renderTarget: RenderTarget;
  protected renderTargetSwap: RenderTarget;

  /** 裁剪面 */
  public clipPlanes: Vector4[];

  public set camera(camera: Camera) {
    if (camera === this._camera) return;
    this._camera && this.renderPipeline.removeRenderPass(this.renderPass);
    this._camera = camera;
    camera && this.renderPipeline.addRenderPass(this.renderPass);
  }

  public get camera() {
    return this._camera;
  }

  /**
   * 探针所得 2D 纹理
   * */
  public get texture(): Texture2D | RenderColorTexture {
    return this.renderPass.renderTarget?.getColorTexture();
  }

  /**
   * 探针所得 深度 纹理
   * */
  public get depthTexture(): Texture2D | RenderDepthTexture {
    return this.renderPass.renderTarget?.depthTexture;
  }

  /**
   * 探针所得 立方体 纹理
   * */
  public get cubeTexture(): TextureCubeMap | RenderColorTexture {
    return this.renderPass.renderTarget?.getColorTexture();
  }

  protected get renderPipeline(): BasicRenderPipeline {
    return this.camera._renderPipeline;
  }

  /**
   * @deperated
   */
  protected get rhi(): any {
    return this.camera.scene.engine._hardwareRenderer;
  }

  /**
   * 获取需要渲染的真实队列.
   * 优先级 excludeRenderList > renderAll > renderList
   */
  protected get renderItems(): any {
    const opaqueQueue = this.renderPipeline.opaqueQueue;
    const transparentQueue = this.renderPipeline.transparentQueue;
    return opaqueQueue.items.concat(transparentQueue.items).filter((item: RenderElement) => {
      if (!item.primitive) return false;
      if (this.excludeRenderList.includes(item.material)) return false;
      if (this.renderAll) return true;
      if (this.renderList.includes(item.material)) return true;
    });
  }

  /** WebGL2 时，可以开启硬件层的 MSAA */
  public get samples() {
    return this.renderTarget.antiAliasing;
  }

  /**
   * 探针基类
   * @param {Entity} entity
   */
  protected constructor(entity: Entity) {
    super(entity);
    this.cacheId = cacheId++;

    this.renderPass = new RenderPass("_renderPass" + this.cacheId, -10);

    /** 自定义渲染管道 */
    this.renderPass.renderOverride = true;
    this.renderPass.preRender = this.preRender.bind(this);
    this.renderPass.render = this.render.bind(this);
    this.renderPass.postRender = this.postRender.bind(this);
  }

  /**
   * 初始化探针。
   * @param config - 初始化配置
   */
  public init(config: ProbeConfig = {}): void {
    this.isCube = !!config.isCube;
    this.camera = config.camera || this.scene._activeCameras[0];
    this.excludeRenderList = config.excludeRenderList || [];
    this.renderAll = !!config.renderAll;
    this.renderList = config.renderList || [];
    this.clipPlanes = config.clipPlanes || [];

    const width = config.width || 1024;
    const height = config.height || 1024;
    const samples = config.samples || 1;

    this.renderTarget = new RenderTarget(
      this.engine,
      width,
      height,
      new RenderColorTexture(this.engine, width, height, undefined, false, this.isCube),
      RenderBufferDepthFormat.Depth,
      samples
    );
    this.renderTargetSwap = new RenderTarget(
      this.engine,
      width,
      height,
      new RenderColorTexture(this.engine, width, height, undefined, false, this.isCube),
      RenderBufferDepthFormat.Depth,
      samples
    );

    this.renderPass.renderTarget = this.renderTarget;
  }

  protected preRender() {
    this.oriClipPlane = this.scene.clipPlanes;
    this.scene.clipPlanes = this.clipPlanes;
  }

  protected render() {
    const context = RenderContext._getRenderContext(this.camera);
    this.renderItems.forEach((item: RenderElement) => {
      const { component, primitive, subPrimitive, material } = item;
      if (!(component.renderPassFlag & this.renderPassFlag)) return;
      material.prepareDrawing(context, component, primitive);
      this.rhi.drawPrimitive(primitive, subPrimitive, material);
    });
  }

  protected postRender() {
    this.scene.clipPlanes = this.oriClipPlane;
    // 交换 FBO
    // prevent issue: Feedback Loops Between Textures and the Framebuffer.
    if (this.renderPass.enabled) {
      // 钩子
      if (this.onTextureChange) {
        if (this.isCube) {
          this.onTextureChange(this.cubeTexture);
        } else {
          this.onTextureChange(this.texture, this.depthTexture);
        }
      }

      if (this.renderPass.renderTarget === this.renderTarget) {
        this.renderPass.renderTarget = this.renderTargetSwap;
      } else {
        this.renderPass.renderTarget = this.renderTarget;
      }
    }
  }

  /**
   * 销毁 probe 以及 renderPass
   */
  _onDestroy(): void {
    this.enabled = false;
    this.renderPipeline.removeRenderPass(this.renderPass);

    // todo:delete
    this.renderTarget.destroy();
    this.renderTargetSwap.destroy();
  }

  /**
   * prevent issue: Feedback Loops Between Textures and the Framebuffer
   * 提供钩子让用户进行交换 Texture
   * @example
   * probe.onTextureChange = cubeTexture => {
   *   envLight.specularMap = cubeTexture;
   *   skybox.specularMap = cubeTexture;
   * }
   * */
  public onTextureChange(texture: Texture | RenderColorTexture, depthTexture?: Texture2D | RenderDepthTexture) {}

  /**
   * @override
   */
  _onEnable(): void {
    this.renderPass.enabled = true; // 继续 RTT
  }

  /**
   * @override
   */
  _onDisable(): void {
    this.renderPass.enabled = false; // 暂停 RTT（ render target to texture）
  }
}
