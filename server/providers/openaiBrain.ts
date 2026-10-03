import { Brain, BrainDecision, AgentContext } from '../brain/brainInterface.js';

export class OpenAIBrain implements Brain {
  public id: string;
  public name: string;
  public description: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(
    id: string = 'ollama',
    name: string = 'Ollama / Local LLM (OpenAI-compatible)',
    baseUrl: string = 'http://localhost:11434/v1',
    apiKey: string = '',
    model: string = 'llama3.2'
  ) {
    this.id = id;
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.description = `Proveedor compatible con OpenAI / Ollama en ${this.baseUrl} con modelo ${this.model}`;
  }

  public setConfig(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.description = `Proveedor compatible con OpenAI / Ollama en ${this.baseUrl} con modelo ${this.model}`;
  }

  public async ask(context: AgentContext): Promise<BrainDecision> {
    const systemInstruction = `Eres el CEREBRO (Brain) de un agente autónomo de programación local.
Tu misión es guiar paso a paso la investigación y resolución del pedido del usuario.
Debes responder EXCLUSIVAMENTE con un único objeto JSON válido con una de las siguientes opciones:

1) Solicitar herramienta:
{
  "type": "tool",
  "tool": "list_directory" | "search_files" | "read_file" | "write_file" | "edit_file" | "delete_file" | "run_command" | "git_status" | "git_diff" | "git_commit",
  "arguments": { ... },
  "reason": "Explicación"
}

2) Finalizar:
{
  "type": "complete",
  "summary": "Resumen de lo realizado",
  "reason": "Motivo"
}

3) Preguntar al usuario:
{
  "type": "ask_user",
  "question": "Pregunta",
  "reason": "Motivo"
}`;

    const recentHistory = context.toolHistory.slice(-8).map((h) => {
      const argsStr = JSON.stringify(h.arguments);
      const resSnippet = h.outputSnippet ? h.outputSnippet.slice(0, 1000) : '';
      const errSnippet = h.error ? ` [ERROR: ${h.error.slice(0, 600)}]` : '';
      return `Paso ${h.step}: "${h.tool}" args ${argsStr} -> ${h.success ? 'ÉXITO' : 'FALLO'}: ${resSnippet}${errSnippet}`;
    }).join('\n');

    const prompt = `INSTRUCCIÓN: ${context.userRequest}
WORKSPACE: ${context.workspace.root} (${context.workspace.folderName})
ARCHIVOS PRINCIPALES: ${context.workspace.topLevelFiles?.join(', ') || 'Consultar con list_directory'}
HISTORIAL:
${recentHistory || '(Inicio)'}
${context.lastError ? `ÚLTIMO ERROR: ${context.lastError}` : ''}

¿Siguiente decisión en JSON?`;

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      if (!parsed.type) {
        if (parsed.action) {
          const { action, thought, ...rest } = parsed;
          if (action === 'complete') {
            return { type: 'complete', summary: parsed.summary || 'Completado.', reason: thought };
          }
          return { type: 'tool', tool: action, arguments: rest, reason: thought };
        }
        throw new Error('La respuesta del modelo local no contiene un formato de decisión válido.');
      }

      return parsed as BrainDecision;
    } catch (err: any) {
      console.error(`[OpenAIBrain - ${this.name}] Error:`, err);
      throw new Error(`[${this.name}] Falló la conexión con el modelo: ${err.message}`);
    }
  }
}
