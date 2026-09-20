import { api } from "./api.js";
import { el, formatDate, makeMessage, showToast } from "./dom.js";
import { connectLive } from "./live.js";

export async function mount(root) {
  const message = makeMessage();
  const classesBox = el("section");
  const classBox = el("section");
  const submissionsBox = el("section");

  let classes = [];
  let selectedClass = null;
  let assignments = [];
  let selectedAssignment = null;
  let assignmentList = null; // kept between renders so the "post" form below it keeps its text

  // Live submissions for assignments the teacher isn't looking at: assignment_id -> { classId, count }.
  const unread = new Map();
  const classUnread = (classId) => [...unread.values()].reduce((n, u) => n + (u.classId === classId ? u.count : 0), 0);
  const badge = (count) => count > 0 && el("span", { class: "badge" }, `${count} new`);

  // Wrap an async UI handler so failures land in the message line.
  const guard = (action) => async (...args) => {
    try {
      await action(...args);
    } catch (err) {
      message.show(err.message, true);
    }
  };

  // --- create a class -------------------------------------------------------

  const nameInput = el("input", { name: "name", required: true, maxlength: 100, placeholder: "e.g. Period 3 Biology" });
  const createForm = el(
    "form",
    {
      class: "inline",
      onsubmit: guard(async (e) => {
        e.preventDefault();
        const cls = await api.post("/classes", { name: nameInput.value });
        nameInput.value = "";
        message.show(`Created "${cls.name}".`);
        await loadClasses();
        await selectClass(cls);
      }),
    },
    el("label", {}, "Class name", nameInput),
    el("button", { type: "submit" }, "Create class"),
  );

  // --- classes list ---------------------------------------------------------

  async function loadClasses() {
    classes = await api.get("/classes");
    renderClasses();
  }

  function renderClasses() {
    classesBox.replaceChildren(
      el("h2", {}, "Your classes"),
      classes.length === 0
        ? el("p", { class: "muted" }, "No classes yet. Create one above.")
        : el(
            "ul",
            { class: "items" },
            classes.map((cls) =>
              el(
                "li",
                { class: cls.id === selectedClass?.id ? "selected" : null },
                el("strong", {}, cls.name),
                badge(classUnread(cls.id)),
                " ",
                el("span", { class: "muted" }, "Join code: ", el("code", {}, cls.join_code)),
                " ",
                el("button", { type: "button", class: "secondary", onclick: guard(() => selectClass(cls)) }, "Open"),
              ),
            ),
          ),
    );
  }

  async function selectClass(cls) {
    const list = await api.get(`/assignments?class_id=${cls.id}`);
    selectedClass = cls;
    assignments = list;
    selectedAssignment = null;
    renderClasses();
    renderClass();
    renderSubmissions();
  }

  // --- selected class: assignments + post form ------------------------------

  function renderClass() {
    const cls = selectedClass;
    const titleInput = el("input", { name: "title", required: true, maxlength: 200 });
    const descInput = el("textarea", { name: "description", rows: 3, maxlength: 5000 });
    const dueInput = el("input", { name: "due_date", type: "datetime-local" });

    const form = el(
      "form",
      {
        onsubmit: guard(async (e) => {
          e.preventDefault();
          const body = { class_id: cls.id, title: titleInput.value };
          if (descInput.value.trim()) body.description = descInput.value;
          if (dueInput.value) body.due_date = new Date(dueInput.value).toISOString(); // local time -> UTC
          const posted = await api.post("/assignments", body);
          form.reset();
          message.show(`Posted "${posted.title}".`);
          const list = await api.get(`/assignments?class_id=${cls.id}`);
          if (selectedClass === cls) {
            assignments = list;
            fillAssignmentList();
          }
        }),
      },
      el("h3", {}, "Post an assignment"),
      el("label", {}, "Title", titleInput),
      el("label", {}, "Description (optional)", descInput),
      el("label", {}, "Due (optional)", dueInput),
      el("button", { type: "submit" }, "Post assignment"),
    );

    assignmentList = el("div");
    fillAssignmentList();

    classBox.replaceChildren(
      el("h2", {}, cls.name),
      el("p", {}, "Students join with code ", el("code", {}, cls.join_code), "."),
      el("h3", {}, "Assignments"),
      assignmentList,
      form,
    );
  }

  function fillAssignmentList() {
    assignmentList.replaceChildren(
      assignments.length === 0
        ? el("p", { class: "muted" }, "No assignments yet.")
        : el(
            "ul",
            { class: "items" },
            assignments.map((a) =>
              el(
                "li",
                { class: a.id === selectedAssignment?.id ? "selected" : null },
                el("strong", {}, a.title),
                badge(unread.get(a.id)?.count ?? 0),
                " ",
                el("span", { class: "muted" }, a.due_date ? `Due ${formatDate(a.due_date)}` : "No due date"),
                a.description && el("p", { class: "pre" }, a.description),
                el("button", { type: "button", class: "secondary", onclick: guard(() => selectAssignment(a)) }, "View submissions"),
              ),
            ),
          ),
    );
  }

  // --- selected assignment: submissions -------------------------------------

  async function selectAssignment(a) {
    const submissions = await api.get(`/submissions?assignment_id=${a.id}`);
    selectedAssignment = a;
    unread.delete(a.id);
    renderClasses();
    fillAssignmentList();
    renderSubmissions(submissions);
  }

  function renderSubmissions(submissions = []) {
    if (!selectedAssignment) return submissionsBox.replaceChildren();
    const a = selectedAssignment;
    submissionsBox.replaceChildren(
      el("h2", {}, `Submissions: ${a.title}`),
      el("button", { type: "button", class: "secondary", onclick: guard(() => selectAssignment(a)) }, "Refresh"),
      submissions.length === 0
        ? el("p", { class: "muted" }, "No submissions yet.")
        : el(
            "ul",
            { class: "items" },
            submissions.map((s) =>
              el(
                "li",
                {},
                el("strong", {}, s.student?.full_name ?? "Unknown student"),
                " ",
                el("span", { class: "muted" }, `Submitted ${formatDate(s.submitted_at)}`),
                el("p", { class: "pre" }, s.content ?? "(no text)"),
              ),
            ),
          ),
    );
  }

  // --- live notifications ---------------------------------------------------

  const liveStatus = el("p", { class: "live" });
  let wasOffline = false;

  function onLiveStatus(state) {
    const labels = { live: "● Live updates on", connecting: "○ Live updates: connecting…", offline: "○ Live updates off, retrying…" };
    liveStatus.textContent = labels[state];
    liveStatus.className = state === "live" ? "live on" : "live";
    if (state === "offline") {
      wasOffline = true;
    } else if (state === "live" && wasOffline) {
      // Anything submitted while we were disconnected wasn't pushed; catch up on what's open.
      wasOffline = false;
      if (selectedAssignment) guard(() => selectAssignment(selectedAssignment))();
    }
  }

  async function onLiveMessage(msg) {
    if (msg.type !== "submission") return;
    if (selectedAssignment?.id === msg.assignment_id) {
      await selectAssignment(selectedAssignment); // already looking at it: show it right away
    } else {
      const entry = unread.get(msg.assignment_id) ?? { classId: msg.class_id, count: 0 };
      entry.count += 1;
      unread.set(msg.assignment_id, entry);
      renderClasses();
      if (selectedClass?.id === msg.class_id) fillAssignmentList();
    }
    showToast(`${msg.student_name} submitted "${msg.assignment_title}" (${msg.class_name})`, guard(() => openSubmissions(msg)));
  }

  // Jump to a submission's assignment (used when a toast is clicked).
  async function openSubmissions({ class_id, assignment_id }) {
    if (selectedClass?.id !== class_id) {
      const cls = classes.find((c) => c.id === class_id);
      if (!cls) return;
      await selectClass(cls);
    }
    const assignment = assignments.find((a) => a.id === assignment_id);
    if (assignment) await selectAssignment(assignment);
  }

  root.replaceChildren(
    liveStatus,
    message.node,
    el("section", {}, el("h2", {}, "Create a class"), createForm),
    classesBox,
    classBox,
    submissionsBox,
  );
  await guard(loadClasses)();
  connectLive({ onStatus: onLiveStatus, onMessage: guard(onLiveMessage) });
}
