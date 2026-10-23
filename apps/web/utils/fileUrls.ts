export function normalizeFileUrl(url: string): string {
  if (url.startsWith("local://")) return `mfr-local://${encodeURI(url.slice(8)).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
  if (url.startsWith("file://")) return `mfr-local://${url.slice(7)}`;
  if (url.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(url)) return `mfr-local://${encodeURI(url).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
  return url;
}

export function isLocalFileUrl(url: string): boolean {
  return /^(mfr-local|local|file):\/\//.test(url) || url.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(url);
}

export function getDocumentUrl(url: string): string {
  const normalized = normalizeFileUrl(url);
  if (/^(mfr-local|blob|data):/.test(normalized)) return normalized;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:2007";
  return `${backendUrl.replace(/\/$/, "")}/proxy?url=${encodeURIComponent(normalized)}`;
}

export function getFileName(url: string): string {
  const segment = url.split(/[?#]/)[0].split("/").pop() || "Untitled document";
  try { return decodeURIComponent(segment).replace(/^(?:\d{10,14}|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})-/i, ""); }
  catch { return segment; }
}

export function detectFileType(input: string): string {
  if (!input) return "unsupported";
  const mime = input.toLowerCase().split(";")[0];
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/epub+zip") return "epub";
  if (mime === "text/plain") return "txt";
  if (mime === "text/markdown") return "md";
  const extension = getFileName(input).toLowerCase().split(".").pop();
  if (extension === "pdf" || extension === "epub") return extension;
  if (["txt", "log", "csv", "tsv"].includes(extension || "")) return "txt";
  if (["md", "markdown"].includes(extension || "")) return "md";
  if (["json", "js", "jsx", "ts", "tsx", "py", "html", "css", "yaml", "yml", "sh", "sql"].includes(extension || "")) return "code";
  return "unsupported";
}
