import { PHYSX } from "./physx.release";

/**
 * Store and Init the foundation of PhysX Object
 * @internal
 */
export class PhysXManager {
  /** PhysX wasm object */
  static PhysX: any;
  /** Physx physics object */
  static physics: any;

  /**
   * Initialize PhysX Object.
   * */
  public static init(): Promise<void> {
    return new Promise((resolve) => {
      PHYSX().then(function (PHYSX) {
        PhysXManager.PhysX = PHYSX;
        PhysXManager._setup();
        console.log("PHYSX loaded");

        resolve();
      });
    });
  }

  private static _setup() {
    const version = PhysXManager.PhysX.PX_PHYSICS_VERSION;
    const defaultErrorCallback = new PhysXManager.PhysX.PxDefaultErrorCallback();
    const allocator = new PhysXManager.PhysX.PxDefaultAllocator();
    const foundation = PhysXManager.PhysX.PxCreateFoundation(version, allocator, defaultErrorCallback);

    this.physics = PhysXManager.PhysX.PxCreatePhysics(
      version,
      foundation,
      new PhysXManager.PhysX.PxTolerancesScale(),
      false,
      null
    );

    PhysXManager.PhysX.PxInitExtensions(this.physics, null);
  }
}
