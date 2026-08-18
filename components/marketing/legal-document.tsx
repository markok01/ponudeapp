"use client";

import { PublicShell } from "@/components/marketing/public-shell";

export function LegalDocument({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </article>
    </PublicShell>
  );
}
