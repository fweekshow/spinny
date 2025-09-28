import type { Client, DecodedMessage, Conversation } from "@xmtp/node-sdk";
import { ContentTypeActions, type ActionsContent } from "../../../xmtp-inline-actions/types/ActionsContent.js";
import { resolveUsernamesToInboxIds } from "../../helpers/usernameResolver.js";

interface SidebarGroup {
  id: string;
  name: string;
  originalGroupId: string;
  createdBy: string;
  createdAt: Date;
  members: string[];
}

// In-memory storage for sidebar groups (replace with database in production)
const sidebarGroups = new Map<string, SidebarGroup>();
const pendingInvitations = new Map<string, { groupId: string; originalGroupId: string }>();

let sidebarClient: Client<any> | null = null;

export function setSidebarClient(client: Client<any>) {
  sidebarClient = client;
}

/**
 * Handle sidebar group creation request
 * Triggered by: "@thera sidebar this conversation GroupName" or "@thera sidebar GroupName"
 */
export async function handleSidebarRequest(
  groupName: string,
  originalMessage: DecodedMessage,
  client: Client,
  originalConversation: Conversation,
  isDM: boolean = false,
  isPrivateGroup: boolean = false
): Promise<string> {
  try {
    if (!sidebarClient) {
      return "❌ Sidebar group system not initialized. Please try again later.";
    }

    const requesterInboxId = originalMessage.senderInboxId;
    const originalGroupId = originalMessage.conversationId;

    console.log(`🎯 Creating sidebar group "${groupName}" requested by ${requesterInboxId}`);
    console.log(`📊 Requester details:`);
    console.log(`   - Inbox ID: ${requesterInboxId}`);
    console.log(`   - Original Group ID: ${originalGroupId}`);
    console.log(`   - Message ID: ${originalMessage.id}`);

    // Step 1: Create XMTP group with requester and agent as initial members
    console.log(`🚀 Step 1: Creating XMTP group with members: [${requesterInboxId}]`);
    const sidebarGroup = await sidebarClient!.conversations.newGroup([requesterInboxId]);
    
    console.log(`✅ Created sidebar group: ${sidebarGroup.id}`);
    console.log(`📊 Group details:`);
    console.log(`   - Group ID: ${sidebarGroup.id}`);
    console.log(`   - Group type: ${typeof sidebarGroup}`);
    console.log(`   - Group properties:`, Object.keys(sidebarGroup));

    // Step 2: Set the group name after creation
    try {
      const currentName = (sidebarGroup as any).name;
      if (!currentName || currentName !== groupName) {
        await (sidebarGroup as any).updateName(groupName);
        console.log(`✅ Set sidebar group name: "${groupName}"`);
      }
    } catch (nameError: any) {
      console.log(`⚠️ Could not set group name: ${nameError.message}`);
    }

    // Step 3: Store sidebar group metadata
    const sidebarGroupData: SidebarGroup = {
      id: sidebarGroup.id,
      name: groupName,
      originalGroupId: originalGroupId,
      createdBy: requesterInboxId,
      createdAt: new Date(),
      members: [requesterInboxId] // Agent is automatically included
    };
    
    sidebarGroups.set(sidebarGroup.id, sidebarGroupData);
    console.log(`💾 Stored sidebar group in memory: ${sidebarGroup.id} - "${groupName}"`);
    console.log(`📋 Total groups in memory: ${sidebarGroups.size}`);

    // Step 4: Make the requester a super admin of the group they created
    console.log(`🚀 Step 4: Making requester a super admin`);
    try {
      console.log(`🔍 Calling addSuperAdmin with: ${requesterInboxId}`);
      await (sidebarGroup as any).addSuperAdmin(requesterInboxId);
      console.log(`✅ Made ${requesterInboxId} a super admin of the sidebar group`);
    } catch (adminError: any) {
      console.log(`⚠️ Could not make requester admin: ${adminError.message}`);
      console.log(`📋 Admin error details:`, {
        message: adminError.message,
        code: adminError.code,
        stack: adminError.stack
      });
      // Continue anyway - the group still works, just without admin privileges
    }

    // Step 5: Send welcome message to the sidebar group
    await sidebarGroup.send(`🎯 Welcome to "${groupName}"!\n\nThis is a sidebar conversation from the main group. You are now a group admin and can manage this space for focused discussions.`);

    // Step 6: Pause briefly to ensure group is properly set up
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Handle DM vs Group differently
    if (isDM) {
             // For DMs, ask for additional users instead of showing join action
             const dmMessage = `✅ Created sidebar group "${groupName}"!

Is there anyone you would like me to add? You can mention them like:
@username1 @username2.eth @0x1234...

Just reply with the @mentions and I'll add those users to the group.`;
      
      await (originalConversation as any).send(dmMessage);
      console.log(`📤 Sent DM response asking for additional users`);
      
      return ""; // Don't send a separate confirmation message
    } else if (isPrivateGroup) {
             // For private groups in groups, explain how to add users
             const privateGroupMessage = `✅ Created private sidebar group "${groupName}"!

To add users to this private group, reply with @mentions like:
@spinny @username1 @username2.eth @0x1234...

Note: Use usernames, ENS domains, or wallet addresses.`;
      
      await (originalConversation as any).send(privateGroupMessage);
      console.log(`📤 Sent private group instructions to group conversation`);
      
      return ""; // Don't send a separate confirmation message
    } else {
      // For regular groups, send invitation quick actions
      const invitationActions: ActionsContent = {
        id: `sidebar_invite_${sidebarGroup.id}`,
        description: `🎯 "${groupName}" sidebar group created! Would you like to join this focused discussion?`,
        actions: [
          {
            id: `join_sidebar_${sidebarGroup.id}`,
            label: "✅ Yes, Join",
            style: "primary"
          },
          {
            id: `decline_sidebar_${sidebarGroup.id}`,
            label: "❌ No Thanks",
            style: "secondary"
          }
        ]
      };

      // Send invitation to original group conversation
      await (originalConversation as any).send(invitationActions, ContentTypeActions);
      console.log(`📤 Sent sidebar group invitation to original group conversation`);

      // Step 8: Return a simple confirmation (no additional message needed)
      return ""; // Don't send a separate confirmation message
    }

  } catch (error: any) {
    console.error("❌ Error creating sidebar group:", error);
    return `❌ Failed to create sidebar group "${groupName}". Please try again later.\n\nError: ${error.message}`;
  }
}

