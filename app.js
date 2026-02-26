// ═══════════════════════════════════════════════════════════════
// 🎸 RepRasp - Telegram Web App (Flask + Tailscale)
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// 🔧 КОНФИГУРАЦИЯ
// ───────────────────────────────────────────────────────────────

// Твой Tailscale URL (из Flask сервера)
const API_BASE_URL = 'https://wulwa-x99.tailfc3d11.ts.net/api';

// Telegram Web App объект
const TG = window.Telegram.WebApp;

// Состояние приложения (как dataclass в Python)
const state = {
    currentTab: 'schedule',
    userId: null,
    userChatId: null,
    userName: null,
    isAdmin: false,
    schedule: [],
    requests: [],
    isLoading: false
};

// ───────────────────────────────────────────────────────────────
// 🚀 ИНИЦИАЛИЗАЦИЯ
// ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎸 RepRasp Web App (Flask + Tailscale) загружается...');

    // Инициализируем Telegram Web App
    initTelegram();

    // Настраиваем обработчики событий
    setupEventListeners();

    // Загружаем расписание при старте
    loadSchedule();
});

// ───────────────────────────────────────────────────────────────
// 📱 TELEGRAM WEB APP INIT
// ───────────────────────────────────────────────────────────────

function initTelegram() {
    // Обязательно вызываем ready() первым!
    TG.ready();
    TG.expand();

    // Получаем данные пользователя
    const user = TG.initDataUnsafe?.user;

    if (user) {
        state.userId = user.id;
        state.userChatId = user.id;
        state.userName = `${user.first_name} ${user.last_name || ''}`.trim();

        console.log('✅ Пользователь:', state.userName, `(ID: ${state.userId})`);
    } else {
        // Пробуем распарсить initData вручную (для Desktop)
        const userData = parseInitData(TG.initData);
        if (userData) {
            state.userId = userData.user_id;
            state.userChatId = userData.user_id;
            state.userName = userData.username || userData.first_name || 'User';
            console.log('✅ Пользователь из initData:', state.userName);
        } else {
            console.warn('⚠️ Не удалось получить данные пользователя');
            state.userName = 'Unknown';
        }
    }

    // Настраиваем тему Telegram
    setupTheme();

    // Включаем подтверждение закрытия
    TG.enableClosingConfirmation();

    showToast(`Добро пожаловать, ${state.userName.split(' ')[0]}! 🎸`);
}

/**
 * Парсит initData вручную (для обхода багов Desktop)
 */
function parseInitData(initData) {
    if (!initData) return null;

    try {
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');

        if (userJson) {
            return JSON.parse(decodeURIComponent(userJson));
        }
    } catch (e) {
        console.error('Failed to parse initData:', e);
    }

    return null;
}

/**
 * Настраивает тему Telegram
 */
function setupTheme() {
    const theme = TG.themeParams;

    if (theme.bg_color) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
    }
    if (theme.text_color) {
        document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
    }
    if (theme.button_color) {
        document.documentElement.style.setProperty('--tg-theme-button-color', theme.button_color);
    }
    if (theme.button_text_color) {
        document.documentElement.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
    }

    TG.setHeaderColor(theme.bg_color || '#1c1c1e');
    TG.setBackgroundColor(theme.bg_color || '#1c1c1e');
}

// ───────────────────────────────────────────────────────────────
// 📡 API ЗАПРОСЫ (Flask бэкенд)
// ───────────────────────────────────────────────────────────────

