-- =====================================================
-- ВАШ АГЕНТ — Схема БД PostgreSQL
-- Соответствует §3.1 Таблицы 4 диплома Петроченко.
--
-- Исправления по результатам аудита:
--   R-10: reviews ссылается на projects(id), НЕ на orders(id)
--   R-11: visualizer_configs.name — обязательное поле (по диплому)
--   R-19: users.role — только 'admin' | 'manager' (§2.1 диплома)
--
-- Поля, добавленные сверх минимума Таблицы 4 диплома,
-- помечены комментарием [ext] — нужны для работы приложения,
-- но не противоречат логике диплома.
-- =====================================================

-- ── DROP for clean re-init ─────────────────────
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS reviews              CASCADE;
DROP TABLE IF EXISTS project_stages       CASCADE;
DROP TABLE IF EXISTS projects             CASCADE;
DROP TABLE IF EXISTS orders               CASCADE;
DROP TABLE IF EXISTS leads                CASCADE;
DROP TABLE IF EXISTS visualizer_configs   CASCADE;
DROP TABLE IF EXISTS portfolio_items      CASCADE;
DROP TABLE IF EXISTS users                CASCADE;

-- =====================================================
-- 1. USERS — Сотрудники с доступом к админ-разделу
--    Атрибуты диплома: id, login, password_hash, role, created_at
-- =====================================================
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    login         VARCHAR(150) UNIQUE NOT NULL,  -- по диплому (используется как email/логин)
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'manager',
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- [ext] вспомогательные поля
    name          VARCHAR(120),
    updated_at    TIMESTAMP,
    CONSTRAINT users_role_chk CHECK (role IN ('admin','manager'))  -- R-19: 2 роли по §2.1
);
CREATE INDEX idx_users_login ON users(login);
CREATE INDEX idx_users_role  ON users(role);

-- =====================================================
-- 2. LEADS — Обращения через онлайн-консультанта
--    Атрибуты диплома: id, contact, message, source, created_at
-- =====================================================
CREATE TABLE leads (
    id          SERIAL PRIMARY KEY,
    contact     VARCHAR(200),  -- объединённый телефон/email/имя — по диплому
    message     TEXT,
    source      VARCHAR(40) NOT NULL DEFAULT 'chat',
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    -- [ext] разделение контакта для удобства фильтрации
    name        VARCHAR(120),
    phone       VARCHAR(30),
    email       VARCHAR(150),
    status      VARCHAR(20) NOT NULL DEFAULT 'new',
    updated_at  TIMESTAMP,
    CONSTRAINT leads_contact_chk CHECK (contact IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL),
    CONSTRAINT leads_status_chk  CHECK (status IN ('new','contacted','qualified','converted','lost'))
);
CREATE INDEX idx_leads_source  ON leads(source);
CREATE INDEX idx_leads_status  ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

-- =====================================================
-- 3. ORDERS — Заявка клиента на услугу ремонта
--    Атрибуты диплома: id, name, phone, email, type, area, price, status, created_at
-- =====================================================
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    phone       VARCHAR(30)  NOT NULL,
    email       VARCHAR(150),
    type        VARCHAR(30)  NOT NULL,  -- 'cosmetic' | 'capital' | 'designer'
    area        NUMERIC(8,2) NOT NULL,
    price       NUMERIC(12,2),
    status      VARCHAR(20)  NOT NULL DEFAULT 'new',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- [ext] вспомогательные поля
    address     VARCHAR(300),
    updated_at  TIMESTAMP,
    CONSTRAINT orders_status_chk CHECK (status IN ('new','confirmed','in_progress','completed','cancelled')),
    CONSTRAINT orders_type_chk   CHECK (type IN ('cosmetic','capital','designer')),
    CONSTRAINT orders_area_chk   CHECK (area > 0)
);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- =====================================================
-- 4. PROJECTS — Активный проект ремонта (1:1 с orders)
--    Атрибуты диплома: id, order_id, address, progress, started_at, finished_at
-- =====================================================
CREATE TABLE projects (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    address      VARCHAR(300),
    progress     SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    started_at   TIMESTAMP,
    finished_at  TIMESTAMP,
    -- [ext]
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP
);
CREATE INDEX idx_projects_order_id ON projects(order_id);

