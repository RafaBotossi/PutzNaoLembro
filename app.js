const STORAGE_KEY = "putz-nao-lembro-items-v3";
const LEGACY_STORAGE_KEYS = ["putz-nao-lembro-items-v2", "putz-nao-lembro-items-v1"];
const MAX_IMAGE_BYTES = 200 * 1024;
const IMAGE_MIME_TYPE = "image/jpeg";

const form = document.getElementById("entry-form");
const appShell = document.getElementById("app-shell");
const backgroundMusic = document.getElementById("background-music");
const volumeSlider = document.getElementById("volume-slider");
const closedBookButton = document.getElementById("closed-book");
const closeBookButton = document.getElementById("close-book");
const leftPage = document.querySelector(".book__page--left");
const rightPage = document.querySelector(".book__page--right");
const titleInput = document.getElementById("title");
const textInput = document.getElementById("text");
const categoryInput = document.getElementById("category");
const imageInput = document.getElementById("image");
const imageFileName = document.getElementById("image-file-name");
const imageDropZone = document.getElementById("image-drop-zone");
const imagePreview = document.getElementById("image-preview");
const removeImageButton = document.getElementById("remove-image");
const entriesGrid = document.getElementById("entries-grid");
const emptyState = document.getElementById("empty-state");
const stats = document.getElementById("stats");
const cancelEditButton = document.getElementById("cancel-edit");
const clearAllButton = document.getElementById("clear-all");
const loadExampleButton = document.getElementById("load-example");
const exportButton = document.getElementById("export-data");
const importInput = document.getElementById("import-data");
const formTitle = document.getElementById("form-title");
const searchInput = document.getElementById("search");
const libraryToolbar = document.getElementById("library-toolbar");
const sortToggleButton = document.getElementById("sort-toggle");
const filterButtons = document.querySelectorAll(".tab");
const imageLightbox = document.getElementById("image-lightbox");
const imageLightboxImage = document.getElementById("image-lightbox-img");
const imageLightboxClose = document.getElementById("image-lightbox-close");

let items = [];
let editingId = null;
let selectedImageData = "";
let activeFilter = "all";
let searchTerm = "";
let selectedDetailId = null;
let sortDirection = "asc";

function updateVolume() {
  const value = Math.max(0, Math.min(100, Number(volumeSlider.value) || 0));
  backgroundMusic.volume = value / 100;
}

updateVolume();

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadItems() {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY) ||
      LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

    items = saved ? JSON.parse(saved).map(normalizeItem) : [];
    saveItems();
  } catch (error) {
    items = [];
    console.error("Não foi possível carregar os registros:", error);
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os registros:", error);
    window.alert("Não consegui salvar. Remova algumas imagens ou exporte um backup antes de continuar.");
    return false;
  }
}

function normalizeItem(item) {
  const category = item.category === "Pessoas" ? "Personagens" : item.category;

  return {
    id: item.id || createId(),
    title: String(item.title || "").trim(),
    text: String(item.text || "").trim(),
    category: ["Lugares", "Coisas", "Personagens"].includes(category) ? category : "Coisas",
    image: item.image || "",
    inactive: Boolean(item.inactive),
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt || item.createdAt) || Date.now(),
  };
}

function resetForm() {
  form.reset();
  selectedImageData = "";
  editingId = null;
  formTitle.textContent = "Adicionar registro";
  imageFileName.textContent = "Nenhum arquivo selecionado";
  updateImagePreview();
}

function updateImagePreview() {
  imagePreview.src = selectedImageData;
  imagePreview.style.display = selectedImageData ? "block" : "none";
  removeImageButton.style.display = selectedImageData ? "inline-flex" : "none";
}

function getFirstImageFile(files) {
  return [...files].find((file) => file.type.startsWith("image/"));
}

