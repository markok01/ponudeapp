"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Quote } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { getQuoteLabel } from "@/utils/format-quote-number";

interface QuotesListProps {
  quotes: Quote[];
  deletingId: number | null;
  onDelete: (quote: Quote) => void;
}

export function QuotesList({ quotes, deletingId, onDelete }: QuotesListProps) {
  return (
    <>
      <ul className="divide-y divide-border md:hidden">
        {quotes.map((quote) => (
          <li key={quote.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium text-muted-foreground">
                  {getQuoteLabel(quote)}
                </p>
                <p className="mt-1 truncate text-base font-semibold">
                  {quote.customer_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(quote.created_at)}
                </p>
              </div>
              <p className="shrink-0 text-right text-price-total text-lg tabular-nums">
                {formatCurrency(quote.total)}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={`/quotes/${quote.id}`}>Detalji</Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:bg-destructive/10"
                disabled={deletingId === quote.id}
                onClick={() => onDelete(quote)}
                aria-label="Obriši ponudu"
              >
                {deletingId === quote.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Kupac</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Ukupno</TableHead>
              <TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {getQuoteLabel(quote)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate font-medium lg:max-w-none">
                  {quote.customer_name}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(quote.created_at)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-price-total">
                  {formatCurrency(quote.total)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/quotes/${quote.id}`}>Detalji</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={deletingId === quote.id}
                      onClick={() => onDelete(quote)}
                    >
                      {deletingId === quote.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
