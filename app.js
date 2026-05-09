// ==========================================
// KẾT NỐI API VỚI GOOGLE APPS SCRIPT
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbwL0kcJFmKjaprDMlrRzSfJGipevHCMc3o732pIw_KXr-Fem5rphrCCqjYwY9F9gfbX/exec";

// ==========================================
// BIẾN TOÀN CỤC
// ==========================================
let appData = null;
let expenseCats = [];
let incomeCats = [];
let poolList = [];
let isVND = false;
let currentSafeToSpend = 0;
let currentExchangeRate = 18808;
let selectedPlanId = "";
let tuitionHistory = [];
let vndFundHistory = [];

// ==========================================
// DOM ELEMENTS
// ==========================================
const currencySwitch = document.getElementById('checkbox-currency');

const overlay = document.getElementById('ui-overlay');

const transactionSheet = document.getElementById('ui-bottom-sheet');
const btnOpen = document.getElementById('btn-open-modal');
const btnClose = document.getElementById('btn-close-modal');
const form = document.getElementById('transaction-form');
const btnSubmit = document.getElementById('btn-submit-form');

const typeRadios = document.getElementsByName('transType');
const categorySelect = document.getElementById('input-category');
const newCatWrapper = document.getElementById('new-category-wrapper');
const poolSelectWrapper = document.getElementById('pool-select-wrapper');
const newPoolSelect = document.getElementById('input-new-pool');

const planSheet = document.getElementById('ui-plan-sheet');
const planDetailSheet = document.getElementById('ui-plan-detail-sheet');
const btnOpenPlanModal = document.getElementById('btn-open-plan-modal');
const btnClosePlanModal = document.getElementById('btn-close-plan-modal');
const btnClosePlanDetail = document.getElementById('btn-close-plan-detail');
const planForm = document.getElementById('plan-form');
const btnSubmitPlanForm = document.getElementById('btn-submit-plan-form');

const planTypeRadios = document.getElementsByName('planType');
const planCategorySelect = document.getElementById('input-plan-category');
const planNewCatWrapper = document.getElementById('plan-new-category-wrapper');
const planPoolSelectWrapper = document.getElementById('plan-pool-select-wrapper');
const planNewPoolSelect = document.getElementById('input-plan-new-pool');
const planRecurringCheckbox = document.getElementById('input-plan-recurring');
const planCycleWrapper = document.getElementById('plan-cycle-wrapper');

const tuitionPaymentSheet = document.getElementById('ui-tuition-payment-sheet');
const tuitionHistorySheet = document.getElementById('ui-tuition-history-sheet');
const btnOpenTuitionPayment = document.getElementById('btn-open-tuition-payment');
const btnCloseTuitionPayment = document.getElementById('btn-close-tuition-payment');
const btnOpenTuitionHistory = document.getElementById('btn-open-tuition-history');
const btnCloseTuitionHistory = document.getElementById('btn-close-tuition-history');
const tuitionPaymentForm = document.getElementById('tuition-payment-form');
const btnSubmitTuitionPayment = document.getElementById('btn-submit-tuition-payment');

const vndConfigSheet = document.getElementById('ui-vnd-config-sheet');
const vndDepositSheet = document.getElementById('ui-vnd-deposit-sheet');
const vndHistorySheet = document.getElementById('ui-vnd-history-sheet');
const btnOpenVndConfig = document.getElementById('btn-open-vnd-config');
const btnCloseVndConfig = document.getElementById('btn-close-vnd-config');
const btnOpenVndDeposit = document.getElementById('btn-open-vnd-deposit');
const btnCloseVndDeposit = document.getElementById('btn-close-vnd-deposit');
const btnOpenVndHistory = document.getElementById('btn-open-vnd-history');
const btnCloseVndHistory = document.getElementById('btn-close-vnd-history');
const vndConfigForm = document.getElementById('vnd-config-form');
const vndDepositForm = document.getElementById('vnd-deposit-form');
const btnSubmitVndConfig = document.getElementById('btn-submit-vnd-config');
const btnSubmitVndDeposit = document.getElementById('btn-submit-vnd-deposit');


