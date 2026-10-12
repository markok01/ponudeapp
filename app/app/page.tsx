"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, FileSpreadsheet, Package, Upload, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useIsAdmin } from "@/hooks/use-is-admin";

export default function AppHomePage() {
  const t = useTranslations();
  const staffAccess = useIsAdmin();

  const cards = [
    {
      title: t("home.productsTitle"),
      description: t("home.productsDesc"),
      href: "/products",
      icon: Package,
    },
    ...(staffAccess === "admin"
      ? [
          {
            title: t("home.uploadTitle"),
            description: t("home.uploadDesc"),
            href: "/upload",
            icon: Upload,
          },
        ]
      : []),
    {
      title: t("home.newQuoteTitle"),
      description: t("home.newQuoteDesc"),
      href: "/quotes/new",
      icon: FileSpreadsheet,
    },
    {
      title: t("customers.title"),
      description: t("customers.description"),
      href: "/customers",
      icon: Users,
    },
  ];

  return (
    <DashboardShell title={t("home.title")} description={t("home.description")}>
      <motion.div
        className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {cards.map(({ title, description, href, icon: Icon }) => (
          <motion.div key={href} variants={staggerItem}>
            <Link href={href} className="group block h-full focus-visible:outline-none">
              <Card className="h-full transition-colors duration-150 group-hover:border-foreground/15 group-focus-visible:ring-2 group-focus-visible:ring-ring/30">
                <CardHeader className="pb-2">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="inline-flex rounded-md border border-border bg-muted/40 p-2 text-foreground">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    {t("common.open")} →
                  </span>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </DashboardShell>
  );
}
