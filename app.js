// ═══════════════════════════════════════════════════════════════
// 🎸 RepRasp - Telegram Web App (Без бэкенда, только бот!)
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// 🔧 КОНФИГУРАЦИЯ
// ───────────────────────────────────────────────────────────────

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

// Типы действий для бота (как enum в Rust)
const ACTIONS = {
    LOAD_SCHEDULE: 'load_schedule',
    ADD_REHEARSAL: 'add_rehearsal',
    DELETE_REHEARSAL: 'delete_rehearsal',
    LOAD_REQUESTS: 'load_requests',
    APPROVE_REQUEST: 'approve_request',
    REJECT_REQUEST: 'reject_request',
    CHECK_ADMIN: 'check_admin'
};

// ───────────────────────────────────────────────────────────────
// 🚀 ИНИЦИАЛИЗАЦИЯ
// ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎸 RepRasp Web App (Bot Architecture) загружается...');

    initTelegram();
    setupEventListeners();

    // Загружаем расписание при старте
    sendToBot({ action: ACTIONS.LOAD_SCHEDULE });
});

// ───────────────────────────────────────────────────────────────
// 📱 TELEGRAM WEB APP INIT
// ───────────────────────────────────────────────────────────────

function initTelegram() {
    TG.ready();
    TG.expand();

    // Получаем данные пользователя
    const user = TG.initDataUnsafe.user;

    if (user) {
        state.userId = user.id;
        state.userChatId = user.id;
        state.userName = `${user.first_name} ${user.last_name || ''}`.trim();

        // Настраиваем тему Telegram
        TG.setHeaderColor(TG.themeParams.bg_color || '#1c1c1e');
        TG.setBackgroundColor(TG.themeParams.bg_color || '#1c1c1e');

        // Включаем подтверждение для главных кнопок
        TG.enableClosingConfirmation();

        showToast(`Добро пожаловать, ${user.first_name}! 🎸`);
    }

    // Обработчик получения данных от бота (через mainButton или другие события)
    // Примечание: бот не может напрямую отправить данные в Web App,
    // но мы можем использовать TG.onEvent для некоторых событий

    TG.ready();
}

// ───────────────────────────────────────────────────────────────
// 📡 ОТПРАВКА ДАННЫХ БОТУ (вместо API запросов!)
// ───────────────────────────────────────────────────────────────

/**
 * Отправляет данные боту через Telegram Web App
 *
 * Бот получит это в update.message.web_app_data.data
 *
 * @param {Object} data - данные для отправки
 */
function sendToBot(data) {
    // Добавляем идентификатор пользователя
    const payload = {
        ...data,
        user_id: state.userId,
        chat_id: state.userChatId,
        user_name: state.userName,
        timestamp: new Date().toISOString()
    };

    console.log('📤 Отправка боту:', payload);

    // sendData отправляет данные боту и закрывает Web App
    // Но мы можем использовать Telegram.WebApp.sendData() для отправки
    TG.sendData(JSON.stringify(payload));

    // Показываем индикатор отправки
    showToast('📤 Отправлено боту...');
}

/**
 * Альтернатива: использовать haptic feedback и показать пользователю
 * что данные отправлены, но Web App не закрывается
 *
 * Для этого бот должен отправить новое сообщение с inline keyboard
 * содержащим URL Web App с параметрами
 */
function sendToBotWithoutClose(data) {
    const payload = {
        ...data,
        user_id: state.userId,
        chat_id: state.userChatId,
        user_name: state.userName,
        timestamp: new Date().toISOString()
    };

    console.log('📤 Отправка боту (без закрытия):', payload);

    // Используем sendData - это закроет Web App
    // Альтернатива: бот может polling'ом проверять состояние
    TG.sendData(JSON.stringify(payload));

    // Вибрация для подтверждения (как haptic feedback в iOS)
    TG.HapticFeedback.notificationOccurred('success');
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

    // ─── Кнопка обновления расписания ───
    // (уже есть onclick в HTML)

    // ─── Обработка сообщений от бота (через URL параметры) ───
    // Бот может перезапустить Web App с параметрами в URL
    parseUrlParams();
}

