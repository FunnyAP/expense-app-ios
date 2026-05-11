// ==========================================
// FINANCE SETTINGS FRONTEND
// Cài đặt riêng cho module Tài chính
// ==========================================

let financeSettingsReady = false;
let financeSettingsCurrentCategory = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const financeSettingsPanel = document.getElementById('finance-settings-panel');
const btnOpenFinanceSettings = document.getElementById('btn-open-finance-settings');
const btnCloseFinanceSettings = document.getElementById('btn-close-finance-settings');

const expenseSettingsSheet = document.getElementById('ui-finance-expense-settings-sheet');
const incomeSettingsSheet = document.getElementById('ui-finance-income-settings-sheet');
const categoryFormSheet = document.getElementById('ui-finance-category-form-sheet');
const poolSettingsSheet = document.getElementById('ui-finance-pool-settings-sheet');
const exchangeSettingsSheet = document.getElementById('ui-finance-exchange-settings-sheet');

const btnCloseExpenseSettings = document.getElementById('btn-close-expense-settings');
const btnCloseIncomeSettings = document.getElementById('btn-close-income-settings');
const btnCloseCategoryForm = document.getElementById('btn-close-category-form');
const btnClosePoolSettings = document.getElementById('btn-close-pool-settings');
const btnCloseExchangeSettings = document.getElementById('btn-close-exchange-settings');

const btnAddExpenseCategory = document.getElementById('btn-add-expense-category');
const btnAddIncomeCategory = document.getElementById('btn-add-income-category');

const expenseCategorySettingsList = document.getElementById('ui-expense-category-settings-list');
const incomeCategorySettingsList = document.getElementById('ui-income-category-settings-list');

const financeCategoryForm = document.getElementById('finance-category-form');
const financeCategoryFormTitle = document.getElementById('finance-category-form-title');
const inputFinanceCategoryMode = document.getElementById('input-finance-category-mode');
const inputFinanceCategoryType = document.getElementById('input-finance-category-type');
const inputFinanceCategoryId = document.getElementById('input-finance-category-id');
const inputFinanceCategoryName = document.getElementById('input-finance-category-name');
const financeCategoryPoolWrapper = document.getElementById('finance-category-pool-wrapper');
const inputFinanceCategoryPool = document.getElementById('input-finance-category-pool');
const btnSubmitFinanceCategory = document.getElementById('btn-submit-finance-category');
const btnDeleteFinanceCategory = document.getElementById('btn-delete-finance-category');

const poolSettingsList = document.getElementById('ui-pool-settings-list');
const financePoolForm = document.getElementById('finance-pool-form');
const poolAllocationTotal = document.getElementById('ui-pool-allocation-total');
const btnSubmitPoolSettings = document.getElementById('btn-submit-pool-settings');

const financeExchangeForm = document.getElementById('finance-exchange-form');
const inputFinanceExchangeRate = document.getElementById('input-finance-exchange-rate');
const btnSubmitExchangeSettings = document.getElementById('btn-submit-exchange-settings');

// ==========================================
// PATCH FETCH DATA
// Sau mỗi lần app.js fetchData xong thì render lại Settings
// ==========================================
if (typeof fetchData === "function") {
    const originalFetchData = fetchData;

    fetchData = async function patchedFetchData() {
        await originalFetchData();

        if (financeSettingsReady) {
            renderFinanceSettingsDashboard();
            renderExpenseCategorySettings();
            renderIncomeCategorySettings();
            renderPoolSettings();
            fillExchangeSettingsForm();
        }
    };
}

// Lần fetchData đầu tiên có thể đã chạy trước khi file này load,
// nên mình đợi appData có dữ liệu rồi render.
const financeSettingsBootstrapTimer = setInterval(() => {
    if (typeof appData !== "undefined" && appData) {
        financeSettingsReady = true;
        renderFinanceSettingsDashboard();
        clearInterval(financeSettingsBootstrapTimer);
    }
}, 250);

// ==========================================
// BASIC HELPERS
// ==========================================
function fsGetActiveSettings() {
    return (appData?.raw?.settings || []).filter(item => {
        return String(item.status || "active").toLowerCase() !== "deleted";
    });
}

