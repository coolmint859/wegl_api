import Camera from "../../entities/camera.js";
import { EventDispatcher, KeyboardInput, MathUtils } from "../../utilities/index.js";
import Component from "../component.js";

/**
 * Allows for dynamic adjustment of the zoom on a camera.
 */
export default class ZoomControls extends Component {
    #deltaFOV;
    #minFOV;
    #maxFOV;
    #speed;
    #sensitivity;

    #shouldUpdate;

    /**
     * Create a new ZoomControls instance
     * @param {MouseInput | KeyboardInput} inputHandler the input system used to update the state of the entity
     * @param {object} options handler options - used values depends on the handler used
     */
    constructor(inputHandler, options={}) {
        super('zoom-comp', [Component.Modifier.UPDATABLE]);
        
        this.#sensitivity = options.sensitivity ?? 2.5;
        this.#speed = options.speed ?? 0.2; // used for keyboard-based zoom
        this.#deltaFOV = 0;
        this.#minFOV = options.minFOV ?? 0.017 // 1 degree;
        this.#maxFOV = options.maxFOV ?? 2.094 // 120 degrees;
        this.#shouldUpdate = false;

        if (inputHandler instanceof KeyboardInput) {
            inputHandler.registerKeyPress('KeyQ', (dt) => {
                this.#deltaFOV += this.#sensitivity * this.#speed * dt;
                this.#shouldUpdate = true;
            });
            inputHandler.registerKeyPress('KeyE', (dt) => {
                this.#deltaFOV += -this.#sensitivity * this.#speed * dt;
                this.#shouldUpdate = true;
            });
        } else if (inputHandler instanceof MouseInput) {
            // inputHandler.registerLockedScoll('zoom', (dt, event) => {
            //     this.#deltaFOV += zoomSensitivity * event.deltaY;
            //     this.#shouldUpdate = true;
            // });
        } else {
            console.error(`[TranslationComponent] Provided handler is not of type KeyboardInput or MouseInput. Cannot register commands.`)
        }
    }

    /**
     * Update this component
     * @param {Camera} host the host camera of this component
     * @param {*} dt the elapsed time in seconds from the last frame
     */
    update(host, dt) {
        if (!(host instanceof Camera)) {
            console.error(`[ZoomComponent] Expected 'host' to be an instance of Camera. Cannot update zoom.`)
        }
        if (!this.#shouldUpdate) return;

        const FOV = MathUtils.clamp(host.FOV + this.#deltaFOV, this.#minFOV, this.#maxFOV);
        host.dispatcher.dispatch(EventDispatcher.EventType.FOV_CHANGE, { fov: FOV });

        this.#deltaFOV = 0;
        this.#shouldUpdate = false;
    }
}
