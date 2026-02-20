/**
 * Agentic pipeline implementation
 * Classifier -> Checker -> Function Caller -> Embedder
 */

const { Ollama } = require('ollama');
const config = require('./config');

const ollama = new Ollama({ host: config.ollama.host });

/**
 * Stage 1: Classifier - Extract structured metadata and entities
 */
async function runClassifier(documentText, metadata) {
  const classificationSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      documentType: { 
        type: "string", 
        enum: ["ResearchReport", "CompletionDoc", "HandoffDoc", "TechSpec", "Tutorial", "Other"]
      },
      summary: { type: "string" },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" }
          },
          required: ["name", "type"]
        }
      }
    },
    required: ["title", "documentType", "summary", "entities"]
  };

  const prompt = `You are a precise extraction agent. Extract ONLY information that is explicitly present in the source text. DO NOT infer, assume, or add related concepts.

Document: ${metadata.fileName}
Text:
${documentText.substring(0, 8000)}

STRICT RULES:
1. Title: Use the document filename or an explicit title from the text
2. Document type: 
   - Code files (.py, .js, .sh, .json, etc.) = "TechSpec"
   - Markdown with research content = "ResearchReport"  
   - README/docs = "Tutorial"
   - Other = "Other"
3. Summary: 2-3 sentences describing ONLY what is actually in the text
4. Entities: Extract ONLY entities that appear verbatim in the text. DO NOT add:
   - Related concepts not mentioned
   - Inferred technologies
   - Generic terms unless explicitly used
   - Components described but not named

CRITICAL: Every entity must be directly findable in the source text. If you cannot point to where an entity appears, DO NOT include it.

Return as JSON matching the schema.`;

  const response = await ollama.chat({
    model: config.ollama.models.classifier,
    messages: [{ role: 'user', content: prompt }],
    format: classificationSchema,
    options: { temperature: 0.0 }
  });

  return JSON.parse(response.message.content);
}

/**
 * Stage 2: Checker - Validate extraction accuracy
 */
async function runChecker(documentText, classifiedJson) {
  const validationSchema = {
    type: "object",
    properties: {
      isValid: { type: "boolean" },
      reasoning: { type: "string" }
    },
    required: ["isValid", "reasoning"]
  };

  const prompt = `You are a reasonable validation agent. Verify this classification allows for sensible semantic inferences.

Original text snippet:
${documentText.substring(0, 4000)}

Classified output:
${JSON.stringify(classifiedJson, null, 2)}

VALIDATION RULES - BE REASONABLE:

✅ ALWAYS ACCEPT entities that are:
1. Standard semantic inferences from code:
   - "Python" from .py files or Python syntax
   - "PyTorch" or "torch" from "import torch" statements
   - "NumPy" from "import numpy" 
   - Module names like "torch.nn" from import statements
   - Framework names from their import statements
2. Derived from filenames:
   - If filename is "tesla_consciousness_minimal.py", accept "tesla_consciousness_minimal" as entity
   - File extensions indicate technology (accept them)
3. Explicitly mentioned verbatim in text
4. Clearly implied by the context

❌ ONLY REJECT entities that are:
1. Completely fabricated with NO basis in the text
2. Directly contradicted by the content
3. From completely unrelated domains

For entity validation: If you can explain where an entity comes from (import, filename, language, framework), ACCEPT IT.

Summary: Must reasonably describe the content (doesn't need to be word-perfect)
Document type: Must match the general category (code, docs, config, etc.)

Return: { "isValid": true/false, "reasoning": "explain why valid OR list specific fabricated entities" }`;

  const response = await ollama.chat({
    model: config.ollama.models.checker,
    messages: [{ role: 'user', content: prompt }],
    format: validationSchema,
    options: { temperature: 0.0 }
  });

  return JSON.parse(response.message.content);
}

/**
 * Stage 3: Function Caller - Generate database commands
 */
async function runFunctionCaller(classifiedJson, documentId) {
  const functionSchema = {
    type: "object",
    properties: {
      databaseCommands: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["INSERT_ENTITY", "INSERT_RELATIONSHIP"] },
            payload: { type: "object" }
          },
          required: ["action", "payload"]
        }
      }
    },
    required: ["databaseCommands"]
  };

  const prompt = `Generate database commands to create a knowledge graph.

Document ID: ${documentId}
Entities: ${JSON.stringify(classifiedJson.entities)}

For each entity:
1. INSERT_ENTITY with { id: "entity_name", type: "entity_type", _class: "Concept" }
2. INSERT_RELATIONSHIP linking document to entity with { source: "${documentId}", target: "entity_id", _class: "MENTIONS" }

Return as array of commands following the schema.`;

  const response = await ollama.chat({
    model: config.ollama.models.functionCaller,
    messages: [{ role: 'user', content: prompt }],
    format: functionSchema,
    options: { temperature: 0.0 }
  });

  return JSON.parse(response.message.content).databaseCommands;
}

/**
 * Stage 4: Embedder - Generate vector embeddings
 */
async function runEmbedder(text) {
  const embedResponse = await ollama.embed({
    model: config.ollama.models.embedding,
    input: text
  });
  
  return embedResponse.embeddings[0]; // Return first embedding array
}

module.exports = {
  runClassifier,
  runChecker,
  runFunctionCaller,
  runEmbedder
};
