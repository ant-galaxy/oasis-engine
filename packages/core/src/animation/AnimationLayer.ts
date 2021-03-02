import { Event } from "../base/Event";
import { EventDispatcher } from "../base/EventDispatcher";
import { Logger } from "../base/Logger";
import { Component } from "../Component";
import { Entity } from "../Entity";
import { SkinnedMeshRenderer } from "../mesh/SkinnedMeshRenderer";
import { AnimationClip } from "./AnimationClip";
import { AnimationEventType, WrapMode } from "./AnimationConst";
import { AnimationOptions, IChannelState, IChannelTarget } from "./types";

/**
 * AnimationClip playback.
 * @extends EventDispatcher
 * @see class AnimationClip
 * @private
 */
export class AnimationLayer extends EventDispatcher {
  /**
   * @return Whether the AnimationClip is playing.
   */
  get isPlaying(): boolean {
    return this._animClip && this._isPlaying;
  }

  public layerWeight: number;

  public mixTagetLayer: AnimationLayer;

  public isFading: number;

  public fadeDeltaTime: number;

  public crossFadeDuration: number;

  public fadeDuration: number;

  public crossFadeDeltaTime: number;

  public isMixLayer: boolean;

  public hasMixLayer: boolean;

  public mixEntity: Entity;

  private _activedEvents: Event[];

  private _animClip: AnimationClip;

  private _isPlaying: boolean;

  private _wrapMode: WrapMode;

  private _channelStates: IChannelState[];

  private _animClipLength: number;

  private _frameEvents: any[];

  /**
   * @constructor
   */
  constructor() {
    super(null);

    this.layerWeight = 1.0;

    this._activedEvents = [];
  }

  /**
   * @param nextAnimClip - anim clip to playback next.
   * @param rootEntity - The root entity of the skeleton animation.
   * @return Whether can mix with current AnimationClip.
   */
  public canMix(nextAnimClip: AnimationClip, rootEntity: Entity): boolean {
    if (!this._animClip || !this._isPlaying || this.isMixLayer || this.isFading) {
      return false;
    }

    if (this._animClip.getChannelCount() !== nextAnimClip.getChannelCount()) {
      return false;
    }

    const count = this._animClip.getChannelCount();
    for (let i = count - 1; i >= 0; i--) {
      const curChannel = this._animClip.getChannelObject(i);
      const curTargetObject = this._findChannelTarget(rootEntity, curChannel.target);

      const nextChannel = nextAnimClip.getChannelObject(i);
      const nextTargetObject = this._findChannelTarget(rootEntity, nextChannel.target);

      if (curTargetObject !== nextTargetObject) {
        return false;
      }
    }

    return true;
  }

  /**
   * Mix animClip with target animationLayer.
   * @param animClip - AnimationClip to be mixed.
   * @param targetLayer - Target animationLayer.
   * @param rootEntity - The root entity of the skeleton animation.
   * @param mixEntity - The entiity to be mixed.
   * @param options - The play options when playing AnimationClip.
   */
  public mix(
    animClip: AnimationClip,
    targetLayer: AnimationLayer,
    rootEntity: Entity,
    mixEntity: Entity,
    options: { wrapMode?: WrapMode } = {}
  ) {
    this._isPlaying = targetLayer.isPlaying;
    this._animClip = animClip;
    this._wrapMode = typeof options.wrapMode !== "undefined" ? options.wrapMode : targetLayer._wrapMode;

    this._addEvents(options);

    this._channelStates = [];
    this._animClipLength = 0;
    // -- Create new state object.
    if (this._isPlaying) {
      const targetChannelStates = targetLayer._channelStates;
      const count = this._animClip.getChannelCount();
      for (let i = count - 1; i >= 0; i--) {
        const channel = this._animClip.getChannelObject(i);
        const targetObject = this._findChannelTarget(mixEntity, channel.target);
        this._channelStates[i] = {
          frameTime: 0.0,
          currentFrame: 0,
          currentValue: this._animClip.createChannelValue(i),
          mixWeight: targetObject ? 1 : 0
        };

        targetChannelStates[i].mixWeight =
          targetChannelStates[i].mixWeight === undefined ? 1 : targetChannelStates[i].mixWeight;
        if (targetChannelStates[i].mixWeight === 1) {
          targetChannelStates[i].mixWeight = targetObject ? 0 : 1;
        }

        const channelTimeLength = this._animClip.curves[i].curve.length;
        this._animClipLength = this._animClipLength > channelTimeLength ? this._animClipLength : channelTimeLength;
      } // End of for.

      return true;
    }

    return false;
  }

