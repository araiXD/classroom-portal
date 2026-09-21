import { api } from "./api.js";
import { el, fileNameOf, formatDate, makeMessage } from "./dom.js";
import { downloadButton, FILE_ACCEPT, FILE_HINT, uploadFile } from "./upload.js";

export async function mount(root) {
  const message = makeMessage();
  const listBox = el("div");

  let classes = [];
  let assignments = [];
  let submissionsByAssignment = new Map(); // assignment_id -> the caller's submission

  const showError = (err) => message.show(err.message, true);

  // Wrap an async UI handler so failures land in the message line.
  const guard = (action) => async (...args) => {
    try {
      await action(...args);
    } catch (err) {
      showError(err);
    }
  };

  // --- join a class ---------------------------------------------------------

  const codeInput = el("input", {
    name: "code",
    required: true,
    maxlength: 64,
    autocomplete: "off",
    placeholder: "Code from your teacher",
  });
  const joinForm = el(
    "form",
    {
      class: "inline",
      onsubmit: guard(async (e) => {
        e.preventDefault();
        const cls = await api.post("/classes/join", { code: codeInput.value });
        codeInput.value = "";
        message.show(`Joined "${cls.name}".`);
        await load();
      }),
    },
    el("label", {}, "Join code", codeInput),
    el("button", { type: "submit" }, "Join class"),
  );

  // --- classes, assignments, and my submissions -----------------------------

  async function load() {
    // The API scopes each list to this student (enrolled classes, own submissions).
    const [c, a, s] = await Promise.all([api.get("/classes"), api.get("/assignments"), api.get("/submissions")]);
    classes = c;
    assignments = a;
    submissionsByAssignment = new Map(s.map((sub) => [sub.assignment_id, sub]));
    render();
  }

  function render() {
    if (classes.length === 0) {
      listBox.replaceChildren(
        el("section", {}, el("p", { class: "muted" }, "You aren't in any classes yet. Enter a join code above.")),
      );
      return;
    }
    listBox.replaceChildren(
      ...classes.map((cls) => {
        const mine = assignments.filter((a) => a.class_id === cls.id);
        return el(
          "section",
          {},
          el("h2", {}, cls.name),
          mine.length === 0 ? el("p", { class: "muted" }, "No assignments yet.") : mine.map((a) => renderAssignment(a)),
        );
      }),
    );
  }

  function renderAssignment(a) {
    const existing = submissionsByAssignment.get(a.id);
    const textarea = el(
      "textarea",
      { name: "content", rows: 4, maxlength: 10000, placeholder: "Type your answer (or attach a file)" },
      existing?.content ?? "",
    );
    const fileInput = el("input", { name: "file", type: "file", accept: FILE_ACCEPT });

    const article = el(
      "article",
      { class: "assignment" },
      el("h3", {}, a.title),
      el("p", { class: "muted" }, a.due_date ? `Due ${formatDate(a.due_date)}` : "No due date"),
      a.description && el("p", { class: "pre" }, a.description),
      a.attachment_url && el("p", {}, downloadButton(`Attachment: ${fileNameOf(a.attachment_url)}`, `/assignments/${a.id}/attachment`, showError)),
      el(
        "p",
        { class: existing ? "status done" : "status" },
        existing ? `Submitted ${formatDate(existing.submitted_at)}` : "Not submitted",
      ),
      existing?.file_url && el("p", {}, downloadButton(`Your file: ${fileNameOf(existing.file_url)}`, `/submissions/${existing.id}/file`, showError)),
      el(
        "form",
        {
          onsubmit: guard(async (e) => {
            e.preventDefault();
            // Resubmitting without choosing a file keeps the file already submitted.
            let file_url = existing?.file_url ?? undefined;
            const file = fileInput.files[0];
            if (!textarea.value.trim() && !file && !file_url) {
              throw new Error("Add some text or attach a file.");
            }
            if (file) {
              message.show(`Uploading ${file.name}…`);
              file_url = await uploadFile(file, { kind: "submission", assignment_id: a.id });
            }
            const saved = await api.post("/submissions", { assignment_id: a.id, content: textarea.value, file_url });
            submissionsByAssignment.set(a.id, saved);
            article.replaceWith(renderAssignment(a)); // only this card, so other drafts survive
            message.show(`Submitted "${a.title}".`);
          }),
        },
        textarea,
        el("label", {}, existing?.file_url ? `Replace your file (optional): ${FILE_HINT}` : `File (optional): ${FILE_HINT}`, fileInput),
        el("button", { type: "submit" }, existing ? "Resubmit" : "Submit"),
      ),
    );
    return article;
  }

  root.replaceChildren(message.node, el("section", {}, el("h2", {}, "Join a class"), joinForm), listBox);
  await guard(load)();
}
