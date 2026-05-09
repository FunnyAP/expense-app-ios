// ================================
// FINANCE CALCULATION SERVICE
// Chứa toàn bộ phép tính chính của app Thu Chi
// ================================

function calculateFinanceData(transactions, plans, settings) {
  const activeTransactions = transactions.filter(row => {
    return String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED;
  });

  const activePlans = plans.filter(row => {
    const status = String(row.status || STATUS.ACTIVE).toLowerCase();
    return status !== STATUS.DELETED && status !== STATUS.DONE;
  });

  const activeSettings = settings.filter(row => {
    return String(row.status || STATUS.ACTIVE).toLowerCase() !== STATUS.DELETED;
  });

  const exchangeRate = getConfigNumber(activeSettings, [
    "exchange_rate_aud_vnd",
    "CFG_EXCHANGE_RATE_AUD_VND"
  ], 18800);

  const operationalTransactions = activeTransactions.filter(isOperationalFinanceTransaction);

  const pools = buildPoolSummary(operationalTransactions, activeSettings, exchangeRate);
  const totals = calculateTransactionTotals(operationalTransactions, exchangeRate);
  const upcoming = buildUpcomingPlans(activePlans);
  const tuition = calculateTuitionSummary(activeTransactions, activeSettings, exchangeRate);
  const vndFund = calculateVndFundSummary(activeTransactions, activeSettings);

  const safeToSpend = totals.totalIncomeAud - totals.totalExpenseAud;

  return {
    finance: {
      safeToSpend: roundMoney(safeToSpend),
      totalIncome: roundMoney(totals.totalIncomeAud),
      totalExpense: roundMoney(totals.totalExpenseAud),
      currency: "AUD",
      exchangeRate: exchangeRate
    },
    pools: pools,
    plans: {
      nearest: upcoming.nearest,
      upcoming: upcoming.items
    },
    tuition: tuition,
    vndFund: vndFund
  };
}

function isOperationalFinanceTransaction(tx) {
  const source = String(tx.source || SOURCES.MANUAL).toLowerCase();
  const currency = String(tx.currency || "AUD").toUpperCase();

  const specialSources = [
    SOURCES.TUITION_PAYMENT,
    SOURCES.VND_FUND_AUTO,
    SOURCES.VND_FUND_MANUAL
  ];

  if (specialSources.includes(source)) return false;
  if (currency === "VND") return false;

  return true;
}

function calculateTransactionTotals(transactions, exchangeRate) {
  let totalIncomeAud = 0;
  let totalExpenseAud = 0;

  transactions.forEach(tx => {
    const type = normalizeTypeValue(tx.type);
    const amountAud = convertToAud(tx.amount, tx.currency, exchangeRate);

    if (type === TYPES.INCOME) {
      totalIncomeAud += amountAud;
    }

    if (type === TYPES.EXPENSE) {
      totalExpenseAud += amountAud;
    }
  });

  return {
    totalIncomeAud: totalIncomeAud,
    totalExpenseAud: totalExpenseAud
  };
}

function buildPoolSummary(transactions, settings, exchangeRate) {
  const pools = getPoolSettings(settings);
  const expenseTransactions = transactions.filter(tx => {
    return normalizeTypeValue(tx.type) === TYPES.EXPENSE;
  });

  const totalIncomeAud = transactions
    .filter(tx => normalizeTypeValue(tx.type) === TYPES.INCOME)
    .reduce((sum, tx) => sum + convertToAud(tx.amount, tx.currency, exchangeRate), 0);

  return pools.map(pool => {
    const poolKey = pool.poolKey;
    const poolName = pool.poolName;
    const quotaPercent = pool.quotaPercent;

    const poolBudget = totalIncomeAud * quotaPercent / 100;

    let spent = 0;
    const details = {};

    expenseTransactions.forEach(tx => {
      const txPoolKey = String(tx.pool_key || "").trim();
      const txPoolName = String(tx.pool_name || "").trim();

      const isSamePool = txPoolKey === poolKey || txPoolName === poolName;

      if (isSamePool) {
        const amountAud = convertToAud(tx.amount, tx.currency, exchangeRate);
        spent += amountAud;

        const categoryName = String(tx.category_name || tx.category_key || "Khác").trim();
        details[categoryName] = roundMoney((details[categoryName] || 0) + amountAud);
      }
    });

    const remaining = poolBudget - spent;
    const percent = poolBudget > 0 ? Math.round((spent / poolBudget) * 100) : 0;

    return {
      key: poolKey,
      name: poolName,
      quotaPercent: quotaPercent,
      budget: roundMoney(poolBudget),
      spent: roundMoney(spent),
      remaining: roundMoney(remaining),
      percent: percent,
      details: details,
      smartNotice: buildPoolNotice(poolName, spent, remaining)
    };
  });
}

