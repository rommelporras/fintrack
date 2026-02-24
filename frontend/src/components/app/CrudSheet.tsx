"use client";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "motion/react";

interface CrudSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  /** Override the default Cancel/Save footer buttons entirely */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CrudSheet({
  open,
  onOpenChange,
  title,
  description,
  onSave,
  onCancel,
  saveLabel = "Save",
  saveDisabled = false,
  footer,
  children,
  className,
}: CrudSheetProps) {
  const x = useMotionValue(0);

  function handleCancel() {
    if (onCancel) onCancel();
    else onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "p-0 flex flex-col w-full sm:max-w-full md:max-w-[440px]",
          className,
        )}
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 440 }}
          dragElastic={0.05}
          style={{ x }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100 || info.velocity.x > 200) onOpenChange(false);
          }}
          className="flex flex-col h-full"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
            <div>
              <SheetTitle className="text-lg font-bold tracking-tight">
                {title}
              </SheetTitle>
              <SheetDescription
                className={cn(
                  "text-sm mt-0.5",
                  description ? "text-muted-foreground" : "sr-only",
                )}
              >
                {description ?? `${title} form`}
              </SheetDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground transition-colors ml-4 shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {children}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end gap-3 shrink-0">
            {footer ?? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={onSave} disabled={saveDisabled}>
                  {saveLabel}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
