"use client";

import type { QuoteItemWithProduct } from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  quoteLineGrossAfterDiscount,
  quoteLineNetAfterDiscount,
  unitPriceWithPdv,
} from "@/utils/prices";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { TruncatedProductName } from "@/components/ui/product-name-tooltip";

interface QuoteDetailItemsProps {
  items: QuoteItemWithProduct[];
}

export function QuoteDetailItems({ items }: QuoteDetailItemsProps) {
  return (
    <>
      <ul className="space-y-3 p-4 md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-4"
          >
            <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
            <TruncatedProductName
              name={item.name}
              lines={2}
              className="mt-1 font-medium leading-snug"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">Količina: {item.qty}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">Bez PDV</dt>
                <dd className="tabular-nums text-price">
                  {formatCurrency(item.unit_price)}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-[10px] uppercase text-muted-foreground">Sa PDV</dt>
                <dd className="tabular-nums text-price">
                  {formatCurrency(
                    unitPriceWithPdv(item.unit_price, item.pdv_percent),
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">Rabat</dt>
                <dd>{item.discount_percent}%</dd>
              </div>
              <div className="text-right">
                <dt className="text-[10px] uppercase text-muted-foreground">Sa PDV uk.</dt>
                <dd className="text-price-total tabular-nums">
                  {formatCurrency(
                    quoteLineGrossAfterDiscount(
                      item.unit_price,
                      item.discount_percent,
                      item.pdv_percent,
                      item.qty,
                    ),
                  )}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <HorizontalScroll className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Šifra</TableHead>
              <TableHead>Proizvod</TableHead>
              <TableHead className="text-center">Kol.</TableHead>
              <TableHead className="text-right">Bez PDV / kom</TableHead>
              <TableHead className="text-right">Sa PDV / kom</TableHead>
              <TableHead>Rabat</TableHead>
              <TableHead className="text-right">Ukupno bez PDV</TableHead>
              <TableHead className="text-right">Ukupno sa PDV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="min-w-0 max-w-[240px] font-medium">
                  <TruncatedProductName name={item.name} />
                </TableCell>
                <TableCell className="text-center tabular-nums">{item.qty}</TableCell>
                <TableCell className="text-right tabular-nums text-price">
                  {formatCurrency(item.unit_price)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-price">
                  {formatCurrency(
                    unitPriceWithPdv(item.unit_price, item.pdv_percent),
                  )}
                </TableCell>
                <TableCell>{item.discount_percent}%</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(
                    quoteLineNetAfterDiscount(
                      item.unit_price,
                      item.discount_percent,
                      item.qty,
                    ),
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-price-total">
                  {formatCurrency(
                    quoteLineGrossAfterDiscount(
                      item.unit_price,
                      item.discount_percent,
                      item.pdv_percent,
                      item.qty,
                    ),
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </HorizontalScroll>
    </>
  );
}