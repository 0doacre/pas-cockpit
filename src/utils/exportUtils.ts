import Papa from 'papaparse';
import type { School } from '../types';

export const downloadCsv = (schools: School[], filename: string = 'nouveau_maillage.csv') => {
    // 1. Prepare data for export (Excel French format compatibility)
    const csvData = schools.map(s => {
        // Clone to avoid mutating the store types for export formatting
        const row: any = { ...s };

        // Format numbers with comma for French Excel if needed
        if (typeof row.IPS === 'number') {
            row.IPS = row.IPS.toString().replace('.', ',');
        }
        if (typeof row["Indice d'éloignement"] === 'number') {
            row["Indice d'éloignement"] = row["Indice d'éloignement"].toString().replace('.', ',');
        }

        // Ensure PAS is the current one (it is already in store, but good to be explicit if we had separate state)
        // row['Nom du PAS'] = s['Nom du PAS']; 

        return row;
    });

    // 2. Convert to CSV
    const csvString = Papa.unparse(csvData, {
        delimiter: ";", // Semicolon for French Excel
        header: true
    });

    // 3. Create Blob and trigger download
    // \uFEFF is the BOM for UTF-8 which helps Excel open the file correctly with special characters
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke URL to free memory
    URL.revokeObjectURL(url);
};
