const prompts = [
  {
    cefr: "A2",
    text: "Today is a good day to practice English. I will speak slowly and finish every sentence. Clear words matter more than perfect speed. Small mistakes are part of learning. Each careful attempt makes my voice more confident.",
  },
  {
    cefr: "A2",
    text: "I like to begin my morning with a simple plan. First, I choose one important task. Then, I take a short break and drink some water. In the evening, I review what I finished. This routine helps me stay calm.",
  },
  {
    cefr: "A2",
    text: "A quiet walk can change the feeling of a busy day. I notice the weather and the people around me. Sometimes, I hear a new sound or see a small detail. These moments help me slow down. I return home with a clearer mind.",
  },
  {
    cefr: "B1",
    text: "Learning a language takes patience and regular practice. Some days feel easy, while other days require more effort. I try to focus on useful progress instead of perfection. Every mistake shows me what to practice next. That idea keeps me moving forward.",
  },
  {
    cefr: "B1",
    text: "Good conversations begin when people listen with real attention. A thoughtful question can make someone feel welcome. It is fine to pause while choosing the right words. Clear meaning is more important than speaking quickly. Confidence grows through many ordinary conversations.",
  },
] as const;

function stableNumber(value: string) {
  let result = 0;
  for (const character of value) {
    result = (result * 31 + character.codePointAt(0)!) >>> 0;
  }
  return result;
}

export function selectDailySpeakingPrompt(date: string, userId: string) {
  return prompts[stableNumber(`${date}:${userId}`) % prompts.length];
}

export { prompts as speakingPromptBank };
