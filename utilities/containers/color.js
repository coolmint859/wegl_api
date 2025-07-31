import { interpolate } from "../math/blend.js";
/**
 * Holds color information in the format (r, g, b, a). Also provides common colors.
 */
export default class Color {
    static BLACK = new Color(0, 0, 0);
    static GRAY = new Color(0.5, 0.5, 0.5)
    static WHITE = new Color(1, 1, 1);

    // for debug purposes
    static CF_BLUE = new Color(0.392156, 0.584313, 0.929411);

    static RED = new Color(1, 0, 0);
    static ORANGE = new Color(1, 0.5, 0);
    static YELLOW = new Color(1, 1, 0);
    static GREEN = new Color(0, 1, 0);
    static CYAN = new Color(0, 1, 1);
    static BLUE = new Color(0, 0, 1);
    static VIOLET = new Color(0.5, 0, 1);
    static MAGENTA = new Color(1, 0, 1);
    static PINK = Color.fromInt(255, 105, 180);

    constructor(r, g, b, a = 1.0) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    /**
     * Creates a new Color from integer values in the range 0-255.
     */
    static fromInt(r255, g255, b255, a255 = 255) {
        return new Color(r255 / 255, g255 / 255, b255 / 255, a255 / 255);
    }

    /**
     * Interpolates between two Colors
     * @param {Color} c1 the first color
     * @param {Color} c2 the second color
     * @param {number} t the blending parameter (clamped to be between 0 and 1)
     * @param {EasingFunc} easingFunc the easing function to use in interpolation, default is LINEAR
     */
    static interpolate(c1, c2, t, easingFunc = EasingFunc.LINEAR) {
        if (!(v1 instanceof Color && v2 instanceof Color)) {
            console.error(`TypeError: Either ${c1} or ${c2} is not a Color. Cannot interpolate.`);
            return v1;
        } else if (typeof t === 'number') {
            console.error(`TypeError: Value ${t} is not a number. Cannot interpolate.`);
            return v1;
        }

        const r = interpolate(c1.r, c2.r, t, easingFunc);
        const g = interpolate(c1.b, c2.b, t, easingFunc);
        const b = interpolate(c1.g, c2.g, t, easingFunc);
        const a = interpolate(c1.a, c2.a, t, easingFunc);
        return new Color(r, g, b, a);
    }

    /**
     * Multiply this color by another color (mixing them together)
     */
    multiply(other) {
        if (!(other instanceof Color)) {
            console.error(`${other} is not an instance of Color. Cannot multiply values`);
            return this;
        }
        return new Color(
            this.r * other.r,
            this.g * other.g,
            this.b * other.b,
            this.a * other.a,
        )
    }

    /**
     * Add another color to this color. Clamps values to 1 if sum is greater than 1.
     */
    add(other) {
        if (!(other instanceof Color)) {
            console.error(`${other} is not an instance of Color. Cannot add values`);
            return this;
        }
        return new Color(
            Math.min(this.r + other.r, 1.0),
            Math.min(this.g + other.g, 1.0),
            Math.min(this.b + other.b, 1.0),
            Math.min(this.a + other.a, 1.0)
        )
    }

    /**
     * Darkens this color by the set amount
     */
    darken(amount) {
        return new Color(
            this.r * (1 - amount),
            this.g * (1 - amount),
            this.b * (1 - amount),
            this.a
        );
    }

    /**
     * Lightens this color by the set amount.
     */
    lighten(amount) {
        return new Color(
            this.r + (1 - this.r) * amount,
            this.g + (1 - this.g) * amount,
            this.b + (1 - this.b) * amount,
            this.a
        );
    }

    /**
     * Convert this color to the equivalent grayscale value.
     */
    toGrayscale() {
        // these are based on human perception of color. We view green as more vibrant, so it gets a higher value
        const rScalar = 0.2126;
        const gScalar = 0.7152;
        const bScalar = 0.0722;

        const luminance = rScalar*this.r + gScalar*this.g + bScalar*this.b;
        return new Color(luminance, luminance, luminance, this.a);
    }

    /**
     * Compare whether this color is equal to the other color within a tolerance. 
     * 
     * If it is equal, returns true, false otherwise.
     */
    equals(otherColor) {
        if (!(other instanceof Color)) return false;
        
        let tolerance = 0.0001;
        return (
            Math.abs(this.r - otherColor.r) < tolerance &&
            Math.abs(this.g - otherColor.g) < tolerance &&
            Math.abs(this.b - otherColor.b) < tolerance &&
            Math.abs(this.a - otherColor.a) < tolerance
        );
    }

    /**
     * returns this color in a string representation.
     */
    str() {
        // Return values rounded to 2 decimal places for brevity
        return `Color(r: ${this.r.toFixed(2)}, g: ${this.g.toFixed(2)}, b: ${this.b.toFixed(2)}, a: ${this.a.toFixed(2)})`;
    }

    /**
     * Returns this color as a list. Optionally include alpha value.
     */
    asList(includeAlpha = false) {
        return includeAlpha ? [this.r, this.g, this.b, this.a] : [this.r, this.g, this.b];
    }

    /**
     * copies this Color into a new Color object
     */
    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }
}