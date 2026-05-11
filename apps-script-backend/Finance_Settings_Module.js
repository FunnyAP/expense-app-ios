// ================================
// FINANCE SETTINGS MODULE
// Cài đặt riêng cho module Tài chính
// Không phải Settings chung toàn hệ thống
// ================================

// ================================
// PUBLIC ACTIONS - EXPENSE CATEGORY
// ================================

function financeSettingsAddExpenseCategory(data) {
  return financeSettingsAddCategory(data, "expense_category");
}

function financeSettingsUpdateExpenseCategory(data) {
  return financeSettingsUpdateCategory(data, "expense_category");
}

function financeSettingsDeleteExpenseCategory(data) {
  return financeSettingsDeleteCategory(data, "expense_category");
}

// ================================
// PUBLIC ACTIONS - INCOME CATEGORY
// ================================

function financeSettingsAddIncomeCategory(data) {
  return financeSettingsAddCategory(data, "income_category");
}

function financeSettingsUpdateIncomeCategory(data) {
  return financeSettingsUpdateCategory(data, "income_category");
}

function financeSettingsDeleteIncomeCategory(data) {
  return financeSettingsDeleteCategory(data, "income_category");
}

// ================================
// PUBLIC ACTIONS - POOL
// ================================

function financeSettingsUpdatePool(data) {
  const poolKey = slugifyKey(data.pool_key || data.setting_key || data.key);

  if (!poolKey) {
    throw new Error("Thiếu pool_key.");
  }

  const settings = financeSettingsGetAllSettings();
  const pool = financeSettingsFindSetting(settings, "pool", poolKey);

  if (!pool) {
    throw new Error("Không tìm thấy Pool cần sửa.");
  }

  const updateData = {};
  const oldPool = Object.assign({}, pool);

  if (data.pool_name !== undefined || data.setting_label !== undefined || data.name !== undefined) {
    const poolName = normalizeText(data.pool_name || data.setting_label || data.name);

    if (!poolName) {
      throw new Error("Tên Pool không được để trống.");
    }

    updateData.setting_label = poolName;
  }

  if (data.percent !== undefined || data.setting_value !== undefined || data.quota_percent !== undefined) {
    const nextPercent = toNumber(data.percent !== undefined ? data.percent : (data.setting_value !== undefined ? data.setting_value : data.quota_percent));

    if (nextPercent < 0 || nextPercent > 100) {
      throw new Error("Tỷ lệ Pool phải nằm trong khoảng 0 đến 100.");
    }

    const activePools = financeSettingsGetActivePools(settings);
    const finalTotal = activePools.reduce((sum, item) => {
      if (String(item.setting_key) === String(poolKey)) {
        return sum + nextPercent;
      }

      return sum + toNumber(item.setting_value);
    }, 0);

    if (Math.round(finalTotal) !== 100) {
      throw new Error(`Tổng tỷ lệ Pool hiện tại là ${finalTotal}%. Tổng tỷ lệ phải bằng 100%.`);
    }

    updateData.setting_value = nextPercent;
    updateData.extra_value = "%";
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("Không có dữ liệu Pool cần cập nhật.");
  }

  updateRowById(
    SHEETS.CORE_SETTINGS,
    "setting_id",
    pool.setting_id,
    updateData
  );

  writeAuditLog(
    "finance.settings.update_pool",
    SHEETS.CORE_SETTINGS,
    pool.setting_id,
    oldPool,
    updateData,
    "Cập nhật Pool tài chính"
  );

  return {
    pool_key: poolKey,
    updated: updateData,
    data: financeGetData()
  };
}

