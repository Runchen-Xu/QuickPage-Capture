const params = new URLSearchParams(window.location.search);
const jobId = params.get("jobId");
const { getStoredLanguage, setStoredLanguage, translate, resolveMessage, LANGUAGE_STORAGE_KEY } = globalThis.ScreenCaptureI18n;

const title = document.getElementById("title");
const description = document.getElementById("description");
const modeBadge = document.getElementById("mode-badge");
const progressBadge = document.getElementById("progress-badge");
const sourceInfo = document.getElementById("source-info");
const statePanel = document.getElementById("state-panel");
const stateMessage = document.getElementById("state-message");
const imagePanel = document.getElementById("image-panel");
const resultImage = document.getElementById("result-image");
const downloadButton = document.getElementById("download-button");
const copyButton = document.getElementById("copy-button");
const exportFormatLabel = document.getElementById("export-format-label");
const exportFormatSelect = document.getElementById("export-format-select");
const previewWordmark = document.getElementById("preview-wordmark");
const languageLabel = document.getElementById("language-label");
const languageSelect = document.getElementById("language-select");
const LAST_CAPTURE_PREVIEW_KEY = "lastCapturePreview";

const state = {
  job: null,
  result: null,
  frames: new Map(),
  finalDataUrl: null,
  error: null,
  expectedTotalFrames: 0,
  latestStatus: null,
};

let port = null;
let currentLanguage = "zh-CN";

downloadButton.addEventListener("click", async () => {
  if (!state.finalDataUrl || !state.result?.fileName) {
    return;
  }

  try {
    const format = exportFormatSelect.value;
    const exportPayload = await createExportPayload(format);
    await downloadBlob(exportPayload.blob, exportPayload.fileName, state.job?.settings?.downloadSubdirectory || "");
    await storeLastPreview();
  } catch (error) {
    stateMessage.textContent = error.message || translate(currentLanguage, "previewExportFailed");
  }
});

copyButton.addEventListener("click", async () => {
  if (!state.finalDataUrl) {
    return;
  }

  try {
    await copyCurrentImageToClipboard();
  } catch (error) {
    stateMessage.textContent = error.message || translate(currentLanguage, "previewCopyFailed");
  }
});

languageSelect.addEventListener("change", async (event) => {
  currentLanguage = await setStoredLanguage(event.target.value);
  applyLanguage();
  rerender();
});

exportFormatSelect.addEventListener("change", () => {
  applyDownloadLabel();
});

initialize().catch((error) => {
  renderError(error.message || { key: "previewInitFailed" });
});

async function initialize() {
  currentLanguage = await getStoredLanguage();
  languageSelect.value = currentLanguage;
  applyLanguage();

  if (!jobId) {
    throw new Error(translate(currentLanguage, "previewMissingJobId"));
  }

  port = chrome.runtime.connect({ name: `preview:${jobId}` });
  port.onMessage.addListener(handlePortMessage);
  port.onDisconnect.addListener(() => {
    if (!state.result && !state.error) {
      renderError({ key: "previewConnectionLost" });
    }
  });

  window.addEventListener("beforeunload", () => {
    chrome.runtime.sendMessage({ type: "CLEANUP_JOB", jobId }).catch(() => {});
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[LANGUAGE_STORAGE_KEY]) {
      currentLanguage = changes[LANGUAGE_STORAGE_KEY].newValue || currentLanguage;
      languageSelect.value = currentLanguage;
      applyLanguage();
      rerender();
    }
  });
}

async function handlePortMessage(message) {
  switch (message.type) {
    case "JOB_SNAPSHOT":
      state.job = message.snapshot;
      if (state.job?.settings?.autoExportFormat) {
        exportFormatSelect.value = state.job.settings.autoExportFormat;
      }
      applyDownloadLabel();
      renderSnapshot(message.snapshot);
      break;
    case "CAPTURE_STATUS":
      state.latestStatus = message.status;
      renderStatus(message.status);
      break;
    case "CAPTURE_FRAME":
      storeFrame(message.frame);
      renderProgress();
      break;
    case "CAPTURE_COMPLETE":
      state.result = message.result;
      await finalizeResult();
      break;
    case "CAPTURE_ERROR":
      renderError(message.error || { key: "previewRenderFailed" });
      break;
    default:
      break;
  }
}

