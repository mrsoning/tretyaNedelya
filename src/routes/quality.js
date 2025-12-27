const express = require('express');
const Database = require('../database/database');
const { requireAuth, requireRole } = require('./auth');
const QRCode = require('qrcode');
const router = express.Router();

const db = new Database().getDatabase();

// Применяем middleware аутентификации и проверки роли
router.use(requireAuth);

// Панель менеджера по качеству
router.get('/dashboard', requireRole(['Менеджер по качеству', 'Менеджер']), (req, res) => {
    // Получаем просроченные заявки (старше 7 дней)
    const overdueQuery = `
        SELECT r.*, c.fio as client_name, c.phone as client_phone, m.fio as master_name
        FROM requests r
        LEFT JOIN users c ON r.client_id = c.id
        LEFT JOIN users m ON r.master_id = m.id
        WHERE r.request_status != 'Готова к выдаче' 
        AND julianday('now') - julianday(r.start_date) > 7
        ORDER BY r.start_date ASC
    `;

    db.all(overdueQuery, [], (err, overdueRequests) => {
        if (err) {
            console.error('Ошибка получения просроченных заявок:', err);
            overdueRequests = [];
        }

        res.render('quality/dashboard', {
            title: 'Панель менеджера по качеству - БытСервис',
            overdueRequests: overdueRequests || [],
            escalatedRequests: [],
            qualityStats: { avg_rating: 4.2, total_ratings: 15 },
            notifications: []
        });
    });
});

// Просроченные заявки
router.get('/overdue', requireRole(['Менеджер по качеству', 'Менеджер']), (req, res) => {
    const overdueQuery = `
        SELECT r.*, c.fio as client_name, c.phone as client_phone, m.fio as master_name
        FROM requests r
        LEFT JOIN users c ON r.client_id = c.id
        LEFT JOIN users m ON r.master_id = m.id
        WHERE r.request_status != 'Готова к выдаче' 
        AND julianday('now') - julianday(r.start_date) > 7
        ORDER BY r.start_date ASC
    `;

    db.all(overdueQuery, [], (err, requests) => {
        if (err) {
            console.error('Ошибка получения просроченных заявок:', err);
            requests = [];
        }

        res.render('quality/overdue', {
            title: 'Просроченные заявки - БытСервис',
            requests: requests || []
        });
    });
});

// Эскалированные заявки
router.get('/escalations', requireRole(['Менеджер по качеству', 'Менеджер']), (req, res) => {
    res.render('quality/escalations', {
        title: 'Эскалированные заявки - БытСервис',
        escalations: []
    });
});

// Генерация QR-кода для оценки качества
router.get('/qr-code/:requestId', requireRole(['Менеджер по качеству', 'Менеджер', 'Оператор']), async (req, res) => {
    const requestId = req.params.requestId;

    try {
        // Проверяем что заявка существует и завершена
        db.get('SELECT * FROM requests WHERE id = ? AND request_status = "Готова к выдаче"', [requestId], async (err, request) => {
            if (err || !request) {
                return res.status(404).json({ error: 'Заявка не найдена или не завершена' });
            }

            // Генерируем QR-код
            const feedbackUrl = `${req.protocol}://${req.get('host')}/quality/feedback/${requestId}`;
            const qrCodeData = await QRCode.toDataURL(feedbackUrl);

            res.json({
                success: true,
                qr_code: qrCodeData,
                feedback_url: feedbackUrl
            });
        });
    } catch (error) {
        console.error('Ошибка генерации QR-кода:', error);
        res.status(500).json({ error: 'Ошибка генерации QR-кода' });
    }
});

// Страница QR-кода для печати
router.get('/qr-print/:requestId', requireRole(['Менеджер по качеству', 'Менеджер', 'Оператор']), async (req, res) => {
    const requestId = req.params.requestId;

    try {
        // Получаем информацию о заявке
        db.get(`
            SELECT r.*, c.fio as client_name, c.phone as client_phone
            FROM requests r
            JOIN users c ON r.client_id = c.id
            WHERE r.id = ? AND r.request_status = "Готова к выдаче"
        `, [requestId], async (err, request) => {
            if (err || !request) {
                return res.status(404).render('error', {
                    title: 'Заявка не найдена',
                    message: 'Заявка не найдена или не завершена'
                });
            }

            // Генерируем QR-код
            const feedbackUrl = `${req.protocol}://${req.get('host')}/quality/feedback/${requestId}`;
            const qrCodeData = await QRCode.toDataURL(feedbackUrl);

            res.render('quality/qr-print', {
                title: `QR-код для заявки №${requestId}`,
                request,
                qr_code: qrCodeData,
                feedback_url: feedbackUrl,
                layout: false
            });
        });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).render('error', {
            title: 'Ошибка',
            message: 'Произошла ошибка при генерации QR-кода'
        });
    }
});

// Статистика качества
router.get('/statistics', requireRole(['Менеджер по качеству', 'Менеджер']), (req, res) => {
    res.render('quality/statistics', {
        title: 'Статистика качества - БытСервис',
        qualityStats: {
            total_ratings: 15,
            avg_rating: 4.2,
            escalations_count: 2,
            overdue_count: 3,
            satisfaction_rate: 85,
            no_escalation_rate: 92,
            on_time_rate: 78,
            rating_5: 8,
            rating_4: 4,
            rating_3: 2,
            rating_2: 1,
            rating_1: 0
        }
    });
});

// Страница обратной связи (публичная)
router.get('/feedback/:requestId', (req, res) => {
    const requestId = req.params.requestId;

    db.get(`
        SELECT r.*, c.fio as client_name, m.fio as master_name
        FROM requests r
        JOIN users c ON r.client_id = c.id
        LEFT JOIN users m ON r.master_id = m.id
        WHERE r.id = ? AND r.request_status = "Готова к выдаче"
    `, [requestId], (err, request) => {
        if (err || !request) {
            return res.status(404).send('Заявка не найдена');
        }

        res.render('quality/feedback', {
            title: 'Оценка качества обслуживания',
            request,
            layout: false
        });
    });
});

module.exports = router;