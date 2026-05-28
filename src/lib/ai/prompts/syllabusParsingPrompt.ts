/**
 * Prompt pour le parsing de syllabus par l'IA.
 *
 * Concu pour etre compatible avec des modeles 7B (Mistral, Llama, Phi).
 * Le prompt est tres explicite sur le format JSON attendu pour maximiser
 * la fiabilite du parsing avec des petits modeles.
 */

const SYLLABUS_JSON_SCHEMA = `{
  "title": "string (titre du cours)",
  "description": "string (description generale)",
  "learningObjectives": ["string (objectif 1)", "string (objectif 2)"],
  "structure": {
    "chapters": [
      {
        "title": "string (titre du chapitre)",
        "description": "string (description du chapitre)",
        "topics": [
          {
            "title": "string (titre du sujet)",
            "content": "string (contenu/resume du sujet)",
            "concepts": [
              {
                "title": "string (nom du concept cle)",
                "description": "string (breve description)"
              }
            ]
          }
        ]
      }
    ]
  }
}`

export const SYLLABUS_PARSING_PROMPTS = {
    fr: {
        system: `Tu es un assistant specialise dans l'analyse de syllabus academiques.
Ta tache : analyser le texte d'un syllabus et le structurer en JSON.

REGLES STRICTES :
1. Reponds UNIQUEMENT avec du JSON valide, RIEN d'autre (pas de texte avant/apres)
2. Respecte EXACTEMENT ce schema JSON :
${SYLLABUS_JSON_SCHEMA}
3. Extrais le titre du cours depuis le document
4. Identifie les objectifs pedagogiques (learningObjectives)
5. Decoupe le contenu en chapitres (chapters) et sous-sujets (topics)
6. Pour chaque sujet, identifie les concepts cles (concepts)
7. Si un champ n'est pas present dans le document, utilise une chaine vide ""
8. Les chapitres doivent avoir au moins 1 topic
9. Produis du JSON valide, sans commentaires ni trailing commas`,

        user: (text: string) =>
            `Analyse ce syllabus et structure-le en JSON selon le schema demande.\n\nTexte du syllabus :\n---\n${text}\n---\n\nJSON :`,
    },

    en: {
        system: `You are an assistant specialized in analyzing academic syllabi.
Your task: analyze the syllabus text and structure it as JSON.

STRICT RULES:
1. Reply ONLY with valid JSON, NOTHING else (no text before/after)
2. Follow EXACTLY this JSON schema:
${SYLLABUS_JSON_SCHEMA}
3. Extract the course title from the document
4. Identify learning objectives (learningObjectives)
5. Split content into chapters and sub-topics
6. For each topic, identify key concepts
7. If a field is not in the document, use an empty string ""
8. Chapters must have at least 1 topic
9. Produce valid JSON, no comments or trailing commas`,

        user: (text: string) =>
            `Analyze this syllabus and structure it as JSON according to the requested schema.\n\nSyllabus text:\n---\n${text}\n---\n\nJSON:`,
    },
}
