/**
 * AI Automation Locator & Script Builder - Side Panel Script
 * Coordinates UI tabs, settings storage, tab messaging, and Gemini API calls.
 */

// State Management
let apiState = {
  key: "",
  model: "gemini-2.0-flash",
  connected: false
};

let activeTabId = null;
let currentInspectedElement = null;
let selectedSteps = []; // Array of step objects: { index, tagName, selector, xpath, action, value, text, outerHTML }
let isInspecting = false;

// DOM Elements
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

// Settings Elements
const apiKeyInput = document.getElementById("settings-api-key");
const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
const modelSelect = document.getElementById("settings-model");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const apiStatusDot = document.getElementById("api-status-dot");
const apiStatusLabel = document.getElementById("api-status-label");

// Inspector Elements
const inspectorToggle = document.getElementById("inspector-toggle");
const inspectorEmptyState = document.getElementById("inspector-empty-state");
const inspectorDetails = document.getElementById("inspector-details");
const inspectedTag = document.getElementById("inspected-tag");
const inspectedText = document.getElementById("inspected-text");
const inspectedIdRow = document.getElementById("inspected-id-row");
const inspectedId = document.getElementById("inspected-id");
const inspectedNameRow = document.getElementById("inspected-name-row");
const inspectedName = document.getElementById("inspected-name");
const locatorCssInput = document.getElementById("locator-css");
const locatorXpathInput = document.getElementById("locator-xpath");
const addStepsBtn = document.getElementById("add-to-steps-btn");

// AI Locator Elements
const aiLocatorLoading = document.getElementById("ai-locator-loading");
const aiLocatorError = document.getElementById("ai-locator-error");
const aiLocatorContent = document.getElementById("ai-locator-content");
const locatorAiSelectorInput = document.getElementById("locator-ai-selector");
const locatorAiExplanation = document.getElementById("locator-ai-explanation");

// AI Search Elements
const aiSearchPrompt = document.getElementById("ai-search-prompt");
const aiSearchSubmit = document.getElementById("ai-search-submit");
const aiSearchStatusBox = document.getElementById("ai-search-status-box");
const aiSearchLoading = document.getElementById("ai-search-loading");
const aiSearchStatusText = document.getElementById("ai-search-status-text");
const aiSearchResults = document.getElementById("ai-search-results");
const aiSearchResultsUl = document.getElementById("ai-search-results-ul");
const aiSearchError = document.getElementById("ai-search-error");
const aiSearchErrorMsg = document.getElementById("ai-search-error-msg");

// Builder Elements
const frameworkSelect = document.getElementById("framework-select");
const clearAllStepsBtn = document.getElementById("clear-all-steps");
const builderEmptyState = document.getElementById("builder-empty-state");
const stepsListContainer = document.getElementById("steps-list-container");
const stepsList = document.getElementById("steps-list");
const generateScriptBtn = document.getElementById("generate-script-btn");
const stepBadgeCount = document.getElementById("step-badge-count");

// Code Drawer Elements
const codeResultDrawer = document.getElementById("code-result-drawer");
const codeOutputBlock = document.getElementById("code-output-block");
const codeCopyBtn = document.getElementById("code-copy-btn");
const codeDownloadBtn = document.getElementById("code-download-btn");
const closeCodeDrawerBtn = document.getElementById("close-code-drawer-btn");

// Initialize Extension Sidepanel
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupSettings();
  setupInspector();
  setupBuilder();
  setupAISearch();
  setupCodeDrawer();

  // Load Saved Settings from Chrome Storage
  await loadSettings();
  
  // Track Active Tab
  const activeTab = await getActiveTab();
  if (activeTab) {
    activeTabId = activeTab.id;
  }
});

// Helper: Get Active Webpage Tab
async function getActiveTab() {
  try {
    // Query all tabs across all windows
    const allTabs = await chrome.tabs.query({});
    
    // Filter to find webpage tabs (http/https schemes)
    const webpageTabs = allTabs.filter(t => t.url && (t.url.startsWith("http://") || t.url.startsWith("https://")));
    
    if (webpageTabs.length > 0) {
      // Return the active webpage tab if available, otherwise the first webpage tab
      const activeWebpage = webpageTabs.find(t => t.active);
      return activeWebpage || webpageTabs[0];
    }
    
    // Fallback to current window active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  } catch (e) {
    console.error("Error getting active tab:", e);
    return null;
  }
}

