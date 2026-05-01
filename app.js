// ==========================================
// KẾT NỐI API VỚI GOOGLE APPS SCRIPT
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbz1HvEnM323LNt0nqKtUicMx-5IqdXO6NjOsTAhUchmhX4Pjykqgdm_vcYy8Xgq-4dkFA/exec";

// ==========================================
// BIẾN TOÀN CỤC & DOM ELEMENTS
// ==========================================
let expenseCats = [];
let incomeCats = [];
let isVND = false;
let currentSafeToSpend = 0;
let currentExchangeRate = 18808;

const currencySwitch = document.getElementById('checkbox-currency');

// Elements Popup Thêm giao dịch
const overlay = document.getElementById('ui-overlay');
const bottomSheet = document.getElementById('ui-bottom-sheet');
const btnOpen = document.getElementById('btn-open-modal');
const btnClose = document.getElementById('btn-close-modal');
const form = document.getElementById('transaction-form');
const btnSubmit = document.getElementById('btn-submit-form');

const typeRadios = document.getElementsByName('transType');
const categorySelect = document.getElementById('input-category');
const newCatWrapper = document.getElementById('new-category-wrapper');
const poolSelectWrapper = document.getElementById('pool-select-wrapper');

// Hàm Format tiền tệ
const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
};

// ==========================================
// 1. LẤY DỮ LIỆU TỪ GOOGLE SHEETS (GET)
// ==========================================
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success") {
            const data = result.data;

            // Cập nhật Tổng quan
            currentSafeToSpend = data.safeToSpend;
            currentExchangeRate = data.exchangeRate || 18808;
            
            // Lấy input date ẩn trên giao diện (Đã được định nghĩa trong HTML)
            const rentDateInput = document.getElementById('date-rent');
            const salaryDateInput = document.getElementById('date-salary');

            // Gán ngày mặc định (nếu có thẻ input trên giao diện)
            if(data.dates.rent && rentDateInput) rentDateInput.value = data.dates.rent.split('T')[0];
            if(data.dates.salary && salaryDateInput) salaryDateInput.value = data.dates.salary.split('T')[0];

            updateSafeToSpendUI();

            document.getElementById('ui-rent-status').innerText = data.rentStatus;
            document.getElementById('ui-salary-status').innerText = data.salaryStatus;

            expenseCats = data.expenseCategories || [];
            incomeCats = data.incomeCategories || [];
            
            // Vẽ lại danh sách 4 Pool
            renderPools(data.pools);

            updateCategoryOptions("Chi tiêu");
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        document.getElementById('ui-pools-container').innerHTML = "<p style='text-align:center; color:red;'>Lỗi tải dữ liệu. Hãy kiểm tra kết nối mạng.</p>";
    }
}

