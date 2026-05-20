"use client";

import { useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { ConversionPreview } from "@/types/pdf-converter";

interface DataPreviewProps {
  preview: ConversionPreview;
}

export function DataPreview({ preview }: DataPreviewProps) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState<number>(0);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-muted px-3 py-1.5">
          {t("pdfToExcel.type")}: <strong className="capitalize">{preview.pdfType}</strong>
        </span>
        <span className="rounded-lg bg-muted px-3 py-1.5">
          {t("pdfToExcel.pages")}: <strong>{preview.pageCount}</strong>
        </span>
        <span className="rounded-lg bg-muted px-3 py-1.5">
          {t("pdfToExcel.tables")}: <strong>{preview.tableCount}</strong>
        </span>
        {preview.strategiesUsed.length > 0 && (
          <span className="rounded-lg bg-muted px-3 py-1.5">
            {t("pdfToExcel.strategies")}: <strong>{preview.strategiesUsed.join(", ")}</strong>
          </span>
        )}
      </div>

      <div className="space-y-2">
        {preview.tables.map((table, index) => {
          const open = expanded === index;
          return (
            <div
              key={`${table.name}-${index}`}
              className="overflow-hidden rounded-xl border border-border/60 bg-white/50"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? -1 : index)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Table2 className="h-4 w-4 text-primary" />
                  {table.name}
                  <span className="text-muted-foreground font-normal">
                    {t("pdfToExcel.pageRows", {
                      page: table.page,
                      rows: table.rowCount,
                    })}
                  </span>
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
                />
              </button>

              {open && table.columns.length > 0 && (
                <div className="max-h-72 overflow-auto border-t border-border/40 p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {table.columns.map((col) => (
                          <TableHead key={col} className="whitespace-nowrap text-xs">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {table.rows.slice(0, 15).map((row, ri) => (
                        <TableRow key={ri}>
                          {table.columns.map((_, ci) => (
                            <TableCell key={ci} className="max-w-[200px] truncate text-xs">
                              {row[ci] ?? ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {table.rowCount > 15 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      {t("pdfToExcel.previewLimit", { total: table.rowCount })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
