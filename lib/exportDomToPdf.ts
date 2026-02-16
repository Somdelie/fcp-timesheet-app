// lib/exportDomToPdf.ts
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ExportOpts = {
  filename?: string;
  marginMm?: number;
  scale?: number;
  landscape?: boolean;
};

/**
 * CSS overrides to replace oklch/lab colors with RGB equivalents for html2canvas.
 * html2canvas doesn't support modern CSS color functions.
 */
const RGB_COLOR_OVERRIDES = `
:root, .dark, * {
  --background: #ffffff !important;
  --foreground: #111827 !important;
  --card: #ffffff !important;
  --card-foreground: #111827 !important;
  --popover: #ffffff !important;
  --popover-foreground: #111827 !important;
  --primary: #16988d !important;
  --primary-foreground: #f9fafb !important;
  --secondary: #f3f4f6 !important;
  --secondary-foreground: #1f2937 !important;
  --muted: #f3f4f6 !important;
  --muted-foreground: #6b7280 !important;
  --accent: #f3f4f6 !important;
  --accent-foreground: #1f2937 !important;
  --destructive: #dc2626 !important;
  --border: #e5e7eb !important;
  --input: #e5e7eb !important;
  --ring: #9ca3af !important;
  --chart-1: #f97316 !important;
  --chart-2: #14b8a6 !important;
  --chart-3: #3b82f6 !important;
  --chart-4: #eab308 !important;
  --chart-5: #f59e0b !important;
  --sidebar: #f9fafb !important;
  --sidebar-foreground: #111827 !important;
  --sidebar-primary: #16988d !important;
  --sidebar-primary-foreground: #f9fafb !important;
  --sidebar-accent: #f3f4f6 !important;
  --sidebar-accent-foreground: #1f2937 !important;
  --sidebar-border: #e5e7eb !important;
  --sidebar-ring: #9ca3af !important;
}
`;

/**
 * Injects RGB color overrides into the cloned document for html2canvas compatibility.
 */
function injectColorOverrides(doc: Document) {
  const style = doc.createElement("style");
  style.textContent = RGB_COLOR_OVERRIDES;
  doc.head.appendChild(style);
}

/**
 * Convert modern CSS color functions (lab, lch, oklch, oklab, color) to RGB.
 * html2canvas doesn't support these newer color syntaxes.
 */
function sanitizeColorsForExport(root: HTMLElement) {
  const colorProps = [
    "color",
    "backgroundColor",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "fill",
    "stroke",
  ];

  const unsupportedColorPattern = /\b(lab|lch|oklch|oklab|color)\s*\(/i;

  function sanitizeElement(el: HTMLElement) {
    const style = el.style;
    const computed = window.getComputedStyle(el);

    for (const prop of colorProps) {
      const kebabProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      const currentValue =
        style.getPropertyValue(kebabProp) ||
        computed.getPropertyValue(kebabProp);

      if (currentValue && unsupportedColorPattern.test(currentValue)) {
        // Use computed style which returns resolved RGB
        const resolvedColor = computed.getPropertyValue(kebabProp);
        if (resolvedColor && !unsupportedColorPattern.test(resolvedColor)) {
          style.setProperty(kebabProp, resolvedColor, "important");
        } else {
          // Fallback: set to transparent or inherit
          style.setProperty(kebabProp, "inherit", "important");
        }
      }
    }

    // Handle CSS custom properties that might contain unsupported colors
    const inlineStyle = el.getAttribute("style") || "";
    if (unsupportedColorPattern.test(inlineStyle)) {
      const sanitized = inlineStyle.replace(
        /:\s*(lab|lch|oklch|oklab|color)\([^)]+\)/gi,
        ": inherit",
      );
      el.setAttribute("style", sanitized);
    }
  }

  // Sanitize root and all descendants
  sanitizeElement(root);
  root.querySelectorAll("*").forEach((el) => {
    if (el instanceof HTMLElement) {
      sanitizeElement(el);
    }
  });
}

function forceLightExportStyles(root: HTMLElement) {
  // Only affects the CLONED node.
  root.style.background = "#ffffff";
  root.style.color = "#111827";
  (root.style as any).WebkitPrintColorAdjust = "exact";
  (root.style as any).printColorAdjust = "exact";
}

export async function exportDomToPdf(node: HTMLElement, opts: ExportOpts = {}) {
  const {
    filename = "timesheet.pdf",
    marginMm = 8,
    scale = 2,
    landscape = true,
  } = opts;

  // Offscreen host (must be rendered; not display:none)
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.zIndex = "2147483647";
  host.style.background = "#ffffff";

  // Wrapper: keeps export out of `.dark` context
  const wrapper = document.createElement("div");
  wrapper.style.background = "#ffffff";
  wrapper.style.padding = "16px";
  (wrapper.style as any).WebkitPrintColorAdjust = "exact";
  (wrapper.style as any).printColorAdjust = "exact";

  const clone = node.cloneNode(true) as HTMLElement;
  forceLightExportStyles(clone);
  sanitizeColorsForExport(clone);

  wrapper.appendChild(clone);
  host.appendChild(wrapper);
  document.body.appendChild(host);

  try {
    // Let layout settle
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = await html2canvas(wrapper, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        // Inject RGB color overrides to replace oklch/lab colors
        injectColorOverrides(clonedDoc);
        // Also sanitize any inline styles
        clonedDoc.querySelectorAll("*").forEach((el) => {
          if (el instanceof HTMLElement) {
            const style = el.getAttribute("style") || "";
            if (/\b(lab|lch|oklch|oklab|color)\s*\(/i.test(style)) {
              el.setAttribute(
                "style",
                style.replace(
                  /:\s*(lab|lch|oklch|oklab|color)\([^)]+\)/gi,
                  ": inherit",
                ),
              );
            }
          }
        });
      },
    });

    const imgData = canvas.toDataURL("image/png", 1.0);

    const pdf = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const usableW = pageW - marginMm * 2;
    const usableH = pageH - marginMm * 2;

    const imgPxW = canvas.width;
    const imgPxH = canvas.height;

    const mmPerPx = usableW / imgPxW;
    const pagePxH = Math.floor(usableH / mmPerPx);

    let pageIndex = 0;
    while (pageIndex * pagePxH < imgPxH) {
      const slice = document.createElement("canvas");
      slice.width = imgPxW;
      slice.height = Math.min(pagePxH, imgPxH - pageIndex * pagePxH);

      const ctx = slice.getContext("2d");
      if (!ctx) break;

      ctx.drawImage(
        canvas,
        0,
        pageIndex * pagePxH,
        imgPxW,
        slice.height,
        0,
        0,
        imgPxW,
        slice.height,
      );

      const sliceData = slice.toDataURL("image/png", 1.0);
      const sliceMmH = slice.height * mmPerPx;

      if (pageIndex > 0) pdf.addPage();

      pdf.addImage(
        sliceData,
        "PNG",
        marginMm,
        marginMm,
        usableW,
        sliceMmH,
        undefined,
        "FAST",
      );

      pageIndex++;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