/**
 * Handle joining a sidebar group via quick actions
 */
export async function joinSidebarGroup(
  groupId: string,
  userInboxId: string
): Promise<string> {
  try {
    if (!sidebarClient) {
      return "❌ Sidebar group system not initialized. Please try again later.";
    }

    // Since we send invitations to the group conversation, we don't need to check
    // for individual invitations - anyone who sees the quick actions can join

    // Get sidebar group info
    const sidebarGroupData = sidebarGroups.get(groupId);
    if (!sidebarGroupData) {
      console.log(`❌ Sidebar group not found in memory storage. Group ID: ${groupId}`);
      console.log(`📋 Available groups:`, Array.from(sidebarGroups.keys()));
      return "❌ Sidebar group not found.";
    }

    console.log(`🎯 Adding user ${userInboxId} to sidebar group "${sidebarGroupData.name}"`);

    // Sync conversations to get latest state
    await sidebarClient!.conversations.sync();
    const allConversations = await sidebarClient!.conversations.list();
    
    // Find the group by exact ID (matching activityGroups pattern)
    const sidebarGroup = allConversations.find(conv => conv.id === groupId);
    
    if (!sidebarGroup) {
      console.log(`❌ Sidebar group (${groupId}) not found in agent's conversations`);
      return `❌ Could not find sidebar group. Please contact support.`;
    }

    console.log(`✅ Found sidebar group: ${sidebarGroup.id}`);
    console.log(`   Name: ${sidebarGroupData.name}`);

    // Add user to the group using the same pattern as activityGroups
    try {
      await (sidebarGroup as any).addMembers([userInboxId]);
      console.log(`✅ Successfully added user to sidebar group "${sidebarGroupData.name}"`);
    } catch (addError: any) {
      console.log(`❌ Error adding to sidebar group: ${addError.message}`);
      
      if (addError.message?.includes('already') || addError.message?.includes('duplicate')) {
        console.log(`ℹ️ User was already in sidebar group`);
        return `ℹ️ You're already in "${sidebarGroupData.name}"! Check your group conversations to find it.`;
      } else if (addError.message?.includes('Failed to verify all installations') || addError.code === 'GenericFailure') {
        console.log(`⚠️ Installation verification failed for sidebar group - temporary XMTP network issue`);
        return `⚠️ There's a temporary network issue preventing group access right now. 

Please try joining "${sidebarGroupData.name}" again in a few minutes, or contact support if the issue persists.

The sidebar group is available and you can try again later!`;
      } else {
        console.log(`❌ Unknown error for sidebar group:`, addError);
        return `❌ Failed to add you to "${sidebarGroupData.name}". Error: ${addError.message || 'Unknown error'}. Please contact support.`;
      }
    }
    
    // Update our records
    sidebarGroupData.members.push(userInboxId);
    sidebarGroups.set(groupId, sidebarGroupData);

    // Send a welcome message to help the user identify the group
    await sidebarGroup.send(`🎉 ${userInboxId} joined the "${sidebarGroupData.name}" sidebar discussion!`);

    return `✅ Great! You're now in "${sidebarGroupData.name}" sidebar group.

You'll receive messages and can participate in this focused discussion! Check your group conversations for the new sidebar.`;

  } catch (error: any) {
    console.error("❌ Error joining sidebar group:", error);
    return `❌ Failed to join sidebar group. Please contact support or try again later.`;
  }
}