// -------------------------------------------------------------
// TAB SYSTEM
// -------------------------------------------------------------
function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabTarget = btn.getAttribute("data-tab");
      
      // Update buttons
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Show Pane
      tabPanes.forEach(pane => {
        pane.classList.remove("active");
        if (pane.id === `tab-${tabTarget}`) {
          pane.classList.add("active");
        }
      });

      // If switching away from Inspector tab, disable inspector highlight on page
      if (tabTarget !== "inspector" && isInspecting) {
        inspectorToggle.checked = false;
        toggleInspector(false);
      }
    });
  });
}

// -------------------------------------------------------------
// SETTINGS LOGIC (Chrome Storage & API validation)
// -------------------------------------------------------------
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["geminiApiKey", "geminiModel"], (result) => {
      if (result.geminiApiKey) {
        apiState.key = result.geminiApiKey;
        apiKeyInput.value = result.geminiApiKey;
        apiState.connected = true;
        updateApiStatus(true, "API Key Configured");
      } else {
        updateApiStatus(false, "API Key Required");
      }
      
      if (result.geminiModel) {
        apiState.model = result.geminiModel;
        modelSelect.value = result.geminiModel;
      }
      resolve();
    });
  });
}

function setupSettings() {
  // Toggle key visibility mask
  toggleKeyVisibilityBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibilityBtn.innerText = "Hide";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibilityBtn.innerText = "Show";
    }
  });

  // Save Settings
  saveSettingsBtn.addEventListener("click", () => {
    const keyVal = apiKeyInput.value.trim();
    const modelVal = modelSelect.value;

    chrome.storage.local.set({
      geminiApiKey: keyVal,
      geminiModel: modelVal
    }, () => {
      apiState.key = keyVal;
      apiState.model = modelVal;
      
      if (keyVal) {
        apiState.connected = true;
        updateApiStatus(true, "Settings Saved Successfully!");
        // Briefly test the API connection in background
        validateApiKey(keyVal);
      } else {
        apiState.connected = false;
        updateApiStatus(false, "API Key Cleared");
      }
      
      showToast("Settings Saved!");
    });
  });
}

function updateApiStatus(success, message) {
  if (success) {
    apiStatusDot.className = "status-dot status-active";
    apiStatusLabel.innerText = message;
    apiStatusLabel.style.color = "#10b981";
  } else {
    apiStatusDot.className = "status-dot status-inactive";
    apiStatusLabel.innerText = message;
    apiStatusLabel.style.color = "#ef4444";
  }
}

// Quick validation call to Gemini
async function validateApiKey(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiState.model}:generateContent?key=${key}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello. Respond with one word 'OK'." }] }]
      })
    });
    if (response.ok) {
      updateApiStatus(true, "API Connection Verified!");
    } else {
      const errorData = await response.json();
      console.error("API error details:", errorData);
      updateApiStatus(false, "Invalid API Key or Model selection");
    }
  } catch (err) {
    console.error("API validation error:", err);
    updateApiStatus(false, "Network connection failed");
  }
}

// -------------------------------------------------------------
// PAGE ELEMENT INSPECTOR
// -------------------------------------------------------------
function setupInspector() {
  inspectorToggle.addEventListener("change", (e) => {
    toggleInspector(e.target.checked);
  });

  // Handle adding current selected item to step builder list
  addStepsBtn.addEventListener("click", () => {
    if (!currentInspectedElement) return;

    // Use the AI locator if it succeeded, otherwise fallback to css selector
    const aiInputVal = locatorAiSelectorInput.value;
    const finalSelector = (aiInputVal && aiInputVal !== "-") ? aiInputVal : currentInspectedElement.cssSelector;

    // Check if element has text content or tag specific name
    const stepLabel = currentInspectedElement.id 
      ? `#${currentInspectedElement.id}` 
      : `${currentInspectedElement.tagName}${currentInspectedElement.innerText ? ` "${currentInspectedElement.innerText}"` : ""}`;

    addStepToBuilder({
      tagName: currentInspectedElement.tagName,
      selector: finalSelector,
      xpath: currentInspectedElement.xpath,
      text: currentInspectedElement.innerText,
      outerHTML: currentInspectedElement.outerHTML,
      label: stepLabel,
      action: "click",
      value: ""
    });

    // Briefly change button text to indicate success
    addStepsBtn.innerText = "Added to Test Steps!";
    addStepsBtn.className = "btn btn-primary btn-full";
    setTimeout(() => {
      addStepsBtn.innerText = "Add to Test Builder";
      addStepsBtn.className = "btn btn-secondary btn-full";
    }, 1200);
  });
}

