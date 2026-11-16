export type SupportedLanguage = 'javascript' | 'python' | 'java' | 'csharp';

export type LocatorDescriptor =
  | { kind: 'role'; role: string; name: string; exact?: boolean }
  | { kind: 'label'; value: string; exact?: boolean }
  | { kind: 'placeholder'; value: string; exact?: boolean }
  | { kind: 'text'; value: string; exact?: boolean }
  | { kind: 'altText'; value: string; exact?: boolean }
  | { kind: 'title'; value: string; exact?: boolean }
  | { kind: 'testId'; value: string }
  | { kind: 'css'; value: string }
  | { kind: 'xpath'; value: string };

export interface ElementData {
  text: string;
  value: string;
  tagName: string;
  isVisible: boolean;
}

export interface GeneratedLocator {
  code: string;
  isUnique: boolean;
  matchCount: number;
  isRecommended: boolean;
  isBrittle?: boolean;
}

export interface RecordedAction {
  type: 'action' | 'assertion' | 'new_tab';
  actionType: 'click' | 'fill' | 'select' | 'hover' | 'press' | 'assert_visible' | 'assert_enabled' | 'assert_text' | 'assert_value';
  locatorCode: string;
  value?: string;
  isDateField?: boolean;
  tagName: string;
  text?: string;
  isIframe?: boolean;
  isAuto?: boolean; // ✅ Distinguishes auto tabs (links) from manual tabs (+ Tab button)
}