function getFirstClipboardImage(data) {
  const file = getFirstImageFile(data?.files || []);
  if (file) return file;

  return [...(data?.items || [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .find(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCategoryClass(category) {
  const normalized = String(category).toLowerCase();
  if (normalized === "lugares") return "category-lugares";
  if (normalized === "coisas") return "category-coisas";
  return "category-personagens";
}

function formatDate(timestamp) {
  if (!timestamp) return "sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

function getFilteredItems() {
  const normalizedQuery = searchTerm.trim().toLowerCase();

  return items.filter((item) => {
    const inactive = Boolean(item.inactive);
    const matchesStatus = activeFilter === "inactive" ? inactive : !inactive;
    const matchesCategory =
      activeFilter === "all" || activeFilter === "inactive" || item.category === activeFilter;
    const haystack = `${item.title} ${item.text} ${item.category}`.toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);

    return matchesStatus && matchesCategory && matchesQuery;
  });
}

function getCategoryCount(category) {
  return items.filter((item) => !item.inactive && item.category === category).length;
}

function renderItems() {
  const selectedItem = selectedDetailId ? items.find((item) => item.id === selectedDetailId) : null;
  libraryToolbar.style.display = selectedItem ? "none" : "grid";
  entriesGrid.classList.toggle("entries-grid--detail", Boolean(selectedItem));

  if (selectedItem) {
    renderItemDetail(selectedItem);
    return;
  }

  const filteredItems = getFilteredItems();
  const activeTotal = items.filter((item) => !item.inactive).length;
  const inactiveTotal = items.length - activeTotal;

  stats.textContent = activeTotal
    ? `${filteredItems.length} de ${activeTotal} ativos · ${getCategoryCount("Lugares")} lugares · ${getCategoryCount("Coisas")} coisas · ${getCategoryCount("Personagens")} personagens · ${inactiveTotal} inativos`
    : `${inactiveTotal} inativos`;

  if (!items.length) {
    emptyState.style.display = "block";
    emptyState.innerHTML = "<h3>Nada anotado ainda</h3><p>Crie o primeiro registro e salve a memória da party do esquecimento absoluto.</p>";
    entriesGrid.innerHTML = "";
    return;
  }

  if (!filteredItems.length) {
    emptyState.style.display = "block";
    emptyState.innerHTML = "<h3>Nenhum resultado</h3><p>Tente outra busca ou mude o filtro selecionado.</p>";
    entriesGrid.innerHTML = "";
    return;
  }

  emptyState.style.display = "none";

  entriesGrid.innerHTML = [...filteredItems]
    .sort((a, b) => {
      const comparison = a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    })
    .map((item) => {
      const title = escapeHtml(item.title);
      const category = escapeHtml(item.category);
      const text = escapeHtml(item.text);
      const date = formatDate(item.updatedAt || item.createdAt);
      const inactive = Boolean(item.inactive);

      return `
        <article class="entry-card ${inactive ? "entry-card--inactive" : ""}" data-action="open-detail" data-id="${item.id}" tabindex="0" role="button" aria-label="Abrir ${title}">
          <button class="visibility-toggle" type="button" data-action="toggle-inactive" data-id="${item.id}" aria-label="${inactive ? "Tornar visível" : "Tornar invisível"}">
            ${inactive ? "◉" : "◌"}
          </button>
          ${
            item.image
              ? `<div class="entry-card__image"><img src="${item.image}" alt="Imagem de ${title}" loading="lazy" data-action="view-image" data-src="${item.image}" /></div>`
              : `<div class="entry-card__image" aria-hidden="true"></div>`
          }
          <div class="entry-card__body">
            <div class="entry-card__header">
              <h3 class="entry-card__title">${title}</h3>
              <span class="entry-card__tag ${getCategoryClass(item.category)}">${category}</span>
            </div>
            ${inactive ? '<p class="entry-card__status">Invisível</p>' : ""}
            <p class="entry-card__text">${text}</p>
            <p class="entry-card__meta">Atualizado em ${date}</p>
            <div class="entry-card__actions">
              <button class="edit" type="button" data-action="edit" data-id="${item.id}" aria-label="Editar">✎</button>
              <button class="delete" type="button" data-action="delete" data-id="${item.id}" aria-label="Remover">X</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderItemDetail(item) {
  const title = escapeHtml(item.title);
  const category = escapeHtml(item.category);
  const text = escapeHtml(item.text);
  const date = formatDate(item.updatedAt || item.createdAt);
  const inactive = Boolean(item.inactive);

  emptyState.style.display = "none";
  stats.textContent = inactive ? "Registro invisível" : "Registro aberto";

  entriesGrid.innerHTML = `
    <article class="entry-detail ${inactive ? "entry-card--inactive" : ""}">
      <div class="entry-detail__topbar">
        <button class="button button--secondary" type="button" data-action="back-to-list">Voltar</button>
        <button class="visibility-toggle visibility-toggle--detail" type="button" data-action="toggle-inactive" data-id="${item.id}" aria-label="${inactive ? "Tornar visível" : "Tornar invisível"}">
          ${inactive ? "◉" : "◌"}
        </button>
      </div>
      ${
        item.image
          ? `<div class="entry-detail__image"><img src="${item.image}" alt="Imagem de ${title}" data-action="view-image" data-src="${item.image}" /></div>`
          : ""
      }
      <div class="entry-detail__header">
        <h3>${title}</h3>
        <span class="entry-card__tag ${getCategoryClass(item.category)}">${category}</span>
      </div>
      ${inactive ? '<p class="entry-card__status">Invisível</p>' : ""}
      <p class="entry-detail__text">${text}</p>
      <p class="entry-card__meta">Atualizado em ${date}</p>
      <div class="entry-card__actions">
        <button class="edit" type="button" data-action="edit" data-id="${item.id}" aria-label="Editar">✎</button>
        <button class="delete" type="button" data-action="delete" data-id="${item.id}" aria-label="Remover">X</button>
      </div>
    </article>
  `;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, IMAGE_MIME_TYPE, quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem compactada."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
      image.onload = () => resolve(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file) {
  if (file.size <= MAX_IMAGE_BYTES) {
    return blobToDataUrl(file);
  }

  const image = await loadImage(file);
  let maxSide = Math.min(900, Math.max(image.width, image.height));
  let bestBlob = null;

  while (maxSide >= 320) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.76, 0.66, 0.56, 0.46, 0.36]) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      bestBlob = blob;

      if (blob.size <= MAX_IMAGE_BYTES) {
        return blobToDataUrl(blob);
      }
    }

    maxSide = Math.floor(maxSide * 0.82);
  }

  throw new Error(`A imagem compactada ainda ficou com ${Math.round((bestBlob?.size || file.size) / 1024)} KB.`);
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  await processImageFile(file);
}

async function processImageFile(file, fallbackName = "Imagem colada") {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    window.alert("Use um arquivo de imagem.");
    return;
  }

  try {
    imageFileName.textContent = file.name || fallbackName;
    selectedImageData = await resizeImage(file);
    updateImagePreview();
  } catch (error) {
    console.error(error);
    imageInput.value = "";
    imageFileName.textContent = "Nenhum arquivo selecionado";
    window.alert("Não consegui deixar essa imagem abaixo de 200 KB. Tente uma imagem menor ou mais simples.");
  }
}

function handlePaste(event) {
  if (!appShell.classList.contains("is-book-open")) return;

  const file = getFirstClipboardImage(event.clipboardData);
  if (!file) return;

  event.preventDefault();
  processImageFile(file, "Imagem colada");
}

function handleImageDrag(event) {
  event.preventDefault();
  imageDropZone.classList.add("image-tools--dragging");
}

function clearImageDrag(event) {
  event.preventDefault();
  imageDropZone.classList.remove("image-tools--dragging");
}

function handleImageDrop(event) {
  event.preventDefault();
  imageDropZone.classList.remove("image-tools--dragging");
  const file = getFirstImageFile(event.dataTransfer?.files || []);
  processImageFile(file, "Imagem arrastada");
}

function handleSubmit(event) {
  event.preventDefault();

  const now = Date.now();
  const existingItem = items.find((item) => item.id === editingId);
  const payload = {
    title: titleInput.value.trim(),
    text: textInput.value.trim(),
    category: categoryInput.value,
    image: selectedImageData,
    inactive: existingItem?.inactive || false,
    createdAt: existingItem?.createdAt || now,
    updatedAt: now,
  };

  if (!payload.title || !payload.text) return;

  const nextItems = editingId
    ? items.map((item) => (item.id === editingId ? { ...item, ...payload, id: editingId } : item))
    : [{ id: createId(), ...payload }, ...items];

  const previousItems = items;
  items = nextItems;

  if (!saveItems()) {
    items = previousItems;
    return;
  }

  selectedDetailId = null;
  resetForm();
  renderItems();
}

function startEdit(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  selectedDetailId = null;
  editingId = id;
  titleInput.value = item.title;
  textInput.value = item.text;
  categoryInput.value = item.category;
  selectedImageData = item.image || "";
  formTitle.textContent = "Editar registro";
  updateImagePreview();
  renderItems();
  titleInput.focus();
  leftPage.scrollTop = 0;
}

function openBook() {
  appShell.classList.add("is-book-open");
  backgroundMusic.play().catch((error) => {
    console.warn("Não foi possível iniciar a música:", error);
  });
}

function closeBook() {
  appShell.classList.remove("is-book-open");
  leftPage.scrollTop = 0;
  rightPage.scrollTop = 0;
}

function toggleInactive(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  items = items.map((entry) =>
    entry.id === id ? { ...entry, inactive: !entry.inactive, updatedAt: Date.now() } : entry
  );
  saveItems();

  if (editingId === id) {
    resetForm();
  }

  renderItems();
}

function openDetail(id) {
  selectedDetailId = id;
  rightPage.scrollTop = 0;
  renderItems();
}

function backToList() {
  selectedDetailId = null;
  renderItems();
}

function setActiveFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((tab) => tab.classList.toggle("active", tab.dataset.filter === filter));
}

function resetLibraryView() {
  searchTerm = "";
  searchInput.value = "";
  selectedDetailId = null;
  setActiveFilter("all");
  rightPage.scrollTop = 0;
}

function removeItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  const confirmed = window.confirm(`Remover "${item.title}"?`);
  if (!confirmed) return;

  items = items.filter((entry) => entry.id !== id);
  if (selectedDetailId === id) {
    selectedDetailId = null;
  }
  saveItems();

  if (editingId === id) {
    resetForm();
  }

  renderItems();
}

function exportData() {
  const payload = {
    app: "PutZ Não Lembro!",
    version: 3,
    exportedAt: new Date().toISOString(),
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `putz-nao-lembro-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeImportedItems(data) {
  const importedItems = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(importedItems)) {
    throw new Error("Arquivo inválido.");
  }

  return importedItems.filter((item) => item?.title && item?.text && item?.category).map(normalizeItem);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onerror = () => window.alert("Não consegui ler o arquivo.");
  reader.onload = () => {
    try {
      const importedItems = normalizeImportedItems(JSON.parse(reader.result));
      const confirmed =
        !items.length ||
        window.confirm(`Importar ${importedItems.length} registros e substituir os registros atuais?`);

      if (!confirmed) return;

      items = importedItems;
      saveItems();
      resetForm();
      renderItems();
    } catch (error) {
      console.error(error);
      window.alert("Esse JSON não parece ser um backup válido do PutZ Não Lembro.");
    } finally {
      importInput.value = "";
    }
  };

  reader.readAsText(file);
}

async function loadExampleData() {
  const confirmed =
    !items.length || window.confirm("Carregar o exemplo e substituir os registros atuais?");

  if (!confirmed) return;

  try {
    loadExampleButton.disabled = true;
    loadExampleButton.textContent = "Carregando...";

    const exampleUrl = new URL("assets/exemplo.json", window.location.href);
    if (window.location.protocol !== "file:") {
      exampleUrl.searchParams.set("v", Date.now());
    }

    const response = await fetch(exampleUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar exemplo: ${response.status}`);
    }

    const exampleItems = normalizeImportedItems(await response.json());
    if (!exampleItems.length) {
      throw new Error("O exemplo não tem registros válidos.");
    }

    items = exampleItems;
    saveItems();
    resetForm();
    resetLibraryView();
    renderItems();
  } catch (error) {
    console.error(error);
    window.alert("Não consegui carregar o exemplo. Confira se assets/exemplo.json está publicado junto com o site.");
  } finally {
    loadExampleButton.disabled = false;
    loadExampleButton.textContent = "Carregar Exemplo";
  }
}

function openImageLightbox(src, alt) {
  if (!src) return;

  imageLightboxImage.src = src;
  imageLightboxImage.alt = alt || "Imagem da anotação";
  imageLightbox.classList.add("is-open");
  imageLightbox.setAttribute("aria-hidden", "false");
}

function closeImageLightbox() {
  imageLightbox.classList.remove("is-open");
  imageLightbox.setAttribute("aria-hidden", "true");
  imageLightboxImage.removeAttribute("src");
  imageLightboxImage.alt = "";
}

form.addEventListener("submit", handleSubmit);
closedBookButton.addEventListener("click", openBook);
closeBookButton.addEventListener("click", closeBook);
imageInput.addEventListener("change", handleImageUpload);
document.addEventListener("paste", handlePaste);
imageDropZone.addEventListener("dragenter", handleImageDrag);
imageDropZone.addEventListener("dragover", handleImageDrag);
imageDropZone.addEventListener("dragleave", clearImageDrag);
imageDropZone.addEventListener("drop", handleImageDrop);
removeImageButton.addEventListener("click", () => {
  selectedImageData = "";
  imageInput.value = "";
  imageFileName.textContent = "Nenhum arquivo selecionado";
  updateImagePreview();
});
cancelEditButton.addEventListener("click", resetForm);
exportButton.addEventListener("click", exportData);
importInput.addEventListener("change", importData);
loadExampleButton.addEventListener("click", loadExampleData);

clearAllButton.addEventListener("click", () => {
  if (!items.length) return;

  const confirmed = window.confirm("Apagar todos os registros deste navegador?");
  if (!confirmed) return;

  items = [];
  saveItems();
  resetForm();
  renderItems();
});

entriesGrid.addEventListener("click", (event) => {
  const image = event.target.closest("[data-action='view-image']");
  if (image) {
    event.stopPropagation();
    openImageLightbox(image.getAttribute("data-src"), image.alt);
    return;
  }

  const button = event.target.closest("button");
  if (button) {
    const id = button.getAttribute("data-id");
    if (button.dataset.action === "back-to-list") backToList();
    if (button.dataset.action === "edit") startEdit(id);
    if (button.dataset.action === "toggle-inactive") toggleInactive(id);
    if (button.dataset.action === "delete") removeItem(id);
    return;
  }

  const card = event.target.closest("[data-action='open-detail']");
  if (card) openDetail(card.getAttribute("data-id"));
});

entriesGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-action='open-detail']");
  if (!card) return;
  event.preventDefault();
  openDetail(card.getAttribute("data-id"));
});

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderItems();
});

sortToggleButton.addEventListener("click", () => {
  sortDirection = sortDirection === "asc" ? "desc" : "asc";
  sortToggleButton.textContent = sortDirection === "asc" ? "A→Z" : "Z→A";
  sortToggleButton.setAttribute("aria-label", sortDirection === "asc" ? "Ordenar de Z a A" : "Ordenar de A a Z");
  renderItems();
});

volumeSlider.addEventListener("input", () => {
  updateVolume();
});

imageLightboxClose.addEventListener("click", closeImageLightbox);

imageLightbox.addEventListener("click", (event) => {
  if (event.target === imageLightbox) closeImageLightbox();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageLightbox.classList.contains("is-open")) {
    closeImageLightbox();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedDetailId = null;
    setActiveFilter(button.dataset.filter);
    renderItems();
  });
});

loadItems();
resetForm();
renderItems();
