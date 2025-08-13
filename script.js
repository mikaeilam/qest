document.addEventListener('DOMContentLoaded', function() {
    // Initialize Persian Date
    const today = new PersianDate();
    document.getElementById('current-date').textContent = today.format('dddd، D MMMM YYYY');

    // Load settings
    loadSettings();

    // Load payments from localStorage
    loadPayments();

    // Initialize form submission
    document.getElementById('payment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addNewPayment();
    });

    // Initialize reset form button
    document.getElementById('reset-form-btn').addEventListener('click', resetForm);

    // Initialize generate dates button
    document.getElementById('generate-dates-btn').addEventListener('click', generateInstallmentDates);

    // Initialize installment count change
    document.getElementById('payment-installment-count').addEventListener('change', updateInstallmentDatesFields);

    // Initialize filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterPayments(this.dataset.filter);
        });
    });

    // Initialize search box
    document.getElementById('payment-search').addEventListener('input', function() {
        searchPayments(this.value);
    });

    // Initialize date picker
    initDatePicker();

    // Check for upcoming payments and show notifications
    checkUpcomingPayments();

    // Update stats cards
    updateStatsCards();
});

// Payment data structure
let payments = [];
let settings = {
    notificationDays: 3,
    enableNotifications: true,
    theme: 'light',
    font: 'vazir'
};

function addNewPayment() {
    const name = document.getElementById('payment-name').value;
    const creditor = document.getElementById('payment-creditor').value;
    const totalAmount = document.getElementById('payment-total-amount').value;
    const installmentCount = document.getElementById('payment-installment-count').value;
    const desc = document.getElementById('payment-desc').value;

    if (!name || !totalAmount || !installmentCount) {
        showNotification('لطفاً تمام فیلدهای ضروری را پر کنید', 'error');
        return;
    }

    // Get installment dates and amounts
    const installments = [];
    const dateInputs = document.querySelectorAll('.installment-date-item');
    
    let totalEnteredAmount = 0;
    dateInputs.forEach(item => {
        const dateInput = item.querySelector('.date-input');
        const amountInput = item.querySelector('.date-amount');
        
        if (!dateInput.value) {
            showNotification('لطفاً تمام تاریخ‌های اقساط را وارد کنید', 'error');
            return;
        }
        
        const amount = amountInput.value ? parseInt(amountInput.value) : Math.floor(totalAmount / installmentCount);
        installments.push({
            date: dateInput.value,
            amount: amount
        });
        
        totalEnteredAmount += amount;
    });

    // Validate total amount
    if (totalEnteredAmount !== parseInt(totalAmount)) {
        showNotification(`مجموع مبالغ اقساط (${totalEnteredAmount.toLocaleString('fa-IR')}) با مبلغ کل (${parseInt(totalAmount).toLocaleString('fa-IR')}) مطابقت ندارد`, 'error');
        return;
    }

    const newPayment = {
        id: Date.now(),
        name: name,
        creditor: creditor || 'نا مشخص',
        totalAmount: parseInt(totalAmount),
        description: desc,
        installments: installments,
        status: 'upcoming', // upcoming, past, paid
        createdAt: new Date().toISOString()
    };

    payments.push(newPayment);
    savePayments();
    renderPayments();
    resetForm();
    updateStatsCards();

    showNotification(`قسط "${name}" با موفقیت اضافه شد`, 'success');
}

function resetForm() {
    document.getElementById('payment-form').reset();
    document.getElementById('installment-dates-container').innerHTML = '';
    updateInstallmentDatesFields();
}

function generateInstallmentDates() {
    const installmentCount = parseInt(document.getElementById('payment-installment-count').value);
    const container = document.getElementById('installment-dates-container');
    container.innerHTML = '';

    const totalAmount = parseInt(document.getElementById('payment-total-amount').value) || 0;
    const baseAmount = Math.floor(totalAmount / installmentCount);
    const remainder = totalAmount % installmentCount;

    let today = new PersianDate();
    
    for (let i = 0; i < installmentCount; i++) {
        const dateItem = document.createElement('div');
        dateItem.className = 'installment-date-item';
        
        // Calculate date (1 month apart)
        const installmentDate = new PersianDate(today);
        installmentDate.add('month', i + 1);
        
        // Calculate amount (distribute remainder)
        let amount = baseAmount;
        if (i === installmentCount - 1) {
            amount += remainder;
        }
        
        dateItem.innerHTML = `
            <input type="text" class="date-input" value="${installmentDate.format('YYYY-MM-DD')}" readonly>
            <input type="number" class="date-amount" value="${amount}" placeholder="مبلغ قسط">
            <button type="button" class="remove-date-btn"><i class="mdi mdi-close"></i></button>
        `;
        
        container.appendChild(dateItem);
    }

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-date-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentElement.remove();
        });
    });
}

