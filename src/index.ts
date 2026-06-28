export type { ARToolKitState, MarkerPose, TrackedMarkerState } from './domain';

// Export the main functions
export { createARToolKitState } from './init';
export { loadPatternMarker } from './markers';
export { trackMarker, processFrame } from './tracking';
export { transMatToGLMat } from './math';