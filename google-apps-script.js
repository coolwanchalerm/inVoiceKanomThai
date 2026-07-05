/**
 * Google Apps Script for "ร้านขนมไทยแทนคุณ" Invoice System
 * 
 * Instructions:
 * 1. Open Google Sheets (create a new sheet or use an existing one).
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any default code in Code.gs and paste this code.
 * 4. Click Save (disk icon).
 * 5. Click "Deploy" (top right) > "New deployment".
 * 6. Select Type: "Web app".
 * 7. Set:
 *    - Description: "Invoice API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 8. Click "Deploy". Copy the "Web app URL" and paste it in the Web App Settings in your dashboard.
 * 
 * OPTIONAL: If you get "Cannot read properties of null/undefined" error,
 * paste your Google Sheet ID inside the quotation marks below:
 */
var SPREADSHEET_ID = "1QMwVnSBpY-1caaSca-31nFahrbiRh0Bpjgeh6x5Kc5A"; // e.g. "1aBcDeFgHiJkLmNoPqRsTuVwXyZ" (leave empty to auto-detect)
var DRIVE_FOLDER_ID = "1HiMD5oEYXwMBriwpXH2UloNpPv23_RYa"; // Google Drive Folder ID to store PDFs

/**
 * วิธีขออนุญาตสิทธิ์เข้าใช้งาน Google Drive และ Sheets (Authorization):
 * 1. ในหน้าต่าง Apps Script ค้นหาแถบเมนูด้านบนที่มีปุ่ม "เรียกใช้" (Run)
 * 2. เลือกฟังก์ชันชื่อ "triggerPermissions" ในดรอปดาวน์ข้างปุ่มเรียกใช้
 * 3. กดปุ่ม "เรียกใช้" (Run)
 * 4. หน้าต่างความปลอดภัยจะปรากฏขึ้นมา ให้กด "ตรวจสอบสิทธิ์" (Review Permissions) และเลือกบัญชี Google ของคุณ
 * 5. กด "ขั้นสูง" (Advanced) > "ไปที่... (ไม่ปลอดภัย)" เพื่อยินยอมให้ระบบสร้าง PDF และบันทึกไฟล์ใน Drive
 */
function triggerPermissions() {
  var ss = getSpreadsheet();
  setupSheets(ss);
  var root = DriveApp.getRootFolder();
  
  // This line is added purely to force Google to request FULL Drive permissions (Write access)
  var dummy = DriveApp.createFile('dummy.txt', 'dummy');
  dummy.setTrashed(true); // Delete it immediately
  
  Logger.log("✅ ยินยอมสิทธิ์สำเร็จแล้ว!");
  Logger.log("ชื่อไฟล์ชีตปัจจุบัน: " + ss.getName());
  Logger.log("เชื่อมต่อ Google Drive สำเร็จ: " + root.getName());
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.getActive();
  }
  
  if (!ss) {
    throw new Error("ไม่สามารถค้นหา Google Sheet ได้ กรุณานำ Spreadsheet ID มากรอกในตัวแปร SPREADSHEET_ID ที่บรรทัดแรกของโค้ด Apps Script");
  }
  return ss;
}

