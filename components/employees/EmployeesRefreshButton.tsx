"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmployeesRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      className="gap-1.5"
    >
      <RotateCw
        className={`h-4 w-4 ${pending ? "animate-spin text-muted-foreground" : ""}`}
      />
      <span className="text-xs font-medium">
        {pending ? "Refreshing" : "Refresh"}
      </span>
    </Button>
  );
}
