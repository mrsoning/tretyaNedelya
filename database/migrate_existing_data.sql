-- Миграция данных из старой структуры в новую (3НФ)

CREATE TEMPORARY TABLE IF NOT EXISTS temp_old_users (
    id INTEGER,
    fio TEXT,
    phone TEXT,
    login TEXT,
    password TEXT,
    type TEXT
);

CREATE TEMPORARY TABLE IF NOT EXISTS temp_old_requests (
    id INTEGER,
    start_date TEXT,
    home_tech_type TEXT,
    home_tech_model TEXT,
    problem_description TEXT,
    request_status TEXT,
    completion_date TEXT,
    repair_parts TEXT,
    master_id INTEGER,
    client_id INTEGER
);

CREATE TEMPORARY TABLE IF NOT EXISTS temp_old_comments (
    id INTEGER,
    message TEXT,
    master_id INTEGER,
    request_id INTEGER
);

-- Загрузка данных из старой структуры
INSERT OR IGNORE INTO temp_old_users (id, fio, phone, login, password, type)
SELECT id, fio, phone, login, password, type 
FROM users_old 
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='users_old');

INSERT OR IGNORE INTO temp_old_requests (id, start_date, home_tech_type, home_tech_model, 
                                        problem_description, request_status, completion_date, 
                                        repair_parts, master_id, client_id)
SELECT id, start_date, home_tech_type, home_tech_model, problem_description, 
       request_status, completion_date, repair_parts, master_id, client_id
FROM requests_old 
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='requests_old');

INSERT OR IGNORE INTO temp_old_comments (id, message, master_id, request_id)
SELECT id, message, master_id, request_id
FROM comments_old 
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='comments_old');

-- Миграция пользователей
INSERT OR IGNORE INTO users (user_id, fio, phone, login, password, role_id, created_at)
SELECT 
    tou.id,
    tou.fio,
    tou.phone,
    tou.login,
    tou.password,
    ur.role_id,
    CURRENT_TIMESTAMP
FROM temp_old_users tou
JOIN user_roles ur ON ur.role_name = tou.type
WHERE tou.id IS NOT NULL;

-- Миграция заявок
INSERT OR IGNORE INTO requests (
    request_id, request_number, start_date, tech_type_id, tech_model, 
    problem_description, status_id, completion_date, repair_parts, 
    master_id, client_id, created_by, created_at, updated_at
)
SELECT 
    tor.id,
    'REQ-' || strftime('%Y%m%d', tor.start_date) || '-' || printf('%04d', tor.id),
    tor.start_date,
    COALESCE(tt.type_id, (SELECT type_id FROM tech_types WHERE type_name = 'Другое')),
    tor.home_tech_model,
    tor.problem_description,
    COALESCE(rs.status_id, (SELECT status_id FROM request_statuses WHERE status_name = 'Новая заявка')),
    CASE WHEN tor.completion_date = 'null' OR tor.completion_date = '' THEN NULL ELSE tor.completion_date END,
    CASE WHEN tor.repair_parts = '' THEN NULL ELSE tor.repair_parts END,
    CASE WHEN tor.master_id = 0 OR tor.master_id IS NULL THEN NULL ELSE tor.master_id END,
    tor.client_id,
    COALESCE(tor.master_id, tor.client_id),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM temp_old_requests tor
LEFT JOIN tech_types tt ON tt.type_name = tor.home_tech_type
LEFT JOIN request_statuses rs ON rs.status_name = tor.request_status
WHERE tor.id IS NOT NULL;

-- Миграция комментариев
INSERT OR IGNORE INTO comments (comment_id, request_id, author_id, message, is_internal, created_at)
SELECT 
    toc.id,
    toc.request_id,
    toc.master_id,
    toc.message,
    1,
    CURRENT_TIMESTAMP
FROM temp_old_comments toc
WHERE toc.id IS NOT NULL 
AND toc.request_id IN (SELECT request_id FROM requests)
AND toc.master_id IN (SELECT user_id FROM users);

-- Создание журналов работ для завершенных заявок
INSERT OR IGNORE INTO work_logs (request_id, master_id, work_date, hours_spent, work_description, parts_used, cost)
SELECT 
    r.request_id,
    r.master_id,
    COALESCE(r.completion_date, r.start_date),
    CASE 
        WHEN r.completion_date IS NOT NULL 
        THEN ROUND((julianday(r.completion_date) - julianday(r.start_date)) * 8, 1)
        ELSE 4.0
    END,
    'Ремонт ' || tt.type_name || ' ' || r.tech_model,
    r.repair_parts,
    CASE 
        WHEN rs.status_name = 'Готова к выдаче' THEN r.estimated_cost
        ELSE 0
    END
FROM requests r
JOIN tech_types tt ON r.tech_type_id = tt.type_id
JOIN request_statuses rs ON r.status_id = rs.status_id
WHERE r.master_id IS NOT NULL
AND rs.status_name IN ('Готова к выдаче', 'Выдана клиенту');

-- Обновление номеров заявок
UPDATE requests 
SET request_number = 'REQ-' || strftime('%Y%m%d', start_date) || '-' || printf('%04d', request_id)
WHERE request_number NOT LIKE 'REQ-%';

PRAGMA foreign_key_check;

-- Отчет о миграции
SELECT 'Пользователи: ' || COUNT(*) FROM users
UNION ALL
SELECT 'Заявки: ' || COUNT(*) FROM requests
UNION ALL
SELECT 'Комментарии: ' || COUNT(*) FROM comments
UNION ALL
SELECT 'Журнал работ: ' || COUNT(*) FROM work_logs;

DROP TABLE IF EXISTS temp_old_users;
DROP TABLE IF EXISTS temp_old_requests;
DROP TABLE IF EXISTS temp_old_comments;