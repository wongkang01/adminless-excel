"""
Adminless Backend - E2B Sandbox Manager
"""
import os
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from e2b_code_interpreter import Sandbox


# Sandbox timeout in seconds (default: 30 minutes)
SANDBOX_TIMEOUT = int(os.getenv("E2B_SANDBOX_TIMEOUT", "1800"))


@dataclass
class Session:
    """Represents a user session with an E2B sandbox."""
    id: str
    sandbox: Sandbox
    created_at: datetime
    files: list[str] = field(default_factory=list)
    data_loaded: bool = False
    _file_backups: dict = field(default_factory=dict)  # For reconnection


class SandboxManager:
    """Manages E2B sandbox sessions with auto-recovery."""
    
    def __init__(self):
        self.sessions: dict[str, Session] = {}
    
    async def create_session(self) -> str:
        """Create a new session with an E2B sandbox."""
        session_id = str(uuid4())
        
        # Create E2B sandbox with extended timeout
        sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT)
        
        # Pre-install pandas, openpyxl, and matplotlib in the sandbox
        sandbox.run_code("""
import subprocess
subprocess.run(['pip', 'install', 'pandas', 'openpyxl', 'xlrd', 'matplotlib'], capture_output=True)
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
print("Dependencies ready!")
""")
        
        self.sessions[session_id] = Session(
            id=session_id,
            sandbox=sandbox,
            created_at=datetime.now(),
            files=[],
            data_loaded=False,
        )
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """Get a session by ID."""
        return self.sessions.get(session_id)
    
    def is_sandbox_alive(self, session_id: str) -> bool:
        """Check if a sandbox is still alive and responsive."""
        session = self.get_session(session_id)
        if not session:
            return False
        
        try:
            # Quick health check - run minimal code
            result = session.sandbox.run_code("print('ok')")
            return result.error is None
        except Exception:
            return False
    
    async def reconnect_session(self, session_id: str) -> bool:
        """Attempt to recreate a sandbox for an expired session."""
        old_session = self.sessions.get(session_id)
        if not old_session:
            return False
        
        try:
            # Create new sandbox
            new_sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT)
            
            # Reinstall dependencies
            new_sandbox.run_code("""
import subprocess
subprocess.run(['pip', 'install', 'pandas', 'openpyxl', 'xlrd', 'matplotlib'], capture_output=True)
import pandas as pd
import matplotlib
matplotlib.use('Agg')
print("Reconnected!")
""")
            
            # Restore file backups if available
            for path, content in old_session._file_backups.items():
                new_sandbox.files.write(path, content)
            
            # Update session with new sandbox
            old_session.sandbox = new_sandbox
            old_session.data_loaded = bool(old_session._file_backups)
            
            return True
        except Exception as e:
            print(f"Reconnection failed: {e}")
            return False
    
    async def upload_file_to_sandbox(self, session_id: str, filename: str, content: bytes) -> bool:
        """Upload a file to the session's sandbox."""
        session = self.get_session(session_id)
        if not session:
            return False
        
        # Write file to sandbox filesystem
        sandbox_path = f"/home/user/{filename}"
        session.sandbox.files.write(sandbox_path, content)
        session.files.append(sandbox_path)
        
        # Backup file content for reconnection
        session._file_backups[sandbox_path] = content
        
        return True
    
    async def run_code(self, session_id: str, code: str) -> dict:
        """Run Python code in the session's sandbox with auto-reconnection."""
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "Session not found"}
        
        # Check sandbox health and reconnect if needed
        if not self.is_sandbox_alive(session_id):
            print(f"Sandbox expired for session {session_id}, attempting reconnection...")
            reconnected = await self.reconnect_session(session_id)
            if not reconnected:
                return {
                    "success": False, 
                    "error": "Sandbox expired. Please refresh the page and re-upload your files."
                }
            print(f"Reconnection successful for session {session_id}")
        
        try:
            result = session.sandbox.run_code(code)
            
            # Check for errors
            if result.error:
                return {
                    "success": False,
                    "error": str(result.error),
                    "output": result.text or ""
                }
            
            # Get output from logs.stdout (where print() output goes)
            output = ""
            if hasattr(result, 'logs') and result.logs:
                if hasattr(result.logs, 'stdout') and result.logs.stdout:
                    output = "\n".join(result.logs.stdout) if isinstance(result.logs.stdout, list) else str(result.logs.stdout)
            
            # Fallback to result.text
            if not output:
                output = result.text or ""
            
            return {
                "success": True,
                "output": output,
                "results": [str(r) for r in result.results] if result.results else []
            }
        except Exception as e:
            # Try reconnection on exception
            reconnected = await self.reconnect_session(session_id)
            if reconnected:
                return await self.run_code(session_id, code)  # Retry once
            return {"success": False, "error": str(e)}
    
    async def cleanup_session(self, session_id: str) -> bool:
        """Clean up and close a session."""
        session = self.sessions.pop(session_id, None)
        if session:
            try:
                session.sandbox.kill()
            except Exception:
                pass
            return True
        return False


# Global sandbox manager instance
sandbox_manager = SandboxManager()