function financeSettingsUpdatePoolAllocations(data) {
  const settings = financeSettingsGetAllSettings();
  const activePools = financeSettingsGetActivePools(settings);

  if (!activePools.length) {
    throw new Error("Chưa có Pool nào để cập nhật.");
  }

  const allocationMap = financeSettingsNormalizeAllocationMap(data.allocations || data.pools || data);

  const finalPools = activePools.map(pool => {
    const poolKey = String(pool.setting_key || "").trim();
    const hasNewValue = allocationMap[poolKey] !== undefined;

    return {
      setting_id: pool.setting_id,
      setting_key: poolKey,
      setting_label: pool.setting_label,
      old_value: toNumber(pool.setting_value),
      new_value: hasNewValue ? toNumber(allocationMap[poolKey]) : toNumber(pool.setting_value)
    };
  });

  const total = finalPools.reduce((sum, pool) => sum + pool.new_value, 0);

  if (Math.round(total) !== 100) {
    throw new Error(`Tổng tỷ lệ Pool đang là ${total}%. Tổng tỷ lệ phải bằng 100%.`);
  }

  finalPools.forEach(pool => {
    if (pool.new_value < 0 || pool.new_value > 100) {
      throw new Error(`Tỷ lệ của Pool "${pool.setting_label}" không hợp lệ.`);
    }
  });

  const updated = [];

  finalPools.forEach(pool => {
    if (pool.old_value !== pool.new_value) {
      const updateData = {
        setting_value: pool.new_value,
        extra_value: "%"
      };

      updateRowById(
        SHEETS.CORE_SETTINGS,
        "setting_id",
        pool.setting_id,
        updateData
      );

      updated.push({
        pool_key: pool.setting_key,
        pool_name: pool.setting_label,
        old_value: pool.old_value,
        new_value: pool.new_value
      });
    }
  });

  writeAuditLog(
    "finance.settings.update_pool_allocations",
    SHEETS.CORE_SETTINGS,
    "pool_allocations",
    activePools.map(pool => ({
      pool_key: pool.setting_key,
      value: pool.setting_value
    })),
    finalPools.map(pool => ({
      pool_key: pool.setting_key,
      value: pool.new_value
    })),
    "Cập nhật tỷ lệ Pool tài chính"
  );

  return {
    total: total,
    updated: updated,
    data: financeGetData()
  };
}

// ================================
// PUBLIC ACTIONS - CONFIG
// ================================

function financeSettingsUpdateExchangeRate(data) {
  const exchangeRate = toNumber(
    data.exchange_rate ||
    data.exchangeRate ||
    data.rate ||
    data.setting_value
  );

  if (exchangeRate <= 0) {
    throw new Error("Tỷ giá AUD/VND phải lớn hơn 0.");
  }

  const oldSetting = financeSettingsFindSettingByKey("exchange_rate_aud_vnd");

  const setting = financeSettingsUpsertSettingByKey("exchange_rate_aud_vnd", {
    setting_id: "CFG_EXCHANGE_RATE_AUD_VND",
    module: "finance",
    setting_type: "config",
    setting_key: "exchange_rate_aud_vnd",
    setting_label: "Tỷ giá AUD/VND",
    setting_value: exchangeRate,
    parent_key: "",
    extra_value: "",
    status: STATUS.ACTIVE,
    sort_order: 2,
    note: "Cập nhật từ Finance Settings"
  });

  writeAuditLog(
    "finance.settings.update_exchange_rate",
    SHEETS.CORE_SETTINGS,
    setting.setting_id,
    oldSetting,
    setting,
    "Cập nhật tỷ giá AUD/VND"
  );

  return {
    exchangeRate: exchangeRate,
    setting: setting,
    data: financeGetData()
  };
}