// ==========================================
// FORMATTERS
// ==========================================
const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    }).format(Number(amount || 0));
};

const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(Number(amount || 0))) + ' ₫';
};

const formatTypeLabel = (type) => {
    return type === "income" ? "Thu nhập" : "Chi tiêu";
};

const getTodayString = () => {
    return new Date().toISOString().split('T')[0];
};

const formatDateDisplay = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value).split('T')[0];
    return date.toLocaleDateString('vi-VN');
};

const getInputDateValue = (value) => {
    if (!value) return getTodayString();
    return String(value).split('T')[0];
};


// ==========================================
// API HELPER
// ==========================================
async function apiPost(payload) {
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status !== "success") {
        throw new Error(result.message || "Có lỗi xảy ra.");
    }

    return result;
}

// ==========================================
// SPA & SIDEBAR LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const btnOpenSidebar = document.getElementById('btn-sidebar-open');
    const sidebar = document.getElementById('app-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const menuItems = document.querySelectorAll('.menu-item');
    const headerTitle = document.getElementById('ui-header-title');
    const views = document.querySelectorAll('.spa-view');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    }

    btnOpenSidebar.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            const title = item.getAttribute('data-title');

            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            headerTitle.innerText = title;

            views.forEach(v => v.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            setTimeout(toggleSidebar, 100);
        });
    });
});

// ==========================================
// GET DATA
// ==========================================
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success") {
            appData = result.data;

            const finance = appData.finance || {};
            currentSafeToSpend = finance.safeToSpend || 0;
            currentExchangeRate = finance.exchangeRate || 18808;

            prepareSettings(appData.raw?.settings || []);

            updateSafeToSpendUI();
            renderReminderPills(appData.plans);
            renderTimeline(appData.plans);
            renderTuition(appData.tuition || {});
            renderVndFund(appData.vndFund || {});
            renderPools(appData.pools || []);

            const currentType = document.querySelector('input[name="transType"]:checked')?.value || "Chi tiêu";
            updateCategoryOptions(currentType);

            const currentPlanType = document.querySelector('input[name="planType"]:checked')?.value || "Chi tiêu";
            updatePlanCategoryOptions(currentPlanType);
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        document.getElementById('ui-pools-container').innerHTML = "<p style='text-align:center; color:red;'>Lỗi tải dữ liệu. Hãy kiểm tra kết nối mạng.</p>";
        document.getElementById('ui-nearest-plan-card').innerHTML = "<p style='text-align:center; color:red;'>Lỗi tải khoản sắp tới.</p>";
    }
}

function prepareSettings(settings) {
    const activeSettings = settings.filter(item => String(item.status || "active").toLowerCase() !== "deleted");

    poolList = activeSettings
        .filter(item => item.setting_type === "pool")
        .map(item => ({
            key: item.setting_key,
            name: item.setting_label,
            percent: Number(item.setting_value || 0)
        }));

    const poolMap = {};
    poolList.forEach(pool => {
        poolMap[pool.key] = pool.name;
    });

    expenseCats = activeSettings
        .filter(item => item.setting_type === "expense_category")
        .map(item => ({
            key: item.setting_key,
            name: item.setting_label,
            poolKey: item.parent_key,
            poolName: poolMap[item.parent_key] || ""
        }));

    incomeCats = activeSettings
        .filter(item => item.setting_type === "income_category")
        .map(item => ({
            key: item.setting_key,
            name: item.setting_label,
            poolKey: "",
            poolName: ""
        }));

    renderPoolOptions();
}

function renderPoolOptions() {
    const options = poolList.map(pool => {
        return `<option value="${pool.key}">${pool.name}</option>`;
    }).join("");

    newPoolSelect.innerHTML = options;
    planNewPoolSelect.innerHTML = options;
}

// ==========================================
// SAFE TO SPEND
// ==========================================
function updateSafeToSpendUI() {
    const uiElement = document.getElementById('ui-safe-spend');

    if (isVND) {
        const vndAmount = Math.round(currentSafeToSpend * currentExchangeRate);
        uiElement.innerText = formatVND(vndAmount);
        uiElement.style.fontSize = "34px";
        uiElement.style.marginTop = "10px";
    } else {
        uiElement.innerText = formatMoney(currentSafeToSpend);
        uiElement.style.fontSize = "48px";
        uiElement.style.marginTop = "0px";
    }
}

