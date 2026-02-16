/**
 * Enhanced PDF Download with Fallback Methods
 * Use this if the standard download isn't working
 */

export function downloadTimesheetPdf(pdfBytes: Uint8Array, filename: string) {
  try {
    // Convert Uint8Array to ArrayBuffer for Blob compatibility
    const blob = new Blob([pdfBytes.slice().buffer], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "timesheet.pdf";
    link.style.display = "none";

    // Ensure link is in DOM before clicking
    document.body.appendChild(link);

    // Trigger the download
    link.click();

    // Cleanup with delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error("Standard download failed, trying fallback:", err);
    downloadTimesheetPdfFallback(pdfBytes, filename);
  }
}

/**
 * Fallback method 1: navigator.msSaveBlob (IE/Edge)
 */
function downloadTimesheetPdfFallback(pdfBytes: Uint8Array, filename: string) {
  // Fallback: Open in new window
  try {
    downloadTimesheetPdfOpenWindow(pdfBytes, filename);
  } catch (err) {
    console.error("All download methods failed:", err);
    throw new Error(
      "Unable to download PDF. Please check your browser settings.",
    );
  }
}

/**
 * Fallback method 2: Open PDF in new window
 * User can then save manually
 */
function downloadTimesheetPdfOpenWindow(
  pdfBytes: Uint8Array,
  filename: string,
) {
  const blob = new Blob([pdfBytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  // Set a data attribute so user can identify it
  const newWindow = window.open(url, "_blank");
  if (newWindow) {
    newWindow.document.title = filename;
  } else {
    throw new Error("Could not open window. Pop-ups may be blocked.");
  }
}

/**
 * Advanced version with detailed logging for debugging
 */
export function downloadTimesheetPdfWithLogging(
  pdfBytes: Uint8Array,
  filename: string,
) {
  console.group("📄 PDF Download Debug");
  console.log("Filename:", filename);
  console.log("PDF Size:", pdfBytes.length, "bytes");
  console.log("PDF Type:", pdfBytes.constructor.name);

  try {
    // Verify PDF is valid
    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error("PDF bytes are empty");
    }

    // Check for PDF magic number
    const header = String.fromCharCode(
      pdfBytes[0],
      pdfBytes[1],
      pdfBytes[2],
      pdfBytes[3],
    );
    console.log("PDF Header:", header);

    if (header !== "%PDF") {
      console.warn("⚠️ PDF header not found. File may be corrupted.");
    }

    // Create and verify blob
    const blob = new Blob([pdfBytes.slice().buffer], {
      type: "application/pdf",
    });
    console.log("Blob created:", blob.size, "bytes");

    // Create download link
    const url = URL.createObjectURL(blob);
    console.log("Object URL:", url.substring(0, 50) + "...");

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    // Append to DOM
    document.body.appendChild(link);
    console.log("Link added to DOM");

    // Trigger click
    link.click();
    console.log("✅ Download triggered");

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log("✅ Cleanup complete");
      console.groupEnd();
    }, 100);
  } catch (err) {
    console.error("❌ Error:", err);
    console.groupEnd();
    throw err;
  }
}

/**
 * Check if download is supported in current browser
 */
export function isDownloadSupported(): {
  supported: boolean;
  methods: string[];
  message: string;
} {
  const methods: string[] = [];

  // Check standard API
  if ("download" in document.createElement("a")) {
    methods.push("Standard HTML5 API");
  }

  // Check Blob API
  try {
    new Blob(["test"], { type: "application/pdf" });
    methods.push("Blob API");
  } catch (e) {
    console.warn("Blob API not supported");
  }

  // Check URL.createObjectURL
  if (typeof URL.createObjectURL === "function") {
    methods.push("URL.createObjectURL");
  }

  // msSaveBlob is not supported, removed for compatibility

  const supported = methods.length > 0;
  const message = supported
    ? `Download is supported via: ${methods.join(", ")}`
    : "Download may not work in this browser";

  return { supported, methods, message };
}

/**
 * Usage example in your component:
 *
 * import { downloadTimesheetPdf, isDownloadSupported } from "@/lib/generateTimesheetPdf";
 *
 * useEffect(() => {
 *   const check = isDownloadSupported();
 *   if (!check.supported) {
 *     console.warn(check.message);
 *   }
 * }, []);
 *
 * // In your button onClick:
 * onClick={async () => {
 *   try {
 *     setPdfGenerating(true);
 *     const pdfBytes = await generateTimesheetPdf(gridModel, metadata);
 *     downloadTimesheetPdf(pdfBytes, `timesheet-${startDate}.pdf`);
 *     toast.success("PDF downloaded");
 *   } catch (err) {
 *     console.error("PDF error:", err);
 *     toast.error("Failed to download PDF");
 *   } finally {
 *     setPdfGenerating(false);
 *   }
 * }}
 */
