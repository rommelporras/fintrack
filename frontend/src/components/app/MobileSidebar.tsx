"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { motion, useMotionValue } from "motion/react";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const x = useMotionValue(0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <SheetContent side="left" className="p-0 w-64 bg-background">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <motion.div
          drag="x"
          dragConstraints={{ left: -264, right: 0 }}
          dragElastic={0.05}
          style={{ x }}
          onDragEnd={(_, info) => {
            if (info.velocity.x < -200 || info.offset.x < -80) setOpen(false);
          }}
          className="h-full"
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