currencySwitch.addEventListener('change', (e) => {
    isVND = e.target.checked;
    updateSafeToSpendUI();
});

// ==========================================
// REMINDER PILLS
// ==========================================
function renderReminderPills(plansData) {
    const upcoming = plansData?.upcoming || [];

    const expensePlans = upcoming
        .filter(plan => plan.type === "expense")
        .sort((a, b) => a.days_left - b.days_left);

    const incomePlans = upcoming
        .filter(plan => plan.type === "income")
        .sort((a, b) => a.days_left - b.days_left);

    const nearestExpense = expensePlans.length > 0 ? expensePlans[0] : null;
    const nearestIncome = incomePlans.length > 0 ? incomePlans[0] : null;

    const rentStatus = document.getElementById('ui-rent-status');
    const salaryStatus = document.getElementById('ui-salary-status');

    if (nearestExpense) {
        rentStatus.innerText = `${nearestExpense.title}: còn ${nearestExpense.days_left} ngày`;
    } else {
        rentStatus.innerText = "Chưa có khoản sắp chi";
    }

    if (nearestIncome) {
        salaryStatus.innerText = `${nearestIncome.title}: còn ${nearestIncome.days_left} ngày`;
    } else {
        salaryStatus.innerText = "Chưa có khoản sắp thu";
    }
}

// ==========================================
// TIMELINE / PLANS
// ==========================================
function renderTimeline(plansData) {
    const nearest = plansData?.nearest || null;
    const upcoming = plansData?.upcoming || [];

    const nearestCard = document.getElementById('ui-nearest-plan-card');
    const container = document.getElementById('ui-plans-container');

    if (!nearest) {
        nearestCard.innerHTML = `<p style="text-align:center; color:#8e8e93;">Chưa có khoản sắp tới nào.</p>`;
        container.innerHTML = "";
        return;
    }

    nearestCard.innerHTML = `
        <div class="nearest-plan-top">
            <div class="nearest-plan-title">${nearest.title}</div>
            <div class="nearest-plan-days">${nearest.days_left} ngày</div>
        </div>
        <div class="nearest-plan-meta">
            <span>${formatTypeLabel(nearest.type)} · ${nearest.category_name || "Chưa phân loại"}</span>
            <span>${formatMoney(nearest.amount)}</span>
        </div>
    `;

    nearestCard.onclick = () => openPlanDetail(nearest.plan_id);

    container.innerHTML = "";

    upcoming.forEach(plan => {
        const card = document.createElement('div');
        card.className = 'timeline-card';

        const typeClass = plan.type === "income" ? "timeline-income" : "timeline-expense";
        const dueText = plan.days_left < 0
            ? `Quá hạn ${Math.abs(plan.days_left)} ngày`
            : `Còn ${plan.days_left} ngày`;

        card.innerHTML = `
            <div class="timeline-card-row">
                <div class="timeline-title">${plan.title}</div>
                <div class="timeline-amount ${typeClass}">${formatMoney(plan.amount)}</div>
            </div>
            <div class="timeline-sub">${dueText} · ${plan.category_name || "Chưa phân loại"}</div>
        `;

        card.addEventListener('click', () => openPlanDetail(plan.plan_id));
        container.appendChild(card);
    });
}

