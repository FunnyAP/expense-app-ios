// ================================
// FINANCE MODULE
// Xử lý nghiệp vụ app Thu Chi
// ================================

function financeGetData() {
  const transactions = getSheetRows(SHEETS.FINANCE_TRANSACTIONS)
    .filter(row => String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED);

  const plans = getSheetRows(SHEETS.FINANCE_PLANS)
    .filter(row => String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED);

  const settings = getActiveSettings();
  const summary = getSheetRows(SHEETS.CORE_SUMMARY);

  const calculated = calculateFinanceData(transactions, plans, settings);

  return {
    ...calculated,
    raw: {
      transactions: transactions,
      plans: plans,
      settings: settings,
      summary: summary
    }
  };
}

// ================================
// DAILY JOBS - dùng bởi Core_Scheduler
// ================================

function financeRunDailyJobs(options) {
  const vndFundResult = financeAutoCheckVndFund(options || {});

  return {
    module: "finance",
    vndFund: vndFundResult
  };
}

function financeAutoCheckVndFund(options) {
  const settings = getActiveSettings();
  const autoEnabled = getSettingBoolean(settings, [
    "vnd_fund_auto_enabled",
    "CFG_VND_FUND_AUTO_ENABLED"
  ], true);

  if (!autoEnabled && !options.force) {
    return {
      ran: false,
      reason: "Hũ tiết kiệm VNĐ đang tắt tự động."
    };
  }

  const amount = getSettingNumber(settings, [
    "vnd_fund_monthly_add",
    "CFG_VND_FUND_MONTHLY_ADD"
  ], 0);

  let balance = getSettingNumber(settings, [
    "vnd_fund_balance",
    "CFG_VND_FUND_BALANCE"
  ], 0);

  const cycleDays = getSettingNumber(settings, [
    "vnd_fund_cycle_days",
    "CFG_VND_FUND_CYCLE_DAYS"
  ], 30);

  let nextDate = getSettingValue(settings, [
    "vnd_fund_next_date",
    "CFG_VND_FUND_NEXT_DATE"
  ], "");

  if (!nextDate) {
    return {
      ran: false,
      reason: "Chưa cấu hình ngày nhận tiếp theo cho hũ tiết kiệm."
    };
  }

  if (amount <= 0) {
    return {
      ran: false,
      reason: "Số tiền nhận mỗi kỳ chưa hợp lệ."
    };
  }

  if (cycleDays <= 0) {
    return {
      ran: false,
      reason: "Chu kỳ nhận tiền chưa hợp lệ."
    };
  }

  const today = toDateOnly(new Date());
  let dueDate = toDateOnly(nextDate);

  if (!dueDate || dueDate.getTime() > today.getTime()) {
    return {
      ran: false,
      reason: "Chưa tới ngày nhận tiền.",
      nextDate: nextDate
    };
  }

  const existingTransactions = getSheetRows(SHEETS.FINANCE_TRANSACTIONS)
    .filter(row => String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED);

  const created = [];
  let loopGuard = 0;

  while (dueDate && dueDate.getTime() <= today.getTime() && loopGuard < 24) {
    const dueDateString = formatDateForClient(dueDate);

    const alreadyExists = existingTransactions.some(tx => {
      const source = String(tx.source || "").toLowerCase();
      const date = formatDateValue(tx.transaction_date || tx.created_at);

      return source === SOURCES.VND_FUND_AUTO && date === dueDateString;
    });

    if (!alreadyExists) {
      const transaction = createVndFundTransaction({
        amount: amount,
        transaction_date: dueDateString,
        note: "Tự động cộng tiền hũ tiết kiệm VNĐ",
        source: SOURCES.VND_FUND_AUTO
      });

      created.push(transaction);
      existingTransactions.push(transaction);
      balance += amount;
    }

    nextDate = addDaysToDate(dueDateString, cycleDays);
    dueDate = toDateOnly(nextDate);
    loopGuard++;
  }

  upsertSettingByKey("vnd_fund_balance", {
    setting_id: "CFG_VND_FUND_BALANCE",
    module: "finance",
    setting_type: "config",
    setting_label: "Số dư hũ tiết kiệm VNĐ",
    setting_value: balance,
    sort_order: 3
  });

  upsertSettingByKey("vnd_fund_next_date", {
    setting_id: "CFG_VND_FUND_NEXT_DATE",
    module: "finance",
    setting_type: "config",
    setting_label: "Ngày nhận tiếp theo của hũ tiết kiệm",
    setting_value: nextDate,
    sort_order: 6
  });

  if (created.length > 0) {
    writeAuditLog(
      "finance.auto_check_vnd_fund",
      SHEETS.FINANCE_TRANSACTIONS,
      "vnd_fund_auto",
      null,
      { created: created.length, balance: balance, nextDate: nextDate },
      "Daily job tự động cộng hũ tiết kiệm VNĐ"
    );
  }

  return {
    ran: true,
    createdCount: created.length,
    created: created,
    balance: balance,
    nextDate: nextDate
  };
}

