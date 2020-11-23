import { Camera } from "./Camera";
import { ignoreClone } from "./clone/CloneManager";
import { Component } from "./Component";

/**
 * 脚本类，可进行逻辑编写。
 */
export class Script extends Component {
  /** @internal */
  @ignoreClone
  _started: boolean = false;
  /** @internal */
  @ignoreClone
  _onStartIndex: number = -1;
  /** @internal */
  @ignoreClone
  _onUpdateIndex: number = -1;
  /** @internal */
  @ignoreClone
  _onLateUpdateIndex: number = -1;
  /** @internal */
  @ignoreClone
  _onPreRenderIndex: number = -1;
  /** @internal */
  @ignoreClone
  _onPostRenderIndex: number = -1;

  /**
   * 第一次触发可用状态时调用,只调用一次。
   */
  onAwake(): void {}

  /**
   * 触发为可用状态时调用。
   */
  onEnable(): void {}

  /**
   * 第一次执行帧级循环前调用，只调用一次。
   */
  onStart(): void {}

  /**
   * 主更新，逐帧调用。
   * @param deltaTime - 帧间隔时间
   */
  onUpdate(deltaTime: number): void {}

  /**
   * 延迟更新，逐帧调用。
   * @param deltaTime - 帧间隔时间
   */
  onLateUpdate(deltaTime: number): void {}

  /**
   * 相机渲染前调用，逐相机调用。
   * @param camera - 当前渲染相机
   */
  onBeginRender(camera: Camera): void {}

  /**
   * 相机完成渲染后调用，逐相机调用。
   * @param camera - 当前渲染相机
   */
  onEndRender(camera: Camera): void {}

  /**
   * 触发为禁用状态时调用。
   */
  onDisable(): void {}

  /**
   * 在被销毁帧的最后调用。
   */
  onDestroy(): void {}

  /**
   * @internal
   * @inheritDoc
   * @override
   */
  _onAwake(): void {
    this.onAwake();
  }

  /**
   * @internal
   * @inheritDoc
   * @override
   */
  _onEnable(): void {
    const componentsManager = this.engine._componentsManager;
    const prototype = Script.prototype;
    if (!this._started) {
      componentsManager.addOnStartScript(this);
    }
    if (this.onUpdate !== prototype.onUpdate) {
      componentsManager.addOnUpdateScript(this);
    }
    if (this.onLateUpdate !== prototype.onLateUpdate) {
      componentsManager.addOnLateUpdateScript(this);
    }
    this.onEnable();
  }

  /**
   * @internal
   * @inheritDoc
   * @override
   */
  _onDisable(): void {
    const componentsManager = this.engine._componentsManager;
    // use "xxIndex" is more safe
    // when call onDisable it maybe it still not in script queue,for example write "entity.isActive = false" in onWake().
    if (this._onStartIndex !== -1) {
      componentsManager.removeOnStartScript(this);
    }
    if (this._onUpdateIndex !== -1) {
      componentsManager.removeOnUpdateScript(this);
    }
    if (this._onLateUpdateIndex !== -1) {
      componentsManager.removeOnLateUpdateScript(this);
    }
    this.onDisable();
  }

  /**
   * @internal
   * @inheritDoc
   * @override
   */
  _onDestroy(): void {
    this.engine._componentsManager.addDestoryComponent(this);
  }
}
