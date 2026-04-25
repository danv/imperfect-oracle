import { ToolContext } from 'opencode/tools';
import * as fs from 'fs';
import * as path from 'path';

interface SearchResult {
  source: 'rulebook' | 'web';
  citation: string;
  content: string;
  confidence: number;
  category: 'rules';
  mappingNotice?: {
    legacyTerm: string;
    remasteredTerm: string;
    wasDetected: boolean;
  };
}

interface DetectionAttempt {
  timestamp: number;
  success: boolean;
}

// In-memory cache
let remasterCache: Map<string, string> = new Map();
let detectionAttempts: DetectionAttempt[] = [];
let rateLimitCooldown: number | null = null;
const CACHE_FILE = path.join(__dirname, 'remaster-cache.json');
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_FAILURES = 3;
const RATE_LIMIT_COOLDOWN = 10 * 60 * 1000; // 10 minutes

// Load cache on module initialization
loadRemasterCache();

function loadRemasterCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      const mappings = JSON.parse(data);
      remasterCache = new Map(Object.entries(mappings));
    }
  } catch (error) {
    console.error('Failed to load remaster cache:', error);
    remasterCache = new Map();
  }
}

function saveRemasterMapping(legacy: string, remastered: string): void {
  try {
    if (!remasterCache.has(legacy)) {
      remasterCache.set(legacy, remastered);
      
      // Convert to object and sort alphabetically
      const sorted: Record<string, string> = {};
      const sortedKeys = Array.from(remasterCache.keys()).sort();
      for (const key of sortedKeys) {
        sorted[key] = remasterCache.get(key)!;
      }
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to save remaster mapping:', error);
  }
}

function checkRateLimit(): boolean {
  const now = Date.now();
  
  // Check if in cooldown
  if (rateLimitCooldown !== null && now < rateLimitCooldown) {
    return false;
  }
  
  // Clean old attempts
  detectionAttempts = detectionAttempts.filter(
    attempt => now - attempt.timestamp < RATE_LIMIT_WINDOW
  );
  
  // Check failure rate
  const recentFailures = detectionAttempts.filter(
    attempt => !attempt.success
  ).length;
  
  if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
    rateLimitCooldown = now + RATE_LIMIT_COOLDOWN;
    return false;
  }
  
  return true;
}

function recordDetectionAttempt(success: boolean): void {
  detectionAttempts.push({
    timestamp: Date.now(),
    success
  });
}

function buildAonUrl(term: string): string {
  const encoded = encodeURIComponent(term);
  return `https://2e.aonprd.com/Search.aspx?q=${encoded}`;
}

