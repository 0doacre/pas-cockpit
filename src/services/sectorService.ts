import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';

export interface SectorService {
    loadSectors(): Promise<void>;
    getPolygonForCollege(uai: string): Feature<Polygon | MultiPolygon> | null;
    getPolygonForCirco(circoName: string): Feature<Polygon | MultiPolygon> | null;
    getAllCollegeSectors(): FeatureCollection;
    getAllCircoSectors(): FeatureCollection;
}

class SectorServiceImpl implements SectorService {
    private collegeSectors: FeatureCollection | null = null;
    private circoSectors: FeatureCollection | null = null;
    private collegeMap = new Map<string, Feature<Polygon | MultiPolygon>>();
    private circoMap = new Map<string, Feature<Polygon | MultiPolygon>>();

    async loadSectors(): Promise<void> {
        try {
            // Load College Sectors
            const collegeResponse = await fetch(`${import.meta.env.BASE_URL}data/secteurs-college.geojson`);
            if (collegeResponse.ok) {
                this.collegeSectors = await collegeResponse.json();
                this.indexCollegeSectors();
            } else {
                console.error('Failed to load secteurs-college.geojson');
            }

            // Load Circo Sectors
            const circoResponse = await fetch(`${import.meta.env.BASE_URL}data/circonscriptions-1er-degre.geojson`);
            if (circoResponse.ok) {
                const circoData = await circoResponse.json();
                if (circoData) {
                    // Filter for Dept 67 only (Bas-Rhin)
                    const features = circoData.features.filter((f: any) => {
                        // Check properties for department code
                        // Based on file content: "code_dep" or "insee_dep" or similar?
                        // The output showed: "circo_code":"068...", "nom_reg":"GRAND EST".
                        // Common fields: code_departement, code_insee_departement. 
                        // Let's assume matches 67*. Or check if property exists.
                        // Let's try to filter by "code_departement" or just check if it starts with "67".

                        // Safe check: inspect properties
                        const props = f.properties || {};
                        const code = props.code_departement || props.code_dept || props.dep || '';
                        if (code === '67') return true;

                        // Also check circo_code "067..."
                        if (props.circo_code && String(props.circo_code).startsWith('067')) return true;

                        return false;
                    });

                    this.circoSectors = {
                        type: 'FeatureCollection',
                        features: features
                    };
                    this.indexCircoSectors();
                } else {
                    console.error('Failed to parse circonscriptions-1er-degre.geojson data.');
                }
            } else {
                console.error('Failed to load circonscriptions-1er-degre.geojson');
            }
        } catch (e) {
            console.error('Error loading sector GeoJSONs:', e);
        }
    }

    private indexCollegeSectors() {
        if (!this.collegeSectors) return;
        this.collegeSectors.features.forEach(f => {
            // properties: { "codeRNE": "0572021M", "nom": "...", "secteur": "Public", ... }
            const uai = f.properties?.codeRNE;
            if (uai) {
                this.collegeMap.set(uai, f as Feature<Polygon | MultiPolygon>);
            }
            // Also index by other possibilities if needed? 
            // The file analysis showed "codeRNE" as the key.
        });
    }

    private indexCircoSectors() {
        if (!this.circoSectors) return;
        this.circoSectors.features.forEach(f => {
            // properties: { "circo_nom": "IEN STRASBOURG 1", ... }
            const name = f.properties?.circo_nom;
            if (name) {
                this.circoMap.set(name, f as Feature<Polygon | MultiPolygon>);
            }
        });
    }

    getPolygonForCollege(uai: string): Feature<Polygon | MultiPolygon> | null {
        return this.collegeMap.get(uai) || null;
    }

    getPolygonForCirco(circoName: string): Feature<Polygon | MultiPolygon> | null {
        // Simple exact match first
        let poly = this.circoMap.get(circoName);
        if (poly) return poly;

        // Try fuzzy match or normalization if needed
        // e.g. "IEN STRASBOURG 1" vs "STRASBOURG 1"
        // For now, return null if no exact match
        return null;
    }

    getAllCollegeSectors(): FeatureCollection {
        return this.collegeSectors || { type: 'FeatureCollection', features: [] };
    }

    getAllCircoSectors(): FeatureCollection {
        return this.circoSectors || { type: 'FeatureCollection', features: [] };
    }
}

export const sectorService = new SectorServiceImpl();