function handleRequest(e) {
  var corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Preflight check
  if (e && e.parameter && e.parameter.method === 'OPTIONS') {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var ss = getSpreadsheet();
    setupSheets(ss);

    // Support both GET-based command and POST-based command
    var method = e.parameter ? (e.parameter.method || (e.postData ? 'POST' : 'GET')) : (e.postData ? 'POST' : 'GET');
    var action = e.parameter ? e.parameter.action : null;
    var data = null;

    if (method === 'POST' && e.postData) {
      data = JSON.parse(e.postData.contents);
      action = data.action;
    } else if (method === 'GET' && e.parameter && e.parameter.data) {
      data = JSON.parse(decodeURIComponent(e.parameter.data));
    }

    if (action === 'createInvoice' && data) {
      return createInvoice(ss, data.invoice, data.items);
    } else if (action === 'deleteInvoice' && data) {
      return deleteInvoice(ss, data.invoiceId);
    } else if (action === 'manageProduct' && data) {
      return manageProduct(ss, data.subAction, data.product);
    } else if (action === 'fetchData' || method === 'GET') {
      // Fetch sales data
      return fetchSalesData(ss);
    } else {
      throw new Error('Unknown action: ' + action);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupSheets(ss) {
  var invoicesSheet = ss.getSheetByName('Invoices');
  if (!invoicesSheet) {
    invoicesSheet = ss.insertSheet('Invoices');
    invoicesSheet.appendRow(['Invoice ID', 'Date', 'Customer Name', 'Total Amount', 'Timestamp', 'PDF URL']);
    invoicesSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#D1E7DD");
  } else {
    // Check if PDF URL column exists, if not add it (migration)
    var headers = invoicesSheet.getRange(1, 1, 1, invoicesSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('PDF URL') === -1) {
      invoicesSheet.getRange(1, invoicesSheet.getLastColumn() + 1).setValue('PDF URL').setFontWeight("bold");
    }
  }

  var itemsSheet = ss.getSheetByName('InvoiceItems');
  if (!itemsSheet) {
    itemsSheet = ss.insertSheet('InvoiceItems');
    itemsSheet.appendRow(['Invoice ID', 'Description', 'Quantity', 'Unit Price', 'Amount', 'Date']);
    itemsSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#F8D7DA");
  }

  var productsSheet = ss.getSheetByName('Products');
  if (!productsSheet) {
    productsSheet = ss.insertSheet('Products');
    productsSheet.appendRow(['Product ID', 'Name', 'Price', 'Last Updated']);
    productsSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#FFF3CD");
    // Add some default preset products
    productsSheet.appendRow([Utilities.getUuid(), 'เบรก ขนม 2 อย่าง', 25, new Date()]);
    productsSheet.appendRow([Utilities.getUuid(), 'เบรก ขนม 3 อย่าง', 35, new Date()]);
    productsSheet.appendRow([Utilities.getUuid(), 'ทองหยิบ ทองหยอด ฝอยทอง', 50, new Date()]);
    productsSheet.appendRow([Utilities.getUuid(), 'ขนมชั้น อัญชัน ใบเตย', 15, new Date()]);
  }
}

// Generates PDF and saves it inside a dedicated folder in Google Drive
function saveInvoicePDFToDrive(invoice, items) {
  if (!invoice || !invoice.date) {
    Logger.log("Error: invoice object or invoice.date is missing. Did you run this function manually from the editor?");
    return "";
  }
  try {
    var folder;
    if (DRIVE_FOLDER_ID) {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } else {
      var folderName = "ใบเสร็จร้านขนมไทยแทนคุณ";
      var folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
    }

    // Convert date format for print
    var dateParts = invoice.date.split('-');
    var BEYear = parseInt(dateParts[0]) + 543;
    var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var monthThai = months[parseInt(dateParts[1]) - 1];
    var formattedDate = "วันที่ " + parseInt(dateParts[2]) + " " + monthThai + " " + BEYear;

    // Simple HTML Invoice template
    var htmlContent = `
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * { font-family: 'Sarabun', sans-serif !important; }
            body { padding: 0; margin: 0; color: #000; font-size: 14px; }
            .invoice-card { max-width: 800px; margin: 0 auto; }
            
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .header-table td { border: 1px solid #000; padding: 15px; text-align: center; }
            .store-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
            .store-phone { font-size: 14px; }
            
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .info-left { width: 60%; border: 1px solid #000; border-right: none; padding: 15px; }
            .info-right { width: 40%; border: 1px solid #000; padding: 15px; text-align: center; font-weight: bold; vertical-align: middle; }
            .info-label { font-size: 14px; margin-bottom: 5px; }
            .customer-name { font-size: 16px; font-weight: bold; text-align: center; }
            
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 12px; text-align: center; }
            .items-table th { font-weight: bold; font-size: 14px; }
            .sub-th { font-weight: normal; font-size: 12px; }
            
            .col-qty { width: 15%; }
            .col-desc { width: 45%; text-align: left !important; }
            .col-price { width: 20%; text-align: right !important; }
            .col-amount { width: 20%; text-align: right !important; }
            
            .total-label { font-weight: bold; text-align: center !important; }
            .total-val { font-weight: bold; text-align: right !important; }
            .empty-row { height: 40px; }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <table class="header-table">
              <tr>
                <td>
                  <div class="store-name">ร้านขนมไทยแทนคุณ</div>
                  <div class="store-phone">0804628068 , 0831641982</div>
                </td>
              </tr>
            </table>

            <table class="info-table" style="width: 100%;">
              <tr>
                <td class="info-left">
                  <div class="info-label">ชื่อลูกค้า</div>
                  <div class="customer-name">${invoice.customerName}</div>
                </td>
                <td class="info-right">${formattedDate}</td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th class="col-qty">จำนวน</th>
                  <th class="col-desc">รายการ</th>
                  <th class="col-price">หน่วยละ</th>
                  <th class="col-amount">จำนวนเงิน</th>
                </tr>
                <tr>
                  <th class="col-qty sub-th">Quantity</th>
                  <th class="col-desc sub-th">Description</th>
                  <th class="col-price sub-th">Unit Price</th>
                  <th class="col-amount sub-th">Amount</th>
                </tr>
              </thead>
              <tbody>
    `;

    for (var i = 0; i < items.length; i++) {
      htmlContent += `
        <tr>
          <td class="col-qty">${items[i].quantity}</td>
          <td class="col-desc">${items[i].description}</td>
          <td class="col-price">${Number(items[i].unitPrice).toLocaleString()}</td>
          <td class="col-amount">${Number(items[i].amount).toLocaleString()}</td>
        </tr>
      `;
    }

    // Pad with empty rows if items count < 4
    var padCount = 4 - items.length;
    for (var j = 0; j < padCount; j++) {
      htmlContent += `
        <tr class="empty-row">
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }

    htmlContent += `
                <tr>
                  <td colspan="2" class="total-label">รวมเงิน</td>
                  <td></td>
                  <td class="col-amount total-val">${Number(invoice.totalAmount).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    var blob = Utilities.newBlob(htmlContent, 'text/html', 'invoice.html');
    var file = folder.createFile(blob.getAs('application/pdf'));
    file.setName("ใบเสร็จ_" + invoice.id + ".pdf");
    
    // Set file share options so anyone with link can view it (useful for opening from the Web App dashboard)
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Warning: Could not set public sharing for file: " + shareErr.toString());
      // Proceed even if sharing cannot be set (owner can still view it)
    }
    
    return file.getUrl();
  } catch (err) {
    Logger.log("Error generating PDF: " + err.toString());
    throw new Error("PDF Generation Error: " + err.toString());
  }
}

function createInvoice(ss, invoice, items) {
  if (!invoice || !items) {
    return { status: 'error', message: 'Invoice or items data is missing. Did you run this function manually from the editor?' };
  }
  var invoicesSheet = ss.getSheetByName('Invoices');
  var itemsSheet = ss.getSheetByName('InvoiceItems');

  // 1. Generate PDF and Save to Google Drive
  var pdfUrl = saveInvoicePDFToDrive(invoice, items);

  // 2. Save to Invoices sheet
  invoicesSheet.appendRow([
    invoice.id,
    invoice.date,
    invoice.customerName,
    invoice.totalAmount,
    new Date(),
    pdfUrl
  ]);

  // 3. Save each item to InvoiceItems sheet
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    itemsSheet.appendRow([
      invoice.id,
      item.description,
      item.quantity,
      item.unitPrice,
      item.amount,
      invoice.date
    ]);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    invoiceId: invoice.id,
    pdfUrl: pdfUrl
  })).setMimeType(ContentService.MimeType.JSON);
}

function fetchSalesData(ss) {
  var invoicesSheet = ss.getSheetByName('Invoices');
  var itemsSheet = ss.getSheetByName('InvoiceItems');

  var invoices = [];
  var items = [];

  if (invoicesSheet) {
    var invoiceRows = invoicesSheet.getDataRange().getValues();
    // Skip headers
    for (var i = 1; i < invoiceRows.length; i++) {
      invoices.push({
        id: invoiceRows[i][0],
        date: invoiceRows[i][1],
        customerName: invoiceRows[i][2],
        totalAmount: Number(invoiceRows[i][3]),
        timestamp: invoiceRows[i][4],
        pdfUrl: invoiceRows[i][5] || ""
      });
    }
  }

  if (itemsSheet) {
    var itemRows = itemsSheet.getDataRange().getValues();
    // Skip headers
    for (var j = 1; j < itemRows.length; j++) {
      items.push({
        invoiceId: itemRows[j][0],
        description: itemRows[j][1],
        quantity: Number(itemRows[j][2]),
        unitPrice: Number(itemRows[j][3]),
        amount: Number(itemRows[j][4]),
        date: itemRows[j][5]
      });
    }
  }

  var productsSheet = ss.getSheetByName('Products');
  var products = [];
  if (productsSheet) {
    var productRows = productsSheet.getDataRange().getValues();
    for (var k = 1; k < productRows.length; k++) {
      products.push({
        id: productRows[k][0],
        name: productRows[k][1],
        price: Number(productRows[k][2]),
        lastUpdated: productRows[k][3]
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    invoices: invoices,
    items: items,
    products: products
  })).setMimeType(ContentService.MimeType.JSON);
}

function deleteInvoice(ss, invoiceId) {
  if (!invoiceId) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing invoiceId' })).setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var invoiceSheet = ss.getSheetByName('Invoices');
    var itemsSheet = ss.getSheetByName('InvoiceItems');
    
    if (invoiceSheet) {
      var invoiceData = invoiceSheet.getDataRange().getValues();
      for (var i = invoiceData.length - 1; i >= 1; i--) { // Keep header
        if (invoiceData[i][0] === invoiceId) {
          invoiceSheet.deleteRow(i + 1);
          break; // IDs are unique
        }
      }
    }
    
    if (itemsSheet) {
      var itemsData = itemsSheet.getDataRange().getValues();
      for (var j = itemsData.length - 1; j >= 1; j--) {
        if (itemsData[j][0] === invoiceId) {
          itemsSheet.deleteRow(j + 1);
        }
      }
    }
    
    // Delete PDF from Drive
    var fileName = "ใบเสร็จ_" + invoiceId + ".pdf";
    var files = DriveApp.getFilesByName(fileName);
    while (files.hasNext()) {
      var file = files.next();
      file.setTrashed(true);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Invoice deleted successfully' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function manageProduct(ss, subAction, product) {
  try {
    var productsSheet = ss.getSheetByName('Products');
    if (!productsSheet) throw new Error("Products sheet not found");

    var data = productsSheet.getDataRange().getValues();

    if (subAction === 'add') {
      var newId = Utilities.getUuid();
      productsSheet.appendRow([newId, product.name, product.price, new Date()]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Product added' })).setMimeType(ContentService.MimeType.JSON);
    } 
    else if (subAction === 'edit' || subAction === 'delete') {
      if (!product.id) throw new Error("Product ID is required");
      
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === product.id) {
          if (subAction === 'delete') {
            productsSheet.deleteRow(i + 1);
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Product deleted' })).setMimeType(ContentService.MimeType.JSON);
          } else if (subAction === 'edit') {
            productsSheet.getRange(i + 1, 2).setValue(product.name);
            productsSheet.getRange(i + 1, 3).setValue(product.price);
            productsSheet.getRange(i + 1, 4).setValue(new Date());
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Product updated' })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      throw new Error("Product not found");
    }
    else {
      throw new Error("Invalid subAction");
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
