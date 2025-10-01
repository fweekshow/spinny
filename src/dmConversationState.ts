/**
 * DM Conversation State Management
 * Handles multi-step conversation flow for group creation in DMs
 */

export enum DMConversationStep {
  IDLE = "idle",
  ASKED_CREATE_GROUP = "asked_create_group",
  WAITING_FOR_GROUP_NAME = "waiting_for_group_name",
  ASKED_ADD_USERS = "asked_add_users",
  WAITING_FOR_USERNAMES = "waiting_for_usernames"
}

export interface DMConversationState {
  step: DMConversationStep;
  groupName?: string;
  groupId?: string;
  timestamp: Date;
}

// Store conversation states per user
const dmStates = new Map<string, DMConversationState>();

export function getDMState(senderInboxId: string): DMConversationState {
  return dmStates.get(senderInboxId) || {
    step: DMConversationStep.IDLE,
    timestamp: new Date()
  };
}

export function setDMState(senderInboxId: string, state: DMConversationState): void {
  dmStates.set(senderInboxId, {
    ...state,
    timestamp: new Date()
  });
}

export function clearDMState(senderInboxId: string): void {
  dmStates.delete(senderInboxId);
}

export function resetToIdle(senderInboxId: string): void {
  dmStates.set(senderInboxId, {
    step: DMConversationStep.IDLE,
    timestamp: new Date()
  });
}

// Clean up old conversation states (older than 1 hour)
export function cleanupOldDMStates(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [senderInboxId, state] of dmStates.entries()) {
    if (state.timestamp < oneHourAgo) {
      dmStates.delete(senderInboxId);
    }
  }
}

