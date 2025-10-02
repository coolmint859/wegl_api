import { ResourceCollector, StreamReader } from "../../utilities/index.js";
import GeoUtils from "./geometry-utils.js";
import Geometry from "./geometry.js";

/** 
 * Loads geometry data and creates a geometry instance from the data 
 * */
export default class GeometryLoader {
    /**
     * Load and create geometry data from a geometry file (e.g. PLY, OBJ...) 
     * @param {string} geometryPath the path to the geometry file.
     * @param {object} options options for loading and storage of the data
     * @returns {Geometry | null} a promise that resolves with a new geometry instance created with the loaded data
     */
    static async load(geometryPath, options={}) {
        if (typeof geometryPath !== 'string' || geometryPath.trim() === '') {
            console.error(`[GeometryLoader] Expected 'geometryPath' to be a valid path to a geometry file. Cannot create geometry instance.`)
            return null;
        }

        if (ResourceCollector.contains(geometryPath)) {
            const geometryData = await ResourceCollector.getWhenLoaded(
                geometryPath, { pollInterval: 0.2, pollTimeout: 3 }
            );

            return new Geometry(geometryPath, geometryData);
        }

        const geometryData = await ResourceCollector.load(
            geometryPath, StreamReader.read,
            { 
                maxRetries: options.maxRetries ?? 3,
                disposalDelay: options.disposalDelay ?? 0.5,
                category: 'geometry',
                loadData: options
            }
        )

        if (options.normalizeVertices) {
            geometryData.vertex.data = GeoUtils.normalizeVertices(geometryData.vertex.data, options)
        }

        console.log(`[GeometryLoader] Successfully Loaded new geometry '${geometryPath}'.`);
        return new Geometry(geometryPath, geometryData);
    }
}
