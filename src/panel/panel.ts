import type { RuntimeMessage } from '../shared/messages';
import type { GeneratedLocator, RecordedAction } from '../shared/types';

// DOM Elements
const pickBtn = document.getElementById('pick-btn') as HTMLButtonElement;
const resultsSection = document.getElementById('results-section') as HTMLElement;
const locatorList = document.getElementById('locator-list') as HTMLElement;

const tabFinder = document.getElementById('tab-finder') as HTMLButtonElement;
const tabRecorder = document.getElementById('tab-recorder') as HTMLButtonElement;
const viewFinder = document.getElementById('view-finder') as HTMLElement;
const viewRecorder = document.getElementById('view-recorder') as HTMLElement;

const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
const switchTabBtn = document.getElementById('switch-tab-btn') as HTMLButtonElement;
const assertToggle = document.getElementById('assert-toggle') as HTMLInputElement;

const fileSelector = document.getElementById('file-selector') as HTMLSelectElement;
const mainCodeBox = document.getElementById('main-code-box') as HTMLTextAreaElement;
const copyMainBtn = document.getElementById('copy-main-btn') as HTMLButtonElement;

const featuresBtn = document.getElementById('features-btn') as HTMLButtonElement;
const featuresMenu = document.getElementById('features-menu') as HTMLElement;
const toggleFaker = document.getElementById('toggle-faker') as HTMLInputElement;
const toggleTags = document.getElementById('toggle-tags') as HTMLInputElement;
const toggleAuth = document.getElementById('toggle-auth') as HTMLInputElement;

const assertionModal = document.getElementById('assertion-modal') as HTMLElement;
const assertVisibleBtn = document.getElementById('assert-visible-btn') as HTMLButtonElement;
const assertEnabledBtn = document.getElementById('assert-enabled-btn') as HTMLButtonElement;
const assertTextBtn = document.getElementById('assert-text-btn') as HTMLButtonElement;
const assertValueBtn = document.getElementById('assert-value-btn') as HTMLButtonElement;
const assertCancelBtn = document.getElementById('assert-cancel-btn') as HTMLButtonElement;

// State
let isPickingMode = false;
let isRecording = false;
let recordedActions: RecordedAction[] = [];
let pendingAssertionTarget: any = null;
let currentTabUrl = '';

let generatedFiles: Record<string, string> = {
  raw_test: '', faker_data: '', auth_setup: '', pom_test: '', page_object: ''
};

// Tabs
tabFinder.addEventListener('click', () => {
  tabFinder.classList.add('active'); tabRecorder.classList.remove('active');
  viewFinder.style.display = 'block'; viewRecorder.style.display = 'none';
});
tabRecorder.addEventListener('click', () => {
  tabRecorder.classList.add('active'); tabFinder.classList.remove('active');
  viewFinder.style.display = 'none'; viewRecorder.style.display = 'block';
});

// File Viewer Switcher
fileSelector.addEventListener('change', () => {
  mainCodeBox.value = generatedFiles[fileSelector.value] || '// No code generated for this file yet.';
});

// Features Menu & Toggles
featuresBtn.addEventListener('click', () => {
  featuresMenu.style.display = featuresMenu.style.display === 'none' ? 'block' : 'none';
});

[toggleFaker, toggleTags, toggleAuth].forEach(toggle => {
  toggle.addEventListener('change', () => generateCode());
});

// Manual "+ Tab" Button
switchTabBtn.addEventListener('click', () => {
  recordedActions.push({ type: 'new_tab', actionType: 'click', locatorCode: '', tagName: '', isAuto: false });
  generateCode();
});

// Finder Logic
pickBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;

  if (isPickingMode) {
    isPickingMode = false;
    pickBtn.textContent = '🎯 Pick Element';
    pickBtn.style.background = 'var(--accent)';
    await chrome.runtime.sendMessage({ type: 'STOP_PICK', tabId: tab.id } as RuntimeMessage);
  } else {
    isPickingMode = true;
    resultsSection.style.display = 'none';
    pickBtn.textContent = '🛑 Stop Picking (Esc)';
    pickBtn.style.background = 'var(--warning)';
    await chrome.runtime.sendMessage({ type: 'START_PICK', tabId: tab.id, language: 'javascript', testIdAttribute: 'data-testid' } as RuntimeMessage);
  }
});

