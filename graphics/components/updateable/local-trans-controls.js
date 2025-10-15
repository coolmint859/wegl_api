import { EventDispatcher, KeyboardInput, Vector3 } from "../../utilities/index.js";
import Component from "../component.js";
import Transform from "../shadeable/transform.js";

/**
 * Allows for dynamic translation of an entity relative to it's host's or another entity's coordinate system.
 * 
 * Best used in dynamic first person camera setups
 */
export default class LocalTranslationControls extends Component {
    #handler;
    #deltaMovement;
    #shouldUpdate;

    #speed;
    #keyDelay;
    #rotationProvider;

    #keyMap = null;

    /**
     * Allows for dynamic adjustment of the position of an entity relative to it's host's or another entity's coordinate system.
     * 
     * Best used in dynamic third person camera setups.
     * @param {KeyboardInput} inputHandler the keyboard input system used to update the state of the entity
     * @param {object} options handler options - used values depends on the handler used
     * @param {Function} options.rotationProvider - a function that can be used to make translation relative to an external entity rather than the host. Function should return a Quaternion instance. When not provided, translation is relative to the host's rotation
     */
    constructor(inputHandler, options={}) {
        super('local-trans-comp', [Component.Modifier.UPDATABLE]);
        this.#handler = inputHandler;
        this.#speed = options.speed ?? 10;
        this.#keyDelay = options.delay ?? 0;
        this.#deltaMovement = new Vector3();
        this.#shouldUpdate = false;

        this.#keyMap = {
            forward: options.forwardKey ?? 'KeyW',
            back: options.backKey ?? 'KeyS',
            left: options.leftKey ?? 'KeyA',
            right: options.rightKey ?? 'KeyD',
            up: options.upKey ?? 'KeyI',
            down: options.downKey ?? 'KeyK',
        }

        this.#rotationProvider = options.rotationProvider ?? null;

        if (inputHandler instanceof KeyboardInput) {
            this.#registerKeyboardCommands()
        } else {
            console.error(`[TranslationComponent] Provided handler is not of type KeyboardInput or MouseInput. Cannot register commands.`)
        }
    }

    #registerKeyboardCommands() {
        const keys = this.#keyMap;
        this.#handler.registerKeyPress(keys.forward, (dt) => {
            const movement = Transform.localForward.mult(-this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress(keys.left, (dt) => {
            const movement = Transform.localRight.mult(-this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress(keys.back, (dt) => {
            const movement = Transform.localForward.mult(this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress(keys.right, (dt) => {
            const movement = Transform.localRight.mult(this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay });
        this.#handler.registerKeyPress(keys.up, (dt) => {
            const movement = Transform.localUp.mult(this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
        this.#handler.registerKeyPress(keys.down, (dt) => {
            const movement = Transform.localUp.mult(-this.#speed * dt);
            this.#deltaMovement = this.#deltaMovement.add(movement);
            this.#shouldUpdate = true;
        }, { delay: this.#keyDelay })
    }

    /**
     * Update this component
     * @param {Entity} host the host entity of this component
     * @param {number} dt the elapsed time in seconds from the last frame
     */
    update(host, dt) {
        if (!this.#shouldUpdate) return;

        let rotationSource;
        if (this.#rotationProvider !== null) {
            rotationSource = this.#rotationProvider();
        } else {
            rotationSource = host.transform.rotation;
        }

        const localPosition = rotationSource.rotateVector(this.#deltaMovement);
        host.position = host.transform.position.add(localPosition);

        this.#deltaMovement = new Vector3();
        this.#shouldUpdate = false;
    }
}