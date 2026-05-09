// ================================
// CORE UTILS
// ================================

function generateId(prefix) {
  const now = new Date();
  const timestamp = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyyMMddHHmmss"
  );
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${prefix}_${timestamp}_${random}`;
}

function nowISO() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseBoolean(value) {
  if (value === true) return true;
  const text = String(value || "").toLowerCase().trim();
  return text === "true" || text === "yes" || text === "1" || text === "on";
}

function slugifyKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatDateValue(value) {
  if (!value) {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

  const date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function getTodayDateString() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDaysToDate(value, days) {
  const date = toDateOnly(value);

  if (!date) {
    throw new Error("Ngày không hợp lệ");
  }

  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));

  return Utilities.formatDate(
    result,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function calculateDaysLeft(today, dueDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.ceil((dueDate.getTime() - today.getTime()) / oneDay);
}

function formatDateForClient(date) {
  if (!date) return "";

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// ================================
// SETTINGS HELPERS
// ================================

function getActiveSettings() {
  return getSheetRows(SHEETS.CORE_SETTINGS)
    .filter(row => String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED);
}

function findSettingByKey(settings, possibleKeys) {
  const keys = Array.isArray(possibleKeys) ? possibleKeys : [possibleKeys];
  const normalizedKeys = keys.map(key => String(key || "").toLowerCase().trim());

  return settings.find(row => {
    const settingId = String(row.setting_id || "").toLowerCase().trim();
    const settingKey = String(row.setting_key || "").toLowerCase().trim();
    const settingLabel = String(row.setting_label || "").toLowerCase().trim();

    return normalizedKeys.includes(settingId) ||
      normalizedKeys.includes(settingKey) ||
      normalizedKeys.includes(settingLabel);
  });
}

function getSettingValue(settings, possibleKeys, defaultValue = "") {
  const found = findSettingByKey(settings, possibleKeys);
  if (!found) return defaultValue;

  if (found.setting_value !== undefined && found.setting_value !== "") return found.setting_value;
  if (found.value !== undefined && found.value !== "") return found.value;
  if (found.extra_value !== undefined && found.extra_value !== "") return found.extra_value;
  if (found.extra !== undefined && found.extra !== "") return found.extra;

  return defaultValue;
}

function getSettingNumber(settings, possibleKeys, defaultValue = 0) {
  const found = findSettingByKey(settings, possibleKeys);
  if (!found) return defaultValue;

  const rawValue = found.setting_value !== undefined && found.setting_value !== ""
    ? found.setting_value
    : found.value;

  const numberValue = toNumber(rawValue);
  return isNaN(numberValue) ? defaultValue : numberValue;
}

function getSettingBoolean(settings, possibleKeys, defaultValue = false) {
  const found = findSettingByKey(settings, possibleKeys);
  if (!found) return defaultValue;
  return parseBoolean(found.setting_value);
}

function getNextSettingSortOrder(settings) {
  const max = settings.reduce((currentMax, row) => {
    const value = toNumber(row.sort_order);
    return value > currentMax ? value : currentMax;
  }, 0);

  return max + 1;
}

function upsertSettingByKey(settingKey, data) {
  const settings = getSheetRows(SHEETS.CORE_SETTINGS);
  const existing = settings.find(row => String(row.setting_key || "") === String(settingKey));

  const payload = {
    module: data.module || "finance",
    setting_type: data.setting_type || "config",
    setting_key: settingKey,
    setting_label: data.setting_label || settingKey,
    setting_value: data.setting_value !== undefined ? data.setting_value : "",
    parent_key: data.parent_key || "",
    extra_value: data.extra_value || "",
    status: data.status || STATUS.ACTIVE,
    sort_order: data.sort_order || getNextSettingSortOrder(settings),
    note: data.note || ""
  };

  if (existing) {
    updateRowById(SHEETS.CORE_SETTINGS, "setting_id", existing.setting_id, payload);
    return Object.assign({}, existing, payload);
  }

  const newSetting = Object.assign({
    setting_id: data.setting_id || generateId("CFG")
  }, payload);

  appendObjectRow(SHEETS.CORE_SETTINGS, newSetting);
  return newSetting;
}
