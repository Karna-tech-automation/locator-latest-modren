import { generateLocators } from 'dom-to-locator';
import {
  MESSAGE_SOURCE,
  type ContentToInjectMessage,
  type WindowMessage,
} from '../shared/messages';
import type { GeneratedLocator, RecordedAction } from '../shared/types';

declare global {
  interface Window {
    __locatorHealerInjected__?: boolean;
  }
}

let isRecording = sessionStorage.getItem('locatorHealerRecording') === 'true';
let isAssertionMode = false;
let currentLang = 'javascript';
let currentTestId = 'data-testid';
let hoverTimeout: any = null;

if (!window.__locatorHealerInjected__) {
  window.__locatorHealerInjected__ = true;
  setupListener();
}

/* ─────────────────────────── Visual Feedback ─────────────────────────── */
function flashElement(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    pointer-events: none;
    background: rgba(0, 255, 0, 0.2);
    border: 2px solid #00ff00;
    border-radius: 4px;
    z-index: 2147483647;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    transition: opacity 0.4s ease;
    opacity: 1;
  `;
  document.documentElement.appendChild(flash);
  
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 400);
  }, 100);
}

/* ─────────────────────────── Locator Engine ─────────────────────────── */

function getScore(code: string): number {
  if (code.includes('getByRole') && code.includes('name:')) return 100;
  if (code.includes('getByText') || code.includes('getByLabel') || code.includes('getByPlaceholder')) return 90;
  if (code.includes('getByTestId')) return 85;
  if (code.includes('css=')) return 50;
  if (code.includes('xpath=')) return 40;
  return 0;
}

function isTooGeneric(code: string): boolean {
  if (code.includes(':has-text("")')) return true; 
  const match = code.match(/locator\(['"](.+?)['"]\)/);
  if (!match || !match[1]) return false;
  const val = match[1].replace('css=', '').trim();
  const genericTags = ['div', 'span', 'a', 'input', 'button', 'form', 'body', 'html', 'ul', 'li', 'header', 'footer'];
  return genericTags.includes(val);
}

function getRelativeCSS(el: HTMLElement): string | null {
  if (el.id) return `#${el.id}`;
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('['));
    if (classes.length > 0) {
      const cls = `.${classes[0]}`;
      if (document.querySelectorAll(cls).length === 1) return cls;
    }
  }
  const tag = el.tagName.toLowerCase();
  const nameAttr = el.getAttribute('name');
  if (nameAttr && document.querySelectorAll(`${tag}[name="${nameAttr}"]`).length === 1) return `${tag}[name="${nameAttr}"]`;
  return null;
}

