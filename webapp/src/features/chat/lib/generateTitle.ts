export function generateTitle(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 30 ? words.substring(0, 27) + "..." : words;
}