/**
 * Handle declining a sidebar group invitation
 */
export async function declineSidebarGroup(
  groupId: string,
  userInboxId: string
): Promise<string> {
  try {
    const sidebarGroupData = sidebarGroups.get(groupId);
    const groupName = sidebarGroupData?.name || "sidebar group";

    console.log(`📝 ${userInboxId} declined to join sidebar group "${groupName}"`);

    return `✅ You've declined to join "${groupName}". No worries!`;

  } catch (error: any) {
    console.error("❌ Error declining sidebar group:", error);
    return "✅ Invitation declined.";
  }
}

/**
 * Handle adding users to a sidebar group from DM mentions
 */
export async function addUsersToSidebarGroup(
  groupId: string,
  mentions: string[],
  requesterInboxId: string
): Promise<string> {
  try {
    if (!sidebarClient) {
      return "❌ Sidebar group system not initialized. Please try again later.";
    }

    const sidebarGroupData = sidebarGroups.get(groupId);
    if (!sidebarGroupData) {
      return "❌ Sidebar group not found.";
    }

    // Verify the requester is the creator or has permission
    if (sidebarGroupData.createdBy !== requesterInboxId) {
      return "❌ Only the group creator can add members.";
    }

    console.log(`🎯 Adding users to sidebar group "${sidebarGroupData.name}": ${mentions.join(', ')}`);

    // Check if we have any mentions
    if (mentions.length === 0) {
      return `❌ No usernames found in your message. Please mention users like @username, @username.eth, or @0x1234...`;
    }

    // Resolve usernames to inbox IDs
    console.log(`🔍 Resolving usernames to inbox IDs...`);
    const usernameToInboxId = await resolveUsernamesToInboxIds(mentions, sidebarClient!);
    
    // Filter out failed resolutions
    const validInboxIds: string[] = [];
    const failedUsernames: string[] = [];
    
    for (const [username, inboxId] of usernameToInboxId.entries()) {
      if (inboxId) {
        validInboxIds.push(inboxId);
        console.log(`✅ Resolved ${username} -> ${inboxId}`);
      } else {
        failedUsernames.push(username);
        console.log(`❌ Failed to resolve ${username}`);
      }
    }

    if (validInboxIds.length === 0) {
      return `❌ Could not resolve any usernames to valid XMTP addresses. Failed usernames: ${failedUsernames.join(', ')}\n\nTry using:\n- ENS domains: @username.eth\n- Wallet addresses: @0x1234...\n- Make sure the user has XMTP enabled`;
    }

    // Sync conversations to get latest state
    await sidebarClient!.conversations.sync();
    const allConversations = await sidebarClient!.conversations.list();
    
    // Find the group by exact ID
    const sidebarGroup = allConversations.find(conv => conv.id === groupId);
    
    if (!sidebarGroup) {
      console.log(`❌ Sidebar group (${groupId}) not found in agent's conversations`);
      return `❌ Could not find sidebar group. Please contact support.`;
    }

    const addedUsers: string[] = [];
    const failedUsers: string[] = [];

    // Add each resolved user
    console.log(`🚀 Adding ${validInboxIds.length} users to sidebar group`);
    for (const userInboxId of validInboxIds) {
      try {
        console.log(`\n🔍 === ADDING USER: ${userInboxId} ===`);
        console.log(`📊 User details:`);
        console.log(`   - Inbox ID: ${userInboxId}`);
        console.log(`   - Inbox ID type: ${typeof userInboxId}`);
        console.log(`   - Inbox ID length: ${userInboxId?.length || 'undefined'}`);
        
        // First, try to find the user in the original group conversation
        // This helps with user discovery and validation
        console.log(`🔍 Looking for user ${userInboxId} in group context`);
        
        console.log(`🚀 Calling addMembers with: [${userInboxId}]`);
        await (sidebarGroup as any).addMembers([userInboxId]);
        
        addedUsers.push(userInboxId);
        sidebarGroupData.members.push(userInboxId);
        console.log(`✅ Successfully added ${userInboxId} to sidebar group`);
        console.log(`📊 Updated group members:`, sidebarGroupData.members);
        
      } catch (addError: any) {
        console.log(`❌ Error adding ${userInboxId} to sidebar group: ${addError.message}`);
        console.log(`📋 Add error details:`, {
          message: addError.message,
          code: addError.code,
          stack: addError.stack
        });
        
        // Provide more helpful error messages
        if (addError.message?.includes('already') || addError.message?.includes('duplicate')) {
          console.log(`ℹ️ User ${userInboxId} was already in sidebar group`);
          // Don't count as failed if they're already in the group
          continue;
        } else if (addError.message?.includes('Failed to verify all installations') || addError.code === 'GenericFailure') {
          console.log(`⚠️ Installation verification failed for ${userInboxId} - temporary XMTP network issue`);
          failedUsers.push(userInboxId);
        } else {
          console.log(`❌ Unknown error for ${userInboxId}:`, addError);
          failedUsers.push(userInboxId);
        }
      }
    }

    // Update our records
    sidebarGroups.set(groupId, sidebarGroupData);

    // Send notification to the group
    if (addedUsers.length > 0) {
      await sidebarGroup.send(`🎉 Added ${addedUsers.length} new member(s) to "${sidebarGroupData.name}": ${addedUsers.join(', ')}`);
    }

    // Get successfully resolved usernames for the response
    const successfulUsernames: string[] = [];
    for (const [username, inboxId] of usernameToInboxId.entries()) {
      if (inboxId && addedUsers.includes(inboxId)) {
        successfulUsernames.push(username);
      }
    }

    // Build response message
    let response = `✅ Added ${addedUsers.length} member(s) to "${sidebarGroupData.name}"`;
    
    if (successfulUsernames.length > 0) {
      response += `\n\nAdded: ${successfulUsernames.join(', ')}`;
    }
    
    if (failedUsernames.length > 0) {
      response += `\n\nFailed to resolve: ${failedUsernames.join(', ')}`;
      response += `\n\nTry using:\n- ENS domains: @username.eth\n- Wallet addresses: @0x1234...\n- Make sure the user has XMTP enabled`;
    }

    return response;

  } catch (error: any) {
    console.error("❌ Error adding users to sidebar group:", error);
    return `❌ Failed to add users to sidebar group. Please try again later.`;
  }
}

