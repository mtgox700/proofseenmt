import { domAnimation } from "motion/react";

/*
 * The animation features of motion, loaded on their own chunk by LazyMotion when a scene of the home page mounts:
 * the `m` components render their state without them, the springs arrive a moment later. domAnimation only
 * (animations, variants, exit, gestures): no layout, no drag on the home page.
 */
export default domAnimation;
