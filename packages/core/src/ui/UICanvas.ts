import { MathUtil, Matrix, Ray, Vector2, Vector3, Vector4 } from "@galacean/engine-math";
import { Camera, CameraModifyFlags } from "../Camera";
import { Component } from "../Component";
import { DependentMode, dependentComponents } from "../ComponentsDependencies";
import { DisorderedArray } from "../DisorderedArray";
import { Entity, EntityModifyFlags } from "../Entity";
import { RenderContext } from "../RenderPipeline/RenderContext";
import { RenderElement } from "../RenderPipeline/RenderElement";
import { assignmentClone, deepClone, ignoreClone } from "../clone/CloneManager";
import { ComponentType } from "../enums/ComponentType";
import { UIHitResult } from "../input/pointer/emitter/UIHitResult";
import { UIGroup, UIGroupModifyFlags } from "./UIGroup";
import { UIRegistry } from "./UIRegistery";
import { UIRenderer } from "./UIRenderer";
import { UITransform } from "./UITransform";
import { CanvasRenderMode } from "./enums/CanvasRenderMode";
import { ResolutionAdaptationStrategy } from "./enums/ResolutionAdaptationStrategy";
import { IUIElement } from "./interface/IUIElement";

@dependentComponents(UITransform, DependentMode.AutoAdd)
export class UICanvas extends Component implements IUIElement {
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
  _canvasIndex: number = -1;
  /** @internal */
  @ignoreClone
  _isRootCanvas: boolean = false;
  /** @internal */
  @ignoreClone
  _renderElement: RenderElement;
  /** @internal */
  @ignoreClone
  _sortDistance: number = 0;
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
  _hierarchyDirty: boolean = true;
  /** @internal */
  @ignoreClone
  _disorderedElements: DisorderedArray<IUIElement> = new DisorderedArray();
  /** @internal */
  @ignoreClone
  _orderedElements: IUIElement[] = [];

  @assignmentClone
  private _renderMode = CanvasRenderMode.WorldSpace;
  @assignmentClone
  private _renderCamera: Camera;
  @assignmentClone
  private _resolutionAdaptationStrategy = ResolutionAdaptationStrategy.BothAdaptation;
  @assignmentClone
  private _sortOrder: number = 0;
  @assignmentClone
  private _distance: number = 10;
  private _transform: UITransform;
  private _referenceResolution: Vector2 = new Vector2(800, 600);

  /** @internal */
  get elements(): IUIElement[] {
    const elements = this._orderedElements;
    if (this._hierarchyDirty) {
      elements.length = 0;
      this._walk(this.entity, elements);
      this._hierarchyDirty = false;
    }
    return elements;
  }

  get referenceResolution(): Vector2 {
    return this._referenceResolution;
  }

  set referenceResolution(val: Vector2) {
    const { _referenceResolution: referenceResolution } = this;
    if (referenceResolution === val) return;
    (referenceResolution.x !== val.x || referenceResolution.y !== val.y) && referenceResolution.copyFrom(val);
  }

  get renderMode(): CanvasRenderMode {
    return this._renderMode;
  }

  set renderMode(mode: CanvasRenderMode) {
    let preMode = this._renderMode;
    if (preMode !== mode) {
      this._renderMode = mode;
      if (this._isRootCanvas) {
        const camera = this._renderCamera;
        preMode =
          preMode === CanvasRenderMode.ScreenSpaceCamera && !camera ? CanvasRenderMode.ScreenSpaceOverlay : preMode;
        mode = mode === CanvasRenderMode.ScreenSpaceCamera && !camera ? CanvasRenderMode.ScreenSpaceOverlay : mode;
        if (preMode !== mode) {
          if (preMode === CanvasRenderMode.ScreenSpaceCamera) {
            this._removeCameraListener(camera);
            // @ts-ignore
            this._referenceResolution._onValueChanged = null;
          } else if (preMode === CanvasRenderMode.ScreenSpaceOverlay) {
            this._removeCanvasListener();
            // @ts-ignore
            this._referenceResolution._onValueChanged = null;
          }
          if (mode === CanvasRenderMode.ScreenSpaceCamera) {
            this._addCameraListener(camera);
            // @ts-ignore
            this._referenceResolution._onValueChanged = this._onReferenceResolutionChanged;
          } else if (mode === CanvasRenderMode.ScreenSpaceOverlay) {
            this._addCanvasListener();
            // @ts-ignore
            this._referenceResolution._onValueChanged = this._onReferenceResolutionChanged;
          }
          this._adapterPoseInScreenSpace();
          this._adapterSizeInScreenSpace();
          const { _componentsManager: componentsManager } = this.scene;
          componentsManager.removeUICanvas(preMode, this);
          componentsManager.addUICanvas(mode, this);
        }
      }
    }
  }

