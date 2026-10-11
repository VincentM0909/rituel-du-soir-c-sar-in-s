// Fonction serveur (Netlify) reliée à GROQ (offre gratuite).
// - Garde la clé Groq secrète (jamais visible côté téléphone).
// - Traduit le format : l'appli parle "à la Anthropic", Groq parle "à la OpenAI".

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Clé GROQ manquante côté serveur" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}"); // { max_tokens, messages: [{role, content}] }

    // Modèle Groq : configurable via variable d'environnement MODEL,
    // sinon un modèle Llama récent par défaut. Voir https://console.groq.com/docs/models
    const model = process.env.MODEL || "llama-3.3-70b-versatile";

    const messages = (body.messages || []).map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    }));

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        max_tokens: body.max_tokens || 1200,
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: "Erreur Groq", details: data }) };
    }

    // Groq renvoie { choices: [{ message: { content } }] }.
    // On reconvertit au format Anthropic attendu par l'appli : { content: [{ type:"text", text }] }
    const texte = data.choices?.[0]?.message?.content || "";
    const converti = { content: [{ type: "text", text: texte }] };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(converti)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur serveur", details: String(err) })
    };
  }
};
