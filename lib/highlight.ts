function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function highlightCode(code: string, filename: string = ""): string {
  let escaped = escapeHtml(code);

  // JSX / HTML tags
  escaped = escaped.replace(
    /(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)/g,
    '$1<span class="text-[#e8a06e] font-medium">$2</span>'
  );

  // Attributes and string literals
  escaped = escaped.replace(
    /([a-zA-Z][a-zA-Z0-9-]*)(=)("[^"]*"|'[^']*'|\{[^}]*\})/g,
    '<span class="text-[#7dd3fc]">$1</span>$2<span class="text-[#86efac]">$3</span>'
  );

  // Keywords
  escaped = escaped.replace(
    /\b(import|export|default|from|function|const|let|var|return|if|else|interface|type|extends|as|async|await)\b/g,
    '<span class="text-[#c084fc] font-medium">$1</span>'
  );

  // React hooks
  escaped = escaped.replace(
    /\b(useState|useEffect|useMemo|useCallback|useRef|useContext)\b/g,
    '<span class="text-[#f472b6]">$1</span>'
  );

  return escaped;
}

export function highlightHtml(code: string): string {
  return highlightCode(code, "index.html");
}
