import { EngineObject } from "../base/EngineObject";
import { removeFromArray } from "../base/Util";
import { Engine } from "../Engine";

/**
 * 资产的基类，具有引用计数能力。
 */
export abstract class RefObject extends EngineObject {
  /** 是否忽略垃圾回收的检查,如果为 true 则不受 ResourceManager.gc() 影响。*/
  isGCIgnored: boolean = false;

  private _refCount: number = 0;
  private _refChildren: RefObject[] = [];
  private _refParent: RefObject = null;
  private _destroyed: boolean = false;

  /**
   * 被有效引用计数。
   */
  get refCount(): number {
    return this._refCount;
  }

  /**
   * 是否已销毁。
   */
  get destroyed(): boolean {
    return this._destroyed;
  }

  protected constructor(engine: Engine) {
    super(engine);
    engine.resourceManager._addRefObject(this.instanceId, this);
  }

  /**
   * 销毁。
   * @param force - 是否强制销毁,如果为 fasle 则 refCount = 0 可释放成功
   * @returns 是否释放成功
   */
  destroy(force: boolean = false): boolean {
    if (this._destroyed) return true;
    if (!force && this._refCount !== 0) return false;
    const resourceManager = this._engine.resourceManager;
    // resourceManager maybe null,because engine has destroyed.
    // TODO:the right way to fix this is to ensure destroy all when call engine.destroy,thus don't need to add this project.
    if (resourceManager) {
      resourceManager._deleteAsset(this);
      resourceManager._deleteRefObject(this.instanceId);
    }
    if (this._refParent) {
      removeFromArray(this._refParent._refChildren, this);
    }
    this._engine = null;
    this._onDestroy();
    this._destroyed = true;
    return true;
  }

  /**
   * @internal
   * 把当前资源添加到资源管理中。
   */
  _addToResourceManager(path: string): void {
    this._engine.resourceManager._addAsset(path, this);
  }

  /**
   * @internal
   * 添加资源引用数
   */
  _addRefCount(refCount: number): void {
    this._refCount += refCount;
    const refChildren = this._refChildren;
    for (const item of refChildren) {
      item._addRefCount(refCount);
    }
  }

  /**
   * @internal
   * 添加引用资源。
   */
  _addRefChild(obj: RefObject): void {
    this._refChildren.push(obj);
    obj._refParent = this;
    obj._addRefCount(this._refCount);
  }

  /**
   * @internal
   * 移出引用资源。
   */
  _removeRefChild(obj: RefObject): void {
    const refChildren = this._refChildren;
    if (removeFromArray(refChildren, obj)) {
      obj._refParent = null;
      obj._addRefCount(-this._refCount);
    }
  }

  /**
   * 当资源销毁时调用。
   * 子类可重写该函数。
   */
  protected abstract _onDestroy(): void;
}
