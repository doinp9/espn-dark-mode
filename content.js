// ESPN Dark Mode — content.js (v5)
//
// Two-pronged approach:
//   CSS  → Only handles TEXT COLOR and ROOT background.
//   JS   → Scans computed styles and replaces light/red backgrounds.
//
// Toggle support: checks chrome.storage.sync for { enabled: true/false }.
// Injects CSS immediately to prevent white flash, removes if disabled.

(function () {
  "use strict";

  // Track active intervals/observers so we can kill them on disable
  let activeObserver = null;
  let activeIntervals = [];
  let activeTimeouts = [];

  const C = {
    bg0: "#0d0d0d",
    bg1: "#151515",
    bg2: "#1c1c1c",
    bg3: "#242424",
    bg4: "#2e2e2e",
    border: "#333333",
    borderLight: "#444444",
    text: "#e0e0e0",
    textBright: "#f0f0f0",
    textMuted: "#999999",
    textDim: "#707070",
    accent: "#d63a3a",
    link: "#6eaaff",
    linkHover: "#93c0ff",
    positive: "#4caf50",
    negative: "#ef5350",
    scrollThumb: "#444444",
    scrollTrack: "#1a1a1a",
  };

  // ============================================================
  // PART 1: CSS — injected at document_start
  //
  // ONLY handles:
  //  - Root background (prevent white flash)
  //  - Text color (force light on everything)
  //  - Scrollbar, selection, links
  //
  // Does NOT set background on any element except html/body.
  // Backgrounds are handled entirely by the JS scanner.
  // ============================================================
  const css = document.createElement("style");
  css.id = "espn-dark-mode";
  css.textContent = `

  /* Root background — prevents white flash at document_start */
  html, body {
    background-color: ${C.bg0} !important;
  }

  /* Force light text on everything except SVG/media internals */
  *:not(img):not(video):not(svg):not(canvas):not(picture):not(iframe):not(source):not(path):not(circle):not(rect):not(polygon):not(line):not(polyline):not(ellipse):not(g):not(use):not(defs):not(clipPath):not(mask):not(symbol):not(linearGradient):not(radialGradient):not(stop) {
    color: ${C.text} !important;
    text-shadow: none !important;
  }

  /* Brighter headlines */
  h1, h2, h3, h4, h5, h6,
  [class*="Headline"], [class*="headline"],
  [class*="Title"], [class*="title"] {
    color: ${C.textBright} !important;
  }

  /* Muted secondary text */
  [class*="byline"], [class*="Byline"],
  [class*="timestamp"], [class*="TimeStamp"],
  [class*="Caption"], [class*="caption"],
  [class*="record"], [class*="Record"],
  time, small, figcaption {
    color: ${C.textMuted} !important;
  }

  /* Dim DNP/inactive */
  [class*="dnp"], [class*="DNP"],
  [class*="inactive"], [class*="Inactive"] {
    color: ${C.textDim} !important;
  }

  /* Links */
  a { color: ${C.link} !important; }
  a:hover { color: ${C.linkHover} !important; }
  nav a, header a, [class*="Nav"] a, [class*="nav"] a {
    color: ${C.text} !important;
  }

  /* Table row hover */
  tbody tr:hover { background-color: ${C.bg4} !important; }

  /* --- Table visual hierarchy --- */

  /* Team name rows ("New York Knicks", "Chicago Bulls") — most prominent */
  [class*="BoxscoreItem__Team"], [class*="BoxscoreItem__TeamName"],
  [class*="teamName"], [class*="TeamName"],
  [class*="team-header"] {
    background-color: ${C.bg3} !important;
  }
  [class*="BoxscoreItem__Team"] *, [class*="BoxscoreItem__TeamName"] *,
  [class*="TeamName"] * {
    color: ${C.textBright} !important;
  }

  /* Column headers (MIN, PTS, FG, 3PT...) and section labels (STARTERS, BENCH) */
  thead, thead tr, thead th,
  [class*="Table__TH"], [class*="Table__Header"],
  [class*="Table__Title"],
  [class*="header-row"], [class*="HeaderRow"],
  [class*="colhead"], [class*="stathead"],
  [class*="subhead"], [class*="Subhead"] {
    background-color: ${C.bg2} !important;
    color: ${C.textMuted} !important;
  }

  /* Data rows — alternating */
  tbody tr:nth-child(odd) {
    background-color: ${C.bg0} !important;
  }
  tbody tr:nth-child(even) {
    background-color: ${C.bg1} !important;
  }

  /* Totals row (TEAM) — stands out */
  [class*="total"], [class*="Total"],
  tfoot, tfoot tr, tfoot td {
    background-color: ${C.bg2} !important;
    font-weight: bold !important;
  }

  /* Sidebar section headers */
  [class*="SectionTitle"], [class*="sectionTitle"],
  [class*="Card__Header"], [class*="card__header"] {
    background-color: ${C.bg2} !important;
    color: ${C.textBright} !important;
  }

  /* Player name links */
  td a, [class*="Table"] td a, [class*="BoxScore"] a,
  [class*="AnchorLink"], [class*="Athlete"] a {
    color: ${C.link} !important;
  }

  /* Win/Loss/Live */
  [class*="live"], [class*="Live"] { color: ${C.negative} !important; }
  [class*="win"],  [class*="Win"]  { color: ${C.positive} !important; }
  [class*="loss"], [class*="Loss"] { color: ${C.negative} !important; }

  /* --- Borders — only where structure matters --- */

  /* Table rows: subtle horizontal lines */
  tr {
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
  }
  td, th {
    border: none !important;
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
  }

  /* Header row — slightly stronger */
  thead tr, thead th, thead td {
    border-bottom: 1px solid rgba(255,255,255,0.12) !important;
  }

  /* STARTERS / BENCH section dividers */
  [class*="Table__Title"], [class*="TeamHeader"],
  [class*="BoxscoreItem__Team"], [class*="BoxscoreItem__TeamName"],
  [class*="subhead"], [class*="Subhead"] {
    border-top: 1px solid rgba(255,255,255,0.10) !important;
  }

  /* Totals row top edge */
  [class*="total"], [class*="Total"],
  tfoot tr:first-child {
    border-top: 1px solid rgba(255,255,255,0.12) !important;
  }

  /* Linescore grid (quarter-by-quarter box) */
  [class*="linescore"] td, [class*="linescore"] th,
  [class*="LineScore"] td, [class*="LineScore"] th {
    border: 1px solid rgba(255,255,255,0.08) !important;
  }

  /* --- Scoreboard ticker --- */
  [class*="Scoreboard"], [class*="scoreboard"],
  [class*="ScoresStrip"], [class*="scoresStrip"],
  [class*="scoreboardContent"], [class*="ScoreboardContent"],
  [class*="scoreCollection"], [class*="ScoreCollection"],
  [class*="carousel"], [class*="Carousel"],
  [class*="scoreboard-content"],
  [id*="scoreboard"],
  [id*="ScoreboardScoreCell"] {
    background-color: ${C.bg2} !important;
  }
  /* All direct wrappers inside the scoreboard strip */
  [class*="Scoreboard"] > div,
  [class*="scoreboard"] > div,
  [class*="ScoresStrip"] > div,
  [class*="scoresStrip"] > div {
    background-color: ${C.bg2} !important;
  }
  [class*="ScoreCell"], [class*="scoreCell"],
  [class*="ScoreEvent"] {
    background-color: ${C.bg2} !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
  }
  [class*="ScoreCell"]:hover, [class*="scoreCell"]:hover,
  [class*="ScoreEvent"]:hover {
    background-color: ${C.bg3} !important;
  }
  [class*="ScoreCell"] *, [class*="scoreCell"] *,
  [class*="ScoreEvent"] *, [class*="Scoreboard"] span,
  [class*="Scoreboard"] a, [class*="Scoreboard"] div {
    color: ${C.text} !important;
  }
  [class*="ScoreCell"] [class*="winner"],
  [class*="ScoreCell"] [class*="Winner"] {
    color: ${C.textBright} !important;
  }
  /* Scoreboard navigation arrows */
  [class*="Scoreboard"] button,
  [class*="scoreboard"] button,
  [class*="ScoresStrip"] button,
  [class*="Carousel"] button {
    background-color: ${C.bg3} !important;
    color: ${C.text} !important;
  }

  /* Dividers & HRs */
  hr, [class*="divider"], [class*="Divider"],
  [class*="separator"], [class*="Separator"] {
    border-color: rgba(255,255,255,0.06) !important;
    background-color: rgba(255,255,255,0.06) !important;
  }

  /* Media preservation — never tint */
  img, video, picture, canvas, iframe, svg,
  [class*="logo"], [class*="Logo"],
  [class*="icon"], [class*="Icon"],
  [class*="team-logo"], [class*="TeamLogo"],
  [class*="headshot"], [class*="Headshot"],
  [class*="Avatar"] {
    filter: none !important;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: ${C.scrollTrack} !important; }
  ::-webkit-scrollbar-thumb { background: ${C.scrollThumb} !important; border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: #555 !important; }
  * { scrollbar-color: ${C.scrollThumb} ${C.scrollTrack}; scrollbar-width: thin; }

  /* Selection */
  ::selection { background: ${C.accent} !important; color: #fff !important; }

  /* Box shadow cleanup */
  [class*="Card"], [class*="card"],
  [class*="module"], [class*="Module"] { box-shadow: none !important; }

  `;

  document.documentElement.appendChild(css);

  // ============================================================
  // PART 2: JS SCANNER — waits for DOM, then fixes backgrounds
  //
  // Reads getComputedStyle() on every element.
  // Replaces light/red backgrounds with proper dark shades.
  // Never sets "transparent" — always uses an explicit dark color.
  // ============================================================

  const SKIP_TAGS = new Set([
    "IMG","VIDEO","CANVAS","IFRAME","SVG","PICTURE","SOURCE",
    "PATH","CIRCLE","RECT","POLYGON","LINE","POLYLINE","ELLIPSE",
    "G","USE","DEFS","CLIPPATH","MASK","SYMBOL",
    "LINEARGRADIENT","RADIALGRADIENT","STOP","FILTER",
    "FEBLEND","FECOLORMATRIX","FEGAUSSIANBLUR",
    "SCRIPT","STYLE","LINK","NOSCRIPT","BR","WBR",
  ]);

  function shouldSkip(el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    const cl = typeof el.className === "string" ? el.className : "";
    if (/\b(logo|icon|headshot|avatar|thumbnail|graphic|team-logo|Image)\b/i.test(cl)) return true;
    // Skip elements inside SVGs
    if (el.closest && el.closest("svg")) return true;
    return false;
  }

  function parseRGB(s) {
    if (!s) return null;
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function lum(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }


  function fixElement(el) {
    if (!el || el.nodeType !== 1 || shouldSkip(el)) return;

    let cs;
    try { cs = window.getComputedStyle(el); } catch { return; }

    // --- Fix background color ---
    const bgStr = cs.backgroundColor;
    if (bgStr && bgStr !== "transparent" && bgStr !== "rgba(0, 0, 0, 0)") {
      const bgC = parseRGB(bgStr);
      if (bgC && lum(bgC) >= 45) {
        // Determine the RIGHT dark shade based on element role
        const fix = getDarkShade(el, bgC);
        el.style.setProperty("background-color", fix, "important");
      }
    }

    // --- Fix background-image (gradients that are light) ---
    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg !== "none" && /gradient/i.test(bgImg)) {
      const colors = bgImg.match(/rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g) || [];
      const hasLight = colors.some(c => {
        const parsed = parseRGB(c);
        return parsed && lum(parsed) > 120;
      });
      if (hasLight) {
        el.style.setProperty("background-image", "none", "important");
      }
    }

    // --- Fix text color ---
    const txtStr = cs.color;
    if (txtStr) {
      const txtC = parseRGB(txtStr);
      if (txtC && lum(txtC) < 50) {
        el.style.setProperty("color", C.text, "important");
      }
    }

    // --- Fix borders that are too light ---
    const bdrStr = cs.borderTopColor || cs.borderColor;
    if (bdrStr) {
      const bdrC = parseRGB(bdrStr);
      if (bdrC && lum(bdrC) > 170) {
        el.style.setProperty("border-color", C.border, "important");
      }
    }
  }

  // Assign the correct dark shade based on what the element IS
  function getDarkShade(el, bgC) {
    const tag = el.tagName;
    const cl = typeof el.className === "string" ? el.className : "";

    // ESPN brand red → nav-level dark
    if (bgC[0] > 100 && bgC[1] < 50 && bgC[2] < 50) return C.bg1;

    // Team name rows
    if (/TeamName|teamName|team-header|BoxscoreItem__Team/i.test(cl)) return C.bg3;

    // Column headers, section labels (STARTERS, BENCH, thead)
    if (tag === "THEAD" || tag === "TH") return C.bg2;
    if (/Table__TH|Table__Header|Table__Title|colhead|stathead|subhead|Subhead|HeaderRow|header-row/i.test(cl)) return C.bg2;

    // Totals / footer rows
    if (/total|Total/i.test(cl) || tag === "TFOOT") return C.bg2;

    // Table data rows — check if odd or even for alternating
    if (tag === "TR" && el.parentElement) {
      const parentTag = el.parentElement.tagName;
      if (parentTag === "TBODY") {
        const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
        return idx % 2 === 0 ? C.bg0 : C.bg1;
      }
    }

    // Table cells inherit from row
    if (tag === "TD") return "transparent";

    // Nav / header area
    if (tag === "NAV" || tag === "HEADER" || /Nav|nav|global-nav|SiteNav/i.test(cl)) return C.bg1;

    // Scoreboard ticker — elevated from page bg
    if (/Scoreboard|scoreboard|ScoreCell|scoreCell|ScoreEvent|ScoresStrip|scoresStrip|scoreCollection|ScoreCollection|carousel|Carousel/i.test(cl)) return C.bg2;
    // Also check if element is inside a scoreboard
    if (el.closest && el.closest('[class*="Scoreboard"], [class*="scoreboard"], [class*="ScoresStrip"], [class*="scoresStrip"], [id*="scoreboard"]')) return C.bg2;

    // Sidebar / cards / modules
    if (/sidebar|Sidebar|rightRail|RightRail|VideoList|Matchup|matchup/i.test(cl)) return C.bg1;
    if (/Card|card|ContentItem|FeedItem|Story/i.test(cl)) return C.bg1;

    // Section headers in sidebar
    if (/SectionTitle|sectionTitle|Card__Header/i.test(cl)) return C.bg2;

    // General fallback based on luminance
    const L = lum(bgC);
    if (L > 200) return C.bg0;   // very bright → darkest
    if (L > 150) return C.bg1;
    if (L > 100) return C.bg2;
    if (L > 60)  return C.bg3;
    return C.bg4;
  }

  // Sweep all elements on the page
  function sweepAll() {
    const els = document.getElementsByTagName("*");
    for (let i = 0; i < els.length; i++) {
      fixElement(els[i]);
    }
  }

  // Sweep a subtree
  function sweepTree(root) {
    if (!root || root.nodeType !== 1) return;
    fixElement(root);
    const els = root.getElementsByTagName("*");
    for (let i = 0; i < els.length; i++) {
      fixElement(els[i]);
    }
  }

  function startScanner() {
    // Staggered initial sweeps — ESPN loads content in stages
    sweepAll();
    const delays = [50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 8000];
    delays.forEach(ms => {
      activeTimeouts.push(setTimeout(sweepAll, ms));
    });

    // Keep sweeping every 2s for 30s (covers late-loading content)
    let ticks = 0;
    const iv = setInterval(() => {
      sweepAll();
      if (++ticks >= 15) clearInterval(iv);
    }, 2000);
    activeIntervals.push(iv);

    // MutationObserver for dynamically added/changed content
    activeObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes") {
          fixElement(m.target);
          if (m.target.children && m.target.children.length > 0 && m.target.children.length < 100) {
            sweepTree(m.target);
          }
        }
        for (const n of (m.addedNodes || [])) {
          if (n.nodeType === 1) {
            sweepTree(n);
            activeTimeouts.push(setTimeout(() => sweepTree(n), 100));
          }
        }
      }
    });

    activeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    // SPA navigation detection (ESPN uses client-side routing)
    let lastURL = location.href;
    const urlCheck = setInterval(() => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        [0, 200, 500, 1000, 2000, 4000].forEach(ms => {
          activeTimeouts.push(setTimeout(sweepAll, ms));
        });
      }
    }, 500);
    activeIntervals.push(urlCheck);
  }

  // =============================================================
  // DISABLE — remove all dark mode styles and stop scanning
  // =============================================================
  function disableDarkMode() {
    // Remove injected CSS
    const el = document.getElementById("espn-dark-mode");
    if (el) el.remove();

    // Stop observer
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    // Clear all intervals and timeouts
    activeIntervals.forEach(id => clearInterval(id));
    activeTimeouts.forEach(id => clearTimeout(id));
    activeIntervals = [];
    activeTimeouts = [];

    // Remove all inline styles we set (restore original appearance)
    document.querySelectorAll("[style]").forEach(el => {
      el.style.removeProperty("background-color");
      el.style.removeProperty("background-image");
      el.style.removeProperty("color");
      el.style.removeProperty("border-color");
    });
  }

  // =============================================================
  // ENABLE — inject CSS and start scanner
  // =============================================================
  function enableDarkMode() {
    // Don't double-inject
    if (document.getElementById("espn-dark-mode")) return;

    document.documentElement.appendChild(css);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startScanner, { once: true });
    } else {
      startScanner();
    }
  }

  // =============================================================
  // STARTUP — check storage, then enable or skip
  // =============================================================

  // Always inject CSS immediately to prevent white flash.
  // We'll remove it if storage says disabled.
  document.documentElement.appendChild(css);

  chrome.storage.sync.get({ enabled: true }, (data) => {
    if (data.enabled) {
      // CSS already injected — just start the scanner when DOM is ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startScanner, { once: true });
      } else {
        startScanner();
      }
    } else {
      // User disabled — remove the CSS we just injected
      disableDarkMode();
    }
  });

  // =============================================================
  // LISTEN for toggle messages from popup (live toggle)
  // =============================================================
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggle") {
      if (msg.enabled) {
        enableDarkMode();
      } else {
        disableDarkMode();
      }
    }
  });

})();
