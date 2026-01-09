# AGENTS.md

Adminless is an LLM-powered data analysis tool that allows users to interact with Excel/CSV data through natural language.

## Project Structure

```
adminless/
├── backend/          # FastAPI + Pydantic AI + E2B sandbox
│   └── src/
│       ├── agent/    # Pydantic AI agent and tools
│       ├── api/      # FastAPI routes
│       ├── models/   # Request/response models
│       └── sandbox/  # E2B sandbox manager
├── frontend/         # Next.js 16 + Shadcn UI + Recharts
│   ├── app/          # App router pages
│   ├── components/   # UI components
│   └── lib/          # API client and utilities
└── docs/             # Documentation
```

## Setup Commands

### Backend
```bash
cd backend
uv sync                              # Install dependencies
uv run uvicorn src.main:app --reload # Start dev server
```

### Frontend
```bash
cd frontend
bun install                          # Install dependencies
bun run dev                          # Start dev server on port 3000
```

## Environment Variables

### Backend (.env)
```
GOOGLE_API_KEY=your_google_api_key
E2B_API_KEY=your_e2b_api_key
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Code Style

### Backend (Python)
- Use type hints everywhere
- Pydantic models for all request/response schemas
- Async functions for I/O operations
- Follow PEP 8 conventions

### Frontend (TypeScript)
- Strict TypeScript mode
- Functional React components with hooks
- Shadcn UI components for consistency
- TanStack Query for data fetching

## Architecture Overview

1. **User uploads files** → Frontend sends to `/api/upload`
2. **Backend creates E2B sandbox** → Loads data into `df_master` DataFrame
3. **User asks questions** → `/api/chat` runs Pydantic AI agent
4. **Agent executes Python** → Code runs in E2B sandbox securely
5. **Structured response** → Returns answer, chart_config, or table_data
6. **Frontend renders** → Recharts for visualizations, inline tables for data

## Key Files

| File | Description |
|------|-------------|
| `backend/src/agent/core.py` | Pydantic AI agent definition and system prompt |
| `backend/src/sandbox/e2b_manager.py` | E2B sandbox lifecycle management |
| `backend/src/api/routes/chat.py` | Chat endpoint connecting agent to API |
| `frontend/app/dashboard/page.tsx` | Main dashboard with chat and data views |
| `frontend/components/ChartRenderer.tsx` | Recharts visualization component |

## Testing

```bash
# Backend - verify imports
cd backend && uv run python -c "from src.main import app; print('OK')"

# Frontend - type check
cd frontend && bun run build
```

## Security Considerations

- All user code executes in **isolated E2B sandboxes** (not on host)
- Session data is ephemeral and stored in sandbox filesystem
- API keys should never be exposed to frontend
- CORS is configured to allow only specified frontend URL


## External Documentation for frameworks/libraries used
Pydantic AI: https://ai.pydantic.dev/agents/
E2B: https://e2b.dev/docs