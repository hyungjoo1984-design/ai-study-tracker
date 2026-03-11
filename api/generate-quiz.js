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

  const { planTitle, materials, existingQuestions, selectedTopics } = req.body;

  // 참고자료가 있는 경우와 없는 경우 다른 프롬프트 사용
  const hasMaterials = materials && materials !== "등록된 자료 없음" && materials.trim().length > 0;
  const hasTopics = selectedTopics && selectedTopics.trim().length > 0;

  const topicsSection = hasTopics 
    ? `\n📚 출제 범위 (이 목차에서만 문제를 출제하세요):\n${selectedTopics}\n`
    : "";

  const prompt = hasMaterials 
    ? `당신은 한국의 시험 출제 전문가입니다.
아래 참고자료를 바탕으로 5지선다 객관식 퀴즈 10개를 JSON으로 생성해주세요.

시험/분야: ${planTitle || "일반 학습"}
${topicsSection}
참고 자료:
${materials}

${existingQuestions ? `기존에 출제된 문제 (중복 피하기):
${existingQuestions}` : ""}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "quizzes": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "선택지5"],
      "answer": 0,
      "source": "참고자료명 또는 출처"
    }
  ]
}

규칙:
- 반드시 10개의 문제를 생성하세요
- question은 명확하고 구체적인 한국어 문제
- options는 정확히 5개의 선택지 (정답 포함)
- answer는 정답의 인덱스 (0-4)
- source는 문제의 출처 (참고자료명)
- 실제 시험에 나올 법한 실용적인 문제 출제
- 기존 문제와 중복되지 않는 새로운 문제 출제
- 난이도를 다양하게 섞어서 출제${hasTopics ? "\n- 반드시 지정된 출제 범위 내에서만 문제를 출제하세요" : ""}`

    : `당신은 한국의 시험 출제 전문가입니다.
"${planTitle || "일반 학습"}" 분야의 최신 시험 경향과 핵심 개념을 바탕으로 5지선다 객관식 퀴즈 10개를 JSON으로 생성해주세요.
${topicsSection}
${existingQuestions ? `기존에 출제된 문제 (중복 피하기):
${existingQuestions}` : ""}

다음 사항을 고려해주세요:
- 한국에서 실제로 시행되는 관련 자격증/시험의 기출 유형 참고
- 최신 트렌드와 실무에서 중요한 개념 포함
- 초급부터 중급 난이도까지 다양하게 출제${hasTopics ? "\n- 반드시 지정된 출제 범위 내에서만 문제를 출제하세요" : ""}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "quizzes": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4", "선택지5"],
      "answer": 0,
      "source": "출처 (예: 기출문제, 공식교재, 최신이론 등)"
    }
  ]
}

규칙:
- 반드시 10개의 문제를 생성하세요
- question은 명확하고 구체적인 한국어 문제
- options는 정확히 5개의 선택지 (정답 포함)
- answer는 정답의 인덱스 (0-4)
- source는 문제의 출처나 근거
- 실제 시험에 나올 법한 실용적인 문제 출제
- 기존 문제와 중복되지 않는 새로운 문제 출제
- 신뢰할 수 있는 공식 자료 기반으로 출제
- 난이도를 다양하게 섞어서 출제`;

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
        max_tokens: 8000,
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
