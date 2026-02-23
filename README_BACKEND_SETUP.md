# Backend (scaffold) – CoreBill

Acest folder adaugă un **backend real (API modular)** separat de UI.

## Rulare locală (fără Docker)

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

API: `http://localhost:3000`

## Rulare cu Docker

Din rădăcina proiectului:

```bash
docker compose up --build
```

## Endpoints MVP (funcționale acum)

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /companies/mine`
- `GET/POST/PUT/DELETE /clients`
- `GET/POST/PUT/DELETE /products`
- `POST /invoices/create`
- `GET /invoices`
- `GET /invoices/:id`
- `POST /payments/add`
- `GET /payments/list`
- `GET /audit`

## Endpoints scaffold (stub)

- `POST /efactura/submit/:id` (creează submission PENDING)
- `GET /efactura/status/:id`
- `GET /efactura/events/:id`
- `POST /saga/export` (creează un export PENDING)
- `GET /saga/history`

> PDF generator + integrarea reală ANAF/SAGA vor veni în pasul următor.
