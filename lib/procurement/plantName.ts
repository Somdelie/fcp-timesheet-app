export function canonicalPlantName(name: string) {
  const canonical = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length > 4 && word.endsWith("ies")) {
        return `${word.slice(0, -3)}y`;
      }
      if (
        word.length > 3 &&
        word.endsWith("s") &&
        !word.endsWith("ss") &&
        !word.endsWith("us") &&
        !word.endsWith("is")
      ) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");

  if (canonical === "extension") return "extension cable";
  if (
    canonical === "single extension ladder" ||
    canonical === "double extension ladder"
  ) {
    return "extension ladder";
  }

  return canonical;
}
