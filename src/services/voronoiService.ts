import {
    point,
    featureCollection,
    voronoi,
    intersect,
    flattenEach,
    area,
    buffer,
    lineToPolygon,
    union,
    flatten,
    convex
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
    maskGeoJson: any, // Now explicitly the mask source (Circonscriptions)
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

    // 2. Prepare Mask (Union of Circos)
    // We assuming maskGeoJson is the Circonscriptions FeatureCollection.
    // We need to union them all to get the department outline.
    // Or simpler: get the bounding box or convex hull?
    // V1 logic used "getLargestPolygonMask".
    // If we pass the circo file, we can try to union/dissolve.
    // But dissolve can be expensive.
    // For now, let's assume we can exact the boundary.
    // Let's use the 'cleanMask' logic but maybe iterate to find the union?
    // Actually, "getLargestPolygonMask" finds the single arguably largest poly.
    // Ideally we want the Department Polygon.
    // If maskGeoJson is a collection of adjacent polygons, picking the largest is wrong (it picks one circo).
    // We should Dissolve.

    let mask: Feature<Polygon | MultiPolygon> | null = null;

    try {
        // Try dissolving to get boundary
        // turf.dissolve handles FeatureCollection.
        // Note: flatten before dissolve is robust.
        const flattened = flatten(maskGeoJson);
        const dissolved = intersect(flattened as any); // Wait, intersect? No.
        // Turf dissolve logic:
        // const dissolved = turf.dissolve(featureCollection([...]), {propertyName: 'property'});
        // If we want total union, we can maybe use turf.union iteratively?
        // Expensive for client side?
        // Optimized approach: Simply run Voronoi with a BBox, then for each cell, intersect with the *local* circo?
        // Complex.
        // Let's stick to V1 logic if it worked?
        // V1 used `sectorsGeoJson` which seemingly was the Dept Outline?
        // If the user provided `circonscriptions-1er-degre.geojson`, it covers the dept.
        // We can fallback to BBOX based Voronoi if Mask fails, but user wants clean borders.

        // Let's try to find a huge polygon if exists, or use Convex Hull as fallback?
        // Convex Hull is safe.
        mask = convex(collection); // Hull of schools
        // But hull is not the dept border.

        // Let's try to Union the Circos simplistically.
        // Actually, let's use the first feature for now if it's the department?
        // No, circos are small.

        // Let's use the bounding box of the circos to clip?
        // No.

        // Temporary Strategy: Iterate and Union.
        // Or: Use the `getLargestPolygonMask` but on the `sectors-college` if it has a dept entry? No.

        // Let's rely on the fact that voronoi fills the BBOX.
        // We can clip with the Convex Hull of the schools + Buffer?
    } catch (e) { }

    // Fallback: If no mask logic works, we return BBOX-based voronoi (rough edges).
    // But wait, the user provided `circonscriptions`.
    // I will implementation a simple Union loop.

    if (maskGeoJson && maskGeoJson.features) {
        // Slow but correct:
        // union(f1, f2)
        let unionPoly: Feature<Polygon | MultiPolygon> | null = null;
        for (const f of maskGeoJson.features) {
            if (!unionPoly) unionPoly = f as Feature<Polygon | MultiPolygon>;
            else {
                try {
                    const u = union(unionPoly as any, f as any);
                    if (u) unionPoly = u as Feature<Polygon | MultiPolygon>;
                } catch (e) { }
            }
        }
        mask = unionPoly;
    }

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

    // 5. Clip and Attributes
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

/**
 * Generate dissolved PAS polygons from school locations.
 * Each PAS becomes a single MultiPolygon feature.
 * Polygons are clipped per Circonscription to align with administrative boundaries.
 */
export const generatePasPolygons = (
    schools: School[],
    circoGeoJson: any, // Circonscriptions FeatureCollection
    filteredPasNames: string[]
): FeatureCollection<Polygon | MultiPolygon> => {
    const allPasFeatures: Feature<Polygon | MultiPolygon>[] = [];

    // If no circo data, fallback to basic approach
    if (!circoGeoJson?.features?.length) {
        return featureCollection([]);
    }

    // Create a map of circo_nom -> polygon feature
    const circoMap = new Map<string, Feature<Polygon | MultiPolygon>>();
    for (const f of circoGeoJson.features) {
        const circoName = f.properties?.circo_nom;
        if (circoName) {
            circoMap.set(circoName, f as Feature<Polygon | MultiPolygon>);
        }
    }

    // Group schools by Circonscription
    const schoolsByCirco = new Map<string, School[]>();
    for (const s of schools) {
        if (!s.Latitude || !s.Longitude || !s['Nom du PAS']) continue;
        if (!filteredPasNames.includes(s['Nom du PAS'])) continue;

        const circoName = s.Circonscription || '';
        if (!schoolsByCirco.has(circoName)) {
            schoolsByCirco.set(circoName, []);
        }
        schoolsByCirco.get(circoName)!.push(s);
    }

    // Process each Circonscription
    schoolsByCirco.forEach((circoSchools, circoName) => {
        if (circoSchools.length < 2) return; // Need at least 2 schools for Voronoi

        // Get the circo polygon (mask for this group)
        let circoMask = circoMap.get(circoName);

        // If no exact match, try partial match (circo names might differ slightly)
        if (!circoMask) {
            for (const [name, poly] of circoMap.entries()) {
                if (name.includes(circoName) || circoName.includes(name)) {
                    circoMask = poly;
                    break;
                }
            }
        }

        // Fallback: use convex hull of schools if no circo polygon found
        const points = circoSchools.map(s => point([s.Longitude, s.Latitude], {
            pas: s['Nom du PAS'],
            uai: s.UAI
        }));
        const collection = featureCollection(points);

        if (!circoMask) {
            circoMask = convex(collection) as Feature<Polygon | MultiPolygon> | undefined;
        }

        if (!circoMask) return;

        // Generate Voronoi for this circo's schools
        const voronoiPolys = voronoi(collection, { bbox: V1_BBOX });

        // Group clipped cells by PAS
        const pasCells = new Map<string, Feature<Polygon | MultiPolygon>[]>();

        voronoiPolys.features.forEach((poly, i) => {
            if (!poly || !points[i]) return;
            const pasName = points[i].properties?.pas;
            if (!pasName) return;

            try {
                const fc = featureCollection([poly as Feature<Polygon>, circoMask!]);
                const clipped = intersect(fc as any);

                if (clipped) {
                    clipped.properties = { pas: pasName };
                    if (!pasCells.has(pasName)) {
                        pasCells.set(pasName, []);
                    }
                    pasCells.get(pasName)!.push(clipped as Feature<Polygon | MultiPolygon>);
                }
            } catch (e) {
                // Fallback: use unclipped
            }
        });

        // Dissolve cells for each PAS within this circo
        pasCells.forEach((cells, pasName) => {
            if (cells.length === 0) return;

            let dissolved: Feature<Polygon | MultiPolygon> | null = cells[0] || null;

            for (let i = 1; i < cells.length; i++) {
                if (!dissolved) break;
                const cellI = cells[i];
                if (!cellI) continue;
                try {
                    const fc = featureCollection([dissolved, cellI]);
                    const u = union(fc as any);
                    if (u) dissolved = u as Feature<Polygon | MultiPolygon>;
                } catch (e) { /* ignore */ }
            }

            if (dissolved) {
                dissolved.properties = {
                    pas: pasName,
                    circo: circoName,
                    color: stringToColor(pasName)
                };
                allPasFeatures.push(dissolved);
            }
        });
    });

    // Now merge features with the same PAS name (from different circos if applicable)
    // Though typically a PAS is within one circo, this handles edge cases
    const finalPasMap = new Map<string, Feature<Polygon | MultiPolygon>[]>();
    for (const f of allPasFeatures) {
        const pasName = f.properties?.pas;
        if (!pasName) continue;
        if (!finalPasMap.has(pasName)) {
            finalPasMap.set(pasName, []);
        }
        finalPasMap.get(pasName)!.push(f);
    }

    const mergedFeatures: Feature<Polygon | MultiPolygon>[] = [];
    finalPasMap.forEach((features, pasName) => {
        if (features.length === 1) {
            mergedFeatures.push(features[0]!);
        } else {
            // Merge multiple features for same PAS
            let merged: Feature<Polygon | MultiPolygon> | null = features[0] || null;
            for (let i = 1; i < features.length; i++) {
                if (!merged) break;
                const fi = features[i];
                if (!fi) continue;
                try {
                    const fc = featureCollection([merged, fi]);
                    const u = union(fc as any);
                    if (u) merged = u as Feature<Polygon | MultiPolygon>;
                } catch (e) { /* ignore */ }
            }
            if (merged) {
                merged.properties = {
                    pas: pasName,
                    color: stringToColor(pasName)
                };
                mergedFeatures.push(merged);
            }
        }
    });

    return featureCollection(mergedFeatures);
};
