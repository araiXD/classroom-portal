// Tiny DOM helpers. Everything user-supplied goes in as text nodes (never
// innerHTML), so names, titles and submission text can't inject markup.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

// A status line for success/error feedback: `const { node, show } = makeMessage()`.
export function makeMessage() {
  const node = el("p", { class: "message", role: "status" });
  const show = (text, isError = false) => {
    node.textContent = text;
    node.className = isError ? "message error" : "message";
    node.scrollIntoView?.({ block: "nearest" });
  };
  return { node, show };
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString();
}
