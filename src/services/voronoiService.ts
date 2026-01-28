import {
    point,
    featureCollection,
    voronoi,
    intersect,
    flattenEach,
    area,
    buffer,
    lineToPolygon
} from '@turf/turf';
import type { School } from '../types';
import type { Feature, Polygon, MultiPolygon, FeatureCollection, GeoJsonProperties } from 'geojson';

/**
 * Service to handle Voronoi generation and clipping logic.
 * This encapsulates the complexity of Turf.js interactions and ensures
 * consistency between the "V1 logic" and the V2 implementation.
 */

// V1 Hardcoded BBox for consistency
const V1_BBOX: [number, number, number, number] = [6.5, 47.5, 9.0, 50.0];

export const generateVoronoiFeatures = (
    schools: School[],
    sectorsGeoJson: any,
    filteredPasNames: string[]
) => {
    // 1. Prepare Points
    const points = schools
        .filter(s => s.Latitude && s.Longitude && s['Nom du PAS'])
        .map(s => point([s.Longitude, s.Latitude], {
            pas: s['Nom du PAS'],
            circo: s.Circonscription
        }));

    if (points.length < 3) {
        return { features: [], mask: null };
    }

    const collection = featureCollection(points);

    // 2. Prepare Mask (Department Boundary)
    const mask = getLargestPolygonMask(sectorsGeoJson);
    if (!mask) {
        return { features: [], mask: null };
    }

    // 3. Clean Mask (Critical Step)
    const cleanMask = cleanGeometry(mask);
    if (!cleanMask) {
        return { features: [], mask: null };
    }

    // 4. Generate Voronoi
    const voronoiPolys = voronoi(collection, { bbox: V1_BBOX });

    // 5. Clip and Attribute
    const finalFeatures: Feature<Polygon | MultiPolygon>[] = [];

    voronoiPolys.features.forEach((poly, i) => {
        if (!poly || !points[i]) return;

        const pasName = points[i].properties.pas;

        // Filter requested PAS only
        if (!filteredPasNames.includes(pasName)) return;

        // Apply properties
        poly.properties = {
            ...points[i].properties,
            color: stringToColor(pasName)
        };

        try {
            // Turf v7 signature: intersect(FeatureCollection)
            const fc = featureCollection([poly as Feature<Polygon>, cleanMask]);
            const inter = intersect(fc as any);

            if (inter) {
                inter.properties = { ...poly.properties };
                finalFeatures.push(inter as Feature<Polygon | MultiPolygon>);
            }
        } catch (e) {
            console.error(`[VoronoiService] Intersection error for ${pasName}:`, e);
            finalFeatures.push(poly as any);
        }
    });

    return { features: finalFeatures, mask: cleanMask };
};

// Helper: Extract largest polygon from GeoJSON (matching V1 logic)
const getLargestPolygonMask = (geoJson: any): Feature<Polygon | MultiPolygon> | null => {
    if (!geoJson) return null;

    const features: Feature<Polygon | MultiPolygon>[] = [];
    flattenEach(geoJson, (f) => {
        if (f.geometry.type === 'Polygon') {
            features.push(f as Feature<Polygon | MultiPolygon>);
        } else if (f.geometry.type === 'LineString') {
            try {
                const poly = lineToPolygon(f as any);
                if (poly) features.push(poly as Feature<Polygon>);
            } catch (e) { }
        }
    });

    if (features.length === 0) return null;

    // specific sort for V1: area descending
    features.sort((a, b) => area(b) - area(a));

    return features[0] || null;
};

// Helper: Clean geometry robustly
const cleanGeometry = (feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> | null => {
    try {
        const buffered = buffer(feature, 0);

        if (!buffered) return feature;

        // Handle FeatureCollection result
        if ((buffered as any).type === 'FeatureCollection') {
            const fc = buffered as any as FeatureCollection<Polygon | MultiPolygon, GeoJsonProperties>;
            if (fc.features && fc.features.length > 0) {
                // Sort by area just in case and return largest
                const sorted = [...fc.features].sort((a, b) => area(b) - area(a));
                return sorted[0] || null;
            }
            return null;
        }

        return buffered as Feature<Polygon | MultiPolygon>;
    } catch (e) {
        console.error('[VoronoiService] Error cleaning geometry:', e);
        return feature;
    }
};

const stringToColor = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = str.charCodeAt(i) + ((h << 5) - h);
    }
    return `hsl(${Math.abs(h) % 360}, 65%, 60%)`;
};
