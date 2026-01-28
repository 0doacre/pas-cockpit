import Papa from 'papaparse';

export interface RhData {
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
        const response = await fetch(`${import.meta.env.BASE_URL}synoptique.csv`);
        const text = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                delimiter: ';',
                skipEmptyLines: true,
                complete: (results) => {
                    const rhMap = new Map<string, RhData>();

                    // Skip header rows (first 4 lines based on file structure)
                    const dataRows = results.data.slice(4);

                    dataRows.forEach((row: any) => {
                        if (row.length < 2 || !row[1]) return; // Skip if no PAS name

                        const pasName = row[1].trim();
                        if (pasName === 'A définir' || !pasName) return;

                        rhMap.set(pasName, {
                            circonscription: row[0]?.trim() || '',
                            pas: pasName,
                            mail: row[2]?.trim() || '',
                            location: row[3]?.trim() || '',
                            coord: row[5]?.trim() || '',
                            phone: row[6]?.trim() || '',
                            educ: row[7]?.trim() || '',
                            aesh: row[8]?.trim() || '',
                            dacs: row[9]?.trim() || '',
                            pilot2d: row[10]?.trim() || '',
                            pilot1d: row[11]?.trim() || '',
                            pilotEsms: row[12]?.trim() || '',
                            partner: row[13]?.trim() || ''
                        });
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