// ================================
// 1. ADD TRANSACTION - Thêm giao dịch nhanh
// ================================

function financeAddTransaction(data) {
  const type = normalizeTypeValue(data.type || data.transType);
  const amount = toNumber(data.amount);

  if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) {
    throw new Error("Loại giao dịch không hợp lệ. Chỉ nhận income hoặc expense.");
  }

  if (amount <= 0) {
    throw new Error("Số tiền phải lớn hơn 0.");
  }

  const categoryInfo = ensureFinanceCategory({
    type: type,
    categoryKey: data.category_key,
    categoryName: data.category_name || data.category,
    poolKey: data.pool_key,
    poolName: data.pool_name || data.pool,
    createIfMissing: data.create_category_if_missing || data.isNewCategory
  });

  const transactionId = generateId("TX");

  const transaction = {
    transaction_id: transactionId,
    module: "finance",
    created_at: nowISO(),
    transaction_date: formatDateValue(data.transaction_date || data.date),
    type: type,
    amount: amount,
    currency: data.currency || "AUD",
    category_key: categoryInfo.category_key,
    category_name: categoryInfo.category_name,
    pool_key: type === TYPES.EXPENSE ? categoryInfo.pool_key : "",
    pool_name: type === TYPES.EXPENSE ? categoryInfo.pool_name : "",
    note: data.note || "",
    source: data.source || SOURCES.MANUAL,
    ref_plan_id: data.ref_plan_id || "",
    status: STATUS.ACTIVE,
    updated_at: nowISO()
  };

  appendObjectRow(SHEETS.FINANCE_TRANSACTIONS, transaction);

  writeAuditLog(
    "finance.add_transaction",
    SHEETS.FINANCE_TRANSACTIONS,
    transactionId,
    null,
    transaction,
    "Thêm giao dịch nhanh"
  );

  return {
    transaction: transaction,
    categoryCreated: categoryInfo.created || false,
    data: financeGetData()
  };
}

// ================================
// 2. ADD CATEGORY - Tạo danh mục nhanh
// ================================

function financeAddCategory(data) {
  const type = normalizeTypeValue(data.type);
  const categoryName = normalizeText(data.category_name || data.category);

  if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) {
    throw new Error("Loại danh mục không hợp lệ.");
  }

  if (!categoryName) {
    throw new Error("Tên danh mục không được để trống.");
  }

  const result = ensureFinanceCategory({
    type: type,
    categoryKey: data.category_key,
    categoryName: categoryName,
    poolKey: data.pool_key,
    poolName: data.pool_name,
    createIfMissing: true
  });

  return {
    category: result,
    data: financeGetData()
  };
}

// ================================
// 3. ADD PLAN - Thêm khoản countdown
// ================================