// ==========================================
// POOLS
// ==========================================
function renderPools(pools) {
    const container = document.getElementById('ui-pools-container');
    container.innerHTML = "";

    if (!pools || pools.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#8e8e93;'>Chưa có dữ liệu ngân quỹ.</p>";
        return;
    }

    pools.forEach((pool, index) => {
        const barWidth = pool.percent > 100 ? 100 : pool.percent;

        let barColor = "var(--green)";
        if (pool.name === "Tích lũy") barColor = "var(--blue)";
        else if (pool.percent > 90) barColor = "var(--red)";

        const poolCard = document.createElement('div');
        poolCard.className = 'pool-card';

        let detailsHtml = '<div class="pool-details" id="details-' + index + '" style="display:none; margin-top:15px; border-top:1px solid #eee; padding-top:10px;">';

        if (pool.smartNotice) {
            detailsHtml += `<div style="background-color: #f0f8ff; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #0066cc; margin-bottom: 10px; text-align: center;">${pool.smartNotice}</div>`;
        }

        const detailsEntries = Object.entries(pool.details || {});
        if (detailsEntries.length > 0) {
            detailsEntries.forEach(([cat, amt]) => {
                detailsHtml += `
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; color:#555;">
                        <span>${cat}</span>
                        <span style="font-weight: 600;">${formatMoney(amt)}</span>
                    </div>`;
            });
        } else {
            detailsHtml += '<p style="font-size:12px; color:#999; text-align:center;">Chưa có dữ liệu</p>';
        }

        detailsHtml += '</div>';

        poolCard.innerHTML = `
            <div class="pool-main-info" onclick="toggleAccordion(${index})" style="cursor: pointer;">
                <div class="pool-header">
                    <span class="pool-name">${pool.name} - <span style="color:var(--text-sub)">${pool.quotaPercent}%</span></span>
                    <span class="pool-amount">${formatMoney(pool.remaining)}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${barWidth}%; background-color: ${barColor}"></div>
                </div>
            </div>
            ${detailsHtml}
        `;

        container.appendChild(poolCard);
    });
}

function toggleAccordion(index) {
    const detailEl = document.getElementById('details-' + index);
    detailEl.style.display = detailEl.style.display === "none" ? "block" : "none";
}

// ==========================================
// SHEET OPEN/CLOSE
// ==========================================
function openSheet(sheet) {
    overlay.classList.add('active');
    sheet.classList.add('active');
}

function closeAllSheets() {
    overlay.classList.remove('active');
    transactionSheet.classList.remove('active');
    planSheet.classList.remove('active');
    planDetailSheet.classList.remove('active');
    tuitionPaymentSheet.classList.remove('active');
    tuitionHistorySheet.classList.remove('active');
    vndConfigSheet.classList.remove('active');
    vndDepositSheet.classList.remove('active');
    vndHistorySheet.classList.remove('active');
}

overlay.addEventListener('click', closeAllSheets);

// ==========================================
// TRANSACTION FORM
// ==========================================
btnOpen.addEventListener('click', () => {
    form.reset();
    document.getElementById('input-date').value = getTodayString();
    newCatWrapper.style.display = 'none';
    updateCategoryOptions("Chi tiêu");
    openSheet(transactionSheet);
});

btnClose.addEventListener('click', closeAllSheets);

typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateCategoryOptions(e.target.value);
        newCatWrapper.style.display = 'none';
    });
});

function updateCategoryOptions(type) {
    categorySelect.innerHTML = `<option value="" disabled selected>Chọn danh mục...</option><option value="NEW">+ Thêm mục mới...</option>`;

    const list = type === "Chi tiêu" ? expenseCats : incomeCats;

    list.forEach(item => {
        categorySelect.innerHTML += `<option value="${item.key}">${item.name}</option>`;
    });
}

