"""
Adminless Backend - Upload Routes
"""
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import pandas as pd
import io
from src.sandbox.e2b_manager import sandbox_manager

router = APIRouter()


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    session_id: str = Form(...)
):
    """
    Upload files to a session and load them into the sandbox.
    """
    session = sandbox_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    uploaded_files = []
    
    try:
        # 1. Upload files to E2B sandbox
        for file in files:
            content = await file.read()
            filename = file.filename
            
            # Upload to sandbox
            success = await sandbox_manager.upload_file_to_sandbox(session_id, filename, content)
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to upload {filename} to sandbox")
            
            uploaded_files.append(filename)
        
        # 2. Run Python code in sandbox to load data into df_master AND individual files
        load_code = f'''
import pandas as pd
import json
import traceback
import os

try:
    files = {uploaded_files}
    dfs = []
    file_info = []
    
    # Debug: List files in directory
    print("DEBUG: Files in /home/user:", os.listdir('/home/user'))

    for f in files:
        path = f"/home/user/{{f}}"
        print(f"DEBUG: Reading {{path}}")
        if f.endswith('.xlsx') or f.endswith('.xls'):
            df = pd.read_excel(path)
        else:
            df = pd.read_csv(path)
        
        print(f"DEBUG: Read {{len(df)}} rows from {{f}}")
        
        # Save individual file as pickle for cross-table querying
        pickle_path = f"/home/user/{{f}}.pkl"
        df.to_pickle(pickle_path)
        print(f"DEBUG: Saved individual file to {{pickle_path}}")
        
        file_info.append({{
            "name": f,
            "rows": len(df),
            "columns": list(df.columns)
        }})
        
        # Add source file column for merged master
        df['_source_file'] = f
        dfs.append(df)

    if dfs:
        df_master = pd.concat(dfs, ignore_index=True)
    else:
        df_master = pd.DataFrame()

    # Save df_master to pickle for persistence across code executions
    df_master.to_pickle('/home/user/df_master.pkl')
    print(f"DEBUG: Saved df_master with {{len(df_master)}} rows")
    
    # Save file list metadata
    with open('/home/user/files_meta.json', 'w') as f:
        json.dump(file_info, f)

    print(json.dumps({{
        "total_rows": len(df_master),
        "columns": list(df_master.columns),
        "files": file_info
    }}))
except Exception as e:
    print(f"ERROR: {{str(e)}}")
    traceback.print_exc()
'''
        
        result = await sandbox_manager.run_code(session_id, load_code)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=f"Failed to load data: {result.get('error')}")
            
        # Update session state
        session.data_loaded = True
        
        # Store raw output for debugging
        raw_output = result.get("output", "")
        
        # Parse metadata from output - look for JSON in output lines
        import json
        output = result.get("output", "")
        try:
            # Find the JSON line in the output (last line that looks like JSON)
            lines = output.strip().split('\n')
            json_line = None
            for line in reversed(lines):
                if line.strip().startswith('{'):
                    json_line = line
                    break
            
            if json_line:
                metadata = json.loads(json_line)
            else:
                metadata = {"total_rows": 0, "columns": []}
        except json.JSONDecodeError:
            metadata = {"total_rows": 0, "columns": []}
        
        # Backup pickle files for reconnection support
        try:
            pickle_files = ['/home/user/df_master.pkl', '/home/user/files_meta.json']
            for pkl_path in pickle_files:
                read_result = await sandbox_manager.run_code(session_id, f"""
import base64
try:
    with open('{pkl_path}', 'rb') as f:
        content = f.read()
    print(base64.b64encode(content).decode())
except FileNotFoundError:
    print('FILE_NOT_FOUND')
""")
                if read_result.get("success") and read_result.get("output") != 'FILE_NOT_FOUND':
                    import base64
                    content = base64.b64decode(read_result["output"].strip())
                    session._file_backups[pkl_path] = content
        except Exception as e:
            print(f"Warning: Could not backup pickle files: {e}")
        
        return {
            "success": True,
            "session_id": session_id,
            "files_uploaded": uploaded_files,
            "total_rows": metadata.get("total_rows", 0),
            "columns": metadata.get("columns", []),
            "files": metadata.get("files", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
