import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductsTable } from "@/components/products/products-table";

export default function ProductsPage() {
  return (
    <DashboardShell
      title="Proizvodi"
      description="Cenovnik kao u ponudi — izmenite šifru, artikal, brend, cenu i PDV u tabeli"
    >
      <ProductsTable />
    </DashboardShell>
  );
}
