const homeScreen = document.getElementById("homeScreen");
const agendaScreen = document.getElementById("agendaScreen");
const enterButton = document.getElementById("enterButton");
const backButton = document.getElementById("backButton");
const contactForm = document.getElementById("contactForm");
const contactsList = document.getElementById("contactsList");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const downloadExcelButton = document.getElementById("downloadExcelButton");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const tableWrap = document.getElementById("tableWrap");
const tableCount = document.getElementById("tableCount");
const voiceStatus = document.getElementById("voiceStatus");

const fields = [
  { key: "name", label: "Nombre" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "otherOne", label: "Otros 1" },
  { key: "otherTwo", label: "Otros 2" }
];

const storageKey = "personal-agenda-contacts";
let contacts = JSON.parse(localStorage.getItem(storageKey) || "[]");
let editingContactId = null;
let activeRecognition = null;

const spokenPhoneNumbers = {
  cero: "0",
  uno: "1",
  una: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9"
};

function createContactId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveContacts() {
  localStorage.setItem(storageKey, JSON.stringify(contacts));
}

function setFormMode(contact = null) {
  editingContactId = contact ? contact.id : null;
  saveButton.textContent = contact ? "Actualizar" : "Guardar";
  cancelEditButton.hidden = !contact;

  if (!contact) {
    contactForm.reset();
    return;
  }

  fields.forEach(({ key }) => {
    contactForm.elements[key].value = contact[key] || "";
  });
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

function normalizePhoneText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g, (match) => spokenPhoneNumbers[match])
    .replace(/\b(mas|plus)\b/g, "+")
    .replace(/[^\d+]/g, "");
}

function getPhoneHref(phone) {
  const normalizedPhone = normalizePhoneText(phone);
  return normalizedPhone ? `tel:${normalizedPhone}` : "";
}

function createCallLink(phone) {
  const phoneHref = getPhoneHref(phone);

  if (!phoneHref) {
    return null;
  }

  const callLink = document.createElement("a");
  callLink.className = "call-link";
  callLink.href = phoneHref;
  callLink.textContent = "Llamar";
  return callLink;
}

function startVoiceInput(fieldKey) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = contactForm.elements[fieldKey];

  if (!SpeechRecognition) {
    voiceStatus.textContent = "Tu navegador no permite dictado por voz. Prueba con Chrome o Edge.";
    return;
  }

  if (activeRecognition) {
    activeRecognition.stop();
  }

  const recognition = new SpeechRecognition();
  const field = fields.find((item) => item.key === fieldKey);

  activeRecognition = recognition;
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voiceStatus.textContent = `Escuchando ${field.label.toLowerCase()}...`;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();
    input.value = fieldKey === "phone" ? normalizePhoneText(transcript) : transcript;
    input.focus();
    voiceStatus.textContent = `${field.label} escrito por voz.`;
  });

  recognition.addEventListener("error", () => {
    voiceStatus.textContent = "No se pudo recoger la voz. Intentalo de nuevo.";
  });

  recognition.addEventListener("end", () => {
    activeRecognition = null;
  });

  try {
    recognition.start();
  } catch (error) {
    activeRecognition = null;
    voiceStatus.textContent = "No se pudo iniciar el microfono. Revisa los permisos del navegador.";
  }
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

function deleteContact(contact) {
  contacts = contacts.filter((item) => item.id !== contact.id);
  if (editingContactId === contact.id) {
    setFormMode();
  }
  saveContacts();
  renderContacts();
}

function editContact(contact) {
  setFormMode(contact);
  contactForm.scrollIntoView({ behavior: "smooth", block: "start" });
  contactForm.elements.name.focus();
}

function renderDataTable(visibleContacts) {
  tableWrap.innerHTML = "";
  tableCount.textContent = `${visibleContacts.length} registro${visibleContacts.length === 1 ? "" : "s"}`;

  if (visibleContacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = contacts.length === 0 ? "No hay datos recogidos." : "No hay datos con esos filtros.";
    tableWrap.append(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "contacts-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  fields.forEach(({ label }) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  });
  const actionsHeader = document.createElement("th");
  actionsHeader.scope = "col";
  actionsHeader.textContent = "Acciones";
  headerRow.append(actionsHeader);
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  visibleContacts.forEach((contact) => {
    const row = document.createElement("tr");

    fields.forEach(({ key }) => {
      const td = document.createElement("td");

      if (key === "phone" && contact[key]) {
        const phoneGroup = document.createElement("div");
        phoneGroup.className = "phone-cell";
        const phoneValue = document.createElement("span");
        phoneValue.textContent = contact[key];
        const callLink = createCallLink(contact[key]);
        phoneGroup.append(phoneValue);
        if (callLink) {
          phoneGroup.append(callLink);
        }
        td.append(phoneGroup);
      } else {
        td.textContent = contact[key] || "-";
      }

      row.append(td);
    });

    const actions = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "table-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "Modificar";
    editButton.addEventListener("click", () => editContact(contact));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Borrar";
    deleteButton.addEventListener("click", () => deleteContact(contact));

    actionGroup.append(editButton, deleteButton);
    actions.append(actionGroup);
    row.append(actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  tableWrap.append(table);
}

function renderContacts() {
  const visibleContacts = getVisibleContacts();
  contactsList.innerHTML = "";
  downloadExcelButton.disabled = visibleContacts.length === 0;
  renderDataTable(visibleContacts);

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
      if (key === "phone") {
        const callLink = createCallLink(contact[key]);
        if (callLink) {
          field.append(callLink);
        }
      }
      card.append(field);
    });

    const cardActions = document.createElement("div");
    cardActions.className = "contact-card-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "Modificar";
    editButton.addEventListener("click", () => editContact(contact));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Borrar";
    deleteButton.addEventListener("click", () => deleteContact(contact));

    cardActions.append(editButton, deleteButton);
    card.append(cardActions);
    contactsList.append(card);
  });
}

enterButton.addEventListener("click", () => showScreen("agenda"));
backButton.addEventListener("click", () => showScreen("home"));

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const contact = {
    id: editingContactId || createContactId(),
    name: formData.get("name").trim(),
    phone: normalizePhoneText(formData.get("phone")),
    email: formData.get("email").trim(),
    otherOne: formData.get("otherOne").trim(),
    otherTwo: formData.get("otherTwo").trim()
  };

  if (editingContactId) {
    contacts = contacts.map((item) => (item.id === editingContactId ? contact : item));
  } else {
    contacts.unshift(contact);
  }

  saveContacts();
  setFormMode();
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
cancelEditButton.addEventListener("click", () => {
  setFormMode();
});
document.querySelectorAll("[data-voice-target]").forEach((button) => {
  button.addEventListener("click", () => startVoiceInput(button.dataset.voiceTarget));
});

renderContacts();