function financeSettingsUpdateVndFundConfig(data) {
  const amount = toNumber(
    data.amount ||
    data.monthly_add ||
    data.monthlyAdd ||
    data.vnd_fund_monthly_add
  );

  const nextDate = normalizeText(
    data.next_date ||
    data.nextDate ||
    data.vnd_fund_next_date
  );

  const cycleDays = toNumber(
    data.cycle_days ||
    data.cycleDays ||
    data.vnd_fund_cycle_days ||
    30
  );

  const autoEnabled = data.auto_enabled !== undefined
    ? parseBoolean(data.auto_enabled)
    : (
      data.autoEnabled !== undefined
        ? parseBoolean(data.autoEnabled)
        : true
    );

  if (amount < 0) {
    throw new Error("Số tiền nhận mỗi kỳ không được nhỏ hơn 0.");
  }

  if (cycleDays <= 0) {
    throw new Error("Chu kỳ nhận tiền phải lớn hơn 0.");
  }

  const oldSettings = {
    monthlyAdd: financeSettingsFindSettingByKey("vnd_fund_monthly_add"),
    nextDate: financeSettingsFindSettingByKey("vnd_fund_next_date"),
    cycleDays: financeSettingsFindSettingByKey("vnd_fund_cycle_days"),
    autoEnabled: financeSettingsFindSettingByKey("vnd_fund_auto_enabled")
  };

  const monthlyAddSetting = financeSettingsUpsertSettingByKey("vnd_fund_monthly_add", {
    setting_id: "CFG_VND_FUND_MONTHLY_ADD",
    module: "finance",
    setting_type: "config",
    setting_key: "vnd_fund_monthly_add",
    setting_label: "Số tiền nhận mỗi kỳ của hũ tiết kiệm",
    setting_value: amount,
    parent_key: "",
    extra_value: "VND",
    status: STATUS.ACTIVE,
    sort_order: 4,
    note: "Cấu hình từ Finance Settings"
  });

  const nextDateSetting = financeSettingsUpsertSettingByKey("vnd_fund_next_date", {
    setting_id: "CFG_VND_FUND_NEXT_DATE",
    module: "finance",
    setting_type: "config",
    setting_key: "vnd_fund_next_date",
    setting_label: "Ngày nhận tiếp theo của hũ tiết kiệm",
    setting_value: nextDate ? formatDateValue(nextDate) : "",
    parent_key: "",
    extra_value: "",
    status: STATUS.ACTIVE,
    sort_order: 6,
    note: "Cấu hình từ Finance Settings"
  });

  const cycleDaysSetting = financeSettingsUpsertSettingByKey("vnd_fund_cycle_days", {
    setting_id: "CFG_VND_FUND_CYCLE_DAYS",
    module: "finance",
    setting_type: "config",
    setting_key: "vnd_fund_cycle_days",
    setting_label: "Chu kỳ nhận tiền hũ tiết kiệm theo ngày",
    setting_value: cycleDays,
    parent_key: "",
    extra_value: "days",
    status: STATUS.ACTIVE,
    sort_order: 7,
    note: "Cấu hình từ Finance Settings"
  });

  const autoEnabledSetting = financeSettingsUpsertSettingByKey("vnd_fund_auto_enabled", {
    setting_id: "CFG_VND_FUND_AUTO_ENABLED",
    module: "finance",
    setting_type: "config",
    setting_key: "vnd_fund_auto_enabled",
    setting_label: "Tự động cộng hũ tiết kiệm",
    setting_value: autoEnabled,
    parent_key: "",
    extra_value: "",
    status: STATUS.ACTIVE,
    sort_order: 8,
    note: "Cấu hình từ Finance Settings"
  });

  const newSettings = {
    monthlyAdd: monthlyAddSetting,
    nextDate: nextDateSetting,
    cycleDays: cycleDaysSetting,
    autoEnabled: autoEnabledSetting
  };

  writeAuditLog(
    "finance.settings.update_vnd_fund_config",
    SHEETS.CORE_SETTINGS,
    "vnd_fund_config",
    oldSettings,
    newSettings,
    "Cập nhật cấu hình hũ tiết kiệm từ Finance Settings"
  );

  return {
    vndFundConfig: {
      amount: amount,
      nextDate: nextDate ? formatDateValue(nextDate) : "",
      cycleDays: cycleDays,
      autoEnabled: autoEnabled
    },
    data: financeGetData()
  };
}

// ================================
// INTERNAL CATEGORY HANDLERS
// ================================

function financeSettingsAddCategory(data, settingType) {
  const categoryName = normalizeText(
    data.category_name ||
    data.categoryName ||
    data.name ||
    data.setting_label
  );

  if (!categoryName) {
    throw new Error("Tên danh mục không được để trống.");
  }

  const categoryKey = slugifyKey(
    data.category_key ||
    data.categoryKey ||
    data.setting_key ||
    categoryName
  );

  if (!categoryKey) {
    throw new Error("Không thể tạo mã danh mục.");
  }

  const settings = financeSettingsGetAllSettings();

  financeSettingsEnsureCategoryNotDuplicated(settings, settingType, categoryKey, categoryName);

  let parentKey = "";

  if (settingType === "expense_category") {
    parentKey = slugifyKey(data.pool_key || data.parent_key || data.poolKey);

    if (!parentKey) {
      throw new Error("Danh mục chi cần chọn Pool.");
    }

    financeSettingsValidatePool(parentKey, settings);
  }

  const settingId = generateId("CAT");
  const sortOrder = financeSettingsGetNextSortOrder(settings);

  const setting = {
    setting_id: settingId,
    module: "finance",
    setting_type: settingType,
    setting_key: categoryKey,
    setting_label: categoryName,
    setting_value: categoryName,
    parent_key: parentKey,
    extra_value: "",
    status: STATUS.ACTIVE,
    sort_order: sortOrder,
    note: "Tạo từ Finance Settings"
  };

  appendObjectRow(SHEETS.CORE_SETTINGS, setting);

  writeAuditLog(
    `finance.settings.add_${settingType}`,
    SHEETS.CORE_SETTINGS,
    settingId,
    null,
    setting,
    "Thêm danh mục từ Finance Settings"
  );

  return {
    category: financeSettingsFormatCategory(setting),
    data: financeGetData()
  };
}

