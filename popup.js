const UI_STATE_KEY = "captureStatus";
const { getStoredLanguage, setStoredLanguage, translate, resolveMessage, LANGUAGE_STORAGE_KEY } = globalThis.ScreenCaptureI18n;
const { getSettings, SETTINGS_STORAGE_KEY } = globalThis.ScreenCaptureSettings;
const LAST_CAPTURE_PREVIEW_KEY = "lastCapturePreview";

const captureRegionButton = document.getElementById("capture-region");
const captureVisibleButton = document.getElementById("capture-visible");
const captureFullButton = document.getElementById("capture-full");
const openSettingsButton = document.getElementById("open-settings");
const statusCard = document.getElementById("status-card");
const statusMessage = document.getElementById("status-message");
const statusProgress = document.getElementById("status-progress");
const popupTitle = document.getElementById("popup-title");
const popupSubtitle = document.getElementById("popup-subtitle");
const statusLabel = document.getElementById("status-label");
const languageLabel = document.getElementById("language-label");
const languageSelect = document.getElementById("language-select");
const previewBlock = document.getElementById("preview-block");
const previewLabel = document.getElementById("preview-label");
const previewImage = document.getElementById("preview-image");
let currentLanguage = "zh-CN";
let lastStatus = null;
let lastPreview = null;
let currentSettings = null;

captureRegionButton.addEventListener("click", () => {
  startCapture("CAPTURE_REGION");
});

captureVisibleButton.addEventListener("click", () => {
  startCapture("CAPTURE_VISIBLE");
});

captureFullButton.addEventListener("click", () => {
  startCapture("CAPTURE_FULL_PAGE");
});

openSettingsButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

languageSelect.addEventListener("change", async (event) => {
  currentLanguage = await setStoredLanguage(event.target.value);
  applyLanguage();
  renderStatus(lastStatus);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "session" && changes[UI_STATE_KEY]) {
    renderStatus(changes[UI_STATE_KEY].newValue);
  }
  if (areaName === "session" && changes[LAST_CAPTURE_PREVIEW_KEY]) {
    renderPreview(changes[LAST_CAPTURE_PREVIEW_KEY].newValue);
  }
  if (areaName === "local" && changes[SETTINGS_STORAGE_KEY]) {
    currentSettings = changes[SETTINGS_STORAGE_KEY].newValue || currentSettings;
    renderPreview(lastPreview);
  }
  if (areaName === "local" && changes[LANGUAGE_STORAGE_KEY]) {
    currentLanguage = changes[LANGUAGE_STORAGE_KEY].newValue || currentLanguage;
    languageSelect.value = currentLanguage;
    applyLanguage();
    renderStatus(lastStatus);
    renderPreview(lastPreview);
  }
});

initialize().catch((error) => {
  renderStatus({
    phase: "error",
    message: error.message || { key: "popupInitFailed" },
    progress: null,
  });
});

async function initialize() {
  currentLanguage = await getStoredLanguage();
  currentSettings = await getSettings();
  languageSelect.value = currentLanguage;
  applyLanguage();
  const result = await chrome.storage.session.get([UI_STATE_KEY, LAST_CAPTURE_PREVIEW_KEY]);
  renderStatus(result[UI_STATE_KEY]);
  renderPreview(result[LAST_CAPTURE_PREVIEW_KEY]);
}

async function startCapture(type) {
  setButtonsDisabled(true);

  try {
    const response = await chrome.runtime.sendMessage({ type });
    if (!response?.ok) {
      throw new Error(resolveUiMessage(response?.error || { key: "popupLaunchFailed" }, "popupLaunchFailed"));
    }
  } catch (error) {
    renderStatus({
      phase: "error",
      message: error.message || { key: "popupLaunchFailed" },
      progress: null,
    });
    setButtonsDisabled(false);
  }
}

function renderStatus(status) {
  lastStatus = status || null;
  const phase = status?.phase || "idle";
  statusCard.dataset.phase = phase;
  statusMessage.textContent = resolveUiMessage(status?.message || { key: "statusReady" }, "statusReady");

  if (status?.progress?.total) {
    statusProgress.textContent = translate(currentLanguage, "statusProgress", status.progress);
  } else if (phase === "idle") {
    statusProgress.textContent = translate(currentLanguage, "statusClickToStart");
  } else if (phase === "done") {
    statusProgress.textContent = translate(currentLanguage, "statusPreviewReady");
  } else if (phase === "error") {
    statusProgress.textContent = translate(currentLanguage, "statusRetryNormalPage");
  } else {
    statusProgress.textContent = translate(currentLanguage, "statusTaskRunning");
  }

  const busy = ["preparing", "capturing", "stitching"].includes(phase);
  setButtonsDisabled(busy);
}

function setButtonsDisabled(disabled) {
  captureRegionButton.disabled = disabled;
  captureVisibleButton.disabled = disabled;
  captureFullButton.disabled = disabled;
}

function applyLanguage() {
  document.title = translate(currentLanguage, "popupTitle");
  popupTitle.textContent = translate(currentLanguage, "popupTitle");
  popupSubtitle.textContent = translate(currentLanguage, "popupSubtitle");
  captureRegionButton.textContent = translate(currentLanguage, "captureRegion");
  captureVisibleButton.textContent = translate(currentLanguage, "captureVisible");
  captureFullButton.textContent = translate(currentLanguage, "captureFull");
  openSettingsButton.textContent = translate(currentLanguage, "openSettings");
  statusLabel.textContent = translate(currentLanguage, "statusLabel");
  previewLabel.textContent = translate(currentLanguage, "popupPreviewLabel");
  languageLabel.textContent = translate(currentLanguage, "languageLabel");
  languageSelect.options[0].textContent = translate(currentLanguage, "languageChinese");
  languageSelect.options[1].textContent = translate(currentLanguage, "languageEnglish");
  applyPopupCardSettings();
}

function resolveUiMessage(value, fallbackKey) {
  return resolveMessage(currentLanguage, value, fallbackKey);
}

function renderPreview(preview) {
  lastPreview = preview || null;
  if (!currentSettings?.showPopupPreview || !preview?.imageDataUrl) {
    previewBlock.classList.add("hidden");
    previewImage.removeAttribute("src");
    return;
  }

  previewBlock.classList.remove("hidden");
  previewImage.src = preview.imageDataUrl;
}

function applyPopupCardSettings() {
  const scale = currentSettings?.popupCardScale || "standard";
  const background = currentSettings?.popupCardBackground || "default";
  statusCard.dataset.scale = scale;
  statusCard.dataset.background = background;
}
