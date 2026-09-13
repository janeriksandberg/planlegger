// Konfigurasjon for Planlegger.
// Passordet lagres ALDRI her – kun en salt og en verifikator (SHA-256 av den avledede nøkkelen).
// Bytt passord via Innstillinger i appen; da får du et nytt utdrag du limer inn her.
window.PLANLEGGER_CONFIG = {
  appName: 'Planlegger',
  auth: {
    salt: '8d82557a88d9acc3dd9959a7380328c7',
    verifier: 'ceb8b4825fe755561d8ec4178c94089cf99283091b1c083acf498b4a6c6c81c4',
    iterations: 200000
  },
  // Standard AI-oppsett. Appen fungerer fullt ut uten AI (innebygde forslag brukes da).
  // Kan overstyres i Innstillinger; nøkkelen lagres kryptert på enheten.
  // provider: 'off' | 'openai' (Groq, OpenRouter, OpenAI …) | 'gemini' | 'anthropic' | 'pollinations'
  ai: {
    provider: 'off',
    baseUrl: '',
    model: '',
    apiKey: ''
  }
};
