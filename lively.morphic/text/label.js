import { Text } from './morph.js';

/**
 * This should not be used for code that is newly written or refactored.
 * Previously, there was a difference between Label and Text for technical reasons.
 * This is no longer necessary, and this class is kept solely for the purpose of not needing to touch all files referencing it
 * and to not break backwards compatibility with projects outside of the lively Core.
 * Sometime down the line this should be removed. 
 */
export class Label extends Text { }