  get renderCamera(): Camera {
    return this._renderCamera;
  }

  set renderCamera(val: Camera) {
    const preCamera = this._renderCamera;
    if (preCamera !== val) {
      this._renderCamera = val;
      if (this._isRootCanvas && this._renderMode === CanvasRenderMode.ScreenSpaceCamera) {
        preCamera ? this._removeCameraListener(preCamera) : this._removeCanvasListener();
        const preMode = preCamera ? CanvasRenderMode.ScreenSpaceCamera : CanvasRenderMode.ScreenSpaceOverlay;
        const curMode = val ? CanvasRenderMode.ScreenSpaceCamera : CanvasRenderMode.ScreenSpaceOverlay;
        if (val) {
          this._addCameraListener(val);
        } else {
          this._addCanvasListener();
        }
        this._adapterPoseInScreenSpace();
        this._adapterSizeInScreenSpace();
        if (preMode !== curMode) {
          const { _componentsManager: componentsManager } = this.scene;
          componentsManager.removeUICanvas(preMode, this);
          componentsManager.addUICanvas(curMode, this);
        }
      }
    }
  }

  get resolutionAdaptationStrategy(): ResolutionAdaptationStrategy {
    return this._resolutionAdaptationStrategy;
  }

  set resolutionAdaptationStrategy(val: ResolutionAdaptationStrategy) {
    if (this._resolutionAdaptationStrategy !== val) {
      this._resolutionAdaptationStrategy = val;
      if (this._isRootCanvas && this._renderMode !== CanvasRenderMode.WorldSpace) {
        this._adapterSizeInScreenSpace();
      }
    }
  }

  get sortOrder(): number {
    return this._sortOrder;
  }

  set sortOrder(val: number) {
    if (this._sortOrder !== val) {
      this._sortOrder = val;
      if (this._isRootCanvas && this._renderMode === CanvasRenderMode.ScreenSpaceOverlay) {
        this.scene._componentsManager._overlayCanvasesSortingFlag = true;
      }
    }
  }

  get distance(): number {
    return this._distance;
  }

  set distance(val: number) {
    if (this._distance !== val) {
      const { _renderMode: renderMode } = this;
      this._distance = val;
      if (this._isRootCanvas && renderMode === CanvasRenderMode.ScreenSpaceCamera && this._renderCamera) {
        this._adapterPoseInScreenSpace();
      }
    }
  }

  constructor(entity: Entity) {
    super(entity);
    this._componentType = ComponentType.UICanvas;
    this._transform = <UITransform>entity.transform;
    this._onEntityModify = this._onEntityModify.bind(this);
    this._onCanvasSizeListener = this._onCanvasSizeListener.bind(this);
    this._onCameraPropertyListener = this._onCameraPropertyListener.bind(this);
    this._onCameraTransformListener = this._onCameraTransformListener.bind(this);
    this._onReferenceResolutionChanged = this._onReferenceResolutionChanged.bind(this);
    // @ts-ignore
    this._referenceResolution._onValueChanged = this._onReferenceResolutionChanged;
  }

  raycast(ray: Ray, out: UIHitResult, distance: number = Number.MAX_SAFE_INTEGER): boolean {
    const { elements } = this;
    for (let i = elements.length - 1; i >= 0; i--) {
      const renderer = elements[i];
      if (renderer.raycastEnable && renderer._raycast(ray, out, distance)) {
        return true;
      }
    }
  }

  _prepareRender(context: RenderContext): void {
    const { elements } = this;
    const { frameCount } = this.engine.time;
    const renderElement = (this._renderElement = this.engine._renderElementPool.get());
    this._updateSortDistance(context.virtualCamera.position);
    renderElement.set(this.sortOrder, this._sortDistance);
    for (let i = 0, n = elements.length; i < n; i++) {
      const element = elements[i];
      if ((element as unknown as Component)._componentType === ComponentType.UIRenderer) {
        (element as unknown as UIRenderer)._renderFrameCount = frameCount;
        (element as unknown as UIRenderer)._prepareRender(context);
      }
    }
  }

  /** @internal */
  _updateSortDistance(cameraPosition: Vector3): void {
    switch (this._renderMode) {
      case CanvasRenderMode.ScreenSpaceOverlay:
        this._sortDistance = 0;
        break;
      case CanvasRenderMode.ScreenSpaceCamera:
        this._sortDistance = this._distance;
        break;
      case CanvasRenderMode.WorldSpace:
        this._sortDistance = Vector3.distance(cameraPosition, (this._transform as UITransform).worldPosition);
        break;
    }
  }

