// ================================
// MAIN API ROUTER - PERSONAL OS V4
// ================================

function testAuthorize() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(ss.getName());
}

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action
      ? e.parameter.action
      : "finance.getData";

    if (action === "finance.getData") {
      if (typeof runDailyJobsIfNeeded === "function") {
        runDailyJobsIfNeeded();
      }

      const data = financeGetData();

      return jsonSuccess({
        app: APP_NAME,
        module: "finance",
        ...data
      });
    }

    // Dùng cho trường hợp sau này muốn gọi riêng dữ liệu cài đặt tài chính.
    // Hiện tại vẫn trả cùng bộ dữ liệu financeGetData để frontend dùng chung appData.raw.settings.
    if (action === "finance.settings.getData") {
      const data = financeGetData();

      return jsonSuccess({
        app: APP_NAME,
        module: "finance",
        settingsModule: true,
        ...data
      });
    }

    if (action === "core.runDailyJobs") {
      const result = runDailyJobs({ force: true });
      return jsonSuccess(result, "core.runDailyJobs thành công");
    }

    return jsonError(`Action GET không hợp lệ: ${action}`);

  } catch (error) {
    return jsonError("Lỗi doGet", error.toString());
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;

    if (!action) {
      return jsonError("Thiếu action trong request");
    }

    let result;

    switch (action) {
      // ================================
      // FINANCE CORE ACTIONS
      // ================================

      case "finance.addTransaction":
      case "addTransaction":
        result = financeAddTransaction(body);
        break;

      case "finance.addCategory":
      case "addCategory":
        result = financeAddCategory(body);
        break;

      case "finance.addPlan":
      case "addPlan":
        result = financeAddPlan(body);
        break;

      case "finance.updatePlan":
      case "updatePlan":
        result = financeUpdatePlan(body);
        break;

      case "finance.deletePlan":
      case "deletePlan":
        result = financeDeletePlan(body);
        break;

      case "finance.confirmPlan":
      case "confirmPlan":
        result = financeConfirmPlan(body);
        break;

      // ================================
      // FINANCE TUITION ACTIONS
      // Học phí là nghiệp vụ riêng:
      // - Ghi nhận đã đóng học phí
      // - Tạo/sửa/xóa/hoàn tất lịch nhắc hạn đóng học phí
      // ================================

      case "finance.addTuitionPayment":
      case "addTuitionPayment":
        result = financeAddTuitionPayment(body);
        break;

      case "finance.addTuitionDue":
      case "addTuitionDue":
        result = financeAddTuitionDue(body);
        break;

      case "finance.updateTuitionDue":
      case "updateTuitionDue":
        result = financeUpdateTuitionDue(body);
        break;

      case "finance.deleteTuitionDue":
      case "deleteTuitionDue":
        result = financeDeleteTuitionDue(body);
        break;

      case "finance.completeTuitionDue":
      case "completeTuitionDue":
        result = financeCompleteTuitionDue(body);
        break;

      // ================================
      // FINANCE VND FUND ACTIONS
      // ================================

      case "finance.updateVndFundConfig":
      case "updateVndFundConfig":
        result = financeUpdateVndFundConfig(body);
        break;

      case "finance.addVndFundManualDeposit":
      case "addVndFundManualDeposit":
        result = financeAddVndFundManualDeposit(body);
        break;

      // ================================
      // FINANCE SETTINGS - EXPENSE CATEGORY
      // Cài đặt riêng cho module Tài chính
      // ================================

      case "finance.settings.addExpenseCategory":
        result = financeSettingsAddExpenseCategory(body);
        break;

      case "finance.settings.updateExpenseCategory":
        result = financeSettingsUpdateExpenseCategory(body);
        break;

      case "finance.settings.deleteExpenseCategory":
        result = financeSettingsDeleteExpenseCategory(body);
        break;

      // ================================
      // FINANCE SETTINGS - INCOME CATEGORY
      // ================================

      case "finance.settings.addIncomeCategory":
        result = financeSettingsAddIncomeCategory(body);
        break;

      case "finance.settings.updateIncomeCategory":
        result = financeSettingsUpdateIncomeCategory(body);
        break;

      case "finance.settings.deleteIncomeCategory":
        result = financeSettingsDeleteIncomeCategory(body);
        break;

      // ================================
      // FINANCE SETTINGS - POOL
      // ================================

      case "finance.settings.updatePool":
        result = financeSettingsUpdatePool(body);
        break;

      case "finance.settings.updatePoolAllocations":
        result = financeSettingsUpdatePoolAllocations(body);
        break;

      // ================================
      // FINANCE SETTINGS - CONFIG
      // ================================

      case "finance.settings.updateExchangeRate":
        result = financeSettingsUpdateExchangeRate(body);
        break;

      case "finance.settings.updateVndFundConfig":
        result = financeSettingsUpdateVndFundConfig(body);
        break;

      // ================================
      // CORE SCHEDULER
      // ================================

      case "finance.runDailyJobs":
      case "core.runDailyJobs":
      case "runDailyJobs":
        result = runDailyJobs({ force: true });
        break;

      default:
        return jsonError(`Action POST không hợp lệ: ${action}`);
    }

    return jsonSuccess(result, `${action} thành công`);

  } catch (error) {
    return jsonError("Lỗi doPost", error.toString());
  }
}