"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  label: string;
  num: number;
}

export function GuideToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-10% 0px -80% 0px" },
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  return (
    <aside className="hidden xl:block w-52 shrink-0">
      <div className="sticky top-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          On this page
        </p>
        <nav className="space-y-1">
          {items.map(({ id, label, num }) => (
            <a
              key={id}
              href={`#${id}`}
              className={cn(
                "flex items-center gap-2 text-sm py-1 transition-colors",
                activeId === id
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xs opacity-40 w-4 shrink-0">{num}.</span>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
