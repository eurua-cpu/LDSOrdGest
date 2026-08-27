# Order Management - Progetto 1

MVP locale per la gestione ordini.

## Requisiti
- Node.js 22 LTS
- Docker Desktop
- Visual Studio Code

## Avvio PostgreSQL
```bash
docker compose up -d
```

## Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

API:
- http://localhost:3000/api/health
- http://localhost:3000/api/orders

Per fermare PostgreSQL:
```bash
docker compose down
```
