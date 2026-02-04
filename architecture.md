# Техническая спецификация платформы "Маркетинг"

Этот документ содержит полное описание архитектуры, функционала и компонентов маркетинговой платформы. Он предназначен для использования в качестве инструкции для сборки аналогичной системы с нуля.

## 1. Обзор архитектуры

Платформа представляет собой веб-приложение для аналитики маркетинговых данных, агрегирующее информацию из Яндекс.Метрики и Яндекс.Директа (через ручной/автоматический импорт) и Google Sheets.

### Технологический стек
- **Framework**: Next.js 14 (App Router)
- **Язык**: TypeScript
- **Стилизация**: Tailwind CSS + `tailwindcss-animate`
- **UI Библиотека**: Shadcn UI (Radix UI + Lucide React)
- **Работа с данными**: `googleapis` (Google Sheets API)
- **Графики**: Recharts
- **Утилиты**: `date-fns` (работа с датами), `xlsx` (экспорт в Excel)

## 2. Структура проекта

Стандартная структура Next.js App Router:
- `app/` — Страницы и API роуты.
- `components/` — Переиспользуемые UI компоненты.
- `lib/` — Утилиты и логика работы с данными.
- `public/` — Статические файлы.

## 3. Детальное описание функционала (UI/UX Checklist)

Для точного воссоздания платформы необходимо реализовать следующие элементы интерфейса и логики.

### 3.1. Страница "Лиды" (`app/leads/page.tsx`)

**Элементы управления (Header):**
- [x] **Кнопка "Настройки целей" (Gear Icon)**:
    - Скрывает/показывает панель настроек целей.
    - Реализована как `Button variant="ghost"` с иконкой `Settings`.
- [x] **Кнопка "Подгрузить лиды" (Smart Sync)**:
    - Зеленая кнопка (`bg-green-600`).
    - При нажатии: отправляет запрос на `/api/sync/metrika`.
    - Состояние загрузки: показывает спиннер (`Loader2`) и текст "Синхронизация...".
    - Логика дат при синхронизации: берет период от (вчера - 30 дней) до (вчера).
    - Блокируется при загрузке.
- [x] **Кнопка "Обновить таблицу"**:
    - Обычная кнопка (`variant="outline"`).
    - Просто перезапрашивает данные из Google Sheet без синхронизации с Метрикой.

**Панель настроек (Collapsible):**
- [x] **Список целей**: Чекбоксы с названиями целей из Метрики.
- [x] **Выбор**: Подсветка выбранных карточек (`bg-primary/5`).
- [x] **Кнопка "Сохранить настройки"**: Отправляет POST на `/api/metrika/settings`.

**Фильтры (Filter Panel):**
- [x] **Поиск**: Поле ввода с иконкой лупы. Фильтрует по комментарию, кампании и дате.
- [x] **Фильтр Кампаний (Multi-select)**:
    - Кнопка с выпадающим списком (Popover).
    - Список чекбоксов с доступными кампаниями.
    - Кнопка "Сбросить".
    - Счетчик выбранных: "Кампании: 3" или "Все кампании".
- [x] **Фильтр Статусов (Multi-select)**:
    - Аналогичный Popover.
    - Опции: "Квал", "Дубль", "Обычный", "Закрыто", "Без статуса".
- [x] **Фильтр "Целевой" (Multi-select)**:
    - Опции: "Целевой", "СПАМ", "Недозвон", "Дубль", и др.
- [x] **Фильтр Дат**:
    - Выбор "От" и "До".
    - Кнопка "Сбросить фильтр дат".

**Таблица Лидов:**
- [x] **Сортировка**: Кликабельные заголовки "Дата" и "Кампания" (ASC/DESC).
- [x] **Колонки**:
    - **Дата/Время**: Форматирование `dd.MM.yyyy HH:mm`.
    - **Кампания**: Цветной бейдж (`CampaignBadge`). Цвета генерируются или из настроек.
    - **Цель**: Название цели.
    - **Целевой (Статус)**: Редактируемый Click-to-edit. При клике превращается в Select. Цветовое кодирование (Зеленый=Целевой, Красный=Спам, Желтый=Дубль).
    - **Квалификация**: Редактируемый Select. (Зеленый=Квал, Красный=Дубль).
    - **Продажа (Сумма)**: Редактируемый Input. При сохранении обновляет ячейку.
    - **Комментарий**: Редактируемый Input.
- [x] **Inline Editing**: Изменения ("Квал", "Целевой") сохраняются мгновенно (PATCH запрос `/api/leads`). Комментарии и продажи требуют нажатия Enter/Save.
- [x] **Таймаут**: Загрузка таблицы имеет таймаут 15 секунд с уведомлением об ошибке.

