const COUNTRY_META = {
  usa: { label: "США", flag: "./assets/flags/flag-usa.png" },
  japan: { label: "Япония", flag: "./assets/flags/flag-japan.png" },
  korea: { label: "Корея", flag: "./assets/flags/flag-korea.png" },
  uae: { label: "ОАЭ", flag: "./assets/flags/flag-uae.png" },
  europe: { label: "Европа", flag: "./assets/flags/flag-europe.png" },
};

const STATUS_META = {
  available: { label: "В наличии", className: "available" },
  transit: { label: "В пути", className: "transit" },
  reserved: { label: "Резерв", className: "reserved" },
};

const DEFAULT_CAR_IMAGE = "./assets/hero-scene-v3.webp";
const IMAGE_RETRY_DELAYS_MS = [1200, 3000, 6000];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildImageUrl(src, catalogVersion = "", retryToken = "") {
  const base = String(src || "").trim() || DEFAULT_CAR_IMAGE;
  const params = [];

  if (catalogVersion) {
    params.push(`v=${encodeURIComponent(catalogVersion)}`);
  }

  if (retryToken) {
    params.push(`retry=${encodeURIComponent(retryToken)}`);
  }

  if (!params.length) {
    return base;
  }

  return `${base}${base.includes("?") ? "&" : "?"}${params.join("&")}`;
}

function normalizeGallery(gallery, fallbackSrc, fallbackName, catalogVersion) {
  const items = Array.isArray(gallery) ? gallery.filter((item) => item && item.src) : [];

  if (items.length) {
    return items.map((item, index) => ({
      src: buildImageUrl(item.src, catalogVersion),
      rawSrc: item.src,
      label: item.label || `Фото ${index + 1}`,
      position: item.position || "center center",
      scale: Number(item.scale) > 0 ? Number(item.scale) : 1,
    }));
  }

  const safeFallbackSrc = fallbackSrc || DEFAULT_CAR_IMAGE;

  return [
    {
      src: buildImageUrl(safeFallbackSrc, catalogVersion),
      rawSrc: safeFallbackSrc,
      label: "Фото",
      position: "center center",
      scale: 1,
      alt: fallbackName || "Автомобиль",
    },
  ];
}

function normalizeCar(car, index, catalogVersion) {
  const id = car?.id || `car-${index + 1}`;
  const countryCode = car?.countryCode || "usa";
  const countryMeta = COUNTRY_META[countryCode] || COUNTRY_META.usa;
  const statusMeta = STATUS_META[car?.statusKey] || STATUS_META.available;
  const gallery = normalizeGallery(car?.gallery, car?.image, car?.name, catalogVersion);

  return {
    id,
    name: car?.name || "Автомобиль",
    countryCode,
    countryLabel: car?.countryLabel || countryMeta.label,
    countryFlag: countryMeta.flag,
    statusKey: car?.statusKey || "available",
    statusLabel: car?.statusLabel || statusMeta.label,
    statusClass: statusMeta.className,
    price: car?.price || "Цена по запросу",
    priceRub: car?.priceRub || "",
    cardSpecs: car?.cardSpecs || "",
    summary: car?.summary || car?.lead || "Описание уточняется.",
    lead: car?.lead || car?.summary || "Подробное описание появится после обновления каталога.",
    specs: Array.isArray(car?.specs) ? car.specs : [],
    highlights: Array.isArray(car?.highlights) ? car.highlights : [],
    gallery,
    cover: gallery[0],
  };
}

function createCardMarkup(car) {
  return `
    <article class="inventory__card" data-country="${escapeHtml(car.countryCode)}" data-car-id="${escapeHtml(car.id)}">
      <div class="inventory__card-top">
        <span class="inventory__status inventory__status--${escapeHtml(car.statusClass)}">${escapeHtml(car.statusLabel)}</span>
        <span class="inventory__country">
          <span>${escapeHtml(car.countryLabel)}</span>
          <span class="inventory__flag" aria-hidden="true">
            <img src="${escapeHtml(car.countryFlag)}" alt="" />
          </span>
        </span>
      </div>
      <div class="inventory__media">
        <img
          src="${escapeHtml(car.cover.src)}"
          data-car-image="card"
          data-image-src="${escapeHtml(car.cover.rawSrc || car.cover.src)}"
          alt="${escapeHtml(car.name)}"
          loading="lazy"
          decoding="async"
          style="object-position: ${escapeHtml(car.cover.position)}; transform: scale(${escapeHtml(car.cover.scale)});"
        />
      </div>
      <h3 class="inventory__name">${escapeHtml(car.name)}</h3>
      <p class="inventory__specs">${escapeHtml(car.cardSpecs)}</p>
      <p class="inventory__summary">${escapeHtml(car.summary)}</p>
      <p class="inventory__price">${escapeHtml(car.price)}</p>
      <div class="inventory__price-rub">${escapeHtml(car.priceRub)}</div>
      <div class="inventory__actions">
        <button class="inventory__more" type="button" data-car-modal-open data-car-id="${escapeHtml(car.id)}" aria-haspopup="dialog">Подробнее</button>
        <button class="inventory__fav" type="button" aria-label="Добавить ${escapeHtml(car.name)} в избранное">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M10 16.5L4.6 11.4C3.3 10.1 3.3 7.9 4.6 6.6C5.8 5.4 7.8 5.4 9 6.6L10 7.6L11 6.6C12.2 5.4 14.2 5.4 15.4 6.6C16.7 7.9 16.7 10.1 15.4 11.4L10 16.5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </article>
  `;
}