function storeFrame(frame) {
  if (!frame || state.frames.has(frame.index)) {
    return;
  }
  state.frames.set(frame.index, frame);
}

function renderSnapshot(snapshot) {
  state.error = null;
  state.expectedTotalFrames = snapshot.totalFrames || state.expectedTotalFrames || 0;
  title.textContent = translate(currentLanguage, "previewPreparingTitle");
  description.textContent = translate(currentLanguage, "previewPreparingDescription");
  modeBadge.textContent = snapshot.mode === "full" ? translate(currentLanguage, "previewModeFull") : translate(currentLanguage, "previewModeVisible");
  if (snapshot.mode === "region") {
    modeBadge.textContent = translate(currentLanguage, "previewModeRegion");
  }
  progressBadge.textContent = `0 / ${state.expectedTotalFrames}`;
  sourceInfo.textContent = snapshot.sourceUrl || translate(currentLanguage, "sourceUrlUnavailable");

  if (snapshot.status) {
    renderStatus(snapshot.status);
  }
}

function renderStatus(status) {
  state.error = null;
  state.latestStatus = status;
  const phase = status?.phase || "preparing";
  statePanel.classList.toggle("error", phase === "error");
  stateMessage.textContent = resolveUiMessage(status?.message || { key: "previewPreparingTitle" }, "previewPreparingTitle");

  if (phase === "capturing") {
    title.textContent = translate(currentLanguage, "previewCapturingTitle");
    description.textContent = translate(currentLanguage, "previewCapturingDescription");
  } else if (phase === "stitching") {
    title.textContent = translate(currentLanguage, "previewStitchingTitle");
    description.textContent = translate(currentLanguage, "previewStitchingDescription");
  } else if (phase === "done") {
    title.textContent = translate(currentLanguage, "previewDoneTitle");
    description.textContent = translate(currentLanguage, "previewDoneDescription");
  }

  if (status?.progress?.total) {
    state.expectedTotalFrames = status.progress.total;
    progressBadge.textContent = `${status.progress.current} / ${status.progress.total}`;
  }
}

function renderProgress() {
  const total = state.result?.totalFrames || state.expectedTotalFrames || state.job?.totalFrames || state.frames.size;
  progressBadge.textContent = `${state.frames.size} / ${total || 0}`;
}

async function finalizeResult() {
  try {
    renderStatus({
      phase: "stitching",
      message: { key: "statusGeneratingPng" },
      progress: {
        current: state.frames.size,
        total: state.result?.totalFrames || state.frames.size,
      },
    });

    if (state.result.mode === "visible") {
      const frame = state.frames.get(0);
      if (!frame) {
        throw new Error(translate(currentLanguage, "previewNoVisibleFrame"));
      }
      state.finalDataUrl = frame.imageDataUrl;
    } else if (state.result.mode === "region") {
      const frame = state.frames.get(0);
      if (!frame) {
        throw new Error(translate(currentLanguage, "previewNoVisibleFrame"));
      }
      state.finalDataUrl = await cropRegionImage(state.result, frame);
    } else {
      state.finalDataUrl = await stitchFullPage(state.result, Array.from(state.frames.values()));
    }

    resultImage.src = state.finalDataUrl;
    imagePanel.classList.remove("hidden");
    downloadButton.disabled = false;
    copyButton.disabled = false;
    title.textContent = translate(currentLanguage, "previewDoneTitle");
    description.textContent = translate(currentLanguage, "previewDoneDescriptionFinal");
    sourceInfo.textContent = state.result.sourceUrl || translate(currentLanguage, "sourceUrlUnavailable");
    renderProgress();

    await chrome.runtime.sendMessage({
      type: "PREVIEW_RENDERED",
      jobId,
    });

    let regionCopied = false;
    if (state.result.mode === "region") {
      try {
        await copyCurrentImageToClipboard();
        regionCopied = true;
      } catch (error) {
        stateMessage.textContent = error.message || translate(currentLanguage, "previewCopyFailed");
      }
    }

    if (state.job?.settings?.resultMode === "auto-download") {
      if (state.result.mode === "region" && regionCopied) {
        await chrome.runtime.sendMessage({
          type: "CLOSE_PREVIEW_TAB",
          jobId,
        }).catch(() => {});
        return;
      }
      exportFormatSelect.value = state.job.settings.autoExportFormat || exportFormatSelect.value;
      applyDownloadLabel();
      const exportPayload = await createExportPayload(exportFormatSelect.value);
      await downloadBlob(exportPayload.blob, exportPayload.fileName, state.job.settings.downloadSubdirectory || "");
      await storeLastPreview();
      await chrome.runtime.sendMessage({
        type: "CLOSE_PREVIEW_TAB",
        jobId,
      }).catch(() => {});
      return;
    }
  } catch (error) {
    await chrome.runtime.sendMessage({
      type: "PREVIEW_FAILED",
      jobId,
      error: error.message || { key: "previewRenderFailed" },
    }).catch(() => {});
    renderError(error.message || { key: "previewRenderFailed" });
  }
}

