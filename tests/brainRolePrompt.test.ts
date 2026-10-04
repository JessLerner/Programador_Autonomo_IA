import test from 'node:test';
import assert from 'node:assert/strict';

import { OpenAIBrain } from '../server/providers/openaiBrain.ts';
import { GeminiBrain } from '../server/providers/geminiBrain.ts';
import { GoogleGenAI } from '@google/genai';

const buildContext = () => ({
  userRequest: 'Revisa el proyecto y corrige el error',
  workspace: {
    root: '/workspace/proj',
    folderName: 'proj',
    topLevelFiles: ['package.json', 'src'],
  },
  memory: {
    inspectedFiles: [],
    modifiedFiles: [],
    executedCommands: [],
    errorsEncountered: [],
    correctionsAttempted: [],
    currentPlan: [],
    goal: '',
  },
  toolHistory: [],
  lastError: undefined,
});

test('OpenAI brain defines the responsibility split between local agent and AI', async () => {
  const brain = new OpenAIBrain('test', 'Test', 'http://localhost:11434/v1', '', 'llama3.2');
  let captured: Record<string, any> | undefined;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args: any[]) => {
    captured = JSON.parse(args[1].body);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              type: 'complete',
              summary: 'Hecho',
              reason: 'Verificado',
            }),
          },
        }],
      }),
    } as any;
  };

  try {
    await brain.ask(buildContext());
    assert.ok(captured?.messages?.[0]?.content.includes('El agente local es responsable de descubrir, recuperar, modificar y verificar información.'));
    assert.ok(captured?.messages?.[0]?.content.includes('La IA es responsable de decidir qué necesita y qué debe hacerse a continuación.'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini brain defines the responsibility split between local agent and AI', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const brain = new GeminiBrain();
  let captured: any;

  (brain as any).ai = {
    models: {
      generateContent: async (payload: any) => {
        captured = payload;
        return {
          text: JSON.stringify({
            type: 'complete',
            summary: 'Hecho',
            reason: 'Verificado',
          }),
        };
      },
    },
  };

  try {
    await brain.ask(buildContext());
    assert.ok(captured?.config?.systemInstruction.includes('El agente local es responsable de descubrir, recuperar, modificar y verificar información.'));
    assert.ok(captured?.config?.systemInstruction.includes('La IA es responsable de decidir qué necesita y qué debe hacerse a continuación.'));
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});
