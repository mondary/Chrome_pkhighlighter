// ==UserScript==
// @name         PK Keyword Highlighter
// @namespace    https://github.com/mondary
// @version      0.3.6
// @description  Highlight keywords with colors and strike-through excluded terms, per site.
// @match        https://mail.google.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
Usage:
- Install with a userscript manager (Tampermonkey/Violentmonkey).
- Click the "HL" button to open the panel.
- Enter comma-separated keywords to highlight and exclude, then Save.
- Settings persist per hostname via localStorage.
*/

(() => {
  "use strict";

  const STORAGE_PREFIX = "pkh:keyword-highlighter:";
  const APPLY_DEBOUNCE_MS = 250;
  const overlayId = "pkh-overlay";
  const toggleId = "pkh-toggle";
  const tokenClass = "pkh-token";

  let applyTimer = null;
  let isApplying = false;
  let dragState = null;

  function storageKey() {
    return STORAGE_PREFIX + window.location.hostname;
  }

  function loadConfig() {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) {
      return { highlight: [], exclude: [], style: "sticker" };
    }
    try {
      const parsed = JSON.parse(raw);
      const style =
        parsed.style === "sticker-v1" ? "origami" : parsed.style;
      return {
        highlight: Array.isArray(parsed.highlight) ? parsed.highlight : [],
        exclude: Array.isArray(parsed.exclude) ? parsed.exclude : [],
        style: typeof style === "string" ? style : "sticker",
      };
    } catch {
      return { highlight: [], exclude: [], style: "sticker" };
    }
  }

  function saveConfig(config) {
    window.localStorage.setItem(storageKey(), JSON.stringify(config));
  }

  function normalizeList(value) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function highlightColorFor(word) {
    const hash = hashString(word.toLowerCase());
    const hue = hash % 360;
    return `hsl(${hue} 100% 55%)`;
  }

  function highlightTiltFor(word) {
    const hash = hashString(word.toLowerCase());
    const step = (hash % 5) - 2;
    return `${step * 0.6}deg`;
  }

  function textColorFor(bg) {
    const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(bg);
    if (!m) return "#1a1a1a";
    const lightness = Number(m[3]);
    return lightness > 65 ? "#1a1a1a" : "#ffffff";
  }

  function normalizeToken(value) {
    return value
      .toLowerCase()
      .replace(/[\s\u00A0\u202F\u2009\u2007]+/g, " ")
      .trim();
  }

  function buildTokenMap(config) {
    const highlight = new Map();
    const exclude = new Set();
    config.exclude.forEach((word) => {
      const normalized = normalizeToken(word);
      if (normalized) exclude.add(normalized);
    });
    config.highlight.forEach((word) => {
      const normalized = normalizeToken(word);
      if (!normalized || exclude.has(normalized)) return;
      highlight.set(normalized, word);
    });
    return { highlight, exclude };
  }

  function tokenToPattern(token) {
    const parts = token.split(" ").map((part) => escapeRegExp(part));
    return parts.join("[\\s\\u00A0\\u202F\\u2009\\u2007]+");
  }

  function withBoundaries(pattern, token) {
    const startsWord = /\w/.test(token[0] || "");
    const endsWord = /\w/.test(token[token.length - 1] || "");
    let result = pattern;
    if (startsWord) result = `\\b${result}`;
    if (endsWord) result = `${result}\\b`;
    return result;
  }

  function buildRegexFromList(list) {
    const all = list.map((word) => normalizeToken(word)).filter(Boolean);

    if (all.length === 0) return null;
    const unique = Array.from(new Set(all));
    unique.sort((a, b) => b.length - a.length);
    const pattern = unique
      .map((word) => withBoundaries(tokenToPattern(word), word))
      .join("|");
    if (!pattern) return null;
    return new RegExp(pattern, "gi");
  }

  function shouldSkipElement(el) {
    if (!el) return true;
    if (el.id === overlayId || el.id === toggleId) return true;
    if (el.closest && el.closest(`#${overlayId}, #${toggleId}`)) return true;
    if (el.closest && el.closest(`.${tokenClass}`)) return true;
    const tag = el.tagName;
    if (!tag) return false;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return true;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function clearHighlights() {
    const tokens = document.querySelectorAll(`span.${tokenClass}`);
    tokens.forEach((span) => {
      const text = document.createTextNode(span.textContent || "");
      span.replaceWith(text);
    });
  }

  function collectTextNodes(skipExclude) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.parentElement) return NodeFilter.FILTER_REJECT;
          if (shouldSkipElement(node.parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (
            skipExclude &&
            node.parentElement.closest &&
            node.parentElement.closest('[data-pkh-exclude="1"]')
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes = [];
    let current = walker.nextNode();
    while (current) {
      textNodes.push(current);
      current = walker.nextNode();
    }

    return textNodes;
  }

  function applyMatches(textNodes, regex, mode, tokenMap, config) {
    textNodes.forEach((node) => {
      const text = node.nodeValue;
      regex.lastIndex = 0;

      let match = regex.exec(text);
      if (!match) return;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      while (match) {
        const matchText = match[0];
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
          frag.appendChild(
            document.createTextNode(text.slice(lastIndex, matchIndex))
          );
        }

        const span = document.createElement("span");
        span.className = tokenClass;
        span.textContent = matchText;

        if (mode === "exclude") {
          span.dataset.pkhExclude = "1";
          span.style.textDecoration = "line-through";
          span.style.textDecorationThickness = "2px";
          span.style.textDecorationColor = "#b44";
          span.style.background = "transparent";
        } else {
          const normalized = normalizeToken(matchText);
          if (!tokenMap.highlight.has(normalized)) {
            frag.appendChild(document.createTextNode(matchText));
            lastIndex = matchIndex + matchText.length;
            match = regex.exec(text);
            continue;
          }

          const original = tokenMap.highlight.get(normalized) || matchText;
          const bg = highlightColorFor(original);
          const tilt = highlightTiltFor(original);
          span.style.background = bg;
          span.style.color = textColorFor(bg);
          span.style.borderRadius = "4px";
          const styleMode = config.style || "sticker";
          span.style.padding = "0 3px";
          span.style.display = "inline-block";
          span.style.transform = `rotate(${tilt})`;
          span.style.fontWeight = "700";

          if (styleMode === "normal") {
            span.style.borderRadius = "4px";
            span.style.padding = "0 2px";
            span.style.textShadow = "none";
          } else if (styleMode === "bold") {
            span.style.borderRadius = "4px";
            span.style.boxShadow = "0 0 0 2px rgba(0, 0, 0, 0.25)";
            span.style.fontWeight = "700";
            span.style.textShadow = "0 1px 0 rgba(0, 0, 0, 0.35)";
          } else if (styleMode === "origami") {
            span.classList.add("pkh-sticker-v1");
            span.style.padding = "0.15rem 0.45rem";
            span.style.borderRadius = "9999px";
            span.style.fontWeight = "700";
            span.style.textShadow = "none";
          } else if (styleMode === "candy") {
            span.classList.add("pkh-candy");
            span.dataset.stroke = matchText;
            span.style.background = "transparent";
            span.style.color = "#111111";
            span.style.padding = "0";
            span.style.fontWeight = "400";
            span.style.textShadow = "none";
          } else if (styleMode === "pastel") {
            span.style.borderRadius = "8px";
            span.style.padding = "0.12rem 0.5rem";
            span.style.fontWeight = "700";
            span.style.textShadow = "none";
            span.style.boxShadow = "0 2px 0 rgba(0, 0, 0, 0.12)";
            span.style.backgroundImage =
              "linear-gradient(120deg, rgba(255, 224, 178, 0.9), rgba(255, 204, 230, 0.9))";
            span.style.border = "1px solid rgba(0, 0, 0, 0.08)";
          } else if (styleMode === "neon") {
            span.style.borderRadius = "10px";
            span.style.padding = "0.12rem 0.55rem";
            span.style.fontWeight = "800";
            span.style.color = "#24001b";
            span.style.textShadow =
              "0 1px 0 rgba(255, 255, 255, 0.3), 0 0 8px rgba(255, 45, 154, 0.65)";
            span.style.boxShadow =
              "0 0 0 2px rgba(255, 45, 154, 0.7), 0 0 12px rgba(0, 245, 255, 0.55)";
            span.style.background =
              "linear-gradient(90deg, rgba(255, 45, 154, 0.85), rgba(0, 245, 255, 0.85))";
          } else {
            span.style.borderRadius = "10px";
            span.style.padding = "1px 5px";
            span.style.boxShadow =
              "0 0 0 4px #ffffff, 4px 4px 0 rgba(0, 0, 0, 0.25)";
            span.style.border = "none";
            span.style.fontWeight = "700";
            span.style.textShadow = "0 1px 0 rgba(0, 0, 0, 0.35)";
            span.style.backgroundImage =
              "linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(0, 0, 0, 0.1))";
            span.style.transform = "rotate(-2deg)";
          }
        }

        frag.appendChild(span);
        lastIndex = matchIndex + matchText.length;
        match = regex.exec(text);
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode.replaceChild(frag, node);
    });
  }

  function applyHighlights() {
    if (isApplying) return;
    isApplying = true;

    try {
      const config = loadConfig();
      const tokenMap = buildTokenMap(config);
      const excludeRegex = buildRegexFromList(config.exclude);
      const highlightRegex = buildRegexFromList(Array.from(tokenMap.highlight.keys()));

      clearHighlights();

      if (!excludeRegex && !highlightRegex) return;

      if (excludeRegex) {
        const excludeNodes = collectTextNodes(false);
        applyMatches(excludeNodes, excludeRegex, "exclude", tokenMap, config);
      }

      if (highlightRegex) {
        const highlightNodes = collectTextNodes(true);
        applyMatches(
          highlightNodes,
          highlightRegex,
          "highlight",
          tokenMap,
          config
        );
      }
    } finally {
      isApplying = false;
    }
  }

  function scheduleApply() {
    if (applyTimer) window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(applyHighlights, APPLY_DEBOUNCE_MS);
  }

  function createStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
      @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');

      #${toggleId} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        width: 36px;
        height: 36px;
        border-radius: 18px;
        border: none;
        background: #1a1a1a;
        color: #fff;
        font: 600 12px/36px ui-sans-serif, system-ui, -apple-system, sans-serif;
        text-align: center;
        cursor: pointer;
        touch-action: none;
        user-select: none;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      #${overlayId} {
        position: fixed;
        right: 16px;
        bottom: 64px;
        z-index: 2147483647;
        width: 280px;
        background: #ffffff;
        color: #111;
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
        padding: 12px;
        font: 12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif;
        display: none;
        touch-action: none;
      }

      #${overlayId}.pkh-open {
        display: block;
      }

      #${overlayId} label {
        display: block;
        font-weight: 600;
        margin-bottom: 4px;
      }

      #${overlayId} input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 6px 8px;
        margin-bottom: 8px;
        font-size: 12px;
      }

      #${overlayId} select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 6px 8px;
        margin-bottom: 8px;
        font-size: 12px;
        background: #fff;
      }

      #${overlayId} .pkh-style-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin-bottom: 8px;
      }

      #${overlayId} .pkh-style-item {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        padding: 6px;
        background: #fff;
        cursor: pointer;
        display: grid;
        place-items: center;
        min-height: 34px;
        transition: transform 0.12s ease-out, box-shadow 0.12s ease-out;
      }

      #${overlayId} .pkh-style-item.is-active {
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.2);
        transform: translateY(-1px);
      }

      #${overlayId} .pkh-style-preview {
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        display: inline-block;
      }

      #${overlayId} .pkh-preview-normal {
        background: #ffe16a;
        color: #1a1a1a;
        border-radius: 4px;
        padding: 0 2px;
      }

      #${overlayId} .pkh-preview-bold {
        background: #ffd35c;
        color: #1a1a1a;
        border-radius: 4px;
        padding: 0 2px;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);
      }

      #${overlayId} .pkh-preview-origami {
        border-radius: 9999px;
        padding: 0.1rem 0.45rem;
        background: #ffd35c;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
        position: relative;
      }

      #${overlayId} .pkh-preview-origami::after {
        content: "";
        position: absolute;
        width: 10px;
        height: 10px;
        top: -2px;
        right: -2px;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid #fff;
      }

      #${overlayId} .pkh-preview-candy {
        font-family: "Fredoka One", cursive;
        color: #111;
        text-shadow: 0 0 0 #fff;
      }

      #${overlayId} .pkh-preview-sticker {
        border-radius: 10px;
        padding: 0 4px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(0, 0, 0, 0.1));
        box-shadow: 0 0 0 4px #ffffff, 4px 4px 0 rgba(0, 0, 0, 0.25);
        transform: rotate(-2deg);
      }

      #${overlayId} .pkh-preview-pastel {
        border-radius: 8px;
        padding: 0.1rem 0.45rem;
        background: linear-gradient(120deg, rgba(255, 224, 178, 0.9), rgba(255, 204, 230, 0.9));
        box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(0, 0, 0, 0.08);
      }

      #${overlayId} .pkh-preview-neon {
        border-radius: 10px;
        padding: 0.1rem 0.5rem;
        color: #24001b;
        background: linear-gradient(90deg, rgba(255, 45, 154, 0.85), rgba(0, 245, 255, 0.85));
        box-shadow: 0 0 0 2px rgba(255, 45, 154, 0.7), 0 0 12px rgba(0, 245, 255, 0.55);
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
      }

      #${overlayId} .pkh-actions {
        display: flex;
        gap: 6px;
      }

      #${overlayId} button {
        flex: 1;
        border: none;
        border-radius: 6px;
        padding: 6px;
        cursor: pointer;
        background: #1a1a1a;
        color: #fff;
        font-weight: 600;
      }

      #${overlayId} button.pkh-secondary {
        background: #efefef;
        color: #222;
      }

      /* Sticker v1.0.1 - https://github.com/yepteam/sticker-button (MIT) */
      .pkh-sticker-v1 {
        vertical-align: middle;
        box-sizing: border-box;
        border-radius: 9999px;
        white-space: nowrap;
        position: relative;
        transition: clip-path 0.3s ease-out;
        box-shadow: none !important;
        border-width: 1px;
        font-size: 1rem;
        padding-top: 0.375rem;
        padding-bottom: 0.375rem;
        line-height: 1.5;
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 1.1875rem) 0,
          calc(100% + 0.1837068893rem) 100%,
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 1.1875rem) 0,
          calc(100% + 0.1837068893rem) 100%,
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1::after {
        content: "";
        position: absolute;
        display: block;
        height: 2.375rem;
        width: 2.375rem;
        top: -1px;
        right: -1px;
        transform: rotate(-30deg) translateX(1.1875rem);
        border-radius: 9999px;
        background-color: rgba(255, 255, 255, 0.5);
        border: 1px solid #fff;
        transition: transform 0.3s ease-out;
      }

      .pkh-sticker-v1:not(.pkh-sticker-corner-static):hover {
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 0.6732974165rem) -0.296875rem,
          calc(100% + 0.6979094728rem) calc(100% - 0.296875rem),
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 0.6732974165rem) -0.296875rem,
          calc(100% + 0.6979094728rem) calc(100% - 0.296875rem),
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1:not(.pkh-sticker-corner-static):hover::after {
        transform: rotate(-30deg) translateX(2.375rem);
      }

      .pkh-sticker-v1.pkh-sticker-corner-hover {
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 0.6732974165rem) -0.296875rem,
          calc(100% + 0.6979094728rem) calc(100% - 0.296875rem),
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 0.6732974165rem) -0.296875rem,
          calc(100% + 0.6979094728rem) calc(100% - 0.296875rem),
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1.pkh-sticker-corner-hover::after {
        transform: rotate(-30deg) translateX(2.375rem);
      }

      .pkh-sticker-v1.pkh-sticker-corner-hover:hover {
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 1.1875rem) 0,
          calc(100% + 0.1837068893rem) 100%,
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 1.1875rem) 0,
          calc(100% + 0.1837068893rem) 100%,
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1.pkh-sticker-corner-hover:hover::after {
        transform: rotate(-30deg) translateX(1.1875rem);
      }

      .pkh-sticker-v1[data-bs-toggle="button"] {
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 0.6732974165rem) -0.296875rem,
          calc(100% + 0.6979094728rem) calc(100% - 0.296875rem),
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 0.6732974165rem) -0.296875rem,
          calc(100% + 0.6979094728rem) calc(100% - 0.296875rem),
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1[data-bs-toggle="button"]::after {
        transform: rotate(-30deg) translateX(2.375rem);
      }

      .pkh-sticker-v1[data-bs-toggle="button"].active {
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 1.1875rem) 0,
          calc(100% + 0.1837068893rem) 100%,
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.1875rem) 0,
          calc(100% - 1.1875rem) 0,
          calc(100% + 0.1837068893rem) 100%,
          calc(100% + 0.1837068893rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1[data-bs-toggle="button"].active::after {
        transform: rotate(-30deg) translateX(1.1875rem);
      }

      .pkh-sticker-shadow {
        filter: drop-shadow(0 1rem 0.5rem rgba(0, 0, 0, 0.25));
      }

      .pkh-sticker-v1.pkh-sticker-lg {
        border-width: 1px;
        font-size: 1.25rem;
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
        line-height: 1.5;
        -webkit-clip-path: polygon(
          0 0,
          calc(100% - 1.5rem) 0,
          calc(100% - 1.5rem) 0,
          calc(100% + 0.2320508076rem) 100%,
          calc(100% + 0.2320508076rem) 100%,
          0 100%
        );
        clip-path: polygon(
          0 0,
          calc(100% - 1.5rem) 0,
          calc(100% - 1.5rem) 0,
          calc(100% + 0.2320508076rem) 100%,
          calc(100% + 0.2320508076rem) 100%,
          0 100%
        );
      }

      .pkh-sticker-v1.pkh-sticker-lg::after {
        height: 3rem;
        width: 3rem;
        top: -1px;
        right: -1px;
        transform: rotate(-30deg) translateX(1.5rem);
      }

      .pkh-candy {
        position: relative;
        font-family: "Fredoka One", cursive;
        font-size: 18px;
        filter: drop-shadow(0 0 5px #777);
      }

      .pkh-candy::before,
      .pkh-candy::after {
        content: attr(data-stroke);
        position: absolute;
        top: 0;
        left: 0;
        z-index: -1;
        -webkit-text-stroke: 9px #ffffff;
        text-shadow: none;
      }

      .pkh-candy::after {
        z-index: 0;
        -webkit-text-stroke: 0 transparent;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createOverlay() {
    const toggle = document.createElement("button");
    toggle.id = toggleId;
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Keyword Highlighter");
    toggle.title = "Keyword Highlighter";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-highlighter";
    toggle.appendChild(icon);

    const overlay = document.createElement("div");
    overlay.id = overlayId;

    const highlightLabel = document.createElement("label");
    highlightLabel.setAttribute("for", "pkh-highlight");
    highlightLabel.textContent = "Highlight";

    const highlightInput = document.createElement("input");
    highlightInput.id = "pkh-highlight";
    highlightInput.type = "text";
    highlightInput.placeholder = "X-Design, Job, YouTube";

    const excludeLabel = document.createElement("label");
    excludeLabel.setAttribute("for", "pkh-exclude");
    excludeLabel.textContent = "Exclude";

    const excludeInput = document.createElement("input");
    excludeInput.id = "pkh-exclude";
    excludeInput.type = "text";
    excludeInput.placeholder = "marketing";

    const styleLabel = document.createElement("label");
    styleLabel.textContent = "Style";

    const styleGrid = document.createElement("div");
    styleGrid.className = "pkh-style-grid";

    const styles = [
      { id: "sticker", label: "Sticker", previewClass: "pkh-preview-sticker" },
      { id: "candy", label: "Candy", previewClass: "pkh-preview-candy" },
      { id: "normal", label: "Normal", previewClass: "pkh-preview-normal" },
      { id: "bold", label: "Bold", previewClass: "pkh-preview-bold" },
      { id: "origami", label: "Origami", previewClass: "pkh-preview-origami" },
      { id: "pastel", label: "Pastel", previewClass: "pkh-preview-pastel" },
      { id: "neon", label: "Synthwave", previewClass: "pkh-preview-neon" },
    ];

    let currentStyle = "sticker";

    function renderStyleGrid() {
      while (styleGrid.firstChild) {
        styleGrid.removeChild(styleGrid.firstChild);
      }
      styles.forEach((style) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pkh-style-item";
        button.dataset.style = style.id;

        if (style.id === currentStyle) {
          button.classList.add("is-active");
        }

        const preview = document.createElement("span");
        preview.className = `pkh-style-preview ${style.previewClass}`;
        preview.textContent = style.label;
        button.appendChild(preview);

        button.addEventListener("click", () => {
          currentStyle = style.id;
          renderStyleGrid();
        });

        styleGrid.appendChild(button);
      });
    }

    const actions = document.createElement("div");
    actions.className = "pkh-actions";

    const saveButton = document.createElement("button");
    saveButton.id = "pkh-save";
    saveButton.type = "button";
    saveButton.textContent = "Save";

    const clearButton = document.createElement("button");
    clearButton.id = "pkh-clear";
    clearButton.type = "button";
    clearButton.className = "pkh-secondary";
    clearButton.textContent = "Clear";

    actions.appendChild(saveButton);
    actions.appendChild(clearButton);

    overlay.appendChild(highlightLabel);
    overlay.appendChild(highlightInput);
    overlay.appendChild(excludeLabel);
    overlay.appendChild(excludeInput);
    overlay.appendChild(styleLabel);
    overlay.appendChild(styleGrid);
    overlay.appendChild(actions);

    let lastDragMoved = false;

    function setPosition(el, left, top) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
    }

    function positionOverlayNearToggle() {
      const toggleRect = toggle.getBoundingClientRect();
      overlay.style.display = "block";
      const overlayRect = overlay.getBoundingClientRect();
      const gap = 8;
      const margin = 8;
      const left = Math.min(
        window.innerWidth - overlayRect.width - margin,
        Math.max(margin, toggleRect.left)
      );
      const top = Math.max(
        margin,
        toggleRect.top - overlayRect.height - gap
      );
      setPosition(overlay, left, top);
    }

    function startDrag(event) {
      if (event.type === "mousedown" && event.button !== 0) return;
      if (
        event.target !== toggle &&
        event.target &&
        event.target.closest &&
        event.target.closest("input, select, button, textarea")
      ) {
        return;
      }

      const toggleRect = toggle.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      const hasOverlaySize = overlayRect.width > 0 && overlayRect.height > 0;
      const offsetX = hasOverlaySize ? overlayRect.left - toggleRect.left : 0;
      const offsetY = hasOverlaySize ? overlayRect.top - toggleRect.top : -48;

      setPosition(toggle, toggleRect.left, toggleRect.top);
      if (hasOverlaySize) {
        setPosition(overlay, overlayRect.left, overlayRect.top);
      } else {
        setPosition(overlay, toggleRect.left + offsetX, toggleRect.top + offsetY);
      }

      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        startLeft: toggleRect.left,
        startTop: toggleRect.top,
        offsetX,
        offsetY,
        toggleWidth: toggleRect.width,
        toggleHeight: toggleRect.height,
        moved: false,
      };
      lastDragMoved = false;

      document.addEventListener("mousemove", onDrag);
      document.addEventListener("mouseup", endDrag, { once: true });
    }

    function onDrag(event) {
      if (!dragState) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        dragState.moved = true;
      }

      const margin = 8;
      const maxLeft = window.innerWidth - dragState.toggleWidth - margin;
      const maxTop = window.innerHeight - dragState.toggleHeight - margin;
      const nextLeft = Math.min(
        maxLeft,
        Math.max(margin, dragState.startLeft + deltaX)
      );
      const nextTop = Math.min(
        maxTop,
        Math.max(margin, dragState.startTop + deltaY)
      );

      setPosition(toggle, nextLeft, nextTop);
      setPosition(overlay, nextLeft + dragState.offsetX, nextTop + dragState.offsetY);
    }

    function endDrag() {
      document.removeEventListener("mousemove", onDrag);
      lastDragMoved = Boolean(dragState && dragState.moved);
      dragState = null;
    }

    toggle.addEventListener("click", () => {
      if (lastDragMoved) {
        lastDragMoved = false;
        return;
      }
      const isOpen = overlay.classList.toggle("pkh-open");
      if (isOpen) {
        positionOverlayNearToggle();
      }
    });

    toggle.addEventListener("mousedown", startDrag);
    overlay.addEventListener("mousedown", startDrag);

    const host = document.body || document.documentElement;
    host.appendChild(toggle);
    host.appendChild(overlay);
    overlay.classList.add("pkh-open");

    const config = loadConfig();
    highlightInput.value = config.highlight.join(", ");
    excludeInput.value = config.exclude.join(", ");
    currentStyle = config.style || "sticker";
    renderStyleGrid();

    saveButton.addEventListener("click", () => {
      const nextConfig = {
        highlight: normalizeList(highlightInput.value),
        exclude: normalizeList(excludeInput.value),
        style: currentStyle,
      };
      saveConfig(nextConfig);
      scheduleApply();
    });

    clearButton.addEventListener("click", () => {
      const nextConfig = {
        highlight: [],
        exclude: [],
        style: currentStyle || "sticker",
      };
      highlightInput.value = "";
      excludeInput.value = "";
      saveConfig(nextConfig);
      scheduleApply();
    });
  }

  function ensureOverlay() {
    if (!document.getElementById(toggleId) || !document.getElementById(overlayId)) {
      if (document.getElementById(toggleId)) {
        document.getElementById(toggleId).remove();
      }
      if (document.getElementById(overlayId)) {
        document.getElementById(overlayId).remove();
      }
      createOverlay();
    }
  }

  function setupObserver() {
    const observer = new MutationObserver(() => {
      if (isApplying) return;
      ensureOverlay();
      scheduleApply();
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  function init() {
    createStyles();
    ensureOverlay();
    setupObserver();
    scheduleApply();
    window.addEventListener("hashchange", scheduleApply);
    window.addEventListener("popstate", scheduleApply);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