async function toggleInspector(enable) {
  isInspecting = enable;
  console.log("[sidepanel] toggleInspector called with:", enable);
  const tab = await getActiveTab();
  console.log("[sidepanel] getActiveTab returned:", tab ? { id: tab.id, url: tab.url } : "null");
  if (!tab) return;

  console.log("[sidepanel] Sending SET_INSPECTING message to tab:", tab.id);
  chrome.tabs.sendMessage(tab.id, {
    action: "SET_INSPECTING",
    enabled: enable
  }, (response) => {
    console.log("[sidepanel] Received response from SET_INSPECTING:", response);
    // Handle error if content script is not loaded
    if (chrome.runtime.lastError) {
      console.warn("[sidepanel] Could not toggle inspector, tab script not loaded:", chrome.runtime.lastError.message);
      inspectorToggle.checked = false;
      isInspecting = false;
      showToast("Please refresh the webpage to enable inspection.");
    }
  });
}

// Listen for selection events from content script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "ELEMENT_SELECTED") {
    // Display inspector fields
    displayInspectedElement(message.element);
    
    // Automatically query AI to optimize locators if Key is configured
    if (apiState.key) {
      optimizeLocatorWithAI(message.element);
    } else {
      // Show AI placeholder indicating key needs to be input
      showAiLocatorNoKey();
    }
  } 
  
  else if (message.action === "ELEMENT_REMOVED") {
    // Handle synchronization if user clicked badge to delete
    removeStep(message.index, false);
  }
});

function displayInspectedElement(el) {
  currentInspectedElement = el;

  // Render text properties
  inspectedTag.innerText = el.tagName;
  inspectedText.innerText = el.innerText ? `"${el.innerText}"` : "(none)";
  
  if (el.id) {
    inspectedIdRow.style.display = "flex";
    inspectedId.innerText = el.id;
  } else {
    inspectedIdRow.style.display = "none";
  }

  if (el.name) {
    inspectedNameRow.style.display = "flex";
    inspectedName.innerText = el.name;
  } else {
    inspectedNameRow.style.display = "none";
  }

  // Populate basic inputs
  locatorCssInput.value = el.cssSelector;
  locatorXpathInput.value = el.xpath;

  // Show Details tab content
  inspectorEmptyState.style.display = "none";
  inspectorDetails.style.display = "flex";
}

function showAiLocatorNoKey() {
  aiLocatorLoading.style.display = "none";
  aiLocatorContent.style.display = "none";
  aiLocatorError.style.display = "block";
}

// Call Gemini to optimize CSS selector and XPath
async function optimizeLocatorWithAI(el) {
  aiLocatorLoading.style.display = "flex";
  aiLocatorContent.style.display = "none";
  aiLocatorError.style.display = "none";

  const prompt = `Analyze the following HTML snippet of an element to find on a webpage. Suggest the single most robust and stable CSS Selector or XPath locator for automated end-to-end testing (prioritizing custom test-ids, stable names, roles, or distinctive content over long nested selectors or dynamic CSS classes).
  
  Respond with a JSON object containing exactly two keys:
  1. "selector": The suggested CSS selector or XPath (must start with // if XPath).
  2. "explanation": A brief, one-sentence description of why this locator is robust and dynamic-resistant.
  
  HTML:
  ${el.outerHTML}
  
  Context:
  Tag: ${el.tagName}, ID: ${el.id}, Name: ${el.name}, Text content: ${el.innerText}`;

  try {
    const res = await callGemini(prompt, true);
    if (res && res.selector) {
      locatorAiSelectorInput.value = res.selector;
      locatorAiExplanation.innerText = res.explanation;
      
      aiLocatorLoading.style.display = "none";
      aiLocatorContent.style.display = "block";
    } else {
      throw new Error("Invalid format returned from AI");
    }
  } catch (err) {
    console.error("AI locator generation error:", err);
    aiLocatorLoading.style.display = "none";
    aiLocatorError.style.display = "block";
    // Populate standard CSS as locator fallback
    locatorAiSelectorInput.value = el.cssSelector;
    locatorAiExplanation.innerText = "Fallback: Direct CSS Selector used due to API response error.";
    aiLocatorContent.style.display = "block";
  }
}

