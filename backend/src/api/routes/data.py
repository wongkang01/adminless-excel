"""
Adminless Backend - Data Routes
"""
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import List, Dict, Any
from src.sandbox.e2b_manager import sandbox_manager
import json

router = APIRouter()


@router.get("/data/preview")
async def get_data_preview(session_id: str = Query(...)):
    """Get a preview of the loaded data (first 100 rows)."""
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if not session.data_loaded:
        return {"success": False, "data": [], "total_rows": 0, "columns": []}
        
    code = """
import pandas as pd
import json
import os

# Load df_master from pickle
if os.path.exists('/home/user/df_master.pkl'):
    df_master = pd.read_pickle('/home/user/df_master.pkl')
    # Handle NaN values for JSON serialization
    json_data = df_master.head(100).fillna("").to_dict(orient='records')
    print(json.dumps({
        "data": json_data,
        "total_rows": len(df_master),
        "columns": list(df_master.columns)
    }, default=str))
else:
    print('{"data": [], "total_rows": 0, "columns": []}')
"""
    
    result = await sandbox_manager.run_code(session_id, code)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {result.get('error')}")
        
    try:
        response_data = json.loads(result.get("output", "{}"))
        return {"success": True, **response_data}
    except json.JSONDecodeError:
         raise HTTPException(status_code=500, detail="Failed to parse data response")


@router.get("/data/columns")
async def get_columns(session_id: str = Query(...)):
    """Get column names and types."""
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    code = """
import pandas as pd
import json
import os

if os.path.exists('/home/user/df_master.pkl'):
    df_master = pd.read_pickle('/home/user/df_master.pkl')
    dtypes = {k: str(v) for k, v in df_master.dtypes.items()}
    print(json.dumps({
        "columns": list(df_master.columns),
        "dtypes": dtypes
    }))
else:
    print('{"columns": [], "dtypes": {}}')
"""
    
    result = await sandbox_manager.run_code(session_id, code)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Failed to fetch columns: {result.get('error')}")
        
    return json.loads(result.get("output", "{}"))


@router.get("/data/files")
async def get_files(session_id: str = Query(...)):
    """Get list of loaded files with metadata."""
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if not session.data_loaded:
        return {"success": True, "files": []}
        
    code = """
import json
import os

if os.path.exists('/home/user/files_meta.json'):
    with open('/home/user/files_meta.json', 'r') as f:
        files = json.load(f)
    print(json.dumps({"files": files}))
else:
    print('{"files": []}')
"""
    
    result = await sandbox_manager.run_code(session_id, code)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Failed to fetch files: {result.get('error')}")
        
    return {"success": True, **json.loads(result.get("output", '{"files": []}'))}


@router.get("/data/preview/{filename}")
async def get_file_preview(filename: str, session_id: str = Query(...)):
    """Get preview of a specific file (first 100 rows)."""
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Sanitize filename to prevent path traversal
    safe_filename = filename.replace("/", "").replace("\\", "")
        
    code = f"""
import pandas as pd
import json
import os

pickle_path = '/home/user/{safe_filename}.pkl'
if os.path.exists(pickle_path):
    df = pd.read_pickle(pickle_path)
    json_data = df.head(100).fillna("").to_dict(orient='records')
    print(json.dumps({{
        "data": json_data,
        "total_rows": len(df),
        "columns": list(df.columns)
    }}, default=str))
else:
    print('{{"error": "File not found"}}')
"""
    
    result = await sandbox_manager.run_code(session_id, code)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file: {result.get('error')}")
        
    response_data = json.loads(result.get("output", "{}"))
    if "error" in response_data:
        raise HTTPException(status_code=404, detail=response_data["error"])
        
    return {"success": True, "filename": filename, **response_data}


class UpdateDataRequest(BaseModel):
    session_id: str
    data: List[Dict[str, Any]]


@router.post("/data/update")
async def update_master_data(request: UpdateDataRequest):
    """Update the master DataFrame with edited data."""
    session = sandbox_manager.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Serialize data to JSON for passing to sandbox
    data_json = json.dumps(request.data, default=str)
    
    code = f"""
import pandas as pd
import json

data = json.loads('''{data_json}''')
df_master = pd.DataFrame(data)
df_master.to_pickle('/home/user/df_master.pkl')
print(json.dumps({{"success": True, "rows": len(df_master)}}))
"""
    
    result = await sandbox_manager.run_code(request.session_id, code)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Failed to update data: {result.get('error')}")
        
    return {"success": True, "message": "Data updated successfully"}