function createSpecMarkup(spec) {
  return `
    <div class="car-modal__spec">
      <span class="car-modal__spec-label">${escapeHtml(spec.label)}</span>
      <span class="car-modal__spec-value">${escapeHtml(spec.value)}</span>
    </div>
  `;
}

function createThumbMarkup(slide, index, activeIndex) {
  return `
    <button
      class="car-modal__thumb"
      type="button"
      data-car-modal-thumb
      data-index="${index}"
      aria-current="${index === activeIndex ? "true" : "false"}"
      aria-label="${escapeHtml(slide.label)}"
    >
      <span class="car-modal__thumb-image" aria-hidden="true">
        <img
          src="${escapeHtml(slide.src)}"
          data-car-image="thumb"
          data-image-src="${escapeHtml(slide.rawSrc || slide.src)}"
          alt=""
          style="object-position: ${escapeHtml(slide.position)}; transform: scale(${escapeHtml(slide.scale)});"
        />
      </span>
    </button>
  `;
}

async function loadCatalog() {
  const response = await fetch("./data/catalog.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось получить каталог: ${response.status}`);
  }

  const payload = await response.json();
  const cars = Array.isArray(payload?.cars) ? payload.cars : [];
  const updatedAt = typeof payload?.updatedAt === "string" ? payload.updatedAt : "";

  return {
    updatedAt,
    cars: cars.map((car, index) => normalizeCar(car, index, updatedAt)),
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const filterButtons = Array.from(document.querySelectorAll("[data-country-filter]"));
  const inventoryGrid = document.querySelector("[data-inventory-grid]") || document.querySelector(".inventory__grid");
  const inventoryPrev = document.querySelector(".inventory__arrow--prev");
  const inventoryNext = document.querySelector(".inventory__arrow--next");
  const inventoryStatus = document.querySelector("[data-inventory-status]");
  const carModal = document.getElementById("car-modal");

  if (!inventoryGrid || !carModal) {
    return;
  }

  const carModalCloseButtons = Array.from(document.querySelectorAll("[data-car-modal-close]"));
  const carModalImage = document.querySelector("[data-car-modal-image]");
  const carModalStatus = document.querySelector("[data-car-modal-status]");
  const carModalCountry = document.querySelector("[data-car-modal-country]");
  const carModalTitle = document.querySelector("[data-car-modal-title]");
  const carModalLead = document.querySelector("[data-car-modal-lead]");
  const carModalBody = carModal.querySelector(".car-modal__body");
  const carModalSpecs = document.querySelector("[data-car-modal-specs]");
  const carModalPrice = document.querySelector("[data-car-modal-price]");
  const carModalPriceRub = document.querySelector("[data-car-modal-price-rub]");
  const carModalHighlights = document.querySelector("[data-car-modal-highlights]");
  const carModalOrderLink = document.querySelector("[data-car-modal-order]");
  const carModalThumbs = document.querySelector("[data-car-modal-thumbs]");
  const carModalGalleryPrev = document.querySelector("[data-car-modal-gallery-prev]");
  const carModalGalleryNext = document.querySelector("[data-car-modal-gallery-next]");
  const carModalStage = carModal.querySelector(".car-modal__stage");
  const mobileInventoryMedia = window.matchMedia("(max-width: 640px)");

  const state = {
    cars: [],
    carsById: new Map(),
    catalogVersion: "",
    previousFocus: null,
    currentCar: null,
    currentGalleryIndex: 0,
    touchStartX: 0,
    touchStartY: 0,
  };

  function getActiveCountries() {
    const active = filterButtons
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.dataset.countryFilter)
      .filter(Boolean);

    return active.length ? active : filterButtons.map((button) => button.dataset.countryFilter).filter(Boolean);
  }

  function setInventoryStatus(message) {
    if (inventoryStatus) {
      inventoryStatus.textContent = message || "";
      inventoryStatus.hidden = !message;
    }
  }

  function retryImageLoad(image) {
    const rawSrc = image.dataset.imageSrc || DEFAULT_CAR_IMAGE;
    const attempt = Number(image.dataset.retryAttempt || "0");

    if (image.__catalogRetryTimer) {
      window.clearTimeout(image.__catalogRetryTimer);
    }

    if (attempt >= IMAGE_RETRY_DELAYS_MS.length) {
      image.src = DEFAULT_CAR_IMAGE;
      return;
    }

    const nextAttempt = attempt + 1;
    image.dataset.retryAttempt = String(nextAttempt);

    image.__catalogRetryTimer = window.setTimeout(() => {
      if (!image.isConnected) {
        return;
      }

      image.src = buildImageUrl(rawSrc, state.catalogVersion, `${Date.now()}-${nextAttempt}`);
    }, IMAGE_RETRY_DELAYS_MS[attempt]);
  }

  function bindCatalogImages(root) {
    root.querySelectorAll("img[data-car-image][data-image-src]").forEach((image) => {
      if (!image.dataset.imageBound) {
        image.addEventListener("load", () => {
          if (image.__catalogRetryTimer) {
            window.clearTimeout(image.__catalogRetryTimer);
            image.__catalogRetryTimer = null;
          }

          image.dataset.retryAttempt = "0";
        });

        image.addEventListener("error", () => {
          retryImageLoad(image);
        });

        image.dataset.imageBound = "true";
      }

      image.dataset.retryAttempt = "0";
      image.src = buildImageUrl(image.dataset.imageSrc, state.catalogVersion);
    });
  }

  function renderInventory() {
    const activeCountries = getActiveCountries();
    const visibleCars = state.cars.filter((car) => activeCountries.includes(car.countryCode));

    if (!visibleCars.length) {
      inventoryGrid.innerHTML = `
        <div class="inventory__empty">
          <strong>Нет автомобилей по выбранным фильтрам.</strong>
          <span>Снимите часть ограничений или добавьте новые карточки через админ-панель.</span>
        </div>
      `;
      return;
    }

    inventoryGrid.innerHTML = visibleCars.map(createCardMarkup).join("");
    bindCatalogImages(inventoryGrid);

    if (mobileInventoryMedia.matches) {
      inventoryGrid.scrollTo({ left: 0, behavior: "smooth" });
    }
  }

  function getCurrentGallery() {
    return state.currentCar?.gallery || [];
  }

  function updateGalleryControls(galleryLength) {
    const shouldDisable = galleryLength < 2;

    if (carModalGalleryPrev) {
      carModalGalleryPrev.disabled = shouldDisable;
    }

    if (carModalGalleryNext) {
      carModalGalleryNext.disabled = shouldDisable;
    }
  }

  function setGallerySlide(index) {
    const gallery = getCurrentGallery();

    if (!gallery.length || !state.currentCar || !carModalImage) {
      return;
    }

    const safeIndex = ((index % gallery.length) + gallery.length) % gallery.length;
    const slide = gallery[safeIndex];

    state.currentGalleryIndex = safeIndex;
    carModalImage.dataset.carImage = "stage";
    carModalImage.dataset.imageSrc = slide.rawSrc || slide.src;
    carModalImage.dataset.retryAttempt = "0";
    carModalImage.src = buildImageUrl(carModalImage.dataset.imageSrc, state.catalogVersion);
    carModalImage.alt = `${state.currentCar.name} — ${slide.label.toLowerCase()}`;
    carModalImage.style.objectPosition = slide.position;
    carModalImage.style.transform = `scale(${slide.scale})`;

    if (carModalThumbs) {
      carModalThumbs.innerHTML = gallery.map((item, itemIndex) => createThumbMarkup(item, itemIndex, safeIndex)).join("");
      bindCatalogImages(carModalThumbs);
    }

    bindCatalogImages(carModal);

    updateGalleryControls(gallery.length);
  }

  function renderCarModal(car) {
    state.currentCar = car;
    state.currentGalleryIndex = 0;

    if (carModalStatus) {
      carModalStatus.textContent = car.statusLabel;
      carModalStatus.className = `car-modal__status car-modal__status--${car.statusClass}`;
    }

    if (carModalCountry) {
      carModalCountry.textContent = car.countryLabel;
    }

    if (carModalTitle) {
      carModalTitle.textContent = car.name;
    }

    if (carModalLead) {
      carModalLead.textContent = car.lead;
    }

    if (carModalSpecs) {
      carModalSpecs.innerHTML = car.specs.map(createSpecMarkup).join("");
    }

    if (carModalPrice) {
      carModalPrice.textContent = car.price;
    }

    if (carModalPriceRub) {
      carModalPriceRub.textContent = car.priceRub;
    }

    if (carModalHighlights) {
      carModalHighlights.innerHTML = car.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }

    if (carModalOrderLink) {
      carModalOrderLink.href = `./order.html?car=${encodeURIComponent(car.name)}`;
    }

    if (carModalBody) {
      carModalBody.scrollTop = 0;
    }

    setGallerySlide(0);
  }

  function openCarModal(carId) {
    const car = state.carsById.get(carId);

    if (!car) {
      return;
    }

    state.previousFocus = document.activeElement;
    renderCarModal(car);
    carModal.classList.add("is-open");
    carModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");

    const firstFocusable = carModal.querySelector("button, a");
    if (firstFocusable) {
      firstFocusable.focus({ preventScroll: true });
    }
  }

  function closeCarModal() {
    carModal.classList.remove("is-open");
    carModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");

    if (state.previousFocus && typeof state.previousFocus.focus === "function") {
      state.previousFocus.focus({ preventScroll: true });
    }
  }

  function bindFilters() {
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const currentlyPressed = button.getAttribute("aria-pressed") === "true";
        const activeCountries = getActiveCountries();

        if (currentlyPressed && activeCountries.length === 1) {
          filterButtons.forEach((item) => item.setAttribute("aria-pressed", "true"));
        } else {
          button.setAttribute("aria-pressed", currentlyPressed ? "false" : "true");
        }

        renderInventory();
      });
    });

    mobileInventoryMedia.addEventListener("change", renderInventory);
  }

  function bindInventoryEvents() {
    inventoryGrid.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-car-modal-open]");

      if (openButton) {
        openCarModal(openButton.dataset.carId || "");
      }
    });

    if (inventoryPrev) {
      inventoryPrev.addEventListener("click", () => {
        inventoryGrid.scrollBy({ left: -Math.max(280, inventoryGrid.clientWidth * 0.9), behavior: "smooth" });
      });
    }

    if (inventoryNext) {
      inventoryNext.addEventListener("click", () => {
        inventoryGrid.scrollBy({ left: Math.max(280, inventoryGrid.clientWidth * 0.9), behavior: "smooth" });
      });
    }
  }

  function bindModalEvents() {
    carModalCloseButtons.forEach((button) => {
      button.addEventListener("click", closeCarModal);
    });

    if (carModalGalleryPrev) {
      carModalGalleryPrev.addEventListener("click", () => {
        setGallerySlide(state.currentGalleryIndex - 1);
      });
    }

    if (carModalGalleryNext) {
      carModalGalleryNext.addEventListener("click", () => {
        setGallerySlide(state.currentGalleryIndex + 1);
      });
    }

    if (carModalThumbs) {
      carModalThumbs.addEventListener("click", (event) => {
        const button = event.target.closest("[data-car-modal-thumb]");

        if (!button) {
          return;
        }

        setGallerySlide(Number(button.dataset.index || 0));
      });
    }

    if (carModalStage) {
      carModalStage.addEventListener(
        "touchstart",
        (event) => {
          const touch = event.touches[0];

          if (!touch) {
            return;
          }

          state.touchStartX = touch.clientX;
          state.touchStartY = touch.clientY;
        },
        { passive: true },
      );

      carModalStage.addEventListener(
        "touchend",
        (event) => {
          const touch = event.changedTouches[0];

          if (!touch) {
            return;
          }

          const deltaX = touch.clientX - state.touchStartX;
          const deltaY = touch.clientY - state.touchStartY;

          if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) {
            return;
          }

          if (deltaX < 0) {
            setGallerySlide(state.currentGalleryIndex + 1);
          } else {
            setGallerySlide(state.currentGalleryIndex - 1);
          }
        },
        { passive: true },
      );
    }

    carModal.addEventListener("click", (event) => {
      if (event.target === carModal) {
        closeCarModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && carModal.classList.contains("is-open")) {
        closeCarModal();
      }

      if (!carModal.classList.contains("is-open")) {
        return;
      }

      if (event.key === "ArrowLeft") {
        setGallerySlide(state.currentGalleryIndex - 1);
      }

      if (event.key === "ArrowRight") {
        setGallerySlide(state.currentGalleryIndex + 1);
      }
    });
  }

  try {
    setInventoryStatus("Загружаем каталог...");
    const catalogPayload = await loadCatalog();
    state.catalogVersion = catalogPayload.updatedAt || String(Date.now());
    state.cars = catalogPayload.cars;
    state.carsById = new Map(state.cars.map((car) => [car.id, car]));
    bindFilters();
    bindInventoryEvents();
    bindModalEvents();
    renderInventory();
    setInventoryStatus("");
  } catch (error) {
    console.error(error);
    inventoryGrid.innerHTML = `
      <div class="inventory__empty">
        <strong>Каталог временно недоступен.</strong>
        <span>Проверьте файл <code>data/catalog.json</code> или попробуйте открыть сайт через локальный сервер.</span>
      </div>
    `;
    setInventoryStatus("");
  }
});