// -------------------------------------------------------------
// AI SEARCH (Natural Language element finder)
// -------------------------------------------------------------
function setupAISearch() {
  aiSearchSubmit.addEventListener("click", async () => {
    const promptText = aiSearchPrompt.value.trim();
    if (!promptText) {
      showToast("Please enter a selection request.");
      return;
    }

    if (!apiState.key) {
      showToast("Gemini API key is required for AI search. Go to Settings.");
      return;
    }

    aiSearchStatusBox.style.display = "block";
    aiSearchLoading.style.display = "flex";
    aiSearchResults.style.display = "none";
    aiSearchError.style.display = "none";
    aiSearchStatusText.innerText = "Indexing page elements...";

    // 1. Send message to content script to fetch all visible interactive elements
    const tab = await getActiveTab();
    if (!tab) {
      showAISearchError("Could not connect to active page tab.");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_ELEMENTS" }, async (response) => {
      if (chrome.runtime.lastError || !response || !response.elements) {
        showAISearchError("Failed to index page elements. Try refreshing the page.");
        return;
      }

      const elementsList = response.elements;
      if (elementsList.length === 0) {
        showAISearchError("No interactive elements (buttons, inputs, links) found on this page.");
        return;
      }

      aiSearchStatusText.innerText = `Analyzing ${elementsList.length} elements with Gemini...`;

      // 2. Format list and prompt for Gemini
      const prompt = `You are a test automation helper. The user wants to select elements on a webpage matching this request: "${promptText}".
      
      Here is a JSON array of visible interactive elements extracted from the webpage DOM. Each element has a unique 'index':
      ${JSON.stringify(elementsList.slice(0, 150))}
      
      Find the element or elements that match the user's intent. Order them logically based on step sequence (e.g. fill username first, then fill password, then click login button).
      
      Return a JSON object with a single key "indices": [number, number...] representing the matched elements in correct step order. If no elements match, return an empty array [].`;

      try {
        const result = await callGemini(prompt, true);
        if (result && Array.isArray(result.indices)) {
          const matchedIndices = result.indices;
          
          if (matchedIndices.length === 0) {
            showAISearchError("Gemini could not find any elements matching that request on the page.");
            return;
          }

          // 3. Request content script to programmatically select the elements
          aiSearchStatusText.innerText = `Selecting ${matchedIndices.length} matched elements...`;
          aiSearchResultsUl.innerHTML = "";

          for (const idx of matchedIndices) {
            await new Promise((resolve) => {
              chrome.tabs.sendMessage(tab.id, {
                action: "HIGHLIGHT_ELEMENT_INDEX",
                index: idx
              }, (res) => {
                if (res && res.status === "OK") {
                  // Render success in list
                  const li = document.createElement("li");
                  li.innerHTML = `<div>Selected <span class="item-name">${res.tag}</span></div> <span class="item-type">Index #${idx}</span>`;
                  aiSearchResultsUl.appendChild(li);
                }
                resolve();
              });
            });
          }

          aiSearchLoading.style.display = "none";
          aiSearchResults.style.display = "block";
          
          // Switch to Builder tab automatically after brief success
          showToast(`Successfully selected ${matchedIndices.length} elements!`);
          setTimeout(() => {
            const builderTabBtn = document.querySelector("[data-tab='test-builder']");
            if (builderTabBtn) builderTabBtn.click();
          }, 1500);

        } else {
          throw new Error("Invalid Response format from Gemini");
        }
      } catch (err) {
        console.error("AI Search Error:", err);
        showAISearchError("API Error: Verify key and model settings.");
      }
    });
  });
}

function showAISearchError(msg) {
  aiSearchLoading.style.display = "none";
  aiSearchError.style.display = "block";
  aiSearchErrorMsg.innerText = msg;
}

