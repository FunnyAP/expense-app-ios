// ================================
// CORE SCHEDULER - dùng chung cho các mini-app
// ================================

function runDailyJobs(options) {
  const opts = options || {};
  const force = parseBoolean(opts.force);
  const today = getTodayDateString();
  const settings = getActiveSettings();

  const enabled = getSettingBoolean(settings, [
    "daily_job_enabled",
    "JOB_DAILY_ENABLED"
  ], true);

  if (!enabled && !force) {
    return {
      ran: false,
      reason: "Daily jobs đang tắt."
    };
  }

  const lastRun = String(getSettingValue(settings, [
    "daily_job_last_run",
    "JOB_DAILY_LAST_RUN"
  ], ""));

  if (!force && lastRun === today) {
    return {
      ran: false,
      reason: "Daily jobs đã chạy hôm nay.",
      lastRun: lastRun
    };
  }

  const result = {
    ran: true,
    runDate: today,
    modules: {}
  };

  if (typeof financeRunDailyJobs === "function") {
    result.modules.finance = financeRunDailyJobs({ force: force });
  }

  // Sau này mở rộng thêm mini-app thì gọi ở đây:
  // if (typeof taskRunDailyJobs === "function") result.modules.task = taskRunDailyJobs({ force: force });
  // if (typeof habitRunDailyJobs === "function") result.modules.habit = habitRunDailyJobs({ force: force });

  upsertSettingByKey("daily_job_last_run", {
    setting_id: "JOB_DAILY_LAST_RUN",
    module: "core",
    setting_type: "scheduler",
    setting_label: "Ngày chạy daily jobs gần nhất",
    setting_value: today,
    sort_order: 900,
    note: "Core Scheduler dùng chung cho các mini-app"
  });

  upsertSettingByKey("daily_job_enabled", {
    setting_id: "JOB_DAILY_ENABLED",
    module: "core",
    setting_type: "scheduler",
    setting_label: "Bật daily jobs tự động",
    setting_value: true,
    sort_order: 901,
    note: "Đặt false nếu muốn tắt scheduler"
  });

  writeAuditLog(
    "core.run_daily_jobs",
    SHEETS.CORE_SETTINGS,
    "daily_jobs",
    { lastRun: lastRun },
    result,
    force ? "Chạy daily jobs thủ công" : "Chạy daily jobs tự động"
  );

  return result;
}

function runDailyJobsIfNeeded() {
  return runDailyJobs({ force: false });
}
