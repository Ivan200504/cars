const COUNTRY_OPTIONS = {
  usa: "США",
  japan: "Япония",
  korea: "Корея",
  uae: "ОАЭ",
  europe: "Европа",
};

const STATUS_OPTIONS = {
  available: "В наличии",
  transit: "В пути",
  reserved: "Резерв",
};

const STORAGE_KEY = "cars-admin-settings-v1";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .replace(/[а-яё]/gi, "")
    .replace(/^-+|-+$/g, "") || `car-${Date.now()}`;
}

function normalizeTextList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTextList(items) {
  return (Array.isArray(items) ? items : []).join("\n");
}

function parseSpecsText(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex === -1) {
        return { label: "Параметр", value: line };
      }

      return {
        label: line.slice(0, separatorIndex).trim() || "Параметр",
        value: line.slice(separatorIndex + 1).trim() || "Значение",
      };
    });
}

function formatSpecsText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.label || "Параметр"}: ${item.value || "Значение"}`)
    .join("\n");
}

function normalizeGalleryItem(item, index) {
  return {
    src: item?.src || "",
    previewSrc: item?.previewSrc || item?.src || "",
    label: item?.label || `Фото ${index + 1}`,
    position: item?.position || "center center",
    scale: Number(item?.scale) > 0 ? Number(item.scale) : 1,
    file: item?.file || null,
    pendingName: item?.pendingName || "",
  };
}

function normalizeCar(car, index) {
  const countryCode = car?.countryCode && COUNTRY_OPTIONS[car.countryCode] ? car.countryCode : "usa";
  const statusKey = car?.statusKey && STATUS_OPTIONS[car.statusKey] ? car.statusKey : "available";
  const gallery = Array.isArray(car?.gallery) && car.gallery.length
    ? car.gallery.map(normalizeGalleryItem)
    : [normalizeGalleryItem({ src: "./assets/hero-scene-v3.webp", label: "Фото" }, 0)];

  return {
    id: car?.id || `car-${index + 1}`,
    name: car?.name || "Новая машина",
    countryCode,
    countryLabel: car?.countryLabel || COUNTRY_OPTIONS[countryCode],
    statusKey,
    statusLabel: car?.statusLabel || STATUS_OPTIONS[statusKey],
    price: car?.price || "",
    priceRub: car?.priceRub || "",
    cardSpecs: car?.cardSpecs || "",
    summary: car?.summary || "",
    lead: car?.lead || car?.summary || "",
    specs: Array.isArray(car?.specs) ? car.specs : [],
    highlights: Array.isArray(car?.highlights) ? car.highlights : [],
    gallery,
  };
}

function createEmptyCar() {
  return normalizeCar(
    {
      id: `car-${Date.now()}`,
      name: "Новая машина",
      countryCode: "usa",
      statusKey: "available",
      statusLabel: "В наличии",
      summary: "",
      lead: "",
      specs: [],
      highlights: [],
      gallery: [],
    },
    0,
  );
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function encodeUtf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const normalized = String(value || "").replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getApiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function buildContentsUrl(owner, repo, path, branch) {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const query = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${query}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };

    reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

async function fetchLocalCatalog() {
  const response = await fetch("./data/catalog.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось прочитать локальный каталог: ${response.status}`);
  }

  const payload = await response.json();
  const cars = Array.isArray(payload?.cars) ? payload.cars : [];
  return cars.map(normalizeCar);
}

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarList = document.querySelector("[data-admin-list]");
  const editorForm = document.querySelector("[data-car-form]");
  const previewCard = document.querySelector("[data-preview-card]");
  const previewModal = document.querySelector("[data-preview-modal]");
  const statusBox = document.querySelector("[data-admin-status]");
  const publishButton = document.querySelector("[data-action='publish']");
  const connectButton = document.querySelector("[data-action='connect']");
  const addCarButton = document.querySelector("[data-action='add-car']");
  const duplicateButton = document.querySelector("[data-action='duplicate-car']");
  const deleteButton = document.querySelector("[data-action='delete-car']");
  const moveUpButton = document.querySelector("[data-action='move-up']");
  const moveDownButton = document.querySelector("[data-action='move-down']");
  const uploadInput = document.querySelector("[data-gallery-upload]");
  const galleryList = document.querySelector("[data-gallery-list]");
  const formTitle = document.querySelector("[data-editor-title]");
  const githubForm = document.querySelector("[data-github-form]");

  if (!sidebarList || !editorForm || !previewCard || !previewModal || !statusBox || !githubForm) {
    return;
  }

  const state = {
    cars: [],
    selectedId: "",
    remoteSha: "",
    isPublishing: false,
    settings: {
      owner: "Ivan200504",
      repo: "cars",
      branch: "main",
      filePath: "data/catalog.json",
      assetsDir: "assets/catalog",
      token: "",
      rememberToken: false,
    },
  };

  const formFields = {
    id: editorForm.querySelector("[name='id']"),
    name: editorForm.querySelector("[name='name']"),
    countryCode: editorForm.querySelector("[name='countryCode']"),
    statusKey: editorForm.querySelector("[name='statusKey']"),
    statusLabel: editorForm.querySelector("[name='statusLabel']"),
    price: editorForm.querySelector("[name='price']"),
    priceRub: editorForm.querySelector("[name='priceRub']"),
    cardSpecs: editorForm.querySelector("[name='cardSpecs']"),
    summary: editorForm.querySelector("[name='summary']"),
    lead: editorForm.querySelector("[name='lead']"),
    specsText: editorForm.querySelector("[name='specsText']"),
    highlightsText: editorForm.querySelector("[name='highlightsText']"),
  };

  const githubFields = {
    owner: githubForm.querySelector("[name='owner']"),
    repo: githubForm.querySelector("[name='repo']"),
    branch: githubForm.querySelector("[name='branch']"),
    filePath: githubForm.querySelector("[name='filePath']"),
    assetsDir: githubForm.querySelector("[name='assetsDir']"),
    token: githubForm.querySelector("[name='token']"),
    rememberToken: githubForm.querySelector("[name='rememberToken']"),
  };

  function setStatus(message, tone = "info") {
    statusBox.textContent = message;
    statusBox.dataset.tone = tone;
    statusBox.hidden = !message;
  }

  function loadSavedSettings() {
    const saved = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);

    if (!saved || typeof saved !== "object") {
      return;
    }

    state.settings = {
      ...state.settings,
      ...saved,
      token: saved.rememberToken ? saved.token || "" : "",
      rememberToken: Boolean(saved.rememberToken),
    };
  }

  function syncGithubInputs() {
    githubFields.owner.value = state.settings.owner;
    githubFields.repo.value = state.settings.repo;
    githubFields.branch.value = state.settings.branch;
    githubFields.filePath.value = state.settings.filePath;
    githubFields.assetsDir.value = state.settings.assetsDir;
    githubFields.token.value = state.settings.token;
    githubFields.rememberToken.checked = state.settings.rememberToken;
  }

  function readGithubInputs() {
    state.settings.owner = githubFields.owner.value.trim();
    state.settings.repo = githubFields.repo.value.trim();
    state.settings.branch = githubFields.branch.value.trim() || "main";
    state.settings.filePath = githubFields.filePath.value.trim() || "data/catalog.json";
    state.settings.assetsDir = githubFields.assetsDir.value.trim().replace(/\/+$/, "") || "assets/catalog";
    state.settings.token = githubFields.token.value.trim();
    state.settings.rememberToken = githubFields.rememberToken.checked;
  }

  function persistSettings() {
    const payload = {
      owner: state.settings.owner,
      repo: state.settings.repo,
      branch: state.settings.branch,
      filePath: state.settings.filePath,
      assetsDir: state.settings.assetsDir,
      rememberToken: state.settings.rememberToken,
      token: state.settings.rememberToken ? state.settings.token : "",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function getSelectedCar() {
    return state.cars.find((car) => car.id === state.selectedId) || null;
  }

  function ensureUniqueId(candidate, currentId = "") {
    const base = slugify(candidate);
    let nextId = base;
    let index = 2;

    while (state.cars.some((car) => car.id === nextId && car.id !== currentId)) {
      nextId = `${base}-${index}`;
      index += 1;
    }

    return nextId;
  }

  function renderSidebar() {
    sidebarList.innerHTML = state.cars
      .map((car) => {
        const isActive = car.id === state.selectedId;
        return `
          <button class="admin-list__item${isActive ? " is-active" : ""}" type="button" data-select-car="${escapeHtml(car.id)}">
            <span class="admin-list__item-head">
              <span class="admin-list__item-title">${escapeHtml(car.name)}</span>
              <span class="admin-list__item-status admin-list__item-status--${escapeHtml(car.statusKey)}">${escapeHtml(car.statusLabel)}</span>
            </span>
            <span class="admin-list__item-meta">${escapeHtml(COUNTRY_OPTIONS[car.countryCode] || car.countryLabel)} · ${escapeHtml(car.price || "Цена не указана")}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderGallery(car) {
    galleryList.innerHTML = car.gallery
      .map((item, index) => {
        const previewSource = item.previewSrc || item.src || "./assets/hero-scene-v3.webp";
        const pathValue = item.file ? "Будет загружено при публикации" : item.src;

        return `
          <article class="gallery-item" data-gallery-index="${index}">
            <div class="gallery-item__preview">
              <img src="${escapeHtml(previewSource)}" alt="${escapeHtml(item.label)}" />
            </div>
            <div class="gallery-item__fields">
              <label class="field">
                <span class="field__label">Подпись</span>
                <input class="field__control" type="text" data-gallery-field="label" value="${escapeHtml(item.label)}" />
              </label>
              <label class="field">
                <span class="field__label">Путь к фото</span>
                <input class="field__control" type="text" data-gallery-field="src" value="${escapeHtml(pathValue)}" ${item.file ? "readonly" : ""} />
              </label>
              <div class="gallery-item__row">
                <label class="field">
                  <span class="field__label">Позиция</span>
                  <input class="field__control" type="text" data-gallery-field="position" value="${escapeHtml(item.position)}" />
                </label>
                <label class="field">
                  <span class="field__label">Масштаб</span>
                  <input class="field__control" type="number" min="0.5" max="2" step="0.01" data-gallery-field="scale" value="${escapeHtml(item.scale)}" />
                </label>
              </div>
              ${item.pendingName ? `<div class="gallery-item__hint">Новый файл: ${escapeHtml(item.pendingName)}</div>` : ""}
            </div>
            <div class="gallery-item__actions">
              <button class="button button--ghost" type="button" data-gallery-action="up">Выше</button>
              <button class="button button--ghost" type="button" data-gallery-action="down">Ниже</button>
              <button class="button button--ghost-danger" type="button" data-gallery-action="remove">Удалить</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderForm() {
    const car = getSelectedCar();

    if (!car) {
      return;
    }

    formTitle.textContent = car.name;
    formFields.id.value = car.id;
    formFields.name.value = car.name;
    formFields.countryCode.value = car.countryCode;
    formFields.statusKey.value = car.statusKey;
    formFields.statusLabel.value = car.statusLabel;
    formFields.price.value = car.price;
    formFields.priceRub.value = car.priceRub;
    formFields.cardSpecs.value = car.cardSpecs;
    formFields.summary.value = car.summary;
    formFields.lead.value = car.lead;
    formFields.specsText.value = formatSpecsText(car.specs);
    formFields.highlightsText.value = formatTextList(car.highlights);
    renderGallery(car);
    renderPreview();
  }

  function renderPreview() {
    const car = getSelectedCar();

    if (!car) {
      previewCard.innerHTML = "";
      previewModal.innerHTML = "";
      return;
    }

    const cover = car.gallery[0] || normalizeGalleryItem({}, 0);

    previewCard.innerHTML = `
      <div class="preview-card__media">
        <img src="${escapeHtml(cover.previewSrc || cover.src || "./assets/hero-scene-v3.webp")}" alt="${escapeHtml(car.name)}" />
      </div>
      <div class="preview-card__body">
        <div class="preview-card__meta">
          <span class="preview-card__status preview-card__status--${escapeHtml(car.statusKey)}">${escapeHtml(car.statusLabel)}</span>
          <span>${escapeHtml(COUNTRY_OPTIONS[car.countryCode] || car.countryLabel)}</span>
        </div>
        <h3>${escapeHtml(car.name)}</h3>
        <p>${escapeHtml(car.summary || "Краткое описание появится здесь.")}</p>
        <strong>${escapeHtml(car.price || "Цена по запросу")}</strong>
      </div>
    `;

    previewModal.innerHTML = `
      <div class="preview-modal__head">
        <strong>${escapeHtml(car.name)}</strong>
        <span>${escapeHtml(car.statusLabel)}</span>
      </div>
      <p>${escapeHtml(car.lead || car.summary || "Описание для модального окна пока не заполнено.")}</p>
      <div class="preview-modal__list">
        ${(car.specs.length ? car.specs : [{ label: "Характеристики", value: "Заполните блок ниже" }])
          .map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`)
          .join("")}
      </div>
      <ul>
        ${(car.highlights.length ? car.highlights : ["Здесь появятся сильные стороны автомобиля."])
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}
      </ul>
    `;
  }

  function selectCar(id) {
    state.selectedId = id;
    renderSidebar();
    renderForm();
  }

  function updateSelectedCar(mutator) {
    const car = getSelectedCar();

    if (!car) {
      return;
    }

    mutator(car);
    renderSidebar();
    renderPreview();
  }

  function moveCar(direction) {
    const currentIndex = state.cars.findIndex((car) => car.id === state.selectedId);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= state.cars.length) {
      return;
    }

    const [car] = state.cars.splice(currentIndex, 1);
    state.cars.splice(nextIndex, 0, car);
    renderSidebar();
  }

  function addCar() {
    const car = createEmptyCar();
    car.id = ensureUniqueId(car.id);
    state.cars.unshift(car);
    selectCar(car.id);
    setStatus("Добавлена новая карточка. Заполните данные и нажмите «Опубликовать».", "info");
  }

  function duplicateCar() {
    const current = getSelectedCar();

    if (!current) {
      return;
    }

    const copy = normalizeCar(structuredClone(current), 0);
    copy.id = ensureUniqueId(`${current.id}-copy`);
    copy.name = `${current.name} (копия)`;
    copy.gallery = copy.gallery.map((item) => ({ ...item, file: null, pendingName: "" }));
    state.cars.splice(1, 0, copy);
    selectCar(copy.id);
    setStatus("Карточка продублирована.", "success");
  }

  function deleteCar() {
    const current = getSelectedCar();

    if (!current) {
      return;
    }

    if (!window.confirm(`Удалить карточку «${current.name}»?`)) {
      return;
    }

    state.cars = state.cars.filter((car) => car.id !== current.id);

    if (!state.cars.length) {
      addCar();
      return;
    }

    selectCar(state.cars[0].id);
    setStatus("Карточка удалена из локального редактора. Изменение попадёт на сайт после публикации.", "warning");
  }

  function updateFromForm() {
    const current = getSelectedCar();

    if (!current) {
      return;
    }

    const proposedId = ensureUniqueId(formFields.id.value.trim() || formFields.name.value.trim() || current.id, current.id);

    if (current.id !== proposedId) {
      state.selectedId = proposedId;
    }

    current.id = proposedId;
    current.name = formFields.name.value.trim() || "Без названия";
    current.countryCode = formFields.countryCode.value;
    current.countryLabel = COUNTRY_OPTIONS[current.countryCode] || current.countryLabel;
    current.statusKey = formFields.statusKey.value;
    current.statusLabel = formFields.statusLabel.value.trim() || STATUS_OPTIONS[current.statusKey];
    current.price = formFields.price.value.trim();
    current.priceRub = formFields.priceRub.value.trim();
    current.cardSpecs = formFields.cardSpecs.value.trim();
    current.summary = formFields.summary.value.trim();
    current.lead = formFields.lead.value.trim();
    current.specs = parseSpecsText(formFields.specsText.value);
    current.highlights = normalizeTextList(formFields.highlightsText.value);
    formFields.id.value = current.id;
    formTitle.textContent = current.name;
    renderSidebar();
    renderPreview();
  }

  async function fetchRemoteCatalog() {
    readGithubInputs();
    persistSettings();

    if (!state.settings.owner || !state.settings.repo || !state.settings.branch || !state.settings.filePath || !state.settings.token) {
      throw new Error("Заполните owner, repo, branch, путь к JSON и GitHub token.");
    }

    const response = await fetch(
      buildContentsUrl(state.settings.owner, state.settings.repo, state.settings.filePath, state.settings.branch),
      { headers: getApiHeaders(state.settings.token) },
    );

    if (response.status === 404) {
      state.remoteSha = "";
      return;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.message || `GitHub API вернул ${response.status}.`);
    }

    const payload = await response.json();
    state.remoteSha = payload.sha || "";

    if (payload.content) {
      const content = decodeBase64Utf8(payload.content);
      const parsed = safeJsonParse(content, null);
      const cars = Array.isArray(parsed?.cars) ? parsed.cars : [];

      if (cars.length) {
        state.cars = cars.map(normalizeCar);
        state.selectedId = state.cars[0]?.id || "";
      }
    }
  }

  async function uploadAsset(file, carId, index) {
    const safeFileName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
    const targetPath = `${state.settings.assetsDir}/${slugify(carId)}-${Date.now()}-${index + 1}-${safeFileName}`.replace(/\/+/g, "/");
    const content = await fileToBase64(file);
    const response = await fetch(
      buildContentsUrl(state.settings.owner, state.settings.repo, targetPath, ""),
      {
        method: "PUT",
        headers: {
          ...getApiHeaders(state.settings.token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `upload catalog asset: ${carId}`,
          content,
          branch: state.settings.branch,
        }),
      },
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.message || `Не удалось загрузить фото ${file.name}.`);
    }

    return `./${targetPath}`;
  }

  async function buildPublishPayload() {
    const cars = [];

    for (const car of state.cars) {
      const gallery = [];

      for (let index = 0; index < car.gallery.length; index += 1) {
        const item = car.gallery[index];
        let src = item.src.trim();

        if (item.file) {
          src = await uploadAsset(item.file, car.id, index);
        }

        gallery.push({
          src,
          label: item.label.trim() || `Фото ${index + 1}`,
          position: item.position.trim() || "center center",
          scale: Number(item.scale) > 0 ? Number(item.scale) : 1,
        });
      }

      cars.push({
        id: car.id,
        name: car.name.trim(),
        countryCode: car.countryCode,
        countryLabel: COUNTRY_OPTIONS[car.countryCode] || car.countryLabel,
        statusKey: car.statusKey,
        statusLabel: car.statusLabel.trim() || STATUS_OPTIONS[car.statusKey],
        price: car.price.trim(),
        priceRub: car.priceRub.trim(),
        cardSpecs: car.cardSpecs.trim(),
        summary: car.summary.trim(),
        lead: car.lead.trim(),
        specs: car.specs.map((item) => ({
          label: item.label.trim(),
          value: item.value.trim(),
        })),
        highlights: car.highlights.map((item) => item.trim()).filter(Boolean),
        gallery,
      });
    }

    return JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        cars,
      },
      null,
      2,
    );
  }

  async function publishCatalog() {
    if (state.isPublishing) {
      return;
    }

    readGithubInputs();
    persistSettings();
    updateFromForm();

    if (!state.settings.owner || !state.settings.repo || !state.settings.branch || !state.settings.filePath || !state.settings.token) {
      setStatus("Для публикации заполните настройки GitHub и токен.", "warning");
      return;
    }

    if (!state.cars.length) {
      setStatus("Каталог пустой. Добавьте хотя бы одну машину.", "warning");
      return;
    }

    state.isPublishing = true;
    publishButton.disabled = true;
    setStatus("Публикуем каталог и загружаем новые фотографии в GitHub...", "info");

    try {
      const content = await buildPublishPayload();
      const response = await fetch(
        buildContentsUrl(state.settings.owner, state.settings.repo, state.settings.filePath, ""),
        {
          method: "PUT",
          headers: {
            ...getApiHeaders(state.settings.token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "update car catalog via admin panel",
            content: encodeUtf8ToBase64(content),
            sha: state.remoteSha || undefined,
            branch: state.settings.branch,
          }),
        },
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.message || `GitHub API вернул ${response.status}.`);
      }

      const payload = await response.json();
      state.remoteSha = payload.content?.sha || state.remoteSha;

      state.cars = state.cars.map((car) =>
        normalizeCar(
          {
            ...car,
            gallery: car.gallery.map((item) => ({
              src: item.file ? item.src || item.previewSrc : item.src,
              label: item.label,
              position: item.position,
              scale: item.scale,
              file: null,
              previewSrc: item.file ? item.src || item.previewSrc : item.src,
              pendingName: "",
            })),
          },
          0,
        ),
      );

      await fetchRemoteCatalog();
      renderSidebar();
      renderForm();
      setStatus("Каталог опубликован. GitHub Action теперь сможет выгрузить сайт на FTP автоматически.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не удалось опубликовать каталог.", "danger");
    } finally {
      state.isPublishing = false;
      publishButton.disabled = false;
    }
  }

  sidebarList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-car]");

    if (!button) {
      return;
    }

    selectCar(button.dataset.selectCar || "");
  });

  editorForm.addEventListener("input", (event) => {
    if (event.target === formFields.statusKey && !formFields.statusLabel.value.trim()) {
      formFields.statusLabel.value = STATUS_OPTIONS[formFields.statusKey.value];
    }

    updateFromForm();
  });

  editorForm.addEventListener("change", updateFromForm);

  galleryList.addEventListener("input", (event) => {
    const item = event.target.closest("[data-gallery-index]");
    const field = event.target.dataset.galleryField;
    const car = getSelectedCar();

    if (!item || !field || !car) {
      return;
    }

    const index = Number(item.dataset.galleryIndex || 0);
    const galleryItem = car.gallery[index];

    if (!galleryItem) {
      return;
    }

    if (field === "scale") {
      galleryItem.scale = Number(event.target.value) > 0 ? Number(event.target.value) : 1;
    } else if (field === "src") {
      galleryItem.src = event.target.value.trim();
      galleryItem.previewSrc = galleryItem.src;
    } else {
      galleryItem[field] = event.target.value;
    }

    renderPreview();
  });

  galleryList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-gallery-index]");
    const action = event.target.dataset.galleryAction;
    const car = getSelectedCar();

    if (!item || !action || !car) {
      return;
    }

    const index = Number(item.dataset.galleryIndex || 0);

    if (action === "remove") {
      car.gallery.splice(index, 1);
      if (!car.gallery.length) {
        car.gallery.push(normalizeGalleryItem({}, 0));
      }
    }

    if (action === "up" && index > 0) {
      [car.gallery[index - 1], car.gallery[index]] = [car.gallery[index], car.gallery[index - 1]];
    }

    if (action === "down" && index < car.gallery.length - 1) {
      [car.gallery[index + 1], car.gallery[index]] = [car.gallery[index], car.gallery[index + 1]];
    }

    renderGallery(car);
    renderPreview();
  });

  uploadInput?.addEventListener("change", () => {
    const car = getSelectedCar();
    const files = Array.from(uploadInput.files || []);

    if (!car || !files.length) {
      return;
    }

    files.forEach((file) => {
      car.gallery.push(
        normalizeGalleryItem(
          {
            src: "",
            previewSrc: URL.createObjectURL(file),
            label: file.name.replace(/\.[^.]+$/, ""),
            position: "center center",
            scale: 1,
            file,
            pendingName: file.name,
          },
          car.gallery.length,
        ),
      );
    });

    uploadInput.value = "";
    renderGallery(car);
    renderPreview();
    setStatus("Фото добавлены в черновик. Они загрузятся в GitHub при публикации.", "info");
  });

  addCarButton?.addEventListener("click", addCar);
  duplicateButton?.addEventListener("click", duplicateCar);
  deleteButton?.addEventListener("click", deleteCar);
  moveUpButton?.addEventListener("click", () => moveCar(-1));
  moveDownButton?.addEventListener("click", () => moveCar(1));

  connectButton?.addEventListener("click", async () => {
    try {
      setStatus("Проверяем доступ к GitHub и забираем актуальный каталог из репозитория...", "info");
      await fetchRemoteCatalog();
      renderSidebar();
      renderForm();
      setStatus("Связь с GitHub установлена. Можно редактировать и публиковать каталог.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не удалось подключиться к GitHub.", "danger");
    }
  });

  publishButton?.addEventListener("click", publishCatalog);

  loadSavedSettings();
  syncGithubInputs();

  try {
    setStatus("Загружаем локальный каталог для редактирования...", "info");
    state.cars = await fetchLocalCatalog();
  } catch (error) {
    console.error(error);
    state.cars = [createEmptyCar()];
    setStatus("Локальный каталог не найден, создан пустой шаблон.", "warning");
  }

  state.selectedId = state.cars[0]?.id || "";
  renderSidebar();
  renderForm();

  if (!statusBox.textContent) {
    setStatus("Редактор готов. После проверки нажмите «Подключиться к GitHub», затем «Опубликовать каталог».", "info");
  }
});