categorySelect.addEventListener('change', (e) => {
    const isNew = e.target.value === "NEW";
    newCatWrapper.style.display = isNew ? 'block' : 'none';

    document.getElementById('input-new-cat').required = isNew;

    const type = document.querySelector('input[name="transType"]:checked').value;

    if (isNew && type === "Chi tiêu") {
        poolSelectWrapper.style.display = 'flex';
        newPoolSelect.required = true;
    } else {
        poolSelectWrapper.style.display = 'none';
        newPoolSelect.required = false;
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const typeLabel = document.querySelector('input[name="transType"]:checked').value;
    const type = typeLabel === "Chi tiêu" ? "expense" : "income";
    const isNew = categorySelect.value === "NEW";
    const list = type === "expense" ? expenseCats : incomeCats;

    let categoryKey = "";
    let categoryName = "";
    let poolKey = "";

    if (isNew) {
        categoryName = document.getElementById('input-new-cat').value.trim();
        poolKey = type === "expense" ? newPoolSelect.value : "";
    } else {
        const found = list.find(item => item.key === categorySelect.value);
        categoryKey = found?.key || "";
        categoryName = found?.name || "";
        poolKey = found?.poolKey || "";
    }

    const payload = {
        action: "finance.addTransaction",
        transaction_date: document.getElementById('input-date').value,
        type: type,
        amount: document.getElementById('input-amount').value,
        currency: "AUD",
        category_key: categoryKey,
        category_name: categoryName,
        pool_key: poolKey,
        create_category_if_missing: isNew,
        note: document.getElementById('input-note').value
    };

    btnSubmit.innerText = "Đang lưu...";
    btnSubmit.disabled = true;

    try {
        await apiPost(payload);
        closeAllSheets();
        await fetchData();
    } catch (error) {
        alert("Lỗi: " + error.message);
    } finally {
        btnSubmit.innerText = "Lưu Giao Dịch";
        btnSubmit.disabled = false;
    }
});

// ==========================================
// PLAN FORM
// ==========================================
btnOpenPlanModal.addEventListener('click', () => openPlanForm());

btnClosePlanModal.addEventListener('click', closeAllSheets);
btnClosePlanDetail.addEventListener('click', closeAllSheets);

planTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        updatePlanCategoryOptions(e.target.value);
        planNewCatWrapper.style.display = 'none';
    });
});

planRecurringCheckbox.addEventListener('change', () => {
    planCycleWrapper.style.display = planRecurringCheckbox.checked ? 'flex' : 'none';
    document.getElementById('input-plan-cycle-days').required = planRecurringCheckbox.checked;
});

function updatePlanCategoryOptions(type) {
    planCategorySelect.innerHTML = `<option value="" disabled selected>Chọn danh mục...</option><option value="NEW">+ Thêm mục mới...</option>`;

    const list = type === "Chi tiêu" ? expenseCats : incomeCats;

    list.forEach(item => {
        planCategorySelect.innerHTML += `<option value="${item.key}">${item.name}</option>`;
    });
}

planCategorySelect.addEventListener('change', (e) => {
    const isNew = e.target.value === "NEW";
    planNewCatWrapper.style.display = isNew ? 'block' : 'none';

    document.getElementById('input-plan-new-cat').required = isNew;

    const type = document.querySelector('input[name="planType"]:checked').value;

    if (isNew && type === "Chi tiêu") {
        planPoolSelectWrapper.style.display = 'flex';
        planNewPoolSelect.required = true;
    } else {
        planPoolSelectWrapper.style.display = 'none';
        planNewPoolSelect.required = false;
    }
});

function openPlanForm(plan = null) {
    planForm.reset();
    document.getElementById('input-plan-id').value = "";
    document.getElementById('plan-sheet-title').innerText = "Thêm khoản sắp tới";

    document.getElementById('plan-type-expense').checked = true;
    document.getElementById('input-plan-due-date').value = getTodayString();

    planNewCatWrapper.style.display = 'none';
    planCycleWrapper.style.display = 'none';
    updatePlanCategoryOptions("Chi tiêu");

    if (plan) {
        document.getElementById('plan-sheet-title').innerText = "Sửa khoản sắp tới";
        document.getElementById('input-plan-id').value = plan.plan_id;

        if (plan.type === "income") {
            document.getElementById('plan-type-income').checked = true;
            updatePlanCategoryOptions("Thu nhập");
        } else {
            document.getElementById('plan-type-expense').checked = true;
            updatePlanCategoryOptions("Chi tiêu");
        }

        document.getElementById('input-plan-title').value = plan.title || "";
        document.getElementById('input-plan-amount').value = plan.amount || "";
        document.getElementById('input-plan-due-date').value = plan.due_date || getTodayString();
        document.getElementById('input-plan-note').value = plan.note || "";

        if (plan.category_key) {
            planCategorySelect.value = plan.category_key;
        }

        planRecurringCheckbox.checked = !!plan.is_recurring;
        planCycleWrapper.style.display = planRecurringCheckbox.checked ? 'flex' : 'none';
        document.getElementById('input-plan-cycle-days').value = plan.cycle_days || "";
    }

    openSheet(planSheet);
}

planForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const planId = document.getElementById('input-plan-id').value;
    const isEdit = !!planId;

    const typeLabel = document.querySelector('input[name="planType"]:checked').value;
    const type = typeLabel === "Chi tiêu" ? "expense" : "income";
    const isNew = planCategorySelect.value === "NEW";
    const list = type === "expense" ? expenseCats : incomeCats;

    let categoryKey = "";
    let categoryName = "";
    let poolKey = "";

    if (isNew) {
        categoryName = document.getElementById('input-plan-new-cat').value.trim();
        poolKey = type === "expense" ? planNewPoolSelect.value : "";
    } else {
        const found = list.find(item => item.key === planCategorySelect.value);
        categoryKey = found?.key || "";
        categoryName = found?.name || "";
        poolKey = found?.poolKey || "";
    }

    const payload = {
        action: isEdit ? "finance.updatePlan" : "finance.addPlan",
        plan_id: planId,
        title: document.getElementById('input-plan-title').value,
        type: type,
        amount: document.getElementById('input-plan-amount').value,
        currency: "AUD",
        category_key: categoryKey,
        category_name: categoryName,
        pool_key: poolKey,
        due_date: document.getElementById('input-plan-due-date').value,
        is_recurring: planRecurringCheckbox.checked,
        cycle_days: document.getElementById('input-plan-cycle-days').value || 0,
        repeat_type: planRecurringCheckbox.checked ? "custom" : "none",
        create_category_if_missing: isNew,
        note: document.getElementById('input-plan-note').value
    };

    btnSubmitPlanForm.innerText = "Đang lưu...";
    btnSubmitPlanForm.disabled = true;

    try {
        await apiPost(payload);
        closeAllSheets();
        await fetchData();
    } catch (error) {
        alert("Lỗi: " + error.message);
    } finally {
        btnSubmitPlanForm.innerText = "Lưu khoản sắp tới";
        btnSubmitPlanForm.disabled = false;
    }
});

// ==========================================
// PLAN DETAIL
// ==========================================
function findPlanById(planId) {
    return appData?.plans?.upcoming?.find(plan => String(plan.plan_id) === String(planId));
}

function openPlanDetail(planId) {
    const plan = findPlanById(planId);

    if (!plan) {
        alert("Không tìm thấy khoản này.");
        return;
    }

    selectedPlanId = planId;

    document.getElementById('plan-detail-title').innerText = plan.title;
    document.getElementById('plan-detail-type').innerText = formatTypeLabel(plan.type);
    document.getElementById('plan-detail-amount').innerText = formatMoney(plan.amount);
    document.getElementById('plan-detail-due-date').innerText = `${plan.due_date} · còn ${plan.days_left} ngày`;
    document.getElementById('plan-detail-category').innerText = plan.category_name || "-";
    document.getElementById('plan-detail-pool').innerText = plan.pool_name || "-";
    document.getElementById('plan-detail-recurring').innerText = plan.is_recurring ? `Có · ${plan.cycle_days} ngày` : "Không";
    document.getElementById('confirm-plan-amount').value = plan.amount || "";

    openSheet(planDetailSheet);
}

