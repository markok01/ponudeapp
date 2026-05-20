"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n/locale-provider";

interface CatalogFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  resultCount?: number;
  showInactive?: boolean;
  onShowInactiveChange?: (value: boolean) => void;
}

export function CatalogFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  resultCount,
  showInactive,
  onShowInactiveChange,
}: CatalogFiltersProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("catalog.searchPlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 pl-9"
        />
      </div>
      {categories.length > 0 ? (
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-10 w-full sm:w-[180px]">
            <SelectValue placeholder={t("catalog.allBrands")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("catalog.allBrands")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {onShowInactiveChange !== undefined ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive ?? false}
            onChange={(e) => onShowInactiveChange(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t("catalog.showInactive")}
        </label>
      ) : null}
      {resultCount !== undefined ? (
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {t("common.productsCount", { count: resultCount })}
        </span>
      ) : null}
    </div>
  );
}