function financeAddPlan(data) {
  const type = normalizeTypeValue(data.type);
  const title = normalizeText(data.title);
  const amount = toNumber(data.amount);

  if (!title) {
    throw new Error("Tên khoản sắp tới không được để trống.");
  }

  if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) {
    throw new Error("Loại khoản sắp tới không hợp lệ.");
  }

  if (amount <= 0) {
    throw new Error("Số tiền phải lớn hơn 0.");
  }

  if (!data.due_date) {
    throw new Error("Ngày đến hạn không được để trống.");
  }

  const categoryInfo = ensureFinanceCategory({
    type: type,
    categoryKey: data.category_key,
    categoryName: data.category_name || data.category,
    poolKey: data.pool_key,
    poolName: data.pool_name,
    createIfMissing: data.create_category_if_missing || false
  });

  const planId = generateId("PL");
  const isRecurring = parseBoolean(data.is_recurring);
  const cycleDays = toNumber(data.cycle_days);
  const dueDate = formatDateValue(data.due_date);

  const nextDueDate = isRecurring && cycleDays > 0
    ? addDaysToDate(dueDate, cycleDays)
    : "";

  const plan = {
    plan_id: planId,
    module: "finance",
    title: title,
    type: type,
    amount: amount,
    currency: data.currency || "AUD",
    category_key: categoryInfo.category_key,
    category_name: categoryInfo.category_name,
    pool_key: type === TYPES.EXPENSE ? categoryInfo.pool_key : "",
    pool_name: type === TYPES.EXPENSE ? categoryInfo.pool_name : "",
    due_date: dueDate,
    days_left: "",
    status: STATUS.ACTIVE,
    is_recurring: isRecurring,
    repeat_type: data.repeat_type || (isRecurring ? "custom" : "none"),
    cycle_days: cycleDays,
    priority: data.priority || "normal",
    auto_create_transaction: data.auto_create_transaction !== false,
    last_confirmed_at: "",
    next_due_date: nextDueDate,
    note: data.note || "",
    created_at: nowISO(),
    updated_at: nowISO()
  };

  appendObjectRow(SHEETS.FINANCE_PLANS, plan);

  writeAuditLog(
    "finance.add_plan",
    SHEETS.FINANCE_PLANS,
    planId,
    null,
    plan,
    "Thêm khoản countdown"
  );

  return {
    plan: plan,
    data: financeGetData()
  };
}

// ================================
// 4. UPDATE PLAN - Sửa khoản countdown
// ================================

function financeUpdatePlan(data) {
  const planId = data.plan_id;

  if (!planId) {
    throw new Error("Thiếu plan_id.");
  }

  const plans = getSheetRows(SHEETS.FINANCE_PLANS);
  const oldPlan = plans.find(plan => String(plan.plan_id) === String(planId));

  if (!oldPlan) {
    throw new Error("Không tìm thấy khoản countdown cần sửa.");
  }

  const updateData = {
    updated_at: nowISO()
  };

  const allowedFields = [
    "title",
    "type",
    "amount",
    "currency",
    "category_key",
    "category_name",
    "pool_key",
    "pool_name",
    "due_date",
    "status",
    "is_recurring",
    "repeat_type",
    "cycle_days",
    "priority",
    "auto_create_transaction",
    "next_due_date",
    "note"
  ];

  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  });

  if (data.due_date !== undefined) {
    updateData.due_date = formatDateValue(data.due_date);
  }

  if (data.amount !== undefined) {
    updateData.amount = toNumber(data.amount);
  }

  if (data.cycle_days !== undefined) {
    updateData.cycle_days = toNumber(data.cycle_days);
  }

  if (data.is_recurring !== undefined) {
    updateData.is_recurring = parseBoolean(data.is_recurring);
  }

  const willBeRecurring = updateData.is_recurring !== undefined
    ? updateData.is_recurring
    : parseBoolean(oldPlan.is_recurring);

  const finalCycleDays = updateData.cycle_days !== undefined
    ? toNumber(updateData.cycle_days)
    : toNumber(oldPlan.cycle_days);

  const finalDueDate = updateData.due_date || oldPlan.due_date;

  if (willBeRecurring && finalCycleDays > 0) {
    updateData.next_due_date = addDaysToDate(finalDueDate, finalCycleDays);
  }

  updateRowById(
    SHEETS.FINANCE_PLANS,
    "plan_id",
    planId,
    updateData
  );

  writeAuditLog(
    "finance.update_plan",
    SHEETS.FINANCE_PLANS,
    planId,
    oldPlan,
    updateData,
    "Sửa khoản countdown"
  );

  return {
    plan_id: planId,
    updated: updateData,
    data: financeGetData()
  };
}

// ================================
// 5. DELETE PLAN - Xóa mềm khoản countdown
// ================================

function financeDeletePlan(data) {
  const planId = data.plan_id;

  if (!planId) {
    throw new Error("Thiếu plan_id.");
  }

  const plans = getSheetRows(SHEETS.FINANCE_PLANS);
  const oldPlan = plans.find(plan => String(plan.plan_id) === String(planId));

  if (!oldPlan) {
    throw new Error("Không tìm thấy khoản countdown cần xóa.");
  }

  const updateData = {
    status: STATUS.DELETED,
    updated_at: nowISO()
  };

  updateRowById(
    SHEETS.FINANCE_PLANS,
    "plan_id",
    planId,
    updateData
  );

  writeAuditLog(
    "finance.delete_plan",
    SHEETS.FINANCE_PLANS,
    planId,
    oldPlan,
    updateData,
    "Xóa mềm khoản countdown"
  );

  return {
    plan_id: planId,
    deleted: true,
    data: financeGetData()
  };
}

