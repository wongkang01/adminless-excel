"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    Save,
    ArrowRight,
    Loader2,
    FileSpreadsheet,
    ChevronDown,
    ChevronRight,
    TableIcon,
    Download,
    Pencil,
    X
} from "lucide-react";
import { DataTable } from "@/components/DataTable";

interface FileData {
    name: string;
    data: Record<string, unknown>[];
    columns: string[];
    total_rows: number;
}

export default function ManageDataPage() {
    const router = useRouter();

    // Session state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [fileNames, setFileNames] = useState<string[]>([]);

    // Master data state
    const [masterData, setMasterData] = useState<Record<string, unknown>[]>([]);
    const [editedData, setEditedData] = useState<Record<string, unknown>[]>([]);
    const [masterColumns, setMasterColumns] = useState<string[]>([]);
    const [masterTotalRows, setMasterTotalRows] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Source files state
    const [sourceFiles, setSourceFiles] = useState<FileData[]>([]);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load session on mount
    useEffect(() => {
        const sessionStr = localStorage.getItem('adminless_session');
        if (!sessionStr) {
            router.push('/upload');
            return;
        }

        const session = JSON.parse(sessionStr);
        setSessionId(session.id);
        setFileNames(session.files || []);
        fetchMasterData(session.id);
    }, [router]);

    const fetchMasterData = async (sid: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/preview?session_id=${sid}`
            );
            const json = await res.json();
            if (json.success) {
                setMasterData(json.data);
                setEditedData(json.data);
                setMasterColumns(json.columns);
                setMasterTotalRows(json.total_rows);
            } else {
                setError("Failed to load master data");
            }
        } catch (e) {
            console.error("Failed to fetch master data", e);
            setError("Failed to connect to server");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFileData = async (filename: string) => {
        if (!sessionId) return;

        setLoadingFiles(prev => new Set(prev).add(filename));
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/preview/${encodeURIComponent(filename)}?session_id=${sessionId}`
            );
            const json = await res.json();
            if (json.success) {
                setSourceFiles(prev => {
                    const existing = prev.find(f => f.name === filename);
                    if (existing) {
                        return prev.map(f => f.name === filename ? {
                            name: filename,
                            data: json.data,
                            columns: json.columns,
                            total_rows: json.total_rows
                        } : f);
                    }
                    return [...prev, {
                        name: filename,
                        data: json.data,
                        columns: json.columns,
                        total_rows: json.total_rows
                    }];
                });
            }
        } catch (e) {
            console.error(`Failed to fetch file ${filename}`, e);
        } finally {
            setLoadingFiles(prev => {
                const next = new Set(prev);
                next.delete(filename);
                return next;
            });
        }
    };

    const toggleFileExpanded = async (filename: string) => {
        const newExpanded = new Set(expandedFiles);
        if (newExpanded.has(filename)) {
            newExpanded.delete(filename);
        } else {
            newExpanded.add(filename);
            if (!sourceFiles.find(f => f.name === filename)) {
                await fetchFileData(filename);
            }
        }
        setExpandedFiles(newExpanded);
    };

    const handleCellChange = (rowIndex: number, column: string, value: string) => {
        const newData = [...editedData];
        newData[rowIndex] = { ...newData[rowIndex], [column]: value };
        setEditedData(newData);
        setHasChanges(true);
    };

    const handleStartEdit = () => {
        setEditedData([...masterData]);
        setIsEditing(true);
        setHasChanges(false);
    };

    const handleCancelEdit = () => {
        setEditedData([...masterData]);
        setIsEditing(false);
        setHasChanges(false);
    };

    const handleSave = async () => {
        if (!sessionId || !hasChanges) return;

        setIsSaving(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/update`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        data: editedData,
                    }),
                }
            );
            const json = await res.json();
            if (json.success) {
                setMasterData([...editedData]);
                setHasChanges(false);
                setIsEditing(false);
            } else {
                setError("Failed to save changes");
            }
        } catch (e) {
            console.error("Failed to save", e);
            setError("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async (format: "csv" | "xlsx") => {
        if (!sessionId) return;
        window.open(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/data/export?session_id=${sessionId}&format=${format}`,
            '_blank'
        );
    };

    const handleProceed = () => {
        router.push('/dashboard');
    };

    const getTableColumns = (columns: string[]) => {
        return columns.map(col => ({
            accessorKey: col,
            header: col,
            cell: ({ getValue }: { getValue: () => unknown }) => {
                const val = getValue();
                return <span title={String(val)} className="truncate block max-w-[200px]">{String(val ?? "")}</span>;
            }
        }));
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading your data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col pb-20">
            {/* Header - Simplified */}
            <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card/50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                        <TableIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-semibold">Manage Data</h1>
                        <p className="text-xs text-muted-foreground">
                            {masterTotalRows} total rows from {fileNames.length} file(s)
                        </p>
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6 space-y-6">
                    {/* Master Dataset */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Master Dataset</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Merged from: {fileNames.join(", ")}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isEditing ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleExport('csv')}
                                            >
                                                <Download className="w-4 h-4 mr-2" />
                                                Export CSV
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleStartEdit}
                                            >
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCancelEdit}
                                                disabled={isSaving}
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleSave}
                                                disabled={!hasChanges || isSaving}
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4 mr-2" />
                                                )}
                                                Save Changes
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {isEditing && (
                                <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                                    Edit cells directly in the table below. Click Save Changes when done.
                                </p>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isEditing ? (
                                <div className="rounded-md border overflow-auto max-h-[500px]">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 bg-background z-10 border-b">
                                            <tr>
                                                {masterColumns.map(col => (
                                                    <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {editedData.slice(0, 100).map((row, rowIdx) => (
                                                <tr key={rowIdx} className="border-b border-border/50">
                                                    {masterColumns.map(col => (
                                                        <td key={col} className="px-1 py-1">
                                                            <Input
                                                                value={String(row[col] ?? '')}
                                                                onChange={(e) => handleCellChange(rowIdx, col, e.target.value)}
                                                                className="h-8 text-sm min-w-[100px]"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {editedData.length > 100 && (
                                        <p className="text-xs text-muted-foreground p-2 text-center bg-muted/30">
                                            Showing first 100 of {editedData.length} rows for editing
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <DataTable
                                    columns={getTableColumns(masterColumns)}
                                    data={masterData}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Source Files */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Source Files</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                View original data from each uploaded file (read-only)
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {fileNames.map(filename => {
                                const fileData = sourceFiles.find(f => f.name === filename);
                                const isExpanded = expandedFiles.has(filename);
                                const isLoadingFile = loadingFiles.has(filename);

                                return (
                                    <div key={filename} className="border border-border rounded-lg overflow-hidden">
                                        <button
                                            className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
                                            onClick={() => toggleFileExpanded(filename)}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                            )}
                                            <FileSpreadsheet className="w-4 h-4 text-green-500 shrink-0" />
                                            <span className="font-medium text-sm truncate">{filename}</span>
                                            <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                                {fileData ? `${fileData.total_rows} rows` : "Click to load"}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-3 max-h-[400px] overflow-auto">
                                                {isLoadingFile ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : fileData ? (
                                                    <DataTable
                                                        columns={getTableColumns(fileData.columns)}
                                                        data={fileData.data}
                                                    />
                                                ) : (
                                                    <p className="text-sm text-muted-foreground text-center py-4">
                                                        Loading...
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Floating Proceed Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    size="lg"
                    onClick={handleProceed}
                    className="shadow-lg"
                >
                    Proceed to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
            </div>
        </div>
    );
}
