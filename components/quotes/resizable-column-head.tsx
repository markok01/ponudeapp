"use client";

import {
  ResizableColumnHead as CatalogResizableColumnHead,
} from "@/components/catalog/resizable-column-head";
import { useQuoteWorkspaceLayout } from "@/components/quotes/quote-workspace-layout-context";

type QuoteResizableColumnHeadProps = {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  onResize: (deltaPx: number) => void;
  /** Cenovnik u levom panelu; inače tabela stavki ponude. */
  variant?: "catalog" | "quote";
  resizable?: boolean;
};

export function ResizableColumnHead({
  variant = "catalog",
  ...props
}: QuoteResizableColumnHeadProps) {
  const { layout, catalogHeaderFontPx, quoteHeaderFontPx } =
    useQuoteWorkspaceLayout();
  const headerFontPx =
    variant === "catalog" ? catalogHeaderFontPx : quoteHeaderFontPx;

  return (
    <CatalogResizableColumnHead
      rowHeightPx={layout.rowHeightPx}
      headerFontPx={headerFontPx}
      {...props}
    />
  );
}