// ───────────────────────────────────────────────────────────────
// 🔍 ПАРСИНГ ПАРАМЕТРОВ ОТ БОТА
// ───────────────────────────────────────────────────────────────

/**
 * Бот может передать данные через URL параметры при открытии Web App
 * Например: https://your.github.io/app.html?data={"action":"schedule_updated"}
 */
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');

    if (dataParam) {
        try {
            const data = JSON.parse(decodeURIComponent(dataParam));
            handleBotResponse(data);
        } catch (e) {
            console.error('Failed to parse URL data:', e);
        }
    }

    // Также проверяем hash (альтернативный способ)
    const hashParam = urlParams.get('hash');
    if (hashParam) {
        // Можно использовать для верификации
        console.log('Hash received:', hashParam);
    }
}

/**
 * Обработка ответа от бота
 *
 * @param {Object} data - данные от бота
 */
function handleBotResponse(data) {
    console.log('📥 Получено от бота:', data);

    switch (data.action) {
        case 'schedule_loaded':
            state.schedule = data.data || [];
            renderSchedule(state.schedule);
            toggleLoading('schedule-loading', false);
            toggleEmpty('schedule-empty', state.schedule.length === 0);
            toggleList('schedule-list', state.schedule.length > 0);
            showToast('📅 Расписание обновлено!');
            break;

        case 'schedule_updated':
            // Перезагружаем расписание
            sendToBot({ action: ACTIONS.LOAD_SCHEDULE });
            showToast('✅ Расписание обновлено!');
            break;

        case 'requests_loaded':
            state.requests = data.data || [];
            state.isAdmin = data.is_admin || false;
            renderRequests(state.requests);
            toggleLoading('requests-loading', false);

            if (!state.isAdmin) {
                toggleEmpty('requests-admin-check', true);
                toggleList('requests-list', false);
            } else if (state.requests.length === 0) {
                toggleEmpty('requests-empty', true);
                toggleList('requests-list', false);
            } else {
                toggleEmpty('requests-empty', false);
                toggleEmpty('requests-admin-check', false);
                toggleList('requests-list', true);
            }
            break;

        case 'request_processed':
            sendToBot({ action: ACTIONS.LOAD_REQUESTS });
            showToast(data.success ? '✅ Заявка обработана!' : '❌ Ошибка обработки');
            break;

        case 'error':
            showToast(`❌ ${data.message || 'Ошибка'}`);
            TG.HapticFeedback.notificationOccurred('error');
            break;

        default:
            console.log('Неизвестное действие:', data.action);
    }
}

// ───────────────────────────────────────────────────────────────
// 🔄 ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ───────────────────────────────────────────────────────────────

function switchTab(tabName) {
    state.currentTab = tabName;

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);

    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');

    // Загружаем данные для вкладки
    if (tabName === 'schedule') {
        toggleLoading('schedule-loading', true);
        sendToBot({ action: ACTIONS.LOAD_SCHEDULE });
    } else if (tabName === 'requests') {
        toggleLoading('requests-loading', true);
        sendToBot({ action: ACTIONS.LOAD_REQUESTS });
    }
}

function switchToFunctions() {
    switchTab('functions');
}

// ───────────────────────────────────────────────────────────────
// 📅 ЗАГРУЗКА РАСПИСАНИЯ
// ───────────────────────────────────────────────────────────────

function loadSchedule() {
    toggleLoading('schedule-loading', true);
    sendToBot({ action: ACTIONS.LOAD_SCHEDULE });
}