function getRelativeXPath(el: HTMLElement): string | null {
  if (el.id) return `//*[@id="${el.id}"]`;
  const text = el.textContent?.trim();
  if (text && text.length < 30 && document.evaluate(`//${el.tagName.toLowerCase()}[normalize-space()="${text}"]`, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength === 1) {
    return `//${el.tagName.toLowerCase()}[normalize-space()="${text}"]`;
  }
  return null;
}

function processElement(el: HTMLElement, testIdAttribute: string, language: string): GeneratedLocator[] {
  const rawLocators = generateLocators(el, { testIdAttributeName: testIdAttribute, language: language as any });
  const validCodes = (rawLocators as string[]).filter((code: string) => !isTooGeneric(code));
  
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && !validCodes.some(c => c.includes(ariaLabel))) {
    validCodes.push(`getByRole('${el.tagName.toLowerCase() === 'button' ? 'button' : 'link'}', { name: '${ariaLabel}' })`);
  }
  const title = el.getAttribute('title');
  if (title && !validCodes.some(c => c.includes(title))) {
    validCodes.push(`locator('[title="${title}"]')`);
  }

  const relativeCss = getRelativeCSS(el);
  if (relativeCss && !validCodes.includes(`locator('${relativeCss}')`)) validCodes.push(`locator('${relativeCss}')`);

  const relativeXpath = getRelativeXPath(el);
  if (relativeXpath && !validCodes.includes(`locator('xpath=${relativeXpath}')`)) validCodes.push(`locator('xpath=${relativeXpath}')`);

  const sortedCodes = validCodes.sort((a, b) => getScore(b) - getScore(a));

  return sortedCodes.map((code, index) => {
    let count = 1;
    let isBrittle = false;
    try {
      if (code.includes('getByRole')) count = code.includes('name:') ? 1 : document.querySelectorAll(el.tagName.toLowerCase()).length;
      else if (code.includes('locator(')) {
         const match = code.match(/locator\(['"](.+?)['"]\)/);
         if (match && match[1]) {
           let val = match[1];
           if (val.startsWith('xpath=')) count = document.evaluate(val.replace('xpath=', ''), document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength;
           else count = document.querySelectorAll(val).length;
           if (val.includes('nth-of-type') || val.startsWith('body >') || val.startsWith('/html')) isBrittle = true;
         }
      }
    } catch { count = 1; }
    return { code, isUnique: count === 1, matchCount: count, isRecommended: index === 0, isBrittle };
  }).filter(l => l.isRecommended || l.isUnique);
}

/* ─────────────────────────── Recorder Logic ─────────────────────────── */

function sendRecordedAction(target: HTMLElement, actionType: any, value = '', isDateField = false) {
  const locators = processElement(target, currentTestId, currentLang);
  if (locators.length === 0) return;

  flashElement(target); // ✅ Trigger the green flash

  const action: RecordedAction = {
    type: 'action',
    actionType,
    locatorCode: locators[0]!.code,
    value,
    isDateField,
    tagName: target.tagName.toLowerCase(),
    isIframe: window !== window.top
  };
  window.postMessage({ source: MESSAGE_SOURCE.INJECT, type: 'ACTION_RECORDED', action }, '*');
}

function handleActionEvent(e: Event) {
  if (!isRecording) return;
  const target = e.target as HTMLElement;
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return;

  if (isAssertionMode) {
    if (e.type === 'click') {
      e.preventDefault();
      e.stopPropagation();
      const locators = processElement(target, currentTestId, currentLang);
      if (locators.length > 0) {
        flashElement(target); // ✅ Flash on assertion
        window.postMessage({ 
          source: MESSAGE_SOURCE.INJECT, 
          type: 'ASSERTION_TARGET_PICKED', 
          locatorCode: locators[0]!.code,
          tagName: target.tagName.toLowerCase(),
          text: target.innerText?.trim() || '',
          value: (target as HTMLInputElement).value || ''
        }, '*');
      }
    }
    return; 
  }

  if (e.type === 'click') {
    clearTimeout(hoverTimeout);
    sendRecordedAction(target, 'click');
  } else if (e.type === 'change' || e.type === 'input') {
    if (target.tagName.toLowerCase() === 'input') {
      const type = (target as HTMLInputElement).type;
      sendRecordedAction(target, 'fill', (target as HTMLInputElement).value, type === 'date');
    } else if (target.tagName.toLowerCase() === 'select') {
      sendRecordedAction(target, 'select', (target as HTMLSelectElement).value);
    }
  }
}

function handleKeyEvent(e: KeyboardEvent) {
  if (!isRecording || isAssertionMode) return;
  if (e.key === 'Enter') {
    const target = document.activeElement as HTMLElement;
    if (target && target.tagName.toLowerCase() === 'input') {
      sendRecordedAction(target, 'press', 'Enter');
    }
  }
}

function handleHoverEvent(e: MouseEvent) {
  if (!isRecording || isAssertionMode) return;
  const target = e.target as HTMLElement;
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return;
  
  if (target.tagName.toLowerCase() === 'a' || target.tagName.toLowerCase() === 'button' || target.getAttribute('role') === 'menuitem') {
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      sendRecordedAction(target, 'hover');
    }, 500);
  }
}

function handleMouseOut() { clearTimeout(hoverTimeout); }

/* ─────────────────────────── Message Bridge ─────────────────────────── */

function setupListener(): void {
  window.addEventListener('message', (event: MessageEvent<WindowMessage>) => {
    if (event.source !== window) return;
    const data = event.data;
    if (typeof data !== 'object' || data === null) return;
    if ((data as ContentToInjectMessage).source !== MESSAGE_SOURCE.CONTENT) return;

    if (data.type === 'GENERATE_LOCATOR') {
      try {
        const el = document.querySelector(`[data-healer-target="${data.targetId}"]`) as HTMLElement;
        if (!el) throw new Error('Element not found');
        const finalLocators = processElement(el, data.testIdAttribute, data.language);
        const elementData = { text: el.innerText?.trim() || '', value: (el as HTMLInputElement).value || '', tagName: el.tagName.toLowerCase(), isVisible: el.offsetWidth > 0 };
        window.postMessage({ source: MESSAGE_SOURCE.INJECT, type: 'LOCATOR_RESULT', locators: finalLocators, elementData }, '*');
      } catch (err) {
        window.postMessage({ source: MESSAGE_SOURCE.INJECT, type: 'LOCATOR_ERROR', message: String(err) }, '*');
      }
    }

    if (data.type === 'START_RECORDING') {
      isRecording = true;
      sessionStorage.setItem('locatorHealerRecording', 'true');
      currentLang = data.language;
      currentTestId = data.testIdAttribute;
      document.addEventListener('click', handleActionEvent, true);
      document.addEventListener('change', handleActionEvent, true);
      document.addEventListener('keydown', handleKeyEvent, true);
      document.addEventListener('mouseover', handleHoverEvent, true);
      document.addEventListener('mouseout', handleMouseOut, true);
    }

    if (data.type === 'STOP_RECORDING') {
      isRecording = false;
      isAssertionMode = false;
      sessionStorage.removeItem('locatorHealerRecording');
      document.removeEventListener('click', handleActionEvent, true);
      document.removeEventListener('change', handleActionEvent, true);
      document.removeEventListener('keydown', handleKeyEvent, true);
      document.removeEventListener('mouseover', handleHoverEvent, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
    }

    if (data.type === 'TOGGLE_ASSERTION_MODE') {
      isAssertionMode = data.isAssertionMode;
    }
  });
}