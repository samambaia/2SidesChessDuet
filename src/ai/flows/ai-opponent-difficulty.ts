'use server';

/**
 * @fileOverview This file defines a Genkit flow for playing chess against an AI opponent with adjustable difficulty levels.
 *
 * The flow takes the current game state and desired difficulty as input and returns the AI's move.
 *
 * @interface AiOpponentDifficultyInput - Represents the input to the aiOpponentDifficulty function, including the FEN notation of the board state and the desired difficulty level.
 * @interface AiOpponentDifficultyOutput - Represents the output of the aiOpponentDifficulty function, which includes the AI's move in UCI notation.
 *
 * @function aiOpponentDifficulty - The main function that initiates the AI opponent flow.
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
  move: z.string().describe('The AI opponent move in Universal Chess Interface (UCI) notation.'),
});
export type AiOpponentDifficultyOutput = z.infer<typeof AiOpponentDifficultyOutputSchema>;

export async function aiOpponentDifficulty(input: AiOpponentDifficultyInput): Promise<AiOpponentDifficultyOutput> {
  return aiOpponentDifficultyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentDifficultyPrompt',
  input: {schema: AiOpponentDifficultyInputSchema},
  output: {schema: AiOpponentDifficultyOutputSchema},
  prompt: `You are a chess engine that analyzes the current board state and provides the best move for the given difficulty level.

  The difficulty levels are:
  - easy: Make simple and obvious moves.
  - medium: Make more strategic moves, but still avoid complex tactics.
  - hard: Play at a grandmaster level, considering all possible variations.

  Current board state in FEN notation: {{{fen}}}
  Difficulty level: {{{difficulty}}}

  Respond with the best chess move in UCI notation. Do not include any explanation. The response should ONLY contain the move.`,
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
