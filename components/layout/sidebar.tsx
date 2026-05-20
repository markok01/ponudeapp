"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  FileType2,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Settings,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Početna", icon: LayoutDashboard },
  { href: "/products", label: "Proizvodi", icon: Package },
  { href: "/upload", label: "Upload cenovnika", icon: Upload },
  { href: "/pdf-to-excel", label: "PDF → Excel", icon: FileType2 },
  { href: "/quotes", label: "Ponude", icon: FileSpreadsheet },
  { href: "/quotes/new", label: "Nova ponuda", icon: PlusCircle },
  { href: "/settings", label: "Podešavanja", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authEnabled, setAuthEnabled] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
      fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setAuthEnabled(Boolean(d.authEnabled));
        if (d.user?.email) setUserEmail(d.user.email);
      })
      .catch(() => setAuthEnabled(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="glass-panel flex h-full w-full shrink-0 flex-col border-r p-4 pb-[env(safe-area-inset-bottom)]">
      <div className="mb-8 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">
          PonudeApp
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Cenovnici
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] font-medium transition-colors duration-200",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {active ? (
                <span className="absolute inset-0 rounded-[var(--radius-md)] bg-primary shadow-[var(--shadow-soft)]" />
              ) : null}
              <Icon className="relative z-10 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>
      {authEnabled ? (
        <div className="mt-4 space-y-2">
          {userEmail ? (
            <p className="truncate px-1 text-[11px] text-muted-foreground">
              {userEmail}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Odjava
          </Button>
        </div>
      ) : null}
      <p className="mt-6 px-1 text-[11px] leading-relaxed text-muted-foreground/80">
        Premium poslovni alat za ponude i cenovnike.
      </p>
    </aside>
  );
}
