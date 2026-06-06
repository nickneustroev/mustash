import { messages as enMessages } from "./messages.en.js";
import { messages as ruMessages } from "./messages.ru.js";

export type Locale = "EN" | "RU";

type MessageValue = string | ((...args: unknown[]) => string);
type MessageMap = Record<string, MessageValue>;

let currentMessages: MessageMap = enMessages as unknown as MessageMap;

export function initLocale(locale: Locale): void {
  if (locale === "RU") {
    currentMessages = ruMessages as unknown as MessageMap;
  } else {
    currentMessages = enMessages as unknown as MessageMap;
  }
}

export function t(key: string, ...args: unknown[]): string {
  const msg = currentMessages[key];
  if (msg === undefined) {
    return key;
  }
  if (typeof msg === "function") {
    return msg(...args);
  }
  return msg;
}
