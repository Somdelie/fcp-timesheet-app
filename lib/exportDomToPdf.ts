import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ExportOpts = {
  filename?: string;
  marginMm?: number;
  scale?: number;
  landscape?: boolean;
  pageFrame?: "ppe";
};

/**
 * CSS overrides to replace oklch/lab colors with RGB equivalents for html2canvas.
 * html2canvas doesn't support modern CSS color functions.
 */
const RGB_COLOR_OVERRIDES = `
:root, body, .dark {
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

const MODERN_COLOR_PATTERN = /\b(lab|lch|oklch|oklab|color|color-mix)\s*\(/i;

/**
 * Injects RGB color overrides into the cloned document for html2canvas compatibility.
 */
function injectColorOverrides(doc: Document) {
  const style = doc.createElement("style");
  style.textContent = RGB_COLOR_OVERRIDES;
  doc.head.appendChild(style);
  doc.documentElement.style.setProperty("background", "#ffffff", "important");
  doc.documentElement.style.setProperty("color", "#111827", "important");
  doc.body.style.setProperty("background", "#ffffff", "important");
  doc.body.style.setProperty("color", "#111827", "important");
}

/**
 * Convert modern CSS color functions (lab, lch, oklch, oklab, color) to RGB.
 * html2canvas doesn't support these newer color syntaxes.
 */
function copyResolvedColorsForExport(
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement,
  view: Window = window,
) {
  const colorProps = [
    "color",
    "background",
    "backgroundColor",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "boxShadow",
    "caretColor",
    "columnRuleColor",
    "outlineColor",
    "textShadow",
    "textDecorationColor",
    "fill",
    "stroke",
  ];

  const fallbackForProp = (propName: string) => {
    if (propName === "background" || propName === "backgroundColor")
      return "#ffffff";
    if (propName === "boxShadow" || propName === "textShadow") return "none";
    if (propName === "fill" || propName === "stroke") return "#111827";
    if (
      propName === "color" ||
      propName === "caretColor" ||
      propName === "outlineColor" ||
      propName === "textDecorationColor"
    )
      return "#111827";
    if (
      propName === "borderColor" ||
      propName === "borderTopColor" ||
      propName === "borderRightColor" ||
      propName === "borderBottomColor" ||
      propName === "borderLeftColor" ||
      propName === "columnRuleColor"
    )
      return "#e5e7eb";
    return "#111827";
  };

  function copyElementColors(sourceEl: HTMLElement, cloneEl: HTMLElement) {
    const computed = view.getComputedStyle(sourceEl);
    for (const prop of colorProps) {
      const kebabProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      const resolved = computed.getPropertyValue(kebabProp).trim();
      if (!resolved) continue;

      cloneEl.style.setProperty(
        kebabProp,
        MODERN_COLOR_PATTERN.test(resolved) ? fallbackForProp(prop) : resolved,
        "important",
      );
    }
  }

  copyElementColors(sourceRoot, cloneRoot);

  const sourceEls = Array.from(sourceRoot.querySelectorAll("*"));
  const cloneEls = Array.from(cloneRoot.querySelectorAll("*"));
  sourceEls.forEach((sourceEl, index) => {
    const cloneEl = cloneEls[index];
    if (sourceEl instanceof HTMLElement && cloneEl instanceof HTMLElement) {
      copyElementColors(sourceEl, cloneEl);
    }
  });
}

function preserveInlineTextColorsForExport(
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement,
  view: Window = window,
) {
  const sourceEls = [
    sourceRoot,
    ...Array.from(sourceRoot.querySelectorAll("*")),
  ];
  const cloneEls = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll("*"))];

  sourceEls.forEach((sourceEl, index) => {
    const cloneEl = cloneEls[index];
    if (!(sourceEl instanceof HTMLElement) || !(cloneEl instanceof HTMLElement))
      return;

    const inlineColor = sourceEl.style.getPropertyValue("color").trim();
    if (!inlineColor) return;

    const computedColor = view.getComputedStyle(sourceEl).color.trim();
    cloneEl.style.setProperty(
      "color",
      computedColor && !MODERN_COLOR_PATTERN.test(computedColor)
        ? computedColor
        : inlineColor,
      "important",
    );
  });
}

function fallbackForProp(propName: string) {
  const normalized = propName.toLowerCase();
  if (normalized.includes("image")) return "none";
  if (normalized.includes("shadow")) return "none";
  if (normalized.includes("background")) return "#ffffff";
  if (
    normalized.includes("border") ||
    normalized.includes("columnrule") ||
    normalized === "outlinecolor"
  )
    return "#e5e7eb";
  if (normalized === "fill" || normalized === "stroke") return "#111827";
  if (
    normalized === "color" ||
    normalized.includes("foreground") ||
    normalized.includes("caret") ||
    normalized.includes("textdecoration") ||
    normalized.includes("outline")
  )
    return "#111827";
  return "transparent";
}

function sanitizeCssStyleDeclaration(style: CSSStyleDeclaration) {
  for (let i = 0; i < style.length; i += 1) {
    const propName = style[i];
    const value = style.getPropertyValue(propName).trim();
    if (!value || !MODERN_COLOR_PATTERN.test(value)) continue;
    style.setProperty(
      propName,
      fallbackForProp(propName),
      style.getPropertyPriority(propName),
    );
  }
}

function sanitizeCssRule(rule: CSSRule) {
  if ("style" in rule && (rule as CSSStyleRule).style) {
    sanitizeCssStyleDeclaration((rule as CSSStyleRule).style);
  }

  if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) {
    Array.from((rule as CSSGroupingRule).cssRules).forEach(sanitizeCssRule);
  }
}

function sanitizeStyleSheet(sheet: CSSStyleSheet) {
  try {
    Array.from(sheet.cssRules).forEach(sanitizeCssRule);
  } catch {
    // Ignore inaccessible or cross-origin sheets.
  }
}

function sanitizeStyleSheets(doc: Document) {
  Array.from(doc.styleSheets).forEach((sheet) => {
    if (sheet instanceof CSSStyleSheet) {
      sanitizeStyleSheet(sheet);
    }
  });
}

function sanitizeStyleElement(styleEl: HTMLStyleElement) {
  const text = styleEl.textContent;
  if (!text || !MODERN_COLOR_PATTERN.test(text)) return;
  styleEl.textContent = text.replace(
    /(?:lab|lch|oklch|oklab|color|color-mix)\([^)]*\)/gi,
    "currentColor",
  );
}

function sanitizeElementInlineStyle(el: HTMLElement) {
  const style = el.style;
  for (let i = 0; i < style.length; i += 1) {
    const propName = style[i];
    const value = style.getPropertyValue(propName).trim();
    if (!value || !MODERN_COLOR_PATTERN.test(value)) continue;
    style.setProperty(
      propName,
      fallbackForProp(propName),
      style.getPropertyPriority(propName),
    );
  }
}

function sanitizeModernColorSyntax(root: HTMLElement) {
  const elements = [root, ...Array.from(root.querySelectorAll("*"))].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );

  elements.forEach(sanitizeElementInlineStyle);
  root.querySelectorAll("style").forEach((styleEl) => {
    if (styleEl instanceof HTMLStyleElement) sanitizeStyleElement(styleEl);
  });
  if (root.ownerDocument) sanitizeStyleSheets(root.ownerDocument);
}

async function prepareImagesForExport(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const fetchImageAsDataUrl = async (url: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, {
        mode: "cors",
        signal: controller.signal,
      });

      if (!res.ok) return null;
      return blobToDataUrl(await res.blob());
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const waitForImage = (img: HTMLImageElement, timeoutMs = 5000) =>
    new Promise<void>((resolve) => {
      if (img.complete) {
        resolve();
        return;
      }

      const done = () => {
        window.clearTimeout(timeout);
        img.onload = null;
        img.onerror = null;
        resolve();
      };

      const timeout = window.setTimeout(done, timeoutMs);
      img.onload = done;
      img.onerror = done;
    });

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;

      img.crossOrigin = "anonymous";

      try {
        if (!src.startsWith("data:")) {
          const proxiedSrc = `/api/export-image?url=${encodeURIComponent(src)}`;
          const dataUrl =
            (await fetchImageAsDataUrl(src)) ||
            (await fetchImageAsDataUrl(proxiedSrc));

          if (dataUrl) {
            img.src = dataUrl;
            img.removeAttribute("srcset");
            img.removeAttribute("sizes");
            img.style.display = "block";
            img.style.maxWidth = "100%";
            img.style.height = "auto";
          }
        }
      } catch {
        // Keep the original URL. html2canvas may still be able to load it.
      }

      if (img.complete && img.naturalWidth > 0) return;
      await waitForImage(img);
    }),
  );
}

function forceExportStyles(root: HTMLElement) {
  // Only affects the CLONED node.
  (root.style as any).WebkitPrintColorAdjust = "exact";
  (root.style as any).printColorAdjust = "exact";
}

function canvasToImageData(canvas: HTMLCanvasElement) {
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("PDF export rendered an empty page");
  }

  return canvas.toDataURL("image/png");
}

function canvasHasVisibleContent(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;

  const step = 16;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const i = (y * canvas.width + x) * 4;
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) {
        return true;
      }
    }
  }

  return false;
}

function drawPreparedImagesOnCanvas(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0 || rootRect.height <= 0) return;

  const scaleX = canvas.width / rootRect.width;
  const scaleY = canvas.height / rootRect.height;

  const hasVisiblePixels = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const sampleX = Math.max(0, Math.floor(x));
    const sampleY = Math.max(0, Math.floor(y));
    const sampleW = Math.min(canvas.width - sampleX, Math.ceil(width));
    const sampleH = Math.min(canvas.height - sampleY, Math.ceil(height));
    if (sampleW <= 0 || sampleH <= 0) return true;

    try {
      const data = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
      const step = Math.max(
        4,
        Math.floor(Math.sqrt((sampleW * sampleH) / 500)),
      );
      let visible = 0;
      let sampled = 0;

      for (let row = 0; row < sampleH; row += step) {
        for (let col = 0; col < sampleW; col += step) {
          const i = (row * sampleW + col) * 4;
          sampled++;
          if (
            data[i + 3] > 0 &&
            (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)
          ) {
            visible++;
          }
        }
      }

      return sampled > 0 && visible / sampled > 0.01;
    } catch {
      return true;
    }
  };

  root.querySelectorAll("img").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0)
      return;
    const src = img.currentSrc || img.src;
    const isSameOrigin =
      src.startsWith("data:") ||
      src.startsWith(window.location.origin) ||
      src.startsWith("/");
    if (!isSameOrigin) return;

    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (rect.left - rootRect.left) * scaleX;
    const y = (rect.top - rootRect.top) * scaleY;
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;
    if (hasVisiblePixels(x, y, width, height)) return;

    try {
      ctx.drawImage(img, x, y, width, height);
    } catch {
      // Keep the PDF export moving if one image cannot be drawn.
    }
  });
}

function drawPpePageFrame(pdf: jsPDF) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  pdf.setDrawColor(47, 59, 89);
  pdf.setLineWidth(0.35);
  pdf.rect(7.1, 6.4, pageW - 14.2, pageH - 12.8);
  pdf.setLineWidth(1.05);
  pdf.rect(8.5, 7.8, pageW - 17, pageH - 15.6);
  pdf.setLineWidth(0.35);
  pdf.rect(10.6, 9.9, pageW - 21.2, pageH - 19.8);
}

export async function exportDomToPdf(node: HTMLElement, opts: ExportOpts = {}) {
  const {
    filename = "timesheet.pdf",
    marginMm = 8,
    scale = 3,
    landscape = true,
    pageFrame,
  } = opts;

  const sourceRect = node.getBoundingClientRect();
  const sourceWidth = Math.ceil(
    Math.max(sourceRect.width, node.scrollWidth, node.offsetWidth, 1120),
  );
  const effectiveScale = Math.max(scale, 3);

  // Temporary host must be rendered and measurable for html2canvas.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.background = "#ffffff";
  host.style.pointerEvents = "none";
  host.style.width = `${sourceWidth || node.scrollWidth || 1120}px`;

  // Wrapper: keeps export out of `.dark` context
  const wrapper = document.createElement("div");
  wrapper.style.background = "#ffffff";
  wrapper.style.padding = "16px";
  wrapper.style.width = `${sourceWidth || node.scrollWidth || 1120}px`;
  (wrapper.style as any).WebkitPrintColorAdjust = "exact";
  (wrapper.style as any).printColorAdjust = "exact";

  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.width = `${sourceWidth || node.scrollWidth || 1120}px`;
  clone.style.maxWidth = "none";
  forceExportStyles(clone);
  copyResolvedColorsForExport(node, clone);
  sanitizeModernColorSyntax(clone);
  preserveInlineTextColorsForExport(node, clone);

  wrapper.appendChild(clone);
  host.appendChild(wrapper);
  document.body.appendChild(host);

  try {
    await prepareImagesForExport(clone);

    // Let layout settle
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const pdfPages = clone.matches("[data-pdf-page='true']")
      ? [clone]
      : Array.from(
          wrapper.querySelectorAll<HTMLElement>("[data-pdf-page='true']"),
        );

    if (clone.dataset.pdfPages === "true" && pdfPages.length > 0) {
      const pdf = new jsPDF({
        orientation: landscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const usableW = pageW - marginMm * 2;
      const usableH = pageH - marginMm * 2;

      for (let i = 0; i < pdfPages.length; i++) {
        const pageNode = pdfPages[i];
        const canvas = await html2canvas(pageNode, {
          scale: effectiveScale,
          backgroundColor: "#ffffff",
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: pageNode.scrollWidth,
          windowHeight: pageNode.scrollHeight,
          imageTimeout: 5000,
          onclone: (clonedDoc) => {
            injectColorOverrides(clonedDoc);
            sanitizeModernColorSyntax(clonedDoc.body);
          },
        });

        drawPreparedImagesOnCanvas(canvas, pageNode);
        const imgData = canvasToImageData(canvas);
        const imgRatio = canvas.height / canvas.width;
        let imgW = usableW;
        let imgH = usableW * imgRatio;
        if (imgH > usableH) {
          imgH = usableH;
          imgW = usableH / imgRatio;
        }
        const imgX = marginMm + (usableW - imgW) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(
          imgData,
          "PNG",
          imgX,
          marginMm,
          imgW,
          imgH,
          undefined,
          "FAST",
        );
        if (pageFrame === "ppe") drawPpePageFrame(pdf);
      }

      pdf.save(filename);
      return;
    }

    const canvas = await html2canvas(wrapper, {
      scale: effectiveScale,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
      imageTimeout: 5000,
      onclone: (clonedDoc) => {
        // Inject RGB color overrides to replace oklch/lab colors
        injectColorOverrides(clonedDoc);
        sanitizeModernColorSyntax(clonedDoc.body);
      },
    });

    drawPreparedImagesOnCanvas(canvas, wrapper);

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

      if (pageIndex > 0 && !canvasHasVisibleContent(slice)) break;

      const sliceData = canvasToImageData(slice);
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
      if (pageFrame === "ppe") drawPpePageFrame(pdf);

      pageIndex++;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