document.getElementById('btn-confirm-plan').addEventListener('click', async () => {
    const plan = findPlanById(selectedPlanId);

    if (!plan) return;

    const ok = confirm(`Xác nhận đã ${plan.type === "income" ? "thu" : "chi"} khoản "${plan.title}"?`);
    if (!ok) return;

    try {
        await apiPost({
            action: "finance.confirmPlan",
            plan_id: selectedPlanId,
            amount: document.getElementById('confirm-plan-amount').value || plan.amount,
            transaction_date: getTodayString(),
            note: `Xác nhận từ khoản sắp tới: ${plan.title}`
        });

        closeAllSheets();
        await fetchData();
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
});

document.getElementById('btn-edit-plan').addEventListener('click', () => {
    const plan = findPlanById(selectedPlanId);

    if (!plan) return;

    planDetailSheet.classList.remove('active');
    openPlanForm(plan);
});

document.getElementById('btn-delete-plan').addEventListener('click', async () => {
    const plan = findPlanById(selectedPlanId);

    if (!plan) return;

    const ok = confirm(`Bạn có chắc muốn xóa khoản "${plan.title}" không?`);
    if (!ok) return;

    try {
        await apiPost({
            action: "finance.deletePlan",
            plan_id: selectedPlanId
        });

        closeAllSheets();
        await fetchData();
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
});


// ==========================================
// TUITION SECTION
// ==========================================
function renderTuition(tuition) {
    const paid = Number(tuition.paid || 0);
    tuitionHistory = tuition.history || [];

    document.getElementById('ui-tuition-paid').innerText = formatMoney(paid);

    renderTuitionHistory();
}

function renderTuitionHistory() {
    const container = document.getElementById('ui-tuition-history-list');
    const list = tuitionHistory || [];

    if (!list.length) {
        container.innerHTML = `<p style="text-align:center; color:#8e8e93;">Chưa có dữ liệu học phí.</p>`;
        return;
    }

    container.innerHTML = "";

    list.slice().reverse().forEach(item => {
        const date = item.transaction_date || item.date || item.created_at || "";
        const note = item.note || "Đóng học phí";
        const amount = item.amount || 0;

        const row = document.createElement('div');
        row.className = 'history-item';
        row.innerHTML = `
            <div class="history-item-top">
                <div class="history-title">${formatDateDisplay(date)}</div>
                <div class="history-amount timeline-expense">${formatMoney(amount)}</div>
            </div>
            <div class="history-sub">AUD · Học phí</div>
            <div class="history-note">${note}</div>
        `;
        container.appendChild(row);
    });
}

if (btnOpenTuitionPayment) {
    btnOpenTuitionPayment.addEventListener('click', () => {
        tuitionPaymentForm.reset();
        document.getElementById('input-tuition-date').value = getTodayString();
        openSheet(tuitionPaymentSheet);
    });
}

if (btnCloseTuitionPayment) btnCloseTuitionPayment.addEventListener('click', closeAllSheets);

if (btnOpenTuitionHistory) {
    btnOpenTuitionHistory.addEventListener('click', () => {
        renderTuitionHistory();
        openSheet(tuitionHistorySheet);
    });
}

if (btnCloseTuitionHistory) btnCloseTuitionHistory.addEventListener('click', closeAllSheets);

if (tuitionPaymentForm) {
    tuitionPaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            action: "finance.addTuitionPayment",
            amount: document.getElementById('input-tuition-amount').value,
            currency: "AUD",
            transaction_date: document.getElementById('input-tuition-date').value,
            note: document.getElementById('input-tuition-note').value
        };

        btnSubmitTuitionPayment.innerText = "Đang lưu...";
        btnSubmitTuitionPayment.disabled = true;

        try {
            await apiPost(payload);
            closeAllSheets();
            await fetchData();
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            btnSubmitTuitionPayment.innerText = "Lưu khoản học phí";
            btnSubmitTuitionPayment.disabled = false;
        }
    });
}

// ==========================================
// VND SAVING JAR SECTION
// ==========================================
function renderVndFund(fund) {
    const balance = Number(fund.balance || 0);
    const monthlyAdd = Number(fund.monthlyAdd || fund.amount || 0);
    const nextDate = fund.nextDate || fund.next_date || "";
    const cycleDays = Number(fund.cycleDays || fund.cycle_days || 0);
    const autoEnabled = !!fund.autoEnabled || String(fund.auto_enabled || "").toLowerCase() === "true";

    vndFundHistory = fund.history || [];

    document.getElementById('ui-vnd-balance').innerText = formatVND(balance);
    document.getElementById('ui-vnd-monthly').innerText = formatVND(monthlyAdd);
    document.getElementById('ui-vnd-next-date').innerText = nextDate ? formatDateDisplay(nextDate) : "Chưa đặt";
    document.getElementById('ui-vnd-cycle').innerText = cycleDays > 0 ? `${cycleDays} ngày` : "-";
    document.getElementById('ui-vnd-auto').innerText = autoEnabled ? "Bật" : "Tắt";
}

