 'use server';
/**
 * @fileOverview Provides feedback on the legality of chess moves in learning mode.
 *
 * - getMoveFeedback - A function that provides feedback on a chess move.
 * - MoveFeedbackInput - The input type for the getMoveFeedback function.
 * - MoveFeedbackOutput - The return type for the getMoveFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MoveFeedbackInputSchema = z.object({
  currentBoardState: z
    .string()
    .describe('The current state of the chess board in FEN notation.'),
  userMove: z
    .string()
    .describe('The chess move attempted by the user in algebraic notation.'),
});
export type MoveFeedbackInput = z.infer<typeof MoveFeedbackInputSchema>;

const MoveFeedbackOutputSchema = z.object({
  isLegalMove: z.boolean().describe('Whether the move is legal or not.'),
  feedback: z.string().describe('Feedback on the move, including why it is illegal if applicable.'),
});
export type MoveFeedbackOutput = z.infer<typeof MoveFeedbackOutputSchema>;

export async function getMoveFeedback(input: MoveFeedbackInput): Promise<MoveFeedbackOutput> {
  return moveFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'moveFeedbackPrompt',
  input: {schema: MoveFeedbackInputSchema},
  output: {schema: MoveFeedbackOutputSchema},
  prompt: `You are a chess tutor providing feedback to a student on their moves.

  Given the current board state and the user's attempted move, determine if the move is legal.

  If the move is legal, set isLegalMove to true and provide encouraging feedback.
  If the move is not legal, set isLegalMove to false and explain why the move is illegal, referencing the rules of chess.

Current Board State (FEN Notation): {{{currentBoardState}}}
User Move: {{{userMove}}}`,
});

const moveFeedbackFlow = ai.defineFlow(
  {
    name: 'moveFeedbackFlow',
    inputSchema: MoveFeedbackInputSchema,
    outputSchema: MoveFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
