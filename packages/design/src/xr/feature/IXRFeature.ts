import { IXRFeatureDescriptor } from "./IXRFeatureDescriptor";
import { IXRPlatformFeature } from "./IXRPlatformFeature";
import { IXRSession } from "../IXRSession";
import { IXRFrame } from "../IXRFrame";

export interface IXRFeature {
  _platformFeature: IXRPlatformFeature;
  /** Whether this feature enabled. */
  enabled: boolean;

  /** The descriptor of the feature. */
  get descriptor(): IXRFeatureDescriptor;

  /**
   * Returns whether the feature is supported.
   * @param descriptor - The descriptor of the feature
   */
  isSupported(): Promise<void>;

  /**
   * Initialize the feature.
   */
  initialize(): Promise<void>;

  /**
   * Enable an instance of a feature.
   */
  onEnable(): void;

  /**
   * Disable an instance of a feature.
   */
  onDisable(): void;

  /**
   * Update an instance of a feature.
   */
  onUpdate(session: IXRSession, frame: IXRFrame): void;

  /**
   * Destroy an instance of a feature.
   */
  onDestroy(): void;

  /**
   * Called when the session is initialized.
   */
  onSessionInit(): void;

  /**
   * Called when session starts.
   */
  onSessionStart(): void;

  /**
   * Called when the session is stopped.
   */
  onSessionStop(): void;

  /**
   * Called when the session is destroyed.
   */
  onSessionDestroy(): void;
}