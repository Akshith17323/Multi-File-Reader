"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface TextRendererProps {
    url: string;
    fontSize: number;
    viewMode: "single" | "continuous" | "two-page";
}

export default function TextRenderer({ url, fontSize, viewMode }: TextRendererProps) {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("Failed to load text file");
                return res.text();
            })
            .then(text => {
                if (isMounted) {
                    setContent(text);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError(err.message);
                    setLoading(false);
                }
            });
            
        return () => { isMounted = false; }
    }, [url]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-destructive">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>Error loading document: {error}</p>
            </div>
        );
    }

    // Applying column count based on viewMode (two-page)
    const isTwoPage = viewMode === "two-page";

    return (
        <div 
            className="w-full h-full overflow-auto p-8 bg-background text-foreground"
            style={{ fontSize: `${fontSize}%` }}
        >
            <div 
                className={`max-w-4xl mx-auto leading-relaxed ${isTwoPage ? 'columns-2 gap-8' : ''}`}
                style={{
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {content}
            </div>
        </div>
    );
}
