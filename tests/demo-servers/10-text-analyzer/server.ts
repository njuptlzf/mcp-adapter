import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "text-analyzer", version: "1.0.0" });

server.tool("sentiment", "Analyze sentiment of text", {
  text: z.string().describe("Text to analyze"),
}, async ({ text }) => {
  // Simple sentiment analysis based on keyword matching
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'joy'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry', 'worst', 'disappointed'];
  
  const lowerText = text.toLowerCase();
  const words = lowerText.match(/\b\w+\b/g) || [];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of words) {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
  }
  
  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';
  
  return { content: [{ type: "text", text: JSON.stringify({ sentiment, positive_count: positiveCount, negative_count: negativeCount }) }] };
});

server.tool("keywords", "Extract keywords from text", {
  text: z.string().describe("Text to extract keywords from"),
  maxKeywords: z.number().int().positive().optional().default(10).describe("Maximum number of keywords to return"),
}, async ({ text, maxKeywords }) => {
  // Simple keyword extraction - remove common words and return most frequent
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  const freqMap = new Map<string, number>();
  for (const word of words) {
    freqMap.set(word, (freqMap.get(word) || 0) + 1);
  }
  
  const sortedWords = Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
  
  return { content: [{ type: "text", text: JSON.stringify(sortedWords) }] };
});

server.tool("summary", "Generate summary of text", {
  text: z.string().describe("Text to summarize"),
  maxSentences: z.number().int().positive().optional().default(3).describe("Maximum number of sentences in summary"),
}, async ({ text, maxSentences }) => {
  // Simple summary - take first N sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const summarySentences = sentences.slice(0, Math.min(maxSentences, sentences.length));
  return { content: [{ type: "text", text: summarySentences.join('. ') + (summarySentences.length > 0 ? '.' : '') }] };
});

server.tool("language_detect", "Detect language of text", {
  text: z.string().describe("Text to detect language for"),
}, async ({ text }) => {
  // Simple language detection based on common words
  const englishWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i']);
  const spanishWords = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se']);
  const frenchWords = new Set(['le', 'de', 'un', 'être', 'et', 'à', 'les', 'des', 'en', 'que']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  let enScore = 0, esScore = 0, frScore = 0;
  for (const word of words) {
    if (englishWords.has(word)) enScore++;
    if (spanishWords.has(word)) esScore++;
    if (frenchWords.has(word)) frScore++;
  }
  
  let detected = 'unknown';
  if (enScore > esScore && enScore > frScore) detected = 'english';
  else if (esScore > enScore && esScore > frScore) detected = 'spanish';
  else if (frScore > enScore && frScore > enScore) detected = 'french';
  
  return { content: [{ type: "text", text: JSON.stringify({ language: detected, confidence: Math.max(enScore, esScore, frScore) / words.length }) }] };
});

server.tool("readability", "Calculate readability score", {
  text: z.string().describe("Text to analyze"),
}, async ({ text }) => {
  // Simple readability score based on average sentence length and word length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.match(/\b\w+\b/g) || [];
  
  if (sentences.length === 0 || words.length === 0) {
    return { content: [{ type: "text", text: "Error: Cannot calculate readability for empty text" }] };
  }
  
  const avgSentenceLength = words.length / sentences.length;
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  
  // Simplified readability score (0-100, higher is easier to read)
  let score = 100 - (avgSentenceLength * 0.5) - (avgWordLength * 0.5);
  score = Math.max(0, Math.min(100, score));
  
  return { content: [{ type: "text", text: JSON.stringify({ readability_score: score, avg_sentence_length: avgSentenceLength, avg_word_length: avgWordLength }) }] };
});

server.tool("pos_tag", "Perform part-of-speech tagging", {
  text: z.string().describe("Text to tag"),
}, async ({ text }) => {
  // Very simple POS tagging based on common patterns
  const words = text.match(/\b\w+\b/g) || [];
  const tagged = [];
  
  for (const word of words) {
    let tag = 'NN'; // Default to noun
    const lowerWord = word.toLowerCase();
    
    // Simple heuristics
    if (['is', 'are', 'was', 'were', 'be', 'been', 'being'].includes(lowerWord)) tag = 'VB';
    else if (['have', 'has', 'had', 'do', 'does', 'did'].includes(lowerWord)) tag = 'VB';
    else if (['will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'].includes(lowerWord)) tag = 'MD';
    else if (['the', 'a', 'an'].includes(lowerWord)) tag = 'DT';
    else if (['and', 'or', 'but'].includes(lowerWord)) tag = 'CC';
    else if (['in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(lowerWord)) tag = 'IN';
    else if (['this', 'that', 'these', 'those'].includes(lowerWord)) tag = 'DT';
    else if (['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'].includes(lowerWord)) tag = 'PRP';
    else if (word.endsWith('ly')) tag = 'RB';
    else if (word.endsWith('ing')) tag = 'VBG';
    else if (word.endsWith('ed')) tag = 'VBD';
    else if (word.endsWith('s') && !word.endsWith('ss')) tag = 'NNS';
    
    tagged.push({ word, tag });
  }
  
  return { content: [{ type: "text", text: JSON.stringify(tagged) }] };
});

server.tool("ner", "Perform named entity recognition", {
  text: z.string().describe("Text to extract entities from"),
}, async ({ text }) => {
  // Very simple NER based on capitalized words and common patterns
  const words = text.match(/\b\w+\b/g) || [];
  const entities = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Check if word is capitalized (potential proper noun)
    if (word[0] === word[0].toUpperCase() && word.length > 1) {
      // Check if it's not the first word in sentence (to avoid false positives)
      const isStartOfSentence = i === 0 || /[.!?]\s*$/.test(words[i-1]);
      
      if (!isStartOfSentence) {
        entities.push({ text: word, type: 'PERSON' });
        continue;
      }
    }
    
    // Check for common entity patterns
    if (/\d{4}/.test(word)) { // Year
      entities.push({ text: word, type: 'DATE' });
    } else if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(word)) { // Date
      entities.push({ text: word, type: 'DATE' });
    }
  }
  
  return { content: [{ type: "text", text: JSON.stringify(entities) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);