import { ShaderData, ShaderProperty } from "..";
import { Engine } from "../../Engine";
import { RenderQueueType } from "../enums/RenderQueueType";
import { BlendState } from "./BlendState";
import { DepthState } from "./DepthState";
import { RasterState } from "./RasterState";
import { StencilState } from "./StencilState";

/**
 * Render state.
 */
export class RenderState {
  /** Blend state. */
  readonly blendState: BlendState = new BlendState();
  /** Depth state. */
  readonly depthState: DepthState = new DepthState();
  /** Stencil state. */
  readonly stencilState: StencilState = new StencilState();
  /** Raster state. */
  readonly rasterState: RasterState = new RasterState();

  /** Render queue type. */
  renderQueueType: RenderQueueType = RenderQueueType.Opaque;

  /**
   * @internal
   * @todo Should merge when we can delete material render state.
   */
  _applyShaderDataValue(renderStateDataMap: Record<number, ShaderProperty>, shaderData: ShaderData): void {
    this.blendState._applyShaderDataValue(renderStateDataMap, shaderData);
    this.depthState._applyShaderDataValue(renderStateDataMap, shaderData);
    this.stencilState._applyShaderDataValue(renderStateDataMap, shaderData);
    this.rasterState._applyShaderDataValue(renderStateDataMap, shaderData);
  }

  /**
   * @internal
   */
  _apply(
    engine: Engine,
    frontFaceInvert: boolean,
    renderStateDataMap: Record<number, ShaderProperty>,
    shaderData: ShaderData
  ): void {
    renderStateDataMap && this._applyShaderDataValue(renderStateDataMap, shaderData);
    const hardwareRenderer = engine._hardwareRenderer;
    const lastRenderState = engine._lastRenderState;
    this.blendState._apply(hardwareRenderer, lastRenderState);
    this.depthState._apply(hardwareRenderer, lastRenderState);
    this.stencilState._apply(hardwareRenderer, lastRenderState);
    this.rasterState._apply(hardwareRenderer, lastRenderState, frontFaceInvert);
  }
}
