'use server';

/**
 * @fileOverview Game history analysis flow.
 *
 * This file defines a Genkit flow to analyze a user's chess game history and provide insights
 * into their strengths and weaknesses. It exports the analyzeGameHistory function,
 * the AnalyzeGameHistoryInput type, and the AnalyzeGameHistoryOutput type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeGameHistoryInputSchema = z.object({
  gameHistory: z
    .string()
    .describe('A string containing the user game history in a readable format.'),
});
export type AnalyzeGameHistoryInput = z.infer<typeof AnalyzeGameHistoryInputSchema>;

const AnalyzeGameHistoryOutputSchema = z.object({
  strengths: z.string().describe('A summary of the user chess strengths.'),
  weaknesses: z.string().describe('A summary of the user chess weaknesses.'),
  overallAssessment: z.string().describe('An overall assessment of the user chess skills.'),
});
export type AnalyzeGameHistoryOutput = z.infer<typeof AnalyzeGameHistoryOutputSchema>;

export async function analyzeGameHistory(input: AnalyzeGameHistoryInput): Promise<AnalyzeGameHistoryOutput> {
  return analyzeGameHistoryFlow(input);
}

const analyzeGameHistoryPrompt = ai.definePrompt({
  name: 'analyzeGameHistoryPrompt',
  input: {schema: AnalyzeGameHistoryInputSchema},
  output: {schema: AnalyzeGameHistoryOutputSchema},
  prompt: `You are an expert chess coach analyzing a player's game history to identify their strengths and weaknesses.

  Analyze the following game history and provide a summary of the player strengths, weaknesses, and an overall assessment of the player chess skills.

  Game History:
  {{gameHistory}}

  Respond in a structured format, clearly delineating strengths, weaknesses and overall assessment.
  `,
});

const analyzeGameHistoryFlow = ai.defineFlow(
  {
    name: 'analyzeGameHistoryFlow',
    inputSchema: AnalyzeGameHistoryInputSchema,
    outputSchema: AnalyzeGameHistoryOutputSchema,
  },
  async input => {
    const {output} = await analyzeGameHistoryPrompt(input);
    return output!;
  }
);
