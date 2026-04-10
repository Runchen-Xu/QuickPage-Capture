(function installPageCaptureScript() {
  if (globalThis.__pageCaptureToolInstalled) {
    return;
  }

  globalThis.__pageCaptureToolInstalled = true;
  const { createMessage, getStoredLanguage, translate } = globalThis.ScreenCaptureI18n || {
    createMessage(key, params = {}, fallback = "") {
      return { key, params, fallback };
    },
    async getStoredLanguage() {
      return "zh-CN";
    },
    translate(language, key, params = {}, fallback = key) {
      return fallback;
    },
  };

  const state = {
    prepared: false,
    originalScrollX: 0,
    originalScrollY: 0,
    floatingElements: [],
    hiddenElements: [],
    scrollbarStyleElement: null,
    rootScrollBehavior: null,
    bodyScrollBehavior: null,
    selectionSession: null,
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      return false;
    }

    handleMessage(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error.message || createMessage("contentScriptFailed") }));

    return true;
  });

  async function handleMessage(message) {
    switch (message.type) {
      case "GET_PAGE_METRICS":
        return collectMetrics();
      case "PREPARE_FULL_CAPTURE":
        preparePage();
        return collectMetrics();
      case "START_REGION_SELECTION":
        return startRegionSelection();
      case "HIDE_FLOATING_UI":
        hideFloatingElements();
        return collectMetrics();
      case "SCROLL_TO":
        return scrollToPosition(message.y || 0);
      case "RESTORE_PAGE":
        restorePage();
        return collectMetrics();
      default:
        return null;
    }
  }

  function preparePage() {
    if (state.prepared) {
      return;
    }

    state.prepared = true;
    state.originalScrollX = window.scrollX;
    state.originalScrollY = window.scrollY;
    state.floatingElements = [];
    state.hiddenElements = [];
    state.rootScrollBehavior = document.documentElement.style.getPropertyValue("scroll-behavior");
    state.bodyScrollBehavior = document.body?.style.getPropertyValue("scroll-behavior") || "";

    document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
    if (document.body) {
      document.body.style.setProperty("scroll-behavior", "auto", "important");
    }

    state.scrollbarStyleElement = document.createElement("style");
    state.scrollbarStyleElement.setAttribute("data-page-capture-scrollbar", "true");
    state.scrollbarStyleElement.textContent = `
      html {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }

      html::-webkit-scrollbar,
      body::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `;
    document.documentElement.appendChild(state.scrollbarStyleElement);

    const elements = Array.from(document.querySelectorAll("*"));
    for (const element of elements) {
      const style = window.getComputedStyle(element);
      if (style.position !== "fixed" && style.position !== "sticky") {
        continue;
      }

      state.floatingElements.push({
        element,
        value: element.style.getPropertyValue("visibility"),
        priority: element.style.getPropertyPriority("visibility"),
      });
    }
  }

  function hideFloatingElements() {
    if (!state.prepared || state.hiddenElements.length > 0) {
      return;
    }

    state.hiddenElements = state.floatingElements.map((entry) => ({
      element: entry.element,
      value: entry.value,
      priority: entry.priority,
    }));

    for (const entry of state.hiddenElements) {
      entry.element.style.setProperty("visibility", "hidden", "important");
    }
  }

  async function scrollToPosition(y) {
    window.scrollTo(0, y);
    await waitForPaint();

    return {
      scrollY: window.scrollY,
      metrics: collectMetrics(),
    };
  }

  function restorePage() {
    if (!state.prepared) {
      return;
    }

    for (const entry of state.hiddenElements) {
      if (entry.priority) {
        entry.element.style.setProperty("visibility", entry.value, entry.priority);
      } else if (entry.value) {
        entry.element.style.setProperty("visibility", entry.value);
      } else {
        entry.element.style.removeProperty("visibility");
      }
    }

    if (state.rootScrollBehavior) {
      document.documentElement.style.setProperty("scroll-behavior", state.rootScrollBehavior);
    } else {
      document.documentElement.style.removeProperty("scroll-behavior");
    }

    if (document.body) {
      if (state.bodyScrollBehavior) {
        document.body.style.setProperty("scroll-behavior", state.bodyScrollBehavior);
      } else {
        document.body.style.removeProperty("scroll-behavior");
      }
    }

    window.scrollTo(state.originalScrollX, state.originalScrollY);

    if (state.scrollbarStyleElement?.isConnected) {
      state.scrollbarStyleElement.remove();
    }

    state.prepared = false;
    state.floatingElements = [];
    state.hiddenElements = [];
    state.scrollbarStyleElement = null;
  }

  function collectMetrics() {
    const body = document.body;
    const doc = document.documentElement;

    const fullWidth = Math.max(
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0,
      doc.scrollWidth,
      doc.offsetWidth,
      doc.clientWidth
    );

    const fullHeight = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc.scrollHeight,
      doc.offsetHeight,
      doc.clientHeight
    );

    return {
      fullWidth,
      fullHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }

  async function startRegionSelection() {
    if (state.selectionSession) {
      throw new Error(translate(await getStoredLanguage(), "regionSelectionBusy"));
    }

    const language = await getStoredLanguage();
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      const hint = document.createElement("div");
      const box = document.createElement("div");
      let startX = 0;
      let startY = 0;
      let selecting = false;

      overlay.setAttribute("data-screen-capture-selection", "true");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "2147483647";
      overlay.style.cursor = "crosshair";
      overlay.style.background = "rgba(17, 24, 39, 0.18)";
      overlay.style.userSelect = "none";

      hint.textContent = translate(language, "regionInstruction");
      hint.style.position = "fixed";
      hint.style.top = "18px";
      hint.style.left = "50%";
      hint.style.transform = "translateX(-50%)";
      hint.style.padding = "10px 14px";
      hint.style.borderRadius = "999px";
      hint.style.font = '600 13px "SF Pro Display", "PingFang SC", sans-serif';
      hint.style.color = "#ffffff";
      hint.style.background = "rgba(15, 23, 42, 0.8)";
      hint.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.28)";

      box.style.position = "fixed";
      box.style.border = "2px solid #0f766e";
      box.style.borderRadius = "12px";
      box.style.background = "rgba(15, 118, 110, 0.12)";
      box.style.boxShadow = "0 0 0 9999px rgba(15, 23, 42, 0.18)";
      box.style.display = "none";
      box.style.pointerEvents = "none";

      overlay.append(hint, box);
      document.documentElement.appendChild(overlay);

      function cleanup(result, waitAfterRemoval = false) {
        window.removeEventListener("pointermove", onPointerMove, true);
        window.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("keydown", onKeyDown, true);
        if (overlay.isConnected) {
          overlay.remove();
        }
        state.selectionSession = null;
        if (waitAfterRemoval) {
          waitForPaint().then(() => resolve(result));
          return;
        }
        resolve(result);
      }

      function updateBox(currentX, currentY) {
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        box.style.display = "block";
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
      }

      function onPointerMove(event) {
        if (!selecting) {
          return;
        }
        event.preventDefault();
        updateBox(event.clientX, event.clientY);
      }

      async function onPointerUp(event) {
        if (!selecting) {
          return;
        }
        selecting = false;
        event.preventDefault();
        const left = Math.min(startX, event.clientX);
        const top = Math.min(startY, event.clientY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);

        if (width < 8 || height < 8) {
          cleanup({
            cancelled: true,
          });
          return;
        }

        cleanup({
          cancelled: false,
          cropRect: { x: left, y: top, width, height },
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
          scrollY: window.scrollY,
        }, true);
      }

      function onKeyDown(event) {
        if (event.key !== "Escape") {
          return;
        }
        event.preventDefault();
        cleanup({ cancelled: true });
      }

      overlay.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          startX = event.clientX;
          startY = event.clientY;
          selecting = true;
          updateBox(startX, startY);
        },
        true
      );

      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("keydown", onKeyDown, true);
      state.selectionSession = { cleanup };
    });
  }

  function waitForPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }
})();
