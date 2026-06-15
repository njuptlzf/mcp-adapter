import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "markdown", version: "1.0.0" });

server.tool("to_html", "Convert markdown to HTML", {
  markdown: z.string().describe("Markdown text to convert"),
}, async ({ markdown }) => {
  // Simple markdown to HTML conversion (basic implementation)
  let html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^>(.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\* (.+)$/gm, '<ul><li>$1</li></ul>')
    .replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p> <\/p>/g, '');
  
  return { content: [{ type: "text", text: html }] };
});

server.tool("to_text", "Convert HTML to plain text", {
  html: z.string().describe("HTML text to convert"),
}, async ({ html }) => {
  // Simple HTML to text conversion
  let text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  return { content: [{ type: "text", text: text.trim() }] };
});

server.tool("get_headings", "Extract headings from markdown", {
  markdown: z.string().describe("Markdown text"),
}, async ({ markdown }) => {
  const headings = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#+)\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      headings.push({ level, text });
    }
  }
  return { content: [{ type: "text", text: JSON.stringify(headings) }] };
});

server.tool("get_links", "Extract links from markdown", {
  markdown: z.string().describe("Markdown text"),
}, async ({ markdown }) => {
  const links = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(markdown)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }
  return { content: [{ type: "text", text: JSON.stringify(links) }] };
});

server.tool("word_count", "Count words in text", {
  text: z.string().describe("Text to count words in"),
}, async ({ text }) => {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return { content: [{ type: "text", text: String(words.length) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);