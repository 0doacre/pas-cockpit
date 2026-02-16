import Papa from 'papaparse';
import type { School } from '../types';

export const downloadCsv = (schools: School[], filename: string = 'data.csv') => {
    // 1. Prepare data for export
    const csvData = schools.map(s => {
        // Clone to avoid mutating the store types for export formatting
        const row: any = { ...s };

        // We don't want to convert numbers to strings with commas because 
        // the loader expects standard numbers/dots and the original CSV uses dots.
        // Also, we should remove any runtime-only fields if we added any.
        delete row['Distance (km)'];

        return row;
    });

    // 2. Convert to CSV
    const csvString = Papa.unparse(csvData, {
        delimiter: ",", // Comma to match original data.csv
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
