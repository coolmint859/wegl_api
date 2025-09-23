import { ColorComponent, FloatComponent } from "../../components/index.js";
import { Color } from "../../utilities/index.js";
import Material from "./material.js";

export function BPColorMaterial(params={}) {
    return new Material([
        new ColorComponent(params.diffColor ?? new Color(0.9, 0.9, 0.9), 'diffuseColor'),
        new ColorComponent(params.specColor ?? Color.WHITE, 'specularColor'),
        new FloatComponent(params.shininess ?? 1.0, 'shininess')
    ]);
}