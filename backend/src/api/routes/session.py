"""
Adminless Backend - Session Management
"""
from fastapi import APIRouter, Depends, HTTPException
from src.sandbox.e2b_manager import sandbox_manager

router = APIRouter()


@router.post("/session/create")
async def create_session():
    """Create a new session with an E2B sandbox."""
    try:
        session_id = await sandbox_manager.create_session()
        return {"session_id": session_id, "message": "Session created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
