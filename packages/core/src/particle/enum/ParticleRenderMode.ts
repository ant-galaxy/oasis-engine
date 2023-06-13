/**
 * The rendering mode for particle systems.
 */
export enum ParticleRenderMode {
  /** Render particles as billboards facing the active camera. (Default) */
  Billboard,
  /** Stretch particles in the direction of motion. */
  Stretch,
  /** Render particles as billboards always facing up along the y-Axis. */
  HorizontalBillboard,
  /** Render particles as billboards always facing the player, but not pitching along the x-Axis. */
  VerticalBillboard,
  /** Render particles as meshes. */
  Mesh,
  /** Do not render particles. */
  None
}
