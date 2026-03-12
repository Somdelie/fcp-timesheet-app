"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  actionAdminListForemen,
  actionAdminCreateForeman,
  actionAdminListEmployees,
  actionAdminCreateAssistant,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminForeman, AdminEmployee } from "@/lib/apiClient";

export default function AdminForemenPage() {
  const [foremen, setForemen] = useState<AdminForeman[]>([]);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [createForemanOpen, setCreateForemanOpen] = useState(false);
  const [createForemanLoading, setCreateForemanLoading] = useState(false);
  const [createForemanData, setCreateForemanData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [selectedForemanId, setSelectedForemanId] = useState<string | null>(
    null,
  );
  const [selectedEmployee, setSelectedEmployee] =
    useState<AdminEmployee | null>(null);
  const [isNewUserAssistant, setIsNewUserAssistant] = useState(true);
  const [createAssistantOpen, setCreateAssistantOpen] = useState(false);
  const [createAssistantLoading, setCreateAssistantLoading] = useState(false);
  const [createAssistantData, setCreateAssistantData] = useState({
    employeeId: "",
    assistantName: "",
    assistantEmail: "",
    assistantPassword: "",
  });

  const [showCredentials, setShowCredentials] = useState<{
    assistantName: string;
    assistantEmail: string;
    assistantPassword: string;
  } | null>(null);

  // Load foremen on mount
  useEffect(() => {
    loadForemen();
  }, []);

  const loadForemen = async () => {
    setLoading(true);
    try {
      const result = await actionAdminListForemen({ q: searchQuery });
      if (result.ok) {
        setForemen(result.foremen);
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load foremen");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeesForAssistant = async () => {
    try {
      // Load all employees (including those already linked)
      const result = await actionAdminListEmployees({});
      if (result.ok) {
        setEmployees(result.employees);
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load employees");
    }
  };

  const handleCreateForeman = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateForemanLoading(true);

    try {
      const result = await actionAdminCreateForeman({
        name: createForemanData.name,
        email: createForemanData.email,
        password: createForemanData.password,
      });

      if (result.ok) {
        toast.success(`Foreman ${result.foreman.name} created`);
        setCreateForemanOpen(false);
        setCreateForemanData({ name: "", email: "", password: "" });
        await loadForemen();
      } else {
        toast.error(result.error || `HTTP ${result.status || "error"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create foreman");
    } finally {
      setCreateForemanLoading(false);
    }
  };

  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForemanId) {
      toast.error("No foreman selected");
      return;
    }
    if (!createAssistantData.employeeId) {
      toast.error("Please select an employee");
      return;
    }
    if (!createAssistantData.assistantPassword) {
      toast.error("Password is required");
      return;
    }
    if (createAssistantData.assistantPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setCreateAssistantLoading(true);

    try {
      const result = await actionAdminCreateAssistant({
        foremanId: selectedForemanId,
        employeeId: createAssistantData.employeeId,
        assistantName: createAssistantData.assistantName,
        assistantEmail: createAssistantData.assistantEmail,
        assistantPassword: createAssistantData.assistantPassword,
      });

      if (result.ok) {
        setShowCredentials({
          assistantName: result.assistant.assistantName || "",
          assistantEmail: result.assistant.assistantEmail,
          assistantPassword: createAssistantData.assistantPassword,
        });
        setCreateAssistantOpen(false);
        setCreateAssistantData({
          employeeId: "",
          assistantName: "",
          assistantEmail: "",
          assistantPassword: "",
        });
        await loadForemen();
      } else {
        toast.error(result.error || `HTTP ${result.status || "error"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create assistant");
    } finally {
      setCreateAssistantLoading(false);
    }
  };

  const handleOpenAssistantDialog = async (foremanId: string) => {
    setSelectedForemanId(foremanId);
    setSelectedEmployee(null);
    setIsNewUserAssistant(true);
    setCreateAssistantData({
      employeeId: "",
      assistantName: "",
      assistantEmail: "",
      assistantPassword: "",
    });
    await loadEmployeesForAssistant();
    setCreateAssistantOpen(true);
  };

  const handleSelectEmployeeForAssistant = (emp: AdminEmployee) => {
    setSelectedEmployee(emp);
    setCreateAssistantData({
      employeeId: emp.id,
      assistantName: emp.userId ? emp.userName || "" : "",
      assistantEmail: emp.userId ? emp.userEmail || "" : "",
      assistantPassword: "",
    });
    setIsNewUserAssistant(!emp.userId);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Foremen Management</h1>
        <Dialog open={createForemanOpen} onOpenChange={setCreateForemanOpen}>
          <DialogTrigger asChild>
            <Button>Create Foreman</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Foreman</DialogTitle>
              <DialogDescription>
                Enter the details for the new foreman account
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateForeman} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  type="text"
                  placeholder="Foreman name"
                  value={createForemanData.name}
                  onChange={(e) =>
                    setCreateForemanData({
                      ...createForemanData,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="foreman@example.com"
                  value={createForemanData.email}
                  onChange={(e) =>
                    setCreateForemanData({
                      ...createForemanData,
                      email: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  value={createForemanData.password}
                  onChange={(e) =>
                    setCreateForemanData({
                      ...createForemanData,
                      password: e.target.value,
                    })
                  }
                  required
                  minLength={8}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateForemanOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createForemanLoading}>
                  {createForemanLoading ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search foremen by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button
          variant="outline"
          onClick={() => loadForemen()}
          disabled={loading}
        >
          Search
        </Button>
      </div>

      <div className="border rounded overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {foremen.map((foreman) => (
              <TableRow key={foreman.foremanId}>
                <TableCell>{foreman.name || "-"}</TableCell>
                <TableCell>{foreman.email}</TableCell>
                <TableCell>
                  {new Date(foreman.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Dialog
                    open={
                      createAssistantOpen &&
                      selectedForemanId === foreman.foremanId
                    }
                    onOpenChange={(open) => {
                      if (!open) {
                        setCreateAssistantOpen(false);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleOpenAssistantDialog(foreman.foremanId)
                        }
                      >
                        Add Assistant
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Assistant</DialogTitle>
                        <DialogDescription>
                          Create an assistant account for{" "}
                          {foreman.name || foreman.email}
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={handleCreateAssistant}
                        className="space-y-4"
                      >
                        <div>
                          <label className="text-sm font-medium">
                            Select Employee
                          </label>
                          <Select
                            value={createAssistantData.employeeId}
                            onValueChange={(value) => {
                              const emp = employees.find((e) => e.id === value);
                              if (emp) {
                                handleSelectEmployeeForAssistant(emp);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose an employee..." />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">
                                  No unlinked employees available
                                </div>
                              ) : (
                                employees.map((emp) => (
                                  <SelectItem
                                    key={emp.id}
                                    value={emp.id}
                                    className="border-b"
                                  >
                                    <span>
                                      {emp.firstName} {emp.lastName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({emp.qrCodeValue})
                                    </span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedEmployee && (
                          <div className="rounded bg-blue-50 dark:bg-blue-950 p-3 text-sm">
                            {isNewUserAssistant ? (
                              <p className="text-muted-foreground">
                                Creating new user account for this employee
                              </p>
                            ) : (
                              <p className="text-muted-foreground">
                                Linking existing user account
                              </p>
                            )}
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium">
                            Assistant Name{" "}
                            {!isNewUserAssistant && "(Auto-filled)"}
                          </label>
                          <Input
                            type="text"
                            placeholder="Assistant name"
                            value={createAssistantData.assistantName}
                            onChange={(e) =>
                              setCreateAssistantData({
                                ...createAssistantData,
                                assistantName: e.target.value,
                              })
                            }
                            disabled={!isNewUserAssistant}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Assistant Email{" "}
                            {!isNewUserAssistant && "(Auto-filled)"}
                          </label>
                          <Input
                            type="email"
                            placeholder="assistant@example.com"
                            value={createAssistantData.assistantEmail}
                            onChange={(e) =>
                              setCreateAssistantData({
                                ...createAssistantData,
                                assistantEmail: e.target.value,
                              })
                            }
                            disabled={!isNewUserAssistant}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Assistant Password
                          </label>
                          <Input
                            type="password"
                            placeholder="Min 8 characters"
                            value={createAssistantData.assistantPassword}
                            onChange={(e) =>
                              setCreateAssistantData({
                                ...createAssistantData,
                                assistantPassword: e.target.value,
                              })
                            }
                            required
                            minLength={8}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCreateAssistantOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createAssistantLoading}
                          >
                            {createAssistantLoading
                              ? "Creating..."
                              : "Create Assistant"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {showCredentials && (
        <Dialog
          open={!!showCredentials}
          onOpenChange={() => setShowCredentials(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assistant Created Successfully</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please save these credentials securely:
              </p>
              <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded space-y-4 border border-border">
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Name
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background dark:bg-slate-900 p-3 rounded border border-border text-sm font-mono select-all">
                      {showCredentials.assistantName}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          showCredentials.assistantName,
                        );
                        toast.success("Name copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background dark:bg-slate-900 p-3 rounded border border-border text-sm font-mono select-all break-all">
                      {showCredentials.assistantEmail}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          showCredentials.assistantEmail,
                        );
                        toast.success("Email copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Password
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background dark:bg-slate-900 p-3 rounded border border-border text-sm font-mono select-all">
                      {showCredentials.assistantPassword}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          showCredentials.assistantPassword,
                        );
                        toast.success("Password copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  ℹ️ Share these credentials with the assistant securely. They
                  will not be shown again.
                </p>
              </div>
              <Button
                onClick={() => setShowCredentials(null)}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
