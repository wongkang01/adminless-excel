"use client";

import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading: boolean;
    disabled?: boolean;
}

// Memoized chat input component to prevent parent re-renders from affecting this
function ChatInputComponent({ onSend, isLoading, disabled }: ChatInputProps) {
    const [input, setInput] = useState("");

    const handleSend = useCallback(() => {
        if (!input.trim() || isLoading) return;
        onSend(input.trim());
        setInput("");
    }, [input, isLoading, onSend]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <div className="border-t border-border p-4 bg-card/50 shrink-0">
            <div className="max-w-3xl mx-auto flex gap-3">
                <Input
                    placeholder="Ask a question about your data..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading || disabled}
                    className="flex-1"
                />
                <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || disabled}
                >
                    <Send className="w-4 h-4" />
                </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
                Try: &quot;What is the average age?&quot; or &quot;Show children by cluster&quot;
            </p>
        </div>
    );
}

// Export as memoized component - only re-renders when props change
export const ChatInput = memo(ChatInputComponent);
