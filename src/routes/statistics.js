const express = require('express');
const Database = require('../database/database');
const { requireAuth, requireRole } = require('./auth');
const router = express.Router();

const db = new Database().getDatabase();

// Применяем middleware аутентификации и проверки роли
router.use(requireAuth);
router.use(requireRole(['Менеджер', 'Оператор']));

// Главная страница статистики
router.get('/', (req, res) => {
    const queries = {
        // Общее количество заявок
        totalRequests: 'SELECT COUNT(*) as count FROM requests',
        
        // Количество заявок по статусам
        requestsByStatus: `
            SELECT request_status, COUNT(*) as count 
            FROM requests 
            GROUP BY request_status
        `,
        
        // Среднее время выполнения заявок (в днях)
        averageCompletionTime: `
            SELECT AVG(julianday(completion_date) - julianday(start_date)) as avg_days
            FROM requests 
            WHERE completion_date IS NOT NULL
        `,
        
        // Статистика по типам техники
        techTypeStats: `
            SELECT home_tech_type, COUNT(*) as count
            FROM requests
            GROUP BY home_tech_type
            ORDER BY count DESC
        `,
        
        // Статистика по мастерам
        masterStats: `
            SELECT 
                COALESCE(u.fio, 'Не назначен') as master_name,
                COUNT(r.id) as total,
                COUNT(CASE WHEN r.request_status = 'Готова к выдаче' THEN 1 END) as completed,
                COUNT(CASE WHEN r.request_status IN ('В процессе ремонта', 'Ожидание запчастей') THEN 1 END) as active,
                CASE 
                    WHEN COUNT(r.id) > 0 
                    THEN ROUND(COUNT(CASE WHEN r.request_status = 'Готова к выдаче' THEN 1 END) * 100.0 / COUNT(r.id), 1)
                    ELSE 0
                END as efficiency
            FROM requests r
            LEFT JOIN users u ON r.master_id = u.id AND u.type = 'Мастер'
            GROUP BY COALESCE(u.id, 0), COALESCE(u.fio, 'Не назначен')
            HAVING COUNT(r.id) > 0
            ORDER BY total DESC
        `,
        
        // Заявки за последние 30 дней
        recentRequests: `
            SELECT DATE(start_date) as date, COUNT(*) as count
            FROM requests
            WHERE start_date >= DATE('now', '-30 days')
            GROUP BY DATE(start_date)
            ORDER BY date DESC
        `
    };

    const results = {};
    let completedQueries = 0;
    const totalQueries = Object.keys(queries).length;

    // Выполняем все запросы параллельно
    Object.entries(queries).forEach(([key, query]) => {
        db.all(query, (err, rows) => {
            if (err) {
                console.error(`Ошибка выполнения запроса ${key}:`, err);
                results[key] = [];
            } else {
                results[key] = rows;
            }

            completedQueries++;
            if (completedQueries === totalQueries) {
                // Все запросы выполнены, обрабатываем результаты
                processResults(results, res);
            }
        });
    });
});

function processResults(results, res) {
    // Обрабатываем результаты для удобного отображения
    const statusStats = results.requestsByStatus || [];
    const totalRequests = results.totalRequests[0]?.count || 0;
    
    // Вычисляем активные и завершенные заявки из статистики по статусам
    let activeRequests = 0;
    let completedRequests = 0;
    
    statusStats.forEach(stat => {
        if (stat.request_status === 'Готова к выдаче') {
            completedRequests = stat.count;
        } else {
            activeRequests += stat.count;
        }
    });

    const statistics = {
        totalRequests: totalRequests,
        activeRequests: activeRequests,
        completedRequests: completedRequests,
        avgCompletionTime: Math.round((results.averageCompletionTime[0]?.avg_days || 0) * 10) / 10,
        statusStats: statusStats,
        techTypeStats: results.techTypeStats || [],
        masterStats: results.masterStats || [],
        recentRequests: results.recentRequests || []
    };

    // Подготавливаем данные для графиков
    const chartData = {
        statusLabels: statistics.statusStats.map(item => item.request_status),
        statusData: statistics.statusStats.map(item => item.count),
        techLabels: statistics.techTypeStats.map(item => item.home_tech_type),
        techData: statistics.techTypeStats.map(item => item.count),
        recentDates: statistics.recentRequests.map(item => item.date),
        recentCounts: statistics.recentRequests.map(item => item.count)
    };

    res.render('statistics/dashboard', {
        title: 'Статистика - БытСервис',
        statistics,
        chartData
    });
}

// Детальная статистика по заявкам
router.get('/requests', (req, res) => {
    const { period = '30', master_id, status } = req.query;
    
    let query = `
        SELECT r.*, 
               c.fio as client_name,
               m.fio as master_name,
               CASE 
                   WHEN r.completion_date IS NOT NULL 
                   THEN julianday(r.completion_date) - julianday(r.start_date)
                   ELSE NULL
               END as completion_days
        FROM requests r
        LEFT JOIN users c ON r.client_id = c.id
        LEFT JOIN users m ON r.master_id = m.id
        WHERE r.start_date >= DATE('now', '-${period} days')
    `;
    
    const params = [];
    
    if (master_id) {
        query += ' AND r.master_id = ?';
        params.push(master_id);
    }
    
    if (status) {
        query += ' AND r.request_status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY r.start_date DESC';

    db.all(query, params, (err, requests) => {
        if (err) {
            console.error('Ошибка получения детальной статистики:', err);
            return res.status(500).render('error', {
                title: 'Ошибка',
                message: 'Не удалось загрузить статистику',
                error: err
            });
        }

        // Получаем список мастеров для фильтра
        db.all('SELECT id, fio FROM users WHERE type = "Мастер"', (err, masters) => {
            if (err) {
                console.error('Ошибка получения мастеров:', err);
                masters = [];
            }

            res.render('statistics/requests', {
                title: 'Детальная статистика заявок - БытСервис',
                requests,
                masters,
                filters: { period, master_id, status },
                statuses: ['Новая заявка', 'В процессе ремонта', 'Готова к выдаче', 'Ожидание запчастей']
            });
        });
    });
});

// API для получения статистики в JSON формате
router.get('/api/summary', (req, res) => {
    const summaryQuery = `
        SELECT 
            COUNT(*) as total_requests,
            COUNT(CASE WHEN request_status = 'Новая заявка' THEN 1 END) as new_requests,
            COUNT(CASE WHEN request_status = 'В процессе ремонта' THEN 1 END) as in_progress,
            COUNT(CASE WHEN request_status = 'Готова к выдаче' THEN 1 END) as completed,
            COUNT(CASE WHEN request_status = 'Ожидание запчастей' THEN 1 END) as waiting_parts,
            AVG(CASE 
                WHEN completion_date IS NOT NULL 
                THEN julianday(completion_date) - julianday(start_date)
                ELSE NULL
            END) as avg_completion_days
        FROM requests
    `;

    db.get(summaryQuery, (err, summary) => {
        if (err) {
            console.error('Ошибка получения сводной статистики:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        res.json({
            ...summary,
            avg_completion_days: Math.round((summary.avg_completion_days || 0) * 10) / 10
        });
    });
});

module.exports = router;