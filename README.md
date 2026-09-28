# Bulk Mail App (MERN)

React (Vite) + Express + MongoDB + Nodemailer.

## Features
- Compose: subject, message, multiple recipients (comma / space / newline separated) with live validation
- Each recipient gets an individual email (no shared To/Cc list), sent in batches of 10
- Every send is saved in MongoDB with per-recipient status: `sent`, `partial` or `failed`
- History page with pagination and per-recipient results
- Admin login (JWT, credentials from `.env`)
- Server logs (morgan + console) and clear success/error messages

## Setup
Requires Node 18+ and a running MongoDB (local or Atlas).

```bash
# 1. API
cd server
cp .env.example .env     # fill in MONGO_URI, admin login, SMTP details
npm install
npm run dev              # http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev              # http://localhost:5173
```

### Gmail SMTP
Turn on 2-Step Verification, create an App Password, and use it as `SMTP_PASS`
(`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`). Personal Gmail accounts allow roughly 500 emails/day.

## API
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` returns `{token}` |
| POST | `/api/mail/send` | `{subject, body, recipients[]}` (auth) |
| GET  | `/api/mail?page=1` | Paginated history (auth) |
| GET  | `/api/mail/:id` | One mail with body and results (auth) |

## Before production
Hash the admin password or store admins in a User collection, add rate limiting
(express-rate-limit), and use a job queue (BullMQ) for very large sends.
