// ═══════════════════════════════════════════════════════════════
// 🎸 RepRasp - Telegram Web App (HYBRID ARCHITECTURE)
// ═══════════════════════════════════════════════════════════════
// Ларс, теперь мы обходим все ограничения Telegram~

// ───────────────────────────────────────────────────────────────
// 🔧 КОНФИГУРАЦИЯ
// ───────────────────────────────────────────────────────────────

const TG = window.Telegram.WebApp;

// Состояние приложения
const state = {
    currentTab: 'schedule',
    userId: null,
    userChatId: null,
    userName: null,
    isAdmin: false,
    schedule: [],
    requests: [],
    isLoading: false,
    isDataSent: false  // Флаг: отправили ли уже данные боту
};

// Типы действий
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
    console.log('🎸 RepRasp Web App (HYBRID) загружается...');

    // КРИТИЧЕСКИ ВАЖНО: ready() должен быть вызван ПЕРВЫМ!
    TG.ready();
    TG.expand();

    // Инициализируем пользователя (с обработкой багов Desktop)
    initUser();

    // Настраиваем UI
    setupTheme();
    setupEventListeners();

    // Проверяем, есть ли данные от бота в URL
    parseUrlParams();

    // Если нет данных в URL — запрашиваем расписание
    if (!state.hasUrlData) {
        toggleLoading('schedule-loading', true);
        // Для InlineKeyboard: используем MainButton для отправки запроса
        setupMainButton();
    }
});

// ───────────────────────────────────────────────────────────────
// 👤 ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ (с обработкой багов)
// ───────────────────────────────────────────────────────────────

/**
 * Инициализирует данные пользователя
 *
 * Баг Telegram Desktop: initDataUnsafe.user может быть null при открытии через ReplyKeyboard
 * Решение: используем initData с парсингом или запрашиваем у бота
 */
function initUser() {
    console.log('🔍 initData:', TG.initData ? 'есть' : 'нет');
    console.log('🔍 initDataUnsafe:', TG.initDataUnsafe);

    // Способ 1: initDataUnsafe (может быть null на Desktop)
    const user = TG.initDataUnsafe?.user;

    if (user) {
        state.userId = user.id;
        state.userChatId = user.id;
        state.userName = `${user.first_name} ${user.last_name || ''}`.trim();
        console.log('✅ Пользователь из initDataUnsafe:', state.userName);
    } else {
        // Способ 2: Парсим initData вручную (более надёжно)
        const userData = parseInitData(TG.initData);
        if (userData) {
            state.userId = userData.user_id;
            state.userChatId = userData.user_id;
            state.userName = userData.username || userData.first_name || 'User';
            console.log('✅ Пользователь из initData:', state.userName);
        } else {
            // Способ 3: Заглушка (бот должен проверить по chat_id)
            state.userId = null;
            state.userChatId = null;
            state.userName = 'Unknown';
            console.warn('⚠️ Не удалось получить данные пользователя!');
            showToast('⚠️ Проверка пользователя...');
        }
    }
}

/**
 * Парсит initData вручную (query string формат)
 *
 * @param {string} initData - строка initData от Telegram
 * @returns {Object|null} распарсенные данные
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

// ───────────────────────────────────────────────────────────────
// 🎨 ТЕМА И UI
// ───────────────────────────────────────────────────────────────

function setupTheme() {
    // Устанавливаем цвета темы Telegram
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
// 🔘 MAIN BUTTON (для InlineKeyboard!)
// ───────────────────────────────────────────────────────────────

/**
 * Настраивает MainButton для отправки данных боту
 *
 * Это альтернатива sendData() для InlineKeyboard!
 * MainButton видна всегда и не закрывает App автоматически
 */
function setupMainButton() {
    const mainButton = TG.MainButton;

    // Настраиваем кнопку
    mainButton.setText('📤 ОТПРАВИТЬ БОТУ');
    mainButton.textColor = '#ffffff';
    mainButton.color = '#2481cc';

    // Показываем только когда есть данные для отправки
    mainButton.hide();

    // Обработчик клика
    mainButton.onClick(() => {
        if (state.pendingData) {
            // Отправляем данные
            TG.sendData(JSON.stringify(state.pendingData));
            // Закрываем App (это ожидаемое поведение)
            TG.close();
        }
    });
}

/**
 * Показывает MainButton с данными для отправки
 *
 * @param {Object} data - данные для отправки
 */
function showMainButton(data) {
    state.pendingData = data;

    const mainButton = TG.MainButton;
    mainButton.setText('✅ Подтвердить и отправить');
    mainButton.show();

    // Вибрация
    TG.HapticFeedback.impactOccurred('light');
}

