"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CatalogPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  /** Infinite-style load more instead of page buttons */
  mode?: "pages" | "load-more";
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function CatalogPagination({
  page,
  pageSize,
  total,
  loading = false,
  onPageChange,
  mode = "pages",
  onLoadMore,
  hasMore = false,
}: CatalogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (total === 0) return null;

  if (mode === "load-more") {
    const loaded = Math.min(page * pageSize, total);
    return (
      <div className="flex flex-col items-center gap-2 pt-3">
        <p className="text-xs text-muted-foreground">
          Učitano {loaded} / {total} proizvoda
        </p>
        {hasMore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onLoadMore}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Učitaj još
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {from}–{to} od {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Prethodna
        </Button>
        <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Sledeća
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
