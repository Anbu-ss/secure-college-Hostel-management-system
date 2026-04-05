const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

(async () => {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');
    
    // Performance optimization for Vercel: if we're in a serverless function, 
    // we might want to log a warning if non-persistent storage is used.
    if (process.env.VERCEL && !process.env.DB_PATH) {
        console.warn('WARNING: Running on Vercel with local SQLite. Data will NOT persist across requests/deployments.');
    }

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    console.log('Database connected successfully (SQLite)');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL,
            Email TEXT UNIQUE NOT NULL,
            PasswordHash TEXT,
            Role TEXT NOT NULL,
            Department TEXT DEFAULT NULL,
            GoogleID TEXT UNIQUE,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Students (
            UserID INTEGER PRIMARY KEY,
            RegisterNumber TEXT UNIQUE NOT NULL,
            Block TEXT NOT NULL,
            RoomNumber TEXT NOT NULL,
            Department TEXT DEFAULT NULL,
            ParentPhone TEXT,
            FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS GatePassRequests (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            StudentID INTEGER NOT NULL,
            PassType TEXT NOT NULL DEFAULT 'Local',
            Destination TEXT NOT NULL,
            Reason TEXT NOT NULL,
            OutTime DATETIME NOT NULL,
            ExpectedReturnTime DATETIME NOT NULL,
            Status TEXT DEFAULT 'Pending',
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            WardenRemarks TEXT,
            RejectedAt DATETIME,
            RejectedByRole TEXT,
            RejectedByName TEXT,
            RejectionRemarks TEXT,
            FOREIGN KEY (StudentID) REFERENCES Students(UserID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS GatePasses (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            RequestID INTEGER NOT NULL UNIQUE,
            QRCodeHash TEXT UNIQUE NOT NULL,
            IssuedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            ValidUntil DATETIME,
            PassStatus TEXT DEFAULT 'Active',
            ExitTimestamp DATETIME,
            EntryTimestamp DATETIME,
            IsActive INTEGER DEFAULT 1,
            FOREIGN KEY (RequestID) REFERENCES GatePassRequests(ID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS SecurityLogs (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            GatePassID INTEGER NOT NULL,
            Action TEXT NOT NULL,
            ScannedBy INTEGER NOT NULL,
            Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (GatePassID) REFERENCES GatePasses(ID) ON DELETE CASCADE,
            FOREIGN KEY (ScannedBy) REFERENCES Users(ID)
        );

        CREATE TABLE IF NOT EXISTS Notifications (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            UserID INTEGER NOT NULL,
            Message TEXT NOT NULL,
            IsRead INTEGER DEFAULT 0,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS HolidayWindows (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL,
            StartDate TEXT NOT NULL,
            EndDate TEXT NOT NULL,
            IsActive INTEGER DEFAULT 1,
            CreatedByID INTEGER,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Run migrations for existing databases (add columns if not present)
    const migrations = [
        `ALTER TABLE Students ADD COLUMN ParentPhone TEXT`,
        `ALTER TABLE GatePassRequests ADD COLUMN PassType TEXT NOT NULL DEFAULT 'Local'`,
        `ALTER TABLE GatePasses ADD COLUMN ValidUntil DATETIME`,
        `ALTER TABLE GatePasses ADD COLUMN PassStatus TEXT DEFAULT 'Active'`,
        `ALTER TABLE GatePasses ADD COLUMN ExitTimestamp DATETIME`,
        `ALTER TABLE GatePasses ADD COLUMN EntryTimestamp DATETIME`,
        `ALTER TABLE GatePasses ADD COLUMN IsActive INTEGER DEFAULT 1`,
        // Department support
        `ALTER TABLE Users ADD COLUMN Department TEXT DEFAULT NULL`,
        `ALTER TABLE Students ADD COLUMN Department TEXT DEFAULT NULL`,
        `ALTER TABLE GatePassRequests ADD COLUMN WardenRemarks TEXT`,
        `ALTER TABLE GatePassRequests ADD COLUMN RejectedAt DATETIME`,
        `ALTER TABLE GatePassRequests ADD COLUMN RejectedByRole TEXT`,
        `ALTER TABLE GatePassRequests ADD COLUMN RejectedByName TEXT`,
        `ALTER TABLE GatePassRequests ADD COLUMN RejectionRemarks TEXT`,
        // HolidayMode: track which window auto-promoted this request
        `ALTER TABLE GatePassRequests ADD COLUMN HolidayWindowID INTEGER DEFAULT NULL`,
        // Smart PDF: photo and signature support
        `ALTER TABLE Students ADD COLUMN PhotoURL TEXT DEFAULT NULL`,
        `ALTER TABLE Users ADD COLUMN SignatureURL TEXT DEFAULT NULL`,
    ];

    for (const migration of migrations) {
        try {
            await db.exec(migration);
        } catch (e) {
            // Column already exists — safe to ignore
        }
    }

    console.log('Schema migrations applied.');
})();

const pool = {
    execute: async (query, params = []) => {
        if (!db) {
            throw new Error("Database not initialized yet.");
        }
        if (query.trim().toUpperCase().startsWith('SELECT')) {
            const rows = await db.all(query, params);
            return [rows];
        }
        const result = await db.run(query, params);
        return [{ insertId: result.lastID, affectedRows: result.changes }];
    }
};

module.exports = pool;
