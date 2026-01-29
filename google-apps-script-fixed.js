function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var action = e.parameter.action;

        // --- 1. TRACKING (Action kosong / 'track') ---
        if (!action || action == 'track') {
            var awb = e.parameter.awb;
            if (!awb) return createJSON({ found: false, message: 'No AWB provided' });

            var data = getTrackingData(awb);
            return createJSON(data);
        }

        // --- 2. GENERATE RESI ---
        if (action == 'generate') {
            var trackingNumber = generateTrackingNumber();
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var sheet = ss.getSheetByName('Tracking_Data');

            // Kolom: [AWB, Customer, Origin, Destination, Service, Weight, Qty, CreatedAt]
            sheet.appendRow([
                trackingNumber,
                e.parameter.customer_name || '',
                e.parameter.origin || 'Jakarta',
                e.parameter.destination || '',
                e.parameter.service || 'Reguler',
                e.parameter.weight || '1',
                e.parameter.qty || '1',
                new Date()
            ]);

            // Tambah status awal di History
            addHistory(trackingNumber, 'Created', 'Shipment Created', 'System');

            return createJSON({ success: true, tracking_number: trackingNumber });
        }

        // --- 3. UPDATE STATUS (Dari PWA) ---
        if (action == 'update') {
            var awb = e.parameter.awb;
            var status = e.parameter.status;
            var loc = e.parameter.location;
            var desc = e.parameter.description;

            addHistory(awb, status, desc, loc);

            return createJSON({ success: true, message: 'Status updated' });
        }

        return createJSON({ success: false, message: 'Unknown Action' });

    } catch (error) {
        return createJSON({ success: false, error: error.toString() });
    } finally {
        lock.releaseLock();
    }
}

// --- HELPER FUNCTIONS ---

function getTrackingData(awb) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = ss.getSheetByName('Tracking_Data');
    var historySheet = ss.getSheetByName('Status_Updates');

    // 1. Cari Data Utama
    var mainData = mainSheet.getDataRange().getValues();
    var shipment = null;

    // Skip Header (row 0)
    for (var i = 1; i < mainData.length; i++) {
        if (mainData[i][0] == awb) { // Asumsi Kolom A = AWB
            shipment = {
                awb: mainData[i][0],
                customer_name: mainData[i][1],
                origin: mainData[i][2],
                destination: mainData[i][3],
                service: mainData[i][4],
                weight: mainData[i][5],
                status: 'Created' // Default
            };
            break;
        }
    }

    if (!shipment) return { found: false };

    // 2. Cari History/Logs
    var histData = historySheet.getDataRange().getValues();
    var history = [];

    // Skip Header
    for (var i = 1; i < histData.length; i++) {
        if (histData[i][0] == awb) {
            history.push({
                status: histData[i][1],
                location: histData[i][2],
                timestamp: formatDate(histData[i][3]),
                notes: histData[i][4]
            });
            // Update status terakhir paket
            shipment.status = histData[i][1];
        }
    }

    // Sort history newest first (opsional, tergantung selera)
    // history.reverse(); 

    shipment.found = true;
    shipment.history = history;
    return shipment;
}

function addHistory(awb, status, notes, location) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Status_Updates');
    // Kolom: [AWB, Status, Location, Timestamp, Notes]
    sheet.appendRow([awb, status, location, new Date(), notes]);
}

function generateTrackingNumber() {
    var prefix = "ATR";
    var date = new Date();
    var dateStr = Utilities.formatDate(date, "Asia/Jakarta", "yyyyMMdd");
    var random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return prefix + dateStr + random; // Contoh: ATR202401301234
}

function createJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(dateObj) {
    try {
        return Utilities.formatDate(new Date(dateObj), "Asia/Jakarta", "dd MMM yyyy HH:mm");
    } catch (e) {
        return dateObj;
    }
}
