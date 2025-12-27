-- Заполнение справочных данных

-- Роли пользователей
INSERT OR IGNORE INTO user_roles (role_name, description) VALUES
('Менеджер', 'Полный доступ к системе, управление пользователями'),
('Мастер', 'Работа с назначенными заявками, добавление комментариев'),
('Оператор', 'Создание и редактирование заявок, назначение мастеров'),
('Заказчик', 'Просмотр своих заявок, добавление комментариев');

-- Типы техники
INSERT OR IGNORE INTO tech_types (type_name, description) VALUES
('Холодильник', 'Холодильники, морозильные камеры'),
('Стиральная машина', 'Стиральные машины, стирально-сушильные машины'),
('Микроволновая печь', 'СВЧ печи, микроволновые печи с грилем'),
('Посудомоечная машина', 'Встраиваемые и отдельностоящие посудомоечные машины'),
('Пылесос', 'Пылесосы всех типов'),
('Фен', 'Фены для волос'),
('Тостер', 'Тостеры, бутербродницы'),
('Мультиварка', 'Мультиварки, пароварки'),
('Кофемашина', 'Кофемашины, кофеварки'),
('Электроплита', 'Электрические плиты, варочные панели'),
('Духовой шкаф', 'Электрические и газовые духовые шкафы'),
('Блендер', 'Стационарные и погружные блендеры'),
('Утюг', 'Утюги, парогенераторы'),
('Кондиционер', 'Кондиционеры, сплит-системы'),
('Водонагреватель', 'Электрические и газовые водонагреватели');

-- Статусы заявок
INSERT OR IGNORE INTO request_statuses (status_name, description, sort_order) VALUES
('Новая заявка', 'Заявка создана, ожидает назначения мастера', 1),
('В процессе ремонта', 'Заявка назначена мастеру и находится в работе', 2),
('Ожидание запчастей', 'Ремонт приостановлен в ожидании запчастей', 3),
('Готова к выдаче', 'Ремонт завершен, техника готова к выдаче', 4),
('Выдана клиенту', 'Техника выдана клиенту, заявка закрыта', 5),
('Отменена', 'Заявка отменена', 6),
('Требует диагностики', 'Необходима дополнительная диагностика', 7),
('Ожидание решения клиента', 'Ожидается решение клиента по стоимости', 8);

-- Тестовые пользователи
INSERT OR IGNORE INTO users (fio, phone, login, password, role_id) VALUES
('Трубин Никита Юрьевич', '89210563128', 'kasoo', 'root', 
 (SELECT role_id FROM user_roles WHERE role_name = 'Менеджер')),
('Иванова Анна Сергеевна', '89991234567', 'manager2', 'manager123',
 (SELECT role_id FROM user_roles WHERE role_name = 'Менеджер')),

('Мурашов Андрей Юрьевич', '89535078985', 'murashov123', 'qwerty',
 (SELECT role_id FROM user_roles WHERE role_name = 'Мастер')),
('Степанов Андрей Викторович', '89210673849', 'test1', 'test1',
 (SELECT role_id FROM user_roles WHERE role_name = 'Мастер')),
('Семенова Ясмина Марковна', '89994563847', 'login1', 'pass1',
 (SELECT role_id FROM user_roles WHERE role_name = 'Мастер')),
('Иванов Марк Максимович', '89994563844', 'login5', 'pass5',
 (SELECT role_id FROM user_roles WHERE role_name = 'Мастер')),
('Петров Сергей Александрович', '89991111111', 'petrov_sa', 'master456',
 (SELECT role_id FROM user_roles WHERE role_name = 'Мастер')),

('Перина Анастасия Денисовна', '89990563748', 'perinaAD', '250519',
 (SELECT role_id FROM user_roles WHERE role_name = 'Оператор')),
('Мажитова Ксения Сергеевна', '89994563847', 'krutiha1234567', '1234567890',
 (SELECT role_id FROM user_roles WHERE role_name = 'Оператор')),
('Козлова Елена Владимировна', '89992222222', 'kozlova_ev', 'operator789',
 (SELECT role_id FROM user_roles WHERE role_name = 'Оператор')),

('Баранова Эмилия Марковна', '89994563841', 'login2', 'pass2',
 (SELECT role_id FROM user_roles WHERE role_name = 'Заказчик')),
('Егорова Алиса Платоновна', '89994563842', 'login3', 'pass3',
 (SELECT role_id FROM user_roles WHERE role_name = 'Заказчик')),
('Титов Максим Иванович', '89994563843', 'login4', 'pass4',
 (SELECT role_id FROM user_roles WHERE role_name = 'Заказчик')),
('Смирнов Дмитрий Петрович', '89993333333', 'smirnov_dp', 'client123',
 (SELECT role_id FROM user_roles WHERE role_name = 'Заказчик')),
('Васильева Ольга Николаевна', '89994444444', 'vasileva_on', 'client456',
 (SELECT role_id FROM user_roles WHERE role_name = 'Заказчик')),
('Федоров Алексей Иванович', '89995555555', 'fedorov_ai', 'client789',
 (SELECT role_id FROM user_roles WHERE role_name = 'Заказчик'));