/**
 * Универсальная функция для HTTP запросов к Flask API
 *
 * @param {string} endpoint - путь к API (например, '/schedule/list')
 * @param {string} method - HTTP метод (GET, POST)
 * @param {Object} data - данные для отправки (для POST)
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}${endpoint}`;

    // Формируем заголовки
    const headers = {
        'Content-Type': 'application/json',
    };

    // Добавляем ID пользователя для авторизации
    if (state.userId) {
        headers['X-User-Id'] = state.userId.toString();
    }

    // Формируем опции запроса
    const options = {
        method: method,
        headers: headers,
    };

    // Добавляем тело запроса если есть данные
    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        console.log(`📤 ${method} ${url}`, data || '');

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }

        console.log(`📥 Ответ:`, result);
        return result;

    } catch (error) {
        console.error('❌ API Error:', error);
        showToast(`❌ Ошибка: ${error.message}`);
        TG.HapticFeedback.notificationOccurred('error');
        throw error;
    }
}

// ───────────────────────────────────────────────────────────────
// 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
// ───────────────────────────────────────────────────────────────

function setupEventListeners() {
    // ─── Переключение вкладок ───
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const tabName = event.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });

    // ─── Форма добавления репетиции ───
    const addForm = document.getElementById('add-form');
    addForm.addEventListener('submit', (event) => {
        event.preventDefault();
        handleAddRehearsal(event.target);
    });

    // ─── Форма удаления репетиции ───
    const deleteForm = document.getElementById('delete-form');
    deleteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        handleDeleteRehearsal(event.target);
    });

    // ─── Установка минимальной даты в datetime-local ───
    setMinDateTime();
}

/**
 * Устанавливает минимальную дату (текущее время) для input datetime-local
 */
function setMinDateTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);

    const addInput = document.getElementById('add-datetime');
    const deleteInput = document.getElementById('delete-datetime');

    if (addInput) addInput.min = localISOTime;
    if (deleteInput) deleteInput.min = localISOTime;
}

// ───────────────────────────────────────────────────────────────
// 🔄 ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ───────────────────────────────────────────────────────────────

function switchTab(tabName) {
    state.currentTab = tabName;

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Убираем active у всех
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Добавляем active нужным
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);

    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');

    // Загружаем данные для вкладки
    if (tabName === 'schedule') {
        loadSchedule();
    } else if (tabName === 'requests') {
        loadRequests();
    }

    // Вибрация при переключении
    TG.HapticFeedback.selectionChanged();
}

function switchToFunctions() {
    switchTab('functions');
}

// ───────────────────────────────────────────────────────────────
// 📅 ЗАГРУЗКА РАСПИСАНИЯ
// ───────────────────────────────────────────────────────────────

async function loadSchedule() {
    toggleLoading('schedule-loading', true);
    toggleEmpty('schedule-empty', false);
    toggleList('schedule-list', false);

    try {
        const response = await apiRequest('/schedule/list', 'GET');
        state.schedule = response.data || [];
        renderSchedule(state.schedule);

        toggleLoading('schedule-loading', false);

        if (state.schedule.length === 0) {
            toggleEmpty('schedule-empty', true);
        } else {
            toggleList('schedule-list', true);
        }

    } catch (error) {
        toggleLoading('schedule-loading', false);
        toggleEmpty('schedule-empty', true);
        console.error('Failed to load schedule:', error);
    }
}

/**
 * Отрисовывает расписание в HTML
 */
function renderSchedule(schedule) {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '';

    if (!schedule || schedule.length === 0) {
        return;
    }

    // Сортируем по дате
    const sorted = schedule.sort((a, b) => {
        // Парсим дату в формате DD.MM.YYYY HH:MM
        const parseDate = (d) => {
            const [datePart, timePart] = d.split(' ');
            const [day, month, year] = datePart.split('.');
            const [hours, minutes] = timePart.split(':');
            return new Date(year, month - 1, day, hours, minutes);
        };
        return parseDate(a.date_time) - parseDate(b.date_time);
    });

    // Группируем по датам
    const grouped = {};
    sorted.forEach(item => {
        const [datePart] = item.date_time.split(' ');
        const [day, month, year] = datePart.split('.');
        const date = new Date(year, month - 1, day);
        const dateStr = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(item);
    });

    // Создаём HTML для каждой группы
    for (const [date, items] of Object.entries(grouped)) {
        // Заголовок даты
        const dateHeader = document.createElement('div');
        dateHeader.className = 'schedule-date-header';
        dateHeader.textContent = date;
        container.appendChild(dateHeader);

        // Карточки репетиций
        items.forEach(item => {
            const card = createRehearsalCard(item);
            container.appendChild(card);
        });
    }
}

/**
 * Создаёт HTML карточку репетиции
 */
