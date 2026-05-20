import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PdfConverterPanel } from "@/components/pdf-to-excel/pdf-converter-panel";

export default function PdfToExcelPage() {
  return (
    <DashboardShell
      title="PDF → Excel"
      description="Konvertujte bilo koji PDF u profesionalno formatiran Excel fajl."
    >
      <PdfConverterPanel />
    </DashboardShell>
  );
}