-- Тестовые заявки
INSERT OR IGNORE INTO requests (
    request_number, start_date, tech_type_id, tech_model, problem_description, 
    status_id, completion_date, repair_parts, estimated_cost, actual_cost,
    master_id, client_id, created_by
) VALUES
('REQ-20231201-0001', '2023-12-01', 
 (SELECT type_id FROM tech_types WHERE type_name = 'Фен'),
 'Ладомир ТА112 белый', 'Перестал работать, не включается',
 (SELECT status_id FROM request_statuses WHERE status_name = 'Готова к выдаче'),
 '2023-12-03', 'Заменен нагревательный элемент', 800.00, 750.00,
 (SELECT user_id FROM users WHERE login = 'murashov123'),
 (SELECT user_id FROM users WHERE login = 'login2'),
 (SELECT user_id FROM users WHERE login = 'perinaAD')),

('REQ-20231202-0002', '2023-12-02',
 (SELECT type_id FROM tech_types WHERE type_name = 'Холодильник'),
 'Indesit DS 316 W белый', 'Не морозит одна из камер холодильника',
 (SELECT status_id FROM request_statuses WHERE status_name = 'Выдана клиенту'),
 '2023-12-05', 'Мотор обдува морозильной камеры', 2500.00, 2300.00,
 (SELECT user_id FROM users WHERE login = 'murashov123'),
 (SELECT user_id FROM users WHERE login = 'login3'),
 (SELECT user_id FROM users WHERE login = 'perinaAD')),

('REQ-20231203-0003', '2023-12-03',
 (SELECT type_id FROM tech_types WHERE type_name = 'Стиральная машина'),
 'DEXP WM-F610NTMA/WW белый', 'Перестали работать многие режимы стирки',
 (SELECT status_id FROM request_statuses WHERE status_name = 'В процессе ремонта'),
 NULL, NULL, 1500.00, NULL,
 (SELECT user_id FROM users WHERE login = 'test1'),
 (SELECT user_id FROM users WHERE login = 'login4'),
 (SELECT user_id FROM users WHERE login = 'krutiha1234567')),

('REQ-20231204-0004', '2023-12-04',
 (SELECT type_id FROM tech_types WHERE type_name = 'Микроволновая печь'),
 'Samsung MS23K3513AK', 'Не греет, вращается тарелка, но нет нагрева',
 (SELECT status_id FROM request_statuses WHERE status_name = 'Ожидание запчастей'),
 NULL, 'Требуется магнетрон', 3000.00, NULL,
 (SELECT user_id FROM users WHERE login = 'login1'),
 (SELECT user_id FROM users WHERE login = 'smirnov_dp'),
 (SELECT user_id FROM users WHERE login = 'perinaAD')),

('REQ-20231205-0005', '2023-12-05',
 (SELECT type_id FROM tech_types WHERE type_name = 'Мультиварка'),
 'Redmond RMC-M95 черный', 'Перестала включаться, не реагирует на кнопки',
 (SELECT status_id FROM request_statuses WHERE status_name = 'Новая заявка'),
 NULL, NULL, NULL, NULL, NULL,
 (SELECT user_id FROM users WHERE login = 'vasileva_on'),
 (SELECT user_id FROM users WHERE login = 'krutiha1234567')),

('REQ-20231206-0006', '2023-12-06',
 (SELECT type_id FROM tech_types WHERE type_name = 'Пылесос'),
 'Dyson V8 Absolute', 'Слабая тяга, быстро разряжается аккумулятор',
 (SELECT status_id FROM request_statuses WHERE status_name = 'Требует диагностики'),
 NULL, NULL, NULL, NULL,
 (SELECT user_id FROM users WHERE login = 'login5'),
 (SELECT user_id FROM users WHERE login = 'fedorov_ai'),
 (SELECT user_id FROM users WHERE login = 'perinaAD'));

-- Тестовые комментарии
INSERT OR IGNORE INTO comments (request_id, author_id, message, is_internal) VALUES
((SELECT request_id FROM requests WHERE request_number = 'REQ-20231201-0001'),
 (SELECT user_id FROM users WHERE login = 'murashov123'),
 'Диагностика завершена. Проблема в нагревательном элементе.', 1),

((SELECT request_id FROM requests WHERE request_number = 'REQ-20231201-0001'),
 (SELECT user_id FROM users WHERE login = 'murashov123'),
 'Ремонт завершен. Нагревательный элемент заменен.', 0),

((SELECT request_id FROM requests WHERE request_number = 'REQ-20231203-0003'),
 (SELECT user_id FROM users WHERE login = 'test1'),
 'Начата диагностика электронного модуля управления.', 1);

-- Журнал работ
INSERT OR IGNORE INTO work_logs (request_id, master_id, work_date, hours_spent, work_description, parts_used, cost) VALUES
((SELECT request_id FROM requests WHERE request_number = 'REQ-20231201-0001'),
 (SELECT user_id FROM users WHERE login = 'murashov123'),
 '2023-12-01', 1.5, 'Диагностика неисправности фена', NULL, 0),

((SELECT request_id FROM requests WHERE request_number = 'REQ-20231201-0001'),
 (SELECT user_id FROM users WHERE login = 'murashov123'),
 '2023-12-03', 2.0, 'Замена нагревательного элемента', 'Нагревательный элемент ТА112', 750.00);

PRAGMA foreign_key_check;