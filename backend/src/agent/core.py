"""
Adminless Backend - Pydantic AI Agent Core
"""
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from typing import Optional, Any
import os

from src.config import get_settings


# Global storage for chart images captured during code execution
_last_chart_image: dict[str, str | None] = {}


def get_last_chart_image(session_id: str) -> str | None:
    """Get the last chart image generated for a session."""
    return _last_chart_image.get(session_id)


def clear_chart_image(session_id: str):
    """Clear stored chart image for a session."""
    _last_chart_image.pop(session_id, None)


class AgentDeps(BaseModel):
    """Dependencies injected into the agent."""
    session_id: str
    schema_info: str = ""
    
    class Config:
        arbitrary_types_allowed = True


class AgentResponse(BaseModel):
    """Structured response from the agent."""
    answer: str = Field(..., description="The answer to the user's question")
    code_executed: Optional[str] = Field(None, description="Python code that was executed")
    chart_image: Optional[str] = Field(None, description="Base64-encoded chart image from matplotlib")
    table_data: Optional[list[dict[str, Any]]] = Field(None, description="Table data to display")


# System prompt template for the data analyst agent
def get_system_prompt(schema_info: str) -> str:
    return f"""You are a Python Data Analyst. Analyze data and provide clear answers.

AVAILABLE DATA:
{schema_info}

YOUR RESPONSE FIELDS:
- answer: Text explanation (REQUIRED - always provide this)
- table_data: Array of row objects for table display (optional)

IMPORTANT: Do NOT set chart_image in your response. Charts are auto-captured from code output.

═══════════════════════════════════════════════════════════════
CHART/VISUALIZATION GENERATION
═══════════════════════════════════════════════════════════════

When user asks for a chart, run execute_python with matplotlib code.
The chart will be automatically captured when you print CHART_IMAGE.

Example code to execute:
```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64

# Create figure
fig, ax = plt.subplots(figsize=(8, 6))

# Create your chart (example: pie chart)
data = df_master['Column'].value_counts()
ax.pie(data.values, labels=data.index, autopct='%1.1f%%')
ax.set_title('Title Here')

# Save to base64 and print - this is how the chart gets captured
plt.tight_layout()
buffer = io.BytesIO()
fig.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
buffer.seek(0)
img_base64 = base64.b64encode(buffer.getvalue()).decode()
plt.close(fig)

print(f"CHART_IMAGE:{{img_base64}}")
print("Chart generated successfully")
```

After running this code, just set answer to describe the chart. Do NOT set chart_image yourself.

═══════════════════════════════════════════════════════════════
TABLE GENERATION
═══════════════════════════════════════════════════════════════

For table requests, set table_data to an array of objects:
[{{"col1": "val1", "col2": "val2"}}, ...]

═══════════════════════════════════════════════════════════════
AVAILABLE DATAFRAMES
═══════════════════════════════════════════════════════════════
- df_master: merged data with _source_file column
- df_<filename>: individual files (df_2023_xlsx, df_2024_xlsx)

═══════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════
- ALWAYS use execute_python first to compute values
- For charts: Run matplotlib code that prints "CHART_IMAGE:<base64>"
- For tables: Return table_data array in your response
- Keep answers concise
- NEVER set chart_image in your response - it's auto-captured
"""


def create_agent(schema_info: str = ""):
    """Create the Pydantic AI agent for data analysis."""
    settings = get_settings()
    
    # Use Google provider directly with the specific model
    # User requested to declare model in code
    # pydantic-ai uses 'google-gla:' prefix for Google Generative Language API
    model_id = "gemini-3-flash-preview"
    model = f"google-gla:{model_id}"
    
    agent = Agent(
        model,
        output_type=AgentResponse,
        system_prompt=get_system_prompt(schema_info),
        deps_type=AgentDeps,
    )
    
    # Register the execute_python tool
    @agent.tool
    async def execute_python(ctx: RunContext[AgentDeps], code: str) -> str:
        """
        Execute Python code in a secure E2B sandbox.
        
        The sandbox has pandas loaded and df_master available with the user's data.
        Use this tool to analyze data, compute statistics, and generate results.
        
        Args:
            code: Python code to execute. The DataFrame is available as df_master.
        
        Returns:
            The output/result of the code execution.
        """
        from src.sandbox.e2b_manager import sandbox_manager
        
        session_id = ctx.deps.session_id
        
        # Wrap code to ensure df_master and individual files are loaded from pickle
        wrapped_code = f"""
import pandas as pd
import json
import os
import re

# Load df_master from pickle
if os.path.exists('/home/user/df_master.pkl'):
    df_master = pd.read_pickle('/home/user/df_master.pkl')
else:
    df_master = pd.DataFrame()

# Load individual file pickles as df_<sanitized_filename>
# e.g., 2023.xlsx becomes df_2023_xlsx
for pkl_file in os.listdir('/home/user'):
    if pkl_file.endswith('.pkl') and pkl_file != 'df_master.pkl':
        # Get original filename (remove .pkl extension)
        original_name = pkl_file[:-4]  # Remove .pkl
        # Sanitize: replace non-alphanumeric with underscore
        var_name = 'df_' + re.sub(r'[^a-zA-Z0-9]', '_', original_name)
        try:
            exec(f"{{var_name}} = pd.read_pickle('/home/user/{{pkl_file}}')")
        except Exception:
            pass

# User's code
{code}
"""
        
        result = await sandbox_manager.run_code(session_id, wrapped_code)
        
        if not result["success"]:
            return f"Error: {result.get('error', 'Unknown error')}"
        
        output = result.get("output", "")
        results = result.get("results", [])
        
        # Capture CHART_IMAGE from output
        if "CHART_IMAGE:" in output:
            lines = output.split("\n")
            for line in lines:
                if line.startswith("CHART_IMAGE:"):
                    chart_base64 = line[len("CHART_IMAGE:"):]
                    _last_chart_image[session_id] = chart_base64
                    # Remove chart line from visible output
                    output = "\n".join(l for l in lines if not l.startswith("CHART_IMAGE:"))
                    break
        
        if results:
            return "\n".join(results)
        return output or "Code executed successfully"
    
    return agent


# Note: Agent is created dynamically in the chat endpoint with schema_info
# No module-level agent is needed
