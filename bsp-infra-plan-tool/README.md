# BSP Infrastructure Plan Tool

Web application for processing daily Excel-XML line order reports, detecting planned delivery date changes, and highlighting SLA risks.

## Features

- Manual upload of Excel SpreadsheetML reports (worksheet **Lijn orders**)
- Change detection: planned delivery date moved later vs previous report
- SLA risk highlighting (Netherlands business days)
- Customer dashboard grouped by `Bedrijf`
- Change history with filters and CSV export
- Configurable SLA per line type (Onnet / Offnet / Special)
- Dark mode

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:8080**

1. Go to **Instellingen** and configure SLA days
2. Upload a daily `.xml` report via **Upload**
3. Review customer impact on **Dashboard**

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server: http://localhost:5173 (proxies `/api` to backend)

### Tests

```bash
cd backend
pytest
```

## Architecture

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Deployment:** Docker Compose (on-premises)

See [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Sample data

Use anonymized Excel or Excel-XML exports with worksheet `Lijn orders` matching the VodafoneZiggo/KPN report format.
