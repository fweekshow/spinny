import { ethers } from "ethers";
import type { Client } from "@xmtp/node-sdk";
import { getInboxIdByUsername } from "../../store.js";

/**
 * Resolve a username/handle to a wallet address
 * Supports various handle types: usernames, ENS domains, wallet addresses, XMTP addresses
 */
export async function resolveUsername(username: string): Promise<string | null> {
  try {
    // Clean the username (remove @ prefix if present)
    const cleanUsername = username.replace(/^@/, '');

    // If it's already a valid Ethereum address, return it
    if (ethers.isAddress(cleanUsername)) {
      console.log(`✅ Valid Ethereum address: ${cleanUsername}`);
      return cleanUsername;
    }

    // If it's a hex string (XMTP address), return it
    if (cleanUsername.length >= 32 && /^[a-f0-9]+$/i.test(cleanUsername)) {
      console.log(`✅ Valid XMTP address: ${cleanUsername}`);
      return cleanUsername;
    }

    // Try to resolve as ENS domain
    if (cleanUsername.endsWith('.eth')) {
      console.log(`🔍 Attempting ENS resolution for: ${cleanUsername}`);
      try {
        // For now, we'll return null for ENS domains since you mentioned not using ENS
        // But we'll log it for debugging
        console.log(`⚠️ ENS resolution disabled for: ${cleanUsername}`);
        return null;
      } catch (ensError) {
        console.log(`❌ ENS resolution failed for ${cleanUsername}:`, ensError);
        return null;
      }
    }

    // For other usernames/handles, we need to implement resolution
    // This could be through various services like Lens, Farcaster, etc.
    console.log(`🔍 Attempting to resolve handle: ${cleanUsername}`);
    
    // For now, we'll try to use the handle directly as a potential address
    // In a real implementation, you'd integrate with handle resolution services
    console.log(`⚠️ Handle resolution not implemented for: ${cleanUsername}`);
    console.log(`💡 Supported formats: wallet addresses (0x...), XMTP addresses, ENS domains (.eth)`);
    
    return null;

  } catch (error) {
    console.error(`❌ Error resolving username "${username}":`, error);
    return null;
  }
}

/**
 * Resolve multiple usernames to wallet addresses
 * Returns a map of username -> address (or null if resolution failed)
 */
export async function resolveUsernames(usernames: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  // Resolve usernames in parallel
  const promises = usernames.map(async (username) => {
    const address = await resolveUsername(username);
    results.set(username, address);
  });

  await Promise.all(promises);
  
  return results;
}

/**
 * Get the XMTP inbox ID for a wallet address using XMTP client
 * Based on XMTP documentation: https://docs.xmtp.org/chat-apps/core-messaging/group-permissions
 */
