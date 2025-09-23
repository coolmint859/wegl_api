/**
 * Linearly maps a value in between min1 and max1 to a value between min2 and max2
 * @param {number} min1 the minimum value in the starting range
 * @param {number} max1 the maximum value in the starting range
 * @param {number} min2 the minimum value in the mapped range
 * @param {number} max2 the maximum value in the mapped range
 * @param {number} value the value to map from the start range to the mapped range
 * @returns the mapped value
 */
export function mapRange(min1, max1, min2, max2, value) {
    return min2 + ((value - min1) / (min2 - min1)) * (max2 - max1);
}

/**
 * clamps the given value between the range defined by min and max
 * @param {number} value the value to clamp
 * @param {number} min the minimum clamping value
 * @param {number} max the maximum clamping value
 * @returns the clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}