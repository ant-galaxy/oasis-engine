import { Matrix, Plane, Ray, Vector3, Vector4 } from "@galacean/engine-math";
import { DependentMode, dependentComponents } from "../ComponentsDependencies";
import { Entity, EntityModifyFlags } from "../Entity";
import { PrimitiveChunkManager } from "../RenderPipeline/PrimitiveChunkManager";
import { RenderContext } from "../RenderPipeline/RenderContext";
import { SubPrimitiveChunk } from "../RenderPipeline/SubPrimitiveChunk";
import { Renderer } from "../Renderer";
import { TransformModifyFlags } from "../Transform";
import { assignmentClone, deepClone, ignoreClone } from "../clone/CloneManager";
import { ComponentType } from "../enums/ComponentType";
import { UIHitResult } from "../input/pointer/emitter/UIHitResult";
import { ShaderProperty } from "../shader";
import { ShaderMacroCollection } from "../shader/ShaderMacroCollection";
import { UICanvas } from "./UICanvas";
import { UIGroup, UIGroupModifyFlags } from "./UIGroup";
import { UIRegistry } from "./UIRegistery";
import { UITransform } from "./UITransform";
import { IUIElement } from "./interface/IUIElement";

@dependentComponents(UITransform, DependentMode.AutoAdd)
export class UIRenderer extends Renderer implements IUIElement {
  /** @internal */
  static _tempVec30: Vector3 = new Vector3();
  /** @internal */
  static _tempVec31: Vector3 = new Vector3();
  /** @internal */
  static _tempMat: Matrix = new Matrix();
  /** @internal */
  static _tempPlane: Plane = new Plane();
  /** @internal */
  static _textureProperty: ShaderProperty = ShaderProperty.getByName("renderer_UITexture");

  @assignmentClone
  raycastEnable: boolean = true;
  @deepClone
  raycastPadding: Vector4 = new Vector4(0, 0, 0, 0);
  @ignoreClone
  depth: number = 0;

  /** @internal */
  @ignoreClone
  _parents: Entity[] = [];
  /** @internal */
  @ignoreClone
  _group: UIGroup;
  /** @internal */
  @ignoreClone
  _indexInGroup: number = -1;
  /** @internal */
  @ignoreClone
  _canvas: UICanvas;
  /** @internal */
  @ignoreClone
  _indexInCanvas: number = -1;
  /** @internal */
  @ignoreClone
  _subChunk: SubPrimitiveChunk;

  protected _alpha: number = 1;

  /**
   * @internal
   */
  constructor(entity: Entity) {
    super(entity);
    this._componentType = ComponentType.UIRenderer;
    this._onEntityModify = this._onEntityModify.bind(this);
  }

  /**
   * @internal
   */
  override _updateTransformShaderData(context: RenderContext, onlyMVP: boolean, batched: boolean): void {
    //@todo: Always update world positions to buffer, should opt
    // super._updateTransformShaderData(context, onlyMVP, true);
    const worldMatrix = this.entity.transform.worldMatrix;
    if (onlyMVP) {
      this._updateProjectionRelatedShaderData(context, worldMatrix, true);
    } else {
      this._updateWorldViewRelatedShaderData(context, worldMatrix, true);
    }
  }

  /**
   * @internal
   */
  override _prepareRender(context: RenderContext): void {
    // Update once per frame per renderer, not influenced by batched
    if (this._renderFrameCount !== this.engine.time.frameCount) {
      this._update(context);
    }

    this._render(context);

    // union camera global macro and renderer macro.
    ShaderMacroCollection.unionCollection(
      context.camera._globalShaderMacro,
      this.shaderData._macroCollection,
      this._globalShaderMacro
    );
  }

  /**
   * @internal
   */
  override _onEnableInScene(): void {
    const componentsManager = this.scene._componentsManager;
    if (this._overrideUpdate) {
      componentsManager.addOnUpdateRenderers(this);
    }
    UIRegistry.registerElementToCanvas(this, UIRegistry.getRootCanvasInParent(this));
    UIRegistry.registerEntityListener(this);
  }

  /**
   * @internal
   */
  override _onDisableInScene(): void {
    const componentsManager = this.scene._componentsManager;
    if (this._overrideUpdate) {
      componentsManager.removeOnUpdateRenderers(this);
    }
    UIRegistry.registerElementToCanvas(this, null);
    UIRegistry.unRegisterEntityListener(this);
  }

  /**
   * @internal
   */
  _onEntityModify(flag: EntityModifyFlags): void {
    switch (flag) {
      case EntityModifyFlags.Parent:
        UIRegistry.registerEntityListener(this);
        UIRegistry.registerElementToCanvas(this, UIRegistry.getRootCanvasInParent(this));
        break;
      case EntityModifyFlags.SiblingIndex:
        this._canvas && (this._canvas._hierarchyDirty = true);
        break;
      default:
        break;
    }
  }

  /**
   * @internal
   */
  _onGroupModify(flag: UIGroupModifyFlags): void {
    flag === UIGroupModifyFlags.Alpha && (this._dirtyUpdateFlag |= UIRendererUpdateFlags.Alpha);
  }

  /**
   * @internal
   */
  _getChunkManager(): PrimitiveChunkManager {
    return this.engine._batcherManager.primitiveChunkManagerUI;
  }

  /** @internal */
  _raycast(ray: Ray, out: UIHitResult, distance: number = Number.MAX_SAFE_INTEGER): boolean {
    const entity = this._entity;
    const plane = UIRenderer._tempPlane;
    const transform = entity.transform;
    const normal = plane.normal.copyFrom(transform.worldForward);
    plane.distance = -Vector3.dot(normal, transform.worldPosition);
    ray.intersectPlane(plane);
    const curDistance = ray.intersectPlane(plane);
    if (curDistance >= 0 && curDistance < distance) {
      const hitPointWorld = ray.getPoint(curDistance, UIRenderer._tempVec30);
      const worldMatrixInv = UIRenderer._tempMat;
      Matrix.invert(this.entity.transform.worldMatrix, worldMatrixInv);
      const hitPointLocal = UIRenderer._tempVec31;
      Vector3.transformCoordinate(hitPointWorld, worldMatrixInv, hitPointLocal);
      if (this._hitTest(hitPointLocal)) {
        out.distance = curDistance;
        out.entity = entity;
        out.component = this;
        out.normal.copyFrom(normal);
        out.point.copyFrom(hitPointWorld);
        return true;
      }
    }
    return false;
  }

  protected _hitTest(hitPoint: Vector3): boolean {
    const { x, y } = hitPoint;
    const uiTransform = <UITransform>this._transform;
    const { x: width, y: height } = uiTransform.size;
    const { x: pivotX, y: pivotY } = uiTransform.pivot;
    return x >= -width * pivotX && x <= width * (1 - pivotX) && y >= -height * pivotY && y <= height * (1 - pivotY);
  }

  protected override _onDestroy(): void {
    if (this._subChunk) {
      this._getChunkManager().freeSubChunk(this._subChunk);
      this._subChunk = null;
    }

    super._onDestroy();
  }

  protected override _onTransformChanged(flag: TransformModifyFlags): void {}
}

/**
 * @remarks Extends `RendererUpdateFlag`.
 */
export enum UIRendererUpdateFlags {
  Alpha = 0x8
}