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

// A dismissible pop-up in the corner of the page. Clicking it dismisses it and
// runs onClick; it also disappears on its own after a few seconds.
export function showToast(text, onClick) {
  let box = document.querySelector(".toasts");
  if (!box) {
    box = el("div", { class: "toasts", "aria-live": "polite" });
    document.body.append(box);
  }
  const toast = el("div", { class: "toast", role: "status" }, text);
  toast.addEventListener("click", () => {
    toast.remove();
    onClick?.();
  });
  box.append(toast);
  setTimeout(() => toast.remove(), 8000);
}

// The file name at the end of an S3 object key ("attachments/…/<random>/notes.pdf").
export function fileNameOf(key) {
  return key.slice(key.lastIndexOf("/") + 1);
}