function renderVndHistory() {
    const container = document.getElementById('ui-vnd-history-list');
    const list = vndFundHistory || [];

    if (!list.length) {
        container.innerHTML = `<p style="text-align:center; color:#8e8e93;">Chưa có dữ liệu hũ tiết kiệm.</p>`;
        return;
    }

    container.innerHTML = "";

    list.slice().reverse().forEach(item => {
        const date = item.transaction_date || item.date || item.created_at || "";
        const note = item.note || "Nhận tiền hũ tiết kiệm";
        const amount = item.amount || 0;
        const source = item.source === "vnd_fund_auto" ? "Tự động" : "Thủ công";

        const row = document.createElement('div');
        row.className = 'history-item';
        row.innerHTML = `
            <div class="history-item-top">
                <div class="history-title">${formatDateDisplay(date)}</div>
                <div class="history-amount timeline-income">${formatVND(amount)}</div>
            </div>
            <div class="history-sub">VNĐ · ${source}</div>
            <div class="history-note">${note}</div>
        `;
        container.appendChild(row);
    });
}

function fillVndConfigForm() {
    const fund = appData?.vndFund || {};
    document.getElementById('input-vnd-amount').value = fund.monthlyAdd || fund.amount || 0;
    document.getElementById('input-vnd-next-date').value = getInputDateValue(fund.nextDate || fund.next_date);
    document.getElementById('input-vnd-cycle-days').value = fund.cycleDays || fund.cycle_days || 30;
    document.getElementById('input-vnd-auto-enabled').checked = !!fund.autoEnabled || String(fund.auto_enabled || "").toLowerCase() === "true";
}

if (btnOpenVndConfig) {
    btnOpenVndConfig.addEventListener('click', () => {
        fillVndConfigForm();
        openSheet(vndConfigSheet);
    });
}

if (btnCloseVndConfig) btnCloseVndConfig.addEventListener('click', closeAllSheets);

if (btnOpenVndDeposit) {
    btnOpenVndDeposit.addEventListener('click', () => {
        vndDepositForm.reset();
        document.getElementById('input-vnd-deposit-date').value = getTodayString();
        openSheet(vndDepositSheet);
    });
}

if (btnCloseVndDeposit) btnCloseVndDeposit.addEventListener('click', closeAllSheets);

if (btnOpenVndHistory) {
    btnOpenVndHistory.addEventListener('click', () => {
        renderVndHistory();
        openSheet(vndHistorySheet);
    });
}

if (btnCloseVndHistory) btnCloseVndHistory.addEventListener('click', closeAllSheets);

if (vndConfigForm) {
    vndConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            action: "finance.updateVndFundConfig",
            amount: document.getElementById('input-vnd-amount').value,
            next_date: document.getElementById('input-vnd-next-date').value,
            cycle_days: document.getElementById('input-vnd-cycle-days').value,
            auto_enabled: document.getElementById('input-vnd-auto-enabled').checked
        };

        btnSubmitVndConfig.innerText = "Đang lưu...";
        btnSubmitVndConfig.disabled = true;

        try {
            await apiPost(payload);
            closeAllSheets();
            await fetchData();
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            btnSubmitVndConfig.innerText = "Lưu cài đặt";
            btnSubmitVndConfig.disabled = false;
        }
    });
}

if (vndDepositForm) {
    vndDepositForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            action: "finance.addVndFundManualDeposit",
            amount: document.getElementById('input-vnd-deposit-amount').value,
            transaction_date: document.getElementById('input-vnd-deposit-date').value,
            note: document.getElementById('input-vnd-deposit-note').value
        };

        btnSubmitVndDeposit.innerText = "Đang lưu...";
        btnSubmitVndDeposit.disabled = true;

        try {
            await apiPost(payload);
            closeAllSheets();
            await fetchData();
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            btnSubmitVndDeposit.innerText = "Lưu khoản VNĐ";
            btnSubmitVndDeposit.disabled = false;
        }
    });
}

// ==========================================
// START APP
// ==========================================
fetchData();