function updateInstallmentDatesFields() {
    const installmentCount = parseInt(document.getElementById('payment-installment-count').value);
    const container = document.getElementById('installment-dates-container');
    
    // If no dates exist, generate them
    if (container.children.length === 0) {
        generateInstallmentDates();
    }
    // If count changed, regenerate
    else if (container.children.length !== installmentCount) {
        if (confirm('تعداد اقساط تغییر کرده است. آیا می‌خواهید تاریخ‌ها مجدداً تولید شوند؟')) {
            generateInstallmentDates();
        }
    }
}

function savePayments() {
    localStorage.setItem('payments', JSON.stringify(payments));
}

function loadPayments() {
    const savedPayments = localStorage.getItem('payments');
    if (savedPayments) {
        payments = JSON.parse(savedPayments);
        renderPayments();
    }
}

function renderPayments(filter = 'all') {
    const tbody = document.getElementById('payments-table-body');
    tbody.innerHTML = '';

    let filteredPayments = payments;
    if (filter !== 'all') {
        filteredPayments = payments.filter(payment => {
            if (filter === 'upcoming') {
                return payment.status === 'upcoming';
            } else if (filter === 'past') {
                return payment.status === 'past';
            } else if (filter === 'paid') {
                return payment.status === 'paid';
            }
            return true;
        });
    }

    if (filteredPayments.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align: center;">هیچ قسطی یافت نشد</td>`;
        tbody.appendChild(tr);
        return;
    }

    filteredPayments.forEach(payment => {
        const tr = document.createElement('tr');
        
        // Get next installment date
        const nextInstallment = payment.installments.find(inst => {
            const instDate = new Date(inst.date);
            return payment.status !== 'paid' && instDate >= new Date(new Date().setHours(0, 0, 0, 0));
        });
        
        const nextDate = nextInstallment ? new PersianDate(new Date(nextInstallment.date)) : null;
        const nextAmount = nextInstallment ? nextInstallment.amount : null;
        
        tr.innerHTML = `
            <td>${payment.name}</td>
            <td>${payment.creditor}</td>
            <td>${payment.totalAmount.toLocaleString('fa-IR')} ریال</td>
            <td>${payment.installments.length} قسط</td>
            <td>
                ${nextDate ? nextDate.format('D MMMM YYYY') + ' (' + nextAmount.toLocaleString('fa-IR') + ' ریال)' : 'تمام شده'}
            </td>
            <td><span class="status-badge status-${payment.status}">${getStatusText(payment.status)}</span></td>
            <td>
                <button class="action-btn" onclick="viewPaymentDetails(${payment.id})" title="مشاهده جزئیات">
                    <i class="mdi mdi-eye"></i>
                </button>
                ${payment.status !== 'paid' ? `
                <button class="action-btn" onclick="markAsPaid(${payment.id})" title="پرداخت شد">
                    <i class="mdi mdi-check-circle"></i>
                </button>
                ` : ''}
                <button class="action-btn" onclick="editPayment(${payment.id})" title="ویرایش">
                    <i class="mdi mdi-pencil"></i>
                </button>
                <button class="action-btn" onclick="deletePayment(${payment.id})" title="حذف">
                    <i class="mdi mdi-delete"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterPayments(filter) {
    renderPayments(filter);
}

function searchPayments(query) {
    const filtered = payments.filter(payment => 
        payment.name.includes(query) || 
        payment.creditor.includes(query) ||
        payment.description.includes(query)
    );
    
    const tbody = document.getElementById('payments-table-body');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align: center;">هیچ قسطی یافت نشد</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    filtered.forEach(payment => {
        const tr = document.createElement('tr');
        // ... (same as renderPayments function)
        tbody.appendChild(tr);
    });
}

function getStatusText(status) {
    switch(status) {
        case 'upcoming': return 'آینده';
        case 'past': return 'معوقه';
        case 'paid': return 'پرداخت شده';
        default: return 'نامشخص';
    }
}

function markAsPaid(id) {
    const payment = payments.find(p => p.id === id);
    if (payment) {
        payment.status = 'paid';
        savePayments();
        renderPayments(document.querySelector('.filter-btn.active').dataset.filter);
        updateStatsCards();
        showNotification(`قسط "${payment.name}" به عنوان پرداخت شده علامت زده شد`, 'success');
    }
}

function editPayment(id) {
    const payment = payments.find(p => p.id === id);
    if (payment) {
        document.getElementById('payment-name').value = payment.name;
        document.getElementById('payment-creditor').value = payment.creditor;
        document.getElementById('payment-total-amount').value = payment.totalAmount;
        document.getElementById('payment-installment-count').value = payment.installments.length;
        document.getElementById('payment-desc').value = payment.description || '';
        
        // Set installment dates
        const container = document.getElementById('installment-dates-container');
        container.innerHTML = '';
        
        payment.installments.forEach(inst => {
            const dateItem = document.createElement('div');
            dateItem.className = 'installment-date-item';
            dateItem.innerHTML = `
                <input type="text" class="date-input" value="${inst.date}" readonly>
                <input type="number" class="date-amount" value="${inst.amount}" placeholder="مبلغ قسط">
                <button type="button" class="remove-date-btn"><i class="mdi mdi-close"></i></button>
            `;
            container.appendChild(dateItem);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-date-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                this.parentElement.remove();
            });
        });
        
        // Remove the payment from the list
        payments = payments.filter(p => p.id !== id);
        savePayments();
        
        showNotification(`قسط "${payment.name}" برای ویرایش آماده است`, 'info');
    }
}

function viewPaymentDetails(id) {
    const payment = payments.find(p => p.id === id);
    if (payment) {
        // In a real app, you would show a modal with full details
        alert(`جزئیات قسط: ${payment.name}\nطلبکار: ${payment.creditor}\nمبلغ کل: ${payment.totalAmount.toLocaleString('fa-IR')} ریال\nتعداد اقساط: ${payment.installments.length}\nوضعیت: ${getStatusText(payment.status)}`);
    }
}

function deletePayment(id) {
    if (confirm('آیا از حذف این قسط مطمئن هستید؟ این عمل قابل بازگشت نیست.')) {
        const payment = payments.find(p => p.id === id);
        payments = payments.filter(p => p.id !== id);
        savePayments();
        renderPayments(document.querySelector('.filter-btn.active').dataset.filter);
        updateStatsCards();
        showNotification(`قسط "${payment.name}" حذف شد`, 'warning');
    }
}

function checkUpcomingPayments() {
    if (!settings.enableNotifications) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const notificationDate = new Date(today);
    notificationDate.setDate(notificationDate.getDate() + settings.notificationDays);
    
    const upcomingPayments = payments.filter(payment => {
        if (payment.status !== 'upcoming') return false;
        
        return payment.installments.some(inst => {
            const instDate = new Date(inst.date);
            return instDate >= today && instDate <= notificationDate;
        });
    });
    
    const pastDuePayments = payments.filter(payment => {
        if (payment.status !== 'upcoming') return false;
        
        return payment.installments.some(inst => {
            const instDate = new Date(inst.date);
            return instDate < today;
        });
    });
    
    // Update payment statuses if needed
    pastDuePayments.forEach(payment => {
        payment.status = 'past';
    });
    savePayments();
    
    // Update notification count
    const notificationCount = upcomingPayments.length + pastDuePayments.length;
    document.getElementById('notification-count').textContent = notificationCount;
    
    // Show notification if needed
    if (pastDuePayments.length > 0) {
        showNotification(
            `شما ${pastDuePayments.length} قسط معوقه دارید. لطفاً هرچه سریعتر اقدام به پرداخت نمایید.`,
            'error'
        );
    } else if (upcomingPayments.length > 0) {
        showNotification(
            `شما ${upcomingPayments.length} قسط در ${settings.notificationDays} روز آینده دارید.`,
            'info'
        );
    }
    
    // Update upcoming payments list
    updateUpcomingPaymentsList();
}

function updateUpcomingPaymentsList() {
    const container = document.getElementById('upcoming-payments-list');
    container.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingPayments = payments.filter(payment => {
        return payment.status === 'upcoming' && 
               payment.installments.some(inst => new Date(inst.date) >= today);
    });
    
    if (upcomingPayments.length === 0) {
        container.innerHTML = '<div class="no-payments">هیچ قسط آینده‌ای وجود ندارد</div>';
        return;
    }
    
    // Sort by nearest date
    upcomingPayments.sort((a, b) => {
        const aDate = new Date(a.installments[0].date);
        const bDate = new Date(b.installments[0].date);
        return aDate - bDate;
    });
    
    // Show only the next 5 payments
    upcomingPayments.slice(0, 5).forEach(payment => {
        const nextInstallment = payment.installments.find(inst => new Date(inst.date) >= today);
        if (!nextInstallment) return;
        
        const paymentDate = new PersianDate(new Date(nextInstallment.date));
        const daysLeft = Math.floor((new Date(nextInstallment.date) - today) / (1000 * 60 * 60 * 24));
        
        const paymentItem = document.createElement('div');
        paymentItem.className = 'payment-item';
        paymentItem.innerHTML = `
            <div class="payment-info">
                <h4>${payment.name}</h4>
                <p>${paymentDate.format('D MMMM YYYY')} (${nextInstallment.amount.toLocaleString('fa-IR')} ریال)</p>
            </div>
            <div class="payment-days-left">
                ${daysLeft === 0 ? 'امروز' : `${daysLeft} روز دیگر`}
            </div>
        `;
        
        container.appendChild(paymentItem);
    });
}

function updateStatsCards() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Total debt (sum of all unpaid installments)
    let totalDebt = 0;
    let upcomingCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    
    payments.forEach(payment => {
        if (payment.status === 'paid') {
            paidCount++;
            return;
        }
        
        payment.installments.forEach(inst => {
            const instDate = new Date(inst.date);
            if (payment.status === 'upcoming' && instDate >= today) {
                totalDebt += inst.amount;
                upcomingCount++;
            } else if (payment.status === 'upcoming' && instDate < today) {
                totalDebt += inst.amount;
                overdueCount++;
            } else if (payment.status === 'past') {
                totalDebt += inst.amount;
                overdueCount++;
            }
        });
    });
    
    document.getElementById('total-debt-amount').textContent = totalDebt.toLocaleString('fa-IR') + ' ریال';
    document.getElementById('upcoming-payments-count').textContent = upcomingCount + ' قسط';
    document.getElementById('overdue-payments-count').textContent = overdueCount + ' قسط';
    document.getElementById('paid-payments-count').textContent = paidCount + ' قسط';
}

function showNotification(message, type = 'info') {
    if (!settings.enableNotifications) return;
    
    const notificationBar = document.getElementById('notification-bar');
    notificationBar.textContent = message;
    notificationBar.className = 'notification-bar ' + type;
    notificationBar.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        notificationBar.style.display = 'none';
    }, 5000);
}

function initDatePicker() {
    // This is a simplified version. In a real app, you would use a proper Persian date picker library
    document.querySelectorAll('.date-input').forEach(input => {
        input.addEventListener('focus', function() {
            // Show date picker modal
            document.getElementById('date-picker-modal').style.display = 'flex';
            
            // Set current date
            const currentDate = this.value ? new PersianDate(new Date(this.value)) : new PersianDate();
            
            // In a real app, you would initialize the date picker here
            // For example using a library like persian-datepicker
        });
    });
    
    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('date-picker-modal').style.display = 'none';
        });
    });
    
    // Confirm date button
    document.getElementById('confirm-date-btn').addEventListener('click', function() {
        // In a real app, you would get the selected date from the date picker
        const selectedDate = new PersianDate();
        const formattedDate = selectedDate.format('YYYY-MM-DD');
        
        // Set the date to the active input
        const activeInput = document.querySelector('.date-input:focus');
        if (activeInput) {
            activeInput.value = formattedDate;
        }
        
        document.getElementById('date-picker-modal').style.display = 'none';
    });
}

function loadSettings() {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        applySettings();
    }
}

function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
    applySettings();
    showNotification('تنظیمات با موفقیت ذخیره شد', 'success');
}

function applySettings() {
    // Apply theme
    document.body.setAttribute('data-theme', settings.theme);
    
    // Apply font
    document.body.style.fontFamily = settings.font === 'vazir' ? 'Vazir, sans-serif' : 
                                   settings.font === 'sahel' ? 'Sahel, sans-serif' : 
                                   'Tanha, sans-serif';
    
    // Apply notification settings
    checkUpcomingPayments();
}

// Settings modal functions
function openSettingsModal() {
    document.getElementById('settings-modal').style.display = 'flex';
    
    // Set current settings in the form
    document.getElementById('notification-days').value = settings.notificationDays;
    document.getElementById('enable-notifications').checked = settings.enableNotifications;
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('font-select').value = settings.font;
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function saveSettingsFromForm() {
    settings.notificationDays = parseInt(document.getElementById('notification-days').value);
    settings.enableNotifications = document.getElementById('enable-notifications').checked;
    settings.theme = document.getElementById('theme-select').value;
    settings.font = document.getElementById('font-select').value;
    
    saveSettings();
    closeSettingsModal();
}

// Initialize settings modal buttons
document.querySelector('[href="#settings"]').addEventListener('click', openSettingsModal);
document.getElementById('save-settings-btn').addEventListener('click', saveSettingsFromForm);