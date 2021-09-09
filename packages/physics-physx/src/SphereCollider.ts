import { PhysXManager } from "./PhysXManager";
import { Collider, ShapeFlag } from "./Collider";
import { ISphereCollider } from "@oasis-engine/design";
import { Quaternion, Vector3 } from "@oasis-engine/math";

export class SphereCollider extends Collider implements ISphereCollider {
  private _radius: number = 0.0;

  get radius(): number {
    return this._radius;
  }

  /**
   * set size of collider
   * @param value size of SphereCollider
   * @remarks will re-alloc new PhysX object.
   */
  set radius(value: number) {
    this._radius = value;
    this.initWithRadius(this._index, value, this._position, this._rotation);
  }

  /**
   * init Collider and alloc PhysX objects.
   * @param index index mark collider
   * @param value size of SphereCollider
   * @param position position of Collider
   * @param rotation rotation of Collider
   * @remarks must call after this component add to Entity.
   */
  initWithRadius(index: number, value: number, position: Vector3, rotation: Quaternion) {
    this._index = index;
    this._radius = value;
    this._position = position;
    this._rotation = rotation;

    // alloc Physx object
    this._allocGeometry();
    this._allocShape(ShapeFlag.SCENE_QUERY_SHAPE | ShapeFlag.SIMULATION_SHAPE);
    this._setLocalPose();
    this._pxShape.setQueryFilterData(new PhysXManager.PhysX.PxFilterData(this._index, 0, 0, 0));
    this._allocActor();
  }

  //----------------------------------------------------------------------------
  private _allocGeometry() {
    this._pxGeometry = new PhysXManager.PhysX.PxSphereGeometry(this._radius);
  }
}
