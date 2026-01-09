"""
Adminless Backend - Response Models
"""
from pydantic import BaseModel, Field
from typing import Optional, Any


class TestAgentResponse(BaseModel):
    """Response from test agent endpoint."""
    success: bool
    result: str
    code_executed: Optional[str] = None


class SessionResponse(BaseModel):
    """Response when creating a session."""
    session_id: str
    message: str


class UploadResponse(BaseModel):
    """Response after file upload."""
    success: bool
    session_id: str
    files_uploaded: list[str]
    total_rows: int
    columns: list[str]


class DataPreviewResponse(BaseModel):
    """Response with data preview."""
    success: bool
    data: list[dict[str, Any]]
    total_rows: int
    columns: list[str]


class ChatResponse(BaseModel):
    """Response from chat/query endpoint."""
    success: bool
    answer: str
    code_executed: Optional[str] = None
    table_data: Optional[list[dict[str, Any]]] = None
    chart_image: Optional[str] = None  # Base64-encoded PNG from matplotlib
    error: Optional[str] = None


class ExportResponse(BaseModel):
    """Response for export endpoint."""
    success: bool
    filename: str
    download_url: str
