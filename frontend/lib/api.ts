/**
 * API Client for Adminless Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface TestAgentResponse {
    success: boolean;
    result: string;
    code_executed?: string;
}

export interface SessionResponse {
    session_id: string;
    message: string;
}

export interface UploadResponse {
    success: boolean;
    session_id: string;
    files_uploaded: string[];
    total_rows: number;
    columns: string[];
}

export interface DataPreviewResponse {
    success: boolean;
    data: Record<string, unknown>[];
    total_rows: number;
    columns: string[];
}

export interface ChatResponse {
    success: boolean;
    answer: string;
    code_executed?: string;
    table_data?: Record<string, unknown>[];
    chart_config?: ChartConfig;
    error?: string;
}

export interface ChartConfig {
    type: "bar" | "line" | "pie";
    data: Record<string, unknown>[];
    xKey: string;
    yKey: string;
    title?: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    // Health check
    async health(): Promise<{ status: string; active_sessions: number }> {
        return this.request("/health");
    }

    // Test agent endpoint
    async testAgent(message: string): Promise<TestAgentResponse> {
        return this.request("/test-agent", {
            method: "POST",
            body: JSON.stringify({ message }),
        });
    }

    // Create a new session
    async createSession(): Promise<SessionResponse> {
        return this.request("/api/session/create", {
            method: "POST",
        });
    }

    // Upload files
    async uploadFiles(
        sessionId: string,
        files: File[]
    ): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append("session_id", sessionId);
        files.forEach((file) => formData.append("files", file));

        const response = await fetch(`${this.baseUrl}/api/upload`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || "Upload failed");
        }

        return response.json();
    }

    // Get data preview
    async getDataPreview(sessionId: string): Promise<DataPreviewResponse> {
        return this.request(`/api/data/preview?session_id=${sessionId}`);
    }

    // Get columns
    async getColumns(
        sessionId: string
    ): Promise<{ columns: string[]; dtypes: Record<string, string> }> {
        return this.request(`/api/data/columns?session_id=${sessionId}`);
    }

    // Chat with agent
    async chat(sessionId: string, message: string): Promise<ChatResponse> {
        return this.request("/api/chat", {
            method: "POST",
            body: JSON.stringify({ session_id: sessionId, message }),
        });
    }

    // Export data
    async exportData(
        sessionId: string,
        format: "csv" | "xlsx" = "csv"
    ): Promise<Blob> {
        const response = await fetch(
            `${this.baseUrl}/api/data/export?session_id=${sessionId}&format=${format}`
        );
        if (!response.ok) {
            throw new Error("Export failed");
        }
        return response.blob();
    }
}

export const apiClient = new ApiClient();
export default apiClient;