function updateSafeToSpendUI() {
    const uiElement = document.getElementById('ui-safe-spend');
    if (isVND) {
        const vndAmount = Math.round(currentSafeToSpend * currentExchangeRate);
        uiElement.innerText = new Intl.NumberFormat('vi-VN').format(vndAmount) + ' ₫';
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
// VẼ POOL KÈM ACCORDION
// ==========================================
function renderPools(pools) {
    const container = document.getElementById('ui-pools-container');
    container.innerHTML = "";

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

        const detailsEntries = Object.entries(pool.details);
        if (detailsEntries.length > 0) {
            detailsEntries.forEach(([cat, amt]) => {
                detailsHtml += `
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; color:#555;">
                        <span>${cat}</span>
                        <span style="font-weight: 600;">${formatMoney(amt)}</span>
                    </div>`;
            });
        } else {
            detailsHtml += '<p style="font-size:12px; color:#999; text-align:center;">Chưa có dữ liệu 30 ngày qua</p>';
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
    if (detailEl.style.display === "none") {
        detailEl.style.display = "block";
    } else {
        detailEl.style.display = "none";
    }
}

// ==========================================
// 2. XỬ LÝ GIAO DIỆN (UI EVENTS) - BẢN TỐI ƯU iOS
// ==========================================

// Lắng nghe sự kiện thay đổi ngày từ Input Tàng hình
const rentDateInputObj = document.getElementById('date-rent');
const salaryDateInputObj = document.getElementById('date-salary');

if (rentDateInputObj) {
    rentDateInputObj.addEventListener('change', (e) => {
        if(e.target.value) updateDateOnSheet('rent', e.target.value);
    });
}

if (salaryDateInputObj) {
    salaryDateInputObj.addEventListener('change', (e) => {
        if(e.target.value) updateDateOnSheet('salary', e.target.value);
    });
}

// Hàm đẩy ngày lên Sheet
async function updateDateOnSheet(target, newDate) {
    const targetElement = target === 'rent' ? document.getElementById('ui-rent-status') : document.getElementById('ui-salary-status');
    const originalText = targetElement.innerText; // Lưu lại chữ cũ lỡ bị lỗi thì phục hồi
    targetElement.innerText = "Đang lưu...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "updateDate", target: target, newDate: newDate })
        });
        const result = await response.json();
        if (result.status === "success") {
            fetchData(); 
        }
    } catch (e) {
        alert("Lỗi kết nối khi cập nhật ngày.");
        targetElement.innerText = originalText;
    }
}

// ==========================================
// 3. THÊM GIAO DỊCH (GỬI LÊN GOOGLE SHEETS)
// ==========================================
btnOpen.addEventListener('click', () => {
    overlay.classList.add('active');
    bottomSheet.classList.add('active');
    document.getElementById('input-date').valueAsDate = new Date();
});

const closeModal = () => {
    overlay.classList.remove('active');
    bottomSheet.classList.remove('active');
    form.reset();
    newCatWrapper.style.display = 'none';
    updateCategoryOptions("Chi tiêu");
};
btnClose.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);

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
        const catName = typeof item === 'object' ? item.name : item;
        categorySelect.innerHTML += `<option value="${catName}">${catName}</option>`;
    });
}

categorySelect.addEventListener('change', (e) => {
    if (e.target.value === "NEW") {
        newCatWrapper.style.display = 'block';
        document.getElementById('input-new-cat').required = true;
        const type = document.querySelector('input[name="transType"]:checked').value;
        if (type === "Thu nhập") {
            poolSelectWrapper.style.display = 'none';
            document.getElementById('input-new-pool').required = false;
        } else {
            poolSelectWrapper.style.display = 'flex';
            document.getElementById('input-new-pool').required = true;
        }
    } else {
        newCatWrapper.style.display = 'none';
        document.getElementById('input-new-cat').required = false;
        document.getElementById('input-new-pool').required = false;
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="transType"]:checked').value;
    const isNew = categorySelect.value === "NEW";
    let category = isNew ? document.getElementById('input-new-cat').value : categorySelect.value;
    
    let assignedPool = "";
    if (type === "Chi tiêu") {
        if (isNew) {
            assignedPool = document.getElementById('input-new-pool').value;
        } else {
            const found = expenseCats.find(c => c.name === category);
            if (found) assignedPool = found.pool;
        }
    }

    const payload = {
        date: document.getElementById('input-date').value,
        type: type,
        amount: document.getElementById('input-amount').value,
        category: category,
        isNewCategory: isNew,
        pool: assignedPool,
        note: document.getElementById('input-note').value
    };

    btnSubmit.innerText = "Đang lưu...";
    btnSubmit.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.status === "success") {
            closeModal();
            fetchData();
        } else {
            alert("Lỗi: " + result.message);
        }
    } catch (error) {
        alert("Có lỗi kết nối mạng.");
    } finally {
        btnSubmit.innerText = "Lưu Giao Dịch";
        btnSubmit.disabled = false;
    }
});

fetchData();