function createRehearsalCard(item) {
    const card = document.createElement('div');
    card.className = 'rehearsal-card';

    // Парсим время из DD.MM.YYYY HH:MM
    const [datePart, timePart] = item.date_time.split(' ');

    card.innerHTML = `
        <div class="card-time">⏰ ${timePart}</div>
        <div class="card-group">🎸 ${escapeHtml(item.group_name)}</div>
        <div class="card-location">📍 ${escapeHtml(item.location || 'Студия')}</div>
        ${item.admin_only ? '<div class="card-badge">🔒 Админ</div>' : ''}
    `;

    return card;
}

// ───────────────────────────────────────────────────────────────
// ➕ ДОБАВЛЕНИЕ РЕПЕТИЦИИ
// ───────────────────────────────────────────────────────────────

async function handleAddRehearsal(form) {
    const groupName = document.getElementById('add-group').value.trim();
    const datetime = document.getElementById('add-datetime').value;

    if (!groupName || !datetime) {
        showToast('⚠️ Заполните все поля!');
        TG.HapticFeedback.notificationOccurred('warning');
        return;
    }

    // Конвертируем из ISO формата в DD.MM.YYYY HH:MM
    const isoDate = new Date(datetime);
    const day = String(isoDate.getDate()).padStart(2, '0');
    const month = String(isoDate.getMonth() + 1).padStart(2, '0');
    const year = isoDate.getFullYear();
    const hours = String(isoDate.getHours()).padStart(2, '0');
    const minutes = String(isoDate.getMinutes()).padStart(2, '0');
    const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}`;

    // Проверяем, что дата не в прошлом
    if (isoDate < new Date()) {
        showToast('⚠️ Нельзя добавить репетицию в прошлом!');
        TG.HapticFeedback.notificationOccurred('warning');
        return;
    }

    try {
        await apiRequest('/schedule/add', 'POST', {
            group_name: groupName,
            datetime: formattedDateTime,
            action: 'add',
            user_id: state.userId,
            user_name: state.userName
        });

        showToast('✅ Заявка на добавление создана!');
        TG.HapticFeedback.notificationOccurred('success');
        form.reset();

        // Переключаемся на расписание
        switchTab('schedule');

    } catch (error) {
        console.error('Add rehearsal failed:', error);
    }
}

// ───────────────────────────────────────────────────────────────
// ➖ УДАЛЕНИЕ РЕПЕТИЦИИ
// ───────────────────────────────────────────────────────────────

async function handleDeleteRehearsal(form) {
    const groupName = document.getElementById('delete-group').value.trim();
    const datetime = document.getElementById('delete-datetime').value;

    if (!groupName || !datetime) {
        showToast('⚠️ Заполните все поля!');
        TG.HapticFeedback.notificationOccurred('warning');
        return;
    }

    // Конвертируем из ISO формата в DD.MM.YYYY HH:MM
    const isoDate = new Date(datetime);
    const day = String(isoDate.getDate()).padStart(2, '0');
    const month = String(isoDate.getMonth() + 1).padStart(2, '0');
    const year = isoDate.getFullYear();
    const hours = String(isoDate.getHours()).padStart(2, '0');
    const minutes = String(isoDate.getMinutes()).padStart(2, '0');
    const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}`;

    try {
        await apiRequest('/schedule/delete', 'POST', {
            group_name: groupName,
            datetime: formattedDateTime,
            action: 'delete',
            user_id: state.userId,
            user_name: state.userName
        });

        showToast('✅ Заявка на удаление создана!');
        TG.HapticFeedback.notificationOccurred('success');
        form.reset();

        switchTab('schedule');

    } catch (error) {
        console.error('Delete rehearsal failed:', error);
    }
}

// ───────────────────────────────────────────────────────────────
// 📨 ЗАЯВКИ (ADMIN ONLY)
// ───────────────────────────────────────────────────────────────

