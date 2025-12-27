const express = require('express');
const Database = require('../database/database');
const router = express.Router();

const db = new Database().getDatabase();

// Страница входа
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { 
        title: 'Вход в систему - БытСервис',
        error: null,
        layout: false
    });
});

// Обработка входа
router.post('/login', (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.render('auth/login', {
            title: 'Вход в систему - БытСервис',
            error: 'Введите логин и пароль',
            layout: false
        });
    }

    db.get(
        'SELECT * FROM users WHERE login = ? AND password = ?',
        [login, password],
        (err, user) => {
            if (err) {
                console.error('Ошибка аутентификации:', err);
                return res.render('auth/login', {
                    title: 'Вход в систему - БытСервис',
                    error: 'Ошибка сервера',
                    layout: false
                });
            }

            if (!user) {
                return res.render('auth/login', {
                    title: 'Вход в систему - БытСервис',
                    error: 'Неверный логин или пароль',
                    layout: false
                });
            }

            // Сохраняем пользователя в сессии
            req.session.user = {
                id: user.id,
                fio: user.fio,
                login: user.login,
                type: user.type,
                phone: user.phone
            };

            console.log('Пользователь вошел в систему:', user.fio, '(' + user.type + ')');
            res.redirect('/');
        }
    );
});

// Выход из системы
router.get('/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.fio : 'Неизвестный';
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка выхода:', err);
        } else {
            console.log('Пользователь вышел из системы:', userName);
        }
        res.redirect('/auth/login');
    });
});

// POST версия выхода для совместимости
router.post('/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.fio : 'Неизвестный';
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка выхода:', err);
        } else {
            console.log('Пользователь вышел из системы:', userName);
        }
        res.redirect('/auth/login');
    });
});

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
}

// Middleware для проверки роли
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        
        const userType = req.session.user.type.trim();
        if (!roles.includes(userType)) {
            return res.status(403).render('error', {
                title: 'Доступ запрещен',
                message: `У пользователей с ролью "${userType}" нет доступа к данному разделу. Обратитесь к администратору для получения необходимых прав.`,
                error: { status: 403 }
            });
        }
        next();
    };
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;