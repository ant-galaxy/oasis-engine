import { IXRMovementTracking, IXRMovementTrackingConfig } from "@galacean/engine-design";
import { XRManager } from "../../XRManager";
import { XRFeature } from "../XRFeature";
import { XRFeatureType } from "../XRFeatureType";
import { XRMovementTrackingMode } from "./XRMovementTrackingMode";

/**
 * The manager of XR movement tracking.
 */
export class XRMovementTracking extends XRFeature<IXRMovementTrackingConfig, IXRMovementTracking> {
  /**
   * Get the tracking mode.
   */
  get trackingMode(): XRMovementTrackingMode {
    return this._config.mode;
  }

  /**
   * @param xrManager - The xr manager
   * @param trackingMode - The tracking mode
   */
  constructor(xrManager: XRManager, trackingMode: XRMovementTrackingMode = XRMovementTrackingMode.Dof6) {
    super(xrManager);
    this._config = { type: XRFeatureType.MovementTracking, mode: trackingMode };
    this._platformFeature = <IXRMovementTracking>(
      xrManager._platformDevice.createFeature(XRFeatureType.MovementTracking)
    );
  }
}