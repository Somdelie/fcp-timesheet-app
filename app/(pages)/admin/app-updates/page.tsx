"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Smartphone,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AppRelease {
  id: string;
  platform: string;
  version: string;
  versionCode: number;
  minVersionCode: number;
  githubAssetId: number;
  releaseNotes: string[];
  isActive: boolean;
  createdAt: string;
}

interface GithubReleaseAssetOption {
  id: number;
  name: string;
  sizeBytes: number;
  contentType: string;
}

interface GithubReleaseOption {
  releaseId: number;
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  assets: GithubReleaseAssetOption[];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const emptyForm = {
  version: "",
  versionCode: "",
  minVersionCode: "",
  githubAssetId: "",
  releaseNotes: "",
  isActive: true,
};

export default function AdminAppUpdatesPage() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showManualAssetId, setShowManualAssetId] = useState(false);

  const [githubReleases, setGithubReleases] = useState<GithubReleaseOption[]>(
    [],
  );
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState<string | null>(null);

  const activeRelease = useMemo(
    () => releases.find((r) => r.isActive) ?? null,
    [releases],
  );

  const assetOptions = useMemo(
    () =>
      githubReleases.flatMap((release) =>
        release.assets.map((asset) => ({ release, asset })),
      ),
    [githubReleases],
  );

  // Cross-references an AppRelease's githubAssetId against the live GitHub
  // asset list — the DB only stores the numeric id, so filename/size/parent
  // release come from whatever the picker already loaded. Falls back
  // gracefully if the asset was removed from GitHub or the list hasn't
  // loaded yet.
  const findGithubAsset = useCallback(
    (assetId: number) => assetOptions.find(({ asset }) => asset.id === assetId) ?? null,
    [assetOptions],
  );

  const loadReleases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/app-releases?platform=android");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load releases");
      setReleases(data.releases || []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load releases",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGithubReleases = useCallback(async () => {
    setGithubLoading(true);
    setGithubError(null);
    try {
      const res = await fetch("/api/app/admin/github-releases");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to list GitHub releases");
      setGithubReleases(data.releases || []);
    } catch (err) {
      setGithubError(
        err instanceof Error ? err.message : "Failed to list GitHub releases",
      );
    } finally {
      setGithubLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReleases();
    void loadGithubReleases();
  }, [loadReleases, loadGithubReleases]);

  // Once the GitHub list is in, show the manual fallback automatically
  // only when there's genuinely nothing to pick from.
  useEffect(() => {
    if (!githubLoading && assetOptions.length === 0) {
      setShowManualAssetId(true);
    }
  }, [githubLoading, assetOptions.length]);

  async function publish() {
    const versionCode = Number(form.versionCode);
    const minVersionCode = Number(form.minVersionCode);
    const githubAssetId = Number(form.githubAssetId);

    if (!form.version.trim()) {
      toast.error("Version (e.g. 1.0.2) is required");
      return;
    }
    if (!Number.isInteger(versionCode) || versionCode <= 0) {
      toast.error("Version code must be a positive whole number");
      return;
    }
    if (!Number.isInteger(minVersionCode) || minVersionCode <= 0) {
      toast.error("Minimum version code must be a positive whole number");
      return;
    }
    if (minVersionCode > versionCode) {
      toast.error("Minimum version code can't be higher than this version's own code");
      return;
    }
    if (!Number.isInteger(githubAssetId) || githubAssetId <= 0) {
      toast.error("Pick (or enter) the GitHub release asset for this APK");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/app/admin/app-releases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform: "android",
          version: form.version.trim(),
          versionCode,
          minVersionCode,
          githubAssetId,
          releaseNotes: form.releaseNotes
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          isActive: form.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to publish release");

      toast.success(`Published version ${form.version.trim()}`);
      setForm(emptyForm);
      setShowManualAssetId(false);
      await loadReleases();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to publish release",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function toggleActive(release: AppRelease, nextActive: boolean) {
    setTogglingId(release.id);
    try {
      const res = await fetch(
        `/api/app/admin/app-releases/${encodeURIComponent(release.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: nextActive }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update release");

      toast.success(
        nextActive
          ? `Version ${release.version} is now live`
          : `Version ${release.version} deactivated`,
      );
      await loadReleases();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update release",
      );
    } finally {
      setTogglingId(null);
    }
  }

  const activeAsset = activeRelease ? findGithubAsset(activeRelease.githubAssetId) : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            App Updates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage FirstClass Android releases and control which version
            devices are pointed at. APKs live as GitHub Release assets on our
            private backend repo — not Google Play, not EAS Update.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void loadReleases();
            void loadGithubReleases();
          }}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Current Android Release */}
      {activeRelease ? (
        <Card className="border-blue-500/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">
                  Current Android Release
                </CardTitle>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <CardDescription>
              This is exactly what{" "}
              <code className="text-xs">GET /api/app/updates/check</code>{" "}
              hands to every Android device right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="sm:col-span-2 lg:col-span-4">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/api/app/admin/app-releases/${encodeURIComponent(activeRelease.id)}/download`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download APK
                </a>
              </Button>
            </div>
            <div>
              <span className="text-muted-foreground">Version</span>
              <div className="font-semibold text-base">{activeRelease.version}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Version code</span>
              <div className="font-semibold text-base">{activeRelease.versionCode}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Minimum supported</span>
              <div className="font-semibold text-base">
                {activeRelease.minVersionCode}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Published</span>
              <div className="font-semibold text-base">
                {formatDateTime(activeRelease.createdAt)}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <span className="text-muted-foreground">APK filename</span>
              <div className="font-medium font-mono text-xs mt-1">
                {activeAsset ? activeAsset.asset.name : `GitHub asset #${activeRelease.githubAssetId}`}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <span className="text-muted-foreground">GitHub release</span>
              <div className="font-medium text-xs mt-1">
                {activeAsset
                  ? `${activeAsset.release.name || activeAsset.release.tagName} · ${formatMb(activeAsset.asset.sizeBytes)}`
                  : "Not found in the current GitHub release list (may have been removed or renamed on GitHub)"}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No active Android release yet — devices won&apos;t see an update
            prompt until you publish one below.
          </CardContent>
        </Card>
      ) : null}

      {/* Publish New Version */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Publish New Version</CardTitle>
          </div>
          <CardDescription>
            First create the release and upload the signed APK on GitHub,
            then pick it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="version">Version (versionName)</Label>
              <Input
                id="version"
                placeholder="1.0.2"
                value={form.version}
                onChange={(e) =>
                  setForm((f) => ({ ...f, version: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="versionCode">Version Code</Label>
              <Input
                id="versionCode"
                type="number"
                min={1}
                placeholder="2"
                value={form.versionCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, versionCode: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minVersionCode">Minimum Version Code</Label>
              <Input
                id="minVersionCode"
                type="number"
                min={1}
                placeholder="1"
                value={form.minVersionCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minVersionCode: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Explanation of minVersionCode's 3-tier effect on devices */}
          <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                What Minimum Version Code does to a device, compared against
                this release&apos;s own Version Code
                {form.versionCode ? ` (${form.versionCode})` : ""}:
              </p>
              <ul className="space-y-0.5">
                <li>
                  <span className="font-medium text-red-500">Required update</span>{" "}
                  — device&apos;s versionCode is below Minimum Version Code
                  {form.minVersionCode ? ` (${form.minVersionCode})` : ""}. Blocked
                  until it updates.
                </li>
                <li>
                  <span className="font-medium text-amber-500">Optional update</span>{" "}
                  — device&apos;s versionCode is at or above Minimum Version Code
                  but below this release&apos;s Version Code. Prompted, can dismiss.
                </li>
                <li>
                  <span className="font-medium text-green-600">Up to date</span>{" "}
                  — device&apos;s versionCode is at or above this release&apos;s
                  Version Code. No prompt.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="githubAssetId">GitHub APK asset</Label>
            {githubLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading GitHub
                releases…
              </div>
            ) : assetOptions.length > 0 ? (
              <Select
                value={form.githubAssetId || undefined}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, githubAssetId: value }))
                }
              >
                <SelectTrigger id="githubAssetId">
                  <SelectValue placeholder="Select an uploaded APK asset" />
                </SelectTrigger>
                <SelectContent>
                  {assetOptions.map(({ release, asset }) => (
                    <SelectItem key={asset.id} value={String(asset.id)}>
                      {release.name || release.tagName} — {asset.name} (
                      {formatMb(asset.sizeBytes)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {githubError
                  ? `Couldn't load the GitHub release list (${githubError}).`
                  : "No GitHub releases found yet. Upload the APK to a GitHub Release first."}{" "}
                Enter the asset id manually below.
              </p>
            )}

            {assetOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowManualAssetId((v) => !v)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                {showManualAssetId ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Hide manual entry
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Can&apos;t find it? Enter
                    the asset ID manually
                  </>
                )}
              </button>
            )}

            {(showManualAssetId || assetOptions.length === 0) && (
              <Input
                id="githubAssetIdManual"
                type="number"
                min={1}
                placeholder="Numeric GitHub release asset id"
                value={form.githubAssetId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, githubAssetId: e.target.value }))
                }
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="releaseNotes">Release Notes (one per line)</Label>
            <Textarea
              id="releaseNotes"
              rows={4}
              placeholder={"Improved attendance scanning\nFixed timesheet issues"}
              value={form.releaseNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, releaseNotes: e.target.value }))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isActive: checked === true }))
              }
            />
            <Label htmlFor="isActive" className="font-normal">
              Make this the active release immediately
            </Label>
          </div>

          <Button onClick={() => void publish()} disabled={publishing}>
            {publishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            {publishing ? "Publishing…" : "Publish Release"}
          </Button>
        </CardContent>
      </Card>

      {/* Release history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Release history</CardTitle>
          <CardDescription>Android releases, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : releases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No releases published yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Min code</TableHead>
                    <TableHead>APK filename</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((release) => {
                    const resolved = findGithubAsset(release.githubAssetId);
                    return (
                      <TableRow key={release.id}>
                        <TableCell className="font-medium">
                          {release.version}
                        </TableCell>
                        <TableCell>{release.versionCode}</TableCell>
                        <TableCell>{release.minVersionCode}</TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground font-mono max-w-[14rem] truncate"
                          title={
                            resolved
                              ? resolved.asset.name
                              : `GitHub asset #${release.githubAssetId}`
                          }
                        >
                          {resolved
                            ? resolved.asset.name
                            : `#${release.githubAssetId}`}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {release.releaseNotes.length > 0 ? (
                            <ul className="list-disc ml-4 text-xs text-muted-foreground">
                              {release.releaseNotes.map((note, i) => (
                                <li key={i}>{note}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(release.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={release.isActive ? "default" : "secondary"}>
                            {release.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon-sm" asChild>
                              <a
                                href={`/api/app/admin/app-releases/${encodeURIComponent(release.id)}/download`}
                                title={`Download ${release.version} APK`}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={togglingId === release.id}
                              onClick={() =>
                                void toggleActive(release, !release.isActive)
                              }
                            >
                              {togglingId === release.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : release.isActive ? (
                                "Deactivate"
                              ) : (
                                "Activate"
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Publishing here only records which GitHub release asset devices are
          pointed at — it never uploads or modifies anything on GitHub.
          Deleting a release, or editing version/notes after publishing, isn&apos;t
          supported by the backend yet; deactivate and publish a corrected
          version instead.
        </p>
      </div>
    </div>
  );
}
