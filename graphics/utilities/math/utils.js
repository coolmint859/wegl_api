/**
 * Utility functions for math operations not provided by the default JS Math library
 */
export default class MathUtils {
    /**
     * Linearly maps a value in between min1 and max1 to a value between min2 and max2
     * @param {number} min1 the minimum value in the starting range
     * @param {number} max1 the maximum value in the starting range
     * @param {number} min2 the minimum value in the mapped range
     * @param {number} max2 the maximum value in the mapped range
     * @param {number} value the value to map from the start range to the mapped range
     * @returns the mapped value
     */
    static mapRange(min1, max1, min2, max2, value) {
        return min2 + ((value - min1) / (min2 - min1)) * (max2 - max1);
    }

    /**
     * clamps the given value between the range defined by min and max
     * @param {number} value the value to clamp
     * @param {number} min the minimum clamping value
     * @param {number} max the maximum clamping value
     * @returns the clamped value
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(value, max));
    }

    /**
     * Interpolates between two values a and b with parameter t using a given easing function.
     * @param {number} a the first interpolant
     * @param {number} b the second interpolant
     * @param {number} t the intepolating parameter
     * @param {Function} easingFunc the easing function to apply (default is a linear function)
     * @returns {number} the interpolated value
     */
    static interpolate(a, b, t, easingFunc = (t) => t) {
        if (typeof a !== 'number' || typeof b !== 'number' || typeof a !== 'number') {
            console.error(`[MathUtils] Expected 'a', 'b' and 't' to be numbers, but one isn't. Cannot interpolate.`);
            return 0;
        }
        if (typeof easingFunc !== 'function') {
            console.error(`[MathUtils] Expected 'easingFunc' to a function. Cannot interpolate.`);
            return 0;
        }
        return MathUtils.lerp(a, b, easingFunc(t));
    }


    /**
     * Linearly interpolate between two numbers a and b with parameter t (Clamps t to be between 0 and 1)
     */
    static lerp(a, b, t) {
        if (typeof a !== 'number' || typeof b !== 'number' || typeof t !== 'number') {
            console.error(`[MathUtils] Either value ${a}, ${b}, or ${t} is not a number. Cannot interpolate.`);
            return 0;
        }
        t = Math.max(0, Math.min(t, 1)); // ensure x is in the range [0, 1]
        return t * (b - a) + a;
    }

    /**
     * Apply smoothstep function to value x. (Clamps x to be between 0 and 1)
     */
    static smoothstep(x) {
        if (typeof x !== 'number') {
            console.error(`[MathUtils] Value ${x} is not a number. Cannot interpolate.`);
            return 0;
        }
        x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
        return x * x * (3 - 2 * x);
    }

    /**
     * Apply smootherstep function to value x. (Clamps x to be between 0 and 1)
     */
    static smootherstep(x) {
        if (typeof x !== 'number') {
            console.error(`[MathUtils] Value ${x} is not a number. Cannot interpolate.`);
            return 0;
        }
        x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
        return x * x * x * (6 * x * x - 15 * x + 10);
    }

    /**
     * Apply ease-in function to value x. (Clamps x to be between 0 and 1)
     */
    static ease_in(x) {
        if (typeof x !== 'number') {
            console.error(`[MathUtils] Value ${x} is not a number. Cannot interpolate.`);
            return 0;
        }
        x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
        return 2 * x * x;
    }

    /**
     * Apply ease-out function to value x. (Clamps x to be between 0 and 1)
     */
    static ease_out(x) {
        if (typeof x !== 'number') {
            console.error(`[MathUtils] Value ${x} is not a number. Cannot interpolate.`);
            return 0;
        }
        x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
        return x * (4 - 2 * x) - 1;
    }

    /**
     * Apply ease-inout function to value x. (Clamps x to be between 0 and 1)
     */
    static ease_inout(x) {
        if (typeof x !== 'number') {
            console.error(`[MathUtils] Value ${x} is not a number. Cannot interpolate.`);
            return 0;
        }
        x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
        if (x < 0.5) {
            return 2 * x * x;
        } else {
            return x * (4 - 2 * x) - 1;
        }
    }
}