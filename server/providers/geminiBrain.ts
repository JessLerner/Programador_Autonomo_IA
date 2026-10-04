import { GoogleGenAI } from '@google/genai';
import { Brain, BrainDecision, AgentContext } from '../brain/brainInterface.js';

export class GeminiBrain implements Brain {
  public id = 'gemini';
  public name = 'Google Gemini (gemini-3.8-flash / flash-lite)';
  public description = 'Modelo de razonamiento y codificación autónoma con soporte nativo de Google AI Studio.';

  private ai: GoogleGenAI;
  // Models list in order of preference: flash-lite responds instantly without 503 spikes
  private candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public async ask(context: AgentContext): Promise<BrainDecision> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('[GeminiBrain] GEMINI_API_KEY no está configurada en las variables de entorno.');
    }

    const systemInstruction = `Eres el CEREBRO (Brain) de un agente autónomo de desarrollo de software local.
Tu responsabilidad es:
1. Analizar el pedido del usuario.
2. Razonar qué información necesita descubrir del proyecto.
3. Decidir qué necesita saber y qué debe hacerse a continuación.
4. Solicitar al agente local herramientas específicas para investigar el código (NO asumas nombres de archivos sin buscar o listar).
5. Analizar los resultados devueltos por la máquina. Si hay un error, razonar sobre el error y decidir la corrección.
6. Decidir cuándo la tarea está completamente finalizada y verificada.

SEPARACIÓN DE RESPONSABILIDADES:
- El agente local es responsable de descubrir, recuperar, modificar y verificar información.
- La IA es responsable de decidir qué necesita y qué debe hacerse a continuación.
- La máquina local NO tiene inteligencia propia: tú debes guiar cada paso.

REGLAS FUNDAMENTALES:
- Responde EXCLUSIVAMENTE con un único objeto JSON válido.
- Si no conoces la estructura o archivos relevantes, primero usa "list_directory" o "search_files".
- Lee sólo los archivos que necesitas con "read_file". Puedes pedir rangos con startLine y endLine si el archivo es extenso.
- Para modificar archivos existentes usa "edit_file" (con old_str exacto y new_str) o "write_file".
- Si el proyecto tiene tests o scripts en package.json, ejecútalos con "run_command" para verificar tus cambios.
- Cuando todo esté completo y verificado, emite type: "complete".

HERRAMIENTAS DISPONIBLES:
- "list_directory": { "path": "carpeta opcional" }
- "search_files": { "query": "termino o palabra clave", "path": "subcarpeta opcional" }
- "read_file": { "path": "ruta/archivo", "startLine": 1, "endLine": 60 }
- "write_file": { "path": "ruta/archivo", "content": "contenido completo" }
- "edit_file": { "path": "ruta/archivo", "old_str": "texto exacto a reemplazar", "new_str": "nuevo texto" }
- "delete_file": { "path": "ruta/archivo" }
- "run_command": { "command": "comando a ejecutar en terminal" }
- "git_status": {}
- "git_diff": {}
- "git_commit": { "message": "mensaje" }

FORMATO OBLIGATORIO DE RESPUESTA JSON:
Opción 1 - Ejecutar herramienta:
{
  "type": "tool",
  "tool": "search_files",
  "arguments": { "query": "termino" },
  "reason": "Explicación breve de por qué necesitas esta información o cambio"
}

Opción 2 - Tarea completada:
{
  "type": "complete",
  "summary": "Resumen claro de lo investigado, modificado y probado con éxito.",
  "reason": "Verificación final completada sin errores."
}

Opción 3 - Preguntar al usuario (sólo si es indispensable):
{
  "type": "ask_user",
  "question": "Pregunta al usuario",
  "reason": "Motivo"
}`;

    // Format compact tool history (keeping last 8 events to prevent context blowout)
    const recentHistory = context.toolHistory.slice(-8).map((h) => {
      const argsStr = JSON.stringify(h.arguments);
      const resSnippet = h.outputSnippet ? h.outputSnippet.slice(0, 1000) : '';
      const errSnippet = h.error ? ` [ERROR: ${h.error.slice(0, 600)}]` : '';
      return `Paso ${h.step}: Herramienta "${h.tool}" con args ${argsStr} -> ${h.success ? 'ÉXITO' : 'FALLO'}: ${resSnippet}${errSnippet}`;
    }).join('\n');

    const prompt = `PEDIDO DEL USUARIO:
"${context.userRequest}"

WORKSPACE:
- Directorio raíz: ${context.workspace.root}
- Carpeta: ${context.workspace.folderName}
- Archivos de primer nivel detectados: ${context.workspace.topLevelFiles?.join(', ') || 'Consultar con list_directory'}

MEMORIA ACTUAL:
- Archivos inspeccionados: ${context.memory.inspectedFiles.join(', ') || 'Ninguno'}
- Archivos modificados: ${context.memory.modifiedFiles.join(', ') || 'Ninguno'}
- Errores recientes: ${context.memory.errorsEncountered.slice(-2).join(' | ') || 'Ninguno'}

HISTORIAL RECIENTE DE ACCIONES Y RESULTADOS DE LA MÁQUINA:
${recentHistory || '(Inicio de la tarea - aún no se ejecutaron herramientas)'}

${context.lastError ? `¡ATENCIÓN! La última acción devolvió un error:\n${context.lastError}\nAnaliza este resultado y decide cómo proceder.` : ''}

¿Cuál es tu siguiente decisión estructurada en JSON?`;

    let lastError: Error | null = null;

    // Try available models in order of priority (handling transient 503 spikes)
    for (const model of this.candidateModels) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const text = response.text?.trim() || '{}';
        const parsed = JSON.parse(text);

        // Validate decision structure
        if (!parsed.type) {
          if (parsed.action) {
            const { action, thought, ...rest } = parsed;
            if (action === 'complete') {
              return { type: 'complete', summary: parsed.summary || 'Tarea finalizada.', reason: thought };
            }
            return {
              type: 'tool',
              tool: action,
              arguments: rest,
              reason: thought,
            };
          }
          throw new Error('La respuesta del modelo no contiene un "type" válido (tool | complete | ask_user).');
        }

        if (parsed.type === 'tool' && !parsed.tool) {
          throw new Error('La decisión de tipo "tool" debe incluir el nombre de la herramienta en "tool".');
        }

        return parsed as BrainDecision;
      } catch (err: any) {
        lastError = err;
        // If 503 (model temporarily unavailable / spikes), failover to next candidate model
        if (err.message?.includes('503') || err.status === 503) {
          console.warn(`[GeminiBrain] Modelo ${model} devolvió 503. Intentando modelo de respaldo...`);
          continue;
        }
        // Non-transient error, break immediately
        break;
      }
    }

    console.error('[GeminiBrain] Error invocando modelo:', lastError);
    throw new Error(`[GeminiBrain] Falló la consulta al modelo: ${lastError?.message || 'Error desconocido'}`);
  }
}