function buildPoolNotice(poolName, spent, remaining) {
  const name = String(poolName || "").toLowerCase();

  if (name.includes("cố định") || name.includes("fixed")) {
    if (spent <= 0) {
      return "⚠️ Chưa ghi nhận khoản cố định trong kỳ này.";
    }

    if (remaining > 0) {
      return "✅ Khoản cố định đã có giao dịch, quỹ vẫn còn dư.";
    }

    return "⚠️ Quỹ cố định đã vượt mức dự kiến.";
  }

  return "";
}

function buildUpcomingPlans(plans) {
  const today = toDateOnly(new Date());

  const items = plans
    .filter(plan => {
      const status = String(plan.status || STATUS.ACTIVE).toLowerCase();
      return status === STATUS.ACTIVE || status === "";
    })
    .map(plan => {
      const dueDate = toDateOnly(plan.due_date);
      const daysLeft = dueDate ? calculateDaysLeft(today, dueDate) : null;

      return {
        plan_id: plan.plan_id,
        title: plan.title,
        type: normalizeTypeValue(plan.type),
        amount: toNumber(plan.amount),
        currency: plan.currency || "AUD",
        category_key: plan.category_key,
        category_name: plan.category_name,
        pool_key: plan.pool_key,
        pool_name: plan.pool_name,
        due_date: formatDateForClient(dueDate),
        days_left: daysLeft,
        status: plan.status || STATUS.ACTIVE,
        is_recurring: parseBoolean(plan.is_recurring),
        repeat_type: plan.repeat_type || "none",
        cycle_days: toNumber(plan.cycle_days),
        priority: plan.priority || "normal",
        note: plan.note || ""
      };
    })
    .sort((a, b) => {
      if (a.days_left === null) return 1;
      if (b.days_left === null) return -1;
      return a.days_left - b.days_left;
    });

  return {
    nearest: items.length > 0 ? items[0] : null,
    items: items
  };
}

