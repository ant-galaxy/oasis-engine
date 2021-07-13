/**
 * AnimationEvent lets you call a script function similar to SendMessage as part of playing back an animation.
 */
export class AnimationEvent {
  /** The time when the event be triggered. */
  time: number;
  /** The name of the method called in the script. */
  functionName: string;
}
