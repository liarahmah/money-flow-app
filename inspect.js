const xlsx = require('xlsx');
const workbook = xlsx.readFile('spreadsheet.xlsx');

console.log("Sheets:", workbook.SheetNames);

for (const name of workbook.SheetNames) {
    if (name === 'TRANSAKSI' || name === 'SET-UP' || name === 'TRACKER LANGGANAN') {
        const sheet = workbook.Sheets[name];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\n--- Sheet: ${name} ---`);
        console.log(data.slice(0, 15)); // print first 15 rows
    }
}
