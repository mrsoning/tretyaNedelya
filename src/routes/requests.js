const express = require('express');
const Database = require('../database/database');
const { requireAuth, requireRole } = require('./auth');
const router = express.Router();

const db = new Database().getDatabase();

router.use(requireAuth);

router.get('/', (req, res) => {
    const { search, status, master } = req.query;
    let query = `
        SELECT r.*, 
               c.fio as client_name, c.phone as client_phone,
               m.fio as master_name
        FROM requests r
        LEFT JOIN users c ON r.client_id = c.id
        LEFT JOIN users m ON r.master_id = m.id
        WHERE 1=1
    `;
    const params = [];

    // Фильтрация по роли пользователя
    if (req.session.user.type === 'Заказчик') {
        query += ' AND r.client_id = ?';
        params.push(req.session.user.id);
    } else if (req.session.user.type === 'Мастер') {
        query += ' AND (r.master_id = ? OR r.master_id IS NULL)';
        params.push(req.session.user.id);
    }

    // Поиск
    if (search) {
        query += ' AND (r.id LIKE ? OR r.home_tech_type LIKE ? OR r.problem_description LIKE ? OR c.fio LIKE ?)';
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
    }

    // Фильтр по статусу
    if (status) {
        query += ' AND r.request_status = ?';
        params.push(status);
    }

    // Фильтр по мастеру
    if (master) {
        query += ' AND r.master_id = ?';
        params.push(master);
    }

    query += ' ORDER BY r.created_at DESC';

    db.all(query, params, (err, requests) => {
        if (err) {
            console.error('Ошибка получения заявок:', err);
            return res.status(500).render('error', {
                title: 'Ошибка',
                message: 'Не удалось загрузить заявки',
                error: err
            });
        }

        // Получаем список мастеров для фильтра
        db.all('SELECT id, fio FROM users WHERE type = "Мастер"', (err, masters) => {
            if (err) {
                console.error('Ошибка получения мастеров:', err);
                masters = [];
            }

            res.render('requests/list', {
                title: 'Заявки - БытСервис',
                requests,
                masters,
                filters: { search, status, master },
                statuses: ['Новая заявка', 'В процессе ремонта', 'Готова к выдаче', 'Ожидание запчастей']
            });
        });
    });
});

router.get('/new', requireRole(['Оператор', 'Менеджер', 'Заказчик']), (req, res) => {
    // Для заказчиков не нужно получать список клиентов
    if (req.session.user.type === 'Заказчик') {
        return res.render('requests/new', {
            title: 'Новая заявка - БытСервис',
            clients: null,
            isClient: true
        });
    }
    
    // Получаем список клиентов для операторов и менеджеров
    db.all('SELECT id, fio, phone FROM users WHERE type = "Заказчик"', (err, clients) => {
        if (err) {
            console.error('Ошибка получения клиентов:', err);
            clients = [];
        }

        res.render('requests/new', {
            title: 'Новая заявка - БытСервис',
            clients,
            isClient: false
        });
    });
});

router.post('/', requireRole(['Оператор', 'Менеджер', 'Заказчик']), (req, res) => {
    const {
        home_tech_type,
        home_tech_model,
        problem_description,
        client_id
    } = req.body;

    // Определяем ID клиента
    let actualClientId;
    if (req.session.user.type === 'Заказчик') {
        // Заказчик создает заявку для себя
        actualClientId = req.session.user.id;
    } else {
        // Оператор/менеджер создает заявку для выбранного клиента
        actualClientId = client_id;
    }

    if (!home_tech_type || !home_tech_model || !problem_description || !actualClientId) {
        return res.status(400).render('error', {
            title: 'Ошибка валидации',
            message: 'Все поля обязательны для заполнения',
            error: { status: 400 }
        });
    }

    const query = `
        INSERT INTO requests (start_date, home_tech_type, home_tech_model, 
                            problem_description, client_id, request_status)
        VALUES (DATE('now'), ?, ?, ?, ?, 'Новая заявка')
    `;

    db.run(query, [home_tech_type, home_tech_model, problem_description, actualClientId], function(err) {
        if (err) {
            console.error('Ошибка создания заявки:', err);
            return res.status(500).render('error', {
                title: 'Ошибка',
                message: 'Не удалось создать заявку',
                error: err
            });
        }

        res.redirect(`/requests/${this.lastID}`);
    });
});

