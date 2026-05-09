// ================================
// CORE AUDIT LOG
// ================================

function writeAuditLog(action, targetTable, targetId, oldValue, newValue, note = "") {
  const logId = generateId("LOG");

  const payload = {
    log_id: logId,
    module: DEFAULT_MODULE,
    created_at: nowISO(),
    action: action,
    target_table: targetTable,
    target_id: targetId,
    old_value: oldValue ? JSON.stringify(oldValue) : "",
    new_value: newValue ? JSON.stringify(newValue) : "",
    note: note
  };

  appendObjectRow(SHEETS.CORE_AUDIT_LOG, payload);

  return payload;
}