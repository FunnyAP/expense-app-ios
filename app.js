// ==========================================
// KẾT NỐI API VỚI GOOGLE APPS SCRIPT
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbz1HvEnM323LNt0nqKtUicMx-5IqdXO6NjOsTAhUchmhX4Pjykqgdm_vcYy8Xgq-4dkFA/exec";

// ==========================================
// BIẾN TOÀN CỤC & DOM ELEMENTS
// ==========================================
let expenseCats = [];
let incomeCats = [];

// Elements
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

// Hàm Format tiền tệ (Có dấu phẩy phân cách)
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
            document.getElementById('ui-safe-spend').innerText = formatMoney(data.safeToSpend);
            document.getElementById('ui-rent-status').innerText = data.rentStatus;
            document.getElementById('ui-salary-status').innerText = data.salaryStatus;

            // Lưu danh mục vào biến toàn cục để dùng khi đổi Thu/Chi
            expenseCats = data.expenseCategories || [];
            incomeCats = data.incomeCategories || [];
            
            // Vẽ lại danh sách 4 Pool
            renderPools(data.pools);

            // Cập nhật list Danh mục ban đầu (Mặc định là Chi tiêu)
            updateCategoryOptions("Chi tiêu");
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        document.getElementById('ui-pools-container').innerHTML = "<p style='text-align:center; color:red;'>Lỗi tải dữ liệu. Hãy kiểm tra lại kết nối.</p>";
    }
}

// Vẽ 4 cái Pool lên màn hình chính
function renderPools(pools) {
    const container = document.getElementById('ui-pools-container');
    container.innerHTML = ""; // Xóa chữ "Đang đồng bộ..."

    pools.forEach(pool => {
        // Tránh lỗi chia cho 0
        const percent = pool.budget > 0 ? (pool.spent / pool.budget) * 100 : 0;
        const barWidth = percent > 100 ? 100 : percent; // Tối đa 100%
        
        // Màu sắc: Tiết kiệm thì màu xanh dương. Quá 90% thì màu đỏ.
        let barColor = "var(--green)";
        if (pool.name === "Tích lũy") barColor = "var(--blue)";
        else if (percent > 90) barColor = "var(--red)";

        const html = `
            <div class="pool-card">
                <div class="pool-header">
                    <span class="pool-name">${pool.name}</span>
                    <span class="pool-amount">${formatMoney(pool.remaining)}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${barWidth}%; background-color: ${barColor}"></div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// ==========================================
// 2. XỬ LÝ GIAO DIỆN (UI EVENTS)
// ==========================================

// Mở Bottom Sheet (Mặc định set ngày hôm nay)
btnOpen.addEventListener('click', () => {
    overlay.classList.add('active');
    bottomSheet.classList.add('active');
    document.getElementById('input-date').valueAsDate = new Date();
});

// Đóng Bottom Sheet
const closeModal = () => {
    overlay.classList.remove('active');
    bottomSheet.classList.remove('active');
    form.reset();
    newCatWrapper.style.display = 'none';
    updateCategoryOptions("Chi tiêu"); // Reset về Chi tiêu
};
btnClose.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);

// Thay đổi Thu/Chi -> Đổi danh sách Hạng mục
typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateCategoryOptions(e.target.value);
        newCatWrapper.style.display = 'none'; // Ẩn form thêm mới nếu đang mở
    });
});

// Hàm cập nhật thẻ <select> Danh mục
function updateCategoryOptions(type) {
    categorySelect.innerHTML = `<option value="" disabled selected>Chọn danh mục...</option><option value="NEW">+ Thêm mục mới...</option>`;
    
    const list = type === "Chi tiêu" ? expenseCats : incomeCats;
    
    list.forEach(item => {
        const catName = typeof item === 'object' ? item.name : item;
        categorySelect.innerHTML += `<option value="${catName}">${catName}</option>`;
    });
}

// Bắt sự kiện khi chọn "Thêm mục mới..."
categorySelect.addEventListener('change', (e) => {
    if (e.target.value === "NEW") {
        newCatWrapper.style.display = 'block';
        document.getElementById('input-new-cat').required = true;
        
        // Nếu là Thu nhập thì không cần chọn Quỹ (Pool)
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

// ==========================================
// 3. GỬI DỮ LIỆU LÊN GOOGLE SHEETS (POST)
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const type = document.querySelector('input[name="transType"]:checked').value;
    const isNew = categorySelect.value === "NEW";
    let category = isNew ? document.getElementById('input-new-cat').value : categorySelect.value;
    
    // Tìm Pool tương ứng (Nếu không phải mục mới)
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

    // Đổi trạng thái nút bấm
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
            fetchData(); // Tải lại dữ liệu mới nhất để số dư nhảy
        } else {
            alert("Lỗi: " + result.message);
        }
    } catch (error) {
        alert("Có lỗi kết nối mạng. Hãy thử lại!");
    } finally {
        btnSubmit.innerText = "Lưu Giao Dịch";
        btnSubmit.disabled = false;
    }
});

// Khởi chạy lấy dữ liệu khi vừa mở app
fetchData();