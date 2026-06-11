/**
 * AI Automation Locator & Script Builder - Content Script
 * Injected into the target page. Manages element highlighting, selection,
 * badge rendering, and DOM analysis.
 */

(function () {
  // Prevent duplicate injection
  if (window.hasAILocatorScriptInjected) return;
  window.hasAILocatorScriptInjected = true;

  let isInspecting = false;
  let hoveredElement = null;
  let selectedElements = []; // List of selected DOM elements
  let badgeElements = [];    // List of badge DOM elements drawn on page

  // Create UI overlay elements
  let hoverBox = null;
  let tooltip = null;

  function initUI() {
    if (!hoverBox) {
      hoverBox = document.createElement("div");
      hoverBox.className = "ai-inspector-hover-box";
      hoverBox.style.display = "none";
      document.body.appendChild(hoverBox);
    }

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "ai-inspector-tooltip";
      tooltip.style.display = "none";
      document.body.appendChild(tooltip);
    }
  }

  // Generate robust XPath
  function generateXPath(element) {
    if (!element) return "";
    
    // 1. If it has an ID, use it (usually unique)
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    // 2. If it's a button or link with text, generate text-based XPath
    const tag = element.tagName.toLowerCase();
    if ((tag === "button" || tag === "a" || (tag === "input" && (element.type === "button" || element.type === "submit"))) && element.innerText && element.innerText.trim().length > 0) {
      const text = element.innerText.trim();
      // Handle single or double quotes in text
      if (!text.includes('"') && !text.includes("'")) {
        return `//${tag === "input" ? "input" : tag}[text()='${text}']`;
      }
      if (!text.includes('"')) {
        return `//${tag === "input" ? "input" : tag}[contains(text(), "${text}")]`;
      }
    }
    
    // 3. Fallback to standard path calculation
    const paths = [];
    for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
      let index = 0;
      let hasSiblingsWithSameTag = false;
      
      for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
        if (sibling.nodeName === element.nodeName) {
          index++;
          hasSiblingsWithSameTag = true;
        }
      }
      
      for (let sibling = element.nextSibling; sibling; sibling = sibling.nextSibling) {
        if (sibling.nodeName === element.nodeName) {
          hasSiblingsWithSameTag = true;
          break;
        }
      }
      
      const tagName = element.nodeName.toLowerCase();
      const pathIndex = (hasSiblingsWithSameTag || index > 0) ? `[${index + 1}]` : "";
      paths.unshift(tagName + pathIndex);
      
      // Stop walking up if we hit an element with ID
      if (element.parentNode && element.parentNode.id) {
        paths.unshift(`//*[@id="${element.parentNode.id}"]`);
        break;
      }
    }
    
    return paths.length ? (paths[0].startsWith("//") ? paths.join("/") : "/" + paths.join("/")) : null;
  }

  // Generate CSS Selector
  function generateCSSSelector(element) {
    if (!element) return "";
    
    // 1. If ID exists
    if (element.id) {
      // Escape ID if it starts with a number or contains special characters
      if (/^[0-9]/.test(element.id) || /[:.]/.test(element.id)) {
        return `[id="${element.id}"]`;
      }
      return `#${element.id}`;
    }
    
    // 2. Check for common data attributes
    const testAttributes = ["data-testid", "data-qa", "data-cy", "data-test", "testid"];
    for (const attr of testAttributes) {
      if (element.hasAttribute(attr)) {
        return `[${attr}="${element.getAttribute(attr)}"]`;
      }
    }
    
    // 3. For input elements, use name or type if available
    const tag = element.tagName.toLowerCase();
    if (tag === "input") {
      if (element.getAttribute("name")) {
        return `input[name="${element.getAttribute("name")}"]`;
      }
      if (element.getAttribute("type")) {
        return `input[type="${element.getAttribute("type")}"]`;
      }
    }
    
    // 4. Fallback to combining tag and class list
    let selector = tag;
    if (element.className && typeof element.className === "string") {
      const classes = element.className
        .trim()
        .split(/\s+/)
        .filter(c => c && !c.startsWith("ai-") && !c.includes(":")); // Avoid tailwind pseudo-classes or our classes
      if (classes.length > 0) {
        selector += "." + classes.slice(0, 3).join("."); // Use up to 3 classes
      }
    }
    
    // Walk up if selector is too generic (like div or span)
    if (["div", "span", "p"].includes(selector) && element.parentElement) {
      const parentSelector = generateCSSSelector(element.parentElement);
      if (parentSelector) {
        selector = `${parentSelector} > ${selector}`;
      }
    }
    
    return selector;
  }

  // Highlight an element on hover
  function highlightElement(el) {
    if (!el || el === hoverBox || el === tooltip || el.classList.contains("ai-selection-badge")) {
      hideHighlight();
      return;
    }
    
    hoveredElement = el;
    initUI();

    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position hover outline box
    hoverBox.style.width = `${rect.width}px`;
    hoverBox.style.height = `${rect.height}px`;
    hoverBox.style.left = `${rect.left + scrollX}px`;
    hoverBox.style.top = `${rect.top + scrollY}px`;
    hoverBox.style.display = "block";

    // Setup tooltip content
    let classStr = "";
    if (el.className && typeof el.className === "string") {
      classStr = el.className.split(/\s+/).filter(c => !c.startsWith("ai-")).map(c => `.${c}`).join("").substring(0, 40);
    }
    const idStr = el.id ? `#${el.id}` : "";
    const tagName = el.tagName.toLowerCase();

    tooltip.innerHTML = `<span class="tag-name">${tagName}</span><span class="id-name">${idStr}</span><span class="class-name">${classStr}</span>`;
    tooltip.style.display = "block";

    // Position tooltip above element, or below if not enough room
    const tooltipRect = tooltip.getBoundingClientRect();
    let tooltipTop = rect.top + scrollY - tooltipRect.height - 8;
    if (tooltipTop < scrollY + 5) {
      tooltipTop = rect.bottom + scrollY + 8;
    }
    let tooltipLeft = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);
    if (tooltipLeft < scrollX + 5) tooltipLeft = scrollX + 5;

    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;
  }

  function hideHighlight() {
    if (hoverBox) hoverBox.style.display = "none";
    if (tooltip) tooltip.style.display = "none";
    hoveredElement = null;
  }

  // Intercept click events on webpage
  function handlePageClick(e) {
    if (!isInspecting) return;
    
    // Ignore clicks on our own inspector overlays and badges
    if (e.target === hoverBox || e.target === tooltip || e.target.classList.contains("ai-selection-badge")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.target;
    selectElement(targetEl);
    
    // Auto-disable inspector after single selection (optional, but standard for extensions)
    // We can choose to keep it active for multiple clicks, let's keep it active so users can select multiple
    // but give them an easy toggle. To notify the side panel, we send a message.
  }

  // Extract metadata and select the element
  function selectElement(el) {
    if (selectedElements.includes(el)) {
      // If already selected, do nothing or remove it
      return;
    }

    selectedElements.push(el);
    el.classList.add("ai-inspected-element-selected");

    const elementIndex = selectedElements.length;
    
    // Extract element data
    const elementData = {
      index: elementIndex,
      tagName: el.tagName.toLowerCase(),
      id: el.id || "",
      name: el.getAttribute("name") || "",
      placeholder: el.getAttribute("placeholder") || "",
      type: el.getAttribute("type") || "",
      role: el.getAttribute("role") || "",
      innerText: el.innerText ? el.innerText.trim().substring(0, 80) : "",
      value: el.value || "",
      outerHTML: el.outerHTML.substring(0, 1000), // Snippet for AI analysis
      cssSelector: generateCSSSelector(el),
      xpath: generateXPath(el),
    };

    // Draw sequence badge on top of element
    drawBadge(el, elementIndex);

    // Send selection back to Side Panel
    chrome.runtime.sendMessage({
      action: "ELEMENT_SELECTED",
      element: elementData
    });
    
    hideHighlight();
  }

  // Draw sequence badge on webpage
  function drawBadge(el, index) {
    const rect = el.getBoundingClientRect();
    const badge = document.createElement("div");
    badge.className = "ai-selection-badge";
    badge.innerText = index;
    
    // Position badge at top-left of the target element
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    badge.style.left = `${rect.left + scrollX - 10}px`;
    badge.style.top = `${rect.top + scrollY - 10}px`;
    
    // Remove selection when clicking badge
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      removeElementAt(index - 1);
    });

    document.body.appendChild(badge);
    badgeElements.push({ element: el, badgeEl: badge });
  }

  // Remove element at index
  function removeElementAt(idx) {
    if (idx < 0 || idx >= selectedElements.length) return;
    
    const el = selectedElements[idx];
    if (el) {
      el.classList.remove("ai-inspected-element-selected");
    }

    // Remove badge DOM element
    const match = badgeElements.find(b => b.element === el);
    if (match && match.badgeEl) {
      match.badgeEl.remove();
    }
    badgeElements = badgeElements.filter(b => b.element !== el);

    // Remove from array
    selectedElements.splice(idx, 1);

    // Shift indexes of subsequent badges
    rebuildBadges();

    // Notify sidepanel
    chrome.runtime.sendMessage({
      action: "ELEMENT_REMOVED",
      index: idx
    });
  }

  function rebuildBadges() {
    // Remove all old badges
    badgeElements.forEach(b => b.badgeEl.remove());
    badgeElements = [];

    // Re-draw all badges with new indices
    selectedElements.forEach((el, index) => {
      drawBadge(el, index + 1);
    });
  }

  // Clear all selections
  function clearSelections() {
    selectedElements.forEach(el => {
      if (el) el.classList.remove("ai-inspected-element-selected");
    });
    selectedElements = [];

    badgeElements.forEach(b => b.badgeEl.remove());
    badgeElements = [];

    hideHighlight();
  }

  // Scan and index interactive page elements for AI select query
  function indexPageElements() {
    // Select all potentially interactive elements
    const query = "button, input, a, textarea, select, [role='button'], [role='link'], [onclick]";
    const rawElements = Array.from(document.querySelectorAll(query));
    
    // Filter visible elements with valid interactive attributes or content
    const indexed = [];
    rawElements.forEach((el) => {
      // Simple visibility check
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(el).display === "none" || window.getComputedStyle(el).visibility === "hidden") {
        return;
      }
      
      const text = el.innerText ? el.innerText.trim().substring(0, 50) : "";
      const id = el.id || "";
      const className = typeof el.className === "string" ? el.className.split(/\s+/).filter(c => !c.startsWith("ai-")).join(" ") : "";
      
      indexed.push({
        tag: el.tagName.toLowerCase(),
        id: id,
        name: el.getAttribute("name") || "",
        text: text,
        type: el.getAttribute("type") || "",
        placeholder: el.getAttribute("placeholder") || "",
        role: el.getAttribute("role") || "",
        class: className,
        // We temporarily store element reference, we will retrieve by index
        ref: el
      });
    });

    // Save references globally so we can highlight them later when AI specifies which ones to select
    window.indexedElementsReferences = indexed.map(item => item.ref);

    // Return serializable structure
    return indexed.map((item, index) => ({
      index: index,
      tag: item.tag,
      id: item.id,
      name: item.name,
      text: item.text,
      type: item.type,
      placeholder: item.placeholder,
      role: item.role,
      class: item.class
    }));
  }

  // Handle events
  document.addEventListener("mouseover", (e) => {
    if (!isInspecting) return;
    highlightElement(e.target);
  });

  document.addEventListener("click", handlePageClick, true);

  // Message receiver
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[content] received message:", message);
    if (message.action === "SET_INSPECTING") {
      isInspecting = message.enabled;
      if (!isInspecting) {
        hideHighlight();
      } else {
        initUI();
      }
      sendResponse({ status: "OK", inspecting: isInspecting });
    } 
    
    else if (message.action === "CLEAR_SELECTIONS") {
      clearSelections();
      sendResponse({ status: "OK" });
    } 
    
    else if (message.action === "REMOVE_SELECTION") {
      removeElementAt(message.index);
      sendResponse({ status: "OK" });
    } 
    
    else if (message.action === "GET_PAGE_ELEMENTS") {
      const elementsList = indexPageElements();
      sendResponse({ elements: elementsList });
    } 
    
    else if (message.action === "HIGHLIGHT_ELEMENT_INDEX") {
      const idx = message.index;
      if (window.indexedElementsReferences && window.indexedElementsReferences[idx]) {
        const el = window.indexedElementsReferences[idx];
        selectElement(el);
        // Scroll element into view
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        sendResponse({ status: "OK", tag: el.tagName.toLowerCase() });
      } else {
        sendResponse({ status: "ERROR", message: "Element index not found" });
      }
    }
    
    return true; // Keep message channel open for async response
  });

})();
