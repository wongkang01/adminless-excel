"use client";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Check, X } from "lucide-react";

interface EditableDataTableProps<TData extends Record<string, unknown>> {
    columns: string[];
    data: TData[];
    onDataChange?: (data: TData[]) => void;
}

interface EditState {
    rowIndex: number;
    columnId: string;
    value: string;
}

export function EditableDataTable<TData extends Record<string, unknown>>({
    columns: columnNames,
    data: initialData,
    onDataChange,
}: EditableDataTableProps<TData>) {
    const [data, setData] = useState<TData[]>(initialData);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [editState, setEditState] = useState<EditState | null>(null);

    // Sync with initial data when it changes
    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const handleCellDoubleClick = useCallback((rowIndex: number, columnId: string, currentValue: unknown) => {
        setEditState({
            rowIndex,
            columnId,
            value: String(currentValue ?? ""),
        });
    }, []);

    const handleEditChange = useCallback((value: string) => {
        setEditState(prev => prev ? { ...prev, value } : null);
    }, []);

    const handleEditSave = useCallback(() => {
        if (!editState) return;

        const newData = [...data];
        const row = { ...newData[editState.rowIndex] } as Record<string, unknown>;
        row[editState.columnId] = editState.value;
        newData[editState.rowIndex] = row as TData;

        setData(newData);
        onDataChange?.(newData);
        setEditState(null);
    }, [editState, data, onDataChange]);

    const handleEditCancel = useCallback(() => {
        setEditState(null);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleEditSave();
        } else if (e.key === "Escape") {
            handleEditCancel();
        }
    }, [handleEditSave, handleEditCancel]);

    const columns: ColumnDef<TData>[] = columnNames.map(col => ({
        accessorKey: col,
        header: col,
        cell: ({ row, getValue }) => {
            const rowIndex = row.index;
            const value = getValue();
            const isEditing = editState?.rowIndex === rowIndex && editState?.columnId === col;

            if (isEditing) {
                return (
                    <div className="flex items-center gap-1">
                        <Input
                            value={editState.value}
                            onChange={(e) => handleEditChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-7 py-0 px-1 text-sm min-w-[100px]"
                            autoFocus
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={handleEditSave}
                        >
                            <Check className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={handleEditCancel}
                        >
                            <X className="h-3 w-3 text-red-500" />
                        </Button>
                    </div>
                );
            }

            return (
                <span
                    title={String(value)}
                    className="truncate block max-w-[200px] cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded"
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, col, value)}
                >
                    {String(value ?? "")}
                </span>
            );
        },
    }));

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            columnFilters,
            globalFilter,
        },
    });

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center py-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search all columns..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="pl-8"
                    />
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                    Double-click a cell to edit
                </span>
            </div>

            {/* Table */}
            <div className="rounded-md border overflow-auto max-h-[500px]">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="whitespace-nowrap">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-2">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount()}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Go to first page</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">Go to last page</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
