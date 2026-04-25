export const triviaTips: string[] = [
  "Self-attention compares every token to every other token. For an N-token sentence that's N² comparisons.",
  "Attention weights are softmaxed similarity scores. They always add up to 1.",
  "The original Transformer paper from 2017 was titled \"Attention Is All You Need\" — it replaced recurrence with attention.",
  "Multi-head attention runs several attention layers in parallel. One head might track grammar, another might track meaning.",
  "\"The trophy didn't fit in the suitcase because it was too big\" is a classic Winograd schema. Humans get it instantly; older NLP models did not.",
  "Attention is permutation-aware via positional encodings. Without them, \"dog bites man\" and \"man bites dog\" look identical to the model.",
  "For pronoun resolution, attention often spikes on the clue word (like \"big\" or \"small\") as much as on the antecedent itself.",
  "Query, key, and value vectors that drive attention are all linear projections of the same input — three different views of one token.",
  "A single attention head learns one relationship pattern. Stacking heads and layers lets the model learn many at once.",
  "Attention scores are scaled by √d_k before softmax to keep gradients stable when key dimension is large."
];

export function pickTriviaTip(seed: number) {
  return triviaTips[Math.abs(seed) % triviaTips.length];
}