function fsGetPools() {
    return fsGetActiveSettings()
        .filter(item => item.setting_type === "pool")
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function fsGetExpenseCategories() {
    return fsGetActiveSettings()
        .filter(item => item.setting_type === "expense_category")
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function fsGetIncomeCategories() {
    return fsGetActiveSettings()
        .filter(item => item.setting_type === "income_category")
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function fsFindPoolName(poolKey) {
    const pool = fsGetPools().find(item => String(item.setting_key) === String(poolKey));
    return pool ? pool.setting_label : "Chưa chọn Pool";
}

function fsGetSettingValue(settingKey, defaultValue = "") {
    const setting = fsGetActiveSettings().find(item => String(item.setting_key) === String(settingKey));
    return setting ? setting.setting_value : defaultValue;
}

function fsFormatNumber(value) {
    return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function fsSetButtonLoading(button, text) {
    if (!button) return;

    button.dataset.originalText = button.dataset.originalText || button.innerText;
    button.innerText = text || "Đang lưu...";
    button.disabled = true;
}

function fsResetButton(button) {
    if (!button) return;

    button.innerText = button.dataset.originalText || button.innerText;
    button.disabled = false;
}

function fsOpenBottomSheet(sheet) {
    if (!sheet) return;

    overlay.classList.add('active');
    sheet.classList.add('active');
}

function fsCloseSettingsSheets() {
    if (expenseSettingsSheet) expenseSettingsSheet.classList.remove('active');
    if (incomeSettingsSheet) incomeSettingsSheet.classList.remove('active');
    if (categoryFormSheet) categoryFormSheet.classList.remove('active');
    if (poolSettingsSheet) poolSettingsSheet.classList.remove('active');
    if (exchangeSettingsSheet) exchangeSettingsSheet.classList.remove('active');
}

function fsCloseAllSettingsSheetsOnly() {
    fsCloseSettingsSheets();

    const anyOtherSheetOpen = document.querySelector('.bottom-sheet.active');
    if (!anyOtherSheetOpen) {
        overlay.classList.remove('active');
    }
}

// Vì overlay trong app.js chưa biết các bottom sheet mới của Settings,
// nên thêm listener riêng để đóng các sheet của Settings.
if (overlay) {
    overlay.addEventListener('click', fsCloseSettingsSheets);
}

// ==========================================
// OPEN / CLOSE FINANCE SETTINGS PANEL
// ==========================================
if (btnOpenFinanceSettings) {
    btnOpenFinanceSettings.addEventListener('click', () => {
        openFinanceSettingsPanel();
    });
}

if (btnCloseFinanceSettings) {
    btnCloseFinanceSettings.addEventListener('click', () => {
        closeFinanceSettingsPanel();
    });
}

function openFinanceSettingsPanel() {
    renderFinanceSettingsDashboard();

    if (financeSettingsPanel) {
        financeSettingsPanel.classList.add('active');
    }
}

function closeFinanceSettingsPanel() {
    if (financeSettingsPanel) {
        financeSettingsPanel.classList.remove('active');
    }
}

// ==========================================
// DASHBOARD
// ==========================================
function renderFinanceSettingsDashboard() {
    const expenseCount = fsGetExpenseCategories().length;
    const incomeCount = fsGetIncomeCategories().length;
    const pools = fsGetPools();
    const totalPercent = pools.reduce((sum, item) => sum + Number(item.setting_value || 0), 0);
    const exchangeRate = Number(fsGetSettingValue("exchange_rate_aud_vnd", currentExchangeRate || 0));
    const vndAuto = fsGetSettingValue("vnd_fund_auto_enabled", false);

    const expenseCountEl = document.getElementById('ui-settings-expense-count');
    const incomeCountEl = document.getElementById('ui-settings-income-count');
    const poolTotalEl = document.getElementById('ui-settings-pool-total');
    const exchangeRateEl = document.getElementById('ui-settings-exchange-rate');
    const vndAutoEl = document.getElementById('ui-settings-vnd-auto');

    if (expenseCountEl) expenseCountEl.innerText = expenseCount;
    if (incomeCountEl) incomeCountEl.innerText = incomeCount;
    if (poolTotalEl) poolTotalEl.innerText = `${totalPercent}%`;
    if (exchangeRateEl) exchangeRateEl.innerText = fsFormatNumber(Math.round(exchangeRate));
    if (vndAutoEl) vndAutoEl.innerText = String(vndAuto).toLowerCase() === "true" || vndAuto === true ? "Bật" : "Tắt";
}

// ==========================================
// SETTINGS CARD CLICK
// ==========================================
document.querySelectorAll('.finance-settings-card').forEach(card => {
    card.addEventListener('click', () => {
        const section = card.dataset.settingsSection;

        if (section === "expense-category") {
            renderExpenseCategorySettings();
            fsOpenBottomSheet(expenseSettingsSheet);
        }

        if (section === "income-category") {
            renderIncomeCategorySettings();
            fsOpenBottomSheet(incomeSettingsSheet);
        }

        if (section === "pool") {
            renderPoolSettings();
            fsOpenBottomSheet(poolSettingsSheet);
        }

        if (section === "exchange-rate") {
            fillExchangeSettingsForm();
            fsOpenBottomSheet(exchangeSettingsSheet);
        }

        if (section === "vnd-fund") {
            // Dùng lại bottom sheet cài đặt Hũ tiết kiệm hiện có trong app.js
            if (typeof fillVndConfigForm === "function") {
                fillVndConfigForm();
            }

            if (typeof openSheet === "function" && typeof vndConfigSheet !== "undefined") {
                openSheet(vndConfigSheet);
            }
        }
    });
});

// ==========================================
// CLOSE BUTTONS
// ==========================================
if (btnCloseExpenseSettings) btnCloseExpenseSettings.addEventListener('click', fsCloseAllSettingsSheetsOnly);
if (btnCloseIncomeSettings) btnCloseIncomeSettings.addEventListener('click', fsCloseAllSettingsSheetsOnly);
if (btnCloseCategoryForm) btnCloseCategoryForm.addEventListener('click', fsCloseAllSettingsSheetsOnly);
if (btnClosePoolSettings) btnClosePoolSettings.addEventListener('click', fsCloseAllSettingsSheetsOnly);
if (btnCloseExchangeSettings) btnCloseExchangeSettings.addEventListener('click', fsCloseAllSettingsSheetsOnly);

// ==========================================
// EXPENSE CATEGORY SETTINGS
// ==========================================
function renderExpenseCategorySettings() {
    const list = fsGetExpenseCategories();

    if (!expenseCategorySettingsList) return;

    if (!list.length) {
        expenseCategorySettingsList.innerHTML = `<p style="text-align:center; color:#8e8e93;">Chưa có danh mục chi.</p>`;
        return;
    }

    expenseCategorySettingsList.innerHTML = "";

    list.forEach(item => {
        const row = document.createElement('div');
        row.className = 'settings-row';

        row.innerHTML = `
            <div class="settings-row-main">
                <div class="settings-row-title">${item.setting_label}</div>
                <div class="settings-row-sub">Pool: ${fsFindPoolName(item.parent_key)} · Key: ${item.setting_key}</div>
            </div>
            <div class="settings-row-actions">
                <button type="button" class="settings-mini-button">Sửa</button>
            </div>
        `;

        row.querySelector('.settings-mini-button').addEventListener('click', () => {
            openCategoryForm("expense", "edit", item);
        });

        expenseCategorySettingsList.appendChild(row);
    });
}

if (btnAddExpenseCategory) {
    btnAddExpenseCategory.addEventListener('click', () => {
        openCategoryForm("expense", "add");
    });
}

// ==========================================
// INCOME CATEGORY SETTINGS
// ==========================================
function renderIncomeCategorySettings() {
    const list = fsGetIncomeCategories();

    if (!incomeCategorySettingsList) return;

    if (!list.length) {
        incomeCategorySettingsList.innerHTML = `<p style="text-align:center; color:#8e8e93;">Chưa có danh mục thu.</p>`;
        return;
    }

    incomeCategorySettingsList.innerHTML = "";

    list.forEach(item => {
        const row = document.createElement('div');
        row.className = 'settings-row';

        row.innerHTML = `
            <div class="settings-row-main">
                <div class="settings-row-title">${item.setting_label}</div>
                <div class="settings-row-sub">Key: ${item.setting_key}</div>
            </div>
            <div class="settings-row-actions">
                <button type="button" class="settings-mini-button">Sửa</button>
            </div>
        `;

        row.querySelector('.settings-mini-button').addEventListener('click', () => {
            openCategoryForm("income", "edit", item);
        });

        incomeCategorySettingsList.appendChild(row);
    });
}

if (btnAddIncomeCategory) {
    btnAddIncomeCategory.addEventListener('click', () => {
        openCategoryForm("income", "add");
    });
}

// ==========================================
// CATEGORY FORM
// ==========================================
function renderCategoryPoolOptions(selectedPoolKey = "") {
    if (!inputFinanceCategoryPool) return;

    const pools = fsGetPools();

    inputFinanceCategoryPool.innerHTML = "";

    pools.forEach(pool => {
        const option = document.createElement('option');
        option.value = pool.setting_key;
        option.innerText = pool.setting_label;

        if (String(pool.setting_key) === String(selectedPoolKey)) {
            option.selected = true;
        }

        inputFinanceCategoryPool.appendChild(option);
    });
}

function openCategoryForm(type, mode, item = null) {
    financeSettingsCurrentCategory = item;

    const isExpense = type === "expense";
    const isEdit = mode === "edit";

    if (financeCategoryFormTitle) {
        financeCategoryFormTitle.innerText = isEdit
            ? (isExpense ? "Sửa danh mục chi" : "Sửa danh mục thu")
            : (isExpense ? "Thêm danh mục chi" : "Thêm danh mục thu");
    }

    inputFinanceCategoryMode.value = mode;
    inputFinanceCategoryType.value = type;
    inputFinanceCategoryId.value = item?.setting_id || item?.setting_key || "";
    inputFinanceCategoryName.value = item?.setting_label || "";

    if (isExpense) {
        financeCategoryPoolWrapper.classList.remove('hidden');
        renderCategoryPoolOptions(item?.parent_key || fsGetPools()[0]?.setting_key || "");
    } else {
        financeCategoryPoolWrapper.classList.add('hidden');
        inputFinanceCategoryPool.innerHTML = "";
    }

    if (btnDeleteFinanceCategory) {
        btnDeleteFinanceCategory.style.display = isEdit ? "block" : "none";
    }

    fsOpenBottomSheet(categoryFormSheet);
}

if (financeCategoryForm) {
    financeCategoryForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const mode = inputFinanceCategoryMode.value;
        const type = inputFinanceCategoryType.value;
        const categoryId = inputFinanceCategoryId.value;
        const name = inputFinanceCategoryName.value.trim();

        if (!name) {
            alert("Tên danh mục không được để trống.");
            return;
        }

        const isExpense = type === "expense";
        const isEdit = mode === "edit";

        let action = "";

        if (isExpense && !isEdit) action = "finance.settings.addExpenseCategory";
        if (isExpense && isEdit) action = "finance.settings.updateExpenseCategory";
        if (!isExpense && !isEdit) action = "finance.settings.addIncomeCategory";
        if (!isExpense && isEdit) action = "finance.settings.updateIncomeCategory";

        const payload = {
            action: action,
            category_id: categoryId,
            category_name: name
        };

        if (isExpense) {
            payload.pool_key = inputFinanceCategoryPool.value;
        }

        fsSetButtonLoading(btnSubmitFinanceCategory, "Đang lưu...");

        try {
            await apiPost(payload);
            await fetchData();

            if (isExpense) {
                renderExpenseCategorySettings();
                fsOpenBottomSheet(expenseSettingsSheet);
            } else {
                renderIncomeCategorySettings();
                fsOpenBottomSheet(incomeSettingsSheet);
            }

            if (categoryFormSheet) {
                categoryFormSheet.classList.remove('active');
            }

            renderFinanceSettingsDashboard();
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            fsResetButton(btnSubmitFinanceCategory);
        }
    });
}

if (btnDeleteFinanceCategory) {
    btnDeleteFinanceCategory.addEventListener('click', async () => {
        const type = inputFinanceCategoryType.value;
        const categoryId = inputFinanceCategoryId.value;
        const name = inputFinanceCategoryName.value.trim();

        if (!categoryId) return;

        const ok = confirm(`Bạn có chắc muốn xóa mềm danh mục "${name}" không?`);
        if (!ok) return;

        const isExpense = type === "expense";
        const action = isExpense
            ? "finance.settings.deleteExpenseCategory"
            : "finance.settings.deleteIncomeCategory";

        fsSetButtonLoading(btnDeleteFinanceCategory, "Đang xóa...");

        try {
            await apiPost({
                action: action,
                category_id: categoryId
            });

            await fetchData();

            if (categoryFormSheet) {
                categoryFormSheet.classList.remove('active');
            }

            if (isExpense) {
                renderExpenseCategorySettings();
                fsOpenBottomSheet(expenseSettingsSheet);
            } else {
                renderIncomeCategorySettings();
                fsOpenBottomSheet(incomeSettingsSheet);
            }

            renderFinanceSettingsDashboard();
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            fsResetButton(btnDeleteFinanceCategory);
        }
    });
}

// ==========================================
// POOL SETTINGS
// ==========================================
function renderPoolSettings() {
    const pools = fsGetPools();

    if (!poolSettingsList) return;

    if (!pools.length) {
        poolSettingsList.innerHTML = `<p style="text-align:center; color:#8e8e93;">Chưa có Pool.</p>`;
        updatePoolTotalPreview();
        return;
    }

    poolSettingsList.innerHTML = "";

    pools.forEach(pool => {
        const percent = Number(pool.setting_value || 0);

        const row = document.createElement('div');
        row.className = 'pool-setting-row';
        row.dataset.poolKey = pool.setting_key;
        row.dataset.originalName = pool.setting_label;
        row.dataset.originalPercent = percent;

        row.innerHTML = `
            <div class="pool-setting-top">
                <div class="pool-setting-name">
                    <label>Tên Pool</label>
                    <input type="text" class="input-pool-name" value="${pool.setting_label}">
                </div>
                <div class="pool-setting-percent">
                    <label>%</label>
                    <input type="number" class="input-pool-percent" value="${percent}" min="0" max="100" inputmode="decimal">
                </div>
            </div>

            <div class="pool-setting-progress">
                <div class="pool-setting-progress-fill" style="width:${Math.min(percent, 100)}%;"></div>
            </div>
        `;

        const percentInput = row.querySelector('.input-pool-percent');
        const progressFill = row.querySelector('.pool-setting-progress-fill');

        percentInput.addEventListener('input', () => {
            const value = Number(percentInput.value || 0);
            progressFill.style.width = `${Math.min(Math.max(value, 0), 100)}%`;
            updatePoolTotalPreview();
        });

        poolSettingsList.appendChild(row);
    });

    updatePoolTotalPreview();
}

function updatePoolTotalPreview() {
    const inputs = document.querySelectorAll('.input-pool-percent');
    let total = 0;

    inputs.forEach(input => {
        total += Number(input.value || 0);
    });

    if (poolAllocationTotal) {
        poolAllocationTotal.innerText = `${total}%`;

        const wrapper = poolAllocationTotal.closest('.settings-total-row');

        if (wrapper) {
            wrapper.classList.remove('valid', 'invalid');
            wrapper.classList.add(Math.round(total) === 100 ? 'valid' : 'invalid');
        }
    }

    return total;
}

if (financePoolForm) {
    financePoolForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const total = updatePoolTotalPreview();

        if (Math.round(total) !== 100) {
            alert("Tổng tỷ lệ Pool phải bằng 100% trước khi lưu.");
            return;
        }

        const rows = document.querySelectorAll('.pool-setting-row');

        const allocations = [];
        const nameUpdates = [];

        rows.forEach(row => {
            const poolKey = row.dataset.poolKey;
            const originalName = row.dataset.originalName;
            const originalPercent = Number(row.dataset.originalPercent || 0);

            const name = row.querySelector('.input-pool-name').value.trim();
            const percent = Number(row.querySelector('.input-pool-percent').value || 0);

            allocations.push({
                pool_key: poolKey,
                percent: percent
            });

            if (name && name !== originalName) {
                nameUpdates.push({
                    pool_key: poolKey,
                    pool_name: name
                });
            }
        });

        fsSetButtonLoading(btnSubmitPoolSettings, "Đang lưu...");

        try {
            await apiPost({
                action: "finance.settings.updatePoolAllocations",
                allocations: allocations
            });

            for (const item of nameUpdates) {
                await apiPost({
                    action: "finance.settings.updatePool",
                    pool_key: item.pool_key,
                    pool_name: item.pool_name
                });
            }

            await fetchData();
            renderPoolSettings();
            renderFinanceSettingsDashboard();

            alert("Đã lưu Pool & tỷ lệ.");
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            fsResetButton(btnSubmitPoolSettings);
        }
    });
}

