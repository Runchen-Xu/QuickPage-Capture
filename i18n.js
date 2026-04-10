(function setupScreenCaptureI18n() {
  const LANGUAGE_STORAGE_KEY = "preferredLanguage";
  const DEFAULT_LANGUAGE = "zh-CN";
  const SUPPORTED_LANGUAGES = ["zh-CN", "en"];

  const messages = {
    "zh-CN": {
      appName: "QuickPage Capture",
      popupTitle: "QuickPage Capture",
      popupSubtitle: "支持区域截图、当前可视区域截图与整页截图，结果会自动打开到预览页。",
      captureRegion: "区域截图",
      captureVisible: "截图可视区域",
      captureFull: "截图整页",
      openSettings: "设置",
      statusLabel: "状态",
      statusReady: "准备就绪",
      statusCreated: "任务已创建",
      statusCreatingPreview: "正在创建预览页…",
      statusCaptureVisible: "正在捕获当前可视区域…",
      statusOpeningPreview: "正在打开预览页…",
      statusInjectingScript: "正在注入页面脚本…",
      statusAnalyzingPage: "正在分析页面结构…",
      statusSelectingRegion: "请在页面中拖拽选择截图区域…",
      statusSamplingSegment: "正在滚动采样第 {current} / {total} 段…",
      statusStitchingPreview: "正在预览页拼接图片…",
      statusGeneratingPng: "正在生成最终 PNG…",
      statusDone: "截图已完成，可下载 PNG。",
      statusProgress: "进度 {current} / {total}",
      statusClickToStart: "点击按钮开始截图",
      statusPreviewReady: "预览页已准备好，可导出 PNG/JPEG/PDF 或复制到剪贴板",
      statusRetryNormalPage: "请切换到普通网页后重试",
      statusTaskRunning: "任务执行中，预览页会自动打开",
      popupInitFailed: "初始化失败。",
      popupLaunchFailed: "截图任务启动失败。",
      languageLabel: "语言",
      languageChinese: "中文",
      languageEnglish: "English",
      previewWordmark: "PREVIEW",
      previewPreparingTitle: "正在准备截图…",
      previewPreparingDescription: "请稍候，截图完成后会在这里显示。",
      previewWaitingTask: "等待任务",
      previewWaitingTaskInfo: "等待任务信息…",
      previewConnecting: "正在连接后台服务…",
      exportFormatLabel: "导出格式",
      exportFormatPng: "PNG",
      exportFormatJpeg: "JPEG",
      exportFormatPdf: "PDF",
      previewDownload: "下载 PNG",
      previewDownloadSelected: "导出 {format}",
      previewCopy: "复制到剪贴板",
      previewCopySuccess: "图片已复制到剪贴板。",
      previewCopyFailed: "复制到剪贴板失败。",
      previewExportFailed: "导出失败。",
      previewModeVisible: "可视区域",
      previewModeFull: "整页截图",
      previewModeRegion: "区域截图",
      previewCapturingTitle: "正在采集页面",
      previewCapturingDescription: "请不要手动切换标签页，避免影响截图过程。",
      previewStitchingTitle: "正在拼接最终图片",
      previewStitchingDescription: "预览页正在处理图片数据，完成后可导出 PNG、JPEG 或 PDF。",
      previewDoneTitle: "截图已完成",
      previewDoneDescription: "最终图片已准备好，可以直接预览并下载。",
      previewDoneDescriptionFinal: "预览页已经生成最终图片，确认无误后可导出 PNG、JPEG、PDF 或复制。",
      previewFailedTitle: "截图失败",
      previewFailedDescription: "请返回原页面重试，或切换到普通网页标签页。",
      previewFailedBadge: "任务失败",
      previewInitFailed: "预览页初始化失败。",
      previewMissingJobId: "缺少截图任务 ID，无法加载预览。",
      previewConnectionLost: "后台连接已断开，请重新截图。",
      previewRenderFailed: "预览页拼接失败。",
      previewNoVisibleFrame: "未收到可视区域截图数据。",
      previewNoFullFrames: "未收到整页截图帧数据。",
      previewCanvasUnsupported: "浏览器不支持 Canvas 绘制。",
      previewImageLoadFailed: "图片帧加载失败。",
      sourceUrlUnavailable: "当前来源地址不可用",
      activeTabNotFound: "未找到当前活动标签页。",
      unsupportedPage: "当前页面受 Chrome 限制，无法截图。请在普通网页标签页中使用。",
      tabUrlUnavailable: "当前标签页地址不可用，无法开始截图。",
      tabTitleFallback: "网页截图",
      unknownError: "发生未知错误。",
      jobExpired: "截图任务已过期，请重新发起截图。",
      contentScriptFailed: "页面脚本执行失败。",
      regionInstruction: "拖拽选择截图区域，按 Esc 取消",
      regionSelectionTooSmall: "选区太小，请重新拖拽。",
      regionSelectionCancelled: "已取消区域截图。",
      regionSelectionBusy: "已有区域截图选区正在进行中。",
      settingsTitle: "设置",
      settingsSubtitle: "配置整页截图时对固定栏和悬浮元素的处理方式。",
      optionsHeading: "截图偏好",
      optionsDescription: "这些设置会影响后续截图任务。",
      resultModeLabel: "截图完成后的结果处理方式",
      resultModePreviewTab: "打开预览页",
      resultModePreviewTabDescription: "截图完成后自动打开预览页，可手动选择 PNG、JPEG、PDF 并复制到剪贴板。",
      resultModeAutoDownload: "自动下载，不切到新网页",
      resultModeAutoDownloadDescription: "在后台生成文件并自动下载，尽量不打断当前浏览。",
      autoExportFormatLabel: "自动下载默认格式",
      downloadPathLabel: "下载子目录",
      downloadPathPlaceholder: "例如: Screenshots/Chrome",
      downloadPathDescription: "留空则使用浏览器默认下载目录。这里只能设置默认下载目录下的相对子目录，不能指定任意绝对路径。",
      popupPreviewLabel: "最近一次下载预览",
      popupPreviewToggleLabel: "在插件说明框中显示最近下载预览",
      popupPreviewToggleDescription: "关闭后，popup 状态框不再展示最近一次下载的缩略预览图。",
      popupCardScaleLabel: "说明框大小比例",
      popupCardScaleCompact: "紧凑",
      popupCardScaleStandard: "标准",
      popupCardScaleLarge: "加大",
      popupCardBackgroundLabel: "说明框背景样式",
      popupCardBackgroundDefault: "默认",
      popupCardBackgroundTranslucent: "半透明",
      popupCardBackgroundTransparent: "透明",
      popupCardBackgroundDark: "黑色",
      floatingModeLabel: "整页截图固定栏处理",
      floatingModeSmartHide: "第一页保留，后续隐藏",
      floatingModeSmartHideDescription: "保留顶部真实导航栏，同时避免后续截图里重复出现悬浮元素。",
      floatingModeKeep: "始终保留固定栏",
      floatingModeKeepDescription: "整页截图完整保留固定栏与悬浮菜单，适合需要完整还原页面外观时使用。",
      settingsSaved: "设置已保存。",
      settingsReset: "恢复默认",
      settingsOpenFromPopup: "可在弹窗中直接打开设置页。",
      copyUnsupported: "当前环境不支持复制图片到剪贴板。"
    },
    en: {
      appName: "QuickPage Capture",
      popupTitle: "QuickPage Capture",
      popupSubtitle: "Capture a selected region, the visible area, or the full page. Results open automatically in a preview tab.",
      captureRegion: "Capture Region",
      captureVisible: "Capture Visible Area",
      captureFull: "Capture Full Page",
      openSettings: "Settings",
      statusLabel: "Status",
      statusReady: "Ready",
      statusCreated: "Task created",
      statusCreatingPreview: "Opening preview tab…",
      statusCaptureVisible: "Capturing visible area…",
      statusOpeningPreview: "Switching to preview…",
      statusInjectingScript: "Injecting page script…",
      statusAnalyzingPage: "Inspecting page layout…",
      statusSelectingRegion: "Drag on the page to select a capture area…",
      statusSamplingSegment: "Capturing segment {current} / {total}…",
      statusStitchingPreview: "Rendering the stitched preview…",
      statusGeneratingPng: "Generating the final PNG…",
      statusDone: "Capture complete. PNG is ready.",
      statusProgress: "Progress {current} / {total}",
      statusClickToStart: "Click a button to start capturing",
      statusPreviewReady: "The preview tab is ready. Export PNG/JPEG/PDF or copy the image.",
      statusRetryNormalPage: "Switch to a standard webpage and try again",
      statusTaskRunning: "The task is running and will open the preview tab automatically",
      popupInitFailed: "Initialization failed.",
      popupLaunchFailed: "Failed to start the capture task.",
      languageLabel: "Language",
      languageChinese: "中文",
      languageEnglish: "English",
      previewWordmark: "PREVIEW",
      previewPreparingTitle: "Preparing capture…",
      previewPreparingDescription: "Please wait. The screenshot will appear here when it is ready.",
      previewWaitingTask: "Waiting for task",
      previewWaitingTaskInfo: "Waiting for task details…",
      previewConnecting: "Connecting to the background service…",
      exportFormatLabel: "Export Format",
      exportFormatPng: "PNG",
      exportFormatJpeg: "JPEG",
      exportFormatPdf: "PDF",
      previewDownload: "Download PNG",
      previewDownloadSelected: "Export {format}",
      previewCopy: "Copy to Clipboard",
      previewCopySuccess: "Image copied to the clipboard.",
      previewCopyFailed: "Failed to copy the image to the clipboard.",
      previewExportFailed: "Export failed.",
      previewModeVisible: "Visible Area",
      previewModeFull: "Full Page",
      previewModeRegion: "Selected Region",
      previewCapturingTitle: "Capturing the page",
      previewCapturingDescription: "Do not switch tabs manually during the capture process.",
      previewStitchingTitle: "Building the final image",
      previewStitchingDescription: "The preview page is processing image data. PNG, JPEG, and PDF export will be available when it finishes.",
      previewDoneTitle: "Capture complete",
      previewDoneDescription: "The final image is ready to preview and download.",
      previewDoneDescriptionFinal: "The preview tab has generated the final image. Review it, then export PNG/JPEG/PDF or copy it.",
      previewFailedTitle: "Capture failed",
      previewFailedDescription: "Return to the source page and try again, or switch to a standard webpage tab.",
      previewFailedBadge: "Failed",
      previewInitFailed: "Preview initialization failed.",
      previewMissingJobId: "Missing capture job ID. The preview page cannot load.",
      previewConnectionLost: "Background connection was lost. Run the capture again.",
      previewRenderFailed: "Preview rendering failed.",
      previewNoVisibleFrame: "No visible-area frame was received.",
      previewNoFullFrames: "No full-page frames were received.",
      previewCanvasUnsupported: "Canvas rendering is not supported in this browser.",
      previewImageLoadFailed: "A captured frame could not be loaded.",
      sourceUrlUnavailable: "Source URL is unavailable",
      activeTabNotFound: "No active tab was found.",
      unsupportedPage: "This page cannot be captured because Chrome restricts it. Use the extension on a normal webpage tab.",
      tabUrlUnavailable: "The current tab URL is unavailable, so capture cannot start.",
      tabTitleFallback: "Web Capture",
      unknownError: "An unknown error occurred.",
      jobExpired: "The capture job has expired. Start the capture again.",
      contentScriptFailed: "Page script execution failed.",
      regionInstruction: "Drag to select an area. Press Esc to cancel.",
      regionSelectionTooSmall: "The selected area is too small. Try again.",
      regionSelectionCancelled: "Region capture was cancelled.",
      regionSelectionBusy: "A region selection is already active.",
      settingsTitle: "Settings",
      settingsSubtitle: "Configure how full-page capture should treat sticky and floating UI.",
      optionsHeading: "Capture Preferences",
      optionsDescription: "These settings affect future capture jobs.",
      resultModeLabel: "What should happen after capture finishes",
      resultModePreviewTab: "Open preview tab",
      resultModePreviewTabDescription: "Open the preview page when capture completes so you can choose PNG, JPEG, PDF, or copy the image.",
      resultModeAutoDownload: "Auto-download without switching tabs",
      resultModeAutoDownloadDescription: "Generate the file in the background and download it automatically with minimal interruption.",
      autoExportFormatLabel: "Default format for auto-download",
      downloadPathLabel: "Download subfolder",
      downloadPathPlaceholder: "Example: Screenshots/Chrome",
      downloadPathDescription: "Leave blank to use the browser default Downloads folder. Only a subfolder under Downloads can be set here; arbitrary absolute paths are not supported.",
      popupPreviewLabel: "Latest Download Preview",
      popupPreviewToggleLabel: "Show latest download preview inside the popup",
      popupPreviewToggleDescription: "When disabled, the popup status card will no longer display the latest downloaded thumbnail preview.",
      popupCardScaleLabel: "Popup card size",
      popupCardScaleCompact: "Compact",
      popupCardScaleStandard: "Standard",
      popupCardScaleLarge: "Large",
      popupCardBackgroundLabel: "Popup card background",
      popupCardBackgroundDefault: "Default",
      popupCardBackgroundTranslucent: "Semi-transparent",
      popupCardBackgroundTransparent: "Transparent",
      popupCardBackgroundDark: "Black",
      floatingModeLabel: "Floating UI handling for full-page capture",
      floatingModeSmartHide: "Keep first frame, hide later frames",
      floatingModeSmartHideDescription: "Preserve the real top navigation in the first frame while preventing duplicate floating UI later.",
      floatingModeKeep: "Always keep floating UI",
      floatingModeKeepDescription: "Preserve sticky headers and floating menus through the full-page capture for a closer visual match.",
      settingsSaved: "Settings saved.",
      settingsReset: "Reset to default",
      settingsOpenFromPopup: "You can also open this page directly from the extension popup.",
      copyUnsupported: "Image clipboard copy is not supported in this environment."
    }
  };

  function normalizeLanguage(value) {
    if (value === "en") {
      return "en";
    }
    if (value === "zh" || value === "zh-CN" || value === "zh-Hans") {
      return "zh-CN";
    }
    if (typeof value === "string" && value.toLowerCase().startsWith("zh")) {
      return "zh-CN";
    }
    return DEFAULT_LANGUAGE;
  }

  function getDefaultLanguageFromEnvironment() {
    if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
      return normalizeLanguage(chrome.i18n.getUILanguage());
    }
    if (typeof navigator !== "undefined" && navigator.language) {
      return normalizeLanguage(navigator.language);
    }
    return DEFAULT_LANGUAGE;
  }

  async function getStoredLanguage() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return getDefaultLanguageFromEnvironment();
    }
    const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(result[LANGUAGE_STORAGE_KEY] || getDefaultLanguageFromEnvironment());
  }

  async function setStoredLanguage(language) {
    const normalized = normalizeLanguage(language);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: normalized });
    }
    return normalized;
  }

  function translate(language, key, params = {}, fallback = "") {
    const normalized = normalizeLanguage(language);
    const dictionary = messages[normalized] || messages[DEFAULT_LANGUAGE];
    const template = dictionary[key] || messages[DEFAULT_LANGUAGE][key] || fallback || key;
    return template.replace(/\{(\w+)\}/g, (_, token) => {
      const value = params[token];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  function createMessage(key, params = {}, fallback = "") {
    return {
      key,
      params,
      fallback,
    };
  }

  function resolveMessage(language, value, fallbackKey = "") {
    if (!value) {
      return fallbackKey ? translate(language, fallbackKey) : "";
    }
    if (typeof value === "string") {
      return value;
    }
    const key = value.key || value.messageKey || fallbackKey;
    const params = value.params || value.messageParams || {};
    const fallback = value.fallback || value.message || "";
    return translate(language, key, params, fallback);
  }

  globalThis.ScreenCaptureI18n = {
    LANGUAGE_STORAGE_KEY,
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    messages,
    normalizeLanguage,
    getStoredLanguage,
    setStoredLanguage,
    translate,
    createMessage,
    resolveMessage,
  };
})();
