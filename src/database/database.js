const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/repair_service.db');
        this.ensureDataDirectory();
        this.db = new sqlite3.Database(this.dbPath);
        this.initializeTables();
    }

    ensureDataDirectory() {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    initializeTables() {
        const createTables = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fio TEXT NOT NULL,
                phone TEXT NOT NULL,
                login TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('Менеджер', 'Мастер', 'Оператор', 'Заказчик')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_date DATE NOT NULL,
                home_tech_type TEXT NOT NULL,
                home_tech_model TEXT NOT NULL,
                problem_description TEXT NOT NULL,
                request_status TEXT NOT NULL DEFAULT 'Новая заявка' 
                    CHECK (request_status IN ('Новая заявка', 'В процессе ремонта', 'Готова к выдаче', 'Ожидание запчастей')),
                completion_date DATE,
                repair_parts TEXT,
                master_id INTEGER,
                client_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (master_id) REFERENCES users(id),
                FOREIGN KEY (client_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                master_id INTEGER NOT NULL,
                request_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (master_id) REFERENCES users(id),
                FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(request_status);
            CREATE INDEX IF NOT EXISTS idx_requests_master ON requests(master_id);
            CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id);
            CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
        `;

        this.db.exec(createTables, (err) => {
            if (err) {
                console.error('Ошибка создания таблиц:', err);
            } else {
                this.importInitialData();
            }
        });
    }

    async importInitialData() {
        try {
            const userCount = await this.getUserCount();
            if (userCount > 0) {
                return;
            }

            await this.importUsers();
            await this.importRequests();
            await this.importComments();
            console.log('Система готова к работе');
        } catch (error) {
            console.error('Ошибка импорта данных:', error);
        }
    }

    getUserCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    importUsers() {
        return new Promise((resolve, reject) => {
            const usersFile = path.join(__dirname, '../../Ресурсы/import_БытСервис/Пользователи/inputDataUsers.txt');
            const users = [];
            
            fs.createReadStream(usersFile)
                .pipe(csv({ separator: ';' }))
                .on('data', (row) => {
                    users.push({
                        id: parseInt(row.userID),
                        fio: row.fio,
                        phone: row.phone,
                        login: row.login,
                        password: row.password, // В реальном проекте нужно хешировать
                        type: row.type
                    });
                })
                .on('end', () => {
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO users (id, fio, phone, login, password, type) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    
                    users.forEach(user => {
                        stmt.run([user.id, user.fio, user.phone, user.login, user.password, user.type]);
                    });
                    
                    stmt.finalize((err) => {
                        if (err) reject(err);
                        else {
                            resolve();
                        }
                    });
                })
                .on('error', reject);
        });
    }

    importRequests() {
        return new Promise((resolve, reject) => {
            const requestsFile = path.join(__dirname, '../../Ресурсы/import_БытСервис/Заявки/inputDataRequests.txt');
            const requests = [];
            
            fs.createReadStream(requestsFile)
                .pipe(csv({ separator: ';' }))
                .on('data', (row) => {
                    requests.push({
                        id: parseInt(row.requestID),
                        start_date: row.startDate,
                        home_tech_type: row.homeTechType,
                        home_tech_model: row.homeTechModel,
                        problem_description: row.problemDescryption,
                        request_status: row.requestStatus,
                        completion_date: row.completionDate === 'null' ? null : row.completionDate,
                        repair_parts: row.repairParts || null,
                        master_id: row.masterID === 'null' || !row.masterID ? null : parseInt(row.masterID),
                        client_id: parseInt(row.clientID)
                    });
                })
                .on('end', () => {
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO requests 
                        (id, start_date, home_tech_type, home_tech_model, problem_description, 
                         request_status, completion_date, repair_parts, master_id, client_id) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    requests.forEach(request => {
                        stmt.run([
                            request.id, request.start_date, request.home_tech_type, 
                            request.home_tech_model, request.problem_description, 
                            request.request_status, request.completion_date, 
                            request.repair_parts, request.master_id, request.client_id
                        ]);
                    });
                    
                    stmt.finalize((err) => {
                        if (err) reject(err);
                        else {
                            resolve();
                        }
                    });
                })
                .on('error', reject);
        });
    }

    importComments() {
        return new Promise((resolve, reject) => {
            const commentsFile = path.join(__dirname, '../../Ресурсы/import_БытСервис/Комментарии/inputDataComments.txt');
            const comments = [];
            
            fs.createReadStream(commentsFile)
                .pipe(csv({ separator: ';' }))
                .on('data', (row) => {
                    comments.push({
                        id: parseInt(row.commentID),
                        message: row.message,
                        master_id: parseInt(row.masterID),
                        request_id: parseInt(row.requestID)
                    });
                })
                .on('end', () => {
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO comments (id, message, master_id, request_id) 
                        VALUES (?, ?, ?, ?)
                    `);
                    
                    comments.forEach(comment => {
                        stmt.run([comment.id, comment.message, comment.master_id, comment.request_id]);
                    });
                    
                    stmt.finalize((err) => {
                        if (err) reject(err);
                        else {
                            resolve();
                        }
                    });
                })
                .on('error', reject);
        });
    }

    getDatabase() {
        return this.db;
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Ошибка закрытия базы данных:', err);
            }
        });
    }
}

module.exports = Database;