function calculateTuitionSummary(transactions, settings, exchangeRate) {
  const target = getConfigNumber(settings, [
    "tuition_target_amount",
    "CFG_TUITION_TARGET"
  ], 0);

  const history = transactions
    .filter(isTuitionTransaction)
    .map(tx => {
      const amountAud = convertToAud(tx.amount, tx.currency || "AUD", exchangeRate);

      return {
        transaction_id: tx.transaction_id,
        date: formatDateValue(tx.transaction_date || tx.created_at),
        amount: roundMoney(amountAud),
        currency: "AUD",
        note: tx.note || ""
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paid = history.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const remaining = target - paid;
  const percent = target > 0 ? Math.round((paid / target) * 100) : 0;

  return {
    target: roundMoney(target),
    paid: roundMoney(paid),
    remaining: roundMoney(remaining),
    percent: percent,
    currency: "AUD",
    history: history
  };
}

function isTuitionTransaction(tx) {
  const source = String(tx.source || "").toLowerCase();
  const categoryKey = String(tx.category_key || "").toLowerCase();
  const categoryName = String(tx.category_name || "").toLowerCase();

  return source === SOURCES.TUITION_PAYMENT ||
    categoryKey === "tuition" ||
    categoryName.includes("học phí") ||
    categoryName.includes("tuition");
}

function calculateVndFundSummary(transactions, settings) {
  const balance = getConfigNumber(settings, [
    "vnd_fund_balance",
    "CFG_VND_FUND_BALANCE"
  ], 0);

  const monthlyAdd = getConfigNumber(settings, [
    "vnd_fund_monthly_add",
    "CFG_VND_FUND_MONTHLY_ADD"
  ], 0);

  const nextDate = getConfigString(settings, [
    "vnd_fund_next_date",
    "CFG_VND_FUND_NEXT_DATE"
  ], "");

  const cycleDays = getConfigNumber(settings, [
    "vnd_fund_cycle_days",
    "CFG_VND_FUND_CYCLE_DAYS"
  ], 30);

  const autoEnabled = getConfigBoolean(settings, [
    "vnd_fund_auto_enabled",
    "CFG_VND_FUND_AUTO_ENABLED"
  ], true);

  const history = transactions
    .filter(isVndFundTransaction)
    .map(tx => ({
      transaction_id: tx.transaction_id,
      date: formatDateValue(tx.transaction_date || tx.created_at),
      amount: toNumber(tx.amount),
      currency: "VND",
      note: tx.note || "",
      source: tx.source || ""
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    balance: balance,
    monthlyAdd: monthlyAdd,
    nextDate: nextDate ? formatDateValue(nextDate) : "",
    cycleDays: cycleDays,
    autoEnabled: autoEnabled,
    currency: "VND",
    history: history
  };
}

function isVndFundTransaction(tx) {
  const source = String(tx.source || "").toLowerCase();
  const categoryKey = String(tx.category_key || "").toLowerCase();

  return source === SOURCES.VND_FUND_AUTO ||
    source === SOURCES.VND_FUND_MANUAL ||
    categoryKey === "vnd_fund" ||
    categoryKey === "vnd_saving";
}

function getPoolSettings(settings) {
  const pools = settings
    .filter(row => String(row.setting_type || "").toLowerCase() === "pool")
    .map(row => {
      let quota = toNumber(row.setting_value || row.value || row.allocation_percent || 0);

      if (quota > 0 && quota <= 1) {
        quota = quota * 100;
      }

      return {
        poolKey: String(row.setting_key || row.key || row.setting_id || "").trim(),
        poolName: String(row.setting_label || row.value || row.label || row.key || "").trim(),
        quotaPercent: Math.round(quota)
      };
    })
    .filter(pool => pool.poolKey && pool.poolName);

  if (pools.length > 0) {
    return pools;
  }

  return [
    { poolKey: "fixed", poolName: "Cố định", quotaPercent: 40 },
    { poolKey: "living", poolName: "Sinh hoạt", quotaPercent: 30 },
    { poolKey: "enjoyment", poolName: "Tận hưởng", quotaPercent: 20 },
    { poolKey: "saving", poolName: "Tích lũy", quotaPercent: 10 }
  ];
}

function getConfigNumber(settings, possibleKeys, defaultValue) {
  const found = findSettingByKey(settings, possibleKeys);
  if (!found) return defaultValue;

  const rawValue = found.setting_value !== undefined && found.setting_value !== ""
    ? found.setting_value
    : found.value;

  const numberValue = toNumber(rawValue);
  return isNaN(numberValue) ? defaultValue : numberValue;
}

function getConfigString(settings, possibleKeys, defaultValue) {
  return String(getSettingValue(settings, possibleKeys, defaultValue) || "");
}

function getConfigBoolean(settings, possibleKeys, defaultValue) {
  return getSettingBoolean(settings, possibleKeys, defaultValue);
}

function normalizeTypeValue(type) {
  const value = String(type || "").toLowerCase().trim();

  if (value === "thu" || value === "thu nhập" || value === "income") {
    return TYPES.INCOME;
  }

  if (value === "chi" || value === "chi tiêu" || value === "expense") {
    return TYPES.EXPENSE;
  }

  return value;
}

function convertToAud(amount, currency, exchangeRate) {
  const value = toNumber(amount);
  const cur = String(currency || "AUD").toUpperCase();

  if (cur === "VND") {
    return exchangeRate > 0 ? value / exchangeRate : 0;
  }

  return value;
}