// ================================
// 6. CONFIRM PLAN - Xác nhận đã thu/chi từ countdown
// ================================

function financeConfirmPlan(data) {
  const planId = data.plan_id;

  if (!planId) {
    throw new Error("Thiếu plan_id.");
  }

  const plans = getSheetRows(SHEETS.FINANCE_PLANS);
  const plan = plans.find(row => String(row.plan_id) === String(planId));

  if (!plan) {
    throw new Error("Không tìm thấy khoản countdown.");
  }

  if (String(plan.status || "").toLowerCase() === STATUS.DELETED) {
    throw new Error("Khoản countdown này đã bị xóa.");
  }

  const amount = data.amount !== undefined
    ? toNumber(data.amount)
    : toNumber(plan.amount);

  if (amount <= 0) {
    throw new Error("Số tiền xác nhận phải lớn hơn 0.");
  }

  const transactionId = generateId("TX");

  const transaction = {
    transaction_id: transactionId,
    module: "finance",
    created_at: nowISO(),
    transaction_date: formatDateValue(data.transaction_date || data.date),
    type: normalizeTypeValue(plan.type),
    amount: amount,
    currency: data.currency || plan.currency || "AUD",
    category_key: plan.category_key,
    category_name: plan.category_name,
    pool_key: plan.pool_key,
    pool_name: plan.pool_name,
    note: data.note || plan.note || "",
    source: SOURCES.PLAN_CONFIRM,
    ref_plan_id: planId,
    status: STATUS.ACTIVE,
    updated_at: nowISO()
  };

  appendObjectRow(SHEETS.FINANCE_TRANSACTIONS, transaction);

  const isRecurring = parseBoolean(plan.is_recurring);
  const cycleDays = toNumber(plan.cycle_days);

  let planUpdate = {
    last_confirmed_at: nowISO(),
    updated_at: nowISO()
  };

  if (isRecurring && cycleDays > 0) {
    const newDueDate = addDaysToDate(plan.due_date, cycleDays);
    const newNextDueDate = addDaysToDate(newDueDate, cycleDays);

    planUpdate.due_date = newDueDate;
    planUpdate.next_due_date = newNextDueDate;
    planUpdate.status = STATUS.ACTIVE;
  } else {
    planUpdate.status = STATUS.DONE;
  }

  updateRowById(
    SHEETS.FINANCE_PLANS,
    "plan_id",
    planId,
    planUpdate
  );

  writeAuditLog(
    "finance.confirm_plan",
    SHEETS.FINANCE_PLANS,
    planId,
    plan,
    {
      transaction: transaction,
      planUpdate: planUpdate
    },
    "Xác nhận khoản countdown và tạo giao dịch"
  );

  return {
    transaction: transaction,
    planUpdate: planUpdate,
    data: financeGetData()
  };
}

// ================================
// 7. TUITION - Đóng học phí riêng
// ================================

function financeAddTuitionPayment(data) {
  const amount = toNumber(data.amount);

  if (amount <= 0) {
    throw new Error("Số tiền học phí phải lớn hơn 0.");
  }

  const categoryInfo = ensureFinanceCategory({
    type: TYPES.EXPENSE,
    categoryKey: "tuition",
    categoryName: "Học phí",
    poolKey: "saving",
    createIfMissing: true
  });

  const transactionId = generateId("TX");

  const transaction = {
    transaction_id: transactionId,
    module: "finance",
    created_at: nowISO(),
    transaction_date: formatDateValue(data.transaction_date || data.date),
    type: TYPES.EXPENSE,
    amount: amount,
    currency: "AUD",
    category_key: categoryInfo.category_key,
    category_name: categoryInfo.category_name,
    pool_key: categoryInfo.pool_key,
    pool_name: categoryInfo.pool_name,
    note: data.note || data.description || "Đóng học phí",
    source: SOURCES.TUITION_PAYMENT,
    ref_plan_id: "",
    status: STATUS.ACTIVE,
    updated_at: nowISO()
  };

  appendObjectRow(SHEETS.FINANCE_TRANSACTIONS, transaction);

  writeAuditLog(
    "finance.add_tuition_payment",
    SHEETS.FINANCE_TRANSACTIONS,
    transactionId,
    null,
    transaction,
    "Thêm khoản đóng học phí"
  );

  return {
    transaction: transaction,
    data: financeGetData()
  };
}

// ================================
// 8. VND FUND - Hũ tiết kiệm VNĐ
// ================================

