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

      case "finance.addTuitionPayment":
      case "addTuitionPayment":
        result = financeAddTuitionPayment(body);
        break;

      case "finance.updateVndFundConfig":
      case "updateVndFundConfig":
        result = financeUpdateVndFundConfig(body);
        break;

      case "finance.addVndFundManualDeposit":
      case "addVndFundManualDeposit":
        result = financeAddVndFundManualDeposit(body);
        break;

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
