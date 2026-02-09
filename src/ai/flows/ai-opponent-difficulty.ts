
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
  prompt: `You are an expert chess engine. Analyze the current board state and provide the best move in UCI notation (e.g., "e2e4" or "e7e8q").

  The difficulty levels are:
  - easy: Make simple and obvious moves, sometimes blundering.
  - medium: Make strategic moves, but avoid extremely deep calculations.
  - hard: Play at a grandmaster level, maximizing tactical advantages.

  Current FEN: {{{fen}}}
  Difficulty: {{{difficulty}}}

  Respond ONLY with the UCI move. No explanation, no extra text. Example: "d2d4"`,
});

const aiOpponentDifficultyFlow = ai.defineFlow(
  {
    name: 'aiOpponentDifficultyFlow',
    inputSchema: AiOpponentDifficultyInputSchema,
    outputSchema: AiOpponentDifficultyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
