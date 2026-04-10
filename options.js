const { getStoredLanguage, setStoredLanguage, translate, LANGUAGE_STORAGE_KEY } = globalThis.ScreenCaptureI18n;
const { getSettings, updateSettings, resetSettings, SETTINGS_STORAGE_KEY } = globalThis.ScreenCaptureSettings;

const languageLabel = document.getElementById("language-label");
const languageSelect = document.getElementById("language-select");
const settingsTitle = document.getElementById("settings-title");
const settingsSubtitle = document.getElementById("settings-subtitle");
const optionsHeading = document.getElementById("options-heading");
const optionsDescription = document.getElementById("options-description");
const resultModeLabel = document.getElementById("result-mode-label");
const resultPreviewTitle = document.getElementById("result-preview-title");
const resultPreviewDescription = document.getElementById("result-preview-description");
const resultAutoTitle = document.getElementById("result-auto-title");
const resultAutoDescription = document.getElementById("result-auto-description");
const autoExportFormatLabel = document.getElementById("auto-export-format-label");
const autoExportFormatSelect = document.getElementById("auto-export-format-select");
const downloadPathLabel = document.getElementById("download-path-label");
const downloadPathInput = document.getElementById("download-path-input");
const downloadPathDescription = document.getElementById("download-path-description");
const showPopupPreviewInput = document.getElementById("show-popup-preview-input");
const showPopupPreviewLabel = document.getElementById("show-popup-preview-label");
const showPopupPreviewDescription = document.getElementById("show-popup-preview-description");
const popupCardScaleLabel = document.getElementById("popup-card-scale-label");
const popupCardScaleSelect = document.getElementById("popup-card-scale-select");
const popupCardBackgroundLabel = document.getElementById("popup-card-background-label");
const popupCardBackgroundSelect = document.getElementById("popup-card-background-select");
const floatingModeLabel = document.getElementById("floating-mode-label");
const floatingSmartHideTitle = document.getElementById("floating-smart-hide-title");
const floatingSmartHideDescription = document.getElementById("floating-smart-hide-description");
const floatingKeepTitle = document.getElementById("floating-keep-title");
const floatingKeepDescription = document.getElementById("floating-keep-description");
const resetButton = document.getElementById("reset-button");
const saveState = document.getElementById("save-state");
const settingsFootnote = document.getElementById("settings-footnote");
const resultModeInputs = Array.from(document.querySelectorAll('input[name="result-mode"]'));
const floatingModeInputs = Array.from(document.querySelectorAll('input[name="floating-mode"]'));

let currentLanguage = "zh-CN";

initialize().catch((error) => {
  saveState.textContent = error.message || "";
});

languageSelect.addEventListener("change", async (event) => {
  currentLanguage = await setStoredLanguage(event.target.value);
  applyLanguage();
});

resetButton.addEventListener("click", async () => {
  const settings = await resetSettings();
  syncForm(settings);
  saveState.textContent = translate(currentLanguage, "settingsSaved");
});

for (const input of floatingModeInputs) {
  input.addEventListener("change", async () => {
    await updateSettings({ floatingUiMode: input.value });
    saveState.textContent = translate(currentLanguage, "settingsSaved");
  });
}

for (const input of resultModeInputs) {
  input.addEventListener("change", async () => {
    const settings = await updateSettings({ resultMode: input.value });
    syncForm(settings);
    saveState.textContent = translate(currentLanguage, "settingsSaved");
  });
}

autoExportFormatSelect.addEventListener("change", async () => {
  await updateSettings({ autoExportFormat: autoExportFormatSelect.value });
  saveState.textContent = translate(currentLanguage, "settingsSaved");
});

downloadPathInput.addEventListener("change", async () => {
  await updateSettings({ downloadSubdirectory: downloadPathInput.value });
  const settings = await getSettings();
  downloadPathInput.value = settings.downloadSubdirectory;
  saveState.textContent = translate(currentLanguage, "settingsSaved");
});

showPopupPreviewInput.addEventListener("change", async () => {
  await updateSettings({ showPopupPreview: showPopupPreviewInput.checked });
  saveState.textContent = translate(currentLanguage, "settingsSaved");
});

popupCardScaleSelect.addEventListener("change", async () => {
  await updateSettings({ popupCardScale: popupCardScaleSelect.value });
  saveState.textContent = translate(currentLanguage, "settingsSaved");
});

popupCardBackgroundSelect.addEventListener("change", async () => {
  await updateSettings({ popupCardBackground: popupCardBackgroundSelect.value });
  saveState.textContent = translate(currentLanguage, "settingsSaved");
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[LANGUAGE_STORAGE_KEY]) {
    currentLanguage = changes[LANGUAGE_STORAGE_KEY].newValue || currentLanguage;
    languageSelect.value = currentLanguage;
    applyLanguage();
  }
  if (areaName === "local" && changes[SETTINGS_STORAGE_KEY]) {
    syncForm(changes[SETTINGS_STORAGE_KEY].newValue);
  }
});

