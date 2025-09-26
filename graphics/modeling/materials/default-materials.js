import { TexComponent, PrimComponent } from "../../components/index.js";
import { Color } from "../../utilities/index.js";
import Material from "./material.js";

export function BasicMaterial(params={}) {
    const baseColor = (params.color instanceof Color) ? params.color : Color.WHITE;
    const material = new Material([new PrimComponent(baseColor, 'baseColor')]);
    material.name = '';

    return material;
}

export function BlinnPhongMaterial(params={}) {
    const matComponents = [];

    // determine diffuse color/map
    if (typeof params.diffMap === 'string') {
        if (!params.diffMapOptions) params.diffMapOptions = {};
        params.diffMapOptions.defaultColor = Color.ORANGE;
        matComponents.push(new TexComponent(params.diffMap, 'diffuseMap', params.diffMapOptions));
    } else {
        const diffColor = (params.diffColor instanceof Color) ? params.diffColor : new Color(0.9, 0.9, 0.9);
        matComponents.push(new PrimComponent(diffColor, 'diffuseColor'));
    }

    // determine specular color/map
    if (typeof params.specMap === 'string') {
        if (!params.specMapOptions) params.specMapOptions = {};
        params.specMapOptions.defaultColor = Color.BLUE;
        matComponents.push(new TexComponent(params.specMap, 'specularMap', params.specMapOptions));
    } else {
        const specColor = (params.specColor instanceof Color) ? params.specColor : Color.WHITE;
        matComponents.push(new PrimComponent(specColor, 'specularColor'));
    }

    // determine shininess
    const shininess = (typeof params.shininess === 'number') ? params.shininess : 1.0;
    matComponents.push(new PrimComponent(shininess, 'shininess'));

    return new Material(matComponents);
}
