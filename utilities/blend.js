const EasingFunc = {
    LINEAR: 'linear',
    SMOOTHSTEP: 'smoothstep',
    SMOOTHERSTEP: 'smootherstep',
    EASE_IN: 'ease_in',
    EASE_OUT: 'ease_out',
    EASE_INOUT: 'ease_inout'
}
Object.freeze(EasingFunc);

/**
 * Linearly maps a value in between min1 and max1 to a value between min2 and max2
 * @param {number} min1 the minimum value in the starting range
 * @param {number} max1 the maximum value in the starting range
 * @param {number} min2 the minimum value in the mapped range
 * @param {number} max2 the maximum value in the mapped range
 * @param {number} value the value to map from the start range to the mapped range
 * @returns the mapped value
 */
function mapRange(min1, max1, min2, max2, value) {
    return min2 + ((value - min1) / (min2 - min1)) * (max2 - max1);
}

/**
 * clamps the given value between the range defined by min and max
 * @param {number} value the value to clamp
 * @param {number} min the minimum clamping value
 * @param {number} max the maximum clamping value
 * @returns the clamped value
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

/**
 * Interpolates between two values a and b with parameter t using the given easing function
 * @param {number} a the first interpolant
 * @param {number} b the second interpolant
 * @param {number} t the intepolating parameter
 * @param {EasingFunc} easingFunc the easing function to apply
 * @returns {number} the interpolated value
 */
function interpolate(a, b, t, easingFunc = EasingFunc.LINEAR) {
    if (typeof a !== 'number' || typeof b !== 'number' || typeof a !== 'number') {
        console.error(`TypeError: Expected 'a', 'b' and 't' to be numbers, but one isn't. Cannot interpolate.`);
        return 0;
    }

    let p;
    switch (easingFunc) {
        case EasingFunc.LINEAR:
            p = t; break;
        case EasingFunc.SMOOTHSTEP:
            p = smoothstep(t); break;
        case EasingFunc.SMOOTHERSTEP:
            p = smootherstep(t); break;
        case EasingFunc.EASE_IN:
            p = ease_in(t); break;
        case EasingFunc.EASE_OUT:
            p = ease_out(t); break;
        case EasingFunc.EASE_INOUT:
            p = ease_inout(t); break;
        default:
            console.error(`TypeError: Expected 'easingFunc' to be a named constant of EasingFunc, but was not given one. Applying Linear Interpolation.`);
            p = t; break;
    }
    return lerp(a, b, p);
}


/**
 * Linearly interpolate between two numbers a and b with parameter t (Clamps t to be between 0 and 1)
 */
function lerp(a, b, t) {
    if (typeof a !== 'number' || typeof b !== 'number' || typeof t !== 'number') {
        console.error(`TypeError: Either value ${a}, ${b}, or ${t} is not a number. Cannot interpolate.`);
        return 0;
    }
    t = Math.max(0, Math.min(t, 1)); // ensure x is in the range [0, 1]
    return t * (b - a) + a;
}

/**
 * Apply smoothstep function to value x. (Clamps x to be between 0 and 1)
 */
function smoothstep(x) {
    if (typeof x !== 'number') {
        console.error(`TypeError: Value ${x} is not a number. Cannot interpolate.`);
        return 0;
    }
    x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
    return x * x * (3 - 2 * x);
}

/**
 * Apply smootherstep function to value x. (Clamps x to be between 0 and 1)
 */
function smootherstep(x) {
    if (typeof x !== 'number') {
        console.error(`TypeError: Value ${x} is not a number. Cannot interpolate.`);
        return 0;
    }
    x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
    return x * x * x * (6 * x * x - 15 * x + 10);
}

/**
 * Apply ease-in function to value x. (Clamps x to be between 0 and 1)
 */
function ease_in(x) {
    if (typeof x !== 'number') {
        console.error(`TypeError: Value ${x} is not a number. Cannot interpolate.`);
        return 0;
    }
    x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
    return 2 * x * x;
}

/**
 * Apply ease-out function to value x. (Clamps x to be between 0 and 1)
 */
function ease_out(x) {
    if (typeof x !== 'number') {
        console.error(`TypeError: Value ${x} is not a number. Cannot interpolate.`);
        return 0;
    }
    x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
    return x * (4 - 2 * x) - 1;
}

/**
 * Apply ease-inout function to value x. (Clamps x to be between 0 and 1)
 */
function ease_inout(x) {
    if (typeof x !== 'number') {
        console.error(`TypeError: Value ${x} is not a number. Cannot interpolate.`);
        return 0;
    }
    x = Math.max(0, Math.min(x, 1)); // ensure x is in the range [0, 1]
    if (x < 0.5) {
        return 2 * x * x;
    } else {
        return x * (4 - 2 * x) - 1;
    }
}