### 3.2. Страница "Расходы" (`app/expenses/page.tsx`)

**Элементы управления:**
- [x] **Выбор Периода (Custom Dropdown)**:
    - Опции: Неделя, Месяц (30 дней), Квартал (90 дней), Год, Свой диапазон.
    - При выборе "Свой диапазон" открывается модальное окно с календарем (`react-datepicker`).
    - Отображение текущего выбранного периода в заголовке (напр. "01.01.2024 - 31.01.2024").
- [x] **Фильтр Кампаний**:
    - Синхронизирован со словарем из настроек (`campaignDictionary`).
    - Показывает ВСЕ кампании, даже если по ним нет расходов (чтобы можно было выбрать фильтр "на будущее" или для проверки).
    - Поиск и чекбоксы внутри выпадающего списка.

**Таблица Расходов:**
- [x] **Колонки**: Кампания, Визиты (из Метрики), Расходы (из Директа), CPL (Расчетное: Расход/Визиты).
- [x] **Итоговая строка**: Сумма по всем видимым строкам.
- [x] **Состояние Direct Access**: Неявный индикатор, используется для дебага (есть ли доступ к Директу).

### 3.3. Страница "Отчеты" (`app/reports/page.tsx`)

**Функционал:**
- [x] **Вкладки**:
    - "Все данные": Общая таблица.
    - "Эффективность": Урезанные метрики.
    - "Неделя" / "Месяц": Группировка данных (агрегация) по временным отрезкам.
- [x] **Экспорт**: Кнопка "Экспорт" (иконка Download). Генерирует `.xlsx` файл с двумя листами: "Отчет по кампаниям" и "Сводка".
- [x] **KPI Карточки**: "Всего лидов", "Целевые %", "Продажи", "Конверсия".
- [x] **Динамический пересчет**: При выборе фильтра кампаний, KPI карточки и итоги в таблице пересчитываются на лету.

### 3.4. Страница "Настройки" (`app/settings/page.tsx`)

**Конфигурация:**
- [x] **ID Таблицы**: Поле ввода Google Sheet ID.
- [x] **Логины Директа**: Поле ввода списка логинов (через запятую).
- [x] **UTM Фильтр**: Поле ввода разрешенных `utm_source`.
- [x] **Сброс цветов**: Кнопка сброса цветов кампаний в `localStorage`.

**Маппинг (Collapsible Blocks):**
- [x] **Правила Кампаний**: Связка `Campaign ID` -> `Имя`, `Статус по умолчанию`, `Цена`.
- [x] **Маппинг Расходов**: Связка `UTM` -> `Название в Директе` -> `Отображаемое имя`.
    - Это позволяет объединять статистику. Например: UTM `yandex_search` + Директ `Search_Campaign_1` = Отчет `Поиск Москва`.

**Ручная синхронизация (Hidden/Advanced):**
- [x] **Раскрывающаяся панель**: "Ручная синхронизация".
- [x] **Выбор дат**: Date Picker для ручного запуска синка за старый период.
- [x] **Кнопка "Очистить период"**: Удаляет данные из таблицы за выбранный период (опасно, с подтверждением).

## 4. Конфигурация и Ключи (Секреты)

Для развертывания платформы используйте следующие значения в файле `.env` или `.env.local`. 