async function cropRegionImage(result, frame) {
  const image = await loadImage(frame.imageDataUrl);
  const cropRect = frame.cropRect || result.cropRect;
  const viewportWidth = result.metrics?.viewportWidth || image.naturalWidth;
  const viewportHeight = result.metrics?.viewportHeight || image.naturalHeight;
  const scaleX = image.naturalWidth / viewportWidth;
  const scaleY = image.naturalHeight / viewportHeight;
  const sourceX = Math.round(cropRect.x * scaleX);
  const sourceY = Math.round(cropRect.y * scaleY);
  const sourceWidth = Math.max(1, Math.round(cropRect.width * scaleX));
  const sourceHeight = Math.max(1, Math.round(cropRect.height * scaleY));

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(translate(currentLanguage, "previewCanvasUnsupported"));
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  return canvas.toDataURL("image/png");
}

async function stitchFullPage(result, frames) {
  if (!frames.length) {
    throw new Error(translate(currentLanguage, "previewNoFullFrames"));
  }

  const metrics = result.metrics;
  const sortedFrames = frames.sort((left, right) => left.index - right.index);
  const loadedFrames = await Promise.all(
    sortedFrames.map(async (frame) => ({
      ...frame,
      image: await loadImage(frame.imageDataUrl),
    }))
  );

  const dpr = metrics.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = loadedFrames[0].image.naturalWidth;
  canvas.height = Math.max(1, Math.round(metrics.fullHeight * dpr));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(translate(currentLanguage, "previewCanvasUnsupported"));
  }

  for (const frame of loadedFrames) {
    const drawTopPx = Math.round(frame.desiredTop * dpr);
    const sourceOffsetPx = Math.max(0, Math.round((frame.desiredTop - frame.actualScrollY) * dpr));
    const drawHeightCss = Math.min(frame.viewportHeight || metrics.viewportHeight, metrics.fullHeight - frame.desiredTop);
    const drawHeightPx = Math.max(1, Math.round(drawHeightCss * dpr));
    const sourceHeightPx = Math.min(drawHeightPx, frame.image.naturalHeight - sourceOffsetPx);

    context.drawImage(
      frame.image,
      0,
      sourceOffsetPx,
      frame.image.naturalWidth,
      sourceHeightPx,
      0,
      drawTopPx,
      canvas.width,
      sourceHeightPx
    );
  }

  return canvas.toDataURL("image/png");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(translate(currentLanguage, "previewImageLoadFailed")));
    image.src = dataUrl;
  });
}

function renderError(message) {
  state.error = message;
  statePanel.classList.add("error");
  title.textContent = translate(currentLanguage, "previewFailedTitle");
  description.textContent = translate(currentLanguage, "previewFailedDescription");
  stateMessage.textContent = resolveUiMessage(message, "previewRenderFailed");
  modeBadge.textContent = translate(currentLanguage, "previewFailedBadge");
  progressBadge.textContent = `${state.frames.size} / ${state.result?.totalFrames || state.expectedTotalFrames || state.job?.totalFrames || 0}`;
  downloadButton.disabled = true;
  copyButton.disabled = true;
}

