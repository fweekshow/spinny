import type { Client, DecodedMessage, Conversation } from "@xmtp/node-sdk";
import { ContentTypeActions, type ActionsContent } from "../../../xmtp-inline-actions/types/ActionsContent.js";
import { resolveUsernamesToAddresses, getUsersByAddresses } from "../../helpers/neynarService.js";
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

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
 * Triggered by: "@grouper create GroupName" or "@grouper sidebar GroupName"
 */
export async function handleSidebarRequest(
  groupName: string,
  originalMessage: DecodedMessage,
  client: Client,
  originalConversation: Conversation
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
    await sidebarGroup.send(`Welcome to "${groupName}"!\n\nThis is a sidebar conversation from the main group. You are now a group admin and can manage this space for focused discussions.`);

    // Step 6: Pause briefly to ensure group is properly set up
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Send invitation quick actions to the group
    const invitationActions: ActionsContent = {
      id: `sidebar_invite_${sidebarGroup.id}`,
      description: `"${groupName}" sidebar group created! Would you like to join this focused discussion?`,
      actions: [
        {
          id: `grouper_join_sidebar_${sidebarGroup.id}`,
          label: "Yes, Join",
          style: "primary"
        },
        {
          id: `grouper_decline_sidebar_${sidebarGroup.id}`,
          label: "No Thanks",
          style: "secondary"
        }
      ]
    };

    await (originalConversation as any).send(invitationActions, ContentTypeActions);
    console.log(`📤 Sent sidebar group invitation to group conversation`);

    return ""; // Return empty string - quick actions were sent

  } catch (error: any) {
    console.error("❌ Error creating sidebar group:", error);
    return `❌ Failed to create sidebar group "${groupName}". Please try again later.\n\nError: ${error.message}`;
  }
}

/**
 * Create a sidebar group in DM context - returns the group ID
 * This is used for the DM conversation flow
 */
export async function createSidebarGroupInDM(
  groupName: string,
  creatorInboxId: string
): Promise<{ groupId: string; groupName: string } | null> {
  try {
    if (!sidebarClient) {
      console.error("❌ Sidebar group system not initialized");
      return null;
    }

    console.log(`🎯 Creating sidebar group "${groupName}" in DM for ${creatorInboxId}`);

    // Create XMTP group with creator and agent as initial members
    const sidebarGroup = await sidebarClient!.conversations.newGroup([creatorInboxId]);
    
    console.log(`✅ Created sidebar group: ${sidebarGroup.id}`);

    // Set the group name
    try {
      await (sidebarGroup as any).updateName(groupName);
      console.log(`✅ Set sidebar group name: "${groupName}"`);
    } catch (nameError: any) {
      console.log(`⚠️ Could not set group name: ${nameError.message}`);
    }

    // Store sidebar group metadata
    const sidebarGroupData: SidebarGroup = {
      id: sidebarGroup.id,
      name: groupName,
      originalGroupId: "dm_created",
      createdBy: creatorInboxId,
      createdAt: new Date(),
      members: [creatorInboxId]
    };
    
    sidebarGroups.set(sidebarGroup.id, sidebarGroupData);

    // Make the creator a super admin
    try {
      await (sidebarGroup as any).addSuperAdmin(creatorInboxId);
      console.log(`✅ Made ${creatorInboxId} a super admin`);
    } catch (adminError: any) {
      console.log(`⚠️ Could not make creator admin: ${adminError.message}`);
    }

    // Send welcome message
    await sidebarGroup.send(`Welcome to "${groupName}"!\n\nYou created this group via DM. You're now a group admin and can manage this space for focused discussions.`);

    return {
      groupId: sidebarGroup.id,
      groupName: groupName
    };

  } catch (error: any) {
    console.error("❌ Error creating sidebar group in DM:", error);
    return null;
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
        return `You're already in "${sidebarGroupData.name}"! Check your group conversations to find it.`;
      } else if (addError.message?.includes('Failed to verify all installations') || addError.code === 'GenericFailure') {
        console.log(`⚠️ Installation verification failed for sidebar group - temporary XMTP network issue`);
        return `There's a temporary network issue preventing group access right now. 

Please try joining "${sidebarGroupData.name}" again in a few minutes, or contact support if the issue persists.

The sidebar group is available and you can try again later!`;
      } else {
        console.log(`❌ Unknown error for sidebar group:`, addError);
        return `Failed to add you to "${sidebarGroupData.name}". Error: ${addError.message || 'Unknown error'}. Please contact support.`;
      }
    }
    
    // Update our records
    sidebarGroupData.members.push(userInboxId);
    sidebarGroups.set(groupId, sidebarGroupData);

    // Send welcome message with username resolution (async, don't wait)
    resolveAndSendWelcomeMessage(sidebarGroup, sidebarGroupData.name, userInboxId);

    return `Great! You're now in "${sidebarGroupData.name}" sidebar group.

You'll receive messages and can participate in this focused discussion! Check your group conversations for the new sidebar.`;

  } catch (error: any) {
    console.error("❌ Error joining sidebar group:", error);
    return `Failed to join sidebar group. Please contact support or try again later.`;
  }
}

