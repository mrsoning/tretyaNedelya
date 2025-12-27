-- Запросы для отчетов и статистики

-- Общая статистика по заявкам
SELECT 
    COUNT(*) as total_requests,
    COUNT(CASE WHEN rs.status_name IN ('Готова к выдаче', 'Выдана клиенту') THEN 1 END) as completed,
    ROUND(AVG(julianday(completion_date) - julianday(start_date)), 1) as avg_days
FROM requests r
JOIN request_statuses rs ON r.status_id = rs.status_id;

-- Статистика по статусам
SELECT 
    rs.status_name,
    COUNT(r.request_id) as count,
    ROUND(COUNT(r.request_id) * 100.0 / (SELECT COUNT(*) FROM requests), 2) as percentage
FROM request_statuses rs
LEFT JOIN requests r ON rs.status_id = r.status_id
WHERE rs.is_active = 1
GROUP BY rs.status_id, rs.status_name
ORDER BY rs.sort_order;

-- Статистика по типам техники
SELECT 
    tt.type_name,
    COUNT(r.request_id) as count,
    COUNT(CASE WHEN rs.status_name IN ('Готова к выдаче', 'Выдана клиенту') THEN 1 END) as completed,
    ROUND(AVG(CASE 
        WHEN r.completion_date IS NOT NULL 
        THEN julianday(r.completion_date) - julianday(r.start_date)
    END), 1) as avg_days,
    ROUND(AVG(COALESCE(r.actual_cost, r.estimated_cost)), 2) as avg_cost
FROM tech_types tt
LEFT JOIN requests r ON tt.type_id = r.tech_type_id
LEFT JOIN request_statuses rs ON r.status_id = rs.status_id
WHERE tt.is_active = 1
GROUP BY tt.type_id, tt.type_name
HAVING COUNT(r.request_id) > 0
ORDER BY COUNT(r.request_id) DESC;

-- Производительность мастеров
SELECT 
    u.fio as master_name,
    COUNT(r.request_id) as total_requests,
    COUNT(CASE WHEN rs.status_name IN ('Готова к выдаче', 'Выдана клиенту') THEN 1 END) as completed,
    COUNT(CASE WHEN rs.status_name = 'В процессе ремонта' THEN 1 END) as in_progress,
    ROUND(AVG(CASE 
        WHEN rs.status_name IN ('Готова к выдаче', 'Выдана клиенту')
        THEN julianday(r.completion_date) - julianday(r.start_date)
    END), 1) as avg_days,
    ROUND(SUM(COALESCE(wl.hours_spent, 0)), 1) as total_hours,
    ROUND(COUNT(CASE WHEN rs.status_name IN ('Готова к выдаче', 'Выдана клиенту') THEN 1 END) * 100.0 / 
          NULLIF(COUNT(r.request_id), 0), 2) as efficiency
FROM users u
LEFT JOIN requests r ON u.user_id = r.master_id
LEFT JOIN request_statuses rs ON r.status_id = rs.status_id
LEFT JOIN work_logs wl ON r.request_id = wl.request_id AND u.user_id = wl.master_id
WHERE u.role_id = (SELECT role_id FROM user_roles WHERE role_name = 'Мастер')
GROUP BY u.user_id, u.fio
ORDER BY completed DESC;

-- Финансовая статистика
SELECT 
    ROUND(SUM(COALESCE(estimated_cost, 0)), 2) as total_estimated,
    ROUND(SUM(COALESCE(actual_cost, 0)), 2) as total_actual,
    ROUND(AVG(COALESCE(actual_cost, estimated_cost)), 2) as avg_cost
FROM requests;

-- Статистика по месяцам
SELECT 
    strftime('%Y-%m', r.start_date) as month,
    COUNT(r.request_id) as new_requests,
    COUNT(CASE WHEN r.completion_date IS NOT NULL 
               AND strftime('%Y-%m', r.completion_date) = strftime('%Y-%m', r.start_date) 
          THEN 1 END) as completed_same_month,
    ROUND(AVG(CASE 
        WHEN r.completion_date IS NOT NULL 
        THEN julianday(r.completion_date) - julianday(r.start_date)
    END), 1) as avg_days
FROM requests r
GROUP BY strftime('%Y-%m', r.start_date)
ORDER BY month DESC;

-- Просроченные заявки
SELECT 
    r.request_number,
    tt.type_name,
    c.fio as client_name,
    m.fio as master_name,
    r.start_date,
    rs.status_name,
    ROUND(julianday('now') - julianday(r.start_date), 0) as days_overdue
FROM requests r
JOIN tech_types tt ON r.tech_type_id = tt.type_id
JOIN request_statuses rs ON r.status_id = rs.status_id
JOIN users c ON r.client_id = c.user_id
LEFT JOIN users m ON r.master_id = m.user_id
WHERE rs.status_name NOT IN ('Готова к выдаче', 'Выдана клиенту', 'Отменена')
AND julianday('now') - julianday(r.start_date) > 7
ORDER BY days_overdue DESC;

-- Заявки без мастера
SELECT 
    r.request_number,
    tt.type_name,
    c.fio as client_name,
    r.start_date,
    ROUND(julianday('now') - julianday(r.start_date), 0) as days_without_master
FROM requests r
JOIN tech_types tt ON r.tech_type_id = tt.type_id
JOIN request_statuses rs ON r.status_id = rs.status_id
JOIN users c ON r.client_id = c.user_id
WHERE r.master_id IS NULL 
AND rs.status_name NOT IN ('Готова к выдаче', 'Выдана клиенту', 'Отменена')
ORDER BY r.start_date;