function applyLanguage() {
  document.title = `${translate(currentLanguage, "appName")} - ${translate(currentLanguage, "previewWordmark")}`;
  previewWordmark.textContent = translate(currentLanguage, "previewWordmark");
  languageLabel.textContent = translate(currentLanguage, "languageLabel");
  languageSelect.options[0].textContent = translate(currentLanguage, "languageChinese");
  languageSelect.options[1].textContent = translate(currentLanguage, "languageEnglish");
  exportFormatLabel.textContent = translate(currentLanguage, "exportFormatLabel");
  exportFormatSelect.options[0].textContent = translate(currentLanguage, "exportFormatPng");
  exportFormatSelect.options[1].textContent = translate(currentLanguage, "exportFormatJpeg");
  exportFormatSelect.options[2].textContent = translate(currentLanguage, "exportFormatPdf");
  copyButton.textContent = translate(currentLanguage, "previewCopy");
  applyDownloadLabel();
}

function rerender() {
  if (state.error) {
    renderError(state.error);
    return;
  }

  if (state.result && state.finalDataUrl) {
    title.textContent = translate(currentLanguage, "previewDoneTitle");
    description.textContent = translate(currentLanguage, "previewDoneDescriptionFinal");
    modeBadge.textContent = getModeLabel(state.result.mode);
    sourceInfo.textContent = state.result.sourceUrl || translate(currentLanguage, "sourceUrlUnavailable");
    downloadButton.disabled = false;
    copyButton.disabled = false;
    renderProgress();
    return;
  }

  if (state.latestStatus) {
    renderStatus(state.latestStatus);
    modeBadge.textContent = getModeLabel(state.job?.mode);
    sourceInfo.textContent = state.job?.sourceUrl || translate(currentLanguage, "sourceUrlUnavailable");
    return;
  }

  if (state.job) {
    renderSnapshot(state.job);
    return;
  }

  title.textContent = translate(currentLanguage, "previewPreparingTitle");
  description.textContent = translate(currentLanguage, "previewPreparingDescription");
  modeBadge.textContent = translate(currentLanguage, "previewWaitingTask");
  sourceInfo.textContent = translate(currentLanguage, "previewWaitingTaskInfo");
  stateMessage.textContent = translate(currentLanguage, "previewConnecting");
}

function resolveUiMessage(value, fallbackKey) {
  return resolveMessage(currentLanguage, value, fallbackKey);
}

function getModeLabel(mode) {
  if (mode === "full") {
    return translate(currentLanguage, "previewModeFull");
  }
  if (mode === "region") {
    return translate(currentLanguage, "previewModeRegion");
  }
  return translate(currentLanguage, "previewModeVisible");
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function createExportPayload(format) {
  if (format === "jpeg") {
    const jpegBlob = await renderRasterBlob(state.finalDataUrl, "image/jpeg", 0.92);
    return {
      blob: jpegBlob,
      fileName: replaceFileExtension(state.result.fileName, "jpg"),
    };
  }

  if (format === "pdf") {
    const pdfBlob = await createPdfBlob(state.finalDataUrl);
    return {
      blob: pdfBlob,
      fileName: replaceFileExtension(state.result.fileName, "pdf"),
    };
  }

  const pngBlob = await dataUrlToBlob(state.finalDataUrl);
  return {
    blob: pngBlob,
    fileName: replaceFileExtension(state.result.fileName, "png"),
  };
}

async function renderRasterBlob(dataUrl, mimeType, quality = 0.92) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(translate(currentLanguage, "previewCanvasUnsupported"));
  }

  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(translate(currentLanguage, "previewExportFailed")));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

