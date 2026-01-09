"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useMemo, memo } from "react";
import { Download, Loader2, User, Bot, TableIcon, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, FileSpreadsheet, ArrowLeft, Edit } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { ChatInput } from "@/components/ChatInput";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    tableData?: Record<string, unknown>[];
    chartImage?: string;  // Base64-encoded PNG from matplotlib
    codeExecuted?: string;
}

interface FileData {
    name: string;
    data: Record<string, unknown>[];
    columns: string[];
}

export default function DashboardPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hello! I'm your data analyst assistant. I've loaded your data and I'm ready to help. Ask me anything about your data!",
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);

    // Data State - now supports multiple files
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [files, setFiles] = useState<FileData[]>([]);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [showDataPanel, setShowDataPanel] = useState(true);

    // Load session on mount
    useEffect(() => {
        const sessionStr = localStorage.getItem('adminless_session');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            setSessionId(session.id);
            // Initialize expanded files from session
            if (session.files && Array.isArray(session.files)) {
                setExpandedFiles(new Set(session.files));
            }
            fetchData(session.id, session.files || []);
        }
    }, []);

    const fetchData = async (sid: string, fileNames: string[]) => {
        setIsDataLoading(true);
        try {
            const allFiles: { name: string; data: Record<string, unknown>[]; columns: string[] }[] = [];

            // First, fetch the master dataset
            const masterRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/preview?session_id=${sid}`);
            const masterJson = await masterRes.json();
            if (masterJson.success) {
                allFiles.push({
                    name: "Master Dataset (Merged)",
                    data: masterJson.data,
                    columns: masterJson.columns
                });
            }

            // Then fetch individual source files
            const filesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/files?session_id=${sid}`);
            const filesJson = await filesRes.json();

            if (filesJson.success && filesJson.files && filesJson.files.length > 0) {
                // Fetch preview for each file
                const fileDataPromises = filesJson.files.map(async (fileInfo: { name: string; rows: number; columns: string[] }) => {
                    const previewRes = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/preview/${encodeURIComponent(fileInfo.name)}?session_id=${sid}`
                    );
                    const previewJson = await previewRes.json();
                    return {
                        name: fileInfo.name,
                        data: previewJson.success ? previewJson.data : [],
                        columns: previewJson.success ? previewJson.columns : fileInfo.columns
                    };
                });

                const sourceFiles = await Promise.all(fileDataPromises);
                allFiles.push(...sourceFiles);
            }

            setFiles(allFiles);
            // Only expand master dataset by default
            setExpandedFiles(new Set(["Master Dataset (Merged)"]));
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setIsDataLoading(false);
        }
    };

    const handleExport = async (format: "csv" | "xlsx") => {
        if (!sessionId) return;
        window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/export?session_id=${sessionId}&format=${format}`, '_blank');
    };

    const toggleFileExpanded = (fileName: string) => {
        setExpandedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileName)) {
                newSet.delete(fileName);
            } else {
                newSet.add(fileName);
            }
            return newSet;
        });
    };

    // Chat message handler - memoized to prevent ChatInput re-renders
    const handleChatMessage = useCallback(async (message: string) => {
        if (!message.trim() || isLoading) return;

        if (!sessionId) {
            alert("No active session. Please upload files first.");
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: message,
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: message,
                }),
            });

            const data = await response.json();

            if (data.success) {
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: data.answer,
                    codeExecuted: data.code_executed,
                    chartImage: data.chart_image,  // Base64 image from matplotlib
                    tableData: data.table_data,
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else {
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: `Error: ${data.error || "Something went wrong."}`,
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Failed to connect to the agent.",
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, sessionId]);

    // Memoized column definitions to prevent re-renders
    const getTableColumns = useCallback((columns: string[]) => {
        return columns.map(col => ({
            accessorKey: col,
            header: col,
            cell: ({ getValue }: any) => {
                const val = getValue();
                return <span title={String(val)} className="truncate block max-w-[200px]">{String(val)}</span>;
            }
        }));
    }, []);

    // Memoize total row count
    const totalRows = useMemo(() => files.reduce((sum, f) => sum + f.data.length, 0), [files]);

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card/50 shrink-0">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/manage')}
                        title="Back to Manage Data"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="p-2 rounded-lg bg-primary/20">
                        <TableIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-semibold">Adminless Dashboard</h1>
                        <p className="text-xs text-muted-foreground">
                            {totalRows > 0 ? `${totalRows} rows loaded` : "Loading data..."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push('/manage')}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Data
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden min-h-0">

                {/* Data Panel (Collapsible) */}
                {showDataPanel && (
                    <div className="flex-1 border-r border-border overflow-y-hidden flex flex-col bg-card/30 w-1/2 max-w-[50%]">
                        {/* Panel Header */}
                        <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                            <h2 className="font-semibold text-sm">Data Files</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setShowDataPanel(false)}
                                title="Collapse panel"
                            >
                                <PanelLeftClose className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* File Sections - using div instead of ScrollArea for horizontal scroll support */}
                        <div className="flex-1 min-h-0 overflow-auto">
                            {isDataLoading ? (
                                <div className="flex items-center justify-center h-full p-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {files.map((file) => (
                                        <div key={file.name} className="border border-border rounded-lg">
                                            {/* File Header */}
                                            <button
                                                className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
                                                onClick={() => toggleFileExpanded(file.name)}
                                            >
                                                {expandedFiles.has(file.name) ? (
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                                )}
                                                <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                                                <span className="font-medium text-sm truncate">{file.name}</span>
                                                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                                    {file.data.length} rows
                                                </span>
                                            </button>

                                            {/* File Data Table */}
                                            {expandedFiles.has(file.name) && (
                                                <div className="p-3 overflow-x-auto">
                                                    <DataTable
                                                        columns={getTableColumns(file.columns)}
                                                        data={file.data}
                                                        scrollable={true}
                                                        maxHeight="350px"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Collapsed Panel Toggle */}
                {!showDataPanel && (
                    <div className="border-r border-border bg-card/30 flex flex-col items-center py-4 px-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setShowDataPanel(true)}
                            title="Expand panel"
                        >
                            <PanelLeft className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                {/* Chat Panel */}
                <div className={`${showDataPanel ? 'flex-1' : 'flex-1'} flex flex-col h-full overflow-hidden transition-all duration-300`}>
                    {/* Messages */}
                    <ScrollArea className="flex-1 p-6 min-h-0">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    {message.role === "assistant" && (
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                            <Bot className="w-4 h-4 text-primary" />
                                        </div>
                                    )}
                                    <Card
                                        className={`max-w-[80%] ${message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                            }`}
                                    >
                                        <CardContent className="p-4">
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                            {/* Table Data */}
                                            {message.tableData && message.tableData.length > 0 && (
                                                <div className="mt-4 overflow-x-auto">
                                                    <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                                                        <thead className="bg-muted/50">
                                                            <tr>
                                                                {Object.keys(message.tableData[0]).map((key) => (
                                                                    <th key={key} className="px-3 py-2 text-left font-medium text-muted-foreground">
                                                                        {key}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {message.tableData.slice(0, 10).map((row, idx) => (
                                                                <tr key={idx} className="border-t border-border">
                                                                    {Object.values(row).map((val, vIdx) => (
                                                                        <td key={vIdx} className="px-3 py-2">
                                                                            {String(val)}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className="flex items-center justify-between mt-2">
                                                        {message.tableData.length > 10 && (
                                                            <p className="text-xs text-muted-foreground">
                                                                Showing 10 of {message.tableData.length} rows
                                                            </p>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="ml-auto"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch(
                                                                        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/export-subset`,
                                                                        {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                data: message.tableData,
                                                                                format: 'csv',
                                                                                filename: `query_result_${message.id}`
                                                                            }),
                                                                        }
                                                                    );
                                                                    if (res.ok) {
                                                                        const blob = await res.blob();
                                                                        const url = window.URL.createObjectURL(blob);
                                                                        const a = document.createElement('a');
                                                                        a.href = url;
                                                                        a.download = `query_result_${message.id}.csv`;
                                                                        document.body.appendChild(a);
                                                                        a.click();
                                                                        window.URL.revokeObjectURL(url);
                                                                        a.remove();
                                                                    }
                                                                } catch (e) {
                                                                    console.error('Export failed:', e);
                                                                }
                                                            }}
                                                        >
                                                            <Download className="w-3 h-3 mr-1" />
                                                            Download CSV
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Charts - matplotlib base64 image */}
                                            {message.chartImage && (
                                                <div className="mt-4 w-full flex justify-center">
                                                    <img
                                                        src={`data:image/png;base64,${message.chartImage}`}
                                                        alt="Chart visualization"
                                                        className="max-w-full h-auto rounded-lg border border-border"
                                                    />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                    {message.role === "user" && (
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <User className="w-4 h-4 text-blue-400" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-primary" />
                                    </div>
                                    <Card className="bg-muted">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-sm text-muted-foreground">Analyzing...</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input - Using memoized component to prevent lag */}
                    <ChatInput
                        onSend={handleChatMessage}
                        isLoading={isLoading}
                        disabled={!sessionId}
                    />
                </div>
            </div>
        </div>
    );
}
