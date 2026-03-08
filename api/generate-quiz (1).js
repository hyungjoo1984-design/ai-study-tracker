export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { planTitle, materials } = req.body;

  const prompt = `당신은 한국의 시험 출제 전문가입니다.
아래 정보를 바탕으로 5지선다 객관식 퀴즈 3개를 JSON으로 생성해주세요.

시험/분야: ${planTitle || "일반 학습"}
참고 자료:
${materials || "등록된 자료 없음"}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "quizzes": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "선택지5"],
      "answer": 0
    }
  ]
}

규칙:
- question은 명확하고 구체적인 한국어 문제
- options는 정확히 5개의 선택지 (정답 포함)
- answer는 정답의 인덱스 (0-4)
- 실제 시험에 나올 법한 실용적인 문제 출제`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content.map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "퀴즈 생성 중 오류가 발생했습니다." });
  }
}