async function createPdfBlob(dataUrl) {
  const image = await loadImage(dataUrl);
  const jpegBlob = await renderRasterBlob(dataUrl, "image/jpeg", 0.92);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pxToPt = 72 / 96;
  const maxPdfDimension = 14400;
  const baseWidth = image.naturalWidth * pxToPt;
  const baseHeight = image.naturalHeight * pxToPt;
  const scale = Math.min(1, maxPdfDimension / Math.max(baseWidth, baseHeight));
  const pageWidth = formatPdfNumber(baseWidth * scale);
  const pageHeight = formatPdfNumber(baseHeight * scale);
  const contentStream = new TextEncoder().encode(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`);
  const objects = [
    { body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    },
    {
      body: `<< /Type /XObject /Subtype /Image /Width ${image.naturalWidth} /Height ${image.naturalHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,
      stream: jpegBytes,
    },
    {
      body: `<< /Length ${contentStream.length} >>`,
      stream: contentStream,
    },
  ];

  const pdfBytes = buildPdfDocument(objects);
  return pdfBytes;
}

function buildPdfDocument(objects) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let length = 0;

  function pushBytes(bytes) {
    chunks.push(bytes);
    length += bytes.length;
  }

  function pushText(text) {
    pushBytes(encoder.encode(text));
  }

  pushBytes(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));

  objects.forEach((object, index) => {
    offsets[index + 1] = length;
    pushText(`${index + 1} 0 obj\n`);
    pushText(`${object.body}\n`);
    if (object.stream) {
      pushText("stream\n");
      pushBytes(object.stream);
      pushText("\nendstream\n");
    }
    pushText("endobj\n");
  });

  const xrefOffset = length;
  pushText(`xref\n0 ${objects.length + 1}\n`);
  pushText("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    pushText(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

function replaceFileExtension(fileName, extension) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName}.${extension}`;
}

async function downloadBlob(blob, fileName, subdirectory = "") {
  const url = URL.createObjectURL(blob);
  const filename = buildDownloadFilename(fileName, subdirectory);

  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: "uniquify",
    });
    await waitForDownloadCompletion(downloadId);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

function formatPdfNumber(value) {
  return Number(value.toFixed(2)).toString();
}

function applyDownloadLabel() {
  const selectedText = exportFormatSelect.options[exportFormatSelect.selectedIndex]?.textContent || exportFormatSelect.value.toUpperCase();
  downloadButton.textContent = translate(currentLanguage, "previewDownloadSelected", { format: selectedText });
}

function buildDownloadFilename(fileName, subdirectory) {
  const normalized = (subdirectory || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

  return normalized ? `${normalized}/${fileName}` : fileName;
}

function waitForDownloadCompletion(downloadId) {
  return new Promise((resolve, reject) => {
    function handleChange(delta) {
      if (delta.id !== downloadId) {
        return;
      }

      if (delta.state?.current === "complete") {
        chrome.downloads.onChanged.removeListener(handleChange);
        resolve();
        return;
      }

      if (delta.state?.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(handleChange);
        reject(new Error(translate(currentLanguage, "previewExportFailed")));
      }
    }

    chrome.downloads.onChanged.addListener(handleChange);
  });
}

async function storeLastPreview() {
  if (!state.finalDataUrl) {
    return;
  }

  const thumbnailDataUrl = await createThumbnailDataUrl(state.finalDataUrl, 320, 220);
  await chrome.storage.session.set({
    [LAST_CAPTURE_PREVIEW_KEY]: {
      imageDataUrl: thumbnailDataUrl,
      fileName: state.result?.fileName || "",
      mode: state.result?.mode || "",
      sourceUrl: state.result?.sourceUrl || "",
      savedAt: Date.now(),
    },
  });
}

async function copyCurrentImageToClipboard() {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error(translate(currentLanguage, "copyUnsupported"));
  }
  const blob = await dataUrlToBlob(state.finalDataUrl);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  stateMessage.textContent = translate(currentLanguage, "previewCopySuccess");
}

async function createThumbnailDataUrl(dataUrl, maxWidth, maxHeight) {
  const image = await loadImage(dataUrl);
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(translate(currentLanguage, "previewCanvasUnsupported"));
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
