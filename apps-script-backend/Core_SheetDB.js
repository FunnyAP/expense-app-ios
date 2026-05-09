// ================================
// CORE SHEET DATABASE SERVICE
// Có hỗ trợ sheet có dòng mô tả phía trên header
// ================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Không tìm thấy sheet: ${sheetName}`);
  }

  return sheet;
}

function getExpectedIdColumn(sheetName) {
  const map = {};
  map[SHEETS.FINANCE_TRANSACTIONS] = "transaction_id";
  map[SHEETS.FINANCE_PLANS] = "plan_id";
  map[SHEETS.CORE_SETTINGS] = "setting_id";
  map[SHEETS.CORE_SUMMARY] = "summary_id";
  map[SHEETS.CORE_AUDIT_LOG] = "log_id";

  return map[sheetName] || "";
}

function getHeaderInfo(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const expectedIdColumn = getExpectedIdColumn(sheetName);

  if (!expectedIdColumn) {
    throw new Error(`Chưa khai báo cột ID cho sheet: ${sheetName}`);
  }

  for (let i = 0; i < values.length; i++) {
    const row = values[i].map(cell => String(cell || "").trim());

    if (row.includes(expectedIdColumn)) {
      const headers = row.filter(header => header !== "");

      return {
        headerRowNumber: i + 1,
        dataStartRowNumber: i + 2,
        headers: headers
      };
    }
  }

  throw new Error(`Không tìm thấy header "${expectedIdColumn}" trong sheet ${sheetName}`);
}

function getSheetRows(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headerInfo = getHeaderInfo(sheetName);

  const headers = headerInfo.headers;
  const rows = [];

  for (let i = headerInfo.dataStartRowNumber - 1; i < values.length; i++) {
    const rowValues = values[i];
    const row = {};

    headers.forEach((header, index) => {
      row[header] = rowValues[index];
    });

    const isEmptyRow = headers.every(header => {
      return row[header] === "" || row[header] === null;
    });

    if (!isEmptyRow) {
      row.__rowNumber = i + 1;
      rows.push(row);
    }
  }

  return rows;
}

function appendObjectRow(sheetName, objectData) {
  const sheet = getSheet(sheetName);
  const headerInfo = getHeaderInfo(sheetName);
  const headers = headerInfo.headers;

  const row = headers.map(header => {
    return objectData[header] !== undefined ? objectData[header] : "";
  });

  sheet.appendRow(row);

  return objectData;
}

function updateRowById(sheetName, idColumn, idValue, newData) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headerInfo = getHeaderInfo(sheetName);
  const headers = headerInfo.headers;

  const idIndex = headers.indexOf(idColumn);

  if (idIndex === -1) {
    throw new Error(`Không tìm thấy cột ID: ${idColumn}`);
  }

  for (let i = headerInfo.dataStartRowNumber - 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(idValue)) {
      headers.forEach((header, colIndex) => {
        if (newData[header] !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(newData[header]);
        }
      });

      return true;
    }
  }

  throw new Error(`Không tìm thấy dòng có ${idColumn} = ${idValue}`);
}