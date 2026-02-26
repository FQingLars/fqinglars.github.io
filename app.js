const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

let currentUser = null;
let isAdmin = false;

function getCurrentUser() {
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return {
            id: tg.initDataUnsafe.user.id,
            username: tg.initDataUnsafe.user.username,
            first_name: tg.initDataUnsafe.user.first_name,
            auth_date: tg.initDataUnsafe.auth_date,
            hash: tg.initDataUnsafe.hash
        };
    }

    return {
        id: 123456789,
        username: 'test_user',
        auth_date: null,
        hash: null
    };
}

function parseInitData(initData) {
    const params = new URLSearchParams(initData);
    const result = {};

    for (const [key, value] of params) {
        try {
            result[key] = value.startsWith('{') || value.startsWith('[')
                ? JSON.parse(value)
                : value;
        } catch {
            result[key] = value;
        }
    }
    return result;
}

document.addEventListener('DOMContentLoaded', () => {
    currentUser = getCurrentUser();

    initTabs();
    initForms();
    loadSchedule();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'schedule') {
        loadSchedule();
    } else if (tabId === 'requests') {
        loadRequests();
    }
}

function switchToFunctions() {
    switchTab('functions');
}

function initForms() {
    const addForm = document.getElementById('add-form');
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit('add');
    });

    const deleteForm = document.getElementById('delete-form');
    deleteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit('delete');
    });

    setMinDateTime();
}

function setMinDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);

    document.getElementById('add-datetime').min = minDateTime;
    document.getElementById('delete-datetime').min = minDateTime;
}

function handleSubmit(action) {
    const group = document.getElementById(`${action}-group`).value.trim();
    const datetimeInput = document.getElementById(`${action}-datetime`).value;

    if (!group || !datetimeInput) {
        showToast('Заполните все поля', 'error');
        return;
    }

    const dateObj = new Date(datetimeInput);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const timeStr = `${day}.${month}.${year} ${hours}:${minutes}`;

    const data = {
        action: action,
        group: group,
        time_str: timeStr,
        user: currentUser
    };

    console.log('Отправка данных:', data);

    try {
        tg.sendData(JSON.stringify(data));
        showToast(
            action === 'add'
                ? '✅ Заявка на добавление отправлена!'
                : '✅ Заявка на удаление отправлена!',
            'success'
        );

        document.getElementById(`${action}-form`).reset();
        setMinDateTime();

    } catch (error) {
        console.error('Ошибка отправки:', error);
        showToast('❌ Ошибка отправки данных', 'error');
    }
}

async function loadSchedule() {
    const loadingEl = document.getElementById('schedule-loading');
    const listEl = document.getElementById('schedule-list');
    const emptyEl = document.getElementById('schedule-empty');

    loadingEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    emptyEl.classList.add('hidden');

    const data = {
        action: 'get_schedule',
        user: currentUser
    };

    try {
        tg.sendData(JSON.stringify(data));
        showToast('📅 Расписание загружается...', 'success');

        setTimeout(() => {
            loadingEl.classList.add('hidden');

            emptyEl.classList.remove('hidden');
        }, 1000);

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        loadingEl.classList.add('hidden');
        showToast('❌ Ошибка загрузки расписания', 'error');
    }
}

async function loadRequests() {
    const loadingEl = document.getElementById('requests-loading');
    const listEl = document.getElementById('requests-list');
    const emptyEl = document.getElementById('requests-empty');
    const adminCheckEl = document.getElementById('requests-admin-check');

    loadingEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    adminCheckEl.classList.add('hidden');

    const data = {
        action: 'get_requests',
        user: currentUser
    };

    try {
        tg.sendData(JSON.stringify(data));

        setTimeout(() => {
            loadingEl.classList.add('hidden');

            if (isAdmin) {
                emptyEl.classList.remove('hidden');
            } else {
                adminCheckEl.classList.remove('hidden');
            }
        }, 1000);

    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        loadingEl.classList.add('hidden');
        showToast('❌ Ошибка загрузки заявок', 'error');
    }
}

function handleRequestAction(requestId, action) {
    const data = {
        action: 'handle_request',
        request_id: requestId,
        decision: action,
        user: currentUser
    };

    try {
        tg.sendData(JSON.stringify(data));
        showToast(
            action === 'accept'
                ? '✅ Заявка принята'
                : '❌ Заявка отклонена',
            'success'
        );

        setTimeout(() => {
            loadRequests();
        }, 500);

    } catch (error) {
        console.error('Ошибка обработки заявки:', error);
        showToast('❌ Ошибка обработки заявки', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    toast.className = 'toast';
    toastMessage.textContent = message;

    if (type === 'success') {
        toast.classList.add('success');
    } else if (type === 'error') {
        toast.classList.add('error');
    }

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleString('ru-RU', options);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.switchToFunctions = switchToFunctions;
window.loadSchedule = loadSchedule;
window.loadRequests = loadRequests;
window.handleRequestAction = handleRequestAction;