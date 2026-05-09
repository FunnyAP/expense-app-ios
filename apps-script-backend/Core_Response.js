// ================================
// CORE RESPONSE
// ================================

function jsonSuccess(data, message = "success") {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      message: message,
      data: data
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message, details = null) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "error",
      message: message,
      details: details
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
