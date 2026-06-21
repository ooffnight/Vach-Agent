# ВАШ АГЕНТ — корпоративный сайт компании по ремонту квартир (v2.0)


Корпоративный сайт ООО «ЦН «Ваш агент» с интерактивным 3D-визуализатором,
BI-аналитикой в защищённой админ-зоне, онлайн-консультантом, серверным
расчётом стоимости и трёхэтапной формой заявки.


## 🎨 Цветовая палитра

| Цвет | HEX | Использование |
|------|------|------|
| Light Mist | `#d4e0de` | Фоновые акценты |
| Cream | `#e8ddd0` | Тёплые секции, секция заказа |
| Teal | `#5e8281` | Кнопки, ссылки, графики |
| Dark Teal | `#245358` | Заголовки, шапка админки |

## 🛠 Стек технологий

| Слой | Технология |
|------|------------|
| Frontend | HTML5 + CSS3 + Vanilla JavaScript (без фреймворков) |
| 3D | Three.js r160 (WebGL + OrbitControls) |
| Backend | Node.js LTS + Express.js |
| БД | PostgreSQL 14+ |
| Графики | Chart.js 4 (CDN) |
| Аутентификация | JWT (RFC 7519, библиотека jsonwebtoken) |
| Хеширование | bcryptjs |
| Безопасность | helmet, CORS (whitelist) |

## 📁 Структура проекта (v2.0)

```
renovatepro/
├── index.html                  # Публичный лендинг (без BI-дашборда, с 3-step формой)
├── admin.html                  # Админ-раздел (login + dashboard + orders/leads)
├── css/
│   ├── style.css               # Основные стили
│   ├── animations.css          # Анимации
│   └── admin.css               # Стили админки (NEW)
├── js/
│   ├── main.js                 # Логика лендинга
│   ├── visualizer.js           # 3D-визуализатор (28 м² + контролы, RESTORED)
│   ├── calculator.js           # 3-этапная форма заявки (NEW)
│   ├── chat.js                 # Онлайн-консультант (тарифы R-09)
│   ├── dashboard.js            # BI-аналитика (REAL API, R-16)
│   └── admin.js                # Логика админки: login, табы, JWT (NEW)
├── server/
│   ├── server.js               # Express-сервер
│   ├── config.js               # Валидация env (NEW)
│   ├── db.js                   # PostgreSQL pool
│   ├── schema.sql              # SQL-схема (R-10, R-11, R-19)
│   ├── middleware/
│   │   ├── auth.js             # JWT middleware (NEW)
│   │   ├── requireRole.js      # Role check (NEW)
│   │   ├── validate.js         # DTO validation (NEW)
│   │   └── errorHandler.js     # Centralized (NEW)
│   ├── services/
│   │   └── pricing.js          # Формула P=S×k×C (NEW)
│   └── routes/
│       ├── orders.js           # +POST /calculate, JWT
│       ├── leads.js            # JWT на GET
│       ├── analytics.js        # JWT на все 4 маршрута, без /revenue-trend
│       ├── auth.js             # JWT_SECRET из config, role check
│       └── visualizer.js       # +name field
├── package.json
├── .env.example
└── README.md
```

## 🚀 Запуск проекта

### 1. Установка зависимостей

```bash
npm install
```

### 2. Создание БД и применение схемы

```bash
# Создать базу (имя — vash_agent, ASCII)
createdb vash_agent
# или: npm run db:create

# Импортировать схему + тестовые данные
psql -U postgres -d vash_agent -f server/schema.sql
# или: npm run db:init
```

### 3. Настройка окружения

```bash
cp .env.example .env

```

### 4. Запуск

```bash
npm start
# Откройте http://localhost:3000     — публичный сайт
# Откройте http://localhost:3000/admin — админ-раздел (login)
```

Тестовые учётные данные (см. `server/schema.sql`):
- `admin@vashagent.ru` / пароль `admin123` (роль admin)
- `manager1@vashagent.ru` / пароль `admin123` (роль manager)
- `manager2@vashagent.ru` / пароль `admin123` (роль manager)

> Все хэши тестовых данных одинаковые (один общий пароль). Это ТОЛЬКО для разработки.
> На production немедленно создайте новых пользователей и удалите тестовых через DELETE.