function financeSettingsUpdateCategory(data, settingType) {
  const settings = financeSettingsGetAllSettings();
  const category = financeSettingsFindCategory(settings, settingType, data);

  if (!category) {
    throw new Error("Không tìm thấy danh mục cần sửa.");
  }

  const oldCategory = Object.assign({}, category);
  const updateData = {};

  const categoryName = data.category_name !== undefined ||
    data.categoryName !== undefined ||
    data.name !== undefined ||
    data.setting_label !== undefined
      ? normalizeText(data.category_name || data.categoryName || data.name || data.setting_label)
      : "";

  if (categoryName) {
    financeSettingsEnsureCategoryLabelNotDuplicated(
      settings,
      settingType,
      categoryName,
      category.setting_id
    );

    updateData.setting_label = categoryName;
    updateData.setting_value = categoryName;
  }

  if (settingType === "expense_category" && (
    data.pool_key !== undefined ||
    data.parent_key !== undefined ||
    data.poolKey !== undefined
  )) {
    const parentKey = slugifyKey(data.pool_key || data.parent_key || data.poolKey);

    if (!parentKey) {
      throw new Error("Danh mục chi cần chọn Pool.");
    }

    financeSettingsValidatePool(parentKey, settings);
    updateData.parent_key = parentKey;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("Không có dữ liệu danh mục cần cập nhật.");
  }

  updateRowById(
    SHEETS.CORE_SETTINGS,
    "setting_id",
    category.setting_id,
    updateData
  );

  writeAuditLog(
    `finance.settings.update_${settingType}`,
    SHEETS.CORE_SETTINGS,
    category.setting_id,
    oldCategory,
    updateData,
    "Cập nhật danh mục từ Finance Settings"
  );

  return {
    category_id: category.setting_id,
    updated: updateData,
    data: financeGetData()
  };
}

function financeSettingsDeleteCategory(data, settingType) {
  const settings = financeSettingsGetAllSettings();
  const category = financeSettingsFindCategory(settings, settingType, data);

  if (!category) {
    throw new Error("Không tìm thấy danh mục cần xóa.");
  }

  const oldCategory = Object.assign({}, category);

  const updateData = {
    status: STATUS.DELETED,
    note: category.note
      ? `${category.note} | Xóa mềm từ Finance Settings`
      : "Xóa mềm từ Finance Settings"
  };

  updateRowById(
    SHEETS.CORE_SETTINGS,
    "setting_id",
    category.setting_id,
    updateData
  );

  writeAuditLog(
    `finance.settings.delete_${settingType}`,
    SHEETS.CORE_SETTINGS,
    category.setting_id,
    oldCategory,
    updateData,
    "Xóa mềm danh mục từ Finance Settings"
  );

  return {
    category_id: category.setting_id,
    deleted: true,
    data: financeGetData()
  };
}

// ================================
// INTERNAL HELPERS
// ================================

function financeSettingsGetAllSettings() {
  return getSheetRows(SHEETS.CORE_SETTINGS);
}

function financeSettingsGetActiveSettings() {
  return financeSettingsGetAllSettings()
    .filter(row => String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED);
}

function financeSettingsFindSetting(settings, settingType, settingKeyOrId) {
  const value = String(settingKeyOrId || "").toLowerCase().trim();

  return settings.find(row => {
    const status = String(row.status || STATUS.ACTIVE).toLowerCase();
    const rowType = String(row.setting_type || "").toLowerCase();
    const rowKey = String(row.setting_key || "").toLowerCase();
    const rowId = String(row.setting_id || "").toLowerCase();

    return status !== STATUS.DELETED &&
      rowType === String(settingType || "").toLowerCase() &&
      (rowKey === value || rowId === value);
  });
}

function financeSettingsFindSettingByKey(settingKey) {
  const settings = financeSettingsGetAllSettings();
  const key = String(settingKey || "").toLowerCase().trim();

  return settings.find(row => {
    const rowKey = String(row.setting_key || "").toLowerCase().trim();
    const rowId = String(row.setting_id || "").toLowerCase().trim();
    return rowKey === key || rowId === key;
  }) || null;
}

function financeSettingsFindCategory(settings, settingType, data) {
  const idOrKey = String(
    data.setting_id ||
    data.category_id ||
    data.category_key ||
    data.setting_key ||
    data.key ||
    ""
  ).toLowerCase().trim();

  if (!idOrKey) {
    throw new Error("Thiếu mã danh mục.");
  }

  return settings.find(row => {
    const status = String(row.status || STATUS.ACTIVE).toLowerCase();
    const rowType = String(row.setting_type || "").toLowerCase();
    const rowId = String(row.setting_id || "").toLowerCase();
    const rowKey = String(row.setting_key || "").toLowerCase();

    return status !== STATUS.DELETED &&
      rowType === settingType &&
      (rowId === idOrKey || rowKey === idOrKey);
  });
}

