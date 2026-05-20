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
import { useTranslations } from "@/lib/i18n/locale-provider";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function HomePage() {
  const t = useTranslations();

  const cards = [
    {
      title: t("home.productsTitle"),
      description: t("home.productsDesc"),
      href: "/products",
      icon: Package,
    },
    {
      title: t("home.uploadTitle"),
      description: t("home.uploadDesc"),
      href: "/upload",
      icon: Upload,
    },
    {
      title: t("home.newQuoteTitle"),
      description: t("home.newQuoteDesc"),
      href: "/quotes/new",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <DashboardShell title={t("home.title")} description={t("home.description")}>
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
                  <Link href={href}>{t("common.open")}</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </DashboardShell>
  );
}
