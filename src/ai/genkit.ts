import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit configuration for AI features.
 */
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey || false,
      apiVersion: 'v1beta'
    })
  ],
  // Using 'gemini-flash-latest' which is the specific ID found in your project's available models list.
  // This corresponds to 1.5 Flash and should have a higher free tier quota than the 2.0 models.
  model: 'googleai/gemini-flash-latest',
});

if (!apiKey && typeof window === 'undefined') {
  console.warn('⚠️ Genkit: GOOGLE_API_KEY or GEMINI_API_KEY is missing.');
}