/**
 * Resolve username and send welcome message asynchronously
 */
async function resolveAndSendWelcomeMessage(
  sidebarGroup: any,
  groupName: string,
  userInboxId: string
): Promise<void> {
  try {
    console.log(`🔍 Attempting to resolve Basename for inbox ID: ${userInboxId}`);
    
    // Get user's wallet address from XMTP
    const inboxState = await sidebarClient!.preferences.inboxStateFromInboxIds([userInboxId]);
    const walletAddress = inboxState[0]?.identifiers?.[0]?.identifier;
    
    let displayName = userInboxId;
    
    if (walletAddress) {
      console.log(`💰 Found wallet address: ${walletAddress}`);
      
      try {
        // Use OnchainKit to resolve wallet address to Basename
        const basename = await getName({ address: walletAddress as `0x${string}`, chain: base });
        
        if (basename && basename !== walletAddress) {
          displayName = `@${basename}`;
          console.log(`✅ Resolved to Basename: ${displayName}`);
        } else {
          console.log(`⚠️ No Basename found for wallet: ${walletAddress}`);
          // Try Farcaster as fallback
          const userMap = await getUsersByAddresses([walletAddress]);
          const user = userMap.get(walletAddress);
          
          if (user && user.username) {
            displayName = `@${user.username}`;
            console.log(`✅ Resolved to Farcaster username: ${displayName}`);
          } else {
            console.log(`⚠️ No Farcaster username found either`);
            displayName = `user_${userInboxId.slice(0, 8)}`;
          }
        }
      } catch (resolveError) {
        console.log(`⚠️ Error resolving Basename:`, resolveError);
        displayName = `user_${userInboxId.slice(0, 8)}`;
      }
    } else {
      console.log(`⚠️ No wallet address found for inbox ID: ${userInboxId}`);
      displayName = `user_${userInboxId.slice(0, 8)}`;
    }

    // Send welcome message with resolved username
    await sidebarGroup.send(`${displayName} joined the "${groupName}" sidebar discussion!`);
    console.log(`📤 Sent welcome message for ${displayName} in ${groupName}`);
    
  } catch (error) {
    console.log(`⚠️ Error resolving username, using fallback:`, error);
    // Send fallback message with shortened inbox ID
    const fallbackName = `user_${userInboxId.slice(0, 8)}`;
    await sidebarGroup.send(`${fallbackName} joined the "${groupName}" sidebar discussion!`);
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
      return `❌ No usernames found in your message. Please mention users like @username`;
    }

    // Resolve Farcaster usernames to wallet addresses using Neynar
    console.log(`🔍 Resolving ${mentions.length} Farcaster usernames to wallet addresses...`);
    
    const usernameToAddress = await resolveUsernamesToAddresses(mentions);
    
    const validAddresses: string[] = [];
    const failedUsernames: string[] = [];
    
    for (const [username, address] of usernameToAddress.entries()) {
      if (address) {
        validAddresses.push(address);
        console.log(`✅ Resolved ${username} -> ${address}`);
      } else {
        failedUsernames.push(username);
        console.log(`❌ Failed to resolve ${username}`);
      }
    }

    if (validAddresses.length === 0) {
      return `❌ Could not resolve any Farcaster usernames. Failed: ${failedUsernames.join(', ')}\n\nPlease make sure these are valid Farcaster usernames.`;
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

    // Add each resolved user (by wallet address)
    console.log(`🚀 Adding ${validAddresses.length} users to sidebar group`);
    for (const userAddress of validAddresses) {
      try {
        console.log(`\n🔍 === ADDING USER: ${userAddress} ===`);
        console.log(`📊 User details:`);
        console.log(`   - Wallet Address: ${userAddress}`);
        console.log(`   - Address type: ${typeof userAddress}`);
        console.log(`   - Address length: ${userAddress?.length || 'undefined'}`);
        
        console.log(`🚀 Calling addMembers with: [${userAddress}]`);
        await (sidebarGroup as any).addMembers([userAddress]);
        
        addedUsers.push(userAddress);
        sidebarGroupData.members.push(userAddress);
        console.log(`✅ Successfully added ${userAddress} to sidebar group`);
        console.log(`📊 Updated group members:`, sidebarGroupData.members);
        
      } catch (addError: any) {
        console.log(`❌ Error adding ${userAddress} to sidebar group: ${addError.message}`);
        console.log(`📋 Add error details:`, {
          message: addError.message,
          code: addError.code,
          stack: addError.stack
        });
        
        // Provide more helpful error messages
        if (addError.message?.includes('already') || addError.message?.includes('duplicate')) {
          console.log(`ℹ️ User ${userAddress} was already in sidebar group`);
          // Don't count as failed if they're already in the group
          continue;
        } else if (addError.message?.includes('Failed to verify all installations') || addError.code === 'GenericFailure') {
          console.log(`⚠️ Installation verification failed for ${userAddress} - temporary XMTP network issue`);
          failedUsers.push(userAddress);
        } else {
          console.log(`❌ Unknown error for ${userAddress}:`, addError);
          failedUsers.push(userAddress);
        }
      }
    }

    // Update our records
    sidebarGroups.set(groupId, sidebarGroupData);

    // Send notification to the group
    if (addedUsers.length > 0) {
      await sidebarGroup.send(`🎉 Added ${addedUsers.length} new member(s) to "${sidebarGroupData.name}": ${addedUsers.join(', ')}`);
    }

    // Build response message
    let response = `✅ Added ${addedUsers.length} member(s) to "${sidebarGroupData.name}"`;
    
    if (addedUsers.length > 0) {
      response += `\n\nAdded: ${addedUsers.join(', ')}`;
    }
    
    if (failedUsers.length > 0) {
      response += `\n\nFailed to add: ${failedUsers.join(', ')}`;
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
 * Parse grouper command from message content
 * Supports: "@grouper create GroupName", "@grouper make GroupName", "@grouper new GroupName", "@grouper sidebar GroupName"
 * Also supports: "@grouper.base.eth create GroupName"
 * Also supports cleaned content: "create GroupName", "make GroupName", "new GroupName", "sidebar GroupName"
 */
export function parseSidebarCommand(content: string): string | null {
  if (!content || typeof content !== 'string') return null;
  
  // Try @grouper create/make/new/sidebar patterns
  let grouperMatch = content.match(/@grouper\s+(?:create|make|new|sidebar)\s+(.+)/i);
  if (grouperMatch) {
    return grouperMatch[1].trim();
  }
  
  // Try @grouper.base.eth patterns
  grouperMatch = content.match(/@grouper\.base\.eth\s+(?:create|make|new|sidebar)\s+(.+)/i);
  if (grouperMatch) {
    return grouperMatch[1].trim();
  }
  
  // Try cleaned content patterns (without @grouper prefix) - for groups
  grouperMatch = content.match(/^(?:create|make|new|sidebar)\s+(.+)/i);
  if (grouperMatch) {
    return grouperMatch[1].trim();
  }
  
  // Try direct DM patterns - just "create" or "sidebar" at start
  grouperMatch = content.match(/^(?:create|sidebar)\s+(.+)/i);
  if (grouperMatch) {
    return grouperMatch[1].trim();
  }
  
  return null;
}

// Private group functions removed - DM handles all conversational flows now

/**
 * Check if message is a sidebar creation request
 */
export function isSidebarRequest(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  const normalizedContent = content.toLowerCase().trim();
  
  // Check for @grouper create/make/new/sidebar patterns (original content)
  const originalPatterns = [
    /@grouper\s+(create|make|new|sidebar)\s+.+/i,
    /@grouper\.base\.eth\s+(create|make|new|sidebar)\s+.+/i
  ];
  
  // Check for cleaned content patterns (after mention removal)
  const cleanedPatterns = [
    /^(create|make|new|sidebar)\s+.+/i
  ];
  
  const allPatterns = [...originalPatterns, ...cleanedPatterns];
  
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
  createSidebarGroupInDM,
  joinSidebarGroup,
  declineSidebarGroup,
  addUsersToSidebarGroup,
  parseMentions,
  parseSidebarCommand,
  isSidebarRequest,
  getSidebarGroupInfo,
  getSidebarGroupById,
  listSidebarGroups,
  cleanupExpiredInvitations,
  setSidebarClient
};
