-- Создание базы данных для системы учета заявок на ремонт бытовой техники

PRAGMA foreign_keys = ON;

-- Справочные таблицы

CREATE TABLE IF NOT EXISTS user_roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tech_types (
    type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_statuses (
    status_id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Основные таблицы

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fio VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    login VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) 
        REFERENCES user_roles(role_id) ON DELETE RESTRICT,
    CONSTRAINT chk_phone CHECK (length(phone) >= 10),
    CONSTRAINT chk_login CHECK (length(login) >= 3)
);

CREATE TABLE IF NOT EXISTS requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number VARCHAR(20) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    tech_type_id INTEGER NOT NULL,
    tech_model VARCHAR(100) NOT NULL,
    problem_description TEXT NOT NULL,
    status_id INTEGER NOT NULL,
    completion_date DATE,
    repair_parts TEXT,
    estimated_cost DECIMAL(10,2) DEFAULT 0,
    actual_cost DECIMAL(10,2) DEFAULT 0,
    master_id INTEGER,
    client_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_requests_tech_type FOREIGN KEY (tech_type_id) 
        REFERENCES tech_types(type_id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_status FOREIGN KEY (status_id) 
        REFERENCES request_statuses(status_id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_master FOREIGN KEY (master_id) 
        REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_requests_client FOREIGN KEY (client_id) 
        REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_requests_created_by FOREIGN KEY (created_by) 
        REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_completion_date CHECK (
        completion_date IS NULL OR completion_date >= start_date
    ),
    CONSTRAINT chk_costs CHECK (
        estimated_cost >= 0 AND actual_cost >= 0
    )
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_comments_request FOREIGN KEY (request_id) 
        REFERENCES requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) 
        REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS work_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    master_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    hours_spent DECIMAL(4,2) DEFAULT 0,
    work_description TEXT NOT NULL,
    parts_used TEXT,
    cost DECIMAL(10,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_work_logs_request FOREIGN KEY (request_id) 
        REFERENCES requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_work_logs_master FOREIGN KEY (master_id) 
        REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_hours CHECK (hours_spent >= 0 AND hours_spent <= 24),
    CONSTRAINT chk_work_cost CHECK (cost >= 0)
);

-- Индексы

CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_requests_number ON requests(request_number);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status_id);
CREATE INDEX IF NOT EXISTS idx_requests_master ON requests(master_id);
CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id);
CREATE INDEX IF NOT EXISTS idx_requests_date ON requests(start_date);
CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_request ON work_logs(request_id);

-- Представления

CREATE VIEW IF NOT EXISTS v_requests_full AS
SELECT 
    r.request_id,
    r.request_number,
    r.start_date,
    r.completion_date,
    tt.type_name as tech_type,
    r.tech_model,
    r.problem_description,
    rs.status_name as status,
    c.fio as client_name,
    c.phone as client_phone,
    m.fio as master_name,
    r.estimated_cost,
    r.actual_cost,
    r.repair_parts,
    CASE 
        WHEN r.completion_date IS NOT NULL 
        THEN julianday(r.completion_date) - julianday(r.start_date)
        ELSE julianday('now') - julianday(r.start_date)
    END as days_in_work
FROM requests r
LEFT JOIN tech_types tt ON r.tech_type_id = tt.type_id
LEFT JOIN request_statuses rs ON r.status_id = rs.status_id
LEFT JOIN users c ON r.client_id = c.user_id
LEFT JOIN users m ON r.master_id = m.user_id;

-- Триггеры

CREATE TRIGGER IF NOT EXISTS tr_update_request_timestamp
AFTER UPDATE ON requests
FOR EACH ROW
BEGIN
    UPDATE requests 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE request_id = NEW.request_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_set_completion_date
AFTER UPDATE ON requests
FOR EACH ROW
WHEN NEW.status_id = (SELECT status_id FROM request_statuses WHERE status_name = 'Готова к выдаче')
AND OLD.status_id != NEW.status_id
AND NEW.completion_date IS NULL
BEGIN
    UPDATE requests 
    SET completion_date = DATE('now')
    WHERE request_id = NEW.request_id;
END;

PRAGMA integrity_check;