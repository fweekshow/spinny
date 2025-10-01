/**
 * Neynar API Service
 * Handles Farcaster username resolution using Neynar API
 * Documentation: https://docs.neynar.com/reference/fetch-bulk-users-by-eth-or-sol-address
 */

import { NEYNAR_API_KEY } from "../../config.js";

const NEYNAR_API_BASE = "https://api.neynar.com/v2/farcaster";

export interface FarcasterUser {
  fid: number;
  username: string;
  custody_address: string;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
}

/**
 * Search for Farcaster users by username
 * @param username The Farcaster username to search for
 * @returns User data including wallet addresses
 */
export async function searchUserByUsername(username: string): Promise<FarcasterUser | null> {
  try {
    if (!NEYNAR_API_KEY) {
      console.error("❌ NEYNAR_API_KEY not configured");
      return null;
    }

    // Clean the username (remove @ prefix if present)
    const cleanUsername = username.replace(/^@/, '');
    
    console.log(`🔍 Searching Neynar for username: ${cleanUsername}`);

    const response = await fetch(
      `${NEYNAR_API_BASE}/user/by_username?username=${encodeURIComponent(cleanUsername)}`,
      {
        headers: {
          'x-api-key': NEYNAR_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.log(`⚠️ Neynar API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as any;
    
    if (data && data.user) {
      console.log(`✅ Found Farcaster user: ${data.user.username} (FID: ${data.user.fid})`);
      return data.user as FarcasterUser;
    }

    return null;
  } catch (error: any) {
    console.error(`❌ Error searching Farcaster user "${username}":`, error);
    return null;
  }
}

/**
 * Get users by multiple wallet addresses
 * @param addresses Array of Ethereum or Solana addresses
 * @returns Map of address -> user data
 */
export async function getUsersByAddresses(addresses: string[]): Promise<Map<string, FarcasterUser>> {
  try {
    if (!NEYNAR_API_KEY) {
      console.error("❌ NEYNAR_API_KEY not configured");
      return new Map();
    }

    if (addresses.length === 0) {
      return new Map();
    }

    console.log(`🔍 Searching Neynar for ${addresses.length} addresses`);

    const response = await fetch(
      `${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${addresses.join(',')}`,
      {
        headers: {
          'x-api-key': NEYNAR_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.log(`⚠️ Neynar API error: ${response.status} ${response.statusText}`);
      return new Map();
    }

    const data = await response.json() as any;
    const userMap = new Map<string, FarcasterUser>();

    // Map addresses to users
    if (data && typeof data === 'object') {
      for (const [address, users] of Object.entries(data)) {
        if (Array.isArray(users) && users.length > 0) {
          userMap.set(address.toLowerCase(), users[0] as FarcasterUser);
        }
      }
    }

    return userMap;
  } catch (error: any) {
    console.error(`❌ Error fetching users by addresses:`, error);
    return new Map();
  }
}

/**
 * Resolve a Farcaster username to wallet address
 * @param username The Farcaster username
 * @returns The primary wallet address (custody or first verified)
 */
export async function resolveUsernameToAddress(username: string): Promise<string | null> {
  try {
    const user = await searchUserByUsername(username);
    
    if (!user) {
      return null;
    }

    // Prefer custody address, then verified eth addresses
    if (user.custody_address) {
      console.log(`✅ Resolved ${username} -> ${user.custody_address} (custody)`);
      return user.custody_address;
    }

    if (user.verified_addresses?.eth_addresses?.length > 0) {
      const address = user.verified_addresses.eth_addresses[0];
      console.log(`✅ Resolved ${username} -> ${address} (verified)`);
      return address;
    }

    console.log(`⚠️ No wallet address found for ${username}`);
    return null;
  } catch (error: any) {
    console.error(`❌ Error resolving username "${username}":`, error);
    return null;
  }
}

/**
 * Resolve multiple Farcaster usernames to wallet addresses
 * @param usernames Array of Farcaster usernames
 * @returns Map of username -> wallet address
 */
export async function resolveUsernamesToAddresses(usernames: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Resolve usernames in parallel
  const promises = usernames.map(async (username) => {
    const address = await resolveUsernameToAddress(username);
    results.set(username, address);
  });

  await Promise.all(promises);

  return results;
}

