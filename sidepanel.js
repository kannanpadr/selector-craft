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
const recorderToggle = document.getElementById("recorder-toggle");
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
const locatorAiCssInput = document.getElementById("locator-ai-css");
const locatorAiXpathInput = document.getElementById("locator-ai-xpath");
const locatorAiPlaywrightInput = document.getElementById("locator-ai-playwright");
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
const pomExportCheckbox = document.getElementById("pom-export-checkbox");
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
// Quick validation call to Gemini or OpenAI
async function validateApiKey(key) {
  const isGPT = apiState.model.startsWith("gpt");
  
  if (isGPT) {
    const url = "https://api.openai.com/v1/chat/completions";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: apiState.model,
          messages: [{ role: "user", content: "Hello. Respond with one word 'OK'." }],
          max_tokens: 5
        })
      });
      if (response.ok) {
        updateApiStatus(true, "OpenAI API Connection Verified!");
      } else {
        const errorData = await response.json();
        console.error("OpenAI API error details:", errorData);
        updateApiStatus(false, "Invalid OpenAI Key or Model");
      }
    } catch (err) {
      console.error("OpenAI API validation error:", err);
      updateApiStatus(false, "OpenAI connection failed");
    }
  } else {
    // Gemini
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
        updateApiStatus(true, "Gemini API Connection Verified!");
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
}

