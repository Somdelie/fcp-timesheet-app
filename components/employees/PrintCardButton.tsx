"use client";

import { Button } from "@/components/ui/button";

export default function PrintCardButton({
  employeeId,
}: {
  employeeId: string;
}) {
  return (
    <Button asChild variant="outline">
      <a
        href={`/api/employees/${employeeId}/card.pdf`}
        target="_blank"
        rel="noreferrer"
      >
        PDF Card
      </a>
    </Button>
  );
}
