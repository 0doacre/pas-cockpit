import Papa from 'papaparse';
import * as toGeoJSON from '@mapbox/togeojson';
import type { School } from '../types';

export const cleanNum = (v: any) => parseFloat(String(v).replace(',', '.').replace(/\s/g, '')) || 0;

export const parseDataCsv = (csvText: string): Promise<School[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                const data = results.data
                    .filter((r: any) => r.UAI && r['Nom du PAS'])
                    .map((r: any) => ({
                        ...r,
                        IPS: cleanNum(r.IPS),
                        "Effectifs (Archipel)": cleanNum(r["Effectifs (Archipel)"]),
                        Latitude: cleanNum(r.Latitude),
                        Longitude: cleanNum(r.Longitude),
                        "Indice d'éloignement": cleanNum(r["Indice d'éloignement"]),
                        ULIS: cleanNum(r.ULIS)
                    })) as School[];
                resolve(data);
            },
            error: (err: any) => reject(err)
        });
    });
};

export const parseKml = (kmlText: string): any => {
    const parser = new DOMParser();
    const kml = parser.parseFromString(kmlText, 'text/xml');
    return toGeoJSON.kml(kml);
};