  public removeMixWeight() {
    const count = this._channelStates.length;
    for (let i = count - 1; i >= 0; i--) {
      if (this._channelStates[i].mixWeight === 1) {
        this.mixTagetLayer._channelStates[i].mixWeight = 1;
      }
    }
  }

  /**
   * Play the specify AnimationClip.
   * @param animClip - The AnimationClip to be played.
   * @param rootEntity - The root entity of the skeleton animation.
   * @param options - The play options when playing AnimationClip.
   */
  public play(
    animClip: AnimationClip,
    rootEntity: Entity,
    options: AnimationOptions = { wrapMode: WrapMode.LOOP }
  ): false | IChannelTarget[] {
    this._isPlaying = !!animClip;
    this._animClip = animClip;
    this._wrapMode = typeof options.wrapMode !== "undefined" ? options.wrapMode : WrapMode.LOOP;

    this._addEvents(options);

    this._channelStates = [];
    this._animClipLength = 0;
    // Create new state object.
    if (this._isPlaying) {
      const count = this._animClip.curves.length;
      // TODO
      const channelTargets: IChannelTarget[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const curveData = this._animClip.curves[i];
        const targetObject = this._findChannelTarget(rootEntity, curveData.relativePath);
        if (!targetObject) {
          Logger.warn("Can not find channel target:" + curveData.relativePath);
        }
        this._channelStates[i] = {
          frameTime: 0.0,
          currentFrame: 0,
          currentValue: new Float32Array(curveData.curve.valueSize)
        };

        channelTargets[i] = {
          targetObject,
          path: curveData.propertyName,
          pathType: AnimationClip._tagetTypeMap[curveData.propertyName],
          outputSize: curveData.curve.valueSize
        };

        const channelTimeLength = this._animClip.curves[i].curve.length;
        this._animClipLength = this._animClipLength > channelTimeLength ? this._animClipLength : channelTimeLength;
      } // End of for.

      return channelTargets;
    }

    return false;
  }

  /**
   * Stop play AnimationClip.
   * @param rightnow - Stop it immediately, or it will stop at the end of the clip.
   */
  public stop(rightnow: boolean) {
    if (!this._animClip || !this._isPlaying) {
      return;
    }

    if (rightnow) {
      this._isPlaying = false;
    } else {
      this._wrapMode = WrapMode.ONCE;
    }
  }

  /**
   * Update animation states only.
   * @param deltaTime - The deltaTime when the animation update.
   */
  public updateState(deltaTime: number) {
    console.log("updateState");
    if (!this._animClip || !this._isPlaying) {
      return;
    }

    // Update the weight of the Animation Layer.
    if (this.isFading) {
      this.fadeDeltaTime += deltaTime;
      this.layerWeight = 1.0 - this.fadeDeltaTime / this.fadeDuration;
      if (this.layerWeight <= 0) {
        this._isPlaying = false;
      }
    } else if (this.crossFadeDuration) {
      this.crossFadeDeltaTime += deltaTime;
      this.layerWeight = this.crossFadeDeltaTime / this.crossFadeDuration;
      if (this.layerWeight >= 1.0) {
        this.layerWeight = 1.0;
        delete this.crossFadeDuration;
      }
    }

    deltaTime = deltaTime / 1000;
    this._activeEvents(deltaTime);

    // Update channelStates.
    const count = this._animClip.curves.length;
    let playingCount = 0;
    for (let i = count - 1; i >= 0; i--) {
      if (this._updateChannelState(deltaTime, i)) {
        playingCount++;
      }
    }

    if (playingCount === 0) {
      this._isPlaying = false;

      if (this.isMixLayer) {
        this.removeMixWeight();
      }
    }
  }

