import { EventDispatcher, KeyboardInput, MouseInput, Vector3 } from "../../utilities/index.js";
import Component from "../component.js";
import Transform from "../shadeable/transform.js";

/**
 * Allows for dynamic adjustment of the position of an entity.
 */
export default class TranslationControls extends Component {
    #handler;
    #deltaMovement;
    #shouldUpdate;

    #speed;
    #keyDelay;
    #rotationFunc;

    /**
     * Create a new TranslationControls instance
     * @param {MouseInput | KeyboardInput} inputHandler the input system used to update the state of the entity
     * @param {object} options handler options - used values depends on the handler used
     * @param {Function} options.rotationFunc - function that can be used to make translation relative to an external entity rather than the host. Function should return a Quaternion instance.
     */
    constructor(inputHandler, options={}) {
        super('trans-comp', [Component.Modifier.UPDATABLE]);
        this.#handler = inputHandler;
        this.#speed = options.speed ?? 10;
        this.#keyDelay = options.delay ?? 0;
        this.#deltaMovement = new Vector3();
        this.#shouldUpdate = false;

        this.#rotationFunc = options.rotationFunc ?? null;

        if (inputHandler instanceof KeyboardInput) {
            this.#registerKeyboardCommands()
        } else if (inputHandler instanceof MouseInput) {
            this.#registerMouseCommands()
        } else {
            console.error(`[TranslationComponent] Provided handler is not of type KeyboardInput or MouseInput. Cannot register commands.`)
        }
    }

    #registerKeyboardCommands() {
        this.#handler.registerKeyPress('KeyW', (dt) => {
            const movement = Transform.localForward.mult(-this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress('KeyA', (dt) => {
            const movement = Transform.localRight.mult(-this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress('KeyS', (dt) => {
            const movement = Transform.localForward.mult(this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress('KeyD', (dt) => {
            const movement = Transform.localRight.mult(this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay });
        this.#handler.registerKeyPress('KeyI', (dt) => {
            const movement = Transform.localUp.mult(this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress('KeyK', (dt) => {
            const movement = Transform.localUp.mult(-this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
    }

    #registerMouseCommands() {

    }

    /**
     * Update this component
     * @param {Entity} host the host entity of this component
     * @param {number} dt the elapsed time in seconds from the last frame
     */
    update(host, dt) {
        if (!this.#shouldUpdate) return;

        let rotationSource;
        if (this.#rotationFunc !== null) {
            rotationSource = this.#rotationFunc();
        } else {
            rotationSource = host.transform.rotation;
        }

        const localPosition = rotationSource.rotateVector(this.#deltaMovement);
        const worldPosition = host.transform.position.add(localPosition);

        host.dispatcher.dispatch(EventDispatcher.EventType.POSITION_CHANGE, { position: worldPosition });

        this.#deltaMovement = new Vector3();

        this.#shouldUpdate = false;
    }
}