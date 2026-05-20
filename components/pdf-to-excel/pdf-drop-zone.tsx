"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfDropZoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function PdfDropZone({ file, onFileSelect, disabled }: PdfDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped?.type === "application/pdf" || dropped?.name.endsWith(".pdf")) {
        onFileSelect(dropped);
      }
    },
    [disabled, onFileSelect],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-300",
        dragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/80 bg-white/40 hover:border-primary/50 hover:bg-white/60",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      />

      <div
        className={cn(
          "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
          dragging ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
        )}
      >
        {file ? <FileText className="h-8 w-8" /> : <Upload className="h-8 w-8" />}
      </div>

      {file ? (
        <>
          <p className="text-sm font-semibold text-foreground">{file.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB · Kliknite za promenu
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground">
            Prevucite PDF ovde ili kliknite za upload
          </p>
          <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
            Fakture, ponude, cenovnici, bankovni izvodi — više stranica i tabela
          </p>
        </>
      )}
    </div>
  );
}
