// Starter tasks. Each one is a real job a web developer might give to an LLM.
// Inputs are text, or text + an image made at runtime (so the repo ships no binary assets).
import { receiptImage } from './samples.js';

export const TASKS = [
  {
    id: 'ticket',
    name: 'Support ticket triage',
    blurb: 'Route customer emails to the right team.',
    system: 'You triage customer support tickets. Pick the category, rate urgency 1 (low) to 5 (critical), and write a one-sentence summary.',
    schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['billing', 'bug', 'feature', 'account', 'other'] },
        urgency: { type: 'integer', minimum: 1, maximum: 5 },
        summary: { type: 'string' },
      },
      required: ['category', 'urgency', 'summary'],
    },
    inputs: [
      { text: 'I was charged twice for my subscription this month and I need a refund today.' },
      { text: 'The export button does nothing on Safari. Chrome works fine.' },
      { text: 'Would be great if you added a dark mode, my eyes hurt at night.' },
    ],
  },
  {
    id: 'review',
    name: 'Review sentiment',
    blurb: 'Tag app-store reviews so a team reads the angry ones first.',
    system: 'Classify the sentiment of a product review and name the main topic in 1 to 3 words.',
    schema: {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'negative', 'mixed'] },
        topic: { type: 'string' },
      },
      required: ['sentiment', 'topic'],
    },
    inputs: [
      { text: 'Love the new update, sync is finally instant!' },
      { text: 'Great design but it crashes every time I open the camera.' },
      { text: 'Yeah sure, deleting my notes was exactly what I wanted. Thanks a lot.' },
    ],
  },
  {
    id: 'receipt',
    name: 'Receipt photo to JSON',
    blurb: 'Expense app: read a receipt photo, never upload it.',
    system: 'Read the receipt image. Return the shop name, the total amount as a number, and the currency code.',
    schema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        total: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['shop', 'total', 'currency'],
    },
    inputs: [
      { text: 'Extract the receipt.', image: () => receiptImage('CAFE NOOR', [['Tea x2', '300'], ['Samosa x3', '240']], 'Rs 540') },
      { text: 'Extract the receipt.', image: () => receiptImage('CITY BOOKS', [['Notebook', '4.50'], ['Pens (pack)', '3.25']], '$7.75') },
    ],
  },
  {
    id: 'lead',
    name: 'Roman Urdu property lead',
    blurb: 'Lahore real-estate leads arrive in mixed Urdu-English. Can Nano keep up?',
    system: 'Extract a property lead from a WhatsApp message written in Roman Urdu. area = the neighbourhood or society name (for example "DHA Phase 6", "Bahria Town"). size = plot or house size (for example "1 kanal", "10 marla"). budget_pkr = the budget in Pakistani rupees as a number (1 lakh = 100000, 1 crore = 10000000). intent = buy or rent.',
    schema: {
      type: 'object',
      properties: {
        area: { type: 'string' },
        size: { type: 'string' },
        budget_pkr: { type: 'integer' },
        intent: { type: 'string', enum: ['buy', 'rent', 'unknown'] },
      },
      required: ['area', 'size', 'budget_pkr', 'intent'],
    },
    inputs: [
      { text: 'Salam bhai, DHA phase 6 mein 1 kanal ghar chahiye kiraye pe, budget 2 lakh mahana tak hai' },
      { text: 'Bahria Town mein 10 marla plot lena hai, 1 crore 20 lakh tak ja sakte hain' },
      { text: 'Johar Town 5 marla house for sale chahiye, budget 2.5 crore' },
    ],
  },
  {
    id: 'custom',
    name: 'Your own task',
    blurb: 'Paste your prompt, schema and test inputs.',
    system: '',
    schema: null,
    inputs: [{ text: '' }],
  },
];
