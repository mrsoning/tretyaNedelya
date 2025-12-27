const express = require('express');
const Database = require('../database/database');
const { requireAuth, requireRole } = require('./auth');
const router = express.Router();

const db = new Database().getDatabase();

// Применяем middleware аутентификации
router.use(requireAuth);

// Список пользователей (только для менеджеров)
router.get('/', requireRole(['Менеджер']), (req, res) => {
    const { search, type } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (search) {
        query += ' AND (fio LIKE ? OR login LIKE ? OR phone LIKE ?)';
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
    }

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    query += ' ORDER BY type, fio';

    db.all(query, params, (err, users) => {
        if (err) {
            console.error('Ошибка получения пользователей:', err);
            return res.status(500).render('error', {
                title: 'Ошибка',
                message: 'Не удалось загрузить пользователей',
                error: err
            });
        }

        res.render('users/list', {
            title: 'Пользователи - БытСервис',
            users,
            filters: { search, type },
            userTypes: ['Менеджер', 'Мастер', 'Оператор', 'Заказчик']
        });
    });
});

// Профиль пользователя
router.get('/profile', (req, res) => {
    res.render('users/profile', {
        title: 'Мой профиль - БытСервис'
    });
});

// Обновление профиля
router.post('/profile', (req, res) => {
    const { fio, phone } = req.body;
    const userId = req.session.user.id;

    if (!fio || !phone) {
        return res.render('users/profile', {
            title: 'Мой профиль - БытСервис',
            error: 'Все поля обязательны для заполнения'
        });
    }

    db.run(
        'UPDATE users SET fio = ?, phone = ? WHERE id = ?',
        [fio, phone, userId],
        (err) => {
            if (err) {
                console.error('Ошибка обновления профиля:', err);
                return res.render('users/profile', {
                    title: 'Мой профиль - БытСервис',
                    error: 'Не удалось обновить профиль'
                });
            }

            // Обновляем данные в сессии
            req.session.user.fio = fio;
            req.session.user.phone = phone;

            res.render('users/profile', {
                title: 'Мой профиль - БытСервис',
                success: 'Профиль успешно обновлен'
            });
        }
    );
});

module.exports = router;