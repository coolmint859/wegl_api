import { Vector3 } from "../../utilities/index.js";
import Component from "../component.js";

/**
 * Gives entities physical properties associated with rigid bodies
 */
export default class RigidBodyComponent extends Component {
    mass = 0;
    velocity = new Vector3();
    force = new Vector3();
    restitution = 0.5;
    friction = 0.5;

    isStatic = false;

    constructor(options={}) {
        super('rigid-body', [Component.Modifier.PHYSICAL]);
        Object.assign(this, options);
    }
}