// -------------------------------------------------------------
// PAGE ELEMENT INSPECTOR
// -------------------------------------------------------------
function setupInspector() {
  inspectorToggle.addEventListener("change", (e) => {
    // Exclude recorder if inspector is turned on
    if (e.target.checked && recorderToggle.checked) {
      recorderToggle.checked = false;
      toggleRecording(false);
    }
    toggleInspector(e.target.checked);
  });

  recorderToggle.addEventListener("change", (e) => {
    // Exclude inspector if recorder is turned on
    if (e.target.checked && inspectorToggle.checked) {
      inspectorToggle.checked = false;
      toggleInspector(false);
    }
    toggleRecording(e.target.checked);
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

async function toggleRecording(enable) {
  const tab = await getActiveTab();
  if (!tab) return;

  chrome.tabs.sendMessage(tab.id, {
    action: "SET_RECORDING",
    enabled: enable
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[sidepanel] Could not toggle recorder:", chrome.runtime.lastError.message);
      recorderToggle.checked = false;
      showToast("Please refresh the webpage to enable recording.");
    }
  });
}

async function verifyLocator(selector, buttonElement) {
  const tab = await getActiveTab();
  if (!tab) {
    showToast("Webpage tab not found.");
    return;
  }
  
  const originalText = buttonElement.innerText;
  buttonElement.innerText = "Checking...";
  
  chrome.tabs.sendMessage(tab.id, {
    action: "VERIFY_SELECTOR",
    selector: selector
  }, (response) => {
    if (chrome.runtime.lastError || !response) {
      buttonElement.innerText = originalText;
      showToast("Verification failed. Make sure tab content script is active.");
      return;
    }
    
    // Remove old state classes
    buttonElement.classList.remove("success", "multiple", "failed");
    
    if (response.status === "OK") {
      const count = response.count;
      if (count === 1) {
        buttonElement.innerText = "1 Match";
        buttonElement.classList.add("success");
      } else if (count > 1) {
        buttonElement.innerText = `${count} Matches`;
        buttonElement.classList.add("multiple");
      } else {
        buttonElement.innerText = "0 Matches";
        buttonElement.classList.add("failed");
      }
    } else {
      buttonElement.innerText = "Error";
      buttonElement.classList.add("failed");
      showToast(`Verify Error: ${response.message}`);
    }
    
    setTimeout(() => {
      buttonElement.innerText = originalText;
      buttonElement.classList.remove("success", "multiple", "failed");
    }, 2500);
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
  
  else if (message.action === "ELEMENT_RECORDED") {
    // If the recorder is checked, add this element directly to steps
    if (recorderToggle.checked) {
      addStepToBuilder(message.element);
      showToast(`Recorded: ${message.element.tagName}`);
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

// Call Gemini to optimize CSS selector, XPath, and Playwright queries
async function optimizeLocatorWithAI(el) {
  aiLocatorLoading.style.display = "flex";
  aiLocatorContent.style.display = "none";
  aiLocatorError.style.display = "none";

  const prompt = `Analyze the following HTML snippet of an element to find on a webpage. Suggest multiple robust and stable locator options for automated end-to-end testing (prioritizing custom test-ids, stable names, roles, or distinctive content over long nested selectors or dynamic CSS classes).
  
  Respond with a JSON object containing exactly four keys:
  1. "css": A robust and stable CSS Selector.
  2. "xpath": A robust and stable XPath locator (must start with //).
  3. "playwright": A native Playwright locator statement (e.g., page.getByRole("button", { name: "Submit" }), page.getByPlaceholder("email"), page.getByTestId("login"), page.getByText("Click here"), etc.).
  4. "explanation": A brief, one-sentence description of why these locators are robust and dynamic-resistant.
  
  HTML:
  ${el.outerHTML}
  
  Context:
  Tag: ${el.tagName}, ID: ${el.id}, Name: ${el.name}, Text content: ${el.innerText}`;

  try {
    const res = await callGemini(prompt, true);
    if (res && res.css && res.xpath && res.playwright) {
      locatorAiCssInput.value = res.css;
      locatorAiXpathInput.value = res.xpath;
      locatorAiPlaywrightInput.value = res.playwright;
      
      // Default to CSS for standard builder selection
      locatorAiSelectorInput.value = res.css;
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
    
    // Fallbacks
    locatorAiCssInput.value = el.cssSelector;
    locatorAiXpathInput.value = el.xpath;
    locatorAiPlaywrightInput.value = `page.locator('${el.cssSelector.replace(/'/g, "\\'")}')`;
    
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
        <button class="step-verify-btn" data-index="${index}" title="Verify Element on page">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
        </button>
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

    // Verify single step listener
    stepEl.querySelector(".step-verify-btn").addEventListener("click", async () => {
      const btn = stepEl.querySelector(".step-verify-btn");
      const tab = await getActiveTab();
      if (!tab) {
        showToast("Webpage tab not found.");
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {
        action: "VERIFY_SELECTOR",
        selector: step.selector
      }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== "OK") {
          btn.className = "step-verify-btn failed";
          showToast("Verify failed.");
        } else {
          const count = response.count;
          if (count > 0) {
            btn.className = "step-verify-btn success";
            showToast(`Found ${count} matching element(s)!`);
          } else {
            btn.className = "step-verify-btn failed";
            showToast("0 elements matched on page.");
          }
        }
        setTimeout(() => {
          btn.className = "step-verify-btn";
        }, 2000);
      });
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

  const isPOM = pomExportCheckbox.checked;
  let pomPromptAddendum = "";
  if (isPOM) {
    pomPromptAddendum = `\n\nSince Page Object Model (POM) export is enabled, please generate BOTH:
    1. A Page Object Class file (e.g. declaring selectors, constructor taking the page/driver instance, and descriptive action methods like fillLoginForm or clickSubmit).
    2. A clean E2E test script file that imports/instantiates the Page Object class and calls its actions to perform the steps sequence.
    Please output both files clearly marked with banner comments, e.g. "// --- LoginPage.js ---" and "// --- login_flow_test.js ---".`;
  }

  const prompt = `Generate a complete, production-ready, professionally written end-to-end automation test script in the "${framework}" framework based on the following step sequence performed on a page.
  Ensure the script contains appropriate import headers, setups (like launching page browser context), correct assertions, logical wait-for strategies, and inline comments describing each action.${pomPromptAddendum}
  
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

// Heuristic POM Template Fallback when API key is unavailable and POM is checked
function generatePOMFallback(framework) {
  let code = "";
  const dateStr = new Date().toISOString().split('T')[0];

  if (framework.startsWith("playwright")) {
    const isPy = framework === "playwright-py";
    if (isPy) {
      // playwright-py
      let locators = "";
      let methods = "";
      let actions = "";
      selectedSteps.forEach((s, i) => {
        const selectorEscaped = s.selector.replace(/'/g, "\\'");
        const valEscaped = (s.value || "").replace(/'/g, "\\'");
        
        locators += `        # Step ${i + 1}: Target ${s.tagName}\n`;
        locators += `        self.element${i + 1} = page.locator('${selectorEscaped}')\n`;

        if (s.action === "click") {
          methods += `    def click_element${i + 1}(self):\n        self.element${i + 1}.click()\n\n`;
          actions += `    my_page.click_element${i + 1}()\n`;
        } else if (s.action === "type") {
          methods += `    def type_element${i + 1}(self, value):\n        self.element${i + 1}.fill(value)\n\n`;
          actions += `    my_page.type_element${i + 1}('${valEscaped}')\n`;
        } else if (s.action === "hover") {
          methods += `    def hover_element${i + 1}(self):\n        self.element${i + 1}.hover()\n\n`;
          actions += `    my_page.hover_element${i + 1}()\n`;
        } else if (s.action === "assertVisible") {
          methods += `    def assert_visible_element${i + 1}(self):\n        expect(self.element${i + 1}).to_be_visible()\n\n`;
          actions += `    my_page.assert_visible_element${i + 1}()\n`;
        } else if (s.action === "assertText") {
          methods += `    def assert_text_element${i + 1}(self, text):\n        expect(self.element${i + 1}).to_have_text(text)\n\n`;
          actions += `    my_page.assert_text_element${i + 1}('${valEscaped}')\n`;
        } else if (s.action === "waitFor") {
          methods += `    def wait_for_element${i + 1}(self):\n        self.element${i + 1}.wait_for(state="visible")\n\n`;
          actions += `    my_page.wait_for_element${i + 1}()\n`;
        }
      });

      code = `# --- my_page.py (Page Object Model) ---
# Generated on ${dateStr}
from playwright.sync_api import Page, expect

class MyPage:
    def __init__(self, page: Page):
        self.page = page
        # Element Locators
${locators}
    def goto(self):
        self.page.goto("https://your-webapp.com")

${methods}
# --- test_script.py (E2E Test) ---
from playwright.sync_api import sync_playwright
from my_page import MyPage

def test_automation_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        my_page = MyPage(page)
        my_page.goto()
        
        # Actions
${actions}        
        browser.close()
`;
    } else {
      // playwright-js
      let locators = "";
      let methods = "";
      let actions = "";
      selectedSteps.forEach((s, i) => {
        const selectorEscaped = s.selector.replace(/'/g, "\\'");
        const valEscaped = (s.value || "").replace(/'/g, "\\'");
        
        locators += `    // Step ${i + 1}: Target ${s.tagName}\n`;
        locators += `    this.element${i + 1} = page.locator('${selectorEscaped}');\n`;

        if (s.action === "click") {
          methods += `  async clickElement${i + 1}() {\n    await this.element${i + 1}.click();\n  }\n\n`;
          actions += `  await myPage.clickElement${i + 1}();\n`;
        } else if (s.action === "type") {
          methods += `  async typeElement${i + 1}(value) {\n    await this.element${i + 1}.fill(value);\n  }\n\n`;
          actions += `  await myPage.typeElement${i + 1}('${valEscaped}');\n`;
        } else if (s.action === "hover") {
          methods += `  async hoverElement${i + 1}() {\n    await this.element${i + 1}.hover();\n  }\n\n`;
          actions += `  await myPage.hoverElement${i + 1}();\n`;
        } else if (s.action === "assertVisible") {
          methods += `  async assertVisibleElement${i + 1}() {\n    await expect(this.element${i + 1}).toBeVisible();\n  }\n\n`;
          actions += `  await myPage.assertVisibleElement${i + 1}();\n`;
        } else if (s.action === "assertText") {
          methods += `  async assertTextElement${i + 1}(text) {\n    await expect(this.element${i + 1}).toHaveText(text);\n  }\n\n`;
          actions += `  await myPage.assertTextElement${i + 1}('${valEscaped}');\n`;
        } else if (s.action === "waitFor") {
          methods += `  async waitForElement${i + 1}() {\n    await this.element${i + 1}.waitFor({ state: 'visible' });\n  }\n\n`;
          actions += `  await myPage.waitForElement${i + 1}();\n`;
        }
      });

      code = `// --- MyPage.js (Page Object Model) ---
// Generated on ${dateStr}
const { expect } = require('@playwright/test');

class MyPage {
  constructor(page) {
    this.page = page;
    // Element Locators
${locators}  }

  async goto() {
    await this.page.goto('https://your-webapp.com');
  }

${methods}}

module.exports = { MyPage };

// --- test.js (E2E Test) ---
const { test } = require('@playwright/test');
const { MyPage } = require('./MyPage');

test('POM test flow - ${dateStr}', async ({ page }) => {
  const myPage = new MyPage(page);
  await myPage.goto();
${actions}});
`;
    }
  } 
  
  else if (framework === "cypress") {
    let getters = "";
    let methods = "";
    let actions = "";
    selectedSteps.forEach((s, i) => {
      const selectorEscaped = s.selector.replace(/'/g, "\\'");
      const valEscaped = (s.value || "").replace(/'/g, "\\'");
      
      getters += `  getElement${i + 1}() {\n    return cy.get('${selectorEscaped}');\n  }\n\n`;

      if (s.action === "click") {
        methods += `  clickElement${i + 1}() {\n    this.getElement${i + 1}().click();\n  }\n\n`;
        actions += `    myPage.clickElement${i + 1}();\n`;
      } else if (s.action === "type") {
        methods += `  typeElement${i + 1}(value) {\n    this.getElement${i + 1}().type(value);\n  }\n\n`;
        actions += `    myPage.typeElement${i + 1}('${valEscaped}');\n`;
      } else if (s.action === "hover") {
        methods += `  hoverElement${i + 1}() {\n    this.getElement${i + 1}().trigger('mouseover');\n  }\n\n`;
        actions += `    myPage.hoverElement${i + 1}();\n`;
      } else if (s.action === "assertVisible") {
        methods += `  assertVisibleElement${i + 1}() {\n    this.getElement${i + 1}().should('be.visible');\n  }\n\n`;
        actions += `    myPage.assertVisibleElement${i + 1}();\n`;
      } else if (s.action === "assertText") {
        methods += `  assertTextElement${i + 1}(text) {\n    this.getElement${i + 1}().should('have.text', text);\n  }\n\n`;
        actions += `    myPage.assertTextElement${i + 1}('${valEscaped}');\n`;
      } else if (s.action === "waitFor") {
        methods += `  waitForElement${i + 1}() {\n    this.getElement${i + 1}().should('exist');\n  }\n\n`;
        actions += `    myPage.waitForElement${i + 1}();\n`;
      }
    });

    code = `// --- MyPage.js (Page Object Model) ---
// Generated on ${dateStr}
class MyPage {
  visit() {
    cy.visit('https://your-webapp.com');
  }

${getters}${methods}}

export default MyPage;

// --- spec.cy.js (E2E Test) ---
import MyPage from './MyPage';

describe('POM test flow - ${dateStr}', () => {
  const myPage = new MyPage();

  it('performs sequence steps', () => {
    myPage.visit();
${actions}  });
});
`;
  } 
  
  else if (framework.startsWith("selenium")) {
    if (framework === "selenium-py") {
      let locators = "";
      let methods = "";
      let actions = "";
      selectedSteps.forEach((s, i) => {
        const selectorEscaped = s.selector.replace(/'/g, "\\'");
        const valEscaped = (s.value || "").replace(/'/g, "\\'");
        const isXpath = s.selector.startsWith("//") || s.selector.startsWith("(/");
        const byType = isXpath ? "By.XPATH" : "By.CSS_SELECTOR";

        locators += `        # Step ${i + 1}: Target ${s.tagName}\n`;
        locators += `        self.element${i + 1}_locator = (${byType}, '${selectorEscaped}')\n`;

        if (s.action === "click") {
          methods += `    def click_element${i + 1}(self):\n        self.driver.find_element(*self.element${i + 1}_locator).click()\n\n`;
          actions += `driver_page.click_element${i + 1}()\n`;
        } else if (s.action === "type") {
          methods += `    def type_element${i + 1}(self, value):\n        self.driver.find_element(*self.element${i + 1}_locator).send_keys(value)\n\n`;
          actions += `driver_page.type_element${i + 1}('${valEscaped}')\n`;
        } else if (s.action === "hover") {
          methods += `    def hover_element${i + 1}(self):\n        from selenium.webdriver.common.action_chains import ActionChains\n        el = self.driver.find_element(*self.element${i + 1}_locator)\n        ActionChains(self.driver).move_to_element(el).perform()\n\n`;
          actions += `driver_page.hover_element${i + 1}()\n`;
        } else if (s.action === "assertVisible") {
          methods += `    def assert_visible_element${i + 1}(self):\n        assert self.driver.find_element(*self.element${i + 1}_locator).is_displayed()\n\n`;
          actions += `driver_page.assert_visible_element${i + 1}()\n`;
        } else if (s.action === "assertText") {
          methods += `    def assert_text_element${i + 1}(self, text):\n        assert text in self.driver.find_element(*self.element${i + 1}_locator).text\n\n`;
          actions += `driver_page.assert_text_element${i + 1}('${valEscaped}')\n`;
        } else if (s.action === "waitFor") {
          methods += `    def wait_for_element${i + 1}(self):\n        WebDriverWait(self.driver, 10).until(EC.visibility_of_element_located(self.element${i + 1}_locator))\n\n`;
          actions += `driver_page.wait_for_element${i + 1}()\n`;
        }
      });

      code = `# --- my_page.py (Page Object Model) ---
# Generated on ${dateStr}
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class MyPage:
    def __init__(self, driver):
        self.driver = driver
        # Element Locators
${locators}
    def goto(self):
        self.driver.get("https://your-webapp.com")

${methods}
# --- test_script.py (E2E Test) ---
from selenium import webdriver
from my_page import MyPage

driver = webdriver.Chrome()
driver_page = MyPage(driver)
driver_page.goto()

# Actions
${actions}
driver.quit()
`;
    } 
    
    else if (framework === "selenium-js") {
      let locators = "";
      let methods = "";
      let actions = "";
      selectedSteps.forEach((s, i) => {
        const selectorEscaped = s.selector.replace(/'/g, "\\'");
        const valEscaped = (s.value || "").replace(/'/g, "\\'");
        const isXpath = s.selector.startsWith("//") || s.selector.startsWith("(/");
        const byMethod = isXpath ? `By.xpath('${selectorEscaped}')` : `By.css('${selectorEscaped}')`;

        locators += `    // Step ${i + 1}: Target ${s.tagName}\n`;
        locators += `    this.element${i + 1}Locator = ${byMethod};\n`;

        if (s.action === "click") {
          methods += `  async clickElement${i + 1}() {\n    await this.driver.findElement(this.element${i + 1}Locator).click();\n  }\n\n`;
          actions += `    await myPage.clickElement${i + 1}();\n`;
        } else if (s.action === "type") {
          methods += `  async typeElement${i + 1}(value) {\n    await this.driver.findElement(this.element${i + 1}Locator).sendKeys(value);\n  }\n\n`;
          actions += `    await myPage.typeElement${i + 1}('${valEscaped}');\n`;
        } else if (s.action === "hover") {
          methods += `  async hoverElement${i + 1}() {\n    const actions = this.driver.actions({bridge: true});\n    const el = await this.driver.findElement(this.element${i + 1}Locator);\n    await actions.move({duration: 100, origin: el, x: 0, y: 0}).perform();\n  }\n\n`;
          actions += `    await myPage.hoverElement${i + 1}();\n`;
        } else if (s.action === "assertVisible") {
          methods += `  async assertVisibleElement${i + 1}() {\n    const isDisplayed = await this.driver.findElement(this.element${i + 1}Locator).isDisplayed();\n    if (!isDisplayed) throw new Error('Element not visible');\n  }\n\n`;
          actions += `    await myPage.assertVisibleElement${i + 1}();\n`;
        } else if (s.action === "assertText") {
          methods += `  async assertTextElement${i + 1}(text) {\n    const elText = await this.driver.findElement(this.element${i + 1}Locator).getText();\n    if (!elText.includes(text)) throw new Error('Text mismatch');\n  }\n\n`;
          actions += `    await myPage.assertTextElement${i + 1}('${valEscaped}');\n`;
        } else if (s.action === "waitFor") {
          methods += `  async waitForElement${i + 1}() {\n    await this.driver.wait(until.elementLocated(this.element${i + 1}Locator), 10000);\n  }\n\n`;
          actions += `    await myPage.waitForElement${i + 1}();\n`;
        }
      });

      code = `// --- MyPage.js (Page Object Model) ---
// Generated on ${dateStr}
const { By, until } = require('selenium-webdriver');

class MyPage {
  constructor(driver) {
    this.driver = driver;
    // Element Locators
${locators}  }

  async goto() {
    await this.driver.get('https://your-webapp.com');
  }

${methods}}

module.exports = { MyPage };

// --- test.js (E2E Test) ---
const { Builder } = require('selenium-webdriver');
const { MyPage } = require('./MyPage');

(async function example() {
  let driver = await new Builder().forBrowser('chrome').build();
  try {
    const myPage = new MyPage(driver);
    await myPage.goto();
${actions}  } finally {
    await driver.quit();
  }
})();
`;
    } 
    
    else if (framework === "selenium-java") {
      let locators = "";
      let methods = "";
      let actions = "";
      selectedSteps.forEach((s, i) => {
        const selectorEscaped = s.selector.replace(/"/g, "\\\"");
        const valEscaped = (s.value || "").replace(/"/g, "\\\"");
        const isXpath = s.selector.startsWith("//") || s.selector.startsWith("(/");
        const byStr = isXpath ? `By.xpath("${selectorEscaped}")` : `By.cssSelector("${selectorEscaped}")`;

        locators += `    // Step ${i + 1}: Target ${s.tagName}\n`;
        locators += `    private By element${i + 1}Locator = ${byStr};\n`;

        if (s.action === "click") {
          methods += `    public void clickElement${i + 1}() {\n        driver.findElement(element${i + 1}Locator).click();\n    }\n\n`;
          actions += `            myPage.clickElement${i + 1}();\n`;
        } else if (s.action === "type") {
          methods += `    public void typeElement${i + 1}(String value) {\n        driver.findElement(element${i + 1}Locator).sendKeys(value);\n    }\n\n`;
          actions += `            myPage.typeElement${i + 1}("${valEscaped}");\n`;
        } else if (s.action === "hover") {
          methods += `    public void hoverElement${i + 1}() {\n        actions.moveToElement(driver.findElement(element${i + 1}Locator)).perform();\n    }\n\n`;
          actions += `            myPage.hoverElement${i + 1}();\n`;
        } else if (s.action === "assertVisible") {
          methods += `    public void assertVisibleElement${i + 1}() {\n        assert driver.findElement(element${i + 1}Locator).isDisplayed();\n    }\n\n`;
          actions += `            myPage.assertVisibleElement${i + 1}();\n`;
        } else if (s.action === "assertText") {
          methods += `    public void assertTextElement${i + 1}(String text) {\n        assert driver.findElement(element${i + 1}Locator).getText().contains(text);\n    }\n\n`;
          actions += `            myPage.assertTextElement${i + 1}("${valEscaped}");\n`;
        } else if (s.action === "waitFor") {
          methods += `    public void waitForElement${i + 1}() {\n        wait.until(ExpectedConditions.visibilityOfElementLocated(element${i + 1}Locator));\n    }\n\n`;
          actions += `            myPage.waitForElement${i + 1}();\n`;
        }
      });

      code = `// --- MyPage.java (Page Object Model) ---
// Generated on ${dateStr}
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.interactions.Actions;
import java.time.Duration;

public class MyPage {
    private WebDriver driver;
    private WebDriverWait wait;
    private Actions actions;

    // Element Locators
${locators}
    public MyPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        this.actions = new Actions(driver);
    }

    public void gotoPage() {
        driver.get("https://your-webapp.com");
    }

${methods}}

// --- AutomationFlow.java (E2E Test) ---
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class AutomationFlow {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        try {
            MyPage myPage = new MyPage(driver);
            myPage.gotoPage();
${actions}        } finally {
            driver.quit();
        }
    }
}
`;
    }
  }

  codeOutputBlock.innerText = code;
}

// Heuristic Template Fallback when API key is unavailable
function generateScriptFallback(framework) {
  if (pomExportCheckbox.checked) {
    generatePOMFallback(framework);
    return;
  }
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

  const isGPT = apiState.model.startsWith("gpt");

  if (isGPT) {
    const url = "https://api.openai.com/v1/chat/completions";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiState.key}`
    };

    const body = {
      model: apiState.model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    };

    if (isJSONResponse) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorJson = await response.json();
      throw new Error(errorJson.error?.message || `OpenAI API error (${response.status})`);
    }

    const data = await response.json();
    const textResponse = data.choices?.[0]?.message?.content;
    
    if (isJSONResponse) {
      return JSON.parse(textResponse);
    }
    return textResponse;
  } else {
    // Gemini
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

  // Verify standard locator hooks in Inspector Tab
  document.querySelectorAll(".verify-btn-mini").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-verify-target");
      const targetInput = document.getElementById(targetId);
      if (targetInput && targetInput.value && targetInput.value !== "-") {
        verifyLocator(targetInput.value, btn);
      } else {
        showToast("No selector available to verify.");
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