  /**
   * Get the weight of the Animation Layer.
   * @return Channel layer weight.
   * @param channelIndex - The channel's index in AnimationClip's channels property.
   */
  public getChannelLayerWeight(channelIndex: number): number {
    if ((this.hasMixLayer || this.isMixLayer) && channelIndex < this._channelStates.length) {
      const mixWeight = this._channelStates[channelIndex].mixWeight;
      const layerWeight = this.isMixLayer ? this.mixTagetLayer.layerWeight : this.layerWeight;
      return mixWeight * layerWeight;
    }
    return this.layerWeight;
  }

  /**
   * @return Channel value.
   * @param channelIndexchannelIndex - The channel's index in AnimationClip's channels property.
   */
  public getChannelValue(channelIndex: number) {
    return this._channelStates[channelIndex].currentValue;
  }

  /**
   * Trigger the animation events.
   */
  public triggerEvents() {
    this._activedEvents &&
      this._activedEvents.forEach((event) => {
        this.trigger(event);
      });

    this._activedEvents.length = 0;
  }

  /**
   * Jump to a frame of the AnimationClip, take effect immediately.
   * @param frameTime - The time which the animation will jump to.
   */
  public jumpToFrame(frameTime: number) {
    const count = this._animClip.getChannelCount();
    for (let i = count - 1; i >= 0; i--) {
      // 1. Clear pre frameTime.
      const channelState = this._channelStates[i];
      channelState.frameTime = 0;

      // 2. Update new frameTime.
      this._updateChannelState(frameTime, i);
    }
  }

  /**
   * Update state and value of channel.
   * @param deltaTime - The deltaTime when the animation update.
   * @param channelIndex - The channel's index in AnimationClip's channels property.
   * @private
   */
  public _updateChannelState(deltaTime, channelIndex) {
    const animClip = this._animClip;
    const channelState = this._channelStates[channelIndex];
    const animClipLength = animClip.curves[channelIndex].curve.length;
    channelState.frameTime += deltaTime;
    if (channelState.frameTime > animClipLength) {
      switch (this._wrapMode) {
        case WrapMode.ONCE:
          channelState.frameTime = animClipLength;
          break;
        case WrapMode.LOOP:
          channelState.frameTime = channelState.frameTime % this._animClipLength;
          break;
        default:
          Logger.error("Unknown Anim wrap Mode: " + this._wrapMode);
      }
    } // End of if.

    if (channelState.mixWeight && channelState.mixWeight === 0) {
      return true;
    }

    const frameTime = Math.min(channelState.frameTime, animClipLength);
    const lerpState = this._getKeyAndAlpha(animClip.curves[channelIndex], frameTime);
    const val = animClip.evaluate(
      channelState.currentValue,
      channelIndex,
      lerpState.currentKey,
      lerpState.nextKey,
      lerpState.alpha
    );
    console.log("_updateChannelState", val);
    channelState.currentValue = val;

    if (this._wrapMode === WrapMode.ONCE && channelState.frameTime >= animClipLength) {
      return false;
    }
    return true;
  }
  // -- private ----------------------------------------------------------
  /**
   * @param options - The AnimationEvent's option.
   * @private
   */
  private _addEvents(options: any) {
    this.removeAllEventListeners();

    this._frameEvents = [];
    if (options.events) {
      let frameEventIndex = 0;
      for (let i = options.events.length - 1; i >= 0; i--) {
        const event = options.events[i];
        let eventType = event.type;
        if (event.type === AnimationEventType.FRAME_EVENT) {
          eventType = "frameEvent" + frameEventIndex;
          frameEventIndex++;
          this._frameEvents.push({
            eventType,
            triggerTime: event.triggerTime,
            triggered: false
          });
        }
        this.addEventListener(eventType, (e) => {
          event.callback();
        });
      } // End of for.
    } // End of if.
  }

