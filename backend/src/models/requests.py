"""
Adminless Backend - Request Models
"""
from pydantic import BaseModel, Field
from typing import Optional


class TestAgentRequest(BaseModel):
    """Request for testing the agent."""
    message: str = Field(..., description="Message to send to the agent")


class ChatRequest(BaseModel):
    """Request for chat endpoint."""
    session_id: str = Field(..., description="Session ID")
    message: str = Field(..., description="User message")


class CellEditRequest(BaseModel):
    """Request to edit a cell in the data."""
    session_id: str
    row_index: int
    column_name: str
    new_value: str
