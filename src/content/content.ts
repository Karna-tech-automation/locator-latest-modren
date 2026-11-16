import {
  MESSAGE_SOURCE,
  isInjectMessage,
  type ContentToInjectMessage,
  type RuntimeMessage,
  type TabMessage,
  type WindowMessage,
} from '../shared/messages';

let isPicking = false;
let isRecording = false;
let overlay: HTMLDivElement | null = null;
let currentLang: any = 'javascript';
let currentTestId = 'data-testid';

// ─── Finder Overlay ───
function startPicking(lang: string, testId: string) {
  currentLang = lang;
  currentTestId = testId;
  if (isPicking) return;
  isPicking = true;

  overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; pointer-events: none; background: rgba(0, 102, 204, 0.15);
    border: 2px solid #0066cc; z-index: 2147483647; transition: all 0.05s ease; display: none;
  `;
  document.documentElement.appendChild(overlay);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
}

function stopPicking() {
  isPicking = false;
  if (overlay) { overlay.remove(); overlay = null; }
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
}

function onMouseMove(e: MouseEvent) {
  if (!overlay) return;
  const target = e.target as HTMLElement;
  if (!target || target === overlay) return;
  const rect = target.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function onClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!isPicking) return;

  const target = e.target as HTMLElement;
  if (!target) return;
  const targetId = 'pick-' + Date.now();
  target.setAttribute('data-healer-target', targetId);

  const msg: ContentToInjectMessage = {
    source: MESSAGE_SOURCE.CONTENT,
    type: 'GENERATE_LOCATOR',
    targetId,
    language: currentLang,
    testIdAttribute: currentTestId,
  };
  window.postMessage(msg, '*');
  setTimeout(() => target.removeAttribute('data-healer-target'), 2000);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isPicking) {
    stopPicking();
    try { void chrome.runtime.sendMessage({ type: 'PICK_CANCELLED' } as RuntimeMessage); } catch(e) {}
  }
}

// ─── Message Bridges ───
window.addEventListener('message', (event: MessageEvent<WindowMessage>) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!isInjectMessage(data)) return;

  if (data.type === 'LOCATOR_RESULT') {
    try { void chrome.runtime.sendMessage({ type: 'PICK_RESULT', locators: data.locators, elementData: data.elementData } as RuntimeMessage); } catch(e) {}
  } else if (data.type === 'LOCATOR_ERROR') {
    try { void chrome.runtime.sendMessage({ type: 'PICK_ERROR', message: data.message } as RuntimeMessage); } catch(e) {}
  } else if (data.type === 'ACTION_RECORDED') {
    try { void chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action: data.action } as RuntimeMessage); } catch(e) {}
  } else if (data.type === 'ASSERTION_TARGET_PICKED') {
    try { void chrome.runtime.sendMessage({ type: 'ASSERTION_TARGET_PICKED', locatorCode: data.locatorCode, tagName: data.tagName, text: data.text, value: data.value } as RuntimeMessage); } catch(e) {}
  }
});

chrome.runtime.onMessage.addListener((message: TabMessage) => {
  if (message.type === 'START_PICK') {
    startPicking(message.language, message.testIdAttribute);
  } else if (message.type === 'STOP_PICK') {
    stopPicking();
  } else if (message.type === 'START_RECORDING') {
    isRecording = true;
    window.postMessage({ source: MESSAGE_SOURCE.CONTENT, type: 'START_RECORDING', testIdAttribute: message.testIdAttribute, language: message.language }, '*');
  } else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
    window.postMessage({ source: MESSAGE_SOURCE.CONTENT, type: 'STOP_RECORDING' }, '*');
  } else if (message.type === 'TOGGLE_ASSERTION_MODE') {
    window.postMessage({ source: MESSAGE_SOURCE.CONTENT, type: 'TOGGLE_ASSERTION_MODE', isAssertionMode: message.isAssertionMode }, '*');
  }
  return false;
});