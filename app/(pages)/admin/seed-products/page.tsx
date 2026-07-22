"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Merge,
  Search,
  Upload,
  Trash2,
  File,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// Note: pdfjs-dist is dynamically imported inside `extractTextFromPdf`
// to avoid server-side resolution/externalization issues.

// Types
interface ParsedProduct {
  name: string;
  unit: string;
  unitSize: number | null;
  price: number | null;
  supplier: string;
  date: string;
  orderNo: string;
  rawLine: string;
}

interface DuplicateGroup {
  normalizedName: string;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    thumbnailUrl: string | null;
    supplierId: string | null;
    supplierName: string | null;
    priceCount: number;
  }>;
  keepId: string;
}

interface ExistingProduct {
  id: string;
  name: string;
  normalizedName: string | null;
  sku: string | null;
  thumbnailUrl: string | null;
  supplierId: string | null;
}

interface ExistingSupplier {
  id: string;
  name: string;
  normalizedName: string | null;
}

// Normalize product name for duplicate detection
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\b(5l|20l|1l|10l|25kg|32kg|40kg)\b/gi, "")
    .replace(/\b(pastel|deep|transparent|white|clear)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse unit from text (5L, 20L, each, 32KG, etc.)
function parseUnit(text: string): { unit: string; size: number | null } {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(L|KG|M|MM|G|ML)/i);
  if (match) {
    return {
      unit: match[2].toUpperCase(),
      size: parseFloat(match[1]),
    };
  }
  if (text.toLowerCase().includes("each")) {
    return { unit: "EACH", size: 1 };
  }
  return { unit: "UNIT", size: null };
}

// Parse price from text
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse PDF content into structured data
function parsePdfContent(content: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  const lines = content.split("\n");

  let currentSupplier = "";
  let currentDate = "";
  let currentOrderNo = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect supplier lines (e.g., "DIY Savoy Plascon", "Marmoran", "Baumer and Son Rosebank")
    if (
      line.match(
        /^(DIY Savoy|Marmoran|Baumer|Dulux|Technopol|Versus|Urochem|Mbombela|City Paint)/i,
      )
    ) {
      currentSupplier = line;
      continue;
    }

    // Detect date and order number lines
    const dateMatch = line.match(
      /(\d{2}-\w{3}-\d{4})(\d+)(completed|po ready)/i,
    );
    if (dateMatch) {
      currentDate = dateMatch[1];
      currentOrderNo = dateMatch[2];
    }

    // Detect product lines with unit/quantity info
    const unitMatch = line.match(/^(completed|po ready)(\d+L|\d+KG|each)/i);
    if (unitMatch && currentSupplier) {
      const { unit, size } = parseUnit(unitMatch[2]);

      // Look for price in the same line or nearby
      const priceMatch = line.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*-/);
      const price = priceMatch ? parsePrice(priceMatch[1]) : null;

      // Get product name from next line(s)
      let productName = "";
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (
          nextLine &&
          !nextLine.match(/^\d/) &&
          !nextLine.match(/^(completed|po ready|b fwd)/i)
        ) {
          productName = nextLine;
          break;
        }
      }

      if (productName) {
        products.push({
          name: productName,
          unit,
          unitSize: size,
          price,
          supplier: currentSupplier,
          date: currentDate,
          orderNo: currentOrderNo,
          rawLine: line,
        });
      }
    }

    // Alternative: detect product code lines (e.g., "TSA003010", "TVW 003000")
    const codeMatch = line.match(/^([A-Z]{2,4}\s?\d{5,6})/);
    if (codeMatch && currentSupplier) {
      // Extract product name from the line
      const productName = line.replace(codeMatch[1], "").trim();
      if (productName.length > 5) {
        // Look back for unit/price info
        const prevLine = i > 0 ? lines[i - 1].trim() : "";
        const unitInfo = parseUnit(prevLine);
        const priceMatch = prevLine.match(
          /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*-/,
        );

        products.push({
          name: `${codeMatch[1]} ${productName}`,
          unit: unitInfo.unit,
          unitSize: unitInfo.size,
          price: priceMatch ? parsePrice(priceMatch[1]) : null,
          supplier: currentSupplier,
          date: currentDate,
          orderNo: currentOrderNo,
          rawLine: line,
        });
      }
    }
  }

  return products;
}