async function copyToClipboard(text: string, btnElement?: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
    if (btnElement) {
      const originalText = btnElement.innerHTML;
      btnElement.innerHTML = 'Copied! ✓';
      setTimeout(() => { btnElement.innerHTML = originalText; }, 1500);
    }
  } catch (err) { }
}

function renderLocators(locators: GeneratedLocator[]) {
  locatorList.innerHTML = '';
  if (locators.length === 0) return;

  locators.forEach((loc) => {
    const div = document.createElement('div');
    div.className = `locator-card ${loc.isRecommended ? 'recommended' : 'unique'}`;
    div.innerHTML = `
      <code class="locator-text">${loc.code}</code>
      ${loc.isRecommended ? '<span class="badge" style="background: gold; color: black; margin-top: 8px; display: inline-block;">★ Recommended</span>' : ''}
    `;
    const codeEl = div.querySelector('.locator-text') as HTMLElement;
    const originalText = loc.code;
    div.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(loc.code);
        codeEl.innerHTML = '<span style="color: var(--success); font-weight: bold; display: flex; align-items: center; gap: 4px;">✓ Copied to clipboard!</span>';
        setTimeout(() => { codeEl.textContent = originalText; }, 1500);
      } catch (err) { }
    });
    locatorList.appendChild(div);
  });
}

recordBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null || !tab.url) return;
  currentTabUrl = tab.url;

  if (isRecording) {
    isRecording = false;
    recordBtn.textContent = '⏺ Start Recording';
    recordBtn.style.background = 'var(--accent)';
    assertToggle.checked = false;
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId: tab.id } as RuntimeMessage);
  } else {
    isRecording = true;
    recordedActions = [];
    generatedFiles = { raw_test: '', faker_data: '', auth_setup: '', pom_test: '', page_object: '' };
    mainCodeBox.value = '';
    
    recordBtn.textContent = '🛑 Stop Recording';
    recordBtn.style.background = 'var(--warning)';
    
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => sessionStorage.removeItem('locatorHealerRecording') });
    await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: tab.id, testIdAttribute: 'data-testid', language: 'javascript' } as RuntimeMessage);
  }
});

assertToggle.addEventListener('change', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  await chrome.runtime.sendMessage({ type: 'TOGGLE_ASSERTION_MODE', tabId: tab.id, isAssertionMode: assertToggle.checked } as RuntimeMessage);
});

function closeModal() { assertionModal.style.display = 'none'; pendingAssertionTarget = null; }
assertCancelBtn.addEventListener('click', closeModal);

function addAssertion(actionType: any) {
  if (!pendingAssertionTarget) return;
  recordedActions.push({
    type: 'assertion', actionType,
    locatorCode: pendingAssertionTarget.locatorCode, tagName: pendingAssertionTarget.tagName,
    text: pendingAssertionTarget.text, value: pendingAssertionTarget.value
  });
  closeModal();
  generateCode();
}

assertVisibleBtn.addEventListener('click', () => addAssertion('assert_visible'));
assertEnabledBtn.addEventListener('click', () => addAssertion('assert_enabled'));
assertTextBtn.addEventListener('click', () => addAssertion('assert_text'));
assertValueBtn.addEventListener('click', () => addAssertion('assert_value'));