  /**
   * Activate the AnimationEvent.
   * @param deltaTime - The deltaTime when the animation update.
   * @private
   */
  private _activeEvents(deltaTime: number) {
    // Trigger Frame Event.
    const index = this._animClip.durationIndex;
    if (this._frameEvents.length > 0 && this._channelStates.length > 0) {
      const curFrameTime = this._channelStates[index].frameTime + deltaTime;
      for (let i = this._frameEvents.length - 1; i >= 0; i--) {
        const frameEvent = this._frameEvents[i];
        if (!frameEvent.triggered && curFrameTime > frameEvent.triggerTime) {
          this._activedEvents.push(new Event(frameEvent.eventType, this));
          frameEvent.triggered = true;
        }
      }
    }

    if (this._channelStates.length > 0 && this._channelStates[index].frameTime + deltaTime >= this._animClip.duration) {
      if (this._wrapMode === WrapMode.LOOP) {
        // Reset Frame Event status.
        if (this._frameEvents.length > 0) {
          for (let i = this._frameEvents.length - 1; i >= 0; i--) {
            this._frameEvents[i].triggered = false;
          }
        }
        // Trigger Loop End Event.
        // @ts-ignore
        if (this.hasEvent(AnimationEventType.LOOP_END)) {
          this._activedEvents.push(new Event(AnimationEventType.LOOP_END, this));
        }
        // @ts-ignore
      } else if (this.hasEvent(AnimationEventType.FINISHED)) {
        // Trigger Finish Event.
        this._activedEvents.push(new Event(AnimationEventType.FINISHED, this));
      }
    }
  }

  /**
   * Find the target the channel belongs to.
   * @param rootNode - The root entity of the skeleton animation.
   * @param target - The target to be finded.
   * @private
   */
  private _findChannelTarget(rootNode: Entity, target: any): Entity | Component {
    const targetID = target;
    let targetSceneObject: Entity = null;
    if (rootNode.name === targetID) {
      targetSceneObject = rootNode;
    } else {
      targetSceneObject = rootNode.findByName(targetID);
    }

    if (target.path === "weights") {
      return targetSceneObject.getComponent(SkinnedMeshRenderer);
    } else {
      return targetSceneObject;
    }
  }

  /**
   * @return Current and next key id, current alpha.
   * @param channel - The channle which the key and alpha in.
   * @param time - The frame time.
   * @private
   */
  private _getKeyAndAlpha(curveData, time: number) {
    let keyTime = 0;
    let currentKey = 0;
    let nextKey = 0;
    const { curve } = curveData;
    const { keys } = curve;
    const numKeys = keys.length;
    // const timeKeys = channel.sampler.input;
    // const numKeys = timeKeys.length;
    for (let i = numKeys - 1; i >= 0; i--) {
      if (time > keys[i].time) {
        keyTime = time - keys[i].time;
        currentKey = i;
        break;
      }
    }

    nextKey = currentKey + 1;
    if (nextKey >= numKeys) {
      switch (this._wrapMode) {
        case WrapMode.ONCE:
          nextKey = numKeys - 1;
          break;
        case WrapMode.LOOP:
          nextKey = 0;
          break;
      }
    }

    const keyLength = keys[nextKey].time - keys[currentKey].time;
    const alpha = nextKey === currentKey || keyLength < 0.00001 ? 1 : keyTime / keyLength;

    return {
      currentKey,
      nextKey,
      alpha
    };
  }
}
