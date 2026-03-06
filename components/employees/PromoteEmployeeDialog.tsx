"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { promoteEmployeeToForeman } from "@/actions/employees";

interface PromoteEmployeeDialogProps {
  employeeId: string;
  employeeName: string;
  employeePhoto?: string | null;
  isAlreadyForeman: boolean;
}

interface PromotionResult {
  email: string;
  temporaryPassword: string;
}

export default function PromoteEmployeeDialog({
  employeeId,
  employeeName,
  employeePhoto,
  isAlreadyForeman,
}: PromoteEmployeeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [promotionResult, setPromotionResult] =
    React.useState<PromotionResult | null>(null);

  async function handlePromote() {
    setIsProcessing(true);
    try {
      const res = await promoteEmployeeToForeman({
        employeeId,
      });

      if (res.ok && res.data) {
        setPromotionResult({
          email: res.data.email,
          temporaryPassword: res.data.temporaryPassword,
        });
        toast.success(res.message);
      } else {
        toast.error(res.error || "Failed to promote employee");
      }
    } catch (error) {
      console.error("Error promoting employee:", error);
      toast.error("Failed to promote employee");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setPromotionResult(null);
    router.refresh();
  }

  function copyCredentials() {
    if (promotionResult) {
      const text = `Email: ${promotionResult.email}\nPassword: ${promotionResult.temporaryPassword}`;
      navigator.clipboard.writeText(text);
      toast.success("Credentials copied to clipboard");
    }
  }

  if (isAlreadyForeman) {
    return null; // Don't show button if already a foreman
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Promote to Foreman</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {promotionResult
              ? "Promotion Successful"
              : "Promote Employee to Foreman"}
          </DialogTitle>
          <DialogDescription>
            {promotionResult
              ? "Share these temporary credentials with the new foreman"
              : `This will create a foreman account for ${employeeName} and give them access to manage other employees and sites.`}
          </DialogDescription>
        </DialogHeader>

        {promotionResult ? (
          <div className="space-y-4 py-4">
            <div className="rounded border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <p className="mb-3 text-sm font-semibold text-green-900 dark:text-green-100">
                New Foreman Account Created
              </p>
              <div className="space-y-2">
                <div className="rounded bg-white/50 p-2 dark:bg-black/20">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Email
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {promotionResult.email}
                  </p>
                </div>
                <div className="rounded bg-white/50 p-2 dark:bg-black/20">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Temporary Password
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {promotionResult.temporaryPassword}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                Important
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                Share the credentials above with the foreman. They must change
                their password after first login.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Employee Profile Preview */}
            <div className="flex items-center gap-4 rounded border bg-muted/30 p-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border bg-muted">
                {employeePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={employeePhoto}
                    alt={employeeName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-orange-700 text-xl font-medium uppercase text-white">
                    {employeeName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold">{employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  Will be promoted to Foreman
                </p>
              </div>
            </div>

            <div className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                A new foreman account will be created with:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                <li>• Foreman role and privileges</li>
                <li>• Access to manage employees and teams</li>
                <li>• Ability to submit timesheets and reports</li>
                <li>• A temporary password for login</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {promotionResult ? (
            <>
              <Button variant="outline" onClick={copyCredentials}>
                Copy Credentials
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button onClick={handlePromote} disabled={isProcessing}>
                {isProcessing ? "Promoting..." : "Promote"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