// ==========================================
// EXCHANGE RATE SETTINGS
// ==========================================
function fillExchangeSettingsForm() {
    const exchangeRate = fsGetSettingValue("exchange_rate_aud_vnd", currentExchangeRate || 0);

    if (inputFinanceExchangeRate) {
        inputFinanceExchangeRate.value = Number(exchangeRate || 0);
    }
}

if (financeExchangeForm) {
    financeExchangeForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const exchangeRate = Number(inputFinanceExchangeRate.value || 0);

        if (exchangeRate <= 0) {
            alert("Tỷ giá phải lớn hơn 0.");
            return;
        }

        fsSetButtonLoading(btnSubmitExchangeSettings, "Đang lưu...");

        try {
            await apiPost({
                action: "finance.settings.updateExchangeRate",
                exchange_rate: exchangeRate
            });

            await fetchData();
            fillExchangeSettingsForm();
            renderFinanceSettingsDashboard();

            alert("Đã cập nhật tỷ giá.");
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            fsResetButton(btnSubmitExchangeSettings);
        }
    });
}

// ==========================================
// GLOBAL EXPOSE
// Cho app.js hoặc các module khác gọi lại nếu cần
// ==========================================
window.renderFinanceSettingsDashboard = renderFinanceSettingsDashboard;
window.renderExpenseCategorySettings = renderExpenseCategorySettings;
window.renderIncomeCategorySettings = renderIncomeCategorySettings;
window.renderPoolSettings = renderPoolSettings;
window.fillExchangeSettingsForm = fillExchangeSettingsForm;