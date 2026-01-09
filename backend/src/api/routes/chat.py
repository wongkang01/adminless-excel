"""
Adminless Backend - Chat Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from src.sandbox.e2b_manager import sandbox_manager
from src.agent.core import AgentDeps
from src.models.requests import ChatRequest
from src.models.responses import ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Chat with the data agent.
    
    1. Gets session and schema info
    2. Runs Pydantic AI agent
    3. Returns structured response (answer, code, charts)
    """
    session = sandbox_manager.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        # Get schema info for context including individual files
        schema_info = "No data loaded."
        if session.data_loaded:
            schema_code = """
import pandas as pd
import json
import os

schema_parts = []

# Master DataFrame info
if os.path.exists('/home/user/df_master.pkl'):
    df_master = pd.read_pickle('/home/user/df_master.pkl')
    schema_parts.append(f"df_master (merged): {len(df_master)} rows, columns: {list(df_master.columns)}")

# Individual file info
if os.path.exists('/home/user/files_meta.json'):
    with open('/home/user/files_meta.json', 'r') as f:
        files = json.load(f)
    for file_info in files:
        name = file_info['name']
        var_name = 'df_' + ''.join(c if c.isalnum() else '_' for c in name)
        schema_parts.append(f"{var_name}: {file_info['rows']} rows, columns: {file_info['columns']}")

print("\\n".join(schema_parts))
"""
            schema_res = await sandbox_manager.run_code(request.session_id, schema_code)
            schema_info = schema_res.get("output", "DataFrame 'df_master' available")
            
        # Create agent dependencies
        deps = AgentDeps(
            session_id=request.session_id,
            schema_info=schema_info
        )
        
        # Create agent with schema info
        from src.agent.core import create_agent
        agent = create_agent(schema_info)
        
        # Clear any previous chart image for this session
        from src.agent.core import clear_chart_image, get_last_chart_image
        clear_chart_image(request.session_id)
        
        # Run the agent
        result = await agent.run(request.message, deps=deps)
        
        # Get chart image from tool execution (if any was generated)
        chart_image = get_last_chart_image(request.session_id)
        
        # Debug: Log what the agent returned
        print(f"DEBUG Agent Response:")
        print(f"  - answer: {result.output.answer[:100] if result.output.answer else 'None'}...")
        print(f"  - chart_image from tools: {'[base64 data]' if chart_image else None}")
        print(f"  - table_data: {result.output.table_data[:2] if result.output.table_data else None}...")
        print(f"  - code_executed: {bool(result.output.code_executed)}")
        
        return ChatResponse(
            success=True,
            answer=result.output.answer,
            code_executed=result.output.code_executed,
            chart_image=chart_image,  # Use captured chart from tool execution
            table_data=result.output.table_data,
        )
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ChatResponse(
            success=False,
            answer="I encountered an error processing your request.",
            error=str(e)
        )