-- =====================================================
-- 5. PROJECT_STAGES — Этапы проекта
--    Атрибуты диплома: id, project_id, name, status, finished_at
-- =====================================================
CREATE TABLE project_stages (
    id           SERIAL PRIMARY KEY,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'planned',
    finished_at  TIMESTAMP,
    -- [ext]
    sequence_order SMALLINT,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT stages_status_chk CHECK (status IN ('planned','in_progress','done','skipped'))
);
CREATE INDEX idx_project_stages_project_id ON project_stages(project_id);

-- =====================================================
-- 6. PAYMENT_TRANSACTIONS — Платежи по заказу
--    Атрибуты диплома: id, order_id, amount, method, status, created_at
-- =====================================================
CREATE TABLE payment_transactions (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method       VARCHAR(40)   NOT NULL,
    status       VARCHAR(20)   NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT pay_status_chk CHECK (status IN ('pending','success','failed','refunded')),
    CONSTRAINT pay_method_chk CHECK (method IN ('card','sbp','bank_transfer','cash'))
);
CREATE INDEX idx_pay_order_id ON payment_transactions(order_id);
CREATE INDEX idx_pay_status   ON payment_transactions(status);

-- =====================================================
-- 7. REVIEWS — Отзывы клиентов
--    Атрибуты диплома: id, project_id, rating, text, created_at
--    R-10: FK на projects(id) (НЕ на orders(id)!)
-- =====================================================
CREATE TABLE reviews (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,  -- R-10
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_rating     ON reviews(rating);
CREATE INDEX idx_reviews_project_id ON reviews(project_id);

-- =====================================================
-- 8. VISUALIZER_CONFIGS — Конфигурации 3D-сцены
--    Атрибуты диплома: id, name, scene_json, created_at
--    R-11: name — обязательное поле, как в дипломе
-- =====================================================
CREATE TABLE visualizer_configs (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,   -- R-11: обязательно по диплому
    scene_json   JSONB        NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- [ext]
    client_email VARCHAR(150),
    share_token  VARCHAR(40)  UNIQUE
);
CREATE INDEX idx_viz_share_token ON visualizer_configs(share_token);

-- =====================================================
-- 9. PORTFOLIO_ITEMS — Элементы портфолио
--    Атрибуты диплома: id, title, description, photo_url, type
-- =====================================================
CREATE TABLE portfolio_items (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    photo_url     VARCHAR(500),
    type          VARCHAR(30),  -- категория ремонта
    -- [ext]
    is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_portfolio_type     ON portfolio_items(type);
CREATE INDEX idx_portfolio_featured ON portfolio_items(is_featured);

-- =====================================================
-- TRIGGERS — auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated    BEFORE UPDATE ON leads    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ТЕСТОВЫЕ ДАННЫЕ
-- =====================================================
-- Пароли захэшированы bcryptjs (cost=10): пароль для всех — "admin123" / "manager123"
-- ВНИМАНИЕ: при первом запуске замените на свои!
INSERT INTO users (login, password_hash, name, role) VALUES
  ('admin@vashagent.ru',    '$2a$10$Jx1bm1F4nKxFqJFDl/qCpO/HZbBkPjJjW.4WuPTSL/EJ1eq8L7r/u',  'Администратор',  'admin'),
  ('manager1@vashagent.ru', '$2a$10$Jx1bm1F4nKxFqJFDl/qCpO/HZbBkPjJjW.4WuPTSL/EJ1eq8L7r/u',  'Алексей Иванов', 'manager'),
  ('manager2@vashagent.ru', '$2a$10$Jx1bm1F4nKxFqJFDl/qCpO/HZbBkPjJjW.4WuPTSL/EJ1eq8L7r/u',  'Мария Петрова',  'manager');

INSERT INTO leads (name, phone, email, message, source, status) VALUES
  ('Иван Сидоров',    '+79161234567', 'ivan@mail.ru',     'Здравствуйте, интересует капитальный ремонт', 'chat',    'new'),
  ('Ольга Кравцова',  '+79261112233', 'olga@gmail.com',   'Запишите на замер',                            'landing', 'contacted'),
  ('Дмитрий Лебедев', '+79096667788', NULL,               'Сколько стоит студия 28 м²?',                 'chat',    'qualified');

INSERT INTO orders (name, phone, email, type, area, price, status, address) VALUES
  ('Иван Сидоров',     '+79161234567', 'ivan@mail.ru',     'capital',  65,  585000,  'in_progress', 'Москва, ул. Арбат, д.14, кв.32'),
  ('Ольга Кравцова',   '+79261112233', 'olga@gmail.com',   'designer', 42,  525000,  'in_progress', 'Москва, Сокол, д.7, кв.5'),
  ('Виктория Семёнова','+79031234455', 'vsem@yandex.ru',   'cosmetic', 35,  175000,  'in_progress', 'Москва, Тверская, д.22, кв.10'),
  ('Андрей Михайлов',  '+79161234500', NULL,               'capital',  58,  522000,  'completed',   'Москва, Университет, д.3, кв.8'),
  ('Екатерина Белова', '+79261234505', 'kate@mail.ru',     'cosmetic', 28,  140000,  'new',         'Москва, Кутузовский, д.55, кв.2');

INSERT INTO projects (order_id, address, progress, started_at) VALUES
  (1, 'Москва, ул. Арбат, д.14, кв.32',   75, '2024-09-15'),
  (2, 'Москва, Сокол, д.7, кв.5',          92, '2024-10-01'),
  (3, 'Москва, Тверская, д.22, кв.10',     40, '2024-10-20'),
  (4, 'Москва, Университет, д.3, кв.8',   100, '2024-08-01'),
  (5, 'Москва, Кутузовский, д.55, кв.2',   10, '2024-11-25');

UPDATE projects SET finished_at = '2024-10-15' WHERE order_id = 4;

INSERT INTO project_stages (project_id, name, status, sequence_order) VALUES
  (1, 'Демонтаж',    'done',         1),
  (1, 'Электрика',   'done',         2),
  (1, 'Стяжка',      'in_progress',  3),
  (1, 'Отделка',     'planned',      4),
  (2, 'Демонтаж',    'done',         1),
  (2, 'Электрика',   'done',         2),
  (2, 'Стяжка',      'done',         3),
  (2, 'Отделка',     'in_progress',  4);

INSERT INTO payment_transactions (order_id, amount, method, status) VALUES
  (1, 292500, 'bank_transfer', 'success'),
  (2, 262500, 'card',          'success'),
  (4, 522000, 'bank_transfer', 'success');

INSERT INTO reviews (project_id, rating, text) VALUES
  (4, 5, 'Прекрасный ремонт, сделали в срок, без сюрпризов!'),
  (4, 5, 'Очень довольны качеством работы. Рекомендуем!');

INSERT INTO portfolio_items (title, description, photo_url, type, is_featured) VALUES
  ('Студия в скандинавском стиле',  'Светлая 28 м², 14 дней',         '/img/portfolio/studio1.jpg',  'cosmetic', TRUE),
  ('Современный минимализм',         'Однокомнатная 42 м², 21 день',    '/img/portfolio/one1.jpg',     'capital',  TRUE),
  ('Квартира в стиле лофт',          'Двухкомнатная 65 м², 35 дней',    '/img/portfolio/two1.jpg',     'capital',  TRUE),
  ('Классика с элементами ар-деко',  'Трёхкомнатная 95 м², 45 дней',    '/img/portfolio/three1.jpg',   'designer', TRUE);

-- =====================================================
-- УСПЕШНО: схема создана и заполнена тестовыми данными.
-- Логины: admin@vashagent.ru / manager1@vashagent.ru / manager2@vashagent.ru
-- Пароль для всех: смените через приложение или INSERT нового хэша.
-- =====================================================
