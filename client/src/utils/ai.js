const GEMINI_API_KEY = ""; // Add your API key here

/**
 * Calls the Gemini AI API with a prompt
 */
export const callGemini = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    }
    return "I'm having trouble thinking right now. Please try again later.";
  } catch (error) {
    console.error('Gemini API error:', error);
    return "AI Service unavailable.";
  }
};
