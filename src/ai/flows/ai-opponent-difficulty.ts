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
  prompt: `You are a Grandmaster-level chess engine.

Analyze the current board state provided in FEN and provide the BEST LEGAL move for the active player.

Current FEN: {{{fen}}}
Difficulty Level: {{{difficulty}}}

CRITICAL RULES:
1. You MUST identify the active player from the FEN (the character after the first space: 'w' for white, 'b' for black).
2. You MUST only return a move that is COMPLETELY LEGAL according to the rules of chess for that position.
3. You MUST return the move in EXACT UCI notation (e.g., "e2e4", "g1f3").
4. For promotions, append the piece type (e.g., "e7e8q" for queen).
5. DO NOT use algebraic notation like "Nf3" or "O-O". Use "g1f3" or "e1g1".
6. RESPOND ONLY WITH THE 4 OR 5 CHARACTER UCI STRING.

Difficulty Guidelines:
- easy: Make developing moves, occasionally ignore tactical threats.
- medium: Play solid chess, look for simple tactics and positional advantages.
- hard: Play perfectly, calculating deep lines and ruthless tactics.

YOUR MOVE (UCI format only):`,
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
    // Clean up the response in case the model added extra characters
    const cleanMove = output.move.trim().toLowerCase().replace(/[^a-h1-8qrbn]/g, '');
    return { move: cleanMove };
  }
);