async function loadRequests() {
    toggleLoading('requests-loading', true);
    toggleEmpty('requests-empty', false);
    toggleEmpty('requests-admin-check', false);
    toggleList('requests-list', false);

    try {
        // Проверяем админа
        const adminResponse = await apiRequest('/admin/check', 'GET');
        state.isAdmin = adminResponse.is_admin || false;

        if (!state.isAdmin) {
            toggleLoading('requests-loading', false);
            toggleEmpty('requests-admin-check', true);
            showToast('🔒 Доступ только для админов');
            return;
        }

        // Загружаем заявки
        const requestsResponse = await apiRequest('/requests/list', 'GET');
        state.requests = requestsResponse.data || [];

        renderRequests(state.requests);

        toggleLoading('requests-loading', false);

        if (state.requests.length === 0) {
            toggleEmpty('requests-empty', true);
        } else {
            toggleList('requests-list', true);
        }

    } catch (error) {
        toggleLoading('requests-loading', false);
        toggleEmpty('requests-admin-check', true);
        console.error('Failed to load requests:', error);
    }
}

/**
 * Отрисовывает список заявок
 */
function renderRequests(requests) {
    const container = document.getElementById('requests-list');
    container.innerHTML = '';

    if (!requests || requests.length === 0) {
        return;
    }

    requests.forEach(request => {
        const card = createRequestCard(request);
        container.appendChild(card);
    });
}

/**
 * Создаёт карточку заявки
 */
function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';

    // Парсим дату из DD.MM.YYYY HH:MM
    const [datePart, timePart] = request.date_time.split(' ');
    const [day, month, year] = datePart.split('.');
    const date = new Date(year, month - 1, day);

    const formattedDate = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    });

    const actionEmoji = request.action === 'add' ? '➕' : '➖';
    const actionText = request.action === 'add' ? 'Добавление' : 'Удаление';

    card.innerHTML = `
        <div class="request-header">
            <span class="request-action">${actionEmoji} ${actionText}</span>
            <span class="request-date">${formattedDate}</span>
        </div>
        <div class="request-group">🎸 ${escapeHtml(request.group_name)}</div>
        <div class="request-user">👤 ${escapeHtml(request.user_name || 'Аноним')}</div>
        <div class="request-actions">
            <button class="btn btn-success btn-sm" onclick="approveRequest(${request.id})">
                ✅ Одобрить
            </button>
            <button class="btn btn-danger btn-sm" onclick="rejectRequest(${request.id})">
                ❌ Отклонить
            </button>
        </div>
    `;

    return card;
}

/**
 * Одобрить заявку
 */
async function approveRequest(requestId) {
    TG.HapticFeedback.impactOccurred('medium');

    try {
        await apiRequest(`/requests/${requestId}/approve`, 'POST');
        showToast('✅ Заявка одобрена!');
        loadRequests(); // Обновляем список
    } catch (error) {
        console.error('Approve failed:', error);
    }
}

/**
 * Отклонить заявку
 */
async function rejectRequest(requestId) {
    TG.HapticFeedback.impactOccurred('medium');

    try {
        await apiRequest(`/requests/${requestId}/reject`, 'POST');
        showToast('❌ Заявка отклонена!');
        loadRequests();
    } catch (error) {
        console.error('Reject failed:', error);
    }
}

// ───────────────────────────────────────────────────────────────
// 🎨 UI ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ───────────────────────────────────────────────────────────────

function toggleLoading(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle('hidden', !show);
    }
}

function toggleEmpty(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle('hidden', !show);
    }
}

function toggleList(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle('hidden', !show);
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    toastMessage.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

/**
 * Экранирует HTML для безопасности (защита от XSS)
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ───────────────────────────────────────────────────────────────
// 🎯 ГЛОБАЛЬНЫЕ ФУНКЦИИ (для onclick в HTML)
// ───────────────────────────────────────────────────────────────

window.loadSchedule = loadSchedule;
window.loadRequests = loadRequests;
window.switchToFunctions = switchToFunctions;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;

// ───────────────────────────────────────────────────────────────
// 🏁 КОНЕЦ СКРИПТА
// ───────────────────────────────────────────────────────────────

console.log('🎸 RepRasp app.js загружен (Flask + Tailscale)!');
console.log('💡 API URL:', API_BASE_URL);