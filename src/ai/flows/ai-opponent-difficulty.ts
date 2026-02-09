
'use server';

/**
 * @fileOverview This file defines a Genkit flow for playing chess against an AI opponent with adjustable difficulty levels.
 *
 * The flow takes the current game state and desired difficulty as input and returns the AI's move.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiOpponentDifficultyInputSchema = z.object({
  fen: z.string().describe('The current board state in Forsyth–Edwards Notation (FEN).'),
  difficulty: z
    .enum(['easy', 'medium', 'hard'])
    .describe('The difficulty level of the AI opponent.'),
});
export type AiOpponentDifficultyInput = z.infer<typeof AiOpponentDifficultyInputSchema>;

const AiOpponentDifficultyOutputSchema = z.object({
  move: z.string().describe('The AI opponent move in Universal Chess Interface (UCI) notation (e.g., e2e4).'),
});
export type AiOpponentDifficultyOutput = z.infer<typeof AiOpponentDifficultyOutputSchema>;

export async function aiOpponentDifficulty(input: AiOpponentDifficultyInput): Promise<AiOpponentDifficultyOutput> {
  return aiOpponentDifficultyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentDifficultyPrompt',
  input: {schema: AiOpponentDifficultyInputSchema},
  output: {schema: AiOpponentDifficultyOutputSchema},
  prompt: `You are an expert chess engine. 

Analyze the current board state provided in FEN and provide the BEST LEGAL move for the active player indicated in the FEN.

Current FEN: {{{fen}}}
Difficulty Level: {{{difficulty}}}

Difficulty Guidelines:
- easy: Make simple, occasionally weak moves. Focus on basic development.
- medium: Play strategically, look for 1-2 turn tactical advantages.
- hard: Play at a Grandmaster level, maximizing long-term strategy and immediate tactics.

YOUR TASK:
1. Identify which side is moving (the character after the first space in the FEN).
2. Calculate the best legal move for that side.
3. Return the move in EXACT UCI notation (e.g., "e2e4", "g1f3", or "e7e8q" for promotion).

Respond ONLY with the UCI move string. No explanation, no quotes, no extra text.`,
});

const aiOpponentDifficultyFlow = ai.defineFlow(
  {
    name: 'aiOpponentDifficultyFlow',
    inputSchema: AiOpponentDifficultyInputSchema,
    outputSchema: AiOpponentDifficultyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output?.move) {
      throw new Error("AI failed to generate a move.");
    }
    return output;
  }
);
