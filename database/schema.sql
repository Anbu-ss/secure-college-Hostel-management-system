-- database/schema.sql
-- Secure College Hostel Management System - Database Schema
-- Engine: SQLite3
-- This file is for documentation and reference only.
-- The actual database is initialized by config/database.config.js

CREATE TABLE IF NOT EXISTS Users (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    PasswordHash TEXT,
    Role TEXT NOT NULL,
    Department TEXT DEFAULT NULL,
    GoogleID TEXT UNIQUE,
    SignatureURL TEXT DEFAULT NULL,
    Status TEXT DEFAULT 'ACTIVE',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Students (
    UserID INTEGER PRIMARY KEY,
    RegisterNumber TEXT UNIQUE NOT NULL,
    Block TEXT NOT NULL,
    RoomNumber TEXT NOT NULL,
    Department TEXT DEFAULT NULL,
    ParentPhone TEXT,
    PhotoURL TEXT DEFAULT NULL,
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
    HolidayWindowID INTEGER DEFAULT NULL,
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

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    TokenHash TEXT NOT NULL,
    ExpiresAt DATETIME NOT NULL,
    Used INTEGER DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS AuthAuditLogs (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER,
    Identifier TEXT,
    Action TEXT NOT NULL,
    IPAddress TEXT,
    UserAgent TEXT,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS StudentProfiles (
    UserID INTEGER PRIMARY KEY,
    DateOfBirth TEXT,
    PersonalEmail TEXT,
    PhoneNumber TEXT,
    Gender TEXT,
    PermanentAddress TEXT,
    CurrentAddress TEXT,
    City TEXT,
    District TEXT,
    State TEXT,
    PostalCode TEXT,
    GuardianName TEXT,
    GuardianRelationship TEXT,
    GuardianPhone TEXT,
    EmergencyContact TEXT,
    ProfileCompletion INTEGER DEFAULT 25,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS StudentImportBatches (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    UploadedByID INTEGER,
    FileName TEXT NOT NULL,
    TotalRecords INTEGER DEFAULT 0,
    SuccessfulRecords INTEGER DEFAULT 0,
    FailedRecords INTEGER DEFAULT 0,
    DuplicateRecords INTEGER DEFAULT 0,
    Status TEXT DEFAULT 'COMPLETED',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UploadedByID) REFERENCES Users(ID)
);

CREATE TABLE IF NOT EXISTS StudentImportErrors (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    BatchID INTEGER,
    RowNumber INTEGER,
    RegisterNumber TEXT,
    ErrorType TEXT,
    ErrorMessage TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (BatchID) REFERENCES StudentImportBatches(ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ActivationTokens (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    RegisterNumber TEXT NOT NULL,
    UserID INTEGER,
    TokenHash TEXT NOT NULL,
    ActivationCode TEXT NOT NULL,
    ExpiresAt DATETIME NOT NULL,
    Used INTEGER DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_userid ON Notifications(UserID);
CREATE INDEX IF NOT EXISTS idx_users_email ON Users(Email);
CREATE INDEX IF NOT EXISTS idx_students_regno ON Students(RegisterNumber);
CREATE INDEX IF NOT EXISTS idx_activation_regno ON ActivationTokens(RegisterNumber);
