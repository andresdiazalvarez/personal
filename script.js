const homeScreen = document.getElementById("homeScreen");
const agendaScreen = document.getElementById("agendaScreen");
const enterButton = document.getElementById("enterButton");
const backButton = document.getElementById("backButton");
const contactForm = document.getElementById("contactForm");
const contactsList = document.getElementById("contactsList");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const downloadExcelButton = document.getElementById("downloadExcelButton");

const fields = [
  { key: "name", label: "Nombre" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "otherOne", label: "Otros 1" },
  { key: "otherTwo", label: "Otros 2" }
];

const storageKey = "personal-agenda-contacts";
let contacts = JSON.parse(localStorage.getItem(storageKey) || "[]");

function createContactId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveContacts() {
  localStorage.setItem(storageKey, JSON.stringify(contacts));
}

function showScreen(screen) {
  homeScreen.classList.toggle("is-active", screen === "home");
  agendaScreen.classList.toggle("is-active", screen === "agenda");
}

function getSearchValues() {
  return Object.fromEntries(
    [...document.querySelectorAll("[data-search]")].map((input) => [
      input.dataset.search,
      input.value.trim().toLowerCase()
    ])
  );
}

function getFilterValues() {
  return Object.fromEntries(
    [...document.querySelectorAll("[data-filter]")].map((select) => [
      select.dataset.filter,
      select.value
    ])
  );
}

function matchesTools(contact) {
  const searches = getSearchValues();
  const filters = getFilterValues();

  return fields.every(({ key }) => {
    const value = (contact[key] || "").trim();
    const normalizedValue = value.toLowerCase();
    const matchesSearch = !searches[key] || normalizedValue.includes(searches[key]);
    const matchesFilter =
      filters[key] === "all" ||
      (filters[key] === "filled" && value.length > 0) ||
      (filters[key] === "empty" && value.length === 0);

    return matchesSearch && matchesFilter;
  });
}

function getVisibleContacts() {
  return contacts.filter(matchesTools);
}

function escapeExcelCell(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadExcel() {
  const visibleContacts = getVisibleContacts();

  if (visibleContacts.length === 0) {
    return;
  }

  const headerCells = fields.map(({ label }) => `<th>${escapeExcelCell(label)}</th>`).join("");
  const rows = visibleContacts
    .map((contact) => {
      const cells = fields.map(({ key }) => `<td>${escapeExcelCell(contact[key])}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const excelHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `personal-agenda-${date}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderContacts() {
  const visibleContacts = getVisibleContacts();
  contactsList.innerHTML = "";
  downloadExcelButton.disabled = visibleContacts.length === 0;

  if (visibleContacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = contacts.length === 0 ? "No hay contactos guardados." : "No hay contactos con esos filtros.";
    contactsList.append(empty);
    return;
  }

  visibleContacts.forEach((contact) => {
    const card = document.createElement("article");
    card.className = "contact-card";

    fields.forEach(({ key, label }) => {
      const field = document.createElement("div");
      field.className = "contact-field";

      const fieldLabel = document.createElement("span");
      fieldLabel.className = "contact-label";
      fieldLabel.textContent = label;

      const value = document.createElement("span");
      value.className = "contact-value";
      value.textContent = contact[key] || "—";

      field.append(fieldLabel, value);
      card.append(field);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Borrar";
    deleteButton.addEventListener("click", () => {
      contacts = contacts.filter((item) => item.id !== contact.id);
      saveContacts();
      renderContacts();
    });

    card.append(deleteButton);
    contactsList.append(card);
  });
}

enterButton.addEventListener("click", () => showScreen("agenda"));
backButton.addEventListener("click", () => showScreen("home"));

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const contact = {
    id: createContactId(),
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    email: formData.get("email").trim(),
    otherOne: formData.get("otherOne").trim(),
    otherTwo: formData.get("otherTwo").trim()
  };

  contacts.unshift(contact);
  saveContacts();
  contactForm.reset();
  renderContacts();
});

document.querySelectorAll("[data-search], [data-filter]").forEach((control) => {
  control.addEventListener("input", renderContacts);
  control.addEventListener("change", renderContacts);
});

clearFiltersButton.addEventListener("click", () => {
  document.querySelectorAll("[data-search]").forEach((input) => {
    input.value = "";
  });
  document.querySelectorAll("[data-filter]").forEach((select) => {
    select.value = "all";
  });
  renderContacts();
});

downloadExcelButton.addEventListener("click", downloadExcel);

renderContacts();
