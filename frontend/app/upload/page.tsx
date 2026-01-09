"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, ArrowRight, X, Loader2, AlertCircle, CheckCircle, Eye } from "lucide-react";

interface FileValidation {
    file: File;
    status: "pending" | "valid" | "error";
    error?: string;
    preview?: Record<string, unknown>[];
    columns?: string[];
    rowCount?: number;
}

export default function UploadPage() {
    const router = useRouter();
    const [fileValidations, setFileValidations] = useState<FileValidation[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [expandedPreview, setExpandedPreview] = useState<string | null>(null);

    const validateFile = async (file: File): Promise<FileValidation> => {
        // Check file size (empty file)
        if (file.size === 0) {
            return { file, status: "error", error: "File is empty" };
        }

        // Check file size (too large - warn if > 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return { file, status: "error", error: "File is too large (max 10MB)" };
        }

        // For CSV files, we can parse and preview
        if (file.name.endsWith('.csv')) {
            try {
                const text = await file.text();
                const lines = text.trim().split('\n');

                if (lines.length === 0) {
                    return { file, status: "error", error: "No data in file" };
                }

                // Parse header and first few rows
                const parseCSVLine = (line: string) => {
                    // Simple CSV parsing (doesn't handle all edge cases)
                    const result: string[] = [];
                    let current = '';
                    let inQuotes = false;

                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };

                const headers = parseCSVLine(lines[0]);
                const previewData: Record<string, unknown>[] = [];

                for (let i = 1; i < Math.min(6, lines.length); i++) {
                    const values = parseCSVLine(lines[i]);
                    const row: Record<string, unknown> = {};
                    headers.forEach((header, idx) => {
                        row[header] = values[idx] || '';
                    });
                    previewData.push(row);
                }

                return {
                    file,
                    status: "valid",
                    preview: previewData,
                    columns: headers,
                    rowCount: lines.length - 1
                };
            } catch (e) {
                return { file, status: "error", error: "Failed to parse CSV file" };
            }
        }

        // For Excel files, we can't parse client-side easily, but we can validate
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            return {
                file,
                status: "valid",
                rowCount: undefined, // Will be determined after upload
                columns: undefined
            };
        }

        return { file, status: "error", error: "Unsupported file type" };
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            file => file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
        );

        // Validate each file
        const validations = await Promise.all(droppedFiles.map(validateFile));
        setFileValidations(prev => [...prev, ...validations]);
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files).filter(
                file => file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
            );

            // Validate each file
            const validations = await Promise.all(selectedFiles.map(validateFile));
            setFileValidations(prev => [...prev, ...validations]);
        }
    }, []);

    const removeFile = useCallback((index: number) => {
        setFileValidations(prev => prev.filter((_, i) => i !== index));
    }, []);

    const validFiles = fileValidations.filter(v => v.status === "valid");
    const hasErrors = fileValidations.some(v => v.status === "error");

    const handleUpload = async () => {
        if (validFiles.length === 0) return;

        setIsUploading(true);

        try {
            // 1. Create a session
            const sessionRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/session/create`, {
                method: 'POST',
            });

            if (!sessionRes.ok) throw new Error("Failed to create session");
            const { session_id } = await sessionRes.json();

            // 2. Upload files
            const formData = new FormData();
            formData.append("session_id", session_id);
            validFiles.forEach((v) => formData.append("files", v.file));

            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/upload`, {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) throw new Error("Upload failed");

            const uploadData = await uploadRes.json();

            // Store session info
            localStorage.setItem('adminless_session', JSON.stringify({
                id: session_id,
                files: validFiles.map(v => v.file.name),
                total_rows: uploadData.total_rows
            }));

            router.push('/manage');

        } catch (error) {
            console.error("Upload error:", error);
            alert("Failed to upload files. Please check the backend connection.");
        } finally {
            setIsUploading(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold">Upload Your Data</h1>
                    <p className="text-muted-foreground">
                        Drop your Excel or CSV files to get started
                    </p>
                </div>

                {/* Drop Zone */}
                <Card
                    className={`border-2 border-dashed transition-colors ${isDragging
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                        }`}
                >
                    <CardContent className="p-12">
                        <div
                            className="flex flex-col items-center justify-center text-center cursor-pointer"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-input')?.click()}
                        >
                            <div className="p-4 rounded-full bg-primary/20 mb-4">
                                <Upload className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">
                                Drag & drop files here
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Supports: .csv, .xlsx, .xls (max 10MB)
                            </p>
                            <input
                                id="file-input"
                                type="file"
                                multiple
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* File List */}
                {fileValidations.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Selected Files</CardTitle>
                            <CardDescription>
                                {validFiles.length} of {fileValidations.length} file(s) ready to upload
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {fileValidations.map((validation, index) => (
                                <div key={index} className="space-y-2">
                                    <div
                                        className={`flex items-center justify-between p-3 rounded-lg ${validation.status === "error"
                                                ? "bg-destructive/10 border border-destructive/20"
                                                : "bg-muted/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {validation.status === "valid" ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : validation.status === "error" ? (
                                                <AlertCircle className="w-5 h-5 text-destructive" />
                                            ) : (
                                                <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                                            )}
                                            <div>
                                                <p className="text-sm font-medium">{validation.file.name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{formatFileSize(validation.file.size)}</span>
                                                    {validation.rowCount !== undefined && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{validation.rowCount} rows</span>
                                                        </>
                                                    )}
                                                    {validation.columns && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{validation.columns.length} columns</span>
                                                        </>
                                                    )}
                                                    {validation.error && (
                                                        <span className="text-destructive">{validation.error}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {validation.preview && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedPreview(
                                                            expandedPreview === validation.file.name
                                                                ? null
                                                                : validation.file.name
                                                        );
                                                    }}
                                                    title="Preview data"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeFile(index)}
                                                disabled={isUploading}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Preview Panel */}
                                    {expandedPreview === validation.file.name && validation.preview && (
                                        <div className="ml-8 p-3 bg-muted/30 rounded-lg border border-border overflow-x-auto">
                                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                                Preview (first 5 rows)
                                            </p>
                                            <table className="min-w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        {validation.columns?.map((col, i) => (
                                                            <th key={i} className="px-2 py-1 text-left font-medium">
                                                                {col}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {validation.preview.map((row, rowIdx) => (
                                                        <tr key={rowIdx} className="border-b border-border/50">
                                                            {validation.columns?.map((col, colIdx) => (
                                                                <td key={colIdx} className="px-2 py-1 truncate max-w-[150px]">
                                                                    {String(row[col] ?? '')}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => router.push('/')}
                        disabled={isUploading}
                    >
                        Back
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={validFiles.length === 0 || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>

                {/* Error Hint */}
                {hasErrors && (
                    <p className="text-xs text-center text-muted-foreground">
                        Files with errors will be skipped during upload.
                    </p>
                )}
            </div>
        </div>
    );
}