function hideMainButton() {
    const mainButton = TG.MainButton;
    mainButton.hide();
    state.pendingData = null;
}

// ───────────────────────────────────────────────────────────────
// 📡 ОТПРАВКА ДАННЫХ БОТУ
// ───────────────────────────────────────────────────────────────

/**
 * Отправляет данные боту
 *
 * ВАЖНО: sendData() ВСЕГДА закрывает Web App!
 * Это поведение Telegram, его нельзя изменить.
 *
 * @param {Object} data - данные для отправки
 */
function sendToBot(data) {
    // Добавляем данные пользователя
    const payload = {
        ...data,
        user_id: state.userId,
        chat_id: state.userChatId,
        user_name: state.userName,
        timestamp: new Date().toISOString()
    };

    console.log('📤 Отправка боту:', payload);

    // Проверяем, есть ли данные пользователя
    if (!payload.user_id) {
        showToast('⚠️ Ошибка: пользователь не определён!');
        TG.HapticFeedback.notificationOccurred('error');
        return;
    }

    // Отправляем и закрываем
    TG.sendData(JSON.stringify(payload));

    // Вибрация
    TG.HapticFeedback.notificationOccurred('success');

    // Показываем toast перед закрытием
    showToast('📤 Отправлено боту...');

    // Закрываем через небольшую задержку (для показа toast)
    setTimeout(() => {
        TG.close();
    }, 500);
}

// ───────────────────────────────────────────────────────────────
// 🔍 ПАРСИНГ ПАРАМЕТРОВ ОТ БОТА
// ───────────────────────────────────────────────────────────────

state.hasUrlData = false;

/**
 * Бот передаёт данные через URL параметры
 *
 * Формат: https://your.github.io/app.html?tgWebAppData=...&data={...}
 */
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    // Проверяем data параметр (от бота)
    const dataParam = urlParams.get('data');

    if (dataParam) {
        try {
            const data = JSON.parse(decodeURIComponent(dataParam));
            console.log('📥 Получено из URL:', data);
            state.hasUrlData = true;
            handleBotResponse(data);
        } catch (e) {
            console.error('Failed to parse URL ', e);
        }
    }

    // Также проверяем стандартный tgWebAppData
    const tgData = urlParams.get('tgWebAppData');
    if (tgData && !TG.initData) {
        // Это резервный способ получения initData
        console.log('tgWebAppData found in URL');
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
            showToast('📅 Расписание загружено!');
            break;

        case 'schedule_updated':
            // Перезагружаем расписание
            toggleLoading('schedule-loading', true);
            // Запрашиваем свежие данные
            requestSchedule();
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
            requestRequests();
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
// 🔄 ЗАПРОС ДАННЫХ ОТ БОТА (через MainButton)
// ───────────────────────────────────────────────────────────────

/**
 * Запрашивает расписание у бота
 *
 * Для InlineKeyboard: показываем MainButton, пользователь нажимает
 * Для ReplyKeyboard: sendData() сразу
 */
function requestSchedule() {
    const requestData = {
        action: ACTIONS.LOAD_SCHEDULE
    };

    // Проверяем тип открытия (можно определить по наличию initData)
    if (TG.initData) {
        // InlineKeyboard: используем MainButton
        showMainButton(requestData);
    } else {
        // ReplyKeyboard: отправляем сразу
        sendToBot(requestData);
    }
}

/**
 * Запрашивает заявки у бота
 */
function requestRequests() {
    const requestData = {
        action: ACTIONS.LOAD_REQUESTS
    };

    if (TG.initData) {
        showMainButton(requestData);
    } else {
        sendToBot(requestData);
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
        requestSchedule();
    } else if (tabName === 'requests') {
        toggleLoading('requests-loading', true);
        requestRequests();
    }

    // Скрываем MainButton при переключении
    hideMainButton();
}

function switchToFunctions() {
    switchTab('functions');
}

// ───────────────────────────────────────────────────────────────
// 📅 ЗАГРУЗКА РАСПИСАНИЯ
// ───────────────────────────────────────────────────────────────

function loadSchedule() {
    toggleLoading('schedule-loading', true);
    requestSchedule();
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

    // Отправляем боту (App закроется!)
    sendToBot({
        action: ACTIONS.ADD_REHEARSAL,
        group_name: groupName,
        datetime: datetime
    });

    form.reset();
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
}

// ───────────────────────────────────────────────────────────────
// 📨 ЗАЯВКИ
// ───────────────────────────────────────────────────────────────

function loadRequests() {
    toggleLoading('requests-loading', true);
    requestRequests();
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

console.log('🎸 RepRasp app.js загружен (HYBRID ARCHITECTURE)!');
console.log('💡 Ларс, теперь используй InlineKeyboard для открытия!');