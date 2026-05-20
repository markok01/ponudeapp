"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileSpreadsheet, Package, Upload } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { staggerContainer, staggerItem } from "@/lib/motion";

const cards = [
  {
    title: "Proizvodi",
    description: "Pregledaj i upravljaj katalogom proizvoda.",
    href: "/products",
    icon: Package,
  },
  {
    title: "Upload cenovnika",
    description: "Uvezi Excel cenovnik i ažuriraj cene po SKU.",
    href: "/upload",
    icon: Upload,
  },
  {
    title: "Nova ponuda",
    description: "Kreiraj ponudu za kupca sa popustima.",
    href: "/quotes/new",
    icon: FileSpreadsheet,
  },
];

export default function HomePage() {
  return (
    <DashboardShell
      title="Početna"
      description="Premium radni prostor za cenovnike i ponude"
    >
      <motion.div
        className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {cards.map(({ title, description, href, icon: Icon }) => (
          <motion.div key={href} variants={staggerItem}>
            <Card className="group h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(91,141,239,0.12)]">
              <CardHeader>
                <div className="mb-3 inline-flex rounded-2xl bg-accent/80 p-3 text-primary transition-transform duration-300 group-hover:scale-105">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={href}>Otvori</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </DashboardShell>
  );
}
