import Papa from 'papaparse';

export interface RhData {
    uai: string;
    circonscription: string;
    pas: string;
    mail: string;
    location: string;
    coord: string;
    phone: string;
    educ: string;
    aesh: string;
    dacs: string;
    pilot2d: string;
    pilot1d: string;
    pilotEsms: string;
    partner: string;
}

export async function loadRhData(): Promise<Map<string, RhData>> {
    try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/data.csv`);
        const text = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results: any) => {
                    const rhMap = new Map<string, RhData>();

                    results.data.forEach((row: any) => {
                        const pasName = row['Nom du PAS']?.trim();
                        if (!pasName || pasName === 'A définir') return;

                        // Only map if not already present (or overwrite?) - usually 1 per PAS?
                        // Actually the CSV has lines per SCHOOL.
                        // We need 1 entry per PAS for the RH "card".
                        // Use the First finding or filter for something specific?
                        // Assuming all schools in a PAS share the formatted RH info?
                        // Or maybe we pick the "Tête de pont"?
                        // For now, simple overwrite or keep first.
                        if (!rhMap.has(pasName)) {
                            rhMap.set(pasName, {
                                uai: row['UAI'] || '',
                                circonscription: row['Circonscription']?.trim() || '',
                                pas: pasName,
                                mail: row['Mail']?.trim() || '',
                                location: `${row['Adresse'] || ''} ${row['Code Postal'] || ''} ${row['Ville'] || ''}`.trim(),
                                coord: `${row['Latitude'] || ''},${row['Longitude'] || ''}`,
                                phone: row['Téléphone']?.trim() || '',
                                educ: row['Education prioritaire (Archipel)']?.trim() || '',
                                aesh: '', // Missing in new CSV
                                dacs: '', // Missing in new CSV
                                pilot2d: '', // Missing in new CSV
                                pilot1d: '', // Missing in new CSV
                                pilotEsms: '', // Missing in new CSV
                                partner: '' // Missing in new CSV
                            });
                        }
                    });

                    resolve(rhMap);
                },
                error: (error: Error) => reject(error)
            });
        });
    } catch (error) {
        console.error('Failed to load RH data:', error);
        return new Map();
    }
}