// -------------------------------------------------------------
// TEST BUILDER LOGIC
// -------------------------------------------------------------
function setupBuilder() {
  clearAllStepsBtn.addEventListener("click", async () => {
    selectedSteps = [];
    updateStepsUI();

    // Clear highlights on page
    const tab = await getActiveTab();
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "CLEAR_SELECTIONS" });
    }
  });

  generateScriptBtn.addEventListener("click", async () => {
    if (selectedSteps.length === 0) {
      showToast("Please add steps first.");
      return;
    }

    const framework = frameworkSelect.value;
    
    // Display Loader
    codeOutputBlock.innerText = "Generating test script code...";
    codeResultDrawer.style.display = "flex";

    if (apiState.key) {
      await generateScriptWithAI(framework);
    } else {
      generateScriptFallback(framework);
    }
  });
}

function addStepToBuilder(step) {
  // Capture inputs from the inspector state if applicable
  selectedSteps.push(step);
  updateStepsUI();
}

function updateStepsUI() {
  const count = selectedSteps.length;
  stepBadgeCount.innerText = count;
  if (count > 0) {
    stepBadgeCount.classList.remove("zero");
    builderEmptyState.style.display = "none";
    stepsListContainer.style.display = "block";
  } else {
    stepBadgeCount.classList.add("zero");
    builderEmptyState.style.display = "flex";
    stepsListContainer.style.display = "none";
  }

  // Render steps
  stepsList.innerHTML = "";
  selectedSteps.forEach((step, index) => {
    const stepEl = document.createElement("div");
    stepEl.className = "step-item";
    stepEl.setAttribute("data-index", index);

    // Setup input rendering based on selected action
    const valueInputStyle = (step.action === "type" || step.action === "assertText") ? "" : "display: none;";

    stepEl.innerHTML = `
      <div class="step-header">
        <span class="step-number-badge">${index + 1}</span>
        <span class="step-element-label" title="${step.selector}">${step.label}</span>
        <button class="step-remove-btn" data-index="${index}" title="Remove Step">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </button>
      </div>
      <div class="step-config">
        <select class="step-action-select" data-index="${index}">
          <option value="click" ${step.action === "click" ? "selected" : ""}>Click</option>
          <option value="type" ${step.action === "type" ? "selected" : ""}>Type Value</option>
          <option value="hover" ${step.action === "hover" ? "selected" : ""}>Hover</option>
          <option value="assertVisible" ${step.action === "assertVisible" ? "selected" : ""}>Assert Visible</option>
          <option value="assertText" ${step.action === "assertText" ? "selected" : ""}>Assert Text</option>
          <option value="waitFor" ${step.action === "waitFor" ? "selected" : ""}>Wait For</option>
        </select>
        <input type="text" class="step-val-input" data-index="${index}" placeholder="${step.action === "assertText" ? "Assert text content" : "Enter typing string"}" value="${step.value || ""}" style="${valueInputStyle}">
      </div>
    `;

    // Action listener
    const select = stepEl.querySelector(".step-action-select");
    const input = stepEl.querySelector(".step-val-input");

    select.addEventListener("change", (e) => {
      const act = e.target.value;
      selectedSteps[index].action = act;
      
      if (act === "type" || act === "assertText") {
        input.placeholder = act === "assertText" ? "Assert text content" : "Enter typing string";
        input.style.display = "block";
      } else {
        input.style.display = "none";
      }
    });

    input.addEventListener("input", (e) => {
      selectedSteps[index].value = e.target.value;
    });

    // Remove listener
    stepEl.querySelector(".step-remove-btn").addEventListener("click", () => {
      removeStep(index, true);
    });

    stepsList.appendChild(stepEl);
  });
}

// Remove step from list and optionally synchronize badge indices
async function removeStep(idx, notifyPage = true) {
  if (idx < 0 || idx >= selectedSteps.length) return;

  selectedSteps.splice(idx, 1);
  updateStepsUI();

  if (notifyPage) {
    const tab = await getActiveTab();
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: "REMOVE_SELECTION",
        index: idx
      });
    }
  }
}