function extractNameFromLink(linkText: string): string {
  // Extract name from AON link text or URL
  const match = linkText.match(/title=["'](.*?)["']/);
  if (match) return match[1];
  
  // Try to extract from URL parameter
  const urlMatch = linkText.match(/ID=(\d+)/);
  if (urlMatch) return urlMatch[1];
  
  return linkText;
}

async function fetchAonPage(term: string, ctx: ToolContext): Promise<{legacy?: string, remastered?: string} | null> {
  try {
    const url = buildAonUrl(term);
    const result: any = await ctx.tools['webfetch'].fetch({ url });
    const html = result.content || result.html || '';
    
    if (!html) return null;
    
    // Pattern 1: "There is a Legacy version here" link
    const legacyLinkMatch = html.match(/There is a Legacy version.*?href=["'](.*?)["']/i);
    if (legacyLinkMatch) {
      return { remastered: term, legacy: extractNameFromLink(legacyLinkMatch[1]) };
    }
    
    // Pattern 2: "There is a Remastered version here" link
    const remasterLinkMatch = html.match(/There is a Remastered version.*?href=["'](.*?)["']/i);
    if (remasterLinkMatch) {
      return { legacy: term, remastered: extractNameFromLink(remasterLinkMatch[1]) };
    }
    
    // Pattern 3: Legacy Content banner
    if (html.includes('### Legacy Content') || html.includes('Legacy Content')) {
      // Try to find remastered version link
      const remasterMatch = html.match(/Remastered version.*?href=["'](.*?)["']/i);
      if (remasterMatch) {
        return { legacy: term, remastered: extractNameFromLink(remasterMatch[1]) };
      }
      return { legacy: term };
    }
    
    // Pattern 4: Source metadata
    const sourceMatch = html.match(/\*\*Source\*\* \[([^\]]+)\]/);
    if (sourceMatch) {
      const source = sourceMatch[1];
      if (source.includes('Player Core') || source.includes('GM Core') || source.includes('Monster Core 2')) {
        return { remastered: term };
      } else if (source.includes('Core Rulebook')) {
        return { legacy: term };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch AON page:', error);
    return null;
  }
}

async function checkRemasterMapping(query: string, ctx: ToolContext): Promise<{
  hasMapping: boolean;
  remasteredTerm?: string;
  legacyTerm?: string;
  wasDetected: boolean;
}> {
  // Check cache first
  const cached = remasterCache.get(query);
  if (cached) {
    return {
      hasMapping: true,
      remasteredTerm: cached,
      legacyTerm: query,
      wasDetected: false
    };
  }
  
  // Check reverse cache (if query is already remastered term)
  for (const [legacy, remastered] of remasterCache.entries()) {
    if (remastered === query) {
      return {
        hasMapping: true,
        remasteredTerm: query,
        legacyTerm: legacy,
        wasDetected: false
      };
    }
  }
  
  // Check rate limit before fetching
  if (!checkRateLimit()) {
    return {
      hasMapping: false,
      wasDetected: false
    };
  }
  
  // Try to detect mapping from AON
  const mapping = await fetchAonPage(query, ctx);
  
  if (mapping) {
    recordDetectionAttempt(true);
    
    if (mapping.legacy && mapping.remastered) {
      saveRemasterMapping(mapping.legacy, mapping.remastered);
      return {
        hasMapping: true,
        remasteredTerm: mapping.remastered,
        legacyTerm: mapping.legacy,
        wasDetected: true
      };
    }
  } else {
    recordDetectionAttempt(false);
  }
  
  return {
    hasMapping: false,
    wasDetected: false
  };
}

function formatMappingNotice(legacyTerm: string, remasteredTerm: string, wasDetected: boolean): string {
  if (wasDetected) {
    return `I detected that "${legacyTerm}" was renamed to "${remasteredTerm}" in the PF2e Remaster. I've cached this for future queries.\n\n`;
  }
  return `Note: "${legacyTerm}" was renamed to "${remasteredTerm}" in the PF2e Remaster. Results shown use the remastered term.\n\n`;
}

// Helper to search AON using Kagi (replaces webfetch.search)
async function searchAonWithKagi(query: string, ctx: ToolContext, limit: number = 3): Promise<Array<{url: string, content: string}>> {
  try {
    const kagiResults: any = await ctx.tools['kagi-search_kagi_search_fetch'].fetch({
      queries: [`site:2e.aonprd.com ${query}`]
    });
    
    // Transform Kagi response to match webfetch format
    const formatted: Array<{url: string, content: string}> = [];
    const results = kagiResults.results || kagiResults || [];
    
    for (let i = 0; i < Math.min(limit, results.length); i++) {
      const r = results[i];
      formatted.push({
        url: r.url || '',
        content: r.snippet || r.title || ''
      });
    }
    
    return formatted;
  } catch (error) {
    console.error('Kagi search failed:', error);
    return [];
  }
}

export async function searchRules(ctx: ToolContext, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  // Check for remaster mapping
  const mapping = await checkRemasterMapping(query, ctx);
  
  if (mapping.hasMapping && mapping.remasteredTerm) {
    // Search with remastered term (primary)
    const ragRemastered: any = await ctx.tools['mcp-rag'].search({
      query: mapping.remasteredTerm,
      limit: 5
    });
    
    const highRemastered = ragRemastered.filter((r: any) => r.score <= 0.5);
    
    if (highRemastered.length > 0) {
      for (const r of highRemastered) {
        results.push({
          source: 'rulebook',
          citation: r.document,
          content: formatMappingNotice(mapping.legacyTerm!, mapping.remasteredTerm!, mapping.wasDetected) + r.text,
          confidence: 1 - r.score, // Convert distance to confidence
          category: 'rules',
          mappingNotice: {
            legacyTerm: mapping.legacyTerm!,
            remasteredTerm: mapping.remasteredTerm!,
            wasDetected: mapping.wasDetected
          }
        });
      }
      return results;
    }
    
    // Also search with legacy term for completeness
    const ragLegacy: any = await ctx.tools['mcp-rag'].search({
      query: mapping.legacyTerm!,
      limit: 3
    });
    
    const highLegacy = ragLegacy.filter((r: any) => r.score <= 0.5);
    
    if (highLegacy.length > 0) {
      // Add legacy results with lower priority
      for (const r of highLegacy) {
        results.push({
          source: 'rulebook',
          citation: r.document,
          content: `Legacy results for "${mapping.legacyTerm}":\n${r.text}`,
          confidence: (1 - r.score) * 0.9, // Convert distance to confidence, slightly lower priority
          category: 'rules',
          mappingNotice: {
            legacyTerm: mapping.legacyTerm!,
            remasteredTerm: mapping.remasteredTerm!,
            wasDetected: mapping.wasDetected
          }
        });
      }
      
      if (results.length > 0) {
        return results;
      }
    }
  }
  
  // No mapping found, proceed with original query
  const rag: any = await ctx.tools['mcp-rag'].search({
    query,
    limit: 5
  });
  
  const high = rag.filter((r: any) => r.score <= 0.5);
  if (high.length) {
    for (const r of high) {
      results.push({
        source: 'rulebook',
        citation: r.document,
        content: r.text,
        confidence: 1 - r.score, // Convert distance to confidence
        category: 'rules'
      });
    }
    return results;
  }
  
  // Low confidence - try web search with both terms if mapping was detected
  if (mapping.hasMapping && mapping.remasteredTerm) {
    const webRemastered = await searchAonWithKagi(mapping.remasteredTerm, ctx, 2);
    
    for (const r of webRemastered) {
      results.push({
        source: 'web',
        citation: r.url,
        content: formatMappingNotice(mapping.legacyTerm!, mapping.remasteredTerm!, mapping.wasDetected) + r.content,
        confidence: 0.6,
        category: 'rules',
        mappingNotice: {
          legacyTerm: mapping.legacyTerm!,
          remasteredTerm: mapping.remasteredTerm!,
          wasDetected: mapping.wasDetected
        }
      });
    }
    
    // Also fetch legacy results
    const webLegacy = await searchAonWithKagi(mapping.legacyTerm!, ctx, 2);
    
    for (const r of webLegacy) {
      results.push({
        source: 'web',
        citation: r.url,
        content: `Legacy results for "${mapping.legacyTerm}":\n${r.content}`,
        confidence: 0.5,
        category: 'rules',
        mappingNotice: {
          legacyTerm: mapping.legacyTerm!,
          remasteredTerm: mapping.remasteredTerm!,
          wasDetected: mapping.wasDetected
        }
      });
    }
    
    if (results.length > 0) {
      return results;
    }
  }
  
  // Final fallback: web search with original query
  const web = await searchAonWithKagi(query, ctx, 3);
  
  for (const r of web) {
    results.push({
      source: 'web',
      citation: r.url,
      content: r.content,
      confidence: 0.5,
      category: 'rules'
    });
  }
  
  return results;
}
