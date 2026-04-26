import { ToolContext } from 'opencode/tools';

interface SearchResult {
  source: 'lore-doc' | 'web';
  citation: string;
  content: string;
  confidence: number;
  category: 'lore';
}

// Helper to search PathfinderWiki using Kagi
async function searchWikiWithKagi(query: string, ctx: ToolContext, limit: number = 3): Promise<Array<{url: string, content: string}>> {
  try {
    const kagiResults: any = await ctx.tools['kagi-search_kagi_search_fetch'].fetch({
      queries: [`site:pathfinderwiki.com ${query}`]
    });
    
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

export async function searchLore(ctx: ToolContext, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  // Step 1: Query RAG first (local knowledge base)
  const rag: any = await ctx.tools['rag-mcp-pf2e_search_docs'].search({
    query,
    n_results: 5
  });
  
  // Filter for high confidence (distance <= 0.3 means similarity >= 0.7)
  const high = rag.filter((r: any) => r.distance <= 0.3);
  
  if (high.length > 0) {
    for (const r of high) {
      results.push({
        source: 'lore-doc',
        citation: r.source || r.document || 'unknown',
        content: r.content || r.text || r.chunk || '',
        confidence: 1 - r.distance,
        category: 'lore'
      });
    }
    return results;
  }
  
  // Step 2: Low confidence from RAG - try web search (PathfinderWiki fallback)
  const web = await searchWikiWithKagi(query, ctx, 3);
  
  for (const r of web) {
    results.push({
      source: 'web',
      citation: r.url,
      content: r.content,
      confidence: 0.6, // Slightly below RAG threshold as fallback
      category: 'lore'
    });
  }
  
  return results;
}