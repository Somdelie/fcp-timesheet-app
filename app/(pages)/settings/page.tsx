"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Copy, Check } from "lucide-react";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  getCompanySettings,
  updateCompanySettings,
} from "@/actions/company-settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    appName: "Office API",
    appVersion: "2.0.0",
    companyName: "Company Name",
    supportEmail: "support@company.com",
    timezone: "UTC",
    dateFormat: "YYYY-MM-DD",
  });

  const [defaultEmployeeDayRate, setDefaultEmployeeDayRate] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [fortnight, setFortnight] = useState<{
    startISO: string;
    endISO: string;
    id: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load company settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await getCompanySettings();
        if (res.ok) {
          setDefaultEmployeeDayRate(res.settings.defaultEmployeeDayRate);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    setSaveMessage("Settings saved successfully!");
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleSaveDefaultDayRate = async () => {
    if (!defaultEmployeeDayRate) {
      toast.error("Please enter a valid day rate.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateCompanySettings({
        defaultEmployeeDayRate,
      });

      if (res.ok) {
        toast.success("Default employee day rate updated!");
      } else {
        toast.error(res.error || "Failed to save settings.");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const generateFortnight = (date: Date = new Date()) => {
    const day = date.getDay();
    const backToSat = (day + 1) % 7;
    const sat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    sat.setDate(sat.getDate() - backToSat);

    const anchor = new Date("2026-01-31T00:00:00");
    const daysSince = Math.floor(
      (sat.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
    );
    const mod14 = ((daysSince % 14) + 14) % 14;

    const start = new Date(sat);
    start.setDate(start.getDate() - mod14);

    const end = new Date(start);
    end.setDate(end.getDate() + 13);

    const toISODate = (d: Date) => d.toISOString().split("T")[0];

    const result = {
      startISO: toISODate(start),
      endISO: toISODate(end),
      id: `${toISODate(start)}_${toISODate(end)}`,
    };

    setFortnight(result);
  };

  const handleGenerateFortnightToday = () => {
    generateFortnight(new Date());
  };

  const handleGenerateFortnightDate = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.value) {
      const selectedDate = new Date(e.target.value + "T00:00:00Z");
      generateFortnight(selectedDate);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage application and system settings
            </p>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg">
            {saveMessage}
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="fortnight">Fortnight Generator</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Application Name</Label>
                    <Input
                      id="appName"
                      value={settings.appName}
                      onChange={(e) => handleChange("appName", e.target.value)}
                      placeholder="Enter app name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appVersion">Version</Label>
                    <Input
                      id="appVersion"
                      value={settings.appVersion}
                      onChange={(e) =>
                        handleChange("appVersion", e.target.value)
                      }
                      placeholder="Enter version"
                      disabled
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) =>
                      handleChange("companyName", e.target.value)
                    }
                    placeholder="Enter company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) =>
                      handleChange("supportEmail", e.target.value)
                    }
                    placeholder="Enter support email"
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Settings */}
          <TabsContent value="payroll" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payroll Settings</CardTitle>
                <CardDescription>
                  Configure default rates for employees
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultDayRate">
                      Default Employee Day Rate (R)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      This rate will be used for all employees unless they have
                      an individual override. Foremen can have custom rates.
                    </p>
                    <Input
                      id="defaultDayRate"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 300.00"
                      value={defaultEmployeeDayRate}
                      onChange={(e) =>
                        setDefaultEmployeeDayRate(e.target.value)
                      }
                      disabled={isLoading}
                    />
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveDefaultDayRate}
                      disabled={isSaving || isLoading}
                    >
                      {isSaving ? "Saving..." : "Save Day Rate"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure system-wide preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={settings.timezone}
                      onChange={(e) => handleChange("timezone", e.target.value)}
                      placeholder="Enter timezone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Input
                      id="dateFormat"
                      value={settings.dateFormat}
                      onChange={(e) =>
                        handleChange("dateFormat", e.target.value)
                      }
                      placeholder="Enter date format"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fortnight Generator */}
          <TabsContent value="fortnight" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fortnight Generator</CardTitle>
                <CardDescription>
                  Generate fortnight periods for timesheet management
                  (Saturday-Friday cycles)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fortnightDate">Select Date</Label>
                    <Input
                      id="fortnightDate"
                      type="date"
                      onChange={handleGenerateFortnightDate}
                    />
                  </div>

                  <Button
                    onClick={handleGenerateFortnightToday}
                    className="w-full"
                  >
                    Generate for Today
                  </Button>
                </div>

                {fortnight && (
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          Fortnight ID
                        </Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-background border border-slate-300 dark:border-slate-600 rounded text-xs font-mono break-all">
                            {fortnight.id}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(fortnight.id, "id")}
                          >
                            {copiedField === "id" ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            Start Date (Saturday)
                          </Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-background border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">
                              {fortnight.startISO}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(fortnight.startISO, "start")
                              }
                            >
                              {copiedField === "start" ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <Badge variant="outline" className="w-fit">
                            Saturday
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            End Date (Friday)
                          </Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-background border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">
                              {fortnight.endISO}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(fortnight.endISO, "end")
                              }
                            >
                              {copiedField === "end" ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <Badge variant="outline" className="w-fit">
                            Friday
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          <strong>Duration:</strong> 14 days (2 weeks)
                        </p>
                        <p>
                          <strong>Anchor Date:</strong> 2026-01-31 (Saturday)
                        </p>
                        <p>
                          All fortnights run Saturday through Friday for
                          consistent timesheet cycles.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!fortnight && (
                  <div className="bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg text-sm">
                    Select a date or click "Generate for Today" to generate a
                    fortnight period.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Configure advanced application options (use with caution)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-yellow-500/10 border border-yellow-500/25 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg">
                  <p className="text-sm font-medium">
                    These settings should only be modified by experienced
                    administrators
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Configuration</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure API endpoints and keys
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Database Settings</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure database connection and optimization
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Security Settings</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure authentication and security policies
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
