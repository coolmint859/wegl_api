import { Vector3 } from "../../utilities";
import Component from "../component.js";

export default class ColliderComponent extends Component {
    static ShapeType = Object.freeze({
        SPHERE: 'sphere',
        AABB: 'aabb',
        BOX: 'box',
        MESH: 'mesh',
    })

    shape = ColliderComponent.ShapeType.SPHERE;
    radius = 1;
    halfExtents = Vector3.Ones();

    isTrigger = false;

    constructor(options={}) {
        super('collider', [Component.Modifier.PHYSICAL]);
        Object.assign(this, options);
    }
}