## ✨ Ключевые фичи

### 1️⃣ Серверный калькулятор (`POST /api/orders/calculate`)
Реализует формулу (5) из §3.1 диплома: `P = S × k × C`, где
- `C = 5000` руб./м² — базовая стоимость
- `k = 1.0 / 1.8 / 2.5` — коэффициенты косметического / капитального / дизайнерского ремонта

### 2️⃣ Трёхэтапная форма заявки (FR-04 диплома)
- Шаг 1: расчёт стоимости через `/api/orders/calculate`
- Шаг 2: ввод контактов (валидация телефона ≥ 10 цифр + email)
- Шаг 3: подтверждение → `POST /api/orders`

### 3️⃣ Интерактивный 3D-визуализатор (§3.1 диплома)
- Сцена ~28 м² (типовое помещение)
- OrbitControls: вращение + перемещение (pan) + приближение (zoom)
- Авто-вращение при простое (15 сек)
- Контролы: 4 стиля × 5 цветов стен × 3 типа пола × 4 предмета мебели
- Сохранение конфигурации через `POST /api/visualizer/save`
- WebGL fallback: при отсутствии WebGL — сообщение «требуется современный браузер»

### 4️⃣ Онлайн-консультант
- Контекстные ответы по тарифам (формула P=S×k×C)
- Распознавание телефона / email / площади в сообщениях
- Сохранение лидов через `POST /api/leads`

### 5️⃣ Админ-раздел (`/admin`)
JWT-защищённый раздел для сотрудников:
- BI-дашборд: 4 KPI + столбчатая диаграмма + кольцевая + таблица проектов
- CSV-экспорт реальных данных
- Управление заявками (список + смена статуса)
- Список лидов

## 📊 REST API

| Метод | Endpoint | Auth | Назначение |
|-------|----------|------|-----------|
| GET   | `/api/health` | — | Health check |
| **POST**  | `/api/orders/calculate` | — | **Серверный расчёт стоимости (R-07)** |
| POST  | `/api/orders` | — | Создание заявки |
| GET   | `/api/orders` | **JWT** | Список заявок |
| GET   | `/api/orders/:id` | **JWT** | Детали заявки |
| PATCH | `/api/orders/:id/status` | **JWT** | Смена статуса |
| POST  | `/api/leads` | — | Сохранение лида |
| GET   | `/api/leads` | **JWT** | Список лидов |
| GET   | `/api/analytics/kpi` | **JWT** | KPI-метрики |
| GET   | `/api/analytics/orders-by-month` | **JWT** | Заявки по месяцам |
| GET   | `/api/analytics/types-distribution` | **JWT** | Распределение типов |
| GET   | `/api/analytics/active-projects` | **JWT** | Активные проекты |
| POST  | `/api/auth/register` | **JWT + admin** | Регистрация сотрудника (только Admin) |
| POST  | `/api/auth/login` | — | Логин (выдаёт JWT) |
| GET   | `/api/auth/me` | **JWT** | Профиль |
| POST  | `/api/visualizer/save` | — | Сохранение 3D-сцены |
| GET   | `/api/visualizer/:id` | — | Получение сцены |
| GET   | `/api/visualizer/presets/all` | — | Список пресетов |

**Итого: 18 маршрутов** (соответствует Таблице 5 диплома + `/calculate` из приложения В).

## 🔐 Безопасность

- `helmet` с CSP и whitelist'ом CDN
- `bcryptjs` для паролей (cost factor 10)
- `jsonwebtoken` — JWT-аутентификация без hardcoded секретов
- Параметризованные SQL-запросы (защита от SQL-инъекций)
- CORS с whitelist origin (production)
- Валидация env на старте — без переменных процесс не запускается
- Все защищённые маршруты возвращают 401 без валидного JWT
- Role-based access: только Admin может регистрировать пользователей

## 🧪 Юнит-тестирование сервиса pricing

```bash
node -e "
const p = require('./server/services/pricing');
console.log('cosmetic 50м²:', p.calculatePrice('cosmetic', 50));  // 250 000
console.log('capital  50м²:', p.calculatePrice('capital',  50));  // 450 000
console.log('designer 50м²:', p.calculatePrice('designer', 50));  // 625 000
"
```

## 📝 Лицензия

MIT
