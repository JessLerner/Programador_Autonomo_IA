import { Brain } from '../brain/brainInterface.js';
import { GeminiBrain } from './geminiBrain.js';
import { OpenAIBrain } from './openaiBrain.js';

export class ProviderRegistry {
  private brains: Map<string, Brain> = new Map();
  private activeBrainId: string = 'gemini';

  constructor() {
    const gemini = new GeminiBrain();
    const ollama = new OpenAIBrain(
      'ollama',
      'Ollama Local LLM',
      'http://localhost:11434/v1',
      '',
      'codellama'
    );
    const openai = new OpenAIBrain(
      'openai',
      'OpenAI Custom (GPT-4o)',
      'https://api.openai.com/v1',
      '',
      'gpt-4o'
    );

    this.brains.set(gemini.id, gemini);
    this.brains.set(ollama.id, ollama);
    this.brains.set(openai.id, openai);
  }

  public getActiveBrain(): Brain {
    const brain = this.brains.get(this.activeBrainId);
    if (!brain) {
      return this.brains.get('gemini')!;
    }
    return brain;
  }

  // Alias for backward compatibility
  public getActiveProvider(): Brain {
    return this.getActiveBrain();
  }

  public setActiveProvider(id: string): boolean {
    if (this.brains.has(id)) {
      this.activeBrainId = id;
      return true;
    }
    return false;
  }

  public listProviders(): Array<{ id: string; name: string; description: string; isActive: boolean }> {
    return Array.from(this.brains.values()).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.id === this.activeBrainId,
    }));
  }

  public updateProviderConfig(id: string, config: { baseUrl?: string; apiKey?: string; model?: string }) {
    const brain = this.brains.get(id);
    if (brain && brain instanceof OpenAIBrain) {
      brain.setConfig(
        config.baseUrl || 'http://localhost:11434/v1',
        config.apiKey || '',
        config.model || 'llama3.2'
      );
    }
  }
}

export const providerRegistry = new ProviderRegistry();