function financeUpdateVndFundConfig(data) {
  const settingsBefore = getActiveSettings();
  const oldConfig = calculateVndFundSummary(
    getSheetRows(SHEETS.FINANCE_TRANSACTIONS),
    settingsBefore
  );

  if (data.balance !== undefined) {
    upsertSettingByKey("vnd_fund_balance", {
      setting_id: "CFG_VND_FUND_BALANCE",
      module: "finance",
      setting_type: "config",
      setting_label: "Số dư hũ tiết kiệm VNĐ",
      setting_value: toNumber(data.balance),
      sort_order: 3
    });
  }

  if (data.amount !== undefined || data.monthlyAdd !== undefined || data.monthly_add !== undefined) {
    upsertSettingByKey("vnd_fund_monthly_add", {
      setting_id: "CFG_VND_FUND_MONTHLY_ADD",
      module: "finance",
      setting_type: "config",
      setting_label: "Số tiền nhận mỗi kỳ của hũ tiết kiệm",
      setting_value: toNumber(data.amount || data.monthlyAdd || data.monthly_add),
      sort_order: 4
    });
  }

  if (data.next_date !== undefined || data.nextDate !== undefined) {
    upsertSettingByKey("vnd_fund_next_date", {
      setting_id: "CFG_VND_FUND_NEXT_DATE",
      module: "finance",
      setting_type: "config",
      setting_label: "Ngày nhận tiếp theo của hũ tiết kiệm",
      setting_value: formatDateValue(data.next_date || data.nextDate),
      sort_order: 6
    });
  }

  if (data.cycle_days !== undefined || data.cycleDays !== undefined) {
    upsertSettingByKey("vnd_fund_cycle_days", {
      setting_id: "CFG_VND_FUND_CYCLE_DAYS",
      module: "finance",
      setting_type: "config",
      setting_label: "Chu kỳ nhận tiền hũ tiết kiệm theo ngày",
      setting_value: toNumber(data.cycle_days || data.cycleDays),
      sort_order: 7
    });
  }

  if (data.auto_enabled !== undefined || data.autoEnabled !== undefined) {
    upsertSettingByKey("vnd_fund_auto_enabled", {
      setting_id: "CFG_VND_FUND_AUTO_ENABLED",
      module: "finance",
      setting_type: "config",
      setting_label: "Tự động cộng hũ tiết kiệm",
      setting_value: parseBoolean(data.auto_enabled !== undefined ? data.auto_enabled : data.autoEnabled),
      sort_order: 8
    });
  }

  const settingsAfter = getActiveSettings();
  const newConfig = calculateVndFundSummary(
    getSheetRows(SHEETS.FINANCE_TRANSACTIONS),
    settingsAfter
  );

  writeAuditLog(
    "finance.update_vnd_fund_config",
    SHEETS.CORE_SETTINGS,
    "vnd_fund_config",
    oldConfig,
    newConfig,
    "Cập nhật cấu hình hũ tiết kiệm VNĐ"
  );

  return {
    vndFund: newConfig,
    data: financeGetData()
  };
}

function financeAddVndFundManualDeposit(data) {
  const amount = toNumber(data.amount);

  if (amount <= 0) {
    throw new Error("Số tiền nạp vào hũ phải lớn hơn 0.");
  }

  const transaction = createVndFundTransaction({
    amount: amount,
    transaction_date: formatDateValue(data.transaction_date || data.date),
    note: data.note || "Nạp thủ công vào hũ tiết kiệm VNĐ",
    source: SOURCES.VND_FUND_MANUAL
  });

  const settings = getActiveSettings();
  const currentBalance = getSettingNumber(settings, [
    "vnd_fund_balance",
    "CFG_VND_FUND_BALANCE"
  ], 0);

  const newBalance = currentBalance + amount;

  upsertSettingByKey("vnd_fund_balance", {
    setting_id: "CFG_VND_FUND_BALANCE",
    module: "finance",
    setting_type: "config",
    setting_label: "Số dư hũ tiết kiệm VNĐ",
    setting_value: newBalance,
    sort_order: 3
  });

  writeAuditLog(
    "finance.add_vnd_fund_manual_deposit",
    SHEETS.FINANCE_TRANSACTIONS,
    transaction.transaction_id,
    { balance: currentBalance },
    { transaction: transaction, balance: newBalance },
    "Nạp thủ công vào hũ tiết kiệm VNĐ"
  );

  return {
    transaction: transaction,
    balance: newBalance,
    data: financeGetData()
  };
}