// -------------------------------------------------------------
// CODE GENERATION (AI and Local Heuristic Template Fallback)
// -------------------------------------------------------------
async function generateScriptWithAI(framework) {
  // Convert list to simple readable array
  const stepsPayload = selectedSteps.map((s, idx) => ({
    step: idx + 1,
    tag: s.tagName,
    selector: s.selector,
    xpath: s.xpath,
    action: s.action,
    value: s.value || "",
    text: s.text || ""
  }));

  const prompt = `Generate a complete, production-ready, professionally written end-to-end automation test script in the "${framework}" framework based on the following step sequence performed on a page.
  Ensure the script contains appropriate import headers, setups (like launching page browser context), correct assertions, logical wait-for strategies, and inline comments describing each action.
  
  Steps sequence:
  ${JSON.stringify(stepsPayload, null, 2)}
  
  Do not explain the code. Do not output standard markdown code blocks (e.g. do not wrap the script with \`\`\` or \`\`\`javascript). Respond ONLY with the raw executable test script code.`;

  try {
    let script = await callGemini(prompt, false);
    
    // Clean up code tags if Gemini ignores negative constraint
    script = script.trim();
    if (script.startsWith("```")) {
      // Remove starting ticks and language label
      script = script.replace(/^```[a-zA-Z0-9-]*\n/, "");
      // Remove trailing ticks
      script = script.replace(/\n```$/, "");
    }

    codeOutputBlock.innerText = script;
  } catch (err) {
    console.error("AI script generation failed, fallback to template:", err);
    generateScriptFallback(framework);
    showToast("AI generation failed. Displaying local template.");
  }
}