```env
# --- Google Sheets Configuration ---
# ID основной таблицы (Спредшит)
GOOGLE_SHEET_ID=1HUpmF9aG3UD9blHHsIhWQ8NPnPTeW36USgkrRVSh5Tg

# Email сервисного аккаунта (должен быть добавлен в редактор таблицы)
GOOGLE_CLIENT_EMAIL=app-bot@marketing-platform-486210.iam.gserviceaccount.com

# Приватный ключ сервисного аккаунта
# Важно сохранить переносы строк (\n)
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDDYW0ilGn+RKOs\nt55cADGDChHZDgIBwotUfxkc03YhED9VDaHqlsWQx6QCAxNbIVf5GF8V0wfZvTP/\n6uNilnzog8mlKJILK36pbKeGOLavVvrTvR21LRef8CvvEDuk0IUSHkZH7wXwlf22\nTqdWQfiVYvnxlYpXGozuuTOmRmCxWtLsU8JkDAH4f+hce3qk/N8qXlUHkBb1B0r8\nBfqnXNc1ozTVUW9/JC+K0O0PX6LFLdom8Z3hp0wrDlJqcMGS0goLhteL4kquO3Xl\nGEYBWmIdXgeos1Ey4m6EMD6V0m58B04TYruHf135OVtZ2bHmhewlfcSQAhonCAxC\nXQAAvjwBAgMBAAECggEACPOuDytLJvQIpsl79z2oBxe/RRlr9J4wCZVQNn6m1zF6\nIWDARjIVx8Ip7NCswpxmvjpEYwjZ/3s4hnWB6Rq5iuK86rUO6fWadlNM4qy3DBYZ\nZHmyAoLYJgMYVDoDbZQDQNcDw9h7BnCs4P0+FAjuRZP1HUFLhx2njumL6Qao9/87\nhcM58ng2/BRMFNSfn7O8LnpxcJ1eWQflcDidaNrr3ypS7NRFAuBKqc08ogBe0VTd\nzyvkgkf9O7i+eQSZZ63dWPIw8Ov7RSWyhajtU70nARGX10jtAM5A6IteXjPBAjAZ\nr3abdBvnP4JB5QzM/Eii4HAP9D6HrfKo3M63RdATQQKBgQDwm0+xtWygQ71DoUIN\npwWRoCfroCJlYrzojN99IMvVRnLZBZQxCGClaYFejobSncUOFL8xt6o3C5+Nm1SK\nES+ZeZoTvkrUGTsROhrITn1KPQHvu9uFtX+msvXDN2NNd7v8MV5qlTixzkhAEzeS\ntjySdgzd5ZvozwrwAFqL0oRO0QKBgQDP4WVH47OR2abbn/JONV9jWNbTirKln3v7\n/XVBRiuplM095SoQhTBSYvc85M7wXPn+/IvW/skjud/X3M8RRFsOvAmiI5P+d8ME\nMUryStUvuqBDPsWRfxyY5suzRNjevF9HxlOcUJoQdOZ1NxmlhbOr0odaiz1iIgO7\n271DLX5GMQKBgB94cQgRbs/XjF3YLceTXQsbI52SKG2SaJsSMfkv3PlcaZExRZzU\nN6/rCNzRT5kkwa2B0TAzkbP5dTkUZA5bCRrN6PVEIo1zb2JlczNX8NNQ/3vX2nK2\ntqebKMIL8JUlYBUwb+UI941qKdEXsmEiLPILNsufSLE+w3N42F8JffzBAoGAcPqM\n8u87zs69sqtRI1Q6jWHhD4NX6E+vMJrluR4L6NRoX3VG0UexpXUH7d5k4ZmGfSCA\nV86NPo9sqoLlPvspie6ERcyUSD6KjKLFmr009AW3yBQ7iAHPZwI4Pyvxucwi9H1D\nP7dGpB8EiTvzAlSR+5Yl3f3C1Kyr3tNkHziAYmECgYAdJnFgZShcxFSYnd2HiGuR\nr1WOG6UfBnHBDjdOx+JxNPUwtQ80IpPevfIkdzqwOwWEVEJtkYud6garMrcovcsy\neZGe07emGNgdzPm4N1oZwV6LuQgXeo3w9Um90qdCmR0PsOuPBKGFZGPaibRSKY27\ny+Bv+dCOsMN5PNLzSGP9sw==\n-----END PRIVATE KEY-----\n"

# --- Yandex Metrika Configuration ---
# Токен доступа (OAuth)
# Получен от аккаунта, имеющего доступ к счетчику
YANDEX_METRIKA_TOKEN=y0__xDfxb1gGNq_NyDAivKjFqYkr66aXNxZXnyS_T_w7GA7TD3F

# ID счетчика Метрики
YANDEX_COUNTER_ID=93215285
```

### Ссылки на ресурсы

*   **Google Sheet**: [https://docs.google.com/spreadsheets/d/1HUpmF9aG3UD9blHHsIhWQ8NPnPTeW36USgkrRVSh5Tg/edit](https://docs.google.com/spreadsheets/d/1HUpmF9aG3UD9blHHsIhWQ8NPnPTeW36USgkrRVSh5Tg/edit)
*   **Yandex Metrika (Счетчик 93215285)**: [https://metrika.yandex.ru/stat/traffic?id=93215285](https://metrika.yandex.ru/stat/traffic?id=93215285)

## 5. База данных (Google Sheets Structure)

Платформа ожидает наличие следующих колонок в листе "Лиды":
1.  **Дата** (String/Date)
2.  **Время** (String)
3.  **Кампания** (String)
4.  **Цель** (String)
5.  **metrika_visit_id** (Unique ID)
6.  **Целевой** (Status String: "Целевой", "СПАМ" и т.д.)
7.  **Квалификация** (Status String: "Квал", "Дубль")
8.  **Сумма продажи** (Number)
