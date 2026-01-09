"""
Adminless Backend - Export Routes
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Dict, Any
from src.sandbox.e2b_manager import sandbox_manager
import pandas as pd
import io

router = APIRouter()


@router.get("/data/export")
async def export_data(
    session_id: str = Query(...),
    format: str = Query("csv", pattern="^(csv|xlsx)$")
):
    """
    Export the master dataset as CSV or Excel.
    """
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if not session.data_loaded:
        raise HTTPException(status_code=400, detail="No data loaded to export")
        
    if format == "csv":
        code = """
import pandas as pd
import os

if os.path.exists('/home/user/df_master.pkl'):
    df_master = pd.read_pickle('/home/user/df_master.pkl')
    print(df_master.to_csv(index=False))
else:
    print("")
"""
        result = await sandbox_manager.run_code(session_id, code)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=f"Export failed: {result.get('error')}")
            
        content = result.get("output", "")
        media_type = "text/csv"
        filename = "master_data.csv"
        
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    else: # xlsx
        code = """
import pandas as pd
import io
import base64
import os

if os.path.exists('/home/user/df_master.pkl'):
    df_master = pd.read_pickle('/home/user/df_master.pkl')
    buffer = io.BytesIO()
    df_master.to_excel(buffer, index=False)
    buffer.seek(0)
    print(base64.b64encode(buffer.getvalue()).decode('utf-8'))
else:
    print("")
"""
        result = await sandbox_manager.run_code(session_id, code)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=f"Export failed: {result.get('error')}")
            
        import base64
        try:
            content = base64.b64decode(result.get("output", ""))
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "master_data.xlsx"
            
            return Response(
                content=content,
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to decode excel data: {str(e)}")


class ExportSubsetRequest(BaseModel):
    data: List[Dict[str, Any]]
    format: str = "csv"
    filename: str = "subset_data"


@router.post("/data/export-subset")
async def export_subset(request: ExportSubsetRequest):
    """
    Export a subset table (from chat response) as CSV or Excel.
    Does not require session - data is passed directly.
    """
    if not request.data:
        raise HTTPException(status_code=400, detail="No data provided")
        
    try:
        df = pd.DataFrame(request.data)
        
        if request.format == "xlsx":
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            return Response(
                content=buffer.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={request.filename}.xlsx"}
            )
        else:  # csv
            csv_content = df.to_csv(index=False)
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={request.filename}.csv"}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

