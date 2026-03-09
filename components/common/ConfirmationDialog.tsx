"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  onConfirm: () => void;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  isLoading = false,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loadingText,
  variant = "default",
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isLoading && onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl rounded border bg-background p-6 shadow-lg flex flex-col items-center justify-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {children && <div className="my-4">{children}</div>}

        <div className="mt-6 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (loadingText ?? `${confirmText}ing...`) : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