function renderSchedule(schedule) {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '';

    if (!schedule || schedule.length === 0) {
        return;
    }

    // Сортируем по дате
    const sorted = schedule.sort((a, b) =>
        new Date(a.datetime) - new Date(b.datetime)
    );

    // Группируем по датам
    const grouped = {};
    sorted.forEach(item => {
        const date = new Date(item.datetime).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(item);
    });

    // Создаём HTML
    for (const [date, items] of Object.entries(grouped)) {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'schedule-date-header';
        dateHeader.textContent = date;
        container.appendChild(dateHeader);

        items.forEach(item => {
            const card = createRehearsalCard(item);
            container.appendChild(card);
        });
    }
}

function createRehearsalCard(item) {
    const card = document.createElement('div');
    card.className = 'rehearsal-card';

    const date = new Date(item.datetime);
    const time = date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    card.innerHTML = `
        <div class="card-time">⏰ ${time}</div>
        <div class="card-group">🎸 ${escapeHtml(item.group_name)}</div>
        <div class="card-location">📍 ${escapeHtml(item.location || 'Студия')}</div>
        ${item.admin_only ? '<div class="card-badge">🔒 Админ</div>' : ''}
    `;

    return card;
}

// ───────────────────────────────────────────────────────────────
// ➕ ДОБАВЛЕНИЕ РЕПЕТИЦИИ
// ───────────────────────────────────────────────────────────────

function handleAddRehearsal(form) {
    const groupName = document.getElementById('add-group').value.trim();
    const datetime = document.getElementById('add-datetime').value;

    if (!groupName || !datetime) {
        showToast('⚠️ Заполните все поля!');
        TG.HapticFeedback.notificationOccurred('warning');
        return;
    }

    if (new Date(datetime) < new Date()) {
        showToast('⚠️ Нельзя добавить репетицию в прошлом!');
        TG.HapticFeedback.notificationOccurred('warning');
        return;
    }

    // Отправляем боту
    sendToBot({
        action: ACTIONS.ADD_REHEARSAL,
        group_name: groupName,
        datetime: datetime
    });

    form.reset();

    // Вибрация подтверждения
    TG.HapticFeedback.impactOccurred('light');
}

// ───────────────────────────────────────────────────────────────
// ➖ УДАЛЕНИЕ РЕПЕТИЦИИ
// ───────────────────────────────────────────────────────────────

function handleDeleteRehearsal(form) {
    const groupName = document.getElementById('delete-group').value.trim();
    const datetime = document.getElementById('delete-datetime').value;

    if (!groupName || !datetime) {
        showToast('⚠️ Заполните все поля!');
        TG.HapticFeedback.notificationOccurred('warning');
        return;
    }

    sendToBot({
        action: ACTIONS.DELETE_REHEARSAL,
        group_name: groupName,
        datetime: datetime
    });

    form.reset();
    TG.HapticFeedback.impactOccurred('light');
}

// ───────────────────────────────────────────────────────────────
// 📨 ЗАЯВКИ
// ───────────────────────────────────────────────────────────────

function loadRequests() {
    toggleLoading('requests-loading', true);
    sendToBot({ action: ACTIONS.LOAD_REQUESTS });
}

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

function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';

    const date = new Date(request.datetime);
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

function approveRequest(requestId) {
    TG.HapticFeedback.impactOccurred('medium');
    sendToBot({
        action: ACTIONS.APPROVE_REQUEST,
        request_id: requestId
    });
}

function rejectRequest(requestId) {
    TG.HapticFeedback.impactOccurred('medium');
    sendToBot({
        action: ACTIONS.REJECT_REQUEST,
        request_id: requestId
    });
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ───────────────────────────────────────────────────────────────
// 🎯 ГЛОБАЛЬНЫЕ ФУНКЦИИ
// ───────────────────────────────────────────────────────────────

window.loadSchedule = loadSchedule;
window.loadRequests = loadRequests;
window.switchToFunctions = switchToFunctions;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.handleBotResponse = handleBotResponse;

// ───────────────────────────────────────────────────────────────
// 🏁 КОНЕЦ СКРИПТА
// ───────────────────────────────────────────────────────────────

console.log('🎸 RepRasp app.js загружен (Bot Architecture)!');