export async function getInboxIdForAddress(address: string, client: Client): Promise<string | null> {
  try {
    console.log(`🔍 Getting inbox ID for address: ${address}`);
    
    // Use XMTP client to find inbox ID by identity
    // The identity should be the wallet address
    const inboxIds = await client.findInboxIdByIdentities([address]);
    
    if (inboxIds && inboxIds.length > 0) {
      const inboxId = inboxIds[0];
      console.log(`✅ Found inbox ID for ${address}: ${inboxId}`);
      return inboxId;
    } else {
      console.log(`❌ No inbox ID found for address: ${address}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error getting inbox ID for address "${address}":`, error);
    return null;
  }
}

/**
 * Resolve a handle/username to a wallet address using Base's resolution methods
 * This is the first step in the two-step process: Handle → Address → Inbox ID
 */
export async function resolveHandleToAddress(handle: string): Promise<string | null> {
  try {
    console.log(`🔍 Resolving handle to address: ${handle}`);
    
    // Clean the handle (remove @ prefix if present)
    const cleanHandle = handle.replace(/^@/, '');
    console.log(`🧹 Cleaned handle: ${cleanHandle}`);
    
    // Log the handle format for debugging
    console.log(`📊 Handle analysis:`);
    console.log(`   - Original: ${handle}`);
    console.log(`   - Cleaned: ${cleanHandle}`);
    console.log(`   - Length: ${cleanHandle.length}`);
    console.log(`   - Contains dots: ${cleanHandle.includes('.')}`);
    console.log(`   - Starts with 0x: ${cleanHandle.startsWith('0x')}`);
    console.log(`   - Is hex: ${/^[a-f0-9]+$/i.test(cleanHandle)}`);
    
    // If it's already a valid Ethereum address, return it
    if (ethers.isAddress(cleanHandle)) {
      console.log(`✅ Valid Ethereum address: ${cleanHandle}`);
      return cleanHandle;
    }
    
    // If it's a hex string (XMTP address), return it
    if (cleanHandle.length >= 32 && /^[a-f0-9]+$/i.test(cleanHandle)) {
      console.log(`✅ Valid XMTP address: ${cleanHandle}`);
      return cleanHandle;
    }
    
    // Try to resolve as Base name or ENS domain
    if (cleanHandle.endsWith('.base') || cleanHandle.endsWith('.eth')) {
      console.log(`🔍 Attempting Base/ENS resolution for: ${cleanHandle}`);
      // TODO: Implement Base name resolution using getEnsName and getAddress
      // For now, we'll return null and log what we need
      console.log(`⚠️ Base/ENS resolution not implemented yet for: ${cleanHandle}`);
      console.log(`💡 Need to implement using Base's getEnsName and getAddress methods`);
      return null;
    }
    
    // For other usernames/handles, we need to implement resolution
    console.log(`🔍 Attempting to resolve handle: ${cleanHandle}`);
    console.log(`⚠️ Handle resolution not implemented for: ${cleanHandle}`);
    console.log(`💡 Supported formats: wallet addresses (0x...), XMTP addresses, Base names (.base), ENS domains (.eth)`);
    
    return null;

  } catch (error) {
    console.error(`❌ Error resolving handle "${handle}":`, error);
    return null;
  }
}

/**
 * Get the XMTP inbox ID for a handle/username using database lookup first, then two-step resolution
 * Step 1: Check database for existing mapping
 * Step 2: If not found, try Handle → Wallet Address → Inbox ID resolution
 */
export async function getInboxIdForHandle(handle: string, client: Client): Promise<string | null> {
  try {
    console.log(`🔍 Getting inbox ID for handle: ${handle}`);
    
    // Step 1: Check database for existing mapping
    console.log(`🚀 Step 1: Checking database for existing mapping`);
    const existingInboxId = getInboxIdByUsername(handle);
    
    if (existingInboxId) {
      console.log(`✅ Found existing mapping in database: ${handle} → ${existingInboxId}`);
      return existingInboxId;
    }
    
    console.log(`❌ No existing mapping found in database for: ${handle}`);
    
    // Step 2: Try two-step resolution (Handle → Address → Inbox ID)
    console.log(`🚀 Step 2: Attempting two-step resolution`);
    const address = await resolveHandleToAddress(handle);
    
    if (!address) {
      console.log(`❌ Could not resolve handle to wallet address: ${handle}`);
      return null;
    }
    
    console.log(`✅ Resolved handle to address: ${handle} → ${address}`);
    
    // Step 3: Get inbox ID from wallet address
    console.log(`🚀 Step 3: Getting inbox ID from wallet address`);
    const inboxId = await getInboxIdForAddress(address, client);
    
    if (inboxId) {
      console.log(`✅ Got inbox ID for handle: ${handle} → ${address} → ${inboxId}`);
    } else {
      console.log(`❌ Could not get inbox ID for address: ${address}`);
    }
    
    return inboxId;
    
  } catch (error) {
    console.error(`❌ Error getting inbox ID for handle "${handle}":`, error);
    console.error(`📋 Error details:`, {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Resolve usernames to XMTP inbox IDs using two-step resolution
 * Step 1: Handle/Username → Wallet Address (using Base resolution)
 * Step 2: Wallet Address → Inbox ID (using XMTP client)
 * Based on XMTP documentation: https://docs.xmtp.org/chat-apps/core-messaging/group-permissions
 */
export async function resolveUsernamesToInboxIds(usernames: string[], client: Client): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  console.log(`🎯 Starting two-step resolution for ${usernames.length} usernames:`, usernames);
  
  // Resolve each username/handle using two-step process
  for (const username of usernames) {
    try {
      console.log(`\n🔍 === RESOLVING USERNAME: ${username} ===`);
      
      // Use the two-step resolution process
      const inboxId = await getInboxIdForHandle(username, client);
      
      if (inboxId) {
        results.set(username, inboxId);
        console.log(`✅ Two-step resolution successful for ${username}: ${inboxId}`);
        console.log(`📋 Final result: ${username} -> ${inboxId}`);
      } else {
        results.set(username, null);
        console.log(`❌ Two-step resolution failed for: ${username}`);
        console.log(`📋 Final result: ${username} -> null`);
      }
      
    } catch (error) {
      console.error(`❌ Error resolving username "${username}":`, error);
      results.set(username, null);
      console.log(`📋 Final result: ${username} -> null (error)`);
    }
  }
  
  console.log(`\n📊 === RESOLUTION SUMMARY ===`);
  for (const [username, inboxId] of results.entries()) {
    console.log(`   ${username} -> ${inboxId || 'null'}`);
  }
  
  return results;
}
