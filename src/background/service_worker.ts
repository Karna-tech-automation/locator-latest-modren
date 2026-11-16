import type { RuntimeMessage, TabMessage } from '../shared/messages';

let isRecordingGlobally = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === 'START_RECORDING') {
    isRecordingGlobally = true;
    // Start recording on the current tab
    void chrome.tabs.sendMessage(message.tabId, { 
      type: 'START_RECORDING', testIdAttribute: message.testIdAttribute, language: message.language 
    } as TabMessage).catch(console.error);
  } 
  else if (message.type === 'STOP_RECORDING') {
    isRecordingGlobally = false;
    // 🛑 GLOBAL STOP: Tell ALL tabs to stop!
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) void chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' } as TabMessage).catch(() => {});
      });
    });
  } 
  else if (message.type === 'START_PICK') {
    void chrome.tabs.sendMessage(message.tabId, { type: 'START_PICK', language: message.language, testIdAttribute: message.testIdAttribute } as TabMessage).catch(console.error);
  } else if (message.type === 'STOP_PICK') {
    void chrome.tabs.sendMessage(message.tabId, { type: 'STOP_PICK' } as TabMessage).catch(console.error);
  } else if (message.type === 'TOGGLE_ASSERTION_MODE') {
    // Send to all active tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) void chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ASSERTION_MODE', isAssertionMode: message.isAssertionMode } as TabMessage).catch(() => {});
      });
    });
  }
  return false;
});

// 🚀 FIX 1: Detect when a new tab is opened and tell the panel to generate the waitForEvent code
chrome.tabs.onCreated.addListener((tab) => {
  if (isRecordingGlobally) {
    chrome.runtime.sendMessage({ type: 'NEW_TAB_OPENED' });
  }
});

// 🚀 FIX 2: Detect when ANY tab finishes loading (including navigating to Dashboard) and inject the recorder
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isRecordingGlobally && tab.url?.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: 'MAIN',
      files: ['inject.js']
    }).then(() => {
      chrome.tabs.sendMessage(tabId, { 
        type: 'START_RECORDING', 
        testIdAttribute: 'data-testid', 
        language: 'javascript' 
      } as TabMessage).catch(() => {});
    }).catch(console.error);
  }
});