import { MENTION_HANDLES } from "./config.js";

// Create regex for detecting mentions
const createMentionRegex = (): RegExp => {
  const mentionAlternatives = MENTION_HANDLES.split(",")
    .map((h) => h.trim())
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape special regex characters
    .join("|");
  // Updated regex to handle @spinny and @spinny.base.eth patterns
  return new RegExp(`(^|\\s)@(?:\\s+)?(?:${mentionAlternatives})(?:\\s|$)`, "i");
};

const mentionRegex = createMentionRegex();

// Check if a message mentions the agent
export const isMentioned = (text: string): boolean => mentionRegex.test(text);

// Remove mention from text content
export const removeMention = (text: string): string =>
  text.replace(mentionRegex, " ").trim();