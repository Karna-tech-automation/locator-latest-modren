import type { SupportedLanguage, GeneratedLocator, ElementData, RecordedAction } from './types';

export const MESSAGE_SOURCE = {
  CONTENT: 'locator-healer:content',
  INJECT: 'locator-healer:inject',
} as const;

export type MessageSource = (typeof MESSAGE_SOURCE)[keyof typeof MESSAGE_SOURCE];

export type RuntimeMessage =
  | { type: 'START_PICK'; tabId: number; language: SupportedLanguage; testIdAttribute: string }
  | { type: 'STOP_PICK'; tabId: number }
  | { type: 'PICK_RESULT'; locators: GeneratedLocator[]; elementData: ElementData }
  | { type: 'PICK_CANCELLED' }
  | { type: 'PICK_ERROR'; message: string }
  | { type: 'START_RECORDING'; tabId: number; testIdAttribute: string; language: SupportedLanguage }
  | { type: 'STOP_RECORDING'; tabId: number }
  | { type: 'TOGGLE_ASSERTION_MODE'; tabId: number; isAssertionMode: boolean }
  | { type: 'ACTION_RECORDED'; action: RecordedAction }
  | { type: 'ASSERTION_TARGET_PICKED'; locatorCode: string; tagName: string; text: string; value: string }
  | { type: 'NEW_TAB_OPENED' };

export type TabMessage =
  | { type: 'START_PICK'; language: SupportedLanguage; testIdAttribute: string }
  | { type: 'STOP_PICK' }
  | { type: 'START_RECORDING'; testIdAttribute: string; language: SupportedLanguage }
  | { type: 'STOP_RECORDING' }
  | { type: 'TOGGLE_ASSERTION_MODE'; isAssertionMode: boolean };

export type ContentToInjectMessage =
  | { source: typeof MESSAGE_SOURCE.CONTENT; type: 'GENERATE_LOCATOR'; targetId: string; language: SupportedLanguage; testIdAttribute: string }
  | { source: typeof MESSAGE_SOURCE.CONTENT; type: 'START_RECORDING'; testIdAttribute: string; language: SupportedLanguage }
  | { source: typeof MESSAGE_SOURCE.CONTENT; type: 'STOP_RECORDING' }
  | { source: typeof MESSAGE_SOURCE.CONTENT; type: 'TOGGLE_ASSERTION_MODE'; isAssertionMode: boolean };

export type InjectToContentMessage =
  | { source: typeof MESSAGE_SOURCE.INJECT; type: 'LOCATOR_RESULT'; locators: GeneratedLocator[]; elementData: ElementData }
  | { source: typeof MESSAGE_SOURCE.INJECT; type: 'LOCATOR_ERROR'; message: string }
  | { source: typeof MESSAGE_SOURCE.INJECT; type: 'ACTION_RECORDED'; action: RecordedAction }
  | { source: typeof MESSAGE_SOURCE.INJECT; type: 'ASSERTION_TARGET_PICKED'; locatorCode: string; tagName: string; text: string; value: string };

export type WindowMessage = ContentToInjectMessage | InjectToContentMessage;

export function isInjectMessage(value: unknown): value is InjectToContentMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { source?: unknown; type?: unknown };
  return v.source === MESSAGE_SOURCE.INJECT;
}