import { Camera } from "../../entities/index.js";
import { EventDispatcher, Quaternion, Vector3 } from "../../utilities/index.js";
import Component from "../component.js";
import Transform from "../shadeable/transform.js";

/**
 * Enables entities to 'look' in the direction they are moving, uses spherical interpolation
 */
export default class LookAtComponent extends Component {
    #prevPosition;
    #rotationSpeed;

    /**
     * Enables entities to smoothly look in direction they are moving
     * @param {Vector3} options.startPosition the initial position that the entity will look at. Default is the origin.
     * @param {number} options.rotationSpeed the speed of rotation, affecting the time it takes for the entity to face it's new direction. Larger values mean faster rotations.
     */
    constructor(options={}) {
        super('look-at', [Component.Modifier.UPDATABLE]);
        this.#prevPosition = options.startPosition ?? new Vector3();
        this.#rotationSpeed = options.rotationSpeed ?? 5;
    }

    update(host, dt) {
        const currPosition = host.position.clone();

        const displacement = currPosition.sub(this.#prevPosition).normal();
        if (displacement.magnitude() < 0.0001) return;

        const lookAtDirection = host instanceof Camera ? displacement.negate() : displacement;
        const currForward = host.transform.forwardVector;
        const alignment = currForward.dot(displacement);

        // when the alignment is very close to 1, the turn is finished.
        if (alignment < 0.9999) {
            const t = Math.min(1.0, this.#rotationSpeed * dt);

            const fullRotation = Quaternion.fromForwardUp(lookAtDirection, Transform.localUp);
            const interpRotation = Quaternion.slerp(host.rotation, fullRotation, t);

            host.dispatcher.dispatch(EventDispatcher.EventType.ROTATION_CHANGE, { rotation: interpRotation });
        }

        this.#prevPosition = currPosition.clone();
    }
}