function financeSettingsEnsureCategoryNotDuplicated(settings, settingType, categoryKey, categoryName) {
  const key = String(categoryKey || "").toLowerCase().trim();
  const label = String(categoryName || "").toLowerCase().trim();

  const duplicated = settings.find(row => {
    const status = String(row.status || STATUS.ACTIVE).toLowerCase();
    const rowType = String(row.setting_type || "").toLowerCase();
    const rowKey = String(row.setting_key || "").toLowerCase();
    const rowLabel = String(row.setting_label || "").toLowerCase();

    return status !== STATUS.DELETED &&
      rowType === settingType &&
      (rowKey === key || rowLabel === label);
  });

  if (duplicated) {
    throw new Error(`Danh mục "${categoryName}" đã tồn tại.`);
  }
}

function financeSettingsEnsureCategoryLabelNotDuplicated(settings, settingType, categoryName, ignoreSettingId) {
  const label = String(categoryName || "").toLowerCase().trim();
  const ignoreId = String(ignoreSettingId || "").toLowerCase().trim();

  const duplicated = settings.find(row => {
    const status = String(row.status || STATUS.ACTIVE).toLowerCase();
    const rowType = String(row.setting_type || "").toLowerCase();
    const rowLabel = String(row.setting_label || "").toLowerCase();
    const rowId = String(row.setting_id || "").toLowerCase();

    return status !== STATUS.DELETED &&
      rowType === settingType &&
      rowLabel === label &&
      rowId !== ignoreId;
  });

  if (duplicated) {
    throw new Error(`Tên danh mục "${categoryName}" đã tồn tại.`);
  }
}

function financeSettingsValidatePool(poolKey, settings) {
  const pool = financeSettingsFindSetting(settings, "pool", poolKey);

  if (!pool) {
    throw new Error("Pool không hợp lệ hoặc đã bị xóa.");
  }

  return pool;
}

function financeSettingsGetActivePools(settings) {
  return settings
    .filter(row => {
      const status = String(row.status || STATUS.ACTIVE).toLowerCase();
      const type = String(row.setting_type || "").toLowerCase();

      return status !== STATUS.DELETED && type === "pool";
    })
    .sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order));
}

function financeSettingsNormalizeAllocationMap(input) {
  const result = {};

  if (Array.isArray(input)) {
    input.forEach(item => {
      const key = String(item.pool_key || item.setting_key || item.key || "").trim();
      const value = item.percent !== undefined
        ? item.percent
        : (
          item.setting_value !== undefined
            ? item.setting_value
            : item.value
        );

      if (key) {
        result[key] = toNumber(value);
      }
    });

    return result;
  }

  Object.keys(input || {}).forEach(key => {
    const ignoredKeys = [
      "action",
      "module",
      "type",
      "setting_type",
      "setting_id"
    ];

    if (!ignoredKeys.includes(key)) {
      result[key] = toNumber(input[key]);
    }
  });

  return result;
}

function financeSettingsUpsertSettingByKey(settingKey, payload) {
  const settings = financeSettingsGetAllSettings();
  const key = String(settingKey || "").toLowerCase().trim();

  const existing = settings.find(row => {
    const rowKey = String(row.setting_key || "").toLowerCase().trim();
    const rowId = String(row.setting_id || "").toLowerCase().trim();

    return rowKey === key || rowId === key;
  });

  const normalizedPayload = Object.assign({
    module: "finance",
    parent_key: "",
    extra_value: "",
    status: STATUS.ACTIVE,
    note: ""
  }, payload);

  if (existing) {
    const updateData = Object.assign({}, normalizedPayload);
    delete updateData.setting_id;

    updateRowById(
      SHEETS.CORE_SETTINGS,
      "setting_id",
      existing.setting_id,
      updateData
    );

    return Object.assign({}, existing, updateData);
  }

  appendObjectRow(SHEETS.CORE_SETTINGS, normalizedPayload);

  return normalizedPayload;
}

function financeSettingsGetNextSortOrder(settings) {
  const max = settings.reduce((currentMax, row) => {
    const value = toNumber(row.sort_order);
    return value > currentMax ? value : currentMax;
  }, 0);

  return max + 1;
}

function financeSettingsFormatCategory(row) {
  return {
    setting_id: row.setting_id,
    category_key: row.setting_key,
    category_name: row.setting_label,
    setting_type: row.setting_type,
    pool_key: row.parent_key || "",
    status: row.status || STATUS.ACTIVE
  };
}