// Find duplicates in existing products
function findDuplicates(
  products: ExistingProduct[],
): Map<string, ExistingProduct[]> {
  const groups = new Map<string, ExistingProduct[]>();

  for (const product of products) {
    const normalized = normalizeProductName(product.name);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(product);
  }

  // Filter to only groups with duplicates
  const duplicates = new Map<string, ExistingProduct[]>();
  for (const [key, value] of groups) {
    if (value.length > 1) {
      duplicates.set(key, value);
    }
  }

  return duplicates;
}

// Generate SQL for merging duplicates
function generateMergeSql(duplicateGroups: DuplicateGroup[]): string {
  const statements: string[] = [
    "-- =============================================",
    "-- DUPLICATE PRODUCT MERGE SCRIPT",
    "-- Generated: " + new Date().toISOString(),
    "-- =============================================",
    "",
    "BEGIN;",
    "",
  ];

  for (const group of duplicateGroups) {
    const keep = group.keepId;
    const remove = group.products.filter((p) => p.id !== keep).map((p) => p.id);

    if (remove.length === 0) continue;

    statements.push(`-- Merging: ${group.normalizedName}`);
    statements.push(`-- Keeping: ${keep}`);
    statements.push(`-- Removing: ${remove.join(", ")}`);
    statements.push("");

    // Update references to point to the kept product
    for (const removeId of remove) {
      statements.push(`-- Updating references from ${removeId} to ${keep}`);

      // Update SupplierProductPrice
      statements.push(
        `UPDATE "SupplierProductPrice" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update SiteProductOrderItem
      statements.push(
        `UPDATE "SiteProductOrderItem" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update SiteMaterial
      statements.push(
        `UPDATE "SiteMaterial" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update SiteFinishingScheduleItem
      statements.push(
        `UPDATE "SiteFinishingScheduleItem" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update SitePaintPlan
      statements.push(
        `UPDATE "SitePaintPlan" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update SitePlantAssignment
      statements.push(
        `UPDATE "SitePlantAssignment" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update ForemanPpeOrderItem
      statements.push(
        `UPDATE "ForemanPpeOrderItem" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update PlantTransfer
      statements.push(
        `UPDATE "PlantTransfer" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update ProductVariantStock
      statements.push(
        `UPDATE "ProductVariantStock" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update ProductColorVariant
      statements.push(
        `UPDATE "ProductColorVariant" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      // Update ProcurementProductCoverage
      statements.push(
        `UPDATE "ProcurementProductCoverage" SET "productId" = '${keep}' WHERE "productId" = '${removeId}';`,
      );

      statements.push("");
    }

    // Delete the duplicate products
    statements.push(`-- Delete duplicates`);
    statements.push(
      `DELETE FROM "ProcurementProduct" WHERE "id" IN (${remove.map((id) => `'${id}'`).join(", ")});`,
    );
    statements.push("");
    statements.push("-- -------------------------------------------");
    statements.push("");
  }

  statements.push("COMMIT;");

  return statements.join("\n");
}

// Generate SQL for seeding prices
function generatePriceSeedSql(
  products: ParsedProduct[],
  existingProducts: ExistingProduct[],
  existingSuppliers: ExistingSupplier[],
): string {
  const statements: string[] = [
    "-- =============================================",
    "-- PRICE SEEDING SCRIPT",
    "-- Generated: " + new Date().toISOString(),
    "-- =============================================",
    "",
    "BEGIN;",
    "",
  ];

  // Create a map of normalized names to existing products
  const productMap = new Map<string, ExistingProduct>();
  for (const p of existingProducts) {
    const normalized = normalizeProductName(p.name);
    if (!productMap.has(normalized)) {
      productMap.set(normalized, p);
    }
  }

  // Create a map of normalized names to suppliers
  const supplierMap = new Map<string, ExistingSupplier>();
  for (const s of existingSuppliers) {
    const normalized = s.name.toLowerCase().trim();
    supplierMap.set(normalized, s);
  }

  // Group parsed products by product + supplier + unit
  const priceEntries = new Map<string, ParsedProduct>();
  for (const p of products) {
    if (p.price && p.price > 0) {
      const key = `${normalizeProductName(p.name)}|${p.supplier.toLowerCase()}|${p.unitSize}${p.unit}`;
      // Keep the most recent price
      if (
        !priceEntries.has(key) ||
        new Date(p.date) > new Date(priceEntries.get(key)!.date)
      ) {
        priceEntries.set(key, p);
      }
    }
  }

  let insertCount = 0;
  for (const [, parsed] of priceEntries) {
    const normalizedProductName = normalizeProductName(parsed.name);
    const existingProduct = productMap.get(normalizedProductName);

    // Find supplier
    let supplierId: string | null = null;
    for (const [key, supplier] of supplierMap) {
      if (
        parsed.supplier.toLowerCase().includes(key) ||
        key.includes(parsed.supplier.toLowerCase())
      ) {
        supplierId = supplier.id;
        break;
      }
    }

    if (!existingProduct) {
      statements.push(`-- Product not found: ${parsed.name}`);
      continue;
    }

    if (!supplierId) {
      statements.push(`-- Supplier not found: ${parsed.supplier}`);
      continue;
    }

    // Generate CUID-like ID
    const priceId = `clp${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}${insertCount}`;

    // Map unit to enum
    const uomMap: Record<string, string> = {
      L: "LITRE",
      KG: "KG",
      M: "METRE",
      MM: "MM",
      G: "GRAM",
      ML: "ML",
      EACH: "EACH",
      UNIT: "EACH",
    };

    const uom = uomMap[parsed.unit] || "EACH";

    statements.push(
      `-- Product: ${parsed.name} | Supplier: ${parsed.supplier} | ${parsed.unitSize}${parsed.unit} @ R${parsed.price}`,
    );
    statements.push(
      `INSERT INTO "SupplierProductPrice" ("id", "supplierId", "productId", "uom", "unitSize", "price", "createdAt", "updatedAt")`,
    );
    statements.push(
      `VALUES ('${priceId}', '${supplierId}', '${existingProduct.id}', '${uom}', ${parsed.unitSize || 1}, ${parsed.price}, NOW(), NOW())`,
    );
    statements.push(`ON CONFLICT DO NOTHING;`);
    statements.push("");

    insertCount++;
  }

  statements.push(`-- Total price entries: ${insertCount}`);
  statements.push("");
  statements.push("COMMIT;");

  return statements.join("\n");
}

export default function SeedProductsPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const [pdfContent, setPdfContent] = useState("");
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing data (would come from API in real app)
  const [existingProductsJson, setExistingProductsJson] = useState("");
  const [existingSuppliersJson, setExistingSuppliersJson] = useState("");

  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>(
    [],
  );
  const [existingSuppliers, setExistingSuppliers] = useState<
    ExistingSupplier[]
  >([]);

  // Duplicate detection
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedKeepIds, setSelectedKeepIds] = useState<Map<string, string>>(
    new Map(),
  );

  // SQL output
  const [mergeSql, setMergeSql] = useState("");
  const [priceSql, setPriceSql] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Extract text from PDF file
  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();

    // Dynamically import pdfjs-dist on the client to avoid server-side
    // externalization/resolution issues when building with Next/Turbopack.
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Resolve the worker from the installed package so extraction does not depend
    // on an external CDN or a version-specific public asset.
    if (typeof window !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
    }

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
      });
      const pageText = textContent.items
        .map((item: any) =>
          "str" in item && typeof item.str === "string" ? item.str : "",
        )
        .join(" ");
      fullText += pageText.trim() + "\n";
    }

    return fullText.trim();
  };

  // Handle PDF file upload (server-side parsing)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    setUploadedFile(file);
    setIsExtractingPdf(true);
    setServerError(null);

    try {
      const form = new FormData();
      form.append("pdfs", file, file.name);

      const res = await fetch("/api/admin/buildsmart/seed-from-pdfs", {
        method: "POST",
        body: form,
        // Ensure cookies/session are sent in environments where fetch
        // credentials defaults may differ (helps avoid 401 Unauthorized).
        credentials: "include",
      });

      if (!res.ok) {
        // Try to capture a helpful response body for debugging
        const text = await res.text().catch(() => null);
        console.error(
          "/api/admin/buildsmart/seed-from-pdfs error",
          res.status,
          text,
        );
        // Try JSON parse fallback
        let errBody: any = null;
        try {
          errBody = JSON.parse(text ?? "null");
        } catch {}
        const msg = errBody?.error || text || `Server responded ${res.status}`;
        setServerError(String(msg));
        throw new Error(msg);
      }

      const data = await res.json();
      setServerError(null);

      // Map server debug payload to ParsedProduct[] for review table
      const products: ParsedProduct[] = [];
      if (Array.isArray(data.debug)) {
        for (const order of data.debug) {
          const vendor = order.vendorName ?? "";
          const date = order.createdDate ?? "";
          const orderNo = order.orderNumber ?? "";
          if (Array.isArray(order.items)) {
            for (const it of order.items) {
              products.push({
                name: it.raw ? String(it.raw).slice(0, 200) : "",
                unit: it.unit ?? "",
                unitSize: null,
                price: null,
                supplier: vendor,
                date,
                orderNo,
                rawLine: it.raw ?? "",
              });
            }
          }
        }
      }

      setParsedProducts(products);
      setActiveTab("review");
    } catch (error) {
      console.error("Server-side PDF parse failed", error);
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Unknown error");
      setServerError(message);
      alert("Failed to parse PDF on server: " + message);
    } finally {
      setIsExtractingPdf(false);
    }
  };

  // Remove uploaded file
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setPdfContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Parse uploaded PDF content
  const handleParsePdf = () => {
    setIsParsing(true);
    try {
      const products = parsePdfContent(pdfContent);
      setParsedProducts(products);
      setActiveTab("review");
    } finally {
      setIsParsing(false);
    }
  };

  // Load existing products JSON
  const handleLoadProducts = () => {
    try {
      const products = JSON.parse(existingProductsJson) as ExistingProduct[];
      setExistingProducts(products);
    } catch {
      alert("Invalid JSON for products");
    }
  };

  // Load existing suppliers JSON
  const handleLoadSuppliers = () => {
    try {
      const suppliers = JSON.parse(existingSuppliersJson) as ExistingSupplier[];
      setExistingSuppliers(suppliers);
    } catch {
      alert("Invalid JSON for suppliers");
    }
  };

  // Find duplicates
  const handleFindDuplicates = () => {
    const duplicates = findDuplicates(existingProducts);
    const groups: DuplicateGroup[] = [];
    const keepIds = new Map<string, string>();

    for (const [normalized, products] of duplicates) {
      // Default: keep the one with most data (thumbnail, sku, supplier)
      const sorted = [...products].sort((a, b) => {
        const scoreA =
          (a.thumbnailUrl ? 2 : 0) + (a.sku ? 1 : 0) + (a.supplierId ? 1 : 0);
        const scoreB =
          (b.thumbnailUrl ? 2 : 0) + (b.sku ? 1 : 0) + (b.supplierId ? 1 : 0);
        return scoreB - scoreA;
      });

      const keepId = sorted[0].id;
      keepIds.set(normalized, keepId);

      groups.push({
        normalizedName: normalized,
        products: sorted.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          thumbnailUrl: p.thumbnailUrl,
          supplierId: p.supplierId,
          supplierName:
            existingSuppliers.find((s) => s.id === p.supplierId)?.name || null,
          priceCount: 0, // Would need to load from DB
        })),
        keepId,
      });
    }

    setDuplicateGroups(groups);
    setSelectedKeepIds(keepIds);
    setActiveTab("duplicates");
  };

  // Update which product to keep
  const handleSelectKeep = (normalizedName: string, productId: string) => {
    const newKeepIds = new Map(selectedKeepIds);
    newKeepIds.set(normalizedName, productId);
    setSelectedKeepIds(newKeepIds);

    // Update duplicate groups
    setDuplicateGroups((prev) =>
      prev.map((g) =>
        g.normalizedName === normalizedName ? { ...g, keepId: productId } : g,
      ),
    );
  };

  // Generate SQL scripts
  const handleGenerateSql = () => {
    // Generate merge SQL
    const merge = generateMergeSql(duplicateGroups);
    setMergeSql(merge);

    // Generate price seed SQL
    const prices = generatePriceSeedSql(
      parsedProducts,
      existingProducts,
      existingSuppliers,
    );
    setPriceSql(prices);

    setActiveTab("sql");
  };

  // Copy to clipboard
  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  // Download SQL file
  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const stats = useMemo(() => {
    const uniqueSuppliers = new Set(parsedProducts.map((p) => p.supplier));
    const withPrices = parsedProducts.filter((p) => p.price && p.price > 0);
    return {
      totalParsed: parsedProducts.length,
      uniqueSuppliers: uniqueSuppliers.size,
      withPrices: withPrices.length,
      duplicateGroups: duplicateGroups.length,
      productsToMerge: duplicateGroups.reduce(
        (sum, g) => sum + g.products.length - 1,
        0,
      ),
    };
  }, [parsedProducts, duplicateGroups]);

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Product Data Seeding Tool
        </h1>
        <p className="text-muted-foreground mt-2">
          Parse PDF reports, identify duplicates, and generate SQL scripts to
          update your product database.
        </p>
      </div>

      {serverError && (
        <div className="mb-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Server response</AlertTitle>
            <AlertDescription>
              <pre className="whitespace-pre-wrap text-xs font-mono">
                {serverError}
              </pre>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalParsed}</div>
            <p className="text-xs text-muted-foreground">Parsed Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.uniqueSuppliers}</div>
            <p className="text-xs text-muted-foreground">Suppliers Found</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.withPrices}</div>
            <p className="text-xs text-muted-foreground">With Prices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.duplicateGroups}</div>
            <p className="text-xs text-muted-foreground">Duplicate Groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.productsToMerge}</div>
            <p className="text-xs text-muted-foreground">To Be Merged</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="review">
            <FileText className="w-4 h-4 mr-2" />
            Review
          </TabsTrigger>
          <TabsTrigger value="existing">
            <Search className="w-4 h-4 mr-2" />
            Load Data
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Merge className="w-4 h-4 mr-2" />
            Duplicates
          </TabsTrigger>
          <TabsTrigger value="sql">
            <Download className="w-4 h-4 mr-2" />
            SQL Output
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload PDF File</CardTitle>
              <CardDescription>
                Upload your Contract Costs Report PDF file or paste the text
                content below. The parser will extract product names, units,
                prices, and suppliers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload Area */}
              <div className="space-y-2">
                <Label>PDF File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-file-input"
                />

                {!uploadedFile ? (
                  <label
                    htmlFor="pdf-file-input"
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {isExtractingPdf ? (
                      <>
                        <Loader2 className="w-10 h-10 text-muted-foreground animate-spin mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Extracting text from PDF...
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                        <span className="text-sm font-medium">
                          Click to upload PDF
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          or drag and drop
                        </span>
                      </>
                    )}
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded">
                        <File className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {uploadedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Text Extracted
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        className="h-8 w-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or paste text content
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-content">PDF Text Content</Label>
                <textarea
                  id="pdf-content"
                  className="w-full h-64 p-4 border rounded-md font-mono text-sm resize-none bg-muted/50"
                  placeholder="Paste the text content from your PDF here..."
                  value={pdfContent}
                  onChange={(e) => setPdfContent(e.target.value)}
                />
              </div>

              <Button
                onClick={handleParsePdf}
                disabled={!pdfContent || isParsing}
                className="w-full"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Parse PDF Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Parsed Products</CardTitle>
              <CardDescription>
                Review the extracted product data. {parsedProducts.length}{" "}
                products found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Product Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedProducts.map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          <div
                            className="truncate max-w-[300px]"
                            title={product.name}
                          >
                            {product.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.unitSize}
                            {product.unit}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.price ? (
                            <span className="text-green-600 font-medium">
                              R{product.price.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{product.supplier}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.date}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Load Existing Data Tab */}
        <TabsContent value="existing" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Existing Products</CardTitle>
                <CardDescription>
                  Paste the JSON export of your ProcurementProduct table.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  className="w-full h-64 p-4 border rounded-md font-mono text-xs resize-none bg-muted/50"
                  placeholder='[{"id": "...", "name": "...", "normalizedName": "...", "sku": "...", "thumbnailUrl": "...", "supplierId": "..."}]'
                  value={existingProductsJson}
                  onChange={(e) => setExistingProductsJson(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleLoadProducts}>
                    Load Products ({existingProducts.length} loaded)
                  </Button>
                  {existingProducts.length > 0 && (
                    <Badge variant="secondary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {existingProducts.length} products
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Suppliers</CardTitle>
                <CardDescription>
                  Paste the JSON export of your Supplier table.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  className="w-full h-64 p-4 border rounded-md font-mono text-xs resize-none bg-muted/50"
                  placeholder='[{"id": "...", "name": "...", "normalizedName": "..."}]'
                  value={existingSuppliersJson}
                  onChange={(e) => setExistingSuppliersJson(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleLoadSuppliers}>
                    Load Suppliers ({existingSuppliers.length} loaded)
                  </Button>
                  {existingSuppliers.length > 0 && (
                    <Badge variant="secondary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {existingSuppliers.length} suppliers
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Button
              size="lg"
              onClick={handleFindDuplicates}
              disabled={existingProducts.length === 0}
            >
              <Search className="w-4 h-4 mr-2" />
              Find Duplicates in Products
            </Button>
          </div>
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Products</CardTitle>
              <CardDescription>
                {duplicateGroups.length} groups of duplicates found. Select
                which product to keep in each group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {duplicateGroups.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No duplicates found</AlertTitle>
                  <AlertDescription>
                    Load your existing products data first, then click
                    &quot;Find Duplicates&quot;.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-6">
                    {duplicateGroups.map((group) => (
                      <div
                        key={group.normalizedName}
                        className="border rounded-lg p-4"
                      >
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Merge className="w-4 h-4" />
                          {group.normalizedName}
                          <Badge variant="secondary">
                            {group.products.length} duplicates
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {group.products.map((product) => (
                            <div
                              key={product.id}
                              className={`flex items-center gap-3 p-3 rounded-md border ${
                                group.keepId === product.id
                                  ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                                  : "bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={group.keepId === product.id}
                                onCheckedChange={() =>
                                  handleSelectKeep(
                                    group.normalizedName,
                                    product.id,
                                  )
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {product.name}
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-2">
                                  <span>ID: {product.id.slice(0, 8)}...</span>
                                  {product.sku && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      SKU: {product.sku}
                                    </Badge>
                                  )}
                                  {product.thumbnailUrl && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-blue-50"
                                    >
                                      Has Image
                                    </Badge>
                                  )}
                                  {product.supplierName && (
                                    <span>
                                      Supplier: {product.supplierName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {group.keepId === product.id ? (
                                <Badge className="bg-green-600">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Keep
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Remove
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <Separator className="my-6" />

              <Button
                size="lg"
                onClick={handleGenerateSql}
                disabled={
                  duplicateGroups.length === 0 && parsedProducts.length === 0
                }
              >
                <Download className="w-4 h-4 mr-2" />
                Generate SQL Scripts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SQL Output Tab */}
        <TabsContent value="sql" className="mt-6">
          <div className="grid gap-6">
            {/* Merge SQL */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Duplicate Merge SQL</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(mergeSql, "merge")}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copied === "merge" ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDownload(mergeSql, "merge-duplicates.sql")
                      }
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Run this script to merge duplicate products and update all
                  references.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <pre className="p-4 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap">
                    {mergeSql || "Generate SQL first..."}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Price Seed SQL */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Price Seeding SQL</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(priceSql, "price")}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copied === "price" ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDownload(priceSql, "seed-prices.sql")
                      }
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Run this script to insert supplier prices from the parsed PDF
                  data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <pre className="p-4 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap">
                    {priceSql || "Generate SQL first..."}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
