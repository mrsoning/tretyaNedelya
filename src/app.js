const express = require('express');
const session = require('express-session');
const path = require('path');
const Database = require('./database/database');
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');
const statisticsRoutes = require('./routes/statistics');
const qualityRoutes = require('./routes/quality');

const app = express();
const PORT = process.env.PORT || 3001;

const db = new Database();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'repair-service-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/users', userRoutes);
app.use('/statistics', statisticsRoutes);
app.use('/quality', qualityRoutes);

app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.render('dashboard', { 
        title: 'Панель управления - БытСервис',
        user: req.session.user 
    });
});

app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Страница не найдена',
        message: 'Запрашиваемая страница не существует',
        error: { status: 404 }
    });
});

app.use((err, req, res, next) => {
    console.error('Ошибка приложения:', err);
    res.status(500).render('error', {
        title: 'Внутренняя ошибка сервера',
        message: 'Произошла внутренняя ошибка сервера',
        error: { status: 500, stack: err.stack }
    });
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('  СИСТЕМА УЧЕТА ЗАЯВОК НА РЕМОНТ БЫТОВОЙ ТЕХНИКИ');
    console.log('='.repeat(60));
    console.log(`\n  Сервер запущен: http://localhost:${PORT}`);
    console.log('  Тестовые учетные записи:');
    console.log('     Заказчик: user1 / pass1');
    console.log('     Оператор: operator1 / pass1');
    console.log('     Мастер: master1 / pass1');
    console.log('     Менеджер: manager1 / pass1');
    console.log('\n  Нажмите Ctrl+C для остановки\n');
});