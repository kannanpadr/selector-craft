/**
 * Automated Verification Script for AI Automation Locator Chrome Extension.
 * Tests syntax correctness and uses Playwright to verify page DOM highlights,
 * selection badges, and sidepanel sync.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Step 1: Syntactic validation
function runSyntaxChecks() {
  console.log("=== Running Syntactic Validation ===");
  const jsFiles = ["background.js", "content.js", "sidepanel.js"];
  let allPassed = true;

  jsFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    try {
      // Run node syntax compiler check
      execSync(`node -c "${filePath}"`, { stdio: "inherit" });
      console.log(`✓ ${file} syntax is valid.`);
    } catch (err) {
      console.error(`✗ ${file} has syntax errors!`);
      allPassed = false;
    }
  });

  // Check manifest JSON
  try {
    const manifestPath = path.join(__dirname, "manifest.json");
    JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    console.log("✓ manifest.json is valid JSON.");
  } catch (err) {
    console.error("✗ manifest.json has JSON parsing errors!", err.message);
    allPassed = false;
  }

  if (!allPassed) {
    console.error("Syntax checks failed. Aborting browser tests.");
    process.exit(1);
  }
  console.log("=== Syntax Checks Passed ===\n");
}

// Step 2: Playwright UI and DOM validation
async function runBrowserTests() {
  console.log("=== Starting Playwright Browser Verification ===");
  const extensionPath = __dirname;

  console.log("Launching Chromium with unpacked extension loaded...");
  const context = await chromium.launchPersistentContext("", {
    headless: false, // Extensions are only loaded in headful mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ]
  });

  try {
    // 1. Find registered service worker to retrieve Extension ID
    console.log("Locating extension service worker...");
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }
    const extensionId = background.url().split("/")[2];
    console.log(`✓ Extension ID detected: ${extensionId}`);

    // 2. Open Sidepanel UI directly to test layout
    console.log("Opening sidepanel page...");
    const sidepanelPage = await context.newPage();
    sidepanelPage.on('console', msg => console.log('SIDEPANEL LOG:', msg.text()));
    sidepanelPage.on('pageerror', err => console.error('SIDEPANEL ERROR:', err));
    await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    
    // Validate Header
    await sidepanelPage.waitForSelector(".logo-text h1");
    const headerTitle = await sidepanelPage.locator(".logo-text h1").innerText();
    console.log(`✓ Side panel header loaded: "${headerTitle}"`);

    // Validate Tab navigation links
    const tabTexts = await sidepanelPage.locator(".tab-btn").allInnerTexts();
    console.log(`✓ Tabs detected: ${tabTexts.join(", ")}`);

    // 3. Open test target page (example.com)
    console.log("Opening target test page (example.com)...");
    const testPage = await context.newPage();
    testPage.on('console', msg => console.log('TESTPAGE LOG:', msg.text()));
    testPage.on('pageerror', err => console.error('TESTPAGE ERROR:', err));
    await testPage.goto("https://example.com");

    // 4. Activate inspector toggle in side panel
    console.log("Activating inspector checkbox in sidepanel...");
    await sidepanelPage.evaluate(() => {
      const checkbox = document.getElementById("inspector-toggle");
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change"));
      }
    });
    await sidepanelPage.waitForTimeout(500); // Wait for toggle binding

    // 5. Hover over header on example.com and check highlighting
    console.log("Hovering over example.com 'h1'...");
    await testPage.hover("h1");
    await testPage.waitForSelector(".ai-inspector-hover-box", { state: "visible", timeout: 2000 });
    console.log("✓ Hover highlight box visible on page.");

    const tooltipText = await testPage.locator(".ai-inspector-tooltip").innerText();
    console.log(`✓ Inspector page tooltip content: "${tooltipText.replace(/\n/g, ' ')}"`);

    // 6. Click header to select it
    console.log("Clicking 'h1' element on example.com...");
    await testPage.click("h1");
    await testPage.waitForSelector(".ai-selection-badge", { state: "visible", timeout: 2000 });
    
    const badgeText = await testPage.locator(".ai-selection-badge").innerText();
    console.log(`✓ Selection badge drawn on page. Label: "${badgeText}"`);

    // Click Add to Test Builder button
    console.log("Clicking 'Add to Test Builder' button in side panel...");
    await sidepanelPage.click("#add-to-steps-btn");

    // 7. Check if step was added to side panel Builder tab
    console.log("Switching sidepanel to Builder tab...");
    await sidepanelPage.click("[data-tab='test-builder']");
    await sidepanelPage.waitForSelector("#steps-list-container", { state: "visible", timeout: 2000 });
    
    const stepLabel = await sidepanelPage.locator(".step-element-label").innerText();
    console.log(`✓ Dynamic step successfully added to Builder list. Target: "${stepLabel}"`);

    // 8. Test action configuration selection
    console.log("Configuring step action selector to 'Assert Visible'...");
    await sidepanelPage.selectOption(".step-action-select", "assertVisible");

    // 9. Test Live Selector Verification (Assertion Runner)
    console.log("Testing live selector verification inside Builder step...");
    await sidepanelPage.click(".step-verify-btn");
    await sidepanelPage.waitForTimeout(500);

    // 10. Test Session Recorder checkbox
    console.log("Activating Session Recorder checkbox in sidepanel...");
    await sidepanelPage.evaluate(() => {
      const checkbox = document.getElementById("recorder-toggle");
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change"));
      }
    });
    await sidepanelPage.waitForTimeout(500);
    
    // 11. Generate standard fallback script
    console.log("Generating standard test script...");
    await sidepanelPage.click("#generate-script-btn");
    await sidepanelPage.waitForSelector("#code-result-drawer", { state: "visible", timeout: 2000 });
    
    const generatedCode = await sidepanelPage.locator("#code-output-block").innerText();
    console.log("✓ Generated script code preview (First 150 chars):");
    console.log("----------------------------------------");
    console.log(generatedCode.substring(0, 150) + "...\n----------------------------------------");

    // Close Code drawer
    await sidepanelPage.click("#close-code-drawer-btn");
    await sidepanelPage.waitForSelector("#code-result-drawer", { state: "hidden", timeout: 2000 });

    // 12. Test POM checkbox and POM script fallback generation
    console.log("Activating Export as POM checkbox...");
    await sidepanelPage.evaluate(() => {
      const pomCheckbox = document.getElementById("pom-export-checkbox");
      if (pomCheckbox) {
        pomCheckbox.checked = true;
        pomCheckbox.dispatchEvent(new Event("change"));
      }
    });
    await sidepanelPage.waitForTimeout(500);

    console.log("Generating POM test script...");
    await sidepanelPage.click("#generate-script-btn");
    await sidepanelPage.waitForSelector("#code-result-drawer", { state: "visible", timeout: 2000 });

    const pomGeneratedCode = await sidepanelPage.locator("#code-output-block").innerText();
    console.log("✓ Generated POM code preview (First 150 chars):");
    console.log("----------------------------------------");
    console.log(pomGeneratedCode.substring(0, 150) + "...\n----------------------------------------");

    if (!pomGeneratedCode.includes("MyPage.js")) {
      throw new Error("Page Object Model export does not contain expected MyPage.js template structure.");
    }
    console.log("✓ Page Object Model structure verified successfully!");

    // Close Code drawer
    await sidepanelPage.click("#close-code-drawer-btn");

    console.log("=== Playwright Browser Verification Successful! ===");
  } catch (err) {
    console.error("✗ Verification test failed with error:", err);
    throw err;
  } finally {
    // Teardown browser
    await context.close();
  }
}

// Main execution
(async () => {
  runSyntaxChecks();
  await runBrowserTests();
})().catch(err => {
  console.error("Test execution failed.");
  process.exit(1);
});
