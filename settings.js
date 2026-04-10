(function setupScreenCaptureSettings() {
  const SETTINGS_STORAGE_KEY = "captureSettings";
  const DEFAULT_SETTINGS = {
    floatingUiMode: "smart-hide",
    resultMode: "preview-tab",
    autoExportFormat: "png",
    downloadSubdirectory: "",
    showPopupPreview: true,
    popupCardScale: "standard",
    popupCardBackground: "default",
  };

  function normalizeSettings(input = {}) {
    const floatingUiMode = input.floatingUiMode === "keep" ? "keep" : DEFAULT_SETTINGS.floatingUiMode;
    const resultMode = input.resultMode === "auto-download" ? "auto-download" : DEFAULT_SETTINGS.resultMode;
    const autoExportFormat = ["png", "jpeg", "pdf"].includes(input.autoExportFormat)
      ? input.autoExportFormat
      : DEFAULT_SETTINGS.autoExportFormat;
    const downloadSubdirectory = normalizeSubdirectory(input.downloadSubdirectory);
    const showPopupPreview = input.showPopupPreview !== false;
    const popupCardScale = ["compact", "standard", "large"].includes(input.popupCardScale)
      ? input.popupCardScale
      : DEFAULT_SETTINGS.popupCardScale;
    const popupCardBackground = ["default", "translucent", "transparent", "dark"].includes(input.popupCardBackground)
      ? input.popupCardBackground
      : DEFAULT_SETTINGS.popupCardBackground;
    return {
      floatingUiMode,
      resultMode,
      autoExportFormat,
      downloadSubdirectory,
      showPopupPreview,
      popupCardScale,
      popupCardBackground,
    };
  }

  function normalizeSubdirectory(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .replace(/\\/g, "/")
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment && segment !== "." && segment !== "..")
      .join("/");
  }

  async function getSettings() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return { ...DEFAULT_SETTINGS };
    }
    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    return normalizeSettings(result[SETTINGS_STORAGE_KEY] || DEFAULT_SETTINGS);
  }

  async function updateSettings(partial) {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...partial });
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
    }
    return next;
  }

  async function resetSettings() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS } });
    }
    return { ...DEFAULT_SETTINGS };
  }

  globalThis.ScreenCaptureSettings = {
    SETTINGS_STORAGE_KEY,
    DEFAULT_SETTINGS,
    getSettings,
    updateSettings,
    resetSettings,
    normalizeSettings,
    normalizeSubdirectory,
  };
})();
