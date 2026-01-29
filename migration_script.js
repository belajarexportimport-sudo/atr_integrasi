function migrateToSupabase() {
    // --- CONFIGURATION ---
    // Pastikan URL dan Key ini sama dengan yang ada di admin-generate.html
    var SUPABASE_URL = 'https://ewquycutqbtagjlokvyn.supabase.co';
    var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cXV5Y3V0cWJ0YWdqbG9rdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTI3MjYsImV4cCI6MjA4NTE4ODcyNn0.FhdCAcK7nxIUk7zdoqxX9xyrjCslBUPXRBiWgugXu3s';

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Tracking_Data'); // Nama Sheet Data Lama

    // Ambil semua data (mulai baris 2, karena baris 1 header)
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        Logger.log("Tidak ada data untuk dimigrasi.");
        return;
    }

    var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    // Asumsi Kolom: [AWB, Customer, Origin, Destination, Service, Weight, Qty, CreatedAt]

    var payloadBatch = [];

    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var awb = row[0];

        // Validasi sederhana: Abaikan jika AWB kosong atau header
        if (!awb || awb == 'AWB Number') continue;

        // Mapping Data GSheet -> Supabase Table (tracking_events)
        var record = {
            awb_number: awb,
            status: 'Created', // Status default migrasi
            location: row[2], // Origin
            description: 'Historical Data Migration. Customer: ' + row[1] + ', Dest: ' + row[3],
            is_manual: true,
            occurred_at: formatDateISO(row[7]) // CreatedAt
        };

        payloadBatch.push(record);
    }

    // Kirim ke Supabase (Batch Insert)
    if (payloadBatch.length > 0) {
        var url = SUPABASE_URL + '/rest/v1/tracking_events';
        var options = {
            'method': 'post',
            'headers': {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=ignore-duplicates' // Penting: Biar tidak error kalau data sudah ada (Idempotent)
            },
            'payload': JSON.stringify(payloadBatch)
        };

        try {
            var response = UrlFetchApp.fetch(url, options);
            Logger.log('Success! Migrated ' + payloadBatch.length + ' rows.');
            Logger.log('Response: ' + response.getContentText());
        } catch (e) {
            Logger.log('Error: ' + e.toString());
        }
    }
}

function formatDateISO(dateObj) {
    try {
        return new Date(dateObj).toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}