// Просмотр заявки
router.get('/:id', (req, res) => {
    const requestId = req.params.id;

    const query = `
        SELECT r.*, 
               c.fio as client_name, c.phone as client_phone,
               m.fio as master_name, m.phone as master_phone
        FROM requests r
        LEFT JOIN users c ON r.client_id = c.id
        LEFT JOIN users m ON r.master_id = m.id
        WHERE r.id = ?
    `;

    db.get(query, [requestId], (err, request) => {
        if (err) {
            console.error('Ошибка получения заявки:', err);
            return res.status(500).render('error', {
                title: 'Ошибка',
                message: 'Не удалось загрузить заявку',
                error: err
            });
        }

        if (!request) {
            return res.status(404).render('error', {
                title: 'Заявка не найдена',
                message: 'Заявка с указанным номером не существует',
                error: { status: 404 }
            });
        }

        // Проверка прав доступа
        if (req.session.user.type === 'Заказчик' && request.client_id !== req.session.user.id) {
            return res.status(403).render('error', {
                title: 'Доступ запрещен',
                message: 'Вы можете просматривать только свои заявки',
                error: { status: 403 }
            });
        }

        // Получаем комментарии к заявке
        db.all(`
            SELECT c.*, u.fio as author_name
            FROM comments c
            JOIN users u ON c.master_id = u.id
            WHERE c.request_id = ?
            ORDER BY c.created_at ASC
        `, [requestId], (err, comments) => {
            if (err) {
                console.error('Ошибка получения комментариев:', err);
                comments = [];
            }

            // Получаем список мастеров
            db.all('SELECT id, fio FROM users WHERE type = "Мастер"', (err, masters) => {
                if (err) {
                    console.error('Ошибка получения мастеров:', err);
                    masters = [];
                }

                res.render('requests/view', {
                    title: `Заявка №${request.id} - БытСервис`,
                    request,
                    comments,
                    masters,
                    statuses: ['Новая заявка', 'В процессе ремонта', 'Готова к выдаче', 'Ожидание запчастей']
                });
            });
        });
    });
});

// Обновление заявки
router.post('/:id/update', requireRole(['Оператор', 'Мастер', 'Менеджер']), (req, res) => {
    const requestId = req.params.id;
    const { request_status, master_id, repair_parts, problem_description } = req.body;

    let query = 'UPDATE requests SET ';
    const params = [];
    const updates = [];

    if (request_status) {
        updates.push('request_status = ?');
        params.push(request_status);
        
        // Если статус "Готова к выдаче", устанавливаем дату завершения
        if (request_status === 'Готова к выдаче') {
            updates.push('completion_date = DATE("now")');
        }
    }

    if (master_id !== undefined) {
        updates.push('master_id = ?');
        params.push(master_id || null);
    }

    if (repair_parts !== undefined) {
        updates.push('repair_parts = ?');
        params.push(repair_parts || null);
    }

    if (problem_description) {
        updates.push('problem_description = ?');
        params.push(problem_description);
    }

    if (updates.length === 0) {
        return res.redirect(`/requests/${requestId}`);
    }

    query += updates.join(', ') + ' WHERE id = ?';
    params.push(requestId);

    db.run(query, params, (err) => {
        if (err) {
            console.error('Ошибка обновления заявки:', err);
            return res.status(500).render('error', {
                title: 'Ошибка',
                message: 'Не удалось обновить заявку',
                error: err
            });
        }

        res.redirect(`/requests/${requestId}`);
    });
});

// Добавление комментария
router.post('/:id/comments', requireRole(['Мастер', 'Менеджер']), (req, res) => {
    const requestId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    db.run(
        'INSERT INTO comments (message, master_id, request_id) VALUES (?, ?, ?)',
        [message.trim(), req.session.user.id, requestId],
        (err) => {
            if (err) {
                console.error('Ошибка добавления комментария:', err);
                return res.status(500).json({ error: 'Не удалось добавить комментарий' });
            }

            res.redirect(`/requests/${requestId}`);
        }
    );
});

module.exports = router;