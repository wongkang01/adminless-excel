"""
Adminless Backend - FastAPI Application
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.models.requests import TestAgentRequest
from src.models.responses import TestAgentResponse
from src.sandbox.e2b_manager import sandbox_manager
from src.agent.core import AgentDeps


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("🚀 Adminless Backend starting up...")
    print(f"   Model: {settings.gemini_model} (Google API)")
    
    # Set Google API key for pydantic-ai
    os.environ["GOOGLE_API_KEY"] = settings.google_api_key
    os.environ["E2B_API_KEY"] = settings.e2b_api_key
    
    yield
    
    # Shutdown - cleanup all sessions
    print("👋 Shutting down, cleaning up sessions...")
    for session_id in list(sandbox_manager.sessions.keys()):
        await sandbox_manager.cleanup_session(session_id)


# Create FastAPI app
app = FastAPI(
    title="Adminless Backend",
    description="LLM-powered data analysis tool API",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Adminless Backend",
        "version": "0.1.0"
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "active_sessions": len(sandbox_manager.sessions),
        "model": settings.openrouter_model,
    }


@app.post("/test-agent", response_model=TestAgentResponse)
async def test_agent(request: TestAgentRequest):
    """
    Test endpoint to verify Pydantic AI + E2B integration.
    
    This creates a temporary sandbox, runs the agent, and returns the result.
    """
    try:
        # Create a temporary session for testing
        session_id = await sandbox_manager.create_session()
        
        try:
            # Create agent dependencies
            deps = AgentDeps(
                session_id=session_id,
                schema_info="No data loaded - this is a test endpoint."
            )
            
            # Run the agent
            result = await data_agent.run(request.message, deps=deps)
            
            return TestAgentResponse(
                success=True,
                result=result.data.answer,
                code_executed=result.data.code_executed,
            )
        finally:
            # Always cleanup the test session
            await sandbox_manager.cleanup_session(session_id)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Import and include routers
from src.api.routes import upload, data, session, export, chat

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(data.router, prefix="/api", tags=["data"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(session.router, prefix="/api", tags=["session"])
app.include_router(chat.router, prefix="/api", tags=["chat"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
