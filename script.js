const homeScreen = document.getElementById("homeScreen");
const agendaScreen = document.getElementById("agendaScreen");
const textScreen = document.getElementById("textScreen");
const enterButton = document.getElementById("enterButton");
const enterTextButton = document.getElementById("enterTextButton");
const backButton = document.getElementById("backButton");
const textBackButton = document.getElementById("textBackButton");
const contactForm = document.getElementById("contactForm");
const contactsList = document.getElementById("contactsList");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const downloadExcelButton = document.getElementById("downloadExcelButton");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const tableWrap = document.getElementById("tableWrap");
const tableCount = document.getElementById("tableCount");
const voiceStatus = document.getElementById("voiceStatus");
const phoneInput = document.getElementById("phoneInput");
const textForm = document.getElementById("textForm");
const textDateInput = document.getElementById("textDateInput");
const textVoiceStatus = document.getElementById("textVoiceStatus");
const textList = document.getElementById("textList");
const textCount = document.getElementById("textCount");
const saveTextButton = document.getElementById("saveTextButton");
const newTextButton = document.getElementById("newTextButton");
const cancelTextEditButton = document.getElementById("cancelTextEditButton");
const downloadWordButton = document.getElementById("downloadWordButton");
const clearTextFiltersButton = document.getElementById("clearTextFiltersButton");
const textCameraInput = document.getElementById("textCameraInput");
const textGalleryInput = document.getElementById("textGalleryInput");
const textPhotoPreview = document.getElementById("textPhotoPreview");
const textPhotoStatus = document.getElementById("textPhotoStatus");

const fields = [
  { key: "name", label: "Nombre" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "otherOne", label: "Otros 1" },
  { key: "otherTwo", label: "Otros 2" }
];

const storageKey = "personal-agenda-contacts";
const textStorageKey = "personal-text-records";
let contacts = JSON.parse(localStorage.getItem(storageKey) || "[]");
let textRecords = JSON.parse(localStorage.getItem(textStorageKey) || "[]");
let editingContactId = null;
let editingTextId = null;
let activeRecognition = null;
let phoneVoiceTimer = null;
let phoneInputTimer = null;
let textVoiceTimer = null;
let textVoiceStopRequested = false;
let redactionPhraseTimer = null;
let pendingRedactionParts = [];
let currentTextPhotos = [];

const textDictationSilenceMs = 10000;
const redactionPhraseDelayMs = 5000;
const maxTextPhotos = 4;

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

function saveTextRecords() {
  localStorage.setItem(textStorageKey, JSON.stringify(textRecords));
}

function updateTextPhotoStatus(message = "") {
  const remainingPhotos = maxTextPhotos - currentTextPhotos.length;
  textPhotoStatus.textContent = message || `${currentTextPhotos.length} foto${currentTextPhotos.length === 1 ? "" : "s"} cargada${currentTextPhotos.length === 1 ? "" : "s"}. Puedes añadir ${remainingPhotos} más.`;
}