async function initialize() {
  currentLanguage = await getStoredLanguage();
  languageSelect.value = currentLanguage;
  applyLanguage();
  syncForm(await getSettings());
}

function syncForm(settings) {
  const floatingValue = settings?.floatingUiMode || "smart-hide";
  const resultModeValue = settings?.resultMode || "preview-tab";
  autoExportFormatSelect.value = settings?.autoExportFormat || "png";
  downloadPathInput.value = settings?.downloadSubdirectory || "";
  showPopupPreviewInput.checked = settings?.showPopupPreview !== false;
  popupCardScaleSelect.value = settings?.popupCardScale || "standard";
  popupCardBackgroundSelect.value = settings?.popupCardBackground || "default";

  for (const input of resultModeInputs) {
    input.checked = input.value === resultModeValue;
  }
  for (const input of floatingModeInputs) {
    input.checked = input.value === floatingValue;
  }
}

function applyLanguage() {
  document.title = translate(currentLanguage, "settingsTitle");
  languageLabel.textContent = translate(currentLanguage, "languageLabel");
  languageSelect.options[0].textContent = translate(currentLanguage, "languageChinese");
  languageSelect.options[1].textContent = translate(currentLanguage, "languageEnglish");
  settingsTitle.textContent = translate(currentLanguage, "settingsTitle");
  settingsSubtitle.textContent = translate(currentLanguage, "settingsSubtitle");
  optionsHeading.textContent = translate(currentLanguage, "optionsHeading");
  optionsDescription.textContent = translate(currentLanguage, "optionsDescription");
  resultModeLabel.textContent = translate(currentLanguage, "resultModeLabel");
  resultPreviewTitle.textContent = translate(currentLanguage, "resultModePreviewTab");
  resultPreviewDescription.textContent = translate(currentLanguage, "resultModePreviewTabDescription");
  resultAutoTitle.textContent = translate(currentLanguage, "resultModeAutoDownload");
  resultAutoDescription.textContent = translate(currentLanguage, "resultModeAutoDownloadDescription");
  autoExportFormatLabel.textContent = translate(currentLanguage, "autoExportFormatLabel");
  autoExportFormatSelect.options[0].textContent = translate(currentLanguage, "exportFormatPng");
  autoExportFormatSelect.options[1].textContent = translate(currentLanguage, "exportFormatJpeg");
  autoExportFormatSelect.options[2].textContent = translate(currentLanguage, "exportFormatPdf");
  downloadPathLabel.textContent = translate(currentLanguage, "downloadPathLabel");
  downloadPathInput.placeholder = translate(currentLanguage, "downloadPathPlaceholder");
  downloadPathDescription.textContent = translate(currentLanguage, "downloadPathDescription");
  showPopupPreviewLabel.textContent = translate(currentLanguage, "popupPreviewToggleLabel");
  showPopupPreviewDescription.textContent = translate(currentLanguage, "popupPreviewToggleDescription");
  popupCardScaleLabel.textContent = translate(currentLanguage, "popupCardScaleLabel");
  popupCardScaleSelect.options[0].textContent = translate(currentLanguage, "popupCardScaleCompact");
  popupCardScaleSelect.options[1].textContent = translate(currentLanguage, "popupCardScaleStandard");
  popupCardScaleSelect.options[2].textContent = translate(currentLanguage, "popupCardScaleLarge");
  popupCardBackgroundLabel.textContent = translate(currentLanguage, "popupCardBackgroundLabel");
  popupCardBackgroundSelect.options[0].textContent = translate(currentLanguage, "popupCardBackgroundDefault");
  popupCardBackgroundSelect.options[1].textContent = translate(currentLanguage, "popupCardBackgroundTranslucent");
  popupCardBackgroundSelect.options[2].textContent = translate(currentLanguage, "popupCardBackgroundTransparent");
  popupCardBackgroundSelect.options[3].textContent = translate(currentLanguage, "popupCardBackgroundDark");
  floatingModeLabel.textContent = translate(currentLanguage, "floatingModeLabel");
  floatingSmartHideTitle.textContent = translate(currentLanguage, "floatingModeSmartHide");
  floatingSmartHideDescription.textContent = translate(currentLanguage, "floatingModeSmartHideDescription");
  floatingKeepTitle.textContent = translate(currentLanguage, "floatingModeKeep");
  floatingKeepDescription.textContent = translate(currentLanguage, "floatingModeKeepDescription");
  resetButton.textContent = translate(currentLanguage, "settingsReset");
  settingsFootnote.textContent = translate(currentLanguage, "settingsOpenFromPopup");
}
