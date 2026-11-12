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
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_notifications_userid ON Notifications(UserID);