function renderTextPhotoPreview() {
  textPhotoPreview.innerHTML = "";

  if (currentTextPhotos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "photo-empty";
    empty.textContent = "Sin fotos cargadas.";
    textPhotoPreview.append(empty);
    updateTextPhotoStatus("Puedes cargar hasta 4 fotos.");
    return;
  }

  currentTextPhotos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "photo-preview-item";

    const image = document.createElement("img");
    image.src = photo.dataUrl;
    image.alt = photo.name || `Foto ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Quitar";
    removeButton.addEventListener("click", () => {
      currentTextPhotos = currentTextPhotos.filter((_, photoIndex) => photoIndex !== index);
      renderTextPhotoPreview();
    });

    item.append(image, removeButton);
    textPhotoPreview.append(item);
  });

  updateTextPhotoStatus();
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

async function resizePhoto(file) {
  const originalDataUrl = await readImageAsDataUrl(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = originalDataUrl;
  });

  const maxSize = 900;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    id: createContactId(),
    name: file.name || "foto.jpg",
    dataUrl: canvas.toDataURL("image/jpeg", 0.72)
  };
}

async function addTextPhotos(files) {
  const availableSlots = maxTextPhotos - currentTextPhotos.length;
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/")).slice(0, availableSlots);

  if (availableSlots <= 0) {
    updateTextPhotoStatus("Ya hay 4 fotos cargadas. Quita una para añadir otra.");
    return;
  }

  if (imageFiles.length === 0) {
    updateTextPhotoStatus("No se ha seleccionado ninguna imagen.");
    return;
  }

  textPhotoStatus.textContent = "Preparando fotos...";

  try {
    const resizedPhotos = await Promise.all(imageFiles.map(resizePhoto));
    currentTextPhotos = [...currentTextPhotos, ...resizedPhotos].slice(0, maxTextPhotos);
    renderTextPhotoPreview();
  } catch (error) {
    updateTextPhotoStatus("No se pudo cargar alguna foto. Prueba con otra imagen.");
  }
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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

function setTextFormMode(record = null) {
  editingTextId = record ? record.id : null;
  saveTextButton.textContent = record ? "Actualizar texto" : "Guardar texto";
  cancelTextEditButton.hidden = !record;

  if (!record) {
    textForm.reset();
    currentTextPhotos = [];
    renderTextPhotoPreview();
    textDateInput.value = formatDateTime();
    return;
  }

  textForm.elements.textName.value = record.name || "";
  textDateInput.value = record.date || "";
  textForm.elements.redaction.value = record.redaction || "";
  currentTextPhotos = Array.isArray(record.photos) ? [...record.photos].slice(0, maxTextPhotos) : [];
  renderTextPhotoPreview();
}

function showScreen(screen) {
  homeScreen.classList.toggle("is-active", screen === "home");
  agendaScreen.classList.toggle("is-active", screen === "agenda");
  textScreen.classList.toggle("is-active", screen === "text");

  if (screen === "text" && !editingTextId) {
    textDateInput.value = formatDateTime();
  }
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

function escapeHtml(value) {
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

function getLastPhoneDigit(value) {
  const normalizedPhone = normalizePhoneText(value);
  return normalizedPhone ? normalizedPhone.slice(-1) : "";
}

function finishPhoneVoiceInput(input, recognition) {
  input.value = normalizePhoneText(input.value);
  voiceStatus.textContent = "Telefono escrito por voz.";
  phoneVoiceTimer = null;

  if (activeRecognition === recognition) {
    recognition.stop();
  }
}

function clearTextVoiceTimer() {
  if (textVoiceTimer) {
    clearTimeout(textVoiceTimer);
    textVoiceTimer = null;
  }
}

function waitForTextSilence(recognition, statusElement, message) {
  clearTextVoiceTimer();
  textVoiceStopRequested = false;
  textVoiceTimer = setTimeout(() => {
    textVoiceTimer = null;
    textVoiceStopRequested = true;
    statusElement.textContent = message;

    if (activeRecognition === recognition) {
      recognition.stop();
    }
  }, textDictationSilenceMs);
}

function appendDictatedText(input, transcript) {
  const cleanTranscript = transcript.trimStart();

  if (!cleanTranscript.trim()) {
    return;
  }

  const currentValue = input.value;
  const needsSpace =
    currentValue.trim().length > 0 &&
    !/\s$/.test(currentValue) &&
    !/^[,.;:!?)]/.test(cleanTranscript) &&
    !/[¿¡(]$/.test(currentValue);

  input.value = `${currentValue}${needsSpace ? " " : ""}${cleanTranscript}`;
}

function capitalizeFirstLetter(value) {
  return value.replace(/^(\s*)([a-záéíóúüñ])/i, (match, space, letter) => `${space}${letter.toUpperCase()}`);
}

function ensurePeriodBeforeParagraph(value) {
  const trimmedValue = value.trimEnd();

  if (!trimmedValue) {
    return "";
  }

  return /[.!?]$/.test(trimmedValue) ? trimmedValue : `${trimmedValue}.`;
}

function appendRedactionTranscript(input, transcript) {
  const parts = transcript
    .split(/\baparte\b/gi)
    .map((part) => part.trim().replace(/^[.,;:!?]+|[.,;:!?]+$/g, ""));

  parts.forEach((part, index) => {
    if (part) {
      appendDictatedText(input, `${capitalizeFirstLetter(part)}.`);
    }

    if (index < parts.length - 1) {
      input.value = `${ensurePeriodBeforeParagraph(input.value)}\n\n`;
    }
  });
}

function flushPendingRedaction(input, recognition = null) {
  if (redactionPhraseTimer) {
    clearTimeout(redactionPhraseTimer);
    redactionPhraseTimer = null;
  }

  const transcript = pendingRedactionParts.join(" ").trim();
  pendingRedactionParts = [];

  if (recognition && activeRecognition === recognition) {
    textVoiceStopRequested = true;
    recognition.stop();
  }

  if (transcript) {
    appendRedactionTranscript(input, transcript);
  }
}

function queueRedactionTranscript(input, transcript, recognition) {
  pendingRedactionParts.push(transcript);

  if (redactionPhraseTimer) {
    clearTimeout(redactionPhraseTimer);
  }

  redactionPhraseTimer = setTimeout(() => {
    flushPendingRedaction(input, recognition);
    textVoiceStatus.textContent = "Redacción escrita. Pulsa Voz redacción para seguir.";
  }, redactionPhraseDelayMs);
}

function startVoiceInput(fieldKey) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = contactForm.elements[fieldKey];
  const isPhoneField = fieldKey === "phone";
  const processedResultIndexes = new Set();

  if (!SpeechRecognition) {
    voiceStatus.textContent = "Tu navegador no permite dictado por voz. Prueba con Chrome o Edge.";
    return;
  }

  if (activeRecognition) {
    activeRecognition.stop();
  }
  if (phoneVoiceTimer) {
    clearTimeout(phoneVoiceTimer);
    phoneVoiceTimer = null;
  }
  if (phoneInputTimer) {
    clearTimeout(phoneInputTimer);
    phoneInputTimer = null;
  }
  clearTextVoiceTimer();

  const recognition = new SpeechRecognition();
  const field = fields.find((item) => item.key === fieldKey);

  activeRecognition = recognition;
  recognition.lang = "es-ES";
  recognition.continuous = true;
  recognition.interimResults = isPhoneField;
  recognition.maxAlternatives = 1;
  voiceStatus.textContent = isPhoneField
    ? "Di los numeros uno a uno. Termino tras 3 segundos sin oir otro numero."
    : `Escuchando ${field.label.toLowerCase()}... termina tras 10 segundos de silencio.`;
  if (isPhoneField) {
    input.value = normalizePhoneText(input.value);
    input.blur();
  }

  recognition.addEventListener("result", (event) => {
    if (isPhoneField) {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (!event.results[index].isFinal || processedResultIndexes.has(index)) {
          continue;
        }

        processedResultIndexes.add(index);
        const digit = getLastPhoneDigit(event.results[index][0].transcript);

        if (digit) {
          input.value += digit;
        }
      }

      input.value = normalizePhoneText(input.value);
      voiceStatus.textContent = "Numero recogido. Di el siguiente o espera 3 segundos para terminar.";

      if (phoneVoiceTimer) {
        clearTimeout(phoneVoiceTimer);
      }

      phoneVoiceTimer = setTimeout(() => {
        finishPhoneVoiceInput(input, recognition);
      }, 3000);
      return;
    }

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (!event.results[index].isFinal || processedResultIndexes.has(index)) {
        continue;
      }

      processedResultIndexes.add(index);
      appendDictatedText(input, event.results[index][0].transcript);
    }

    voiceStatus.textContent = `${field.label} escrito por voz. Esperando 10 segundos de silencio.`;
    waitForTextSilence(recognition, voiceStatus, `${field.label} escrito por voz.`);
  });

  recognition.addEventListener("error", () => {
    voiceStatus.textContent = "No se pudo recoger la voz. Intentalo de nuevo.";
  });

  recognition.addEventListener("end", () => {
    if (isPhoneField) {
      input.value = normalizePhoneText(input.value);
    }
    if (!isPhoneField && phoneVoiceTimer) {
      clearTimeout(phoneVoiceTimer);
      phoneVoiceTimer = null;
    }
    if (!isPhoneField) {
      if (textVoiceTimer && !textVoiceStopRequested) {
        try {
          processedResultIndexes.clear();
          recognition.start();
          activeRecognition = recognition;
          return;
        } catch (error) {
          voiceStatus.textContent = "El dictado se ha detenido antes de los 10 segundos. Puedes pulsar Voz para continuar.";
        }
      }
      clearTextVoiceTimer();
    }
    textVoiceStopRequested = false;
    activeRecognition = null;
  });

  try {
    recognition.start();
  } catch (error) {
    activeRecognition = null;
    voiceStatus.textContent = "No se pudo iniciar el microfono. Revisa los permisos del navegador.";
  }
}

function startTextVoiceInput(fieldKey) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = textForm.elements[fieldKey];
  const isRedaction = fieldKey === "redaction";
  const processedResultIndexes = new Set();

  if (!SpeechRecognition) {
    textVoiceStatus.textContent = "Tu navegador no permite dictado por voz. Prueba con Chrome o Edge.";
    return;
  }

  if (activeRecognition) {
    activeRecognition.stop();
  }
  clearTextVoiceTimer();
  if (isRedaction) {
    flushPendingRedaction(input);
  }

  const recognition = new SpeechRecognition();
  activeRecognition = recognition;
  recognition.lang = "es-ES";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  textVoiceStatus.textContent = isRedaction
    ? "Escuchando redacción... termina tras 10 segundos de silencio."
    : "Escuchando nombre... termina tras 10 segundos de silencio.";

  recognition.addEventListener("result", (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (!event.results[index].isFinal || processedResultIndexes.has(index)) {
        continue;
      }

      processedResultIndexes.add(index);
      if (isRedaction) {
        queueRedactionTranscript(input, event.results[index][0].transcript, recognition);
      } else {
        appendDictatedText(input, event.results[index][0].transcript);
      }
    }

    textVoiceStatus.textContent = isRedaction
      ? "Redacción recogida. Espero 5 segundos por si sigues la frase."
      : "Nombre escrito por voz. Esperando 10 segundos de silencio.";
    waitForTextSilence(
      recognition,
      textVoiceStatus,
      isRedaction ? "Redacción terminada por voz." : "Nombre escrito por voz."
    );
  });

  recognition.addEventListener("error", () => {
    textVoiceStatus.textContent = "No se pudo recoger la voz. Intentalo de nuevo.";
  });

  recognition.addEventListener("end", () => {
    if (!isRedaction && textVoiceTimer && !textVoiceStopRequested) {
      try {
        processedResultIndexes.clear();
        recognition.start();
        activeRecognition = recognition;
        return;
      } catch (error) {
        textVoiceStatus.textContent = "El dictado se ha detenido antes de los 10 segundos. Puedes pulsar Voz para continuar.";
      }
    }

    if (isRedaction && !redactionPhraseTimer) {
      flushPendingRedaction(input);
    }

    clearTextVoiceTimer();
    textVoiceStopRequested = false;
    activeRecognition = null;
  });

  try {
    recognition.start();
    waitForTextSilence(
      recognition,
      textVoiceStatus,
      isRedaction ? "Redacción terminada por voz." : "Nombre escrito por voz."
    );
  } catch (error) {
    activeRecognition = null;
    textVoiceStatus.textContent = "No se pudo iniciar el microfono. Revisa los permisos del navegador.";
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

function getTextSearchValues() {
  return Object.fromEntries(
    [...document.querySelectorAll("[data-text-search]")].map((input) => [
      input.dataset.textSearch,
      input.value.trim().toLowerCase()
    ])
  );
}

function matchesTextFilters(record) {
  const searches = getTextSearchValues();

  return (
    (!searches.name || (record.name || "").toLowerCase().includes(searches.name)) &&
    (!searches.date || (record.date || "").toLowerCase().includes(searches.date)) &&
    (!searches.redaction || (record.redaction || "").toLowerCase().includes(searches.redaction))
  );
}

function getVisibleTextRecords() {
  return textRecords.filter(matchesTextFilters);
}

function downloadWord() {
  const visibleRecords = getVisibleTextRecords();

  if (visibleRecords.length === 0) {
    return;
  }

  const recordsHtml = visibleRecords
    .map((record) => {
      const photosHtml = (record.photos || [])
        .map((photo) => `<img src="${photo.dataUrl}" alt="${escapeHtml(photo.name || "Foto")}" style="max-width: 320px; height: auto; margin: 8px 8px 8px 0;">`)
        .join("");

      return `
        <h2>${escapeHtml(record.name || "Sin nombre")}</h2>
        <p><strong>Fecha:</strong> ${escapeHtml(record.date)}</p>
        <p>${escapeHtml(record.redaction).replace(/\n/g, "<br>")}</p>
        ${photosHtml ? `<div>${photosHtml}</div>` : ""}
        <hr>
      `;
    })
    .join("");
  const wordHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Textos PERSONAL</title>
</head>
<body>
  <h1>Textos PERSONAL</h1>
  ${recordsHtml}
</body>
</html>`;
  const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `personal-textos-${date}.doc`;
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

function deleteTextRecord(record) {
  textRecords = textRecords.filter((item) => item.id !== record.id);
  if (editingTextId === record.id) {
    setTextFormMode();
  }
  saveTextRecords();
  renderTextRecords();
}

function editTextRecord(record) {
  setTextFormMode(record);
  textForm.scrollIntoView({ behavior: "smooth", block: "start" });
  textForm.elements.textName.focus();
}

function renderTextRecords() {
  const visibleRecords = getVisibleTextRecords();
  textList.innerHTML = "";
  textCount.textContent = `${visibleRecords.length} texto${visibleRecords.length === 1 ? "" : "s"}`;
  downloadWordButton.disabled = visibleRecords.length === 0;

  if (visibleRecords.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = textRecords.length === 0 ? "No hay textos guardados." : "No hay textos con esos filtros.";
    textList.append(empty);
    return;
  }

  visibleRecords.forEach((record) => {
    const item = document.createElement("article");
    item.className = "text-record-card";

    const header = document.createElement("div");
    header.className = "text-record-header";
    const title = document.createElement("h4");
    title.textContent = record.name || "Sin nombre";
    const date = document.createElement("span");
    date.textContent = record.date || "";
    header.append(title, date);

    const redaction = document.createElement("p");
    redaction.className = "text-record-redaction";
    redaction.textContent = record.redaction || "";

    const photos = document.createElement("div");
    photos.className = "text-record-photos";
    (record.photos || []).forEach((photo, index) => {
      const image = document.createElement("img");
      image.src = photo.dataUrl;
      image.alt = photo.name || `Foto ${index + 1}`;
      photos.append(image);
    });

    const actions = document.createElement("div");
    actions.className = "contact-card-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "Modificar";
    editButton.addEventListener("click", () => editTextRecord(record));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Borrar";
    deleteButton.addEventListener("click", () => deleteTextRecord(record));

    actions.append(editButton, deleteButton);
    item.append(header, redaction);
    if ((record.photos || []).length > 0) {
      item.append(photos);
    }
    item.append(actions);
    textList.append(item);
  });
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
  fields.forEach(({ key, label }) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = `table-column-${key}`;
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
      td.className = `table-column-${key}`;

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
enterTextButton.addEventListener("click", () => showScreen("text"));
backButton.addEventListener("click", () => showScreen("home"));
textBackButton.addEventListener("click", () => showScreen("home"));

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

textForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(textForm);
  const record = {
    id: editingTextId || createContactId(),
    name: formData.get("textName").trim(),
    date: textDateInput.value || formatDateTime(),
    redaction: formData.get("redaction").trim(),
    photos: [...currentTextPhotos]
  };

  if (editingTextId) {
    textRecords = textRecords.map((item) => (item.id === editingTextId ? record : item));
  } else {
    textRecords.unshift(record);
    editingTextId = record.id;
  }

  saveTextRecords();
  renderTextRecords();
});

newTextButton.addEventListener("click", () => {
  const formData = new FormData(textForm);
  const hasText =
    formData.get("textName").trim() ||
    formData.get("redaction").trim() ||
    currentTextPhotos.length > 0;

  if (hasText) {
    const record = {
      id: editingTextId || createContactId(),
      name: formData.get("textName").trim(),
      date: textDateInput.value || formatDateTime(),
      redaction: formData.get("redaction").trim(),
      photos: [...currentTextPhotos]
    };

    if (editingTextId) {
      textRecords = textRecords.map((item) => (item.id === editingTextId ? record : item));
    } else {
      textRecords.unshift(record);
    }

    saveTextRecords();
  }

  setTextFormMode();
  renderTextRecords();
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
downloadWordButton.addEventListener("click", downloadWord);
cancelEditButton.addEventListener("click", () => {
  setFormMode();
});
cancelTextEditButton.addEventListener("click", () => {
  setTextFormMode();
});
document.querySelectorAll("[data-voice-target]").forEach((button) => {
  button.addEventListener("click", () => startVoiceInput(button.dataset.voiceTarget));
});
document.querySelectorAll("[data-text-voice-target]").forEach((button) => {
  button.addEventListener("click", () => startTextVoiceInput(button.dataset.textVoiceTarget));
});
[textCameraInput, textGalleryInput].forEach((input) => {
  input.addEventListener("change", async () => {
    await addTextPhotos(input.files);
    input.value = "";
  });
});
document.querySelectorAll("[data-text-search]").forEach((input) => {
  input.addEventListener("input", renderTextRecords);
});
clearTextFiltersButton.addEventListener("click", () => {
  document.querySelectorAll("[data-text-search]").forEach((input) => {
    input.value = "";
  });
  renderTextRecords();
});

phoneInput.addEventListener("input", () => {
  if (phoneInputTimer) {
    clearTimeout(phoneInputTimer);
  }

  phoneInputTimer = setTimeout(() => {
    phoneInput.value = normalizePhoneText(phoneInput.value);
    phoneInputTimer = null;
  }, 3000);
});

setTextFormMode();
renderContacts();
renderTextRecords();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