function getVarName(locatorCode: string, tagName: string, text?: string): string {
  try {
    let base = '';
    if (locatorCode.includes('getByRole')) {
      const nameMatch = locatorCode.match(/name:\s*['"](.+?)['"]/)?.[1];
      const roleMatch = locatorCode.match(/getByRole\(['"](.+?)['"]/)?.[1];
      if (nameMatch) base = nameMatch; else base = roleMatch || 'element';
    } else if (locatorCode.includes('getByLabel') || locatorCode.includes('getByPlaceholder')) {
      base = locatorCode.match(/['"](.+?)['"]\)$/)?.[1] || 'input';
    } else if (locatorCode.includes('getByText')) {
      base = locatorCode.match(/getByText\(['"](.+?)['"]/)?.[1] || 'text';
    } else if (locatorCode.includes('hasText:')) {
      base = locatorCode.match(/hasText:\s*['"](.+?)['"]/)?.[1] || 'item';
    } else if (locatorCode.includes('normalize-space()=')) {
      base = locatorCode.match(/normalize-space\(\)\s*=\s*['"](.+?)['"]/)?.[1] || 'text';
    } else if (text && text.length > 0 && text.length < 25) {
      base = text;
    } else {
      base = tagName || 'element';
    }
    let clean = base.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (clean.length > 25) clean = clean.substring(0, 25); 
    const words = clean.split(/\s+/);
    if (words.length === 0) return 'element';
    const camelCase = words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    if (tagName === 'input' || tagName === 'textarea') return camelCase + 'Input';
    if (tagName === 'button' || locatorCode.includes('button')) return camelCase + 'Btn';
    if (tagName === 'a' || locatorCode.includes('link') || locatorCode.includes('menuitem')) return camelCase + 'Link';
    return camelCase;
  } catch { return 'element'; }
}

function getFakerValue(locatorCode: string, value: string | undefined): string {
  const lowerLocator = locatorCode.toLowerCase();
  const lowerVal = (value || '').toLowerCase();
  if (lowerLocator.includes('pass') || lowerVal.includes('pass')) return 'testData.password';
  else if (lowerLocator.includes('user') || lowerLocator.includes('email') || lowerVal.includes('user') || lowerVal.includes('admin')) return 'testData.username';
  return 'testData.randomText';
}

function generateCode() {
  try {
    const actionWithoutHover = recordedActions.filter((act, index) => {
      if (act.actionType === 'hover') {
        const hasLaterClick = recordedActions.slice(index + 1).some(later => later.locatorCode === act.locatorCode && later.actionType === 'click');
        if (hasLaterClick) return false;
      }
      return true;
    });

    const filteredActions = actionWithoutHover.filter((act, index) => {
      if (act.actionType === 'click') {
        const nextAct = actionWithoutHover[index + 1];
        if (nextAct && nextAct.locatorCode === act.locatorCode && nextAct.actionType === 'fill') return false;
      }
      return true;
    });

    const isFaker = toggleFaker.checked;
    const isAuth = toggleAuth.checked;
    const isTags = toggleTags.checked;
    const tagString = isTags ? ' @smoke @regression' : '';
    const hasNewTabs = filteredActions.some(a => a.type === 'new_tab');
    const testParams = hasNewTabs ? '{ context, page }' : '{ page }';

    // ─── 1. GENERATE RAW TEST FILE ───
    let rawTestCode = `import { test, expect } from '@playwright/test';\n`;
    if (isFaker) rawTestCode += `import { testData } from './faker_data';\n`;
    rawTestCode += `\n`;
    if (isAuth) rawTestCode += `test.use({ storageState: 'auth.json' });\n\n`;
    rawTestCode += `test('Raw Recorded Flow${tagString}', async (${testParams}) => {\n  await page.goto('${currentTabUrl || '/'}');\n\n`;

    let currentPageVar = 'page';
    let tabCounter = 1;

    for (let i = 0; i < filteredActions.length; i++) {
      const act = filteredActions[i]!;
      
      if (act.type === 'new_tab') {
        const newPageVar = `page${tabCounter++}`;
        if (act.isAuto) {
          rawTestCode += `  // Auto-detected new tab\n`;
          rawTestCode += `  const ${newPageVar} = await context.waitForEvent('page');\n`;
          rawTestCode += `  await ${newPageVar}.waitForLoadState();\n\n`;
        } else {
          rawTestCode += `  // ⚠️ USER MANUALLY OPENED NEW TAB\n`;
          rawTestCode += `  const ${newPageVar} = context.pages()[context.pages().length - 1];\n`;
          rawTestCode += `  await ${newPageVar}.waitForLoadState();\n\n`;
        }
        currentPageVar = newPageVar;
        continue;
      }

      let baseLocator = act.locatorCode.replace(/^page\./, '');
      if (act.isIframe) baseLocator = `${currentPageVar}.frameLocator('iframe').${baseLocator}`;
      else baseLocator = `${currentPageVar}.${baseLocator}`;

      let fillValue = `'${act.value}'`;
      if (isFaker && act.value) fillValue = getFakerValue(act.locatorCode, act.value);

      if (act.type === 'action') {
        const nextAct = filteredActions[i + 1];
        if (nextAct && nextAct.type === 'new_tab' && nextAct.isAuto && act.actionType === 'click') {
           const newPageVar = `page${tabCounter++}`;
           rawTestCode += `  // Click opened new tab\n`;
           rawTestCode += `  const [${newPageVar}] = await Promise.all([\n`;
           rawTestCode += `    context.waitForEvent('page'),\n`;
           rawTestCode += `    ${baseLocator}.click()\n`;
           rawTestCode += `  ]);\n`;
           rawTestCode += `  await ${newPageVar}.waitForLoadState();\n\n`;
           currentPageVar = newPageVar;
           i++; continue;
        }

        if (act.actionType === 'fill') {
          if (act.isDateField) {
            rawTestCode += `  const dateStr = new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0];\n`;
            rawTestCode += `  await ${baseLocator}.fill(dateStr);\n`;
          } else rawTestCode += `  await ${baseLocator}.fill(${fillValue});\n`;
        } else if (act.actionType === 'select') rawTestCode += `  await ${baseLocator}.selectOption('${act.value}');\n`;
        else if (act.actionType === 'click') rawTestCode += `  await ${baseLocator}.click();\n`;
        else if (act.actionType === 'hover') rawTestCode += `  await ${baseLocator}.hover();\n`;
        else if (act.actionType === 'press') rawTestCode += `  await ${baseLocator}.press('${act.value}');\n`;
      } else if (act.type === 'assertion') {
        if (act.actionType === 'assert_visible') rawTestCode += `  await expect(${baseLocator}).toBeVisible();\n`;
        if (act.actionType === 'assert_enabled') rawTestCode += `  await expect(${baseLocator}).toBeEnabled();\n`;
        if (act.actionType === 'assert_text') rawTestCode += `  await expect(${baseLocator}).toHaveText('${act.text?.replace(/'/g, "\\'")}');\n`;
        if (act.actionType === 'assert_value') rawTestCode += `  await expect(${baseLocator}).toHaveValue('${act.value?.replace(/'/g, "\\'")}');\n`;
      }
    }
    rawTestCode += `});\n`;
    generatedFiles.raw_test = rawTestCode;

    if (isFaker) {
      generatedFiles.faker_data = `import { faker } from '@faker-js/faker';\n\nexport const testData = {\n  username: faker.internet.userName(),\n  password: faker.internet.password(),\n  randomText: faker.lorem.word()\n};\n`;
    } else generatedFiles.faker_data = `// Enable the ⚙️ Add Faker.js Data toggle to generate this file.`;

    if (isAuth) {
      let loginSteps = '';
      filteredActions.forEach(act => {
        if (act.type === 'new_tab') return;
        let baseLocator = act.locatorCode.replace(/^page\./, '');
        let locator = `page.${baseLocator}`; 
        if (act.actionType === 'fill') {
          let val = `'${act.value}'`;
          if (isFaker) val = getFakerValue(act.locatorCode, act.value);
          loginSteps += `  await ${locator}.fill(${val});\n`;
        } else if (act.actionType === 'click' && act.locatorCode.toLowerCase().includes('login')) {
          loginSteps += `  await ${locator}.click();\n  await page.waitForURL('**/dashboard**');\n`;
        }
      });
      generatedFiles.auth_setup = `import { test as setup } from '@playwright/test';\n`;
      if (isFaker) generatedFiles.auth_setup += `import { testData } from './faker_data';\n`;
      generatedFiles.auth_setup += `\nsetup('authenticate', async ({ page }) => {\n  await page.goto('${currentTabUrl || '/'}');\n${loginSteps}\n  await page.context().storageState({ path: 'auth.json' });\n});\n`;
    } else generatedFiles.auth_setup = `// Enable the ⚙️ Add Auth StorageState toggle to generate this file.`;

    // ─── 4. GENERATE POM FILES ───
    interface ActionMethod { name: string; params: string[]; steps: string[]; isAssertion?: boolean; }
    const methods: ActionMethod[] = [];
    let currentMethod: ActionMethod | null = null;
    const usedVarNames = new Set<string>();
    const locatorMap = new Map<string, string>();

    const getLocatorVar = (locatorCode: string, tagName: string, text?: string) => {
      if (locatorMap.has(locatorCode)) return locatorMap.get(locatorCode)!;
      let varName = getVarName(locatorCode, tagName, text);
      let counter = 1;
      while (usedVarNames.has(varName)) { varName = varName + counter++; }
      usedVarNames.add(varName);
      locatorMap.set(locatorCode, varName);
      return varName;
    };

    for (let i = 0; i < filteredActions.length; i++) {
      const act = filteredActions[i]!;
      
      // ✅ FIX: Only generate switchTab for MANUAL tabs
      if (act.type === 'new_tab') {
        if (!act.isAuto) {
          if (currentMethod) { methods.push(currentMethod); currentMethod = null; }
          methods.push({ name: 'switchToManualTab', params: ['context'], steps: [`const newPage = context.pages()[context.pages().length - 1];`, `await newPage.waitForLoadState();`, `return newPage;`], isAssertion: true });
        }
        continue;
      }

      const varName = getLocatorVar(act.locatorCode, act.tagName, act.text);
      if (act.type === 'action') {
        const nextAct = filteredActions[i + 1];
        
        // ✅ FIX: Merge the click and auto-tab into one POM method
        if (nextAct && nextAct.type === 'new_tab' && nextAct.isAuto && act.actionType === 'click') {
          if (currentMethod) { methods.push(currentMethod); currentMethod = null; }
          const methodName = `click${varName.charAt(0).toUpperCase() + varName.slice(1)}AndSwitchTab`;
          methods.push({ 
            name: methodName, 
            params: ['context'], 
            steps: [
              `const [newPage] = await Promise.all([`,
              `  context.waitForEvent('page'),`,
              `  this.${varName}.click()`,
              `]);`,
              `await newPage.waitForLoadState();`,
              `return newPage;`
            ] 
          });
          i++; // skip the new_tab action
          continue;
        }

        if (!currentMethod) {
          let methodName = 'performAction';
          if (act.actionType === 'click') methodName = `click${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
          else if (varName.toLowerCase().includes('password') || varName.toLowerCase().includes('username')) methodName = 'login';
          else if (varName.toLowerCase().includes('search')) methodName = 'search';
          else methodName = `fill${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
          currentMethod = { name: methodName, params: [], steps: [] };
        }
        if (act.actionType === 'fill') {
          const paramName = varName.replace(/Input$/, '') || 'value';
          if (!currentMethod.params.includes(paramName)) currentMethod.params.push(paramName);
          currentMethod.steps.push(`await this.${varName}.fill(${paramName});`);
        } else if (act.actionType === 'click') {
          currentMethod.steps.push(`await this.${varName}.click();`);
          methods.push(currentMethod); currentMethod = null;
        } else if (act.actionType === 'hover') currentMethod.steps.push(`await this.${varName}.hover();`);
        else if (act.actionType === 'press') currentMethod.steps.push(`await this.${varName}.press('${act.value}');`);
      } else {
        if (currentMethod) { methods.push(currentMethod); currentMethod = null; }
        let assertionCode = '';
        if (act.actionType === 'assert_visible') assertionCode = `await expect(pom.${varName}).toBeVisible();`;
        if (act.actionType === 'assert_enabled') assertionCode = `await expect(pom.${varName}).toBeEnabled();`;
        if (act.actionType === 'assert_text') assertionCode = `await expect(pom.${varName}).toHaveText('${act.text?.replace(/'/g, "\\'")}');`;
        if (act.actionType === 'assert_value') assertionCode = `await expect(pom.${varName}).toHaveValue('${act.value?.replace(/'/g, "\\'")}');`;
        methods.push({ name: 'assertion_' + i, params: [], steps: [assertionCode], isAssertion: true });
      }
    }
    if (currentMethod) methods.push(currentMethod);

    let pageCode = `import { expect } from '@playwright/test';\n\nexport class RecordedPage {\n  /**\n   * @param {import('@playwright/test').Page} page\n   */\n  constructor(page) {\n    this.page = page;\n`;
    locatorMap.forEach((varName, locatorCode) => { pageCode += `    this.${varName} = page.${locatorCode};\n`; });
    pageCode += `  }\n\n  async navigate() {\n    await this.page.goto('${currentTabUrl || '/'}');\n  }\n\n`;
    methods.forEach(m => {
      if (m.isAssertion) return;
      const paramsStr = m.params.join(', ');
      pageCode += `  async ${m.name}(${paramsStr}) {\n`;
      m.steps.forEach(step => { pageCode += `    ${step}\n`; });
      pageCode += `  }\n\n`;
    });
    pageCode += `}\n`;
    generatedFiles.page_object = pageCode;

    let pomTestCode = `import { test, expect } from '@playwright/test';\nimport { RecordedPage } from './RecordedPage';\n`;
    if (isFaker) pomTestCode += `import { testData } from './faker_data';\n`;
    pomTestCode += `\n`;
    if (isAuth) pomTestCode += `test.use({ storageState: 'auth.json' });\n\n`;
    pomTestCode += `test('Recorded Flow${tagString}', async ({ context, page }) => {\n  let pom = new RecordedPage(page);\n  await pom.navigate();\n\n`;
    
    let pomTabCounter = 2;
    methods.forEach(m => {
      if (m.name === 'switchToManualTab') {
        pomTestCode += `  const page${pomTabCounter} = await pom.switchToManualTab(context);\n  pom = new RecordedPage(page${pomTabCounter});\n`;
        pomTabCounter++;
        return;
      }
      if (m.name.endsWith('AndSwitchTab')) {
        pomTestCode += `  const page${pomTabCounter} = await pom.${m.name}(context);\n  pom = new RecordedPage(page${pomTabCounter});\n`;
        pomTabCounter++;
        return;
      }
      if (m.isAssertion) pomTestCode += `  ${m.steps[0]}\n`;
      else {
        let args = m.params.map(p => `'PLACEHOLDER_${p.toUpperCase()}'`).join(', ');
        if (isFaker && m.params.length > 0) args = m.params.map(p => `testData.${p}`).join(', ');
        pomTestCode += `  await pom.${m.name}(${args});\n`;
      }
    });
    pomTestCode += `});\n`;
    generatedFiles.pom_test = pomTestCode;
    
    mainCodeBox.value = generatedFiles[fileSelector.value] || '';
  } catch (e) { console.error('Code generation failed', e); }
}

copyMainBtn.addEventListener('click', () => void copyToClipboard(mainCodeBox.value, copyMainBtn));

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === 'PICK_RESULT') {
    resultsSection.style.display = 'block';
    renderLocators(message.locators);
  } else if (message.type === 'PICK_CANCELLED') {
    isPickingMode = false; pickBtn.textContent = '🎯 Pick Element'; pickBtn.style.background = 'var(--accent)';
  } else if (message.type === 'ACTION_RECORDED') {
    recordedActions.push(message.action); generateCode();
  } else if (message.type === 'ASSERTION_TARGET_PICKED') {
    pendingAssertionTarget = message; assertionModal.style.display = 'block';
    assertTextBtn.style.display = message.text ? 'block' : 'none';
    assertValueBtn.style.display = message.value ? 'block' : 'none';
  } else if (message.type === 'NEW_TAB_OPENED') {
    recordedActions.push({ type: 'new_tab', actionType: 'click', locatorCode: '', tagName: '', isAuto: true });
    generateCode();
  }
});