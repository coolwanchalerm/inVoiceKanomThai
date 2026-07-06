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
      headers.push('PDF URL');
    }
    if (headers.indexOf('Customer Address') === -1) {
      invoicesSheet.getRange(1, invoicesSheet.getLastColumn() + 1).setValue('Customer Address').setFontWeight("bold");
    }
    if (headers.indexOf('Customer Tax ID') === -1) {
      invoicesSheet.getRange(1, invoicesSheet.getLastColumn() + 1).setValue('Customer Tax ID').setFontWeight("bold");
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
          <link href="https://fonts.googleapis.com/css?family=Sarabun:300,400,500,600,700&subset=thai" rel="stylesheet">
          <style>
            @page { size: A5; margin: 10mm; }
            * { font-family: 'Sarabun', 'TH SarabunPSK', 'TH Sarabun New', Tahoma, sans-serif !important; }
            body { padding: 0; margin: 0; color: #000; font-size: 14px; }
            .invoice-card { max-width: 800px; margin: 0 auto; }
            
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .header-table td { border: none; padding: 15px; text-align: center; }
            .store-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
            .store-phone { font-size: 14px; }
            
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .info-left { width: 60%; border: 1px solid #000; border-right: none; padding: 15px; }
            .info-right { width: 40%; border: 1px solid #000; padding: 15px; text-align: center; font-weight: bold; vertical-align: middle; }
            .info-label { font-size: 14px; margin-bottom: 5px; }
            .customer-name { font-size: 16px; font-weight: bold; text-align: center; }
            
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 12px; text-align: center; }
            .items-table td { font-size: 12px; }
            .items-table th { font-weight: bold; font-size: 14px; }
            .sub-th { font-weight: normal; font-size: 12px; }
            
            .col-qty { width: 15%; }
            .col-desc { width: 45%; text-align: left !important; }
            .col-price { width: 20%; text-align: right !important; }
            .col-amount { width: 20%; text-align: right !important; }
            
            .total-label { font-weight: bold; text-align: right !important; padding-right: 20px; }
            .total-val { font-weight: bold; text-align: right !important; }
            .empty-row { height: 40px; }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <table class="header-table">
              <tr>
                <td>
                  <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                    <img id="pdf-logo" src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAfQB9AMBIgACEQEDEQH/xADUAAEAAQQDAQEAAAAAAAAAAAAACAUGBwkBAgQDCgEAAgMBAQAAAAAAAAAAAAAAAAQCAwUBBhAAAQIFAgMEBAYMBgsKDQMFAQIDAAQFBhEHIRIxQQgTUWEUInGBCRUjMpGhFhkkM0JHUoWmscTkQ1diZ3LBFyU0RFNzgqKywtEYNVRjdZKUs8PhNjdFVVaDk5ajtMXT8CdGhGRldIbSEQABAwIEAgkDBAICAwEBAAABAAIDESEEEjFBUWETInGBkaGx0fAFMsEUI0LhM/E0UhUkQ2JT/9oADAMBAAIRAxEAPwDanCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCOI+a3MbwIX1hGN7l19sW1eMTVwS8w+j+95H5dWfAlIIB9pEYkuPtrMo40UG3HHD0eqDwR/8ADTnP/PELSYmFn3OHddVukYzUqUEIgrWO1DqJcyu5lJ5mR73YMU6VHF9KgpWfYYp7Vi6r6gqy9J12ebVuPjJ5aEe7viBj2bQk7HsNo2k/O9LnEitA0lTXq2olr0IqFRuKmSTg5odm2wv6M5+qLSqPaU06pgINwpmFDkiXl3V59hCcfXEdqV2Pr3nwkzTtNpqeqX5grI9gQhQP0xd9N7E7nqmfupCfFLElxA+xSl/1QfqMXJ9kYHb/ALCl0k5+xtO34FfM12wrGls92zVpn+hKpH+ksRRpntp24nPo9Aqzn+M4EfqKo7ynYstZsZmK5V3j17otI/WgxUJbsp6dMOtsLfnph9X4Ds6kLPXYJSkn3RwnHbkD53rhEx4K319tim/wdrTi/wClNoH9Rj5/7t2S62lM/wDTUn/Ui5aV2etKqxP1SSlJSamZqnOBmaR6U+nu1KSFAZJAOQc7ZHvis/7lLTgf+Rn/APpr3/8A1AG406EfO5GSb/sPncrKZ7bFFXjvbbqDf9F5Cv8AZFTle2baDgHf0uss+YabWP8ArAfqisvdkrT1zJTJzzP9GcUf15ilTfY5sl7PdT9alyeXA+2QPpbP64llxrf5D53BGXEDcFVeR7WWn07jvZ6ckv8AHyTh/wBAKi6afrlYNU4QzdlNSo8vSHu4z/z+GMO1DsXUdx0tSV1zTD3zw0/Lod2zzwCk4yOcW7VexXcLGfi+vU+cA6TCFs5+gLiHS40asB7P9/hcLpx9zQfnapY06qydXb76RnWJxn/CS7yXE/SCRHuiCNQ7NGpNuK7+XpZmuDcPU+cRxD2AkL+gR4E39qzpwoGYn67IBOOFNTaWtv2DvgRg+UH64t/yxEfOdF04gt+5hU/YRDe3e2VdEjwN1alyFUQNiWeKXWfafWB9yBGVrY7XdmVkobqKZ2hPHmZlrvG8/wBJGT7yAIZjxkMh6pp22/pSZiWO3p2rOkcxQaDdtGuuXL9FqkpU2wAVCXfSop9oByD5HEV6HbHQpoGqQhCJIqkIQgRVIQhAiqQhCBFUhCECKpCEIEVSEIQIqkIQgRVIQhAiqRweUcxweUCKrVZ8OZ+JP89/sEarRyjal8OZ+JP89/sEaqzzgRVfqohCEC4kIQgQkIQgQkIQgQkIQgQkIQgQkIQgQkIQgQkdMx3jF+o2vtqac94w/N/GNUR/eElha8+CzyR7Cc43AMVvkbGKuKi5waKlZNizLy1atWwwfjqry7L/AElWj3j/AJeonJGehOB5xE29+0zet+u+hUlSqJKv5Q3LSGVTDngC4BxE/wBEAHwMfax+ypd92q9MrJ+x+TcPEpc1lcwrJ3w3kEHnnjIPkYzXY10hDYGmvE6fO2iU/UOLqRivNXbenbMnXu8ZtilolEnYTlR9dZHiG07A+0keUYvXNan63PqHHVa5Lk/MQO7lUnPXHC2n34O0Sosjsz2TZ4bdXT/jmeTv6RUcLwf5KBhIGeWQSPGMrMyyJdtKG0BtCRgJSMADwwIrGFlmNZn05D5T1R0L3msj7cAohWp2Na3O8Ltdq8tSmjuWZZJfc9mSQkHzBIjL9tdlewrdCVzEnMVl5O5VPOlSSevqI4QR5EGMoVqv06g09+dqM61JSrQ+UddUEBPlk9TyAG5Ow3igWzqpbN4VNUhTaoXJ1KO8Eu8w6wpSfykhxKeIezOIbjw2HicG0FeZqfA+ysEcTSBQV5rppwZV6jvqlLT+xJtuYWwmXclEsqcSnB48JAyDnY75wTF6YxuYs+nXg+/qVV7WeYQwJeSZnpV1OcutKJQ4SDsMLAAx74tSUl5/VK6Lk9Kq9Qp9Ao058WsyFNmDLl51KUqccccThZGVgJAIGBnc5zeHBrWtbc3HDT0V+YNAAWW4p9Sp7dXp78k/3vdPtlla2nFNrAUMEpUDkHzByItqzrSqdoVSfZNaeqtBcShUu1PuF2YlXMkKSHDupBGMAkkEYHUm9wNotq42cKKR5qOuumkVs2tpxUKxKy845NSrzPE7Mz8w9lCnkJWCFLI3Cscs+EZVoektnW1PMT1Mt2SlZ1nJbfCMrQSCCQVEkbExTe0FLCZ0bulsDP3Nx/8ANWlf9UXrQpj02jSE1z76Xbd+lIMKtjb0jrDQHTmf6VTWtDtBoPysRWveUlbmo2orC2Zyo1B+oMKbkKfLl51SUy6AVEDAABIBUSBkgZzF82jqRTruqk1TPRahSKtLth1ynVSW7l7uycBY3IUM7ZBODz5iKHpigI1G1OXw4WqoS2/l6OCBn3x3rPyXaCt5fIuUOab9o71sgfSMxwOc1oNbVIp2khDQbOB3PqVXbn1MotrVJumvelTtUU33yZCnSrky8G844iEA8IJ2GSM9I9dqX5Rb2TMikzSlvSxAflphpbL7JPLibWAoA4ODjBwcHaLPp9ZfnbzuictG3GJt9L6JOpVWoz62W3XmUBPdtoCFnCQcEgAE+J3im2q9WJ3tBVJyryMrS327cQhTMpMF9tzMwSlZUW0HOARgg4A574E2yGoFa1NNDz30XRIS4U0JpofVX4igW9NX4aununLokpT0dX3QVONMKJIBbzgAkkgkZOTvF19Ixbpx93aq6mVDm36VJySPLumPWA96sxlJR2hhjg5pcBTXyNPwusNQTzKDlFq3hdyLXnLfk1SZnHaxPpkUoC+EISUqUtw5ByABuNs55xZtFn7r1Tdna1Trh+xq3UvOS9PalZNp9yaCFcKnlqcBABIUAkAbcztk0uQVXq7rhQqVcPo7kxbdOmZ4TMrkImQ9wtIWUEnhWBxApJIBBIOCIofLmAFDcgA2vf2qbhBfUincfnJXvcWi1k3YFrn7aki8rm/LI7hwnzU2QT7zGKLn7GFHmuNdCrc1Tlcw1NoD7Y8hjhI9pJMZcuPVi17VrHxbP1Qpn0JDjsvLy7kwppOMguBtCuAYIO+Dgg8ouCh3DTrkprc/S55mfk3Pmuy6woHxB8COoO46xCWKB5LCAezXyuuOjjk1APqoT3B2ctQrJdVNyEsueQ0ciZozxU4PAhAw5n2A+3x7212ltQbImPRahMfGrbR+Ulaq0e8T4+uMKz7SceETpi3bqsC3r2ly1XKPL1EEYCnUYWPYoYI9xhT9CWOrA8tPDZLnDEf43ELF1k9rO0bm7tirl63ZxWB8v67JJ8FpGR7SAB4xmen1OUqUsiZkppqclnBlD0usLQoeIIJB90RvvnsaSkz3j9rVRUqvmJKfHE37A4kZA9oJ84w1MU/UbQSpl9KahRUZ++tKDkq+emcZbUcdCMjwBjpxU+HtO2vMfKeiOlljtIKjiFsDjmIvaedsKVnCzKXdICSXsn4xkAVI/wAtvdQ8yCd+QESJodyU256e1O0mfYqEm5815hwKHsyORHUHcdRD8eIjlFYzVMse14q0qsQjiOYYU0hCECEhCECEhCECEhCECEhCECEhCECEjg8o5jg8oELVX8Oby0T/AD3+wRqsjan8Oby0T/Pf7BGqyBC/VRCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCOI8U3PMUyVXNTT7UrKtJKnHXVBCEAcyScAAecCF7osbUHVq2tNJXjrE790q+9yTGFvuexOdh5kgeeYwbqz2tyovUqyRgbpXWZhO/wD6pBH+coewcjGONPtCLu1fnVVWffdlKc8rvHKnUMrW+fFtJOVnzJA89sRlS40l3RwNzHjsEk/EXpEKnyXr1D7Sl2akTC6bREu0iQePdolZFRW+/nkC4MHJ8AAN8HPOKxp12SK7X1NTlzzKqFILPEZVBC5pY8wchGfPJ8REjtOtHrb0xk0fFckhydxh2oTGFPubYPrfgjyAA8cneLtqtckaFIPztRnGZGVl/WcdmHOBCEk4GSfE7DxOwjjcCX/uYl2Y8NggQVdnmufJUGxNLrb0+kw3Q6a3KukALmljjfc8crO+D4DA8AIvGLBv+9pikUSjmhCXmp6uzbUlITD5JYQHAVd6rGCQEgkAHJOItG/7Guum2wxWmrtqFdq1CeFUEs9KsNNvFAIWlAbQlSQUFQ4Sog8sZ3Dwc2JoaxvhSnyl7K8uDaho04K+70vVdtTdNp1PprlYr1TUsSkk24G0cKACtbjhBCEAHngkk4AO+KFK31ctvXNR6ddtNprElWHVMSk9S3nFobmMEpbcCwCSoZAI6jl4ee9rlpi7coN80qWbnKk8G5OlvurUltr0pSUkugEAhOMkHcEEAgnMUPVmwW5SxpqpVCu1KtXO240umOqXjE2FjgQxLowkEkY3BIGSTsTFDnO6zmmtKHalPDU3/pRc7W+l+VP7uvVVqBKyvaHkXKihTsjWZBUzKsqV8n6fL4SV8B2JDJ2PMEkjfBFU1vZFFZt28EDgdt6pNOPuD5xlXT3TyfYQoHw2ilTtXVqzQbXuG3pZxdbo1RlpmYllpLPCFDhmGQtYCTgE5wTyHUgHJtz0KWuy3qjR5oYlp5hbCyBuApJGR5jmPOCnSNIG9weevkQutGetN7j52qx78WKBqzYVwJOGJ4zFFmFjkrvE8bA960mPH8ZnSjUO4Jipy019i9fcROtTzDK3kS0ylAQ4hwIBI48Ag4x08cX79h9NmKRRZCeQqoN0pbDkuuYV64daGEOEjAKhzO2M9IuLkMDlFvRGucGhrUdtKEHkp5L1518qLGlFvWqXzeUk5QGJqVtKSbdVNz87K90iecUAG0NBYC8JOSVDAJGD0zkwfNjrCLr7lTodyqFe1B+yi0KxSA73Kp2UdYS4dwhSkkBRHXBwY+9sUlygW5S6c6737snKNS63QPVWpKAkkDO2SM4irQgy9bMjKrYtuzvscuG5aqiZ701mYbf7rh2a4GwjAOTnOM8hHE5aCJq+pC5PSeBcnJuyno3djCwtQPFnOQRjGOsXRyhHcoy5ab186oosZsadXJbNZqz1r3BKylMqc2udekp+RL/dPLx3i0KStJ3IyEnYR0oWndfoOpDlfVWG6xLz8mhiedngpDyFIKiO4QkcAQSQME5AycknJyfCImNtjexrr+FECisjTS0p21/sodqIaL9UrkzUG+6UVYaXwhAJIG4CeXSLvm0LmZZ9ttfduKbKUr/JJBAPuMejEdukWtAaKBFFhvRe9qJQbBkbeq9QlaJWKMFys5JT7yWVtqSsniHERkEEKChkb84+en9wS9XuPUy+JYiZp7Zbk5VasjiRLsca8ZAOCpWYypULcpVXmG3p2myk4+z8x19lDikddiQSISdDp0gzOsS0o203OOOPTCEj76tfz1HzPWFOjdRrbUGluVAuZPtpt7UWGNHpy5LUtFurTNq/HjdazVJqpUqbQuaWpz1xxtOBGSAQAEKIHQZJitaVTondQb9mpWQnaZS3vQ3/AEScl1sL9IKFhxQbIGCcDJGcnByY9UjZV82TIikWxWKTN0VJV6MmsMud/JpJJCQpBw4BnbIB5DkIqFcrVU0stOjPzs25Xm25xtur1SYbwWmFlXG6Eo5BJKQBvgc8neKmMMeUuqCLmtOFNRel6qAbprbs+c1bdl3DqBetui66fVKPwPuOd1b7sscIQlRTwKfSvKXPV3yCATk4GwyHZl4S952fJXAyj0NqZbUopdIy2pKilYJ2BAUkjO2RvtGONRPQbCp67+s6oMtzD800X6dKOJXK1cLWlKgEAkBzHrBaN9jkHJMXFrdbs5W7Pkm5KSdqElLVFibqFMlxhc5LJJLjaQCOI5IVw8yRtviOtc5lakmgvvWuhHDQ1C40kX3A8efLeyyJLzbU6wlyXeQ80oZS40oKSfYRtHWalGpxlTMw03MMODC0OJCkq8iMEERiWlW9S35mi3NpkGpZtU+2zVZSVc7phcvuHA4ySAlxGQRgA+RBEXpcuqFrWXONylaq7ctNrTxiXS2t1YT+UUoCikeZwIuDwQSaAca2NeBsph3/AGt6LGmovZMty5i7N2+59j1RPrcCMrl1nzRnKfaDgeBiPU/buoOgNaTMJ9JpaScenyh45R/G4BOCFD+SsA9cRO2i1uQr8i3P02bZnZN7dLrCwsHoRkdQdiOYPOPvUJFiqyjktNy7U3LODC2XkBaFjzByCPaITmwTJOvGaHYjT52KDoGuOZtjxCj1pj2uKXXCzT7saFHnjhIn2wVS6+mVDm3nx3HUkDaJDys4zNyzb0s+l9pwcSHUHiSsdCCNjnxER01T7JEhUe9qFnvCnTJyo02YUVMLO5PAs5KCegOR09URhy0NTL20FriqQ+28iWbVl+kT+eA5/CQfwSeYKCQc5IIiDcTPh+rOKjiPn9qvpXwnLJccVPmOYxxpjrXb2qsqPQHxL1FKflae+cOpI58PRYB6jltkAnEZHjVY9sjczSmmuDhUJCEImpJCEIEJCEIEJCEIEJCEIEJCEIELVX8Od+JP89/sEaq42qfDnfiT/Pf7BGquBC/VRCEIEJCEIEJCEIEJCEIEJCEIEJHEcxhrWntA07TBpdOkuCo3IpP9z/gS4I2U5jr1CAQSNyQCCapJWxNzONFFzg0VKu7UfVCg6X0n02sP5ddymXlGiC8+rwSOgHVRwB45IBh1e2pt56+V9qmSrDqpVaz6NR5LJQP5Th24iBuScAbkADMfK0rKvDtEXTMTb00tSSvM1VZrJbaHPgSBjJA5NjAA54G8TH000soWmFL9FpMvxTC/v867gvvnzPQeCRgDwzknGLpccf8Aq3zPzwCTNcQaaN9VjDSPssU21W2apdRaqtTRhxMrzl5c+ednCPMYHQHAMXVJ3Ld2pYVMWlMytvW0kqQxU5yWL8xNkHBU20SAlvIIBO5xkDoMi3RT3KtbVVkWPv0xKPMt9N1IIG/Tc84tDQery9Y0rt9DfqPSLCZCYaKeFaHmsoUCPHbi8SCCecPsibHSNlgQTbU0pvrur8jYwA2w8/FUiVvy5bBr0lSb8EpOUufc7iSuGQb7tAc6IfbOyCehG3tGSnyV9mbXrvQ5C5HhP21NNvTlHZfbHCmcShALauiuEBS0ZGQV7EkbZGvi1JS+rWqlEnE/IzbSkcZH3tfNCx5pVg+6MY0Omz2r3Z+okyXeG5ZRHfyM0D66ZqXcUhCiT1VwYJPiTBKHijcxO450IqDx1FFw1rlHaO7UK89XbYnq/bDUxSAPjyjzLdTkE42W40fvZ/pJKh4ZIztHhkNeLRnKWH3J8sVFXqLoZbUqeS91ZDQGSc7DbBPXEXja1Unq1bdOn5+Rdp0++wlb0m6MFpfUYyds5xnfGM4ORFqXHdjtoXeXZi05qdp70sCzVaRKGZe7wE8bbiUjiSMYwdwfHmBJ2YHO2wNK1B7jtRTp/LSvJWTplRUvylc0yu6npZl3mk1eRlAs5aYdVlTSCDkFlzbIJ3OQSIyJbWlVHtifany/Ua1PspKGJmsTaplbCTzDfFsnI2JAyRtnGYo9vU6r3nqBK3dP0t2gU6QlHJSRlJvhE1MFwgrccSCeAADAQSTnJOIyfw56RKGNoHWFaaEi9NvDZRaygodtESc7/VHeMc3vrlZth94xUau09Ooz9xSfyz2QcFJA2SfJREYNu/toT8xxN2zRGZRr1gmZqSi4vyPdpICSPMqEEuKhjoHOvwFyrHysYaEqW8W1cWodtWrxir16Qpy0J4lNPPpDmPJGcn3AxAy59Zr1u8qFRuOadac9VTLDgYbI8ChAAPvBMWYBnJJyTzMZr/qgA/bb4+w90k7Gj+IU36v2sdP6SSJeZqFXI5+hyh2/9oUf7Ismo9tllHein2o64j8B2YnAg+WUJQfoB98RUhCTvqOIdoQOwe9VQcXJ2LP8z20LucJ9GpVHaR/xjTqz9PeD9UUGZ7WGosxnhqUpK5/wEk3/AKwUYw9CFnYqY6uPiq3TyO3Kyv8A7p/Uv/0kH/QZb/7cdD2n9Sv/AEkP/QZX/wC3GK4YiH6mTifEqvp5OJ8VldrtR6lDncIX7ZGXx9TYMVeS7YF/SmziKVN/46UI/wBBYjCPKOcxIYuYaOPijpJP+xUkaV216u1wip21JzXj6LMrZ/WFxeFJ7aNtzDYFTo1RkXD/AMHKH0AeJJKD9AMQ9hFjcfOP5V7QFcyeRv8AKq2B292hNP7jCUy1yy0s4r8CdCpcjyy4ACfYTF/SVQlqlKpflX25qXV815lYWhXsI2PujV9FRo1bqVuzAmaTPzNPmOH7/KPKbWc88kEHBhxn1R382g9lvdMjGU+4eC2edI6KSFpIUAUnYg8jEGLX7VN929wIm5pqusJ24J5kBeB4LTwkk+JJjNVp9sO1avwN1yVmrffOQXP7oY8vWSArJ/oYHjGjF9QhlsXUPO3nor24pjtDTtWTpbSu0JKtprMvblOYqDau8S63LJHCocjgDAOd8gZzvmKDMS9fsG7a3V5KlvXJRau63MPsyriRNSriWwglKFEBxJCRgAgg7YwMm+aJXqdccimdpU/L1KVPqh2VcC058CRnBGdwdx1iqpBA3hzowbttvUU/0rw0bWWGrcenaZXr6v56izdBo6qclwSE0EoemlsoUpby0AkIOBwgkkkHMUjTEXBY9KNzVOhi5BcSW6jN1Gl+vPMd4kEIWyfnNpGAA2dhnY84zhOSTNSl35SZR3ku+gtOoXyWlQwQR4EEiMaS1oX/AGhICiW1W6VN0RALcq9V2XDNSbfJKAUeq6EjkVAcgDkQsYyxwIraptTUngoOjNQRW1fErx6YVem1vU+8pq3FJVQXpWUdf7tHA2Zs8XEQkgEKKAAoYByNxmKrJa+WhN1iqSL9UZkfQ5oyrb77mEPkAcSgQMAAkgEkA4yD4efUOoz9Go8ja1JdbcvK4iJczzbQbISEgPzSwnlwoG2+QcYJxF5WxZNJta1pagSUm18XNN924062kh/IwpTgxglXM5G/1RNgk+1pFqk2tU3ApXnU3QBQ0B0179lU52ryVNkVTk1OMSslhJM066EtgE4TlRIGCSADnfMUS/dObf1IpXoVck0TAH3p9HqvNHxQvmPZuD1BjDlxUurXdes1KW425XbMtuYY9KobryGWHZlpPD3DB4MYbASS2o4Kgc7kGM/UuofG9Mlpz0aYk+9bC+4mm+7eRkfNWnOxHURY13SZmubbTkePKiAQ/UWUJdTNB7m0fqCa1S3picpjKu8aqcoChyWwf4QDdGPygcHxBOIyno12qmakpij3kpEvNH1G6qMJQs8gHUjZJP5Q28QMZMkHWkuoU24kLSoYKFDIUORznbcdIjLrX2WETAfrdmNIZc3W/SEj1V9SWSdgf5J2PTGwOc+CXDOz4c1G4Sr4TF1ou8KULDoebCkkKBGQR1EfSIO6O9oeraYziKLXUzE9QG3C2plYPfSR5ernfAPNs4x0wcgzKodep1x0pio0ubbnZJ9PE060cj2HqCORBwQdjvD+HxDcRcajUJmOQSDmqxCOI5htXJCEIEJCEIEJCEIEJCEIELVX8Od+JP8APf7BGquNqnw534k/z3+wRqrgQv1UQhCBCQhCBCQhCBCQhCBCQhEae0P2iPiHv7Xtd/8Atj97nJ9H9752LbZH4fQkcuQ3yU0yytibmcqpJBGKlerXztIJtNT9u20+HqyrKJmeBCkSY/JHQuDrzA65OwxLoxoNVdVql8dVt1+XoPeFbsy4SX51eckIJySM5ys9dhk5xVez/wBnl2+HWbiuVC0UMHjZl3Mhc6c8z1DeevM9Nt4mLLy7UrLNsMNJaZbSEobQOFKABgAAbAAbYEZkUT8Y4SS2bslWxundV+mwXjodBkLbpbFNpco3JycuOFtpsbAePmTzJOSTuTmKvHVKcR3jYytFhotBrAwUXSMS1+0bgsO75+6bPlBVpSp+vVqE46GytY/hmCdgsjOQee+xJGMtQjhja+5FxoeC44VWJJ67b0vuXNLo1qTtrJey2/WK0UpMuk7KLbaSSteM4OQAee28X/adtStpW5T6NIj7nkmg0gkAFWOajgAZJOTgYyTFchFYjvVxqotFF26R5X3ES7S3HFpbbQniUteAlIAySSeQHMkxinVDtH21p53kiwv46ric/cUurCGiDghxeCEkb7AE5GCBnMRI1B1junUh1xFTqBbklHaQlSW5dB805JUfArJI6EDaEp8bHD1dTwH5KoknaDRSe1C7V1sWoXZShj7Ip9OU5ZPdyyD5uEHPj6oII6iI33zr5eN/qW3OVL0ORV/eMjltrG2eLBKl5xyWSM8gIx3CMCfGzTauoOAt/tZUmJkfY2HJdlrK1FSjkmOsIQoqkhCERJXCkIQji4kIQgQkIQgXEhCEC6kIQgQkIQgQkIQgXFUaHX6nbU8icpM7MU+b/wANLOFtZ8iQRkHqDsYz1YPbDq1LLcvdcj8asDYzspwtvAZ3yjZCj0AHD5kxHSEXxTSQmrDT08FayR7PtK2OWVqVbmo0r39DqTU0tIyuXJ4HmuWeJBwQATjOCCeRMXclBEavafUpqjzbU3IzL8pONHKH5dwoWjzBBBB9hiQumna6qFIDUheEuupyYwn0+XAD6B040DAUOW4wcZJ4jG9B9QZJRsooeO39LSixQdaSx8lK1ylSSqw3UvRGjUG2iwJnux3ndkhRRxYzw5GcZxmLV1kuSdtPTat1GnlTc422lDTmCe5C1pQXMAE+qFFXLbG+0XDbV1Uq76U1U6RUGKjJLOA6yrPCcAkKBwUkAjIIBGdxFRmpVqclnGX0JdZcSUrSscSVpPNJB2IPIg8413Ue0hhpUajmnybUaVQ7Ften2Za1PpNL+Uk22goPghRmFn1lOE8sqJznON8DYCLnHKKRQaHI23TWadTJZMpJN8RbZbJwjKiTjJ5ZJwOQGw2wIrESjFG5SFFoouI5hCJKSwxrb2fqbqXLuVGQDVPuJCfUmMcKJjH4LmOvQKAyORyMARrsDUq5tALqmadOyzole8AnaS9sOnrtnkDjkoZBGM5GMT7jGWsOjFJ1YoikupTLVhlJMpOgesnrwL6lBPMcwdxvnOZiMIXHpIbOHmlXwu+5lirqs28qbflCl6tSHw9LOnxwtB6pUOih1HvGQQTcEQAty6Lr7ON9PysyyWgkhM3T3Se4mW8nCkqxjlkpUM45EYyDNux74pd/W6xWKU+HZd0cKkfhMLHNCx0Iz7CMEEggmzC4kTDK6zhqFZDMX2NiNQrnhHAjmH1ckIQgQkIQgQkIQgQtVfw534k/z3+wRqrjap8Od+JP89/sEaq4EL9VEIQgQkIQgQkIQgQkI4jDHaB1qRphRfi+nFLlyTqT3PI+jo5d6oePMJB2JBJyAQa3vDGlzjQBRc4NFSrc7RmvptBt+2LcmAK06kibmWzkyqT+CPBZBznoN+ZBGOOz32f3L2m2rjuNoihoVxsy7nOdUOp68APM9TtyzFJ0G0XnNVridrtbLvxGy73sw87xFU66TkoBJyQScqOc74G5yJtsMNScu21LtpaZbSEttIGAgDYADkABtgRkwxuxb+mlb1RoEpGx0xzv02C7MsplkoQ22ltpAAShIwEjkAANsAdI9UcAZ3PuEdo2wE+kIQjiiukIRjbVnW6i6VSY78+nVh1J9HpzSgFnwUs4PAnzO53wDg4g+RrBmcaAKLnBoqVd103VSrOor1TrM81ISTW3er3yeiUgZKlHoACT4REPVjtQ1q8u+p9vd7RKKrKS7xYmpgZ6kfMBH4IOeYJIOBjC/dQq5qNW11KsThdXuGpdGzLKT+ChOSAOWSck4ySTvFtR53E490vVZZvmsqXEF3VFh5r6LWSokniWdyTHzhCMRJpCEIFFIQhAhIQhAhIQhAhIQhAhIQhAhIktojpzpfflkIlZp/v7omOLvkuzXdvtLycFpGcEAYOcEEnB8BGnnHjq9IlquwG5glKgcocScKRjqDF0cvQ1OUG2h97q2N4YauFQpPV3sV1luaWuj3BIzDH4AnW1tqA6Z4QsEjxGM+AinS/Y0ucY9OrdHlWUZ4ltF1e3MkgoSNh5xhXSKxL5vG96bQaTfldk6e85xTbjE68ktMJ3XsF4zjYZGCSBGRu25q5N0yZpOlttT8wzLSrTfxgpuZWp9w4HdtOOEkkYwo5JJJBPLe4TRdC6eSItoQAK1qTsPynwyKQVaPVY4uqkytv1+dp0jVGazKyrvdJn2B6ruwycZOwIIyCQcZBIwYpMW/bVvKo6VPvvGYnF47xW+AOe2eZz1MXBCLXF4zEU5Vqs11A4gFIQhElBIQhAupCEIEK4LPvetWHVUT9EnjKOj75g5Q4nwWg5ChvtkZB3GDgxL/SHtKUjUNLNNqhbo9eOAEZ+RmVHb5NR65/BO+4wTviEEIew+Klgs01HDb+kxHiHx6XC2m5x7YZiHeiXajmbd9Hol4vOzlO2QxU1ZU9Ljlh3mVoHPO6hv84YAltT52XqUo1Myr6JiWdSFtvNKCkuA8iCMgg+Ij1EE7MRdpvuNwteKVsgq1e+EcRzDSuSOI5hAhY61e0hpmrFCXKP8MtVGATJz4HrNk/gnqUHqPeNxEQ7Nu25+znf8zKTcutKUrCZ6QX97fRnZSTyzg5SoeODsSI2ARirXTRqV1Tt5RYQhm4JNJMnM4xxjmWl/wAg/Udx1BzsXhi/96Kzx5pWeIv67LOCvq1rpp950OUrFKfExJTKOJB5FJ5FJHQg7EdDFciB+jGq9U0Tu+ZpVWZdbpbj3dz8gseuw5nHeIHiOoGxG3RJE4qfPy9VkWZqWdRMSr6AtpxB4gtJ3BB6giJ4XEjEMvqNQpxSiQX1Gq90IQh5XpCEIEJCEIELVX8Od+JP89/sEaq42qfDnfiT/Pf7BGquBC/VRCEIEJCEIEJCEeGoT7FLlX5qacSzLMNlxx1eyUJAyST0AAgQrY1T1KkNLbWfqs6Q69u3KyoOFPu9B5AcyegB5nAMNLGtGudoPUeamp6ZWptxQeqE8B96bzgJQDkAkeqgcgBnkDH21NvWq696jy0pTWXHWC6ZOmyhOMJJ3cPQE44iTyAAJwMxMHTDTaS0wtSVpMolLj+y5uZAwX3jzV44HIDoMdcmMY/+5Lb7G+Z+eSzzWd//AOR5q4aBQ5K3aTK02nSyZSSlkBptpOwAHXzJ5kncnJO8VUJ8o5SNo7Rr2FgtEUFgkIQiS4kIRHztDdoX7DA/b1vPBdeUMPTAwUyaSOQ6FwjcA7AbnfAiiaURNzvKre8MFSvbrt2iJXT2XdolEUmcuVwYUT67cmD1UORXjcJ5DmdsBUM6rVJyuVB6eqEw5NTbyi46+6orWsnrk/V4DYR8Zh92bfcmJhxTr7iipbizlSzzOSdySdyTzj5ZjyGIxL8Qamw2HD+1jSyOlPLguIQhCqXSEIQISPVN0uakAgzUrMSve+s33rZRxjxGQMjzEfe3Kyu3K9T6ohhqaXJvIe7qY3QspIIB5bbe6JiWLrnYGv6Zi1qpJNytWO6qPVEgh/b57Dm3HgdRhQwTjAzDMMTJLOeA7QA796YhiEpoXUUKoRJW8+yQ1Rqy9Py9xS9LtVttT78xO5L0sAfmgDAWDnYkg9CCcZxfqBeOktl0F+k2/T3qxU1/J/HNScUjG43baTgnlsSBjrkc+y4V0DS6RwbTidez5RD4XttSn57FjqEZL7NmnEpq1dSVznF8RyTQmX0bguknCEEjBAJyTjcgEAjIIt7WipW41rDcFDt1huVl6eruO6YzwBSAkOEkk78eQfPzzFGUiISlwAJoOfYuCFxbmVqx6pSlzU/365WVmJpEukuPd02VpQBkkkgHA2O52jyxK55lGhvZEq1Ucb4KpPyfeOdFl2ZIbbHiClLicjoQTE448+ZxNA0Ek9iI4jJWmyijHolZV6fd7hht195X8E0CtfuABJikUGfXU6WxNuI4FuZPXkCQDv44iXfYsoDPoNyVpSfl1ONyTazzQkAqWAfMlP0CO4eMYlwa11Ab15Uqoxxl78hsoqqQW1KQoEKScEHy6ER15xzVLs+y29btmm0FDIqb6knosKcWQeQxt+uOIXa5r25mnj5Gig5pa4tKQiVOstNpemfZIA9BbMwWZHJDYC3HluNlairnndQycnG3KIpybvpknLvtjHetpcx4cQBHv3i6djYJAxxqSAeytfZWSROjpXdSr7LFIlbI0+ue/qsA00hlZDpG4l2UlbhB8yMEeLcQspVWm78vqu3XUyVzM2+48d8gOLJykZ6JBwB0GPCJj9p2oq0g7JNPtlsBucqIl6cvhON1ZefOPAlCkn/GREmzZH0GgyYVstae8V7Vbj6BgRHHHPNFhhowZj2nTw1CflPRQho1Pwq4JSTen5lDDDbr76/mtNZWvPgAASfdHRxCpZ1bK0qaW2SFJUMEEbYIO4IOxBiU/ZAtWUpFtVm75xIQ7xql233OSGUJC3FDyJOCf5PtzFm3a9V9b79rLklS1uTU/OrcZaa+f66lLOSdgANydgBz2i18TWBlXXfWg5BJ/pyGBw3XzhEkZbSzTTR8SKdRqwJ6tTXD9xMuKDLAOMKVwYXgH8IkA9AcGPL2q9KLY07oVHrdIZTSPSp4SK2A4e7WVIWpJGSeEjuyDjAOR152vwr4w4mlqVFbivFdMDw0mottuo8Qi6dNLDmtRrtkqJK+p3uVPP8APumhuteOpA2A6kgbZzGcb91C0l7MdYYt5y1hW6ghCXX5hTbT0wOIbZK+pABwOEbjG+YqbEHMMkjg1otU8eAUI4ukFSaKMsIyPrN2h9Ib1oMr9j9uzUhXnHApcx6E2wGkbhQc4FkLJ2xgHHPI5HH1PlxUpiUbaOUvrQgH+kQB+uKM0ZeWxuDuY5qMkZjNCrhn9OLkpNpy9zzVMcl6LMY7mYdWgFfECQQjPHggZBIwRgg7jNsRKHt51xVoaPW9TKWoSpeqjbSUjB4WW2XNgCCNj3cRba+9I4/n7fTjeLcQGRSmJpJIAJ7Sr54RFlpuu8ZR0V11qelc+mWmA5ULccV8tJ59Zvf57eTgEcyDgHkcHBGLzHEQje+J2dhoUs0mM1atmFtXPTrto8tVKROInZKYHybqPrSRzBB2IOCDsYrsa9NHtYappVWQ7LlUzRn1ATckT6q+nEnolYHI9eRyOU7rVuqm3nRZSsUqYTNScwnKVg7g9UkdCDsQeRj12ExbcS2mjhqPyOS2YZhIKHVV6EcRzD6ZSEIQIWAO0vogL2pq7lorIFekmj3zSBvONAcvNaRy6kbbkJxjvsva2G35xu0q4/inTC8STxP3h0n5h8EqJ26AnwJImHENO1Joyq1qi5dtGYIpM46PTJdobS75PzwOgWfcDt+EBGPiYnROOKiFxqOI4+6RlYY3dKzvUyo5jCHZr1iTqDbfxRU3Qa9TUhKlE7zLPJLnmRsFee/XAzdGnDI2Vge1Nse14BbuuYQhFqmkIQgQtVfw534k/wA9/sEaq42qfDnfiT/Pf7BGquBC/VRCEIEJCEIELiIq9rbVrAFk0t7c4eqSkH2FDP6lH/JHiIzjq7qJL6Z2NP1hZS5N47qUZJ++PqB4R7Bgk+QPWIkaGadv6wahPVCsFU3Tpd30youOHPfrUTwtk7bqOSfIHkcRlY2V1W4ePV2vIfPJJzucSI26n0WaOytpCLYov2VVNnFVqTX3MhwDMuxz4hnkV8/IYHUiJEAR8kIShKQE4SNgAI+0OwxtiYGDZMhgYAAkIQhhTSEcRjLW7VqV0mtgv+q9V5riRJS/5SuqyPyU5BPicDbORBz2sBc40AUXODGlxVr9ojXZrT2SVRKI6l25ZlO60nIk0EbLPTjI+aDyG52wFQsmZp2amHHnnFOOuKKnFrJJWonJJJ3JJ3JPOPvVqtNV2oTNRn3lTE3MLLjzqzkrUo5J/wC7kOQjxkgmPIYnEOndmdoNBw/tYU0xkNtE5nJ5whCEVSkIQgQkIQgQkZ40j0nolu20nU2/WcU+RUmYpsisDicWCOBzc75IHCnYHGTtzx5pBYitQtQ6VSFJPohV3s0R/gk7rHkSBgHoSIuHt739Nzl1UDTmmEMScswiYeQ1skrcJShOOQCUDI22CiOXNoFsEJxLhWhAA4k6eGqdhZYvO2nv3KQOgGv1L1/p9wyE1LsoqEk4tDsoMqaelXCQkjizxYGUK6EgHACgBEXVfR6n6V6mVikNtqfbJE5JvTHrrLDhPBgnnwnLeeZKSSd4uPsvKNoaoW61KDhQ84qWeOPvnGggk488HywOgi8O3Q+3I6o2I6NnpiQmGHiOfCFgo+sn64umecRgxNOASwgVpxIH5HgmTIJYiRqFlDsbUxFL0/rlXcwgzE73alH8htsEfQXFRBK0Jt+4K5Xq/NKJmZ+YU84TuStaipe/mSInvoYyuS7MVSflvWeXL1BxKevEAtKR7fVEQN06b4aCo8uJ1Z+oD+qFccB+wwaAE95p7okOSBo4091l/RqzDf8AqHR6QUky3ed/NEDk0n1lgnpkeqD4kRmX4RCuJp2k1Do6FcC6hVUqKR1babWTt5LW3Fz9lexWbJtY3LVR6PUK6tLEqlwYWGckoAHPKzlRHgAfGMN/CG1T4x1AsCiA5S0yuYI8A46lJP0NmGsW12G+nOP8n0HcSAPKpVuHZkjJ43WFqSx6DTJRrlwNJHvwM/XE09IZad0g7OderVSYVKTKGpurd296q+FLXqAjmCeAYB338YhwyjLiEhHeYIHDz3zyx1zE0e2pUahTuzncXoDSlB9cuw+R/BtKdTxE+RICT5KiGFHQQSzDVrTTwPsl8MyrnOOo/K1/6bNH4smHyN3H1D9W/wBJMXi0yuadbZQPXWoJ95OB9cUS1JL4vt+TQR6xb7xX+USf1HEZM0Zt9dzao25I8GUemIfc8OBs94sH2hJHtMZuEYTGxg1NPNJv60h7Vmr4QSqN0XRCi0ls8KpqqstBI/waGnFE+4hP0xgjQ+2jcF/WjSlN5aMy0pxGNuBsBawfcgxdHwgt0ouDUm07Ql18Yp7BmHkjkFvLTgHzCWgfIK84uDshUj07VFybKcpkZFxxJ/JUopQPeQpUaDz+o+puaNAWjwuVoTdaRo5qk/CG3EaxfVlWkheUSzCpt1I3GXlhCc+YDSiPbGJm0BCQEjCQMADwEV3tNVX7KO1ZXiFcbNNQ1LoPkhlPEPc44YpUlKOT8/KyjHz33UtN/wBJRAH1mFKmTFSycXUHYLeiWxTqyBqldWETVi9jV5iRZdXVKnTEyzDKUkrcdnnAhISBuSA9sBuMeUWZRpSidiLR9L06pmf1Cq7RURjiDajj1B/xaSADv66hnYD1ZJXnVKDp7Y66xWEcFLt5lMy2NtihJQgJHIqPFwgeJGN8GNZl7XvVe0BqHN12rOkSQUQhoH1G0dGwPAD343O5JOl9Re3CSNLDWTKGtHAbk+g7E645GjkPnevXaUhWNc9TKbP1+YemUz9RbHC4d3OJYBJ8ABzOBsMDAG0jPhHK9/auxreaVl6YmnptafAISEJPvLisewxTuyNaYq2qbU0pvEtSZRx4fk8SsNoTjyCiR7Ix32u7j+zTtQPSCF8crRWGpMAbgFKS8ojz4nCk+yM2RhgwDgTV0jgCTqb1J9QoRvJa6Q93cr57L120+0tUkfGj6WGZ+VXJJdXjgQsqQpOSeQJbxnlkjO24yR2heydM6jX2i9KHMMOT6mA1M0+bHB3pRshaF4xnGAQcDYEHpEaqBQp65q1KUmmt+kzcyru2mx1J6knYADJJOwAJiQOo2pj3ZA03l7cp1QVcV1Tg74/GcytxiSQo8I7psnPACCEtggbEnAwDoRGM4d7MQKsaa13B2AG5VOGcXMc06e6w7efZ3r1m0hdYuGhyMtKtvJZ3dbWtajywEk5HPY79cY3hpFSfjjVC15Pu+8Hxiy4r2IUFn6kxjCq37qRqlMqnq7cE080TsZgJCEg8+7bSAEj2AA+MSV7HtsrqWor9WWjLVJlSeM9HXMoT9KO8PuhPC9HPK3omEAka0qeJsqnRnpWtBqK8aqnfCG1v028bCtsHKm2nZxxPiHFpQgn2d0v6TGGUjqece3X28v7JnaZrc2yvvJCkLMgz4FDIKCQeuXCpQPgoR44XdJ0uIlkGhNB2AUVmLPXDeCQhCJrPN0jJGjGsU9pXXwslUxRZlQE3KJO2OXGgHYLA5cgRsehGN4RYyR0Tg5puutcWmoWzeh1uUuSlylTpswmckZtAcaeaPqqSfbuCDsQQCCCCAdoq8Qa7OOty9OqwmjVZ5RtydXgqO/ojpwA4P5J2Ch7xuCFThSsLSFAggjII6x7DDYgTx5hqNQt2CQStr4r6QhCHVckUmvUOUuGkzdNn2Uvyc02pp5tXJSVDHuPUEbg4I3irRxAha/a/S6x2d9WULl1LWqUdD8o+5siZlyTsrHQjKFAciDjoYnDZd3SF82zIVumr45WbbCwkn1m1clIPmk5B8x4RZPaB0sTqTZjnorY+O6eC9Jrxu5t6zXsUAMeYHTMYD7K2p67TupVrVBwpplVdHdBzYMzPIc+XGBg+YT5xisrhJwz+J05H5ZICsD8v8TopqQjjlHMbSfSEIQIWqv4c78Sf57/YI1VxtU+HO/En+e/2CNVcCF+qiEIQISOqo7Ri/X3Uf+x1p/NPsOcFUnMysn/JWobrH9EZIPLOAecQkeI2lxUXODRUqNXaR1Ff1I1ATRqYpUxIUxwyku00c98+o4WoAcyThI57DI5mJR6M6cs6Y2PI0kIAnlD0icdSB67yh6w25hIwkeQB5kxHLsj6bquC637onUd7JUpXCwTvxzKhkHz4Qc+0pMTOjNwTHSE4iTU6dnyyVgBNZXanTsXG20doQjVTiQhCBCoN23PIWXQJ+s1V7uZCTb43FDmroEgHGSSQAM7kxrz1Bv2p6lXROVqpr9dw8LTJOUsNAngQnYbAHJOBkkk7kxk3tQ6ufZpcn2PU1/io1KcPeFJOJiY5E+BCdwPPJBIIxg6PK4/E9K7Iw2HmVj4qXOco0/KQhCMlIpCEIF1IQhAhIQhAhZy7HrrberEz3nz10x5Lft7xtRx54B92YtvtdWJPUvtBN3G/Lr+K6nIILMxuUB5tIbU3noQAFY6g58cWNbFx1Cz65JVamOlqdlXO8bUBnJwRgjqCCQR1BMZpqfbxoqZBcjdNiPvvcPCO7dbdl3zjBUAsDAOeW5GcZPMuukgdhwyd2WhBBoSKjs71pwEOjyE0K8fZWsN6s3sm55pHd0ajJW4uZdOEd9wFIGTjkCVE8gAM8xnDGv2pg1o7Qr05ILLlHpYEnJr6FDaiSvHTicUSDgHBAPKKvqX2va9qXQ1W5bFEFt0lwFAkZIjcZyONYAGOuAAM88xYVr22mgS5cdIenHcFZG4SPAH9Z6n3QhNiI8Q0YeE1aDVxpQEjQBdfSFmQan54KZ3ZCvmSnLWnLSmXfu1l1TzLTmPlWVAcQ8yDkkeBHQHFuyPZUtvSurzVZuO5JdFmMTTj7EktBDziScoZJyScZweEEqA5DO0bHkF9vhP9aTnoQRuCDuCORi05+zqlUJsOzFefmU47vvHypxXD4bn+vHlDb8UWtYDFnLa0NaUrTUbg0G+yhHK0tyv20UsrR12c1n7Utr0mmoMva9DRNusy4wkEhhaAtYG2QSMAbDYDfJNi9t9rve0pbvH97+Im/qdmTn6Yt/s61Sl6V6kUapuHgleJTM5M7lWFIKCo4GcAkHAHIbDMSk1y0Fo+tdXoF2S9xsUtdOadYXOIQl9l9hW4yQsAcJJOc4OSDjYiYjmxeGdmcC4uDiK6CwoK7ADyV4f0kbg3W/oo+9nmxF3zqfTONvjkaeoT01kZASggoSeh4l4GOeMnoYl4xc1p6xyl6Wh36agiRJpdTlycK9dsEqB3OASpIVzCkHHIExk1L1ttfQezZm1dO5kztXfz6XWk4K1kDHyahjOMkBQ2SM4JJJGAdI6jcmn1YdueRn3JCuTIOSoBwFCiCQ4g7KBIBIO4wCCDgiYxrcI8YcND61LqaAUoANiVCNzYG9c9v9dm6v7UHSus6WVw0mqNF6Xzwys+GyETKM4BBGwJGMp5g7bjBOd+z1ZjelVrVvUe7UmmtIlFFhp754Z5leDjdZASkbEjyUIsNXwg1y0Zjuarp/KTU0MBM1Lzy2mVnqQktrIB6DiyOsYT1a1/vXtCPok5hgU6lJO0tLcQYR/KJO5OOpyegABIik4vCYd2eIlzho0gih5k60QIwwl4dUeSoM1c03qtqvcF4T6SFTDynUNHcITjgbRnrwtjGfIGJidiKRy7ds9jpLNJPll0n9QiJtBozVCpzUs0rKk7rWdipR5/7B5RKrsU11lqoXLR1ufLvtszLI8klYX7xxp29sR+lDJKHONXEkk8yCqWSB8odtt4KLtyuGqa6akTitymsTbYJ8PSFgD3BsCL50iZlXtTbZVNzEvJyzc63MrdmnAhADfr4KiQBnhwMnckDrFV1R0Kuiha33eun0WdqdPrs4KhKTMsytxGXVKW4gkAhJSskEEjAweRig6gadVLTeZlJOpzEi7PvNB12VlXStcv4JcwAASNwASMb5xgmuOOSAmR7T9xJr2n52KM4IkzHairfbe18l7+rElYFsP+m0uSeS9OTTCxwTT/ACQhBGykIySTyJO3zQTi2h0dNFpzcqgcRAy4R1V1P9Q8o+MnbUrK1RyoKKnpp3J4nMHgz4AAdNhnO0VWFj0k0xnk1NhyA0CjNN0lFLDsUU0M0S5qgocKnZhmX4v6KSrH+eMxDmfnzcOsF/VpR4u9qcyUE8wFvrIG/LAAHsiUvZI1MpdvN1a36pOsU70pwTUs9MLCELPDhaSo4AOAkjJ33HPEdri7OmnlqXnW7orF7tM0ipTi6kaQlKO9UVErUlCkrJWgknACMgHGdsxrT4Z+IhgLCOqSTUgUrWhum2sJgAHy69PZC06fcqU1eU6kJlkIVKSXFzWo441g+AAKQRzyodDnFnbNs2of7oCTqlQbdfok3ItrlV82wWwAtsdMg4WQeYI6cqTrV2mKpdFwUuhWApVDpVIdQZJqX4UFso2C14yOWRw7gAkHJJi8V9t+pyVLTS75sCRumUyAqbZdDba8ciplbawF+PrAZ5ACF5sRhHxnDvcQGkHNQkEjUGl6KbcrWdHWhOh481ienU2brM8xJyDCpucmFBDbLIK1OK6AAbmJKXJW5fslaATLapho3xWgS21sVIeUnhB2zlDY3zuCrONjti5fbjtyisrXZunNPoFRVlJmChta1DwASEH2ZJHlGELjq1zawXKazc8w+tvOUh04UR4AYAA8MAADkOcUnFwxNIwrs7yKAgEAV3vul2NEXWJvx9uJXj09priJWZn3SVuzKtlq3JAJyST4nMXdBCENNpbbSEISMBI6AbACELRRCJgZwSMjy5xckIQi9VpCEIF1Ilj2UtZPjOVRZdamOOblkf2tecVuttIyWiTvlI3HPbI24RmJ0eiSnZimzsvOSbypecl1hxp1s4W2oEEEHxBGYYw878PIHtNtxxCtikMbswW0XlHMWBo7qXLao2VLVZIQieR8lOso/g3RzIB34SMKHPY4ySDF/A7R7ZrmvaHNK9ALiq5hCESQuIhJ2pNNXLIvJq4aeksU2qLL3E3t3EwN1gY5cWyx55A2ETciy9VLDl9SLJqlDeA7x1srYWfwHRuhXszsfEEiEcXD08RA1Fx2qqePPGVS9DNR0al2DJT7ywamwfR5xI2y4kfOx4KBB8MkgcoyLEFuz1fUzpjqeqkVTilJOoOmQnW3T96eCiG1HoCleUknYAk9InTBhJ+miBOosVCCTOzmLLvCEIeTC1V/DnfiT/Pf7BGquNqnw534k/z3+wRqrgQv1UQhHECFwqINdpa+Hr/1RNIkT6TLUpXoLLKDs48ogLwPErwnzCR4xLDV29E2Fp7WKzxD0plkolwfwnlbIGOuCcnyBiKvZTsY3ZqK5WpxsuSlI+6lLVv3j6shsZ6kEFec80iMrGnpCyAak1PZ8v3JHEFzqMG+qlfpZY7Wntj02iNgKWwjifcA++Oq3Wc9Rk4HkAOkXfDn/shGq1ojaANk40ADsXeEIQKS4jDnaP1TVp7ZSpeTdUiuVPiYlVNkgtJGO8dBHIgHAOQQVAjODGWZmYRKsOOOLCGmwVqWsgJAA3JJ5Ac8mNeWseob2pN/VCqcZMgg+jySTySyknhPtJJWRvgkjkBGdjsR0MVtTYfkpaeXo204qyidzuSTuSeZjiEI8msVIQhEFFIQhAhIQhAhIQhAhI4WhLgwpIUPAjMcwgQuiGW2x6qEp9gjvCECEhCECEi269ZCKy736Jr0Va8d5+GjI2zjIwcRckIg6Nkgo8VUmuc01aVb1FseSpjoedKpx8dXdhtyITk7+0nHSLi5wx/+ct/CHzhkfRHGxtZZgouOc5/3Gq4hHOI4iVCiyR7aPWJ+gVFifpk45JzjCuJt5pXroPL2EEbEEEEbEYMeKES0XQ6iuut9q7Wttv0VE9LOo/4TLSLaFuDzP4J8wBg8jGN5dFfrlVVUa5OKQ5njLCXSouE7kuHJJJO5yTk+HWuwioh8jqyPcQNATUK90xcLi6QhCLUsjrSHWltuI40Kzt0xjBH0RaC9M5RTvyc0422rPqYHI9AdvrBi74RTJDHNTMNFNr3M+0qn0mhyVCbCZdkFf4Tp3Uv2n+obR791HJ5xzCLgGtaGgUAUSS41K4CQnkAPZHMIQLiQhCBCQhCBCQhCBCQhCBCyXoJqavTC+GXn3lJo08QxPJycBJ+a5gZ+YTnkTgqA3MT+Qe8SD84Rq2ia/Zb1L+zGxxRZt3iqlGCWQVH1ly5HyavPGOE45AJJOTG99OxGU9Ee0fkflaeFm/8Ame5Z2jmOI5j0S0khCECFC3tc6eG3bwauaTb4JKrgB8j8CYQAD7OJOD5kExInQu/xqLpzTag6viqEsBKzgzuXUADiPmoEK9pI6R6NbLGGoOndVpSUBU8lsvyfk6jJSP8AK3SfImI1dkW9zQb8et99ZRLVdGEBWwS+gFSDvyyniHmSkdBGL/xcTX+LvX/aQp0M3I+vz1U1oRxHMbSfWqv4c78Sf57/AGCNVcbVPhzvxJ/nv9gjVXAhfqojhRwCY5j5Pqw2fCBCif2zL1MzUqPa8uvLbA9PmAk81qyhse0DiPsUIyz2aLHFm6XU9TrfBOVRRnnsjcBQw2nxwEBJx0JMRYmFOa265qwStmq1LCeeUSyds+0NN56bjpE+pdlDLaENpCG0JCUpSMAAch7ox8K0zzPlOgsPnZ6pKDrvc86aL0wjiOY2E6kIQgQsC9rLUU2pYqKJKO8NRraiyeE7oYTguH35Cd9iCrwiFcZE17vw39qXVJxtfHT5RXokpg7d2gkcQ2HziSsdcEDpGO48djZumlcdhYd3usOeTPIeAskIQhBKpCEIF1IQhAhIQhAhIQhAhIQhAhIQiiz8/Oz9U+JKIjv6orHeK7srDAVyyBzWeg952iQaXaKTRVe2p1mQpDPeTs01Ljokn1j7AMknyAJilIuGq1PHxXSMo/w9QcUwMeIRwFR8gQPbEhdKexpMzBaqd1TDzTznrEvLC5kg7+BQ2PIAY8IkbbGjVo2qEmVosu+8n++JpAdXn2kYB9gEa8OAkeAXCnb7C/iU7Hhs1yPH2UEaDpdf1zLSphM8ri/BkaeFoAPitSDt9EXrSux1eFQ4jMszqErzn02rKxuMEFsLxgjntE7W0NSyAhpAbQOSUJwPoEdycqzGm36a0fc491Am24UbnwsoVs9hSb7od41Rxxfg5cUk+0EAfrimVPsQV+ltE05thKhy+Kp5bHsABwB7MAeORE5oRafp8JFKnxU/07RufFaz7isW99O3imoSsxONJz8lOoDbuPJYASo+AIAPiOceelXDLVlSmkKLEy199lnRwuN58Qd8eBGQY2Xz1OlapLKl5yXammFZy28gKQR1BBBERv1v7I8lcMs5WrOSKfWZfK25forG5Sk8wD+Scg+3BGbN9MIB6M18j7HySz8KT9t1HKEeSkTr09TWHHWzLTeOF5hXNCxstJ8wRiPXGBoaLNLaJ0jlppbrvdto41rx5nPQADcmOzTTkw8lppJW6o4AA354AA6kmJI6bWVS7Gw3OVOm0qrgD4wqk+82ESe2e5YCyAXAD6xOQOXPk1hsO7EuyiwGp4K6KJ0jso0WIafojfNRlRNS1uzqpc9VBKCfcSD9UW7XrWq9tTKmalTZmTdBwBMNFA9xIwfcYmXatNsW4qm86/V7frah8k0k1FE7MunPznHOMnJ6JAwB4xctc0YpM/KONSSjS2yNpcAOyx8iyrKcnxABHQxru+mtIqwkHmE8/B2sVr7hEi787NblN7x5qTXKDn6TTeJ+X8clokuNjpsVeQjBNwW3PW89iYR3jSiQ3NMkLbV5A9COoOCORAjKmw0sFyLcRokXxFlyLKlQhCEzol0hCECEhCECEhCECEhCECEhCECEi9NH78e061BptX4iJRSu4m+ZCmFEcew5kbKA8UiLLhFjHGNwcNrrrXFjg4bLaO04l5pC0K4kqAIIOQfP2R9Iw12X75F5aayso85x1Cj4lHMnct4y0rGNvV9XzLZMZlj3EMglYHt3C9G05mh3Fd4QhFi6kQK10tx/SvWN+dpySyhx5FWk3ByBKuJQ8gHAoAeGInmqI7dsO0fjOz5CvMt8TtLf7p0gbll3AznyWE/Sffm4+LNFmGov7pfEtzNzDa6zhadwy92W3S6vKjDE8wh9I58JIyQfMHIPmIrR5RHzseXj8bWNOUN1fE9SpjLYP+BcyQPcsOZ8MiJB9Ibw0gkia4bjz3Vkbs7QVqs+HN/En+e/2CNVcbVPhzPxJ/nv9gjVXF6sX6qIxxr7dH2JaU1+aSvgefY9EaI58Th4MjzAJPujI8Rb7alz8DFuW+2vdS3J51I8AOBv6cufRCmKkEcLnnhTxVEzsrCVQOxrbPp111evOIy3T2UyzRP5bm5I8wlJB8lRMFKcCMOdla3PiHSeQfcRwv1F1ybUSMHhJ4E+4pQCPbGZY5hGZIW87+P9LsDKRBIQhDiuSMd653v9gemlXqDLnBOuN+iyp4uFXer2CkkdUjK/8mMiREntnXb39XoltNq+Tl0GefSDnK1Eob26EAKPsXCmLkEMLnb6DtKhK/JGSFGdSi4riV9cIQjxq8+kIQiCikIQgQkIQgQkIR3LS+6Q9+ApRRnpkAEj3BQ+mBC6QhCBCQhCBC8dYqAplLmJtW4abLnCOZOMhOemTiJN9jrRaXoNrS90VVsTNXqHyyFODdJPNeD1J2HgAAIi5dMl6fbk/LY+/MlHuxg/VGx3TMsGxrZdlRiWdp0u437C2CD9Y3jb+mRhz3Odt8CewjcxJ4fPdXA7t6nh9OY6chiOfm53yo8zHEeoBWvWqQhCO1QkIQgqhI6uuol2luLXwNpznptjJJPQAR2jFtyVWa1frD1m288tuiMOBuvViX/JB9aUaWNgtQ2WRukEgYJBHEKGdyqfVqDccw4x3clVJx2q03nvKqXwIJHQkp4j/Sx7fgecSw7Uun8pTbVoE9ISzct6O6mkq7oYHdulsNpHgA42gAeZ8YsjS7RHhmZeYqsl8Z1d1KX2aMpRDcuk7h2ZUOQI3DY3PkDkeYxODc+akYtr2LJnw73S9TfyXg0Q0znFvytaeYIn5klukMKGeDGzkyQfwEA7Z2KiBy3Gdbb0E04olcdkJa1JarT2C9PVKfJec7xZznKsklRySMjAweoi4aRTjRn35OmlFUuZ5IRNzxbHcSSRySANgE52bG5O5573MGZKxqE46orc4TxOr5uTDyj9alE4HQeQEakEYw7SwaC5PFacMIibQKx7y0j05EqiVesulz07MfJy8qzLpQtZ6nKQCkDmVdPM4BoiNKLz0vlW5zT+4FzSW0hUxa1aeW/JrwMlLDiiVtHnjcjlkRlC3KQ9LqXVakAarNDfqJdvmGkeAHU9TkmPbR6yK8ZpxhH3G04W2Zjo7jZSkjwByAeuMjYw2zrVJtXQe6vKs3Tm95HVCZeqHHOU+rUwmWnbdmQEuU98j1isfh5G6Vbgg7czFG1s0Slr2tyozdJl2pSuIQp1LYA4JkpGQhQGwJ6KG4J3yCRFM1fQxaFx0LVWiL2lZtukV3udm5mTccDXGroS04UkK32KhnEV/V/Xu2dNbXqrhq8m/WGmT3NPafSt/iUNiUAkgbgjIGdgOcD2tDDm0Ovz0VLw3Kc2igU073rSF/lR3jx0YOJpkuH/AL4ocTntJJI92Y9keGkGUkBecOtEhCERQkIQgQkIQgQkIQgQkIQgQkIQgQsx9li9fsV1LakHnOCRrKDKOZJwHRlTasdSVZSP8YYnRGr6mT7tLn5WclVlEzLupebWNuBSSCCPMEAxsntOvtXTbtMrDHqNTss2+lGQrh4kglJI6gnB8xHpfpctWFh2uOw/36rZwj8zMp2VdhCEbacXEW5fNuJu+zqvRnACqclltJz0Xg8J9ygD7ouSERcMwohQW7LVyLtXVxmnzJLKJ9p2SdSrYcY9dGR45b4R7YnRnAiA+sdMc0312n5qVBT3c63VJbPUqIc+gLyPdE66bUWqpT5ablyFsTDSXUHxSQCIx/p5Ia6I/wAT89EphzTMw7FaufhzvxJ/nv8AYI1VjnG1P4c3lon0/wB+/wBgjVYOcbSbX6plRBTtPVg3PrROSrPr+iIZkWQPyscRA8+NwiJ2RACw2TqF2hZKZPyrc1WHJ0p/kJWp7HswnHsjG+oHM1sfE/PVJ4qvVaNyp0WxRW7ct+nUpofJyUu3LgDqEpCc/VFYjqlPD5nxjtG0AAKDZOtsEhCEcXEjXJrLc5u3VC4aoFJU0uaUyypvq02A2gj2hOfaYnnqFcP2KWPXKul1LTspJuutFfLjCTwD3nA98a2STxFXOPP/AFV9Q1nf+B+Vn4t1AB3pCEI8+slIQhAhIQhAupCEfeRkJqqTSJaSlnZp9fzWmElayfAAAk/REgKoXwjN11aSv03s627Xe4+6kTbk5MfyWX+FCFHywho+XEYqGlfZpn3Vm4b3bFKoUm36UqSc+/PhIJIWM+onAOc4JG2BnIlvNyFPrVFXJONtTdMmmO6LfNC21JxgY6EHbHujXwuDD2uEliRYb6607Qn4MOXNcXDUWWsqEZt1T7MNftCYmZ2goVWaESVpKMB9hPPCwSM4G2RkHmQOUYUWhTaylYKVA4IPMHwjLkifEaPCTex0Zo5dYQhFSgkSx7IWosncmmzdtKmCqqWuU01bSjhamEoHduAHmCOJGRkAtkcxETov3sp0ml3JX7jlK0/8VystMvPS9Wl5gyz8u5xIRwBwEZCiokpOQcAkZAjY+mShkhDt7J/CuvRTp5wixW9E6rsuS1Nufg6NOLl3UY6HJb4yT5rx5R2OkN4p+96o1hX8t2RkyseQ4WUgj+mFHxJj1daLVV8Qixv7D96fxq1dH/Gopsl3n0KaLf0IEdf7DFWe/u/VC4x4+jmXZUR1zlsgeeAPLEcXVfC3UNJKlrSkDmVnA95MWRWdbbPo8+aaxWGa7Wf/ADTR3ETM15ZbSSUgnbJIEUGfsXSWkPAXNeJq02D6qKrca8qPkyhxKVHy4T7Iu6i37Z1ClRJ2vRam+wncJpFCmS0ojr3hbDZPmVZigzxixcPEIVCbtW9dVgBXkmyrXXzp0tNldQm0f8a4kAMg8ilBJI5kcoyjbVrUu06VK0ykU5imU+WTwtS8ukISgeQAA35k8ydzvFvfZ7cU9tT7CquD/C1GZlpZJ88Bxah70g+UXnJqfclmVTDKJd9SQXEIXxhJxuArAzj2D2RMSNd9tfAj1CFa2qrUq/Zc4ZqX9I7mYlX2Wei5hEw2tkHyLgQD5ZjwS9MctamytFpy81+qrLk3PEAqTsC48rzBISkcgSMDAIi2NRrluq6a3TKZYVHka5K0+bExP1GoTRRKIcQCEsgJBLhBIWQCACAM5BAItXWSoTPpr90WrSnynhU3J0lxwpTkkJ41uEkZJPSOFpcKA0QsnS0vTrQpBwUS0o0OJx1e5JPNSidySfeTFMp0s9c9VTVp5kop7APoEq6N1Z5vKHQkbAHkPMmMfz8nrJRg2uZYtS/JVtQeLIbckHgRnHCSpaScE4yOcXBZWstLvaov29NMTtp3YhrLlJqjYQ/jGCtpWSl1IPUE+YEcLKkcFYFXq3MO3JUVUORWUMp/3wmmz96Qf4JJH4ah9A35kY+c+6upvG3qMUyclLpDc5Oo27gAD5Jv+WRzPQHx5Vin0VuhUkytNPA6c4cfyorc39dw5BUSdzvkxhfXTWSV0Js9mk0934xume4lIG3GXCSVOqHTJJI8BvyAzS7q1c40G/sPfyUXvDBUq3O2Jrfbemuldds6Wl2qhU5+TMkzJg+qyVYSkqI3yCQR4EAk9Ig9ZNgTUpNIrFemzP1YoJ9Y5OSclS1Hda/M8ugj06gSk5PW/UavVH1T1XW83NPuKJJShLiVqSnO+AAT4nmYu2UmETMs08j5RC08afDGMjBjDxGKfI3q2FSO6gWNLKXtsdyvqB5YA5COYQjFSKQhCBCQhCBCQhCBCQhCBCQhCBCQhCBCRNfsh3OKzpkumLXmYpE0tngSeTSz3iCfaSsDyEQoiQvYzuD0S+KxRy73bU/J96Aea3G1DGPc4s+6NLASZZwDobfO9OYZ5bJbeymTCEI9ctlIQhAhRI7atB9HrdvVoJJQ+w5KLI6d2oLHvIcVj2Rmvs8V77IdILdeKuJyXZMmvyLSigfSkJPvi1+13RRU9KFTYTlUhONvE9QFZbx7y4Pqiidi6s9/adfpalZMpNofA8A4jH62zGO39vGOb/2Hz0KTbbEuHEfPRQ5+HN5aJ/nv9gjVYOcbU/hzeWif57/YI1WDnGwnF+oHUarGg2FcdRbVwuSsg+4k+YbOPrxESuyBSvT9U3JojaSkHXQfAqKED6QpX0RIntLVIUvRm4VBWFPBqXHnxOpBH0ZjE/Ymp3y91T5GOFMuwlR8y4VD6kxjzjPi42cBX19kpIc87W8L/PBSrhHEcxsJtI4jmOIELCXazrXxZpG/Lg71CbZlc+ABLpx/7LHviEBG2IlT22ahwSlqyAd+TUuYfcbz1AbSg4/ylAe+IrHnHk/qLqzlvAAfn8rGxXWfTguIQhGWEmkIQgXEhCEC6kIqleoL9Bcku/R/dkmzON9PUcGQR5ZBHuilwaLiuKU1CuSWoUxRE1ucTS5j1XZUulTZHPGDnAPUDAPI5iYVi3BJaXaGSNcnq1MVuS9EQ4yl3h+coYSw2MZAB9XBJxgnYAgQbi7qhe01N6X0y1SrjZlag/NY6YKEBA9xU6ffFuHa2Gc4k1LstBc0F66Von48RlBbyX11G1YuPUypOTFUnVpk+IlqQYOGGh0AHUj8o5J8cbRZYHUxzCIvkLyXuNSUkZHONXXKQhCILiRl/sKtSs1fV6ys0hC2HQ78kvBRgqRnIO2MA/TGIIvLsz1Rika4zNNqRzJVxoNcPeFAKVNhvmCCMEcwQRmHsI8MmFeXt+U3hvuCm/JWFN0GdZVSbln5WlIcChSnkNvsJGclKFFPeJBGQBxEDoPG+tkjJiwfsBrNKHBQbwn5Rn8GVqDKJxtKfIq4XBjkPXIA6E7xekih9uSYTNuB+YCAHHUjgCjjc46ZPSPUMblqMpHfUd17eAW0qBXLFYuSf9KmatV20cIT6LJzipdvbO+W+FWTnc8XsxHhGjNmn+6KG1Uj/wD3Vxc9v45eK94vflCLHQscaloPaKoVMpVApdDb4KdT5Wnp5d3KspaH0JAipAdTFpVS0q9Vai46i8Z+lyn4LEhKy2ceBW624T7QAfAiPA7pogNLXUrqr8wj8LvKjwIx5gAD6AIqzFpo1mnMAeRPohXfOz8tKBJffba4uXGsDpk4zzwNz5RZKFTupQL5dcp9qZ+Taayh6op5cSlc0tnoBgkczg4Fl3YNNKRQq1LUedpE5dD0m8ywpDyJqcypBSUjBK0hQJBIxsTGTtO7rp132vKTdL40MtoDSmnWy240pIAKFIIBBGOUWxy5jRxFeANfZC8sswZ99mk0dr4uoUgsJccbHB3ikEENN/yQRlR64wMjOfZc9UemnfiOmrPxg+PlnU/3uyT6yyehIyEjnk55Df3XBV00GjuPpaLzxw2ywP4RxRwkbdCTknoAT0jpblD+J5FanVl+emFd5NPq5uOHn7AOQHIAACOOaTVrTc6ngOAQqtLNJlpZDaVHhQkJClHfAHMkxZepemdL1PobSVuKk6tLHvqZWpUgTEm8N0rQobkZ5pzgjIMeuurcuaqmhskplWsOVF1H4STuhkEdVDdXlgclRdCAmXbShI4EITwgfggf9wiYdWo2HzyUisEU7tHItjS2rT93JbYuygTC6ZPyqdg5MpAwtA5lC0kODA5EDnEMqpW6lfNyTd0V5wu1GaUVNtrOQwjPIDkCRjOPZyEWl2n9QqhqB2gq5NUFl/4tXwJc9FQlSipnLaFkEgAnhwSc4O+NhFdthFQboEkmrOZqHdJLx25435bZ8cR57HzF1MptsN1mYl4IsV73GkuoKFgKyCN98+MdWWkssoabAaSgcIA6DoAI+kIx6rNSEIRBRSEIQISEIQLiQhCBdSEIQISEIQISEIQISMgaD1v4i1dtd/PEHZxMsR5OgtH6O8z7Yx/Hops47TZ+Xm2F/LsOodbUOikkEH3ERYx2RzXcCCpMOVwcto0I80u6H223EqCkrSFBQ5Hbp7RHpj3i9GkIQgQrH1opXxvpVdcsBxK+L3HUp8SgcY+tIiN3Ywqvo9+1inFWEzMh3uD1La0gfU4Yl7UZRFRk5iTdTxNPtqbV7CMH9cQY7Mk6qka30dh7Lfeh+Wcz0PdLI+tIEY+L/bxMT+Jp88UlN1Z2O7vnisO/Dm8tE/z3+wRqsHONqfw5vLRP89/sEarBzjYTq/Rp2wJr0bSphrP90VJpH0IcV/qxSexhJcFiVuZ/wtTLfuS0g/65jr21ZnhsqgMZ+fUS5/zW1D/Wit9kOW7jSXjxjvqg8v6kD+qMh3Wx9eA+eqQH/JpwCzjCEI10+kIQgQoY9tCZ49RqVLZ9RuloXjzLrmf1CI/xmLtYTvpGs1RR/wAHl5dr6Wwv/WjDseNxZzTOPM+SxJ3VkPakIQhFKpCEIFxIv/STRysaoVmXbZl3peipc+66hw4QlIO6UE7KWRsAM4JycDeLA/V/XGU9OO0NdFkTTMtM1KanqOrDbjDhC3Gk8uJtSwcEcwDkHkR1F8PR5v3K05K2MNLhm0WX+0dpxJXPUKPRbdaa+yGl0vvWpMH13pRKghLacncp3IHUcXM4iK09T5mlzK5abYclJhBw4082UKSfAggEH2iMnavIq1jahy9elbncq70+w3VJGpghLndqyEgpGwAAIAAwRtgDIGPK/c1VuqbVM1efmajMHk5MOlZGeiQTgDyAAHhCQxMmJkl6aIsIcQLgggAU0Ou9RUGqbxAjBtqqXHMcYxCLkgkIQgQkIQgQkUaqvTNCqVNuGnkl+nklQb+fwEpJwBzILYI9h8YrMIk1xaahSa6inhYd0VDV206Xc9tXW3JB1oIdk1SLcwwlwDc80rBIII9fGDyMZBt+Sq0lKKFYqDU8/wAWymWe7AGOWMnMa5tL78ufRCrzM1aL8u5T5pWZiiz4zLLO5yhSTls78wCPI9JC0ztd1yoSwL8vbVMcVji9IenFnz4UoYUFY81J9kepw+IiygudQ71Jp4E08FssnDhRxAUn6gZ409/4tLCJ3h+RMylSm89CoAgkeQI9sWl9jt81D1Ju7pSnJPP4opSUKA9r63hnzIx5dIj1Ve0bNVDiE7ek6hs/wFAo6WB7nXXis5/ojEWrVNYaJNIy9T7juBaufxxXVhHvQhIwPIGLJcVhyauf4E/hT6eNurh6qTNQs2hyWfskvytTChz9JrnoI94lu5HuxiLbmpnQyjTAVMt0urTKTlC5hpypOcXkpQWc+effEbFasSst/vdZNuSvh6S0uaV/8RRB+iPm5rbd4QUSlURSGzt3NLlmZZIHh6iAfrhP9ZhgftrzIB8zdROLjHEqWslqqhuWMvaentcnWANnWmJeRlR7S44kj3IMY+vKp1qYn11acue2dNJs/fFUqd+MJ1wdEuNqCW1EdMg4O4MRlqd3Vutkmo1ifnSeszMrX+smKQTmKn/VBSkbadp/CWdja/a1SDZ7Z9TtuZlpGYoQuWlywCFVRtZTMvn8st7hJxnOCc9AOUZhsXtUae3/AMErLVsUmoubCWn092sKPt22PU4BiDUeWdpUpUAA+w0s9FYwoHyPOF2fU5WmrrhVfq37rZ3b9GlqTIpQw4X1OEvuzCsFTy1blRxtv0xsBsNot7Wi70WNpbc9ZWrhMvJr4N9+JQwMeeTmI2dmztEsWOE2heFTIpaiDTKjMkr7pXVhZ3OOqSfMdBnx9rrW6n30xTrKt6c9Ml1PJmqhMtk8PADkJ3wcE7b7HJxyjXOKj6GrTS2m/wAC0TK0szA6qKtly627wrXfHjfTLy3reOUlR+k598XzFLVQG0XCKuytTS1MBh1oY4HEg5SfaMnBHQxVI8vI4OcCOAWM9wckIQipUpCEIEJCEIEJCMr9nOg2peV2v0G5ZVb78wyXJNfeFASpJ3TgEZJByM5G3jiM+13sq2G60Vocm6Tx/wAKH/UT4fOBHPxPsh+PBSSsztIp2ppsDpBUEKFcIz3e3ZIuChsLnLfm2q5LfOSylHC9jmMDJCvdjPhGC5+SmKZNLlpyWXJzCDwuNutlCgfAg4IheSCSI0c1Uvjez7gvhCEIoVaQhCBcSEIQLqQhCBC2RaWznxjpva00s8TrtLllH290nP1xdMY57PMz6bo5bD2c8Mupn3IcWgfqjI0e7idmja7kPRejjOZoPJd4QhFqkEiAdsj4k7SUu183ubjXL+4vlH9cT8iA14/2p7Sc2583urgbe9/epX/XGT9Q/g/gfnoksTYsPNYj+HN5aJfnv9gjVZG1P4c3lon+e/2CNVkaydX6EO2w5ig2ujxmX/8ARSP64vbspJxo1TP5UxMK/wDiEf1RYnbY/wB57U/x8x9aURf3ZTH/AOi1I/x0x/1qoyB/zndnskW/8l3Z7LL0cwhGunkhCECFAXtPb633GPKW/wDlmoxXGVO09/477k//AI3/AMs1GK48TP8A5HdpWDN957T6pCEIVVBSEIQISEIQIXuqtZmqqKeH3O89DYTLN/0ApRA9g4sCPFHEIEJFbui15q2BSFzSOAVKRbqDf9BRIH6s+wiLq0bt6zK3cMl9ldb9BQp0BuULJ7t45GErdzhAJ2OQMjqDEnO0datk1GzZVdxzyKE5KZTT5hhvjczgZbS2MFYIAyARjAOQM50osL00ZkLgKaXHnw7003D5wTUW5qD2YR9ZlLCJh1LK1vtAkIW42EKUnoSASAfLJ9sfKM1KpCEIEJCEIEJCEIFxIQhAhIQhAupCEIEJCEIFxdJiXammy282l1B6KAP1HaPnKyEtJj7lZalv8UgJ+nAEfeEC6kIQgQkIQgQkIQgQkIQPKBCr2nldXa2oFuVVCigMT7XGR+QohJ+onnt4xsmWhLyAk4U2ofN8R5gxq6WVJCVJ2UhQIP1iNkunNwt3XY1BqyFcXpEo0on+VgBQPmCDHovpjqtcw9q08K6oLVbV2UStWUHa5aSTNMNnvZm3/VDbwG5LJ4coXjJwDg+GYsi77QtntLWMuvUHupevMpPzUYcQ4ObLwwDnoCfaNokL9ERlrDh0R7REg/K5Yty7SGpiXGzbb+QOLHIEHBzywT0G2lNlpQirTY8q6EJyQAto7RRRmpV6nzT8rMoLUwwstuNHmFA4OR5GPlGcO0BptNVTXRym0WW9Imaq0iaDQ5Z3C1E9BkZJ/wDw5FonZ+sPTGltT9+1Zl6YOFFEy93bKT1CQCCvHLP1csea/RyOkcxugNKmwWSIHOe5o0G6iVCJjyN8aKzrhlKXQU1QJ9X7iorjyeWcE8GMY3ydh5GPbOaWaW3qjAo0xRXFcnlSz8qQT48QAB8Aob9MiGD9Ods4Eq39MdnAqFcIz5f/AGUK1bkuuetyY+OpPmWVkB/hHXmAr3DPlGB5mXXLurbcQW3EnhUhQwQYz5YXwmjwlHxuYaOC+cIQihVqffZl30Ntr2TH/wAy7GUIxd2Yt9Dba/8A5P8A807GUTzj2+G/ws7B6Beih+xvYu8I4HKOYZVu6RAbWb7l7QlWP5NRYc/zWzE+YgNrp8p2gaz/ACpyX+ngbEZP1P7B2j0KRxP8e1Yk+HKIUnRI+Irf7BGquNqPw5Yx/YTHh8d/sEaro1k6v0KdtZriti23MfMnHBn2o/7ouzskvd5o3Joz96m30/52f64o3bMlO903pbw5t1RHuBac/rAj7djmb77TCfa/wNTdT7u7bP8AWYyBbGnmPb2SItie0LPcI4HKOY108kIQgQoE9qNvGt9wn8pMsfd6O2P1iMTxm7tfSXoerSHMf3VT2XfaQpaP9WMIx4vEjLK4cysGb73dpSEIQmqEhCECEhCECEhCECEi6r0vqevWVoDc84VfFkgJNO5wSlR9Y55kjhyeZwM8otWETq5oLRorBYGm6f8A5tCEIgq0hCECEhCECEhCECEhCECEhCEC4kIQgXUhCECEhCECEhCECEhCECEhCECEhCEC4kZ47M2v0rYwcte5HvRKQ45xyc4QVhlSvwVYzhJO4OMA+UYHjqttDgwpIUPMZhmCd0DszVdHIYzULaDTqrK1iWTMSU0zOy6hkOMLCh9IjAvbEkybTt6pJGXpSpoDZGxBIJ2PjlI+jPSIfUyfqlCX/airz9MGc4lptaAPZgjHuiuy9zXFdE/T5KuV+fqkkZptwtTbxWgYIJwCcDIz9OY2JMeyZhaKglPfqQ9uXcqWWsOo8jpkqXqNNlhVL2rMomWlGBkltIBPGQN8EnlzJA84pGnvZrfr1QTdOpkw5X666QtMm8viaYHMJIGxwegwB5xiSy9cKSzrbOXXdcm7NSzx7mRfT6/obYJS2cEgHAxkjcHJAiaFu3PSbqpzE9R6gxUJNYBDks6FgZ6HBOD5cxDsTm4ipJqAbD8njXu0TER6RxNbDb8le2mUqSo8smXkZNiSZSMBthAQPoAEe2OCsEiI7a5dpyRtJp+iWo+1UK2vLbk00oLbk9sE5GQpYPIDYY38IfkkZG3PIaBMOcGCpVya19ouj6VIVTpVKatcbiRwSQVhLQIyFOEctuQG5iGV2XZUr5r8xWqumXE6+oEiXQEJAAxwgDwHUkk9TFIddfnJp2ZmHVTU26oqefeOVrPiSY4jymLxZn6ugGgWPNPnK5McQhGalFPrsztd1olbX9B/6PSHCPqMZRiyNFKeKdpNaTQHCTTmXiPNxPGf9KL3j3MAyxNHAD0Xo4hRjexd4QhF6kkQE1R+7O0NPp+dx1ZlH1oH9UT7iA01/bntLqH3xC7oSn3CZAz9AjJx9w1vEpLE/wAe1Yi+HN+dop+e/wBgjVbG1L4c352in57/AGCNVsaydX6RO1hTvTdGp90Jz6LMy7/+fwf68WV2Jah3lCuiSzu1MsvYP8tKh/qRl3XKnfG2kV1M44uGRW+B/i/lP9SI89iyomXvGu09Rx38kl/HjwLAH/WxkSdTGsdxFPX+ki//ADs5j3UwY5hCNdPJCEIEKIvbYpPdXJbNTCfv8q7L58O7WFf9rEa4mJ20KT6TY9FqQHE5KzxaPgEuIJOfe2ke+Idx5L6g3LO4caHyWLiG0lceKQhCMxJpCEIEL0SEi/VJ+VkpVHeTUw4lllrqsqIAA8ySBEvpnQaxtLdLqrUq/JtVKek5Fx6YnJhawOPh2S2AQEjiIAOM5IyYw52U7T+yPVOXm1o45elsrmzkbcWyGx7QVcQ/oxkLt+Xn8Uab0q3WnOF+szneOgHmyyASMebimsewxs4OINgdK4VOgr84rSgjAiL3DsUTpCsytUdWhhfeFHtAxy2yI9kW/Zsp3cguYI+UcOB7tv15icPZh0fp1NtJi5qrItTFSqOVS/et8XcM5wkgHIBVji4ueCAMb5Uiw/TyZAaDc8EqyIvdlCh9CLk181Ekbg1ruFEgwFtInBJBxnGCWwG1KGOeSknPUeUW3C8zejJaDUAm/FQcOjJbqvdRaFO3HVGKdS5V2dnX/Vbaa5+JPgABuScADckCK3e2mtw6crk2q7IehKnASzh1DgOCAoZSSARkZHntEiuxrZ7UvRatc8w38vMPeiMLI3ShIBWQfAkgH/FxhTtx6ivzWrrNGknuFmkSbaHBtjvXPlDz5eopv6Id/SBuGErjc6D5yTDYW9GHk3OixxHEe616DVLon5Kl06Vdnam/j5JHPONyeQAHMkkADcnESisvsu2zZtMaq+oFTZdcGOJlyYDEq2eYBWSCs7eIB3GCNytDhnzElug1J0VDIzIbacdlE+ET8c0S05um30ok6FTlSsw3xtTsjjJChstDiTk+IJJB8xEGr4oqbPv6uWyt7vHqe+psHGC4jYpVjluCCcciYunwUkIDi4EHgrJMO6MAm4VIhCJn6S6EW1ZthorFy0uXqNRXLmcmvT2w4iXTwlXAEKBAwOZwSTnfGAKYMOZ3lrbAangoRRGU0ChhCPiLlkrhqtQdk5b0ZouKdS0AAhtJJISNzsBsM9BH2hdwymircKJF82bovd+oMh6dSKRxyW6fSHXEtoWRzCOIgq32yAQDsTmLTo9LfrVVlJCVT3kxNuoYaT4qWeED6TE/b0nJTSDRiqvyeGGaJSliVHL5RKCG8+ZXjJ6k5h/B4duIDi4kU4JnDwtlq52y17uNqacUhQKVJJBBGCCOccHnFv2nUZqod+5MOd4U44eQwdyeQHlFfhBwymiWcKJFYty0q3ds13FEpc1UXE44vR2ysIB5EkDCR5kgRl7QDs8nUMJrtfDjVAQeBllCuBU4Rz35hsEEEjcnIBGCYuzUXteWjpC4u27OoTNTdlCUK7ghmVbX1wBus5G52ydwTGlFgwWh8jqA6cSmGYcuAe40HmseSHZS1Bn20lynS0oDz7+aRke0JKt48Nb7MuoVEaU+qimdaTzMi8h5XuQDxH3AxUJDt/3WXeN+0KdNsf8A9K682UjzJKgfoESD0b7UNp6uvN0xsvUO4Skq+LJ47rwMnu14AXgb4wDgE4wCYcZhcJIaNca/OSYGHhdZpKg++yuWecadZUzMNqKXGnQUrQRsQQcHI8DHzib/AGitHZK9bUna3KSaW6/T2VPtutDC5hCRktq/KOAeHPI4GQCYg6y8h5oONr7xB5eyMvE4Z2HOU6HQ8UpLEYjRd4QifOleiVqWPTJSakpVqqVFaUufGkxhalkgEKb5hAPMY3xzJ5xzDYZ2JJANANVKGAzVoaUUOLa0dvO7glVNtueeZVuH3W+5aI8lrIB9xi9JbsmagvNDjk5JjP4Ls2kn2erkfXF662dsuraYXtUbYYtBr0iSWMTM3NFSXUFIKFpQgDYgg4ycHI5iLLovb+uYPf2ws2Tm2Ns+guOtKSM744gsEgewHyjTOGwzLPcaju/CZEEDDR7jVW/cvZ8vy1WlPzdBcmZdPN6ScS+NtySlBKwAOZIAEY4jYTpNrLb+sdEenqIt1p5hYTMyU0kJfYURtxAEgg74UCQcEZyCBgjtj6ayVsyspe9NlvR2nZgMVJtgerlQJQ9jkMkYV4kg88k1T4INbnidUKEmHDW52GoUbYRwhwOoSsbhQyDHYRjJBcRe9q6M3lelFVVaXQ3X5BHEoOrcQ33nDzCAognBBGQCMgjOdot22KC7cty0ulS/32emW2E9QCpQBJ8gDk+QieOrVYl9K9E6/NyQSwxTKYZeURjCUKIDTQ9xUn2xp4TDCbM5ziAOCbgg6SrjoFr2LeEY98eqjVar2xMd/Q6rOUx7POVeKMnxxnBPniLWtiqztSef79zvG+EeAxk7YwB0Bi4oQq+J1jQ8lWSWEgKv1jUi97hljK1K7arMSp5td+UDHgeHBPnnJPXpi3UMoZRwIGB1PUx3jnMSdM9/3ElRL3HdcDYQhCKVUkIRXrDo32R3vQacv73NTzLLnsKwFH3DJiTRmcGoGoC2N2zShQ7epVN2+45VqXGP5CAn+qKrHVKcbncx2j3YGVtF6YcUhCOImuJEB9HU/ZP2haTMfO72ovTnuSFuZ+qJsXxVfiOzq9UQcGVkX3gfNLZI/VEPuyJTvT9XUvlPqydPeeB8CSlH/aRkY28sbOdfMJLE/ewc/ZYL+HN+dop+e/2CNVsbUvhzfnaKfnv9gjVbGunV+piqU5NYpU7IPY7maYWwrPgpJB+oxB7s1VFVu620qVey36QX5J0HorgUQP8AnpAieMQAvxJ067Qk9MEFIk6ymoJwn+DWsPYHlhWIysechjfwP9/hKYm2Q8Cp/RzHzbcS4hKkkFKgCCOvvj6RqptIQhAhY07Q9v8Ax/o/cjITlxlgTaT/AIpQWceZCSPfGvyNoU/ItVOTmZOZSFy77amnE+KVDB+o4jWbXaQ7btcqNJmdpmTfcYd65UhRSceW0ee+qM6zXcRTw/2svFihDu5U+EIRgLOSEIQIUvexjbvodnVmsuI4Vzs0lhBI5obTnI9qnFD3RG/twXW5cOuT9OC+OXpEo1JpSDkcak94o+35VIPsx0ibeg9A+x3SW2ZYjhcdlhMq8flSXPpAXj3RrYvGum99X67VyeJudqb0wk+COIlI9gAAj00o6DDsYO0+p8ytl3Uia1XDQqM48ZGmyw7x14tsox1WSAD7yY2MXTUJfTHS6pzTWEs0Skq7ocOx7pohAx5kAYiGHZ1t/wCyLV63WCMtSzvpi/INJ4x/n8I98SI7aNw/EGg1ZYCuF2pvMSKD45XxqHvS2oHyMV/TgRC95+UFfyqcOKNc8rXra7blSrhmXyVuJ4nlKO+Vctz1JJzF8GLYslnDEw74qA+rP9cXtQqUuvV6nUxv587MNy6fapQA+sxhydZ+VJPJLqKfWhlBFu6T2zKEcKnJRMw4D0LhLhB8xxY90a7ay3UNcNe6n8VMmceqtUcWzjo0FHGTyADYGSdgBmNjmqtXFlaUXFOyY4HJOmOIlUoBJ70o4GkgDc5UUgRijs56P0vs7abzl0XOGmK7MS4dnnXcfcrexDCT45xkDmrA3wCfUyx5wyI2AFzyFvdajm1DW7AXVxUej2h2WtP3qrUnW3Z9SPuiax8tMucw03ncIB5DkOZ3iDerutlx613K64+64iTyRKyDSiENJ6beJHMnc9dsAfbXfWyra5XiXEJUiltr7qRkQdkJ/KONiTjJP9QAHgoNBbpLLaUgLmHMcS/EnoPLP0xj4iYABjBRo0HHmUrI/K0Bug0H5Knz2T5N+n6BWszMud44hD/jy9IdKQM9AOXliIP6+1j4z7SN1PsOZxUfRfe2lLSh7igiNiNtybGmmmMi1NYbZo9MSqYI2+9t5cV7yCY1ZyM+/c95zNVmlFT8w+7Nuk/hKWSSfpMP4x2WFrDrS/cE3MaRiutPwsvaTW0m7dRqBS1p423ZpK3gRsUJytY96EmJg9qq6/sT0Hup4K4ZicYEg2PEvKCDjzCCo+6I/dkOkon9VlTLidpGRddST+UopbH0hwxeXwg1b9F09tumg/3VU1PqPk20of8AaCKcI3o8K5+5/wBflLYfqQl/FQ8smV7unvPEbvOc/JI/2kxcceKhNdzSJUcsoCv+duf1x7YwHG5Kz3mris5dkmy/si1BXWH2+KTozZcSSNi6r1UD3DiUPAgRlDty134l0LfkgrCqrPsSvDnchJLx92Whn2xenZvsb7CNMpBDrYTUKh92zGRuOP5iT7EgbdCTGBfhD65g2XRQrO8zOOJ8PmJQf9OPTxs/T4Ut0JFT3/0teNvQw03KjVakr6PRmlHm6S4fecD6gIvewLXevS86PRGAeKcmEtqUBkobzlavckE+6Lakme4k2GuQShKfeAMxmDsrtoXrXRlr5obmS37e5WP1Ex5+Nokla07keqzQMzgOJUkO0Nch0p0Cra6IPQXGZZunSndbFoLKW+IHmClBUQeeQDGum1qKmbKpyYSXBn5Pi5HHU557/XGwbtk0RyraBV5TIyZNxia88JdSFH2AKJPkIinorolc+pNHk3qXKhin8jPzmUM5ychJAJWQSc4Gx5kRtY9rjI1jBW1qd6fxI0a1Wm2kgDhwkecemQm36dPSk7LuFualnkvNOp5oWkggg9CCIzvcPY6uCl0dyap1VlKrNNJKvRe5U0tWOiFEkE+AOAfGMAuoUy73SgQQcEHoeuR4xjOhliILhQrMLHxkFy2a0KqJr9Ap8+Bhuclm3+HwC0A4+uNWlPKZWt1ynJUSzLTbgaHTh4yMDwG0bPKPwWpYcn6V6rdNpiO+/khtocX0AGNWFqOOTk/U5x3768rvFeGSST9cbf1A1jZ84LUxn2hXNE0+yffpuiw10aZc452jKDQydyyrJR9GFJ8gB4xC4AvENpBUonCUgczy2A5kxMXR3TOV0Is+eu+5ZpaZ9yVy+w2fVl28ghrGQFuFQAydgTgbZJz8BVspeNAL8KJbDVD67brH3b4slEo1bN8yqfuhh34smykfPQQpbZPsIcBP8oeER3aX3jba0fMUkH2gjIj2696+3LrXWfQHFtt0SWeLknT5XJQFYOFucytYBIzsBk4ABOaNRJZyUprDTow4AeRztkkDPkIMY4SGrUYktLiWrMnZkrsxRNZKMyyvhZnUuSz4SSApPdlQ28iAfdEh+2Wptvs6XRxnrKcPt9KaP6gYwD2UaT8ZazSD/DlMlLPzCj4DgLYP0uiMo9vy4BS9IpCmpVh2pVNtJT4toQtZPuX3f0w/hD/6z82lTTwH5V+Hr0VDzUNbTmu9pAQo57tZbHs2I/XFaihWgzwUoH8pxSv1D+qK7Hnn/eQstwoaLOfZDtH481FcrK0cUtR2CsZ5d64ClI+jvD5ECL+7fFzfFekElR0qwqrVFDa0g8220qWfoWG4yH2crA+wLTeSL7fBUal91zORvlQ9RJ6jCcbdCTEbvhDbg7267SooVkSsk9NkDr3iwkZ/9jt7Y9FGz9PhL6nXv/pa8Y6OKnH8qPtmS3dUtSyN3HD9A2H1gxX48dFZ7mlSoxjLYV9O5+sx7I86TmcSss3JSEIRw6qtIQhHEJGYOytQDXNYJB/g4mqcy7Nqzy+bwJx7C6CPZGH4lX2K7YCZG4a+tv7443JMrJ3HCCtwY8DxN/RD2Db0kzbaGvgr4G5pAO/wUo4QhHslvJCEIELFnaRq/wAU6OXAc4VMpblQOquNxIV/mcRjEfYmpHHO3NVSn72lqTbPjkqWv6MJit9tOuej2zQKOD/dc0uYcH8ltGP1ubeJHlFxdkWifFWlCJwpwqozjswnxKRhsD2fJkj2xjvHS4wD/qPnqEmetOOQ+eqg58Obz0T9tb/+nxqsjan8OZz0T/Pf/wBPjVZGwnF+qY84hv2zbe9BvmlVdtGG6hKd2ojq40rGT7nED3RMg84wV2u7X+O9MBUm05fpUyh3PUNr9RX1lBPkISxrOkiI4X8P6VOIbnYTwur60XuP7KtK7bqCl8b5lEsOkncuN5Qon2lJPvi/IjZ2MroE7bVZoS1ZVJTCZpsHo24MED2Fsk+aokpFmGfniYeXmNURPzsDkhCEMq5dIgz2qrY+x3VibmkI4ZeqMtzacfNCvmLHmSWyo/0hE5yMGMA9sK0hWLAk642jL9HmMrUP8C7hCtup4w17BmM3HxGWI5dRfw18kriI87CoYwhCPIrEXMfaUlXJqabYR98dcDafaSAPrMfCLt0mkfjPU+15fHGhVRYKh4gLBI+gGLGNzEDmpNGY0U97tnEWXp1V5tk8LdKpTzqMdA00SPqTGqWym+KouuEfNbP6wP1ZjZt2jZsyWhd8LBxmlut+5QCCP86Na1ko3nFeaR+smPQY93VA5LTxRtRSu7GFJ9JvmszxTtKyHdg+a3E/1Nn6Y9nwiFXLNqWjTAfUmJ16ZVjxbbCR/wBaY9/YgazO3gv+RK495dz+oRbPwjXKwfyMz30/c39USgOXBl3H3p+ERikPzio42tLej0ZjIwV+sfeTj6sRl7s60X491itxojLTDy5o+XdoK0/WAPfGK6N/vZJ/4lP6sxIzsY0n0m/KzUCnaUke6B8FOLGD9DZHvjHwrekxLQdK+l0pG3PIO1S8npBmoNpamGUPNIcQ6EODKQpCgpCseKVAEeBAPMCIJds/XX7KLjdsqjzWaTTHcTjjZ2emBspOfBHzfbx8xjEl+05rF/Yi01mpiUcSK5UQqVpyTuULI9d3Hg2DnPLJSDzjW/bNNVVZ1Uw6SppBypSjkrVz3zz33P8A3xtY6cM6g31/AWhK/LYqs2vRBJMJmHk4mVjYfkJ8Paev0RlzQ62Psr1ZtySKONhEwJp0Ebd22Csg+R4QPfFgoQEDAiSXYtt0TNx3BW1/3qw3KtkjmXFEqx7O7A9hjGgb00zWu4+QWfH1ngc1lDtf3b9iWg1e7tfBM1PgprWOocV8oPe2HI162XK5L8wR4IH6z/VEqPhEbm4ZW0bcSrPGt2oPAHqkBDe3vciNlsy3o1GY2wXAV/SdvqxDn1KT9ynYPymcS6rqBSm7FUtxXRcj2PmyjSc/0lk/1RT/AIRbaTsNH4Clz30gMY/WY79i6ottXvXJInCpiRDifPgWAffhzP0xc/b4s9+u6ZUutS7PemjzuXj1Q06OAq9nGGwfbnpDWHaTgjTn61UoxWH5xUT5dvuWG0DklIH1RkrQPTn+yNqDKSr6OOlyX3VOfykgjDZ/pHAxzxxEcosClyM1XJmWlJCXVNTUypKWmGgSpa1cgAImpa1OonZc0hfqddeaTPL+WnFNkcb72DwMN+OPmjpnJOATjLwkHTOzH7Rc+yThjL3Zthqs3DYjGABz8I159t+p/HOv8rTweJMnT5aXx4cSluE+0hwe4CJXdmC4alemmjl1VZfFPVyoTM2Uj5raUr7lCE+SUtBI64G+8Qw7R8wan2nLnJOS2+2j3Il0JA+qNvGv/bDuPsStOc0jqqERhI+mLi07u92w72o1bbSXfRJgKWgbcTZBDgHmUEgeZi3lbCMg6KaUzWq12tymFIpct8rPTH+DbzskH8tRBA8NzggER5mMOdI0M1qsloJcKKdkjM0y97Ybeb7mp0WpsKzxDKHW1ggpI8wSCOY3B3iL/aC7Wktp+s2hp2mWbmpAFh6dYaSWJXG3dtpxwkjGCcEA7DcHFx9q7WxjRyzGbMtZaJKtTsuGkBg49AlQMcQxuFqAKUnmNznIGYRWzQTMqM7NJKm85Qg81HxPl4eMehxeJLAWt13I9AtGWWnVGqkbSe3FedOsMt1C22ajXEJKW6utwNoI6LWwEjceRAPPA64q0Ilalf8AqTSZOcPpbM3UG3HCeo4it3HiMAnwEeRCMDP0DwjO3Y8t34w1KfqJR8lTJJa0n8lxeEAe9BX9EZbZnYt7Y33v5bpQPdK4NdxWfu1HcgtjQe7pgKCVvynoSN9yXlBo48wFk+6NddktcEi65yK1ge5I/wBpMS3+EGuYydi23QG1+vPzy5txI6oZRjB8iXQfaIizQpX0Oiy6fwikKPtO/wDXDf1J3WyjanursW69FnvsnWKzc2oi6pNNcUrRWkvhChkF5RIbyPLBUD0IEXB8IDeszT6JbVqyznA3PuuTkyAd+FHChCT5EuKJ8wIq/YnmWUvXbK/w6kyq/PALoO3gCR9Md+27oxW9QqLRLgt+SXUZ+lFbMxJNDidWyvBCkAbqKSDlIySDkDYxZCymDIaLm58fYK2Fv7VG7+6hzadLRLynpLg+VdGU56J6fTz+iLgzF+2R2fb5umntGUoL8ky2kNk1L7nwQOQCsE45HAIB2O8WbWKVMUWpzdPnGw3OSby5d1CSCONBIIyMg4IO42jEex9MzgQDosxwJdmIsVJHsVUTvKlc1YIwG2mZVtXjxErWPdwp+mLJ+EQri13PaNICstMSb80QOpcWlGT7O6298Za7FXc/YVX8fffjEcX9Hu08P15jEvwhFozybntu5+7WulrkjT3F7lLTiXFLAJ5AqDhx48J8I3WtpghTv8VqMFIB83WDqJLei0yWbxybyf1n6zGWuz9pwrUW/ZRL7RVSaeRNTm3qqSDlCD0JUdiPAE9IsmzrKql7VWUpNEklzkyvCTj5rY2BWtXJIHUn2DJIETEXM2z2U9KlF95L1RcBWc/PnZjABwOYQNh4AeJO+bhYi9xe6zRcnjySkUIc7MdlmwBKegHgPCNb3bTqXxv2hKnKhXEZOVlZVP8AlIDn63Imx2fazP3LpVRK5U3C9UaoX5t5wdeN5ZQAOgCOEAcgAANogL2gpkz/AGkLpXnOKkEe5ASnHuCcRtY0/sg8aeiem/xgr4hAaQEJGAgAD2QhnMVu0rIrd91P4uoVPXOzXzlcOEIQPErJASOgJIydhvHlWBznZWiqyAC40CokI99ao03btZmaZUGu5nJRZbdb4woBXXdJIPuMeCAgt1USKJCEIiopGwbQK1/sR0rt+UKOB99n0t7bfidJXg+YBSD7IhJpXaC771CodG4Sph+YCnxxYPcpytzB6HgBx54jY8hISAAMAbADpG/9MhFXOPYPU/haODj6znHsX1hCEehWokcRzHkeeQy0ta3OBCElSlK/BAGST7BAhQs7XVwir6q/F6DxIpko2xw8/lF/KEj3KSD7IlxpzbotWxKDSUgJXKSbTbmOq+EFZ96iT74hPZ7K9Wtf5Z5YLjM9U1TrgUP4JJLnCfABCeEe6J+gADAjIwR6R8k3E0HzwScHWc5/E/PwtVfw5nPRP89//T41WRtT+HN56J+2t/8A0+NVka6cX6qIoF4W4i6raq1GWQluflXGMnfhKk4B9oOCPZFfjqE7xHUELpFVBDs4116xNZ5SRnlFlE4XKXMJVthaj6gxyz3iQn3mJ4xBPtLW07ZWsMzUJUFlE/wVBhwD5jnJW/jxpJ8siJk2BdbN72bR64yQfTJdLigPwV8lp9ygR7oy8BVhkgd/E27PnqkcMaF0Z2KuOEIRrJ1Io1foEvc1AqNJm0gyk8ytle2cBQwSPMcwfHeKzCBC1gXFRZm3K3PUqcRiak31sOeBUkkEjxB5g9RHgiRfbAsH4suGSuiXbxLz6Uy00QnYPIHqEnxKAAAP8GT1iOkeJniMUjmHb02Xn5WZHlqRkTs/4OsNreHpSvpDaiPrjHcXZpTWWaBqTbU+8eFhiea7w+CSoJJ9gBJiEX+Rp5j1RGQHCvEKYvaqd7vs+XoUc/RkfQXmwfqMa6bJTiVml+LuPoH/AHxtA1WtFd+acXJb7aU9/PyLrLPHsnveHLZJ6AKAzGsi25CZoz9Qpk8w5KzkpMlp2Wd+elY2II6EEYja+ptuDy/K0MUMylZ2KaqiXum4aeo4dmpNt5I8Q2vB/wCtEXD28LHfufSmQrEoz3rtFmy68QMlMu4nhWrHM4WGs+AyTsDGKLOtC9dK5WV1I9CRISMkpP3PNu925MtuKCCjgIJwc7EgEDcAgAxJWk9onTa5KPmerknTRMoKXpCrfJ9MKSeIcKxg42JBG3lFuFc0w9DJY6itqg3B8VKJ37eR1j+FAKiL46RJn/i0j3gYP1iJE9nDVa0dMKJX3aw9NJqk283wtNMlfG2hJ4QCNgSpas5IGMb849116u9nzT5My3b1AkLgqJyA0xJqclWzuclTg4QM9GwfdzEaJC4JSrzam2M7ZUdsIxnGBvnr4RluY7CS5mEE35hKuBgNRQlfXXrVyqa36hP1BY7qSlyZanSIOzLWTuTyK1HJJ93IAD50enpp0k0yndaRufFR5n/Z5Ql6VKSLxWxLobWrfPt8M8vdHt5QtNMZjV2qodI55qU5RMjsYSwb07qz2PXcqak+5LTZH1qMQ3iVvYruZldPuC3nDwPofTPMpz98SpIQvA/klKc/0hDf01wGIBO4Ktwv+RYW7f7zitYqUgnKG6I0Ujocvv5P9XujG0s13Euy30QgD6sRMXtTdmyZ1repVWos5Kydap6DLqM2FBt5kniSOJIJSUqJxsQQo5Ixv4tPezVStNSq5L6qUi/6F8qhrf0Zo9FLUoAqIPJOAM45kgBzFYaSWU0Fta7BNTxFzqjTivt2erDlNJrEn74uYehzUwxxBLo9dmXHzUgHHrLIBA5/NGxyIylb+plian0JaJWr0ypScw0UPycw4jjwfnJW2o5HvGDzBI3iGXaf7Sr+otQVQ6GpTNvsK9XhyFvq5caxzHkOgOTucDDNNs5kyvHOI4ZpfuLY8PfzIgGKbhg1jLtFuZO57FLphH1QLevNTvqV76JdntDr8gumiqFOG5emOGbmOXzQeJXdgjnkgEeOwiG+s+s9wa+XMlTqVS9OZJEnIpOUMpP4Sj1J6nG/IADAFupsuWSflH3Sj2DP07/qitydOYkGuBhpKUnmrmpXtPMwpNjMwygUHAWHelZMTmGVtm8FsC7NFLRQ9C7SlUK4sS61+9Tq1n6yYg7rlKrlu0xd6HPnmZLm/PCm0KHuwRjyiZnZVuRit6TSsmhWZimvuSzg6gFXGk46AhX0gxYnaF7MFWv7UiUu23HZULmGUsVBiYdLZylPChxJAII4QARsRgEZycak8ZlwjSy5oPSifl/chq3h+FFyTk36hONS8q0p+YecDbTbQJWtRIAAA3JJ2AETSpk1Qeyroe5VK2QJhtsOzKE445mbWNm0HcHHzQRsACSOcU7T7Ru3Oz9SXrtvGpyrtSYSeGYUcMy5wdmgQCpZGQDgHGwA3Jh92iNZaj2grpblkB1igSrpEjJg+4uLxsSRzPIDYct1MPF+jYZH/cdBwHFKRMMIzu1PkFjuYuiu6y6jVO4qw6V+lPF178hAzhtsZyQAAABnYCL8QgNpCEjhA2A6YEeKh0WXt+RblZdOEp3UrG6ieZJ5+zyioZ+iMuaUveeCUkeHOsuM9REuexRSu7tm46kU4MxONy4Pj3bYV/2sRGiYHYvqbK7LrdN4/l2ah6SodeFTSEg+zLREM/T/APkjsPorsN/mHesJfCATy5/Vu3KYk8TbNJQsgdFOPugj6GhGLEJCcIHzU4AHkIlt2o+zfWNVbgoVy0BcuajIIEtMS8wvgLjQcK0lKiCMgqUCDjIPPbBpGnPZilLOKbl1EmpREpKYcEkXcsII5d8o4BGeSBkE4BJyQW8Vh5pZTQW47K6ZrnvpS3FVDszWGjTu1J/UC4nPi5L8qS0Fk4RK5CuMjqVkDAxnAGM8Qx4UfCDWQ066xMUO40qRxcC2GWXELA8y4CPePpjD3ad7SkxqbNqti3VuS9utrSkhA4VzBB2JHQDoOnM74AxRb9ERTZUd8Ap54DvOW3h9HXzgdif07AyLbzO5XTIIgAzQefNZ81H7fdQqMq/KWhQjTEL2+MKg4FujP5DadkkeJJ9gO8R4o9QrFcqq52dedcbXxLWXDutSsnO+5OTkn64raKXKMbolmvc2B/VHoSnEZ02JdN9xSz5TLqsnaFaxuaS3C+5MtOzdInUhMyy3jjCgSUrQDgZGSMEgEHnkDEoF9orSmrU55moXLTC2tIDsvPtKHEOe6FoHFv4AjMQQjyzlNl6g3wzDYcHRXIj2EYMXwY58LctKj0U48QY+oVK27e2Rpzp/JvyllU5urzCtgJKVErJpVjAKiQkqx4AYI6jnERdQNRbj1nuNdQqrxdeWRwt5w20kfgpHIAZOAOZyTkkk9W7QpoBHdrX5cZ/qxFVlpduWaS22hLaEjASkYEVyY10podOGgUZJi/5ZbEdB5NNM0Zs1ji4uClsj2kpBP1xrw1baWe0Nd3H/AOeZn6ONZH1YifnZyuBmv6PUNSFZdkkKlHUfkqQogZ9qeE++MJ69dlG4Lt1XF1WuZVyXqASZ5qZd4Cy6E8BWMg5SQASASQc7YIjbxLXyQN6MVsPRaL+vEC3h+FHul0yarM/LyEhLqmp6acDTLLSd1qJwAP8AbyHMxMVxykdk/R1x13uXq/NDf/j5gj3Ettg+W3gVR8LRsK1uzJbT1zXFOtTddcbKUu7ZBxktMJOCSeRUcbbnhGREN9btZavrVdhdWoiVB7tiXbJKG0ZyEg7Z8SSBk77AABCONuEaXO+4jwHE80mxgw4qfu/CobFy1O6bkfm3VngcWp19RAJUpWSSSd8knJx5xXI8VHpyabJpZA9cjLiv/wA6DkI9sY76F1ki41KQhHokJB+qT8rJSqO+mphwMttDmtSiAB7SSBFaipOdjSy8msXXMt8sSEqSOmy3Dgj+gAR/KESoG5i2bBtJmxbOpFClSFok2Qhahn13DlS1b/lLJOOmYucDAj22HiMMbWePavQRMyMAXMIQhpWpGLO0Zdn2JaUVlaF8E1PpEgyepLmy8eYb4yPMRlDrEP8AtkXl6fddNt6XcyzTmi++ByLrgBHvCACP6UJ4yQQwl25sO9UTHKyq9PYwtP0it1q5HEZRLNiSZJHNayFrI8wAkexUS5jGXZ9s/wCwzSyjsLRwzU2n02Y2wStw5GR4hPCD7IyaeUGDj6GFrTrqe9EDcsYC1WfDm/iT/Pf7BGquNqnw5n4k/wA9/sEaq4cV6/VRCEIF0rBfa0soXFp18asN8U1R3O+JA3LK/Vc+g8Kj4BJi1uxnfPpVPqdrTDnrsH0yUBP4BwlwDyCsH2qMSOqdNZqtPmpObbD8rMtqadbUNlpUMEH2jaIEU1yd0D1pSlzi4KbOlDvi/LLGM45ZLakkeBx1EZGKJw+IbNsbH52eiRkHQyCQaGxWwWOY8UpNNz8szNMOB1h9CXG1jksEZBHkRuI9ka6dXMIQgQrP1OsljUGy6lRH8JU+2Sy6R97dG6F5xkAEb43IJHWNdVTp01R6hMSM00WZuVdUy625+ApJIUD5g5EbQoiH2utMPiutMXlIM4lZ1QYngkbJeAwhWPBQGDtjI3OVRj/UYc1JW6jXs/pIYqPN1xqPRRwjkHByNjHEI80slSz0y7XNEYt1iVvJb8nOSqAk1BDSn0PpAAClBIKgs9cAg88jOB9bt7YWj9NcNTlGzcdUGOFctTChzYerlx5KMAeIJI6AxEePBMW9T5p0uLkwlfvA+gED6o1R9RlDcjqGm9Lp1uJIGV11cmrfaUuDWKpJR6MqUlGSfRZBJJbQfylD8NeNio4AGcAAkRbElSi9SyzUVmZUvJIVvw55AHy8o9ctTZeRAEu0ln+iMfSeZj7jliM+WbpKu34ql0uY1VFNnU7O6HD7VbfVv9cVSVlGJFsNsNpZSPAc/aeZ98faEUZidVQXOJunPfrCEI4iqRUaFXZ+26lL1GmzjsnNsYUh5k+v4EeYI2IOQRsQRFOhHa0uF2qyjUe1xqtJshEs/TJof4VUmA8COeQCEnPkPdGG7x1A1D1Pmy9cFWnptIOzbi+5YQPENoARnG2QMkcyYqcIc/Uyublca9qZ6d1MpVCpFrNU7D76+/mOfkk+XifMxXcDpCEKOde6pc+qRzHEIiq1X7Iv2s2BVkVKiTSpZ/hKFhXrNup8FpOxGdx1B3BB3i+6x24dSmmu4boFEbXv90tSz6/YQC4QD5HMYlhDUWLlhGVpsrYppIxlqqXd95Xzq1UzM3LU5idwdmnDwMtDwQ2MAe0DJ6k847Uqit0hnA9d5Xz1+PkPARUoRVJO+Q3K46Uu1uuM5iZOkOi9gUqlUs1FdNuG4Z9nvuGYcQ4OWVJbbyQQkHBOCTgnYHAhvF4aPl9eq1pmXc7twVJni4OqeMBYPkQSDDGFkDHjM0GtBfZWQEB4qK1Uh+0porb0nYc9dFFpjFJnqU2HnGpFsIbda4gF5QMDKQSoEAE4IOc7RhsDUKqWXVWq1QJ0sv8AIpAyhxJO6Vg7EZ6HcHcEEAxN3tOVlig6E3i7MnZ6RVKp5ZKnT3aQB13VnyAJ6RrlsZXFLzKc+oF5T5Eg5/UI0PqETY3h7bGlbW703OwAhwss/VTtvalSjS2EUCg8e/3U1LvrGOhCe82I88jPTEYavHUjULVeYUq4apMPMg5EuQGWEDlhKAAM42JwSRzJj1mEIfrJXihKXM7njKVSKLbzFMw4v5V7nxqHLyH+3nFXhCFXPLkvVIQhFagkIQgQnKEIQIV56b6tXFphPuv0aYb7l3AelJkFTTgHIkAggjoQQcbZxFzXP239RG2nGJKh0iUX/wAKbZdeI/lAKXwg+RBjE0IeixUsQow24K9k7mNyjRUG4LhvLUqpGauCoTk865zcmlcKEjOcJSAAADyAAA8BFQo1EYo7WWgFPn5zhG58h4CPdCKXyOealQM2ZcxxCELqtIkH2Q9Ofjq5Zi6p1rilKUS1KcQ2XMKG5GRvwIOfEFSSOUYKotDmrjq0pS5JovT046llpkflE4GTyAHMk7AZJ2jYnp7Zclp9aVPoMkAUyrfruAY71w7rX15nJxk4GByAjVwMHSOznQeuydwkYkeSdvVXUlOP6hHeEI9QthIQjiJoVPrFWl6DSJyoTbndykq0p95z8lCQST9UQRsamTGtutbL06nLc7OKnJsZyEMpOeDPhgBse0Rnntd398SWgxbku5wzVWVxPgHcS6FAnPhxKwB4gKEebse2D8V29O3TNN4mKir0eWUR/AIPrEeSljH/AKsHrGPiT+oxDYAbC5+eXekZSZJWxDa5+fNVIttASBgYSNgB0EfSOPKOY2E/Raq/hzfxJ+2t/sEaq42qfDm/iT9tb/YI1VwLi/VRCEIF0pEXu2Lp76VJSN4STWVMYk53hG/AT8mv3KPCTz9YDpEoYo9yUGVuaiz1LnWu8lJ1pTLqfIjGR4Ecweh3hadgljLD3duyqkZ0jaFYa7Juov2S2Y5b805mfo+AjiO6pdRPAf8AJOU+Q4fGM+Rr+t6p1HQDWEomUKJknzLTQG3fy6sZUM9CCFjzAzE9ZKeYqclLzcq6l2WfbS604jktJGQR7QQRC+BmMkeR/wBzbH8eyqw76jI7UL2wjgRzGimV0MUO6bckrxt6oUaoNF2SnWi2sDGRnkoEggEEAg4OCAYoNW1qsmgzypKcuORRNJJStCHC5wHqCUggEdQSMRdlNqklWZBuap8y1Oyjoyl9hYWhQ8QRsYoq14IBB4qFnggFa4r9s+esK6KjRJ9GX5VZCXMYS4g7oWOexBBxzBODuCIt+Jv9pbR3+yFbhqtNZ4q9TUFTaUo3mGuam9t8jdSee+Rj1sxCE7GPJ4uAwSlux07P6WJNGY3U2XEc5jiEJJdOcIQgXUhCECEhCEC4kIQgXUhCOYELiEIQIXOI4j6NSrzv3ttxf9EE/qEdPI7GBC4hCECEhCEC4kZS7OlXt63tQRWLinkSMtISrjrBW2pYW6fVHIE5AKiNs5AxGLYRdGejeHja91bGcrsyvHtZ9oF7VWsStEpRcYtuQUXQF7LmXcEBZHQAEhI54JJ3OBje16f6DSwpwfKOq7z3cgPo/XHr+JpX0/0ruON/bxIzjAIHLO0ezGNonLMZXZnbq2SXOkIQhZLJCEIEJCEIEJCEIEJCEIEJCEIEJCEIEJCEZE0R0qf1Vu1EqsLRSJXDk8//ACc7IB5BaiCB4AE4OMGccbpXBrRcrrWl7g0brNXZK0m9FlfszqbPC++kt01CgMhG4U74gndI5bZO4UDEneHbPWPJJSbUhLtS0u2lmXZSltpCRgISBgJGNgAMACLBu7X2yrOrXxXUar92o+/NS7anO5O3zykEAjqASR1HKPZRNiwkQYSAOJ3K3mAQgAWWTIRS6JWpKu0uWqEhNNzkrMJCmnmlBQWnx8R4YO4Ox3iqQ0FckeObnGJGVdfecDUu0lTi3FfNSkDJJ8gN49eYj72sdSPsctRm2pNzFQq+fSMH5ksDg5/pkcI8QFRXLIImF52UHvEbcxWALpqtR1+1lUmU4kiefErKZyQzLpzhWOYAGXCPEmJ2UKjytvUeRpkm2GpSSaSy0jqEpGB7T4nqd4jr2QtNvRZGau+eaw/NZlpLiHzWwflF+8jhB5jB6GJPwjgoqNMr/udfuVGGZQGR2pTrHMcdY5jTTZK1V/Dm/iT9tb/YI1VxtU+HN/En7a3+wRqrgXF+qiEIQLpSEI4gXFG/taaX/HdDau6SZ4p+nANzYSN1sE7K25lBO/kSTskR8eyNql8aU16zag7makh30iVHdTOcqRk9Uk5A8CcbJiRk1KNTbLrLyEuMOpKHEEZCknYj2EbERA7UyzqpoLqdLzVKcW1LocE5TZo7gozu2fEjdJB5ggkYMY+JH6WZuIbo6xHz5UJGVpjkEo0Nip8xGbV6+7i1Lvtem1lL7llrKahNJcKOWOMFQ3Dac8JA3JyMEYBzfpxfclqTZ8lWpJQHfJ4X2Sd2nBstB9h5HqCD1jCNlz8lpFr5eMjcS0SbNwKVOSNRf9Rs5cUvhKjsAclJJIGW8HmIvxDszWgHquNzyp+dFdI6obQ0B1PzirstPspWZQ6Uhuqyrldnyn5SYmHVtpyefAhCgAPDJJ84tiyW39E9d/sJkpl2atyvM+lS8u65nuHCF4Pty0Uk8yCCclMZGvvXyz7Hp631VZmqTh+9yMg8lxxZxtkg4QD4kjyBOxxjohQq5qZqK/qfcLRlZRhKkU5pQIQocJQOAH8BKSfW5FRyNwYqeI2Pa2ECoIrTYb1Kg+jHNa3UHbhupO9N4h52o9FviGeeu+iy/wDa6YXxTzLY+8OE/fB4IUTv4K8lACRFN1jsuq1o0eVuWRdn+LhS1xEBw5xhCyOFZJ5BJJPSLtnpBiqSb8pNNJflnkKacbWMpWhQwQR1BBxDE0ceIYWgg8CL0KuexszS1awIRlTXTRab0rrvfS6VO27NrJlpj/BHclpZ8QNwTzAyNwoDFceQfG6NzmuFwsFzSw5SkIRziIKK4ivSGn10VRpt+VtqrzbC/musU91aPcQgg/TEo+znoFI0iiS1x3BJonalNAPS7D4Cky6COeDsSQcjOcAjryytqHqTR9MqI3P1h7ukuKLbKG0la1rCSrAA64GBkgZIBIByNyP6cA3NM6lfLtTrMJmbmcaLXtU6HUaE/wBzUqc/IPcu7mmlNK+ggH6o8MS4tLUaq69z8lTq7ZUoq051LrHpaXC46xMIb4y4FYHCDgJAwNzjjVgg4D1h0zmNLrsep6lF2SdR6RKPkAFbZJGDjkQRg/TyIMKS4UCPpYySNDUUI9xzVT4C1uZpqOyitGjUaauOqStOkkd/OzTgbZTsjjKjgDJIAyepIEfGfkH6bPTMnMp4JmXdWy6nOcLSSCOZBwc7g4i6tGN9VrU/5QZ/0hFNv3/w6uP/AJSmf+sVCQZ1M+9aeSry9TNzT7C5w2a3dCXpZ+nelCVcaady+wohRSXEY9UEJODnfbxj3u6W1lmg/Grhlm2E01urd0XFd53LjvdtnljJO4GeW/lFwaIyy7tauqyQ5wO12Q72UC+kywoOI9mRxgnw8ovKdmm7qu/Ui26WvK00tul0uX2+VEotsFCM7Enu1EAc8nENsha5oI3t339h4qxsYc0Orrbvv/XisK0+152qW5WK2z3XoVJ7lMxzCyXlFKOEYIO6TnJGPOPtcFmT9s3a7bk53RqLbrbPySzwcSgCMEgHGFDO0ZApdoVW09Gr+NZk3qW7Nu04tMTI4HcIeWCvgOCEZcABIwTkDkYuPUjTS4a9r2/UKdJLm6W/OsOqn2vXYYCEoDneLGQgpIOQSDgctxnggowdU1tXvJ9guGIgA0vb1PsFStP5649OZDUenIqTjE1RZM8LTLylMIeL6G1uAHAJxkAkZHOLWRo7VXkSE1U63Q6MKow3OSpqk9wd+lxIXsAgkYzgkgDOQCcGLyp7v2a3frBL0j7tfqbLqpNlpQJmAmaSTwA4zkDIA3Ii0ta93LIT+Ta1PGPD1VHA8NzFsjW5RWpArvbU/iikRUVNwNPE/hU6Q0grkzctYo88uVoz1Ib7ydmZ97gYYSSMEkAkhWRjAOQQYpi7HmVU64J+Um5SfkaKplL8yw6opc71RQgt5AJGQc5AIjOziVzOol1dww1WKi9bEkWaNNY7uoL7lkkLBwVlITxAAgkjYjBixHKZULZ0uvlyt0v7HX61NSTUnILbUzxFtaluFDazxhABG5yMnGYrMLATStL37K05cOaHMG3PyrRY5p9rzVTtyr1pnuvRaX3PpHMLy8ohHCMEHcHOSMecVpnSavTVzot5juH6ouRFQba7zZaC0HAASAMkEDBwM7ZxvFa07kH63pnqNT5FHf1FxMi83LIxxrQ24suEDmQkEE45CMiehzSdQmK0hC/i6ds5z0WbR8xwtyAC8EHYgkAjmDiORwsc1rr3pXxIPoPFcZGDSvL8/wBLE9S0on6fQZuqSdXo9bZkuH0xqlTgeclwo4CiCACM4BKSQOecZIt+6bbmrQqHoM6WlPKZafCmsn1XEBY3IG+CMjGxi7tHFcUpfqTuk2vNk+Gy2sHHl0iu6jWHW73rVJrNEkl1GkT1NlB6a195ZLbKUOBxfJvhKSTkjAjrow9lWg14a7n+lItzMzDX/f8AStNGkFbF1VehLXJsLpSO9np9+Y4JWXTgEErIzuVAAAEk8hsTHyrWldWpqafMSMxIXBK1GaEmzM0h8vIMwdw0chJSsjBAIGRuM7xme7ZiloqutUxUUOztPD1JPdSrgbMxnJQnjwcIJAJIBOBtvgxa2mVWYYtJM+038WyLd6U91LfelaGEYWDuvJIA2JO5HOLHQRtoONd+BI7NAudGGnL2+RPsrVXofVg6/Ky1aoFQrTKSpyjSk7xzWUglaAMAFYAOQFE7HGYtGg2vNXHK1d6V7rgpcmZx7vcgqbCkoOMA5OXBscbZ3jIVPk/sF7R0kqoo+LZX45U42pzHB3K3VBtYOccBBBznGIq9A0+r1lyGpkxV6c7IsGkvsMrXjDp71s5b/LAAySNhkA7nER6EOrkaRQkHuFQgR1rTate4LB0IqNBn5Klz/fTtLaq7HCfud1xbYyeRygg5HhnEfWv1Wn1aaSunUZmjIS2E90y66sLOSeIlwkg4IGAcbcs5hHL1c3lf/XmllcNG0pnqpRpSqT1bo1AlJ3PovxvNFpb4SrhKgAgkIBGOIgDzxHvrGjU/LXtUaDIzbDjFOlW5ibqk8RLSzaVISSvjJOUkqASRknmBzxWXqGaLYlv1qStj7MkOSJdmqjOOTD7EgeI8TAbZWkNhAAJKiQSSRgCLvvSZ9PpV1juW2GH7OpMz3DQPAgpcbKMZJOBxEDJJxzzDrYW0q4aUO97E8KXPBPNjaWn5sT2LEFx6bT1AoyKvLVGl1yl94GXJqlTJcQ24QSErCkpKSQDgkYOOecZq7WiFWLrElMVegyNafbCm6NNTpTNZUAUIIwQlagRhJUCcjaOLJ9fR/UdHzcuUzbp9/WM7eAJi+KzSvsLvqmKYtRFZpy5uVQ3dNTcmJkzRUU4cQ4hwNgnmBgkYwc4jrImOo4jWm5tcjgeCraxpAPH3I/CxBPWTVqfbrlYnG0tMM1FVKWyokOpfSgLIIxgAAgZznO2I9FO0+rNTkaHNyTImRWpt2TlGWj65cRw5yCAAPWzknAGScARli8aPNXlb98UyjMLnqlI3rNTzsiynie7hSSgKCOZAWMHAOMiK9pzQZq3RpjJ1RJlJpM9V1PS5UCtgmWJAWBuleMKA2IBycZgbhml1q0tfnUD3QIQ53Lj30WIKno/UpSSqU1K1eh1xyntqdnpalzRW+w2NlrIKAFBJIBKCQM77RxRNH6jW6ZTZx2rUak/GQJkZaozZQ9MDJSCAEnAJBAKiATy5iK/ptUKTO3ZWE0SlO02TFAqDR9IfLzkykMqIUs4ABO2QAACOvOKjbdCrtft+15WpWw3etGW0GpSo0x1bczIDjOW1uABCSk5VhwEDIwccutZG+jmiuulaWI5V34aoytdt68u9YeqVOmaLUZqSm0Fual3Sy60fwFJJBG2QcEcxtHkivX1TmKNeFZkpSeVU5RiZW01NFQUpYSogEkbE+JGxO42ikysq/PzTErKtrffdcDbbTWVrWScAADJJJOABuTGe4UNEs4UNF77ZtufvGvSlFpTXfzs053baU8h1KiegABJPQAmJ/wClunEhpfakvR5Md4798mZk7KfdIAKsdBsAB0AA3OSbU7PuijemFEM9UWkquWdbHfq5+jt7HuQobHcAqI2JG2QATdupeplL0wt1dUqh7xald3LyrXz33OfCPADmSdgPEkA+owmGbh2Z5LGngPda2HiELc79fRNW7nmbN02r9YkQTNy8ue5z+CpSggK93Fnw2jHOl1n2RQdF2a7WGZGoonZQzdUnp5IccUpW6mwo5OUn1AAQSRnmYu/TOtV/UW2Km9eNvs06QnlkSsqv1u9l1owQoEk5zncgZB2AAjD+s/ZyoFkae1msUQ1J5xpaHPRnn+NloFYClBIAJIBxkk4BJPLMTmLiOlaK0BsbU50pv3K19WjOBWx19VS9H65qlJWCpuy6CyuitTLrzTs8oF10E7obBWAQCDkgbnIBztGcND9XF6rW/NuTkomTq9PcDM4wjIQSc8KkgkkA4OxJIIO5igSvaFsS19M6dMyE4hx1iUQyxRkZD4WlIHARjYA81nbqCcgH7dm6yalbdtVSu1lHo9WuGZ9PdZKOAtoyeAEHcElSlYPIKAO+Yrw4LS1gdmFL8BwpwUI7PAa6opfgOCyncVbk7Zo09Vp90MyUo0p11Y54HQDqTyA6nAiCMo1Ve0Jq8eIKa+MHuJw8xKy6eWM7bIAA5Ak+JjInay1XNaqabLpcxxykk7xz6kn746OTeeoTnJHjtzTGUezPpSLDtIVSfaCK5VUpccSobss80I8QTzI23wCMpiEzji5hCz7W3Pb8soy/vSCMaDVZbo1FlqFS5SQk2xLycq0lptsdAkYHvxzPMxVByhwgxzGynwuOscxx1jmOri1V/Dm/iT9tb/YI1VxtU+HN/En7a3+wRqrgQv1UQhCBdKQhCBcXSMe6z6ZNaqWg9TyEt1Bn5aSfIwUODoTzCVDY+GxwSBGRY4MQexsjS1yi5ocKFQT0G1NmtHL8epVaC2KZMu+jVBpzP3O4CQHMdOE5B8RnmQIl3e2n1vanUhmWq0mmdbRlcvMNq4Vt8QHrIWDnBGMjcHAyDgRhXtW6MmpSyryo7GZhlITUWmxutsDAdAHMpGx8sHoc/Hss61mYS1ZVbmPlG9qZMLPzwNyyT4gbp8Rt0AORE4QOOFkuDoToeXzdIMJjeYn3B0+fLq6/9z5pnpjIzVw1RiYnpWST339s3g4gHOAAgBIUSSAAQQSQIsq9u0Y/eOntelqXaFXkKU+wZZqrJSVMoGQCleAEJBTkEBZxnkYzLrtac1e+ltbpdPHeTpQh1pn8soWFcHtIBAHjiKNoLe1BujTam0hK5eXm6bKJlJ6nO4BHCOFSyk8wrBJO4ySDvmLXxnN0bCGVB2FzpTuHeri3K7KKAU4K2rK0c0/vrRqnKk5ZhuZckwXKqgfdLMyE5WVnOdlZyk7Y5YGDFzdm29Khe2nAVUXu/nKdNKklTAye+CUpIUSeZwsAk7nGTucxhqwNLaTf1935R6NXp+QoEtMJ7r4se+QcbUVAoUDkLAIwkkkEAnfOYzvPaaTFs6VTFsWJOfFE4E5RNO7uOrJBWVLAGFqG3EBttgDAxzDl1RIGgAAg0OpFhQdxueK7GCaOAoACLb0V4XRbNOvCiTdIqsqJuRmUcKmz9IUD0IO4I3BGRED9YNH6jpVcCmXgqYpEyo+hzoRstI/BONgsDmOvMbHaTWjWuD9ZqH2H3m38WXdJ/JAvAIE3gfQHCN8DZQ3HgMp3XadMvOhzFIrEomckZhOCgjdJHJSTzBB3BG4js0LMbGXNNCPLkUSxCdtW/ORWtGKlbEoiduWmS7quFl+aaacPQBSwCfoMXlrJotVdKq0rjCpuivEiUngNup7tzGyVADlyIGRyIFgy765Z9DjZKXEELSfAg5H14jzmQxyAOFCDdYxaWHKdltA4UNIShIShKRsBtiIWdq69pu5Lxao8xTjJs0dx5pqYJOJgLS2SQCMDGMZBOc9IlJpbfsrqJZ0jWJZwKfUlKJpvkWnAPWBHQZ3HkfHMYH7bf93Wh/Qm/wBbMek+o16Bxby77j/a2Zz+zmabWV6dnfVifvH+0jtrfEknKSneomZVkollq4hkJGAEZ4yQkZGAcbDeldtSRbds2gT3H8qzPKZSnHNK2yVH3FsfTGV9FgP7Etpq5ZpzP+iIjR2tdQ2LkuOSt+RcTMS1JCu/cbOxfVgFOQcHhAA5DcnpHJDkwhDzcgeegUJSWwX5LGujG2q1p+Hxkz/pCKXfv/hxcX/KUz/1qoqmjP8A417T/wCUmf8ASEUu/f8Aw4uL/lKZ/wCtVHnD/iHafQLM/wDmO38BUDeG4i5fsXY/saIuXvne/VVjT+624MBlLnFnnnJx4YilytsVeoTTcrK0uffmnWw82w1KrWtxvosAAkg9CAR5xT0bgQFFU91xbvrrXxrV7yfaTHHfLbHAklIVjbcBWPEdYqE5b1UplS9AnKZOStQ4Sv0Z6XWhzhAJJ4CAcAAknGMAnpHNRtyr0Rpl+fpM9Itu/e3ZmWWhC+vqkgA7eGYmA6hsijuCpoGNz62Y5CT+T9UVhy0a+3IvzrlEn0SrGe+mPRV92g5wQVEYBB5gkR0n5BhujUh9hE8Zma73vi+yAwohZCe5IOVjGxzyO0RyOXL7qmDKCCMpPltB55185ccLh8V55DzMVGrW5V6B3a6pSp2nd7nu/SZZbYWPEcQGefSKjbVrMVy3bon3XnUKpMq280hGPWKnkoIOd8AKJ26iJBjnGnywqjeitn2Ae6Od49cvSp2ZDC2JJ9zv3C2zwtqIdVtlIIG5GRkDfePVVrYrFAUhqpUedpyndmxMyy2+P+iFAE8+kco/gpUVKI2jt3i+74M/Ox44yOWRyipvWlXZWnqnnqNPS8ilRbVMLlVoRkHBBWQACDsRnIO0cyVo16rN95JUSfmmg2HSpiVWvCSSAokAjBIIB5bHwjtH8CihVJyepI9kXI/U6DMWBLynoHcXKxOk+mNcfy8sUEkLySMhZAGANh45J8DdOll26/OKanRONzSWgQyDLhJSonjXnIXkDAxuMnpHE1blXpkgiemqXPsSTuO7mn5VaG17ZGFkAHI3GCY6MzASBWyKKlYz4+8f7Y+rqi53feLK+HzJ28B4CPnAbRWorstZWfAeEcCOIQUXKLuHVtBaEL4OP53MDHmBzj55A5n/AJojmEFEUTn7Ogjv3rndd3x+p+RvjPjjlmOkI5RFFy06tpwLb9Rf0Y94gteSd8k8z4xxCO0RRcJEfRDziONCVqTxeBIGPMDnHSPvKyr8/NNysqy6++6oNttNZWtZUcAADJJJOABuTHQpL5oaU+W22klxS8cLYznJOAABuSTyETM7OnZ+Fiy7Vw15hC7heTlmXO6ZJB/7Qg4J6DYdc8dn/s6t2M0zXriZS/cKwFMS59ZEkPrBc8VDYch4nLV5XhS7Etyaq9XdLcoz0QMrWo/NQgbZUTy5AbkkAEx6DC4Pov3pbEXA4czzWnFh8ozvVxxG3XJTCe0Dp18cHFBASQXN2++7wg56Yz3Oc7Y57R1d1m1erUoqt0GxWG6Cr5RlLrSnHlo6HAcSpYPMFCMEcs846G67f7U9sLoE82m37wk8uyqXDxpKgPW4TgEggesgjIwCM8OYYmlbK3KK1sRUEA0NaCvFWyPDxlaL6itq0VWvW4bw1U1Eqlm2jUjb9IpASKhVmweNThB9QEEHY5AAIyQok4xFBl65d+h16U2g3hVvsqtOuH0cOzBLhTxYQQePJAHEMpJIIO2+cWtYV+13s63HWJS86NOzDFQLZMyjDi1qQDhbayQhwEHByQQcE4OQbrllVrtJ6gUSpimTFHsqiOd6lyZCeOYXkEgdCSUpBAJAGTnJAKmbP1gTnJ0vYV0I0pRL5s25zV07/ClFlmmaDWFR6wKnKW3LomuLjSFrW42k8/VbUSkYO4wNjyxFN191ca0stNYl1pNdqAU1Jt/kHkXT5J2xnmcDlnF53teVOsO2putVRwIlmE5AHznFfgoTnmo8h9JwATEIO7uLtH6pLUrd+aIGw9SSlkn3bAHyJJ8TDWJlGHb0cYAc7QAefsr5XZBlaLngro7Nukjt/wB0fZHVkKeo9Pe7xRfyr0mY+cEnPMAkKVnOdgeZxNpCRgbRQbRteRsu3ZGi0xvupOUbDaR1UeqiepJJJPiYuADAhrCwDDtDTqdTzVkUfRt5rmEIQ4mAuOscxx1jmBcWqv4c38Sftrf7BGquNqnw5v4k/bW/2CNVcCF+qiEIQLpSEIQLiQhCBC+TjaXUlK0hSSMEHqIhH2g9HJjTS4EV+iJeRQZl3jbU1kGSezkIyNwMjKDtjGOYBM4YpNeoMncNIm6dUpdM5JTSC260obKB/UQdwRuCARvCeJgbO2lL7HgqZYhI2m6xboDrazqdSfi+orQ3ckmgd8j5vpCNvlE+fIKA5HcbEAeq/uzdaV/1NypPtzFMnnFcTrlPKU96epIUlQyepABJ3OTEZNSbArfZ/v2VnKa86JYOF2mz46gc219MgHBHIg5xg4iVujer9P1WoQdBTLVZkATkiTuk/lozuUE8jzB2O+5Uw8nSkwzt6w47/wB/hUMeXjI/Ueap+lDFl2NXKlYdt9/8bSiBNTzj6DxOY4BuogA4C04AGADkbk5s3tEzl72vXJCrStzTNMtGZcblXlyLIUqSV1UpOQV53III5YwNuKtavadXBK3bJagWOjjr8qnu5yQJ9WbbAwMDIKthgpyCQARggZx9e96X7rtTJe0pGypqiBbyFzj00F4BSdslSUhsA7kHJOAB4GEr8rXR5SCDagNCNtPNdc7qltCDtSt/DzVyvdld+5ptiq1W/wCerLpShTcyJYcXBzTwrLiiBvkEcs5ESCkpX0SVYZC3HAykJ43TxLXgAZJ6k4yT4xZE1etC0klLUtqszEyhtcoiUaqTjJEuC0hKAXF8klWM9cczgbxfzKwoDhUFA7hQOQR4w7BFFGTlbQ73JPmr2BrPt13VOrdHkLkpk1S6lKNzslMp4HWHdwoc/aCDggjBBGQcgRDPWvs51DTlbtVoyXKjbZOTgZelPJwDmjwUB5HBwTm+9tb63pjqMZW4qJwWhN4TJzsr668jHEsnkTk7oIBAAIJ65kptQla/S5eclnUzMnNNhxp0D1VpUMg79CDyMUSxxYyrTZw8R7gql7WYirSLjx/0tddjai1vTmqmfos4WScd6wRlp0eCgdj5HmOY3i8dUdY5HWSTpBrUnMUio07jwqR4X23grBPqqWkpI4Rjc9eeRjLOsvZSaqSpis2WhuVmV5W9SSQlpZ58TROyTn8E4G+xSBgxTn5CYpM49JT0u5KzbKihyXfbKVJUPEEAg+0RjSCbDtMLrtPh3HUdiznCSEGM6HwWV6t2kKwi1ZO2bfb+KaXKy6ZQTBVxTTiAkDcgAJJ64A9sYmeeUpxS1qKlEk5Jz7STHyA3zjEck7wpLNJJQSGoGg2Cpc97xRxVw6c1yXtu+KHVJvjEtJTbbzuN14SoE4GRk46Zjx3TUGazctanZfPo8zOPPN5GDhSyRt0ODvFJhFWYllOdUVo2iy7aU1QZXReTXcMrOTVO+ypXqSTyWz/c7ZOeIEkYyMAgnoRFxzVIr9RuDUF9c1PVCWcRKutU6gpShc/JqUSwWiQspZQgAEIBOcAjYmMACO7bq2VhSFqQobgpOCPeIYGIsAW6c+RHDmrmy5QBT5QqTlBbdp1f0nJln5Kdl26yO4mZoTD7GGlEIcVgYIByEkAgHBA5Ri22qvP1zSfUP0+cengyafMIE0srKXC/wlYJJIJBIJHMc4xkTkxxA6etg3jvxAHDkoOlrtx9AFJN2vVGb7V7tPcnn3JJwmUVLcZ7ss+inKODOCCTkjHPfnvFKsObkJBWiz9RU01Lp+MwHHSAhLnfOBsnIIGHCk5IIB36RgGES/U3JpqSfEg08vNTEl603r5g/hZqur06h6d3JJ1C365JNz02wEv3DU0vL9ISskrYR3CCslHEFLBxgjc7A29pM5JM2rf66giYfkvi1jvEyriW3Mekt4wshQG+Ccg7ZHmMdF1bnBxr4+H2nbwGeQjqtZWcn3COdL1w5o2I23ryHHguZxmDhwp6+6z9JyM1WLjtOYtufdpdu/Er6KahjgXMBxDZ9Jl/WABmXFk+sAMhQI2AEF056Q00fYmqRVaRivU95uXrM6Hn/W7wFfAW0FAOCM4AJBwdjEf45++eutfHxfr8zE24gXq25rva4A4W7l3pWi1PlOxSAFfqNQ1+vORmp2YeknmqpLmWdcJbLaGXOBPCdsApBG2xHti2rwuarUml6XtSdSmJRpmmpfQGneBIcMw4CrAOCSABv026mMRqVjYe8wjhmJa8bkk68SD+EdNWtPlwfwpG3MKfTqldSp1tpulovuRdmkfgd3hwuZGNwRkkY3hdnplMmNRZ6YodYVIz8s80Z+pVdHoD3eLBYcYSJcBRB4SgBZwAQSBkxHKPp3rndIRx+onPjjzwOkSOKF6N17OfJdOIF7fL8ua+cIQjPSqQhCBCQhCBCQhCBCQhGQ9KtEa9qrNccqj0KkIUO+qLueDzCBsVrA6AgDbJTkZtY1z3BrRUlWNa55o0VVp23bFTu+rNUujSLs7OO7JZZHIdSScBIGRkkgDqYmnov2fqfpg01UJ8tVK4lg8U1jKJfIwQ1kA7jYqIBIyNgSDdmnWmNC0xpLklR5fC14L827hT756FRGNh0SAAN8DJJPm1k1JGldkP1dCEzE0txMvKtLzguqBIKsb4CUqURtnGMjOR6SDCNwzTI+5F+Q7Oa04oOhHSO19FfcR27YxdbpNpzK0F2lNTyjNND5ilYSUA9MkB0DPiY+dS7PlZr1tzNwXVeVRRdQZVNDu3QiWlcJzwYAGAOpSQBvgHGTXNN5+R1q0ZlKLeE8y/UptLjO7yEzK+BZDbwTnPEMc8b8JzkE5nLI+ZpYW0JFRUjYix4bK97i9vRkUJFQsw0OoyVYpMnOU5xDki+0lbK2uXCRsABy26dIjt2oNPU2y/J6i26n4uq0tMJE0prAC1E+q7jlnOEnnkEZ5HNFo1Zv3sxTj9Kn6W5cdorWpbMwzkIRk5KgsA92TzLZGCckHck1WtXFc3agVJ0am0WZt+1EPJenp+bOePHJKTgAkZ2SM5OCSAIhJIJ4+iIIdsNweIPDmqnPDxlI63DmpC2tV03TatIqqmuET8kzNFvGQkrQF438MxUZ+flaVIPzs48mVlWElx153YISBkknwAj5U+QlLepUtJsYl5OTZS0ji5IbQnAyT0AHMxDntDa8Oah1A27QHCaCy6AtxAOZ1zO3LfgB5Dqdz0AanxAw8dXXOw4n2V8jxGKlUPWPVCp63XqxTqSy+unMu9zT5FOeJ1ZOO8UPyj0B5Db8omVWiWkcppTbKGSG3qxNALnpkDmrohP8lOSB4nJ2zgWf2b9C02FTEV6sMD7IZpHqtLG8o2fwR4LPU9BsOuc8lPWKMJC/8AzzfcfIfPJVRRE/uSb+ScPlHaEI1EykIQgXVx1jmOOscwIWqv4c38Sftrf7BGquNqnw5v4k/bW/2CNVcCF+qiEIQLpSEIQLiQhCBCQhCBCtq87Mpl929MUirsJelXxgFPzkK6KQd8KB5H3EEEgwiuq1bn7Ol/szEvMlrgKnJOfQCG5lrqlQzg7YCkE7cxsQTsCi2b4silag0B+kVqVS/KujKVj57SxyWk9CPoIyCCCRGficP0ozNs4aH58Comhzmosdire0h1hpmrVES7LqTL1VlIE5IE5U2fEeKCeR9xwYyKlGPbEArws+5+zpfLM5KTDjaUr4pKoIyEPI6pUNxnGykHPiMjBMqNG9b6PqrT0sFSJCvMpBmJAnZZ6rbJ+cnxHMddsEww+J6TqS2cPNVRSl5yusQr6uW2Kbd1JepdXlG56RfGFtOjr0IPMEcwQQQeRik0Ok0fSWyQwufmG6VTWlOKmZ90uLQ2N8Z8ByCQB0AGTveURn14fuPVHUKnadUph6SpgCJqamltK4Hk7HvM7BTaOQGd17cwkwxM7o+sLu0HOu3Yr3kNFd9AqNatLn+09qc7cVWacZsulL7qXlTyd3BDe2xJ2KyM4GBnBSRm++dY7R0zbRL1SfS3M4ATIyyO8cCcbZA2QMcskA9MxSb2q9N7P+j5bo7KW1y6RKyDa/WLj6snjXy4jspZ5ZwQMbRHrTOectxp+8rosCq3UqccL66zMI4kNIOSVpQoEKJJJKiQBsARuSgZP0rsgNXG5JBIHh5JckwkN/kbk/6UmLE1utLUaZ9EpVRKJ85+4plBbcIG5wDsdtyASQNyMR9dSdHbc1RlSiqyvdzyBwtVFj1X2+uM8lDyII3OME5iwa9p1auuFsytz2I9L0avMuBTM4wO4U26kglt9KASFgbggEg4IJB3zZSWJyVpcmzPPonJ5tpKHn0I4A4vABUAScZO+Mw81xkaRKARsRofYphpMgOYAjjsoH6naCXLpepcy80apR0napSqSUBOcDvE7ls8ueRk4BJjGkbPGZ+Tn35hpiZZmFy6uB9tCwpTZPRQG4OOhxtGGtSuyxbV4h2co4Fu1NW+GGgZdZ/lN7YzyykgdSCYyp/ppuYTXkfwfdIy4WnWjPcoUQi9b90duzTqYUmrU5Yks+rPy2XGFjOB64Hqk9AsA+UWWYxntcw5XCnakHNcw0cFxHMcRziKVBcQhCBCQhCBCQhCBCQhCBCQhCBcSEIQLqQhCBcSEIQLqQhHokZCaqk0iVkpV2amnfvbTDZWtZ8AkAkn2CBC88e6jUKo3HPokqXJPzs0797Yl2ytasczgcgBuSdgNztGddO+yNWq53c7dMwaJKnCvRGCFTK089+aG8g9ckEYIEScsjT+39O5H0Kh05qUbIw46PXdc/puHJO5OxOBnbA2jUhwD5busPPwTkWGe+7rDzWD9J+yQxJ9zVL2KZqYGFopTK/kwcbd4sH1iD+CDjbckEiJHycixISrUvKy7crLtgNoZaTwJQkbAADAA8gMRY2sGqrGllAamEMGoVedWWafIp5uLwMkgbkAkZA3JIAxnIwpdTuuVt28b2qNdalZdooW5TmyMsJUQBxtcHCQMgEZJGcncEjaBiwnUY0mgqaXoOZ/CdrHBUNBoNaflSxG0WRqzpvL6qWhMUZ9wyjgcD8vMYz3LqcgKxncEEgjI2J6x69OrtF62NRq8WS25OMBbjQJUErGQsJ5kjIOOZxFj0DUa6tSLtlfsZpgp9oycx92VOqNlDk4kZCkMo5jfODzBAyU7pLT3tc0B38tuIKZzteANQVjKr0jUOv3XTdK6pdzM1JKlA9OTEm0Ar0cZADmQkqJAxjJByCSdyKnrL2fbPsnTSZq9LD8jVKf3amppyYUszBKwAlQJxk8wUgEEA8siLr1d0ouecveRveyJxpmtMNBp2WeUEhwAEAgqyDkHhKTgYGQcxT5PR69tTanJzep1UaTS5RYdboUkQEOKH5ZTsPAkEkgkAp5xnOi+5uQkmwJuANrnSnik8urcpJOhOgHasmaPVio13TC3p+q8Sp56VTxrUCFODJAWc75UAFE9c5i73X0MtLccUhttGVKUtXCEgbkknkAOZjzvPU+3aYp19xmRkJRvdayEIbQkY9gAEQ5127RUzqI4ug293svb5VwLcCcOTp5cuYTnknmeZ6ANyTtw0YDzU0txKZfKIW9Y1K9faF7Qrl5vO21bUxihDZ+Zb+dOKHQdQ2D7ydztgG/Ozp2evscbYui5WCurKAXJySxtLj8tQP8IegPzRz35Oz32dU22hi5LqYC6qoJXKU9zcS3ULWOrnUDknmfW+bI4DELYbDvld+on12HBVRRucekk12HBcoTwjJjtAeccxrptIQhAhIQhAhcdY5jjrHMCFqr+HN/En7a3+wRqrjap8Ob+JP21v8AYI1VwIX6qIQhAulIQhAuJCEIEJCEIEJHEcwgQqFddq0q86K9S6vKIm5N0YLaxuCOSkkbpI6EbxCnVXRuu6I15qs02ZfdpiHAuUqjWzkurOyHMfNPQHkRywcgTyjw1GRlqrIuy04y3MyzyShxl5IKFg9CDtgwpicK2cV0OxVMkQk5FYO0O7TMneyGKNcbjNOruAluYJCWZw+XRKz+TyJ5YJwM+DBG4EQ+1v7Ls1bqn63aLa5qlAlbtNGVvS/m3zK0jw3I8xkj5aM9qObtdTFHuxTtRpCfk2p0ArmJcDovq4B9IHLOwhGLESQuEWKFDsdj84qhshYckvisq9rW2J65NMGn5Jtb/wAWziZt5pAJJb4FoJwN9uPJ8BknlFeoWvth1K0UVNdXk5BttnhcprpAeTgYKA3zVjkOEEEfVkKiVinXDTWJ+nzjU/JvjiQ80riSR4eRHIg7jkYsGq9nPT6sVNU+9b7TbqjxLbYecabUc5+YkgDPUADMNvjkDy6Ig1ArXloQR2q5wdWrKX4rGPZnq8rbVCvS66mtFGtianU+jJfUQlHCXCUoHU4WhIABJIwNxiPZU9UL010m5mlafSrtGoAV3cxXZrKFcPXhI+bnOwTlRGCSkZxk+/tHaDflpylvKS7SpSTIVK+gq4Q0rBA9XkrYnmM7nBBJjCFUq+o/ZnpIlXXZOuWupSmJOYUQO7cUFKTtniGCCSk5BAIBBOYTex0DQ1xIaBcjWuvcOxVPzRUbU5RqRr/QWZtJtFqFphLrmZRfxnWHgpqZqbu61kK3SkAkJAI3G5yNycRk48ojp2R52m/YzXJtVYM1WZmZ9Kn2XFKyynfhUc7Eq3USM5yAdxGcbeuek3VIido1QYqEqf4RhYVv4EcwfI4MPYZzXRBzQBXYGvzmmWUe0EW5KpuMIcCkqSFAjBB3yD5eEYfvvsvWbd3evyUuqgTysjvZFIDajtgqbO238nhJPMmK5rVZ7912t3zdxTFt/FalVAzDGfwUHckEEYBO4O2eR2iz+y5et23vR6o/XqiJ6nSriJeVdcbSHFLxlQKwBkAFO5BJJ57bwmLZZBC9la6G3fzCi4tLsjhrp82WEr47K95Wt3j1PZauCRTkh2R+/AA7ZbUQST4JKvbGJZ+Qm6VOKlZ6VelZlo4cZmEFCkY6FJAIPtEbEK1qzaFu1T4uqNwyEtOo+e0t4ZQfBWM4PkcR7KlRbdv+mNKnJSn12nqHyLjiEPJ32JQrfGfEEe2EJPp0biRG6hG2v9hJHCtc4lhvw1WtiETXufsjWZWAtdLXO0J47juHC4znxKF5J9gUBGKrh7GdzSJWuk1WRqrQ3CXuKXcX5YwofSsRnv8Ap8zRUCo5fKpZ+GkboPBR9hF/1vQXUCg5TMWzPuA8lSbYmdva2VY9+8WRO0uapkwtibl3pV5GymphsoUPaCARCLmOZ9zSO0Jcsc37gvPCEIrUUhCEC4kIQgXUhCK/RrDuSvevTqDUp5H+Fl5Va0Z81AED3mJBrnfaEUOwVAhGX6D2Vb/rnD38hL0lpSc5nplOfYQ3xkewgRky2+xVLp4HK9cLj53JZkGQjHhhxROR/kCHGYKd+jSO2yYbh3v0HjZRUi7LS0ruu9/95KJNTTCs/dH3tjbmO8UQnI8M58om3bGg1jWmUqlbfYmHxj7onszKjjfICyQk+YAjIYAAAAAA5AdIfi+l/wD9Xdw9z7JoYMj7j4KK9ldjNSu7mLprW3MydM9xGXVD3EBPsMSBtKwbesWUMvQqQzTkr2UtCcuL3z661EqVjpknHSPVetdXblm1uro4S5JSb0w3xeKUEgH3jEWpoRc1Zu/TiRrVbmvSJ2ddeVkoCAlKXFICQEgYHq+GepJjWijiw7sjG3IrXlpqnWMZEQALm6r+oV7Sendoz1enfXRL4w1kBTqyQEoGepJ8DgZONowxSaTq5q/JIrT1xt2ZRpn15SVlge8LahkKOMEgg5BKsnmAARFb7YdOfnNLJd9hHqSdSaee8k8DiQfpWB74t+n3Ldev0yKfadY+xO16fLy4mJxgHv1vKQFFCeEg4ScpwCBtkk5AFUzs0xZfQUANKk11NrCiqkcXPy32oBaqzJUdNKNWq7QKzUm1TdUo4wzMFZwogc1JJIOD6wPMEDfG0Wx2nquikaN1kZwucWzLN+ZKwSP+alUY3lqjd/Z91LolIq9feuW2K2oModmSeJC8hJI4iooKSpJIBIIPLPL1ds6slFPtSld0p9D0y5NLbGRxlASgAEA7nvFDbce+OSTNELzSjhYjmbA87KZeMjjSh0Pesu6WyKLP0ot1mdWiXblpBt15buEJbKk8a8knAAJO5i7ZKclqnKMzcs8iYln0Bxp1s8SVoUMhQPUEbgxHKT04v/Xd1qevebXbNtDC2qPLgJWR09Q54Tj8JeSOgAO0gLZt2QtShydIpbamJGVT3bSFKKtsknJUcnJJPv22i6B7nmuWjQKAnU92wUo3E6NoBpXXwVai3ryvSlWJR11SszYlJRHU81q6JSnqT0A9p2BIsnVzX6h6YSr0txip1wj1JFpf3snkXT+COuOZ6DG8RUQm9u0ZeZ4lqnZgbHmmVk2z06hI28ySOpiOJxgjpGy5O3uuOnAOUXVR1S1juPW6uNUemyrzNMW5wytKYyVvKzspzHNWNwOQ6dSc9aGdnKT0/QxWbgbbnriUOJpv5zcpnoOil+KuQ5DxN26S6IUbSunAtITP1lxPy1ReT658Qgb8CfIHJ2yTgYySSSRtFOHwhLullNXeQ+eAVTISTnean0XKEcIyecdoRzGqnEhCECEhCECEhCECFx1jmOOscwIWqv4c38Sftrf7BGquNqnw5v4k/bW/2CNVcCF+qiEIQISEIQISEIQISEIQISEIQISEIQISMIaxdmij6ipdqVKDVGuAjJWE/IzB/wCMSORP5QGfEGM3xxFUkTJhR4qoua14o4VWvyjXBfXZ4uRUq429TnFK43JCZyuWmEjbiT0I6BSSCOWeYiVWlXaEt/UtpuVUsUitqGFSEyoDjP8Axatgv2bHyxvF7XdZtGvqlLp1bkGp6WVuAses2fFBGCk+YIPuiKGqfZVrtpOOVK11O1unIPH6ONppoewYDmPEYPl1jJEc+BOZnWbw3Hzklcj4T1bjgpoRijVfRx7U66LcmpqpJFBp7ilTFN4T8pk5JBB3KsJSQcYGSDnYx+017UVx2O6KfcDTtepzR4CHjwzLAG2As/Ox4L32wCBEqbF1StrUeUD1EqLbzgGXJRZ4H2/6SDvjzGQehMOMxEOKGWvcbf7UhKyVtD4KoUazaLQXZ9VPpMpIioK4poMtBIf5gcQG3InbG+STuTFpN6E2xI3jKXDRhM0ObadC3WKa6ptiYHPgWgbAZxkDAI2IOYyalPU845hvomWFBbRNZWkLBHayvNdCsFmhyij6fWngzwp5hlJBXy33JSnHUExURTJjRbs6PtyQSipyNOLrjifwZhwjjVtz4SrY+CRFu3DYlfvztKyE1VaU61bFHbS7LvqwUO8BCgMgkZLigSk7lKdxtGXbur9uSaZeiXBOSzTda4pRErMnAfBScp8gRtkkDJAByQCm3rue9xp/EVtTn3nRKtaS50juwfO1YU0F0KtC49OJOtVqQFZnqmXHFuOvLBQAtSAlPCRg7ZJO+SRnEfPTNKtJe0JPWJT5x2YoNQZ75qWdVxlhwNFwewgAgnqCnOSAYqydA7i08E25aeoT1CoKuJ12Vn2krbYTjKlcROMgDdWAcAZJxmLI7NVvKr2rFxXc5OPVCn03vG0VGc+fMOOZAWc8vkwokdAQCTzhYAtLGtbRwNza4Gul781WG5aANoa68Rv8Ky7qNrdMW1dLFq27QnbluR1sOOMJc4G2kkEjJxucDJzgAEHO+Ip1P1/qFCrEnTL9tWZtUzS+7ang6Hpcq2+coDAGSMkE4yCQBvGPK5qZLSmtkxeFi0yfu1K5X0WqtS8sot4ASAptwAkbNjcpA9U4JCtvreV8znaZckrMolIXS+4mUzc4/PuIC2QkFB4W85OO8JON+QIAJMDp3FxIdU1pQCoI7aeJrZS6U/xdethSx+dqlHMvsyUs66+4lhhAKlOuqASkDqSdgIokre1sV170GWr1JqL7n96tTbbi1Dw4AST9EW7qJo/TNSmKLK1CdnmJSmkktMLx3wwBhWcjIKRvgnBIGM5jEGvehdkWNp8/WKW2/TKpLuNpYy+tQmFqWBwkKJwQOIgjBGM7w7LJKwFwaKAV1uez+1dIXNBNBQc1nuc0xtGpZXNWrR3lK/CckWifpxmKDM9nrTyez3tryaf8Upxv6kqAj06H1SqVvSi2pusl1yfdYOXXCeJxIWoIWSdySgJOTzznrF/8MSYyOZoOQXFbgbqQYxwqQPBYt/3Mmm3/AKNJ/wCnTP8A9yH+5h00P/7bH/Tpn/7kZRKcRjnWzU/+xVZi6iyhp+ovuBmTZd5KWdyogbkAAk8snAyM5gdFAxpcWC3Ieyi6ONrS4tHgF5G+zLpu0drYR/0yYI+guRW6dovYtPCg1aVJOORelUvEe9YMYpomkWo14Upis1rUmp0epzKQ8iSlAvgaBGwIS4gAkEZAG3LJioaMam3BKXvUtO71fE1WZPJlJwDHpCUjiOVbZyghQJAOAcknELtdHmAfHlroaDwNNCoNLQaObSulgsuop1uWRKrfRLUyhSo+c6lDUuj3nAH1x0ot+W5cjpZpVfptSe591KzSHFY55wCdvPEYIvCmSV59pZ+iXtMcNBYkEvUuVdeLbL6ylGRsRkkl3JyCSgDJAxFO12s+1rZdt1ViMtSd6GfQlmVpjxLi0YJyUgnGCE4JxzOcgHHOnLQ4hooDSlbnsFPDigyUBNBQGnNSJuy7abY9Cm6vVZj0aSlhlXVSzyCUjqSdgP6txhpnWnU+8pVVUtCwWTRBngdqLgLj4GclA7xGeWMAK32yTHHbHcm0ab0ZP8GupJD3Bnn3TmAPLnz8vCM32mmXbtakCSQG5USbIZQOieAY+rETe580pZmIAANqVJPbWwUiTI4tBoABpzWP9HtcZTU5ybps9JqotySZIfp7hIJAOCUggHY7EEZBxuemWIi/qxKf2P8AtMWdcUkEsN1VxpuYwNiSruXCem7agfaM84yrfdr35c9cSzR7plrdt5TSe8UzL8c0pzJ4gCcYGMEEKB3xjbJnHI4ZmvBJaaWpfnsFGNzrtNyDT2Xz7RtT+LNGbjczhTyG5cDx43UIP1Exi67p6l0jsu0ekOXAimVlUgxOMy7UweN4qPGUFCdykhR5jGcE8oyZdujkxcWk4s9Vfmpp9LqXU1GonvFqIcKzx4wVDBIAzkYG+0Umy+ypZ9spbdqTTtxTidyue2ZB8mxtjyUTFU0cskhyNH20qTpUmumq45rySQNRS50Vs6QarK1dpErY1Xt6ampFVNXKTtV+ejjCcIJIGEkgZCic8WMDrFv20bx7MVXqcg5br9z25OKS4xMyPEACMgKJAUEqIwCkgZOCCQMnI+i+ltd0wu67EAsC1Zt4OSSA6VOA8RKcDcABKiCSQSQNsbxmomIxQuLA55IcKitNtKcxuuNY5zQXmjhuoz0237x17v2iV24qM5bFtUZzvWJR8nvXVZBIwQCriKUgqIAAGBk5JkPOUuUqLzExMSjLzssriYcebC1NqxuUEglJPIkYMfeZmmJOWW9MvpYaQMrcdUEpQOpJOwHtjBGpXazoNthyTtpIr1R5GYJIlW/PIwXPYMA+MXZocM0mR1zck6nsHL8qwZIqucbnzWaa7X6fa1Mcn6tPsyEm2MKemFhAz0HmT4Dc9BEWdWu1nOVjvqbZwdp0nsFVR0YeWOvdjfgHmd/DBjHTEtqB2hq6VBb1UCDguLPdysrnfHRKdugBJA6mJK6UdmihWCGqlVQmuVwYIW8jLLB8G0HmQeSjv1ABhEzzYs5Im5W8Tr87FR0kktQ0UHFYQ0m7Nlc1DfTVriW9SqO6rviXhmZmcnPqhWcA8+MjfOQDzEvrVtGk2TRkUyiyLUhKoHzGk+spXUqJyVE9SSTFeSnIBI9g8I7Yh6DDxYcVaKnc7q6ONsYoNVwkHOSI7QhD4FFeEhCEcXUhCECEhCECEhCECFx1jmOOscwIWqv4c38Sftrf7BGquNqnw5v4k/bW/wBgjVXAhfqohCECEhCECEhCECEhCECEhCECEhCECEhCECFxHMIQIWNtStDbW1OQt+ekzK1HGEz8rhDgxy4hyWPaCcbAiIs3z2dry0xnPjSlF6qSjKi43PUzKH2R4lsHiSQOZBIA5kRO+EIT4OKa5FDxCXlhbJrY8QoXaf8Aa6uO3lNy1ysCvyY2MwCGplIHmBhePAgE9TEkbH1stHUENoplUQieUP7hmvkn8+HCdle1JI8481/6EWjqB3jk/TUSs+vcT8lht0n+VgYV7wT4ERHO9uyTdFud4/bzrVflBulsYZmAPNKjg48iSegHKFD+qwmnXb5+/qqf3of/ANDz+eKml+uLL1F0tt/UqmJlKzKKK292Zhg8LzRPPhVg7HqCCDzIyARD+3NdNRdK5xNOnJiYcQ1jNPrbSlnHgFKwtI8ACB5Rm2ze2PbtV7tqvyExQnlYHftfLsHzOAFD2AH2xcMZFL1X2O4OisbiGSdV9hwKK7Js3M8ElM3/AFh+goxin8B2A5AEuFII6Hg28IybO6dS1K0tqlqW0yiSS7IPS7HQrcWgjiWepJO5P6torNu3zb93oSqj1mSqRIzwMPBSx7U8x7wIuFIxDUUELASwaila1t23VnRtaSW7qMPZ81WoGn1tu2lcxVbtalZtxbnpTagHCo5ySAcEDA3wCAkgnOB5L6u2nX32gLIdslz0uoSryROT0skhK2wsFQJ24gGw4CeRBwD4SKuKx7fu0D44o0jUyNgqZZStQHkojI9xjrbth2/ZveGiUiVpy3BhbjDQCljOQCrmQOgJwIV/TyANjqMoIvS9vLvVJicQG1FBTtsqRqdqvRNK6N6XVXwqZcH3PINEd6+ryHQDqo7DzOAcSWzptcOudel7rv8ACpOhNkrp1CSSApOxBUDukHbJPrK8hiKrqZ2ZJu/LwnLllrsdk5pxSVNtLliruuAAJAWHAQARkYHM5jwq0+10t8E069JKpN/kTJ41n/2jZH1wSOe95EjCWjQChrzN/JTfUnrAkDQCl+32Ug5dhuXabbQgNtNpCUIbGAAOQAHIDkAI9cUi2hPpoFNFWKVVUSzfphbxwl7hHHjHTOcY2iztb9QqppzaUtUaPJMVCdfnmpRLUxkj1go+qkEFRJAAA33zggGNF7gxpcdAFfUNFSskRGntptL+JrVf/vVE06lz2lKCke8BUSLknHXpRhx9vu3loSVoBzwKIyRnyO2YtLVjTpjU6ypqivKDEwSHZV88mnk5wTjoQSk+RON8RTiYzJA5o4LkoLmEBXay63MNIeb9dtaApP6xEbbyHddsW2lSuzypdJeP/q3QoH2owI9dt3FrFp9SWbdds5mv+hpDEpPtujh4QMI4iDuABjJCTjGd4rmkOk9wtXxUL/vhxk3DOcSGJRrC/R04CM5BIBCBwgAnAJySTso5xxGUNaRQgmoIpTnx4UVDyX0ABBqCbaUVv6xn+yzrDSdOfueQlZdr0mYn1spU+TwlZQ2SMjbHIjJJJyAAfVdvZlt6z7XqFbt+q1akVelyrk0zO+lJBylBJCiAkjIBGQRjPUbRduq2hir8rknctErDtAuaSSEImm0+o4BnGSCCCMkZ3yNiCMYtia0Mv+9GvRbv1CL1MOOOXp7IT3uDnBwEDzBIIB3xEZIXFzi6PMSbGosNt7UUXNIc4ubUnQ/NKflcUNmf7RHZ1dlqiUu1tpxSGJh0ABx9ogpUegJBKCfMmKVo92gabZ1uItW9UzNHqtHzLJUWFrC2wcJSQkEhQG3LBABByYz9a1r06zaFJ0elS/o0jLJ4W05yTuSST1JJJPmY+lUtaiV11L1To0jPuo2S5MyqHFD2EgkRe2CQUex3WAoa3B9PFWtY4FprcCijoqae7R2sVBqdNp0wzalBUlxc7NtlIdUFhZAwSMkgADOQAScchKL525+iPhLyzMqylplpEu0kYShCcJA8ABsBHZ2YbYaW444llCPnKWcJA8ydhDEcXRAkmpJqTp8AVjGZK1N919oRi+6+0XYtphxtdXTU5sf3vTB3yj5cYwgHyKgYwZenbKrc/wB5L23TGaQycj0qZIfe9oTslJ8iFCKJcZDFq6/AXUXzMbqpaVOsSVBklzdSnWJGVR856ZcDaU+0kgRg2/e13btDDjFusO16bGQHzluXB8QSOJePAAA9DGA6fY2pOt06iecbn6kyeU9UXCiXQOvATgY8mwfZGbbB7HdIpYbmrqnTWJjmZOXy1L581bKV7uHzBhQ4ifEVEIoOJS3SSTGjRQcT891hGp3RqLr/AFhUo2ZiqBJBEjJfJy7QzsojIAAPIuEnzjMenPY9lZUtT15TQn3dlfF0qSGx5Lc2KvMDAz1IiQ9GoNPt+SbkqXIs0+WTyal0BtOfHAxk+J5mKqrZOBFkeCZXNIczueim3Dhpq41KplHo8jQZFuTpsozJSbYwlplAQB7ANs+J6xVByjrHeNEWTNEhCETqpJCEI6hIQhAhIQhAhIQhAhIQhAhcdY5jjrHMCFqr+HN/En7a3+wRqrjap8Ob+JP21v8AYI1VwIX6qIRxmGYELmEcZhmBC5hCECEhCECEhCECEhCECEhCECEhCECEhCECEhCECFQ6/alIuyV9ErFMlKizjZEy0HOA+KSRkHzGDGFrt7INsVYrXQZ2Yobyt+6V8ux/zVHiHt4jjwiQm0MxTLBHL97QfXxUHMa/7goM3B2Xb+tdZfkWWaqho5S9T5jC9uR4VcJz5DMU6nay6n6bvCVnZ+pI4dvRqyyVk+Xyg4gB5ERPfMeOfp8tUmSzOyrM4wf4N5sLSfaDkRnnABl4nFvzuShwoF2OIUVLf7atSa4RWLelptPVyReU0R54UFAnyyIyJRe1xY1UCRPGoUhR5mYl+MD2FsqJ+j3Rc9wdnWwLj4i7bzEm4f4WQUpjB8eFJCfpBjHdZ7FlAmCpVLr1QkFHkJhtD4H0cBx74jkxrNHB3zu9VzLiG6EH53LLFK1msasAei3VSwTyS9MBpR9y8H6ouyTqMpU2e9lJlibTz4mXAsfVmIh1XsYXRLcRptaps2kcg/xsLP0BQ+uLXnuzLqRSFd9L0f0jg372TnW8/QVg/QI7+rxEf3wk9nwrommb9zfD4VPDpFPnaTJ1JyVdmpJiYdlXO9ZccaSpTS8Y4kEglJxtkYMQVFs6w0Q/Iyt2y+P+CuvrH+YTHb7MtYaT98m7oYx/wlp0n/OSY5/5Gn3RkLv6n/s0qfA5RzEBv7M2rUr/AOV6oj/GyiT+tuH9nPVd3/y3UP8AoLefqbgP1SI/xPgPdd/VN/6lT4hkRAf+yfq3O/NqNdVn/BypH6kCOq5nWerfhXops/kCZQj34AEc/wDJNP2tJR+p4MKn1mKBVL1oFFJ+MK9TZL//ACJptB+siIS/2HNV7n++0iqPZ5+nTYR9PerEVin9kS/6hwmYTS6eOoemio//AAwqOjHSnSI99fZH6hx0YfncpH1ftI6eUgKCrgROKH8HJsrez70jh+kxjyt9tOiSwKaNQJ6fc6KnHUMJz44Txk/V7oo9I7E0w5wmq3MhrxblJUuZ/wAtShj6Iv2h9kSxqTwqnBP1hQ34Zl/gT7u7CTjyJMdEmNk0Ab87/RQzYh2wHzvWD7i7XV7VlKm6eZKhtqOEKlmeNzB8S4SPeAIt5izNVNW3ErfYrFSQd0uzzhbYx4jvCEgeQ+iJt29p7bVqoSaTQJCQWBjvm2E94favHEfeYueA4F8t55CeQ+fhSOHcR13k/PmyiLafYuqL/A9cdaZlEHcs09JccI8CtQASfYCIzbZ3Z+sWyihyUozc9NJ/vqoEvOZ8QD6oPmAIybHGIciwcEIs2/E3VjYY26NXRtsJA2AwMADkBH0hCG1ckcRzCBTSEIQISEIQISEIQISEIQISEIQISEIQISEIQISEIQIWqv4c38Sftrf7BGquNqnw5v4k/bW/2CNVcCFtU+3mfzJ/pX+5Q+3mfzJ/pX+5RquzHTMCFtU+3mfzJfpV+5Q+3mfzJfpV+5RqrhAhbVPt5n8yX6VfuUPt5n8yX6VfuUaq4QIW1T7eZ/Ml+lX7lD7eZ/Ml+lX7lGquECFtU+3mfzJfpV+5Q+3mfzJfpV+5RqrhAhbVPt5n8yX6VfuUPt5n8yX6VfuUaq4QIW1T7eZ/Ml+lX7lD7eZ/Ml+lX7lGquECFtU+3mfzJfpV+5Q+3mfzJfpV+5RqrhAhbVPt5n8yX6VfuUPt5n8yX6VfuUaq4QIW1T7eZ/Ml+lX7lD7eZ/Ml+lX7lGquECFtU+3mfzJfpV+5Q+3mfzJfpV+5RqrhAhbVPt5n8yX6VfuUPt5n8yX6VfuUaq4QIW1P7ed/Mn+lf7lD7eb/ADJ/pX+5RqshAhbU/t5ufxJ/pX+5Q+3m4/En+lf7lGqyECFtT+3mD+JIf+9X7lD7eZn8SY/96/3KNVkIELaofhygeeimf/8Aa/3KOB8OUBy0SH/vX+5RqszCBC2qfbzD/En+lf7lD7eYf4k/0r/co1VwgQtqn28w/wASf6V/uUPt5h/iT/Sv9yjVXCBC2qfbzD/En+lf7lD7eYf4k/0r/co1VwgQtqn28w/xJ/pX+5Q+3mn+JP8ASv8Aco1VwgQtqn280/xJ/pX+5Q+3mn+JP9K/3KNVcIELap9vNP8AEn+lf7lD7eaf4k/0r/co1VwgQtqn28w/xJ/pX+5Q+3mH+JP9K/3KNVcIELap9vMP8Sf6V/uUPt5h/iT/AEr/AHKNVcIELap9vMP8Sf6V/uUPt5h/iT/Sv9yjVXCBC2qfbzD/ABJ/pX+5Q+3mH+JP9K/3KNVcIELap9vMP8Sf6V/uUPt5h/iT/Sv9yjVXCBC2qfbzD/En+lf7lD7eYf4k/wBK/wByjVXCBC2qfbzD/En+lf7lD7eYf4k/0r/co1VwgQtqn28w/wASf6V/uUPt5h/iT/Sv9yjVXCBC2qfbzT/En+lf7lD7eaf4k/0r/co1VwgQpVduXtzf7tD7Cs2V9h/2N+m4xVfTvSPSO4/4lvg4fR/PPF0xvFWEIEL/2Q==" alt="โลโก้" style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%;" />
                    <div style="text-align: left;">
                      <div class="store-name">ร้านขนมไทยแทนคุณ</div>
                      <div class="store-phone">695 ม.4 ต.ดงมะไฟ อ.เมือง จ.สกลนคร</div>
                      <div class="store-phone">เบอร์โทรศัพท์ 083-1641982 , 080-4628068</div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            <table class="info-table" style="width: 100%;">
              <tr>
                <td class="info-left">
                  <div class="info-label">ชื่อลูกค้า</div>
                  <div class="customer-name">${invoice.customerName}</div>
                  ${invoice.customerAddress ? `<div class="customer-address" style="font-size: 14px; text-align: center; margin-top: 5px; padding: 0 10px;">${invoice.customerAddress}</div>` : ''}
                </td>
                <td class="info-right" style="flex-direction: column; gap: 8px;">
                  <div style="font-size: 16px; font-weight: bold;">${formattedDate}</div>
                  ${invoice.customerTaxId ? `<div style="font-size: 14px; font-weight: normal;">เลขประจำตัวผู้เสียภาษี<br/>${invoice.customerTaxId}</div>` : ''}
                </td>
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
                  <td colspan="2" style="text-align: center; font-weight: bold;">${invoice.totalAmountText || ''}</td>
                  <td class="total-label">รวมเงิน</td>
                  <td class="col-amount total-val">${Number(invoice.totalAmount).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 50px; text-align: right; padding-right: 20px;">
              <div style="font-size: 16px;">ผู้รับเงิน........................................................</div>
            </div>
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
    pdfUrl,
    invoice.customerAddress || "",
    invoice.customerTaxId || ""
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
        pdfUrl: invoiceRows[i][5] || "",
        customerAddress: invoiceRows[i][6] || "",
        customerTaxId: invoiceRows[i][7] || ""
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
