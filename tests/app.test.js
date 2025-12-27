const request = require('supertest');
const express = require('express');
const session = require('express-session');
const path = require('path');

// Создаем тестовое приложение
const app = express();

// Настройка middleware для тестов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../src/views'));

// Подключаем маршруты
const authRoutes = require('../src/routes/auth');
app.use('/auth', authRoutes);

// Простой маршрут для главной страницы
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    res.json({ message: 'Dashboard', user: req.session.user });
});

describe('Система учета заявок - Базовые тесты', () => {
    
    describe('Аутентификация', () => {
        test('GET /auth/login должен возвращать страницу входа', async () => {
            const response = await request(app)
                .get('/auth/login')
                .expect(200);
            
            expect(response.text).toContain('БытСервис');
            expect(response.text).toContain('Логин');
            expect(response.text).toContain('Пароль');
        });

        test('POST /auth/login с пустыми данными должен возвращать ошибку', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({})
                .expect(200);
            
            expect(response.text).toContain('Введите логин и пароль');
        });

        test('POST /auth/login с неверными данными должен возвращать ошибку', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    login: 'wronguser',
                    password: 'wrongpass'
                })
                .expect(200);
            
            expect(response.text).toContain('Неверный логин или пароль');
        });

        test('POST /auth/login с корректными данными должен перенаправлять', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    login: 'kasoo',
                    password: 'root'
                })
                .expect(302);
            
            expect(response.headers.location).toBe('/');
        });
    });

    describe('Авторизация', () => {
        test('Доступ к главной странице без авторизации должен перенаправлять на логин', async () => {
            const response = await request(app)
                .get('/')
                .expect(302);
            
            expect(response.headers.location).toBe('/auth/login');
        });
    });

    describe('Валидация данных', () => {
        test('Функция валидации заявки должна проверять обязательные поля', () => {
            const validateRequest = (data) => {
                const errors = [];
                
                if (!data.home_tech_type) errors.push('Тип техники обязателен');
                if (!data.home_tech_model) errors.push('Модель техники обязательна');
                if (!data.problem_description) errors.push('Описание проблемы обязательно');
                if (!data.client_id) errors.push('Клиент должен быть указан');
                
                return {
                    valid: errors.length === 0,
                    errors: errors
                };
            };

            // Тест с пустыми данными
            const emptyData = {};
            const emptyResult = validateRequest(emptyData);
            expect(emptyResult.valid).toBe(false);
            expect(emptyResult.errors).toHaveLength(4);

            // Тест с корректными данными
            const validData = {
                home_tech_type: 'Холодильник',
                home_tech_model: 'Samsung RB37J5000SA',
                problem_description: 'Не морозит',
                client_id: 1
            };
            const validResult = validateRequest(validData);
            expect(validResult.valid).toBe(true);
            expect(validResult.errors).toHaveLength(0);
        });
    });

    describe('Расчет статистики', () => {
        test('Функция расчета среднего времени должна корректно работать', () => {
            const calculateAverageTime = (requests) => {
                const completedRequests = requests.filter(r => 
                    r.completion_date && r.start_date
                );
                
                if (completedRequests.length === 0) return 0;
                
                const totalDays = completedRequests.reduce((sum, request) => {
                    const start = new Date(request.start_date);
                    const end = new Date(request.completion_date);
                    const days = (end - start) / (1000 * 60 * 60 * 24);
                    return sum + days;
                }, 0);
                
                return Math.round((totalDays / completedRequests.length) * 10) / 10;
            };

            // Тест с пустым массивом
            expect(calculateAverageTime([])).toBe(0);

            // Тест с заявками без даты завершения
            const incompleteRequests = [
                { start_date: '2023-01-01', completion_date: null },
                { start_date: '2023-01-02', completion_date: null }
            ];
            expect(calculateAverageTime(incompleteRequests)).toBe(0);

            // Тест с завершенными заявками
            const completedRequests = [
                { start_date: '2023-01-01', completion_date: '2023-01-03' }, // 2 дня
                { start_date: '2023-01-05', completion_date: '2023-01-09' }  // 4 дня
            ];
            expect(calculateAverageTime(completedRequests)).toBe(3); // (2+4)/2 = 3
        });

        test('Функция подсчета заявок по статусам должна корректно группировать', () => {
            const countByStatus = (requests) => {
                const statusCounts = {};
                const statuses = ['Новая заявка', 'В процессе ремонта', 'Готова к выдаче', 'Ожидание запчастей'];
                
                // Инициализируем счетчики
                statuses.forEach(status => {
                    statusCounts[status] = 0;
                });
                
                // Подсчитываем заявки
                requests.forEach(request => {
                    if (statusCounts.hasOwnProperty(request.request_status)) {
                        statusCounts[request.request_status]++;
                    }
                });
                
                return statusCounts;
            };

            const testRequests = [
                { request_status: 'Новая заявка' },
                { request_status: 'Новая заявка' },
                { request_status: 'В процессе ремонта' },
                { request_status: 'Готова к выдаче' }
            ];

            const result = countByStatus(testRequests);
            expect(result['Новая заявка']).toBe(2);
            expect(result['В процессе ремонта']).toBe(1);
            expect(result['Готова к выдаче']).toBe(1);
            expect(result['Ожидание запчастей']).toBe(0);
        });
    });
});

describe('Обработка ошибок', () => {
    test('Функция обработки ошибок БД должна возвращать корректные коды', () => {
        const handleDatabaseError = (error) => {
            if (error.code === 'SQLITE_CONSTRAINT') {
                return { code: 400, message: 'Нарушение ограничений базы данных' };
            } else if (error.code === 'SQLITE_BUSY') {
                return { code: 503, message: 'База данных временно недоступна' };
            } else {
                return { code: 500, message: 'Внутренняя ошибка сервера' };
            }
        };

        // Тест ошибки ограничений
        const constraintError = { code: 'SQLITE_CONSTRAINT' };
        const constraintResult = handleDatabaseError(constraintError);
        expect(constraintResult.code).toBe(400);
        expect(constraintResult.message).toContain('ограничений');

        // Тест ошибки занятости БД
        const busyError = { code: 'SQLITE_BUSY' };
        const busyResult = handleDatabaseError(busyError);
        expect(busyResult.code).toBe(503);

        // Тест общей ошибки
        const generalError = { code: 'UNKNOWN_ERROR' };
        const generalResult = handleDatabaseError(generalError);
        expect(generalResult.code).toBe(500);
    });
});