  /**
   * @internal
   */
  override _onEnableInScene(): void {
    this._entity._dispatchModify(EntityModifyFlags.UICanvasEnableInScene);
    const isRootCanvas = this._checkIsRootCanvas();
    this._setIsRootCanvas(isRootCanvas);
    if (!isRootCanvas) {
      UIRegistry.registerElementToCanvas(this, UIRegistry.getRootCanvasInParent(this));
      UIRegistry.registerEntityListener(this);
    }
  }

  /**
   * @internal
   */
  override _onDisableInScene(): void {
    this._entity._dispatchModify(EntityModifyFlags.UICanvasDisableInScene);
    if (this._isRootCanvas) {
      this._setIsRootCanvas(false);
    } else {
      UIRegistry.registerElementToCanvas(this, null);
      UIRegistry.unRegisterEntityListener(this);
    }
  }

  /**
   * @internal
   */
  _raycast(ray: Ray, out: UIHitResult = null, distance: number = Number.MAX_SAFE_INTEGER): boolean {
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
      if (out) {
        out.distance = curDistance;
        out.entity = entity;
        out.component = this;
        out.normal.copyFrom(normal);
        out.point.copyFrom(hitPointWorld);
      }
      return true;
    }
    return false;
  }

  /**
   * @internal
   */
  _onEntityModify(flag: EntityModifyFlags, param?: any): void {
    if (this._isRootCanvas) {
      switch (flag) {
        case EntityModifyFlags.Parent:
          UIRegistry.registerEntityListener(this);
          this._setIsRootCanvas(this._checkIsRootCanvas());
          break;
        case EntityModifyFlags.UICanvasEnableInScene:
          this._setIsRootCanvas(false);
          break;
        case EntityModifyFlags.UICanvasDisableInScene:
          this._setIsRootCanvas(this._checkIsRootCanvas());
          break;
        default:
          break;
      }
    } else {
      switch (flag) {
        case EntityModifyFlags.Parent:
          UIRegistry.registerEntityListener(this);
          UIRegistry.registerElementToCanvas(this, UIRegistry.getRootCanvasInParent(this));
          break;
        case EntityModifyFlags.SiblingIndex:
          this._canvas && (this._canvas._hierarchyDirty = true);
          break;
        case EntityModifyFlags.UIGroupEnableInScene:
        case EntityModifyFlags.UIGroupDisableInScene:
          break;
        default:
          break;
      }
    }
  }

  /**
   * @internal
   */
  _onGroupModify(flag: UIGroupModifyFlags): void {}

  private _dispatchRootCanvasChange(): void {
    this._disorderedElements.forEach(
      (element: IUIElement) => {
        UIRegistry.registerElementToCanvas(element, UIRegistry.getRootCanvasInParent(element));
      },
      () => {}
    );
  }

  private _adapterPoseInScreenSpace(): void {
    const { _renderCamera: renderCamera, _transform: transform } = this;
    if (renderCamera) {
      const { transform: cameraTransform } = renderCamera.entity;
      const { worldPosition: cameraWorldPosition, worldForward: cameraWorldForward } = cameraTransform;
      const { _distance: distance } = this;
      transform.setWorldPosition(
        cameraWorldPosition.x + cameraWorldForward.x * distance,
        cameraWorldPosition.y + cameraWorldForward.y * distance,
        cameraWorldPosition.z + cameraWorldForward.z * distance
      );
      transform.worldRotationQuaternion.copyFrom(cameraTransform.worldRotationQuaternion);
    } else {
      const { canvas } = this.engine;
      transform.setWorldPosition(canvas.width / 2, canvas.height / 2, 0);
      transform.worldRotationQuaternion.set(0, 0, 0, 1);
    }
  }

  private _adapterSizeInScreenSpace(): void {
    const { _renderCamera: renderCamera } = this;
    const { x: width, y: height } = this._referenceResolution;
    let curWidth: number;
    let curHeight: number;
    if (renderCamera) {
      curHeight = renderCamera.isOrthographic
        ? renderCamera.orthographicSize * 2
        : 2 * (Math.tan(MathUtil.degreeToRadian(renderCamera.fieldOfView / 2)) * this._distance);
      curWidth = renderCamera.aspectRatio * curHeight;
    } else {
      const canvas = this.engine.canvas;
      curHeight = canvas.height;
      curWidth = canvas.width;
    }
    let expectX: number, expectY: number, expectZ: number;
    switch (this._resolutionAdaptationStrategy) {
      case ResolutionAdaptationStrategy.WidthAdaptation:
        expectX = expectY = expectZ = curWidth / width;
        break;
      case ResolutionAdaptationStrategy.HeightAdaptation:
        expectX = expectY = expectZ = curHeight / height;
        break;
      case ResolutionAdaptationStrategy.BothAdaptation:
        expectX = curWidth / width;
        expectY = curHeight / height;
        expectZ = (expectX + expectY) / 2;
        break;
      case ResolutionAdaptationStrategy.ExpandAdaptation:
        expectX = expectY = expectZ = Math.min(curWidth / width, curHeight / height);
        break;
      case ResolutionAdaptationStrategy.ShrinkAdaptation:
        expectX = expectY = expectZ = Math.max(curWidth / width, curHeight / height);
        break;
      default:
        break;
    }
    this.entity.transform.setScale(expectX, expectY, expectZ);
    this._transform.size.set(curWidth / expectX, curHeight / expectY);
  }

  private _walk(entity: Entity, elements: IUIElement[], group?: UIGroup): void {
    const components = entity._components;
    const uiType = ComponentType.UIRenderer | ComponentType.UICanvas;
    for (let i = 0, n = components.length; i < n; i++) {
      const component = components[i];
      if (component.enabled && component._componentType & uiType) {
        elements.push(component as unknown as IUIElement);
      }
    }
    const children = entity._children;
    for (let i = 0, n = children.length; i < n; i++) {
      const child = children[i];
      child.isActive && this._walk(child, elements, group);
    }
  }

  private _addCameraListener(camera: Camera): void {
    camera.entity.transform._updateFlagManager.addListener(this._onCameraTransformListener);
    camera._updateFlagManager.addListener(this._onCameraPropertyListener);
  }

  private _removeCameraListener(camera: Camera): void {
    camera.entity.transform._updateFlagManager.removeListener(this._onCameraTransformListener);
    camera._updateFlagManager.removeListener(this._onCameraPropertyListener);
  }

  private _onCameraPropertyListener(flag: CameraModifyFlags): void {
    switch (flag) {
      case CameraModifyFlags.NearPlane:
      case CameraModifyFlags.FarPlane:
        break;
      default:
        this._adapterSizeInScreenSpace();
        break;
    }
  }

  private _onCameraTransformListener(): void {
    this._adapterPoseInScreenSpace();
  }

  private _addCanvasListener(): void {
    this.engine.canvas._sizeUpdateFlagManager.addListener(this._onCanvasSizeListener);
  }

  private _removeCanvasListener(): void {
    this.engine.canvas._sizeUpdateFlagManager.removeListener(this._onCanvasSizeListener);
  }

  private _onCanvasSizeListener(): void {
    const { canvas } = this.engine;
    this._transform.setWorldPosition(canvas.width / 2, canvas.height / 2, 0);
    this._adapterSizeInScreenSpace();
  }

  private _onReferenceResolutionChanged(): void {
    this._adapterSizeInScreenSpace();
  }

  private _checkIsRootCanvas(): boolean {
    let entity = this._entity.parent;
    while (entity) {
      const components = entity._components;
      for (let i = 0, n = components.length; i < n; i++) {
        const component = components[i];
        if (component.enabled && component._componentType === ComponentType.UICanvas) {
          return false;
        }
      }
      entity = entity.parent;
    }
    return true;
  }

  private _setIsRootCanvas(value: boolean): void {
    if (this._isRootCanvas !== value) {
      this._isRootCanvas = value;
      const { _renderMode: renderMode } = this;
      if (value) {
        switch (renderMode) {
          case CanvasRenderMode.ScreenSpaceCamera:
            if (this._renderCamera) {
              this._addCameraListener(this._renderCamera);
            } else {
              this._addCanvasListener();
            }
            // @ts-ignore
            this._referenceResolution._onValueChanged = this._onReferenceResolutionChanged;
            this._adapterPoseInScreenSpace();
            this._adapterSizeInScreenSpace();
            break;
          case CanvasRenderMode.ScreenSpaceOverlay:
            this._addCanvasListener();
            // @ts-ignore
            this._referenceResolution._onValueChanged = this._onReferenceResolutionChanged;
            this._adapterPoseInScreenSpace();
            this._adapterSizeInScreenSpace();
            break;
          default:
            break;
        }
        this.scene._componentsManager.addUICanvas(renderMode, this);
      } else {
        switch (renderMode) {
          case CanvasRenderMode.ScreenSpaceCamera:
            if (this._renderCamera) {
              this._removeCameraListener(this._renderCamera);
            } else {
              this._removeCanvasListener();
            }
            // @ts-ignore
            this._referenceResolution._onValueChanged = null;
            break;
          case CanvasRenderMode.ScreenSpaceOverlay:
            this._removeCanvasListener();
            // @ts-ignore
            this._referenceResolution._onValueChanged = null;
            break;
          default:
            break;
        }
        this.scene._componentsManager.removeUICanvas(renderMode, this);
        this._dispatchRootCanvasChange();
        this._orderedElements.length = 0;
        this._disorderedElements.length = 0;
        this._disorderedElements.garbageCollection();
      }
    }
  }
}

export enum RootCanvasChangeFlag {
  EnableChange,
  Parent
}