function createVndFundTransaction(data) {
  const transactionId = generateId("TX");

  const transaction = {
    transaction_id: transactionId,
    module: "finance",
    created_at: nowISO(),
    transaction_date: formatDateValue(data.transaction_date || data.date),
    type: TYPES.INCOME,
    amount: toNumber(data.amount),
    currency: "VND",
    category_key: "vnd_fund",
    category_name: "Hũ tiết kiệm",
    pool_key: "",
    pool_name: "",
    note: data.note || "Nhận tiền hũ tiết kiệm VNĐ",
    source: data.source || SOURCES.VND_FUND_MANUAL,
    ref_plan_id: "",
    status: STATUS.ACTIVE,
    updated_at: nowISO()
  };

  appendObjectRow(SHEETS.FINANCE_TRANSACTIONS, transaction);
  return transaction;
}

// ================================
// CATEGORY / SETTING HELPERS
// ================================

function ensureFinanceCategory(input) {
  const type = normalizeTypeValue(input.type);
  const categoryName = normalizeText(input.categoryName || input.category_name);

  if (!categoryName && !input.categoryKey) {
    throw new Error("Thiếu danh mục giao dịch.");
  }

  const settingType = type === TYPES.INCOME
    ? "income_category"
    : "expense_category";

  const settings = getActiveSettings();

  const categoryKey = input.categoryKey
    ? slugifyKey(input.categoryKey)
    : slugifyKey(categoryName);

  const existingCategory = settings.find(row => {
    const rowType = String(row.setting_type || "").toLowerCase();
    const rowKey = String(row.setting_key || "").toLowerCase();
    const rowLabel = String(row.setting_label || "").toLowerCase();

    return rowType === settingType &&
      (
        rowKey === categoryKey ||
        rowLabel === String(categoryName || "").toLowerCase()
      );
  });

  if (existingCategory) {
    const poolInfo = type === TYPES.EXPENSE
      ? getPoolInfo(existingCategory.parent_key)
      : { pool_key: "", pool_name: "" };

    return {
      category_key: existingCategory.setting_key,
      category_name: existingCategory.setting_label,
      pool_key: poolInfo.pool_key,
      pool_name: poolInfo.pool_name,
      created: false
    };
  }

  if (!parseBoolean(input.createIfMissing)) {
    throw new Error("Danh mục chưa tồn tại. Cần tạo danh mục mới trước.");
  }

  let poolInfo = { pool_key: "", pool_name: "" };

  if (type === TYPES.EXPENSE) {
    poolInfo = getPoolInfo(input.poolKey || input.poolName);

    if (!poolInfo.pool_key) {
      throw new Error("Danh mục chi tiêu mới cần chọn Pool.");
    }
  }

  const settingId = generateId("CAT");

  const setting = {
    setting_id: settingId,
    module: "finance",
    setting_type: settingType,
    setting_key: categoryKey,
    setting_label: categoryName,
    setting_value: categoryName,
    parent_key: type === TYPES.EXPENSE ? poolInfo.pool_key : "",
    extra_value: "",
    status: STATUS.ACTIVE,
    sort_order: getNextSettingSortOrder(settings),
    note: "Tạo nhanh từ webapp"
  };

  appendObjectRow(SHEETS.CORE_SETTINGS, setting);

  writeAuditLog(
    "finance.add_category",
    SHEETS.CORE_SETTINGS,
    settingId,
    null,
    setting,
    "Tạo danh mục nhanh"
  );

  return {
    category_key: setting.setting_key,
    category_name: setting.setting_label,
    pool_key: type === TYPES.EXPENSE ? poolInfo.pool_key : "",
    pool_name: type === TYPES.EXPENSE ? poolInfo.pool_name : "",
    created: true
  };
}

function getPoolInfo(poolKeyOrName) {
  const value = slugifyKey(poolKeyOrName);

  if (!value) {
    return {
      pool_key: "",
      pool_name: ""
    };
  }

  const settings = getActiveSettings();

  const pool = settings.find(row => {
    const type = String(row.setting_type || "").toLowerCase();
    const key = slugifyKey(row.setting_key);
    const label = slugifyKey(row.setting_label);

    return type === "pool" && (key === value || label === value);
  });

  if (!pool) {
    return {
      pool_key: "",
      pool_name: ""
    };
  }

  return {
    pool_key: pool.setting_key,
    pool_name: pool.setting_label
  };
}