// Heuristic Template Fallback when API key is unavailable
function generateScriptFallback(framework) {
  let code = "";
  const dateStr = new Date().toISOString().split('T')[0];

  if (framework.startsWith("playwright")) {
    const isPy = framework === "playwright-py";
    if (isPy) {
      code = `from playwright.sync_api import sync_playwright, expect

def test_automation_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("https://your-webapp.com")
        
        # Sequenced steps generated on ${dateStr}\n`;
      selectedSteps.forEach((s, i) => {
        code += `        # Step ${i + 1}: Target ${s.tagName}\n`;
        const locatorStr = `page.locator('${s.selector}')`;
        if (s.action === "click") {
          code += `        ${locatorStr}.click()\n`;
        } else if (s.action === "type") {
          code += `        ${locatorStr}.fill('${s.value}')\n`;
        } else if (s.action === "hover") {
          code += `        ${locatorStr}.hover()\n`;
        } else if (s.action === "assertVisible") {
          code += `        expect(${locatorStr}).to_be_visible()\n`;
        } else if (s.action === "assertText") {
          code += `        expect(${locatorStr}).to_have_text('${s.value}')\n`;
        } else if (s.action === "waitFor") {
          code += `        ${locatorStr}.wait_for(state="visible")\n`;
        }
      });
      code += `        
        browser.close()
`;
    } else {
      // JS
      code = `const { test, expect } = require('@playwright/test');

test('AI generated test flow - ${dateStr}', async ({ page }) => {
  await page.goto('https://your-webapp.com');
\n`;
      selectedSteps.forEach((s, i) => {
        code += `  // Step ${i + 1}: Target ${s.tagName}\n`;
        const locatorStr = `page.locator('${s.selector}')`;
        if (s.action === "click") {
          code += `  await ${locatorStr}.click();\n`;
        } else if (s.action === "type") {
          code += `  await ${locatorStr}.fill('${s.value}');\n`;
        } else if (s.action === "hover") {
          code += `  await ${locatorStr}.hover();\n`;
        } else if (s.action === "assertVisible") {
          code += `  await expect(${locatorStr}).toBeVisible();\n`;
        } else if (s.action === "assertText") {
          code += `  await expect(${locatorStr}).toHaveText('${s.value}');\n`;
        } else if (s.action === "waitFor") {
          code += `  await ${locatorStr}.waitFor({ state: 'visible' });\n`;
        }
      });
      code += `});\n`;
    }
  } 
  
  else if (framework === "cypress") {
    code = `describe('Automation test flow - ${dateStr}', () => {
  it('performs sequence steps', () => {
    cy.visit('https://your-webapp.com');
\n`;
    selectedSteps.forEach((s, i) => {
      code += `    // Step ${i + 1}: Target ${s.tagName}\n`;
      const locatorStr = `cy.get('${s.selector}')`;
      if (s.action === "click") {
        code += `    ${locatorStr}.click();\n`;
      } else if (s.action === "type") {
        code += `    ${locatorStr}.type('${s.value}');\n`;
      } else if (s.action === "hover") {
        code += `    ${locatorStr}.trigger('mouseover');\n`;
      } else if (s.action === "assertVisible") {
        code += `    ${locatorStr}.should('be.visible');\n`;
      } else if (s.action === "assertText") {
        code += `    ${locatorStr}.should('have.text', '${s.value}');\n`;
      } else if (s.action === "waitFor") {
        code += `    ${locatorStr}.should('exist');\n`;
      }
    });
    code += `  });
});\n`;
  } 
  
  else if (framework.startsWith("selenium")) {
    if (framework === "selenium-py") {
      code = `# Generated on ${dateStr}
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("https://your-webapp.com")
\n`;
      selectedSteps.forEach((s, i) => {
        code += `# Step ${i + 1}: Target ${s.tagName}\n`;
        // Check selector type
        const isXpath = s.selector.startsWith("//") || s.selector.startsWith("(/");
        const byType = isXpath ? "By.XPATH" : "By.CSS_SELECTOR";
        const valEscaped = s.selector.replace(/'/g, "\\'");
        
        if (s.action === "click") {
          code += `driver.find_element(${byType}, '${valEscaped}').click()\n`;
        } else if (s.action === "type") {
          code += `driver.find_element(${byType}, '${valEscaped}').send_keys('${s.value}')\n`;
        } else if (s.action === "hover") {
          code += `from selenium.webdriver.common.action_chains import ActionChains\n`;
          code += `el = driver.find_element(${byType}, '${valEscaped}')\n`;
          code += `ActionChains(driver).move_to_element(el).perform()\n`;
        } else if (s.action === "assertVisible") {
          code += `assert driver.find_element(${byType}, '${valEscaped}').is_displayed()\n`;
        } else if (s.action === "assertText") {
          code += `assert '${s.value}' in driver.find_element(${byType}, '${valEscaped}').text\n`;
        } else if (s.action === "waitFor") {
          code += `WebDriverWait(driver, 10).until(EC.visibility_of_element_located((${byType}, '${valEscaped}')))\n`;
        }
      });
      code += `\ndriver.quit()\n`;
    } 
    
    else if (framework === "selenium-js") {
      code = `// Generated on ${dateStr}
const { Builder, By, until } = require('selenium-webdriver');

(async function example() {
  let driver = await new Builder().forBrowser('chrome').build();
  try {
    await driver.get('https://your-webapp.com');
\n`;
      selectedSteps.forEach((s, i) => {
        code += `    // Step ${i + 1}: Target ${s.tagName}\n`;
        const isXpath = s.selector.startsWith("//") || s.selector.startsWith("(/");
        const byMethod = isXpath ? `By.xpath('${s.xpath.replace(/'/g, "\\'")}')` : `By.css('${s.selector.replace(/'/g, "\\'")}')`;
        
        if (s.action === "click") {
          code += `    await driver.findElement(${byMethod}).click();\n`;
        } else if (s.action === "type") {
          code += `    await driver.findElement(${byMethod}).sendKeys('${s.value}');\n`;
        } else if (s.action === "hover") {
          code += `    const actions = driver.actions({bridge: true});\n`;
          code += `    const el = await driver.findElement(${byMethod});\n`;
          code += `    await actions.move({duration: 100, origin: el, x: 0, y: 0}).perform();\n`;
        } else if (s.action === "assertVisible") {
          code += `    const isDisplayed = await driver.findElement(${byMethod}).isDisplayed();\n`;
          code += `    if (!isDisplayed) throw new Error('Element not visible');\n`;
        } else if (s.action === "assertText") {
          code += `    const text = await driver.findElement(${byMethod}).getText();\n`;
          code += `    if (!text.includes('${s.value}')) throw new Error('Text mismatch');\n`;
        } else if (s.action === "waitFor") {
          code += `    await driver.wait(until.elementLocated(${byMethod}), 10000);\n`;
        }
      });
      code += `  } finally {
    await driver.quit();
  }
})();\n`;
    } 
    
    else if (framework === "selenium-java") {
      code = `// Generated on ${dateStr}
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.interactions.Actions;
import java.time.Duration;

public class AutomationFlow {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("https://your-webapp.com");
        Actions actions = new Actions(driver);
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
\n`;
      selectedSteps.forEach((s, i) => {
        code += `        // Step ${i + 1}: Target ${s.tagName}\n`;
        const isXpath = s.selector.startsWith("//") || s.selector.startsWith("(/");
        const byStr = isXpath ? `By.xpath("${s.xpath.replace(/"/g, "\\\"")}")` : `By.cssSelector("${s.selector.replace(/"/g, "\\\"")}")`;
        
        if (s.action === "click") {
          code += `        driver.findElement(${byStr}).click();\n`;
        } else if (s.action === "type") {
          code += `        driver.findElement(${byStr}).sendKeys("${s.value}");\n`;
        } else if (s.action === "hover") {
          code += `        actions.moveToElement(driver.findElement(${byStr})).perform();\n`;
        } else if (s.action === "assertVisible") {
          code += `        assert driver.findElement(${byStr}).isDisplayed();\n`;
        } else if (s.action === "assertText") {
          code += `        assert driver.findElement(${byStr}).getText().contains("${s.value}");\n`;
        } else if (s.action === "waitFor") {
          code += `        wait.until(ExpectedConditions.visibilityOfElementLocated(${byStr}));\n`;
        }
      });
      code += `        
        driver.quit();
    }
}
`;
    }
  }

  codeOutputBlock.innerText = code;
}

// -------------------------------------------------------------
// CORE FETCH UTILITY TO GEMINI
// -------------------------------------------------------------
async function callGemini(prompt, isJSONResponse = false) {
  if (!apiState.key) {
    throw new Error("No API key configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiState.model}:generateContent?key=${apiState.key}`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1
    }
  };

  if (isJSONResponse) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorJson = await response.json();
    throw new Error(errorJson.error?.message || `API error (${response.status})`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (isJSONResponse) {
    return JSON.parse(textResponse);
  }
  return textResponse;
}

// -------------------------------------------------------------
// CODE OUTPUT DRAWER ACTIONS
// -------------------------------------------------------------
function setupCodeDrawer() {
  // Close drawer
  closeCodeDrawerBtn.addEventListener("click", () => {
    codeResultDrawer.style.display = "none";
  });

  // Copy code to clipboard
  codeCopyBtn.addEventListener("click", () => {
    const text = codeOutputBlock.innerText;
    navigator.clipboard.writeText(text).then(() => {
      codeCopyBtn.innerText = "Copied!";
      codeCopyBtn.style.backgroundColor = "#10b981";
      setTimeout(() => {
        codeCopyBtn.innerText = "Copy Code";
        codeCopyBtn.style.backgroundColor = "";
      }, 1500);
    }).catch(err => {
      console.error("Copy failed:", err);
      showToast("Copy failed, please select and copy manually.");
    });
  });

  // Download Code
  codeDownloadBtn.addEventListener("click", () => {
    const text = codeOutputBlock.innerText;
    const framework = frameworkSelect.value;
    
    // Choose file extension
    let extension = "js";
    if (framework.includes("-py")) extension = "py";
    else if (framework.includes("-java")) extension = "java";
    
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `automated_test_flow.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  });

  // Copy standard locator hooks in Inspector Tab
  document.querySelectorAll(".copy-btn-mini").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        navigator.clipboard.writeText(targetInput.value).then(() => {
          btn.innerText = "Copied";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.innerText = "Copy";
            btn.classList.remove("copied");
          }, 1200);
        });
      }
    });
  });
}

// -------------------------------------------------------------
// UI UTILITIES
// -------------------------------------------------------------
function showToast(message) {
  // Check if a toast already exists
  let toast = document.querySelector(".ai-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "ai-toast";
    // Inline positioning style
    toast.style.position = "absolute";
    toast.style.bottom = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "#1e1b4b";
    toast.style.color = "#e0e7ff";
    toast.style.border = "1px solid rgba(99, 102, 241, 0.4)";
    toast.style.padding = "8px 16px";
    toast.style.borderRadius = "20px";
    toast.style.fontSize = "11px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.3)";
    toast.style.zIndex = "999";
    toast.style.pointerEvents = "none";
    toast.style.transition = "opacity 0.2s";
    document.body.appendChild(toast);
  }
  
  toast.innerText = message;
  toast.style.opacity = "1";
  
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}
