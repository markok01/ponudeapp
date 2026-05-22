import { isBrandRow, isSubBrandRow } from "../utils/price-list-columns.ts";

const cases = [
  [["FINE & DELI"], "FINE & DELI"],
  [["WOERLE", "", "", "", "", "0.2"], "WOERLE"],
  [["GALUS", "GALUS", "GALUS"], "GALUS"],
  [["12345", "Product name", "100"], null],
];

for (const [cells, expected] of cases) {
  const got = isBrandRow(cells);
  const ok = got === expected ? "OK" : `FAIL got=${got}`;
  console.log(ok, cells.filter(Boolean).join(" | ") || "(empty)");
}

const sub = isSubBrandRow("", "", "AIA ZAMRZNUTO", "", "WOERLE");
console.log("subBrand under WOERLE:", sub === "AIA ZAMRZNUTO" ? "OK" : sub);

const subNoParent = isSubBrandRow("", "", "AIA ZAMRZNUTO", "", null);
console.log("subBrand without parent:", subNoParent === null ? "OK" : subNoParent);
