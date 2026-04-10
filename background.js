importScripts("i18n.js", "settings.js");

const UI_STATE_KEY = "captureStatus";
const PREVIEW_PORT_PREFIX = "preview:";
const JOB_TTL_MS = 5 * 60 * 1000;
const CAPTURE_CALLS_PER_SECOND = chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND || 2;
const MIN_CAPTURE_INTERVAL_MS = Math.ceil(1000 / CAPTURE_CALLS_PER_SECOND) + 80;
const CAPTURE_RETRY_LIMIT = 3;
const {
  getStoredLanguage,
  translate,
  createMessage,
} = globalThis.ScreenCaptureI18n;
const { getSettings } = globalThis.ScreenCaptureSettings;

const jobs = new Map();
let lastCaptureAt = 0;

chrome.runtime.onInstalled.addListener(async () => {
  const language = await getStoredLanguage();
  await setUiState({
    phase: "idle",
    message: createMessage("statusReady"),
    jobId: null,
    mode: null,
    progress: null,
    language,
    updatedAt: Date.now(),
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return false;
  }

  if (
    message.type === "CAPTURE_REGION" ||
    message.type === "CAPTURE_VISIBLE" ||
    message.type === "CAPTURE_FULL_PAGE"
  ) {
    handleCaptureRequest(message.type).catch(async (error) => {
      if (isCancelledError(error)) {
        const language = await getStoredLanguage();
        await setUiState({
          phase: "idle",
          message: createMessage("statusReady"),
          jobId: null,
          mode: null,
          progress: null,
          language,
          updatedAt: Date.now(),
        });
        return;
      }
      await setUiState({
        phase: "error",
        message: normalizeErrorDescriptor(error),
        jobId: null,
        mode: null,
        progress: null,
        language: await getStoredLanguage(),
        updatedAt: Date.now(),
      });
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "PREVIEW_RENDERED") {
    const job = jobs.get(message.jobId);
    if (job) {
      publishStatus(job, {
        phase: "done",
        message: createMessage("statusDone"),
        progress: { current: job.totalFrames || job.frames.length || 1, total: job.totalFrames || job.frames.length || 1 },
      }).catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "CLOSE_PREVIEW_TAB") {
    const job = jobs.get(message.jobId);
    if (job?.previewTabId) {
      chrome.tabs.remove(job.previewTabId).catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "PREVIEW_FAILED") {
    const job = jobs.get(message.jobId);
    if (job) {
      publishError(job, message.error || createMessage("previewRenderFailed")).catch(() => {});
      if (job.settings.resultMode === "auto-download" && job.previewTabId) {
        activatePreview(job.previewTabId).catch(() => {});
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "CLEANUP_JOB") {
    jobs.delete(message.jobId);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith(PREVIEW_PORT_PREFIX)) {
    return;
  }

  const jobId = port.name.slice(PREVIEW_PORT_PREFIX.length);
  const job = jobs.get(jobId);

  if (!job) {
    port.postMessage({
      type: "CAPTURE_ERROR",
      error: createMessage("jobExpired"),
    });
    port.disconnect();
    return;
  }

  job.port = port;
  if (port.sender?.tab?.id) {
    job.previewTabId = port.sender.tab.id;
  }

  port.postMessage({
    type: "JOB_SNAPSHOT",
    snapshot: {
      id: job.id,
      mode: job.mode,
      status: job.status,
      fileName: job.fileName,
      sourceUrl: job.sourceUrl,
      tabTitle: job.tabTitle,
      createdAt: job.createdAt,
      totalFrames: job.totalFrames,
      settings: job.settings,
    },
  });

  for (const frame of job.frames) {
    port.postMessage({
      type: "CAPTURE_FRAME",
      frame,
    });
  }

  if (job.result) {
    port.postMessage({
      type: "CAPTURE_COMPLETE",
      result: job.result,
    });
  }

  if (job.error) {
    port.postMessage({
      type: "CAPTURE_ERROR",
      error: job.error,
    });
  }

  port.onDisconnect.addListener(() => {
    if (job.port === port) {
      job.port = null;
    }
  });
});

async function handleCaptureRequest(messageType) {
  const mode = messageType === "CAPTURE_REGION" ? "region" : messageType === "CAPTURE_VISIBLE" ? "visible" : "full";
  const tab = await getActiveTab();
  assertSupportedTab(tab);
  const language = await getStoredLanguage();
  const settings = await getSettings();

  const job = createJob(mode, tab, language, settings);
  jobs.set(job.id, job);
  scheduleCleanup(job.id);

  if (mode === "region") {
    await captureRegion(job, tab);
    return;
  }

  await setUiState({
    phase: "preparing",
    message: createMessage("statusCreatingPreview"),
    jobId: job.id,
    mode,
    progress: null,
    language,
    updatedAt: Date.now(),
  });

  job.previewTabId = await openPreviewTab(job, tab);

  if (mode === "visible") {
    await captureVisibleArea(job, tab);
    return;
  }

  await captureFullPage(job, tab);
}

async function captureRegion(job, tab) {
  await publishStatus(job, {
    phase: "preparing",
    message: createMessage("statusSelectingRegion"),
    progress: null,
  });

  await ensureContentScript(tab.id);
  const selection = await sendTabMessage(tab.id, { type: "START_REGION_SELECTION" });

  if (!selection || selection.cancelled) {
    jobs.delete(job.id);
    throw createLocalizedError("regionSelectionCancelled");
  }

  await publishStatus(job, {
    phase: "capturing",
    message: createMessage("statusCaptureVisible"),
    progress: { current: 1, total: 1 },
  });

  const imageDataUrl = await captureVisibleTabWithThrottle(tab.windowId);

  const frame = {
    index: 0,
    desiredTop: 0,
    actualScrollY: selection.scrollY || 0,
    viewportHeight: selection.viewportHeight || 0,
    imageDataUrl,
    cropRect: selection.cropRect,
  };

  publishFrame(job, frame);

  job.totalFrames = 1;
  job.result = {
    jobId: job.id,
    mode: "region",
    metrics: {
      viewportWidth: selection.viewportWidth,
      viewportHeight: selection.viewportHeight,
      devicePixelRatio: selection.devicePixelRatio || 1,
    },
    cropRect: selection.cropRect,
    fileName: job.fileName,
    sourceUrl: job.sourceUrl,
    tabTitle: job.tabTitle,
    totalFrames: 1,
  };

  await publishStatus(job, {
    phase: "preparing",
    message: createMessage("statusCreatingPreview"),
    progress: null,
  });

  job.previewTabId = await openPreviewTab(job, tab);

  await publishStatus(job, {
    phase: "stitching",
    message: createMessage("statusOpeningPreview"),
    progress: { current: 1, total: 1 },
  });

  publishCompletion(job);
  await maybeRevealPreview(job);
}

async function captureVisibleArea(job, tab) {
  await publishStatus(job, {
    phase: "capturing",
    message: createMessage("statusCaptureVisible"),
    progress: { current: 1, total: 1 },
  });

  const imageDataUrl = await captureVisibleTabWithThrottle(tab.windowId);

  const frame = {
    index: 0,
    desiredTop: 0,
    actualScrollY: 0,
    viewportHeight: 0,
    imageDataUrl,
  };

  publishFrame(job, frame);

  job.totalFrames = 1;
  job.result = {
    jobId: job.id,
    mode: "visible",
    metrics: null,
    fileName: job.fileName,
    sourceUrl: job.sourceUrl,
    tabTitle: job.tabTitle,
    totalFrames: 1,
  };

  await publishStatus(job, {
    phase: "stitching",
    message: createMessage("statusOpeningPreview"),
    progress: { current: 1, total: 1 },
  });

  publishCompletion(job);
  await maybeRevealPreview(job);
}

async function captureFullPage(job, tab) {
  let restoreNeeded = false;

  try {
    await publishStatus(job, {
      phase: "preparing",
      message: createMessage("statusInjectingScript"),
      progress: null,
    });

    await ensureContentScript(tab.id);

    await publishStatus(job, {
      phase: "preparing",
      message: createMessage("statusAnalyzingPage"),
      progress: null,
    });

    await sendTabMessage(tab.id, { type: "PREPARE_FULL_CAPTURE" });
    restoreNeeded = true;

    let metrics = await sendTabMessage(tab.id, { type: "GET_PAGE_METRICS" });
    let fullHeight = metrics.fullHeight;
    let segmentTops = buildSegmentTops(fullHeight, metrics.viewportHeight);
    job.totalFrames = segmentTops.length;

    for (let index = 0; index < segmentTops.length; index += 1) {
      const desiredTop = segmentTops[index];

      await publishStatus(job, {
        phase: "capturing",
        message: createMessage("statusSamplingSegment", { current: index + 1, total: segmentTops.length }),
        progress: { current: index + 1, total: segmentTops.length },
      });

      const scrollState = await sendTabMessage(tab.id, {
        type: "SCROLL_TO",
        y: desiredTop,
      });

      metrics = scrollState.metrics;
      await delay(120);

      const imageDataUrl = await captureVisibleTabWithThrottle(tab.windowId);

      const frame = {
        index,
        desiredTop,
        actualScrollY: scrollState.scrollY,
        viewportHeight: metrics.viewportHeight,
        imageDataUrl,
      };

      publishFrame(job, frame);

      if (index === 0 && segmentTops.length > 1 && job.settings.floatingUiMode === "smart-hide") {
        await sendTabMessage(tab.id, { type: "HIDE_FLOATING_UI" });
      }

      if (metrics.fullHeight > fullHeight + 1) {
        fullHeight = metrics.fullHeight;
        segmentTops = buildSegmentTops(fullHeight, metrics.viewportHeight);
        job.totalFrames = segmentTops.length;
      }
    }

    metrics = await sendTabMessage(tab.id, { type: "GET_PAGE_METRICS" });

    job.result = {
      jobId: job.id,
      mode: "full",
      metrics: {
        fullWidth: metrics.fullWidth,
        fullHeight: fullHeight,
        viewportWidth: metrics.viewportWidth,
        viewportHeight: metrics.viewportHeight,
        devicePixelRatio: metrics.devicePixelRatio,
      },
      fileName: job.fileName,
      sourceUrl: job.sourceUrl,
      tabTitle: job.tabTitle,
      totalFrames: job.totalFrames,
    };

    await publishStatus(job, {
      phase: "stitching",
      message: createMessage("statusStitchingPreview"),
      progress: { current: job.totalFrames, total: job.totalFrames },
    });

    publishCompletion(job);
    await maybeRevealPreview(job);
  } catch (error) {
    await publishError(job, error);
    await activatePreview(job.previewTabId);
    throw error;
  } finally {
    if (restoreNeeded) {
      try {
        await sendTabMessage(tab.id, { type: "RESTORE_PAGE" });
      } catch (restoreError) {
        console.warn("Failed to restore page state", restoreError);
      }
    }
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const [tab] = tabs;
  if (!tab?.id || !tab.windowId) {
    throw createLocalizedError("activeTabNotFound");
  }
  return tab;
}

function assertSupportedTab(tab) {
  const url = tab.url || "";
  const allowedProtocols = ["http:", "https:", "file:"];

  try {
    const parsed = new URL(url);
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw createLocalizedError("unsupportedPage");
    }
  } catch (error) {
    if (url) {
      throw error;
    }
    throw createLocalizedError("tabUrlUnavailable");
  }
}

function createJob(mode, tab, language, settings) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    mode,
    language,
    settings,
    sourceTabId: tab.id,
    sourceWindowId: tab.windowId,
    sourceUrl: tab.url || "",
    tabTitle: tab.title || translate(language, "tabTitleFallback"),
    fileName: buildFileName(),
    createdAt: Date.now(),
    status: {
      phase: "preparing",
      message: createMessage("statusCreated"),
      progress: null,
    },
    frames: [],
    totalFrames: 0,
    result: null,
    error: null,
    previewTabId: null,
    port: null,
  };
}

async function openPreviewTab(job, sourceTab) {
  const previewUrl = chrome.runtime.getURL(`preview.html?jobId=${encodeURIComponent(job.id)}`);
  const previewTab = await chrome.tabs.create({
    url: previewUrl,
    active: false,
    openerTabId: sourceTab.id,
    index: typeof sourceTab.index === "number" ? sourceTab.index + 1 : undefined,
  });

  return previewTab.id;
}

async function activatePreview(previewTabId) {
  if (!previewTabId) {
    return;
  }

  try {
    await chrome.tabs.update(previewTabId, { active: true });
  } catch (error) {
    console.warn("Failed to activate preview tab", error);
  }
}

async function maybeRevealPreview(job) {
  if (job.settings.resultMode === "preview-tab") {
    await activatePreview(job.previewTabId);
  }
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["i18n.js", "content-script.js"],
  });
}

async function sendTabMessage(tabId, payload) {
  const response = await chrome.tabs.sendMessage(tabId, payload);
  if (response?.error) {
    if (typeof response.error === "string") {
      throw new Error(response.error);
    }
    throw response.error;
  }
  return response;
}

function buildSegmentTops(fullHeight, viewportHeight) {
  if (!viewportHeight || viewportHeight <= 0) {
    return [0];
  }

  const tops = [];
  for (let top = 0; top < fullHeight; top += viewportHeight) {
    tops.push(top);
  }
  return tops.length ? tops : [0];
}

function publishFrame(job, frame) {
  job.frames.push(frame);

  if (job.port) {
    job.port.postMessage({
      type: "CAPTURE_FRAME",
      frame,
    });
  }
}

function publishCompletion(job) {
  if (job.port) {
    job.port.postMessage({
      type: "CAPTURE_COMPLETE",
      result: job.result,
    });
  }
}

async function publishStatus(job, status) {
  job.status = status;

  await setUiState({
    phase: status.phase,
    message: status.message,
    jobId: job.id,
    mode: job.mode,
    progress: status.progress || null,
    language: job.language,
    updatedAt: Date.now(),
  });

  if (job.port) {
    job.port.postMessage({
      type: "CAPTURE_STATUS",
      status,
    });
  }
}

async function publishError(job, errorMessage) {
  const descriptor = normalizeErrorDescriptor(errorMessage);
  job.error = descriptor;

  await setUiState({
    phase: "error",
    message: descriptor,
    jobId: job.id,
    mode: job.mode,
    progress: null,
    language: job.language,
    updatedAt: Date.now(),
  });

  if (job.port) {
    job.port.postMessage({
      type: "CAPTURE_ERROR",
      error: descriptor,
    });
  }
}

async function setUiState(status) {
  await chrome.storage.session.set({
    [UI_STATE_KEY]: status,
  });
}

function normalizeErrorDescriptor(error) {
  if (!error) {
    return createMessage("unknownError");
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.key) {
    return error;
  }
  if (error.localizedKey) {
    return createMessage(error.localizedKey, error.localizedParams || {}, error.message || "");
  }
  if (error.message) {
    return error.message;
  }
  return createMessage("unknownError");
}

async function captureVisibleTabWithThrottle(windowId, attempt = 0) {
  const now = Date.now();
  const waitTime = Math.max(0, MIN_CAPTURE_INTERVAL_MS - (now - lastCaptureAt));

  if (waitTime > 0) {
    await delay(waitTime);
  }

  try {
    const imageDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "png",
    });
    lastCaptureAt = Date.now();
    return imageDataUrl;
  } catch (error) {
    const message = extractErrorMessage(error);
    if (attempt < CAPTURE_RETRY_LIMIT && message.includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND")) {
      await delay(MIN_CAPTURE_INTERVAL_MS * (attempt + 1));
      return captureVisibleTabWithThrottle(windowId, attempt + 1);
    }
    throw error;
  }
}

function createLocalizedError(key, params = {}, fallback = "") {
  const error = new Error(fallback || key);
  error.localizedKey = key;
  error.localizedParams = params;
  return error;
}

function isCancelledError(error) {
  return error?.localizedKey === "regionSelectionCancelled";
}

function extractErrorMessage(error) {
  if (typeof error === "string") {
    return error;
  }
  if (error?.message) {
    return error.message;
  }
  return "";
}

function buildFileName() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ];
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())];
  return `screenshot-${parts.join("")}-${time.join("")}.png`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function scheduleCleanup(jobId) {
  setTimeout(() => {
    jobs.delete(jobId);
  }, JOB_TTL_MS);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