/**
 * Parse @mentions from a message content
 * Extracts usernames from @mentions (can be ENS domains, .eth domains, or addresses)
 */
export function parseMentions(content: string): string[] {
  if (!content || typeof content !== 'string') return [];
  
  // Match @mentions - looking for @ followed by alphanumeric characters, dots, and hyphens
  const mentionRegex = /@([a-zA-Z0-9.-]+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    const mention = match[1];
    // Accept any alphanumeric mention (usernames, ENS domains, etc.)
    // We'll resolve them to addresses later
    mentions.push(mention);
    console.log(`📝 Found mention: ${mention}`);
  }
  
  return mentions;
}

/**
 * Parse spinny command from message content
 * Supports: "@spinny create GroupName", "@spinny make GroupName", "@spinny new GroupName", "@spinny sidebar GroupName"
 * Also supports: "@hey spinny.base.eth create GroupName"
 * Also supports cleaned content: "create GroupName", "make GroupName", "new GroupName", "sidebar GroupName"
 * Also supports direct DM commands: "create GroupName", "sidebar GroupName"
 * Also supports private groups: "@spinny create private GroupName"
 */
export function parseSidebarCommand(content: string): string | null {
  if (!content || typeof content !== 'string') return null;
  
  // Try @spinny create/make/new/sidebar patterns
  let spinnyMatch = content.match(/@spinny\s+(?:create|make|new|sidebar)\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  // Try @spinny.base.eth patterns
  spinnyMatch = content.match(/@spinny\.base\.eth\s+(?:create|make|new|sidebar)\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  // Try cleaned content patterns (without @spinny prefix) - for groups
  spinnyMatch = content.match(/^(?:create|make|new|sidebar)\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  // Try direct DM patterns - just "create" or "sidebar" at start
  spinnyMatch = content.match(/^(?:create|sidebar)\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  return null;
}

/**
 * Check if a sidebar command is for a private group
 * Looks for "private" keyword in the command
 */
export function isPrivateGroupCommand(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  const normalizedContent = content.toLowerCase().trim();
  
  // Check for private keyword in various patterns
  const privatePatterns = [
    /@spinny\s+(?:create|make|new|sidebar)\s+private\s+/i,
    /@spinny\.base\.eth\s+(?:create|make|new|sidebar)\s+private\s+/i,
    /^(?:create|make|new|sidebar)\s+private\s+/i
  ];
  
  return privatePatterns.some(pattern => pattern.test(normalizedContent));
}

/**
 * Extract group name from private group command (removes "private" keyword)
 */
export function parsePrivateGroupCommand(content: string): string | null {
  if (!content || typeof content !== 'string') return null;
  
  // Try @spinny create/make/new/sidebar private patterns
  let spinnyMatch = content.match(/@spinny\s+(?:create|make|new|sidebar)\s+private\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  // Try @spinny.base.eth patterns
  spinnyMatch = content.match(/@spinny\.base\.eth\s+(?:create|make|new|sidebar)\s+private\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  // Try cleaned content patterns (without @spinny prefix) - for groups
  spinnyMatch = content.match(/^(?:create|make|new|sidebar)\s+private\s+(.+)/i);
  if (spinnyMatch) {
    return spinnyMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract group name and mentions from private group command with @mentions
 * Returns { groupName, mentions }
 */
export function parsePrivateGroupCommandWithMentions(content: string): { groupName: string; mentions: string[] } | null {
  if (!content || typeof content !== 'string') return null;
  
  // Try @spinny create/make/new/sidebar private patterns with @mentions
  let spinnyMatch = content.match(/@spinny\s+(?:create|make|new|sidebar)\s+private\s+(.+)/i);
  if (spinnyMatch) {
    const fullContent = spinnyMatch[1].trim();
    const mentions = parseMentions(fullContent);
    const groupName = fullContent.replace(/@\w+/g, '').trim();
    return { groupName, mentions };
  }
  
  // Try @spinny.base.eth patterns with @mentions
  spinnyMatch = content.match(/@spinny\.base\.eth\s+(?:create|make|new|sidebar)\s+private\s+(.+)/i);
  if (spinnyMatch) {
    const fullContent = spinnyMatch[1].trim();
    const mentions = parseMentions(fullContent);
    const groupName = fullContent.replace(/@\w+/g, '').trim();
    return { groupName, mentions };
  }
  
  // Try cleaned content patterns (without @spinny prefix) - for groups
  spinnyMatch = content.match(/^(?:create|make|new|sidebar)\s+private\s+(.+)/i);
  if (spinnyMatch) {
    const fullContent = spinnyMatch[1].trim();
    const mentions = parseMentions(fullContent);
    const groupName = fullContent.replace(/@\w+/g, '').trim();
    return { groupName, mentions };
  }
  
  return null;
}

/**
 * Check if message is a sidebar creation request
 */
export function isSidebarRequest(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  const normalizedContent = content.toLowerCase().trim();
  
  // Check for @spinny create/make/new/sidebar patterns (original content)
  const originalPatterns = [
    /@spinny\s+(create|make|new|sidebar)\s+.+/i,
    /@spinny\.base\.eth\s+(create|make|new|sidebar)\s+.+/i
  ];
  
  // Check for cleaned content patterns (after mention removal)
  const cleanedPatterns = [
    /^(create|make|new|sidebar)\s+.+/i
  ];
  
  // Check for direct DM patterns (just "create" or "sidebar" at start)
  const dmPatterns = [
    /^create\s+.+/i,
    /^sidebar\s+.+/i
  ];
  
  // Check for private group patterns
  const privatePatterns = [
    /@spinny\s+(create|make|new|sidebar)\s+private\s+.+/i,
    /@spinny\.base\.eth\s+(create|make|new|sidebar)\s+private\s+.+/i,
    /^(create|make|new|sidebar)\s+private\s+.+/i
  ];
  
  const allPatterns = [...originalPatterns, ...cleanedPatterns, ...dmPatterns, ...privatePatterns];
  
  return allPatterns.some(pattern => pattern.test(normalizedContent));
}

/**
 * Get sidebar group info
 */
export function getSidebarGroupInfo(groupId: string): SidebarGroup | undefined {
  return sidebarGroups.get(groupId);
}

/**
 * List all sidebar groups created by the agent
 */
export function listSidebarGroups(): SidebarGroup[] {
  return Array.from(sidebarGroups.values());
}

/**
 * Get sidebar group by ID with debugging info
 */
export function getSidebarGroupById(groupId: string): SidebarGroup | undefined {
  const group = sidebarGroups.get(groupId);
  if (!group) {
    console.log(`❌ Group not found: ${groupId}`);
    console.log(`📋 Available group IDs:`, Array.from(sidebarGroups.keys()));
  }
  return group;
}

/**
 * Clean up expired invitations (call periodically)
 */
export function cleanupExpiredInvitations(maxAgeHours: number = 24): void {
  const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
  
  for (const [key, invitation] of pendingInvitations.entries()) {
    const groupData = sidebarGroups.get(invitation.groupId);
    if (groupData && groupData.createdAt < cutoffTime) {
      pendingInvitations.delete(key);
    }
  }
  
  console.log(`🧹 Cleaned up expired sidebar group invitations`);
}

export default {
  handleSidebarRequest,
  joinSidebarGroup,
  declineSidebarGroup,
  addUsersToSidebarGroup,
  parseMentions,
  parseSidebarCommand,
  parsePrivateGroupCommand,
  parsePrivateGroupCommandWithMentions,
  isPrivateGroupCommand,
  isSidebarRequest,
  getSidebarGroupInfo,
  getSidebarGroupById,
  listSidebarGroups,
  cleanupExpiredInvitations,
  setSidebarClient
};
