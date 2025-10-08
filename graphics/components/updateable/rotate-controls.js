import { EventDispatcher, KeyboardInput, MathUtils, MouseInput, Quaternion } from "../../utilities/index.js";
import KeyBoardInput from "../../utilities/interactivity/keyboard.js";
import Component from "../component.js";
import Transform from "../shadeable/transform.js";

/**
 * Allows for dynamic adjustment of the rotation of an entity.
 */
export default class RotationControls extends Component {
    #handler;
    #currentYaw = 0;
    #currentPitch = 0;

    #shouldUpdate;

    /**
     * Create a new RotationControls instance
     * @param {MouseInput | KeyBoardInput} inputHandler the input system used to update the state of the entity
     * @param {object} options handler options - used values depends on the handler used
     */
    constructor(inputHandler, options={}) {
        super('rotate-comp', [Component.Modifier.UPDATABLE]);
        this.#handler = inputHandler;
        this.#shouldUpdate = false;

        if (inputHandler instanceof KeyboardInput) {
            this.#registerKeyboardCommands(options)
        } else if (inputHandler instanceof MouseInput) {
            this.#registerMouseCommands(options)
        } else {
            console.error(`[RotationComponent] Provided handler is not of type KeyboardInput or MouseInput. Cannot register commands.`)
        }
    }

    #registerKeyboardCommands() {

    }

    #registerMouseCommands(options) {
        const sensitivity = options.sensitivity ?? 0.005;
        const maxPitch = options.maxPitch ?? Math.PI/2 - 0.05
        const minPitch = options.minPitch ?? -Math.PI/2 + 0.05;

        this.#handler.registerLockedMovement('rot-comp', (dt, event) => {
            // update yaw angle - this can be any value
            let yawAngleDelta = event.deltaX * sensitivity;
            this.#currentYaw -= yawAngleDelta;

            let pitchAngleDelta = event.deltaY * sensitivity;
            const possiblePitchAngle = this.#currentPitch - pitchAngleDelta;
            this.#currentPitch = MathUtils.clamp(possiblePitchAngle, minPitch, maxPitch);

            this.#shouldUpdate = true;
        })
    }

    /**
     * Update this component
     * @param {Entity} host the host entity of this component
     * @param {number} dt the elapsed time in seconds from the last frame
     */
    update(host, dt) {
        if (!this.#shouldUpdate) return;

        const yawQuat = Quaternion.fromAxisAngle(Transform.localUp, this.#currentYaw);
        const pitchQuat = Quaternion.fromAxisAngle(Transform.localRight, this.#currentPitch);

        const totalRotation = yawQuat.mult(pitchQuat).normal();
        host.dispatcher.dispatch(EventDispatcher.EventType.ROTATION_CHANGE, { rotation: totalRotation });

        this.#shouldUpdate = false;
    }
}