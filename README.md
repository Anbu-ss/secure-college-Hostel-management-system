# Secure Hostel Management System

A digital gate pass system enabling secure online requests, staff and HOD approvals, and QR-code based security scanning for students.

## Architecture

- **Backend**: Node.js, Express, MySQL, JWT Auth
- **Frontend**: React, Vite, Tailwind CSS, React Router

## Prerequisites

- Node.js installed
- MySQL Server running

## Database Setup

1. Open your MySQL client (e.g., MySQL Workbench or CLI).
2. Execute the `database.sql` script located in the root of the project to create the `secure_hostel_db` and its tables.

## Backend Setup

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Configure `.env`:
   Ensure `DB_USER` and `DB_PASSWORD` in `backend/.env` match your local MySQL credentials.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the backend API:
   ```bash
   npm run dev
   ```
   *The server runs on http://localhost:5000*

## Frontend Setup

1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
   If needed, this project uses `@yudiel/react-qr-scanner`, `qrcode.react`, `lucide-react`, `tailwindcss`, `axios`, and `react-router-dom`.
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The app runs on http://localhost:5173*

## Using the System

1. **Register**: Start by registering users with different roles (Student, Staff, HOD, Warden, Security).
2. **Student Flow**: Login as a Student -> Apply for a Pass -> Wait for approval.
3. **Approval Flow**: Staff logs in to approve -> HOD logs in to final approve.
4. **QR Code**: Once approved by HOD, a digital QR Pass is generated in the Student's "My Gate Passes" tab.
5. **Security**: Security logs in -> Scans QR Code -> Logs Exit or Entry.
6. **Warden**: Warden logs in -> Views all generated passes and monitors security logs.
