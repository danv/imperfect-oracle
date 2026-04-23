import { ToolContext } from 'opencode/tools';

interface SearchResult {
  source: 'rulebook' | 'web';
  citation: string;
  content: string;
  confidence: number;
  category: 'rules';
}

export async function searchRules(ctx: ToolContext, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Query MCP‑RAG
  const rag: any = await ctx.tools['mcp-rag'].search({
    query,
    limit: 5
  });

  // High‑confidence hits
  const high = rag.filter((r: any) => r.score >= 0.7);
  if (high.length) {
    for (const r of high) {
      results.push({
        source: 'rulebook',
        citation: r.document,
        content: r.text,
        confidence: r.score,
        category: 'rules'
      });
    }
    return results;
  }

  // Web fallback
  const web: any = await ctx.tools['webfetch'].search({
    query: `site:2e.aonprd.com ${query}`,
    limit: 3
  });

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
