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

  const { field, examDate, dailyHours, background, notes, includeSubtasks, today } = req.body;

  // 기본 프롬프트 (세부 목차 없음 - 빠름)
  const basicPrompt = `당신은 한국의 시험 준비 전문 스터디 플래너입니다.
아래 정보를 바탕으로 최적의 공부 스케줄을 JSON으로 생성해주세요.

시험/공부 분야: ${field}
시험일: ${examDate}
하루 학습 시간: ${dailyHours}시간
기존 배경지식: ${background || "없음"}
추가 메모: ${notes || "없음"}
오늘 날짜: ${today}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "title": "플랜 제목 (예: 빅데이터분석기사 필기 합격 플랜)",
  "subjects": [
    { "key": "s1", "label": "과목명", "color": "#7C5CFC" }
  ],
  "schedule": [
    { "day": 1, "date": "YYYY-MM-DD", "subject": "s1", "topic": "오늘 공부할 내용 (구체적으로)" }
  ]
}

규칙:
- schedule의 date는 오늘(${today})부터 시험일(${examDate}) 하루 전까지 빠짐없이 채우세요
- 각 날짜마다 하나의 항목만 생성하세요
- topic은 한국어로 구체적으로 작성하세요
- subject는 반드시 subjects 배열의 key 중 하나여야 합니다
- subjects의 color는 #7C5CFC, #22C97A, #F7A34F, #FF6B6B, #38BDF8 등 각각 다른 색상으로 지정하세요`;

  // 상세 프롬프트 (세부 목차 포함 - 느림)
  const detailedPrompt = `당신은 한국의 시험 준비 전문 스터디 플래너입니다.
아래 정보를 바탕으로 최적의 공부 스케줄을 JSON으로 생성해주세요.

시험/공부 분야: ${field}
시험일: ${examDate}
하루 학습 시간: ${dailyHours}시간
기존 배경지식: ${background || "없음"}
추가 메모: ${notes || "없음"}
오늘 날짜: ${today}

아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "title": "플랜 제목 (예: 빅데이터분석기사 필기 합격 플랜)",
  "subjects": [
    { "key": "s1", "label": "과목명", "color": "#7C5CFC" }
  ],
  "schedule": [
    { 
      "day": 1, 
      "date": "YYYY-MM-DD", 
      "subject": "s1", 
      "topic": "오늘 공부할 내용 (구체적으로)",
      "subtasks": [
        "세부 학습 내용 1",
        "세부 학습 내용 2",
        "세부 학습 내용 3"
      ]
    }
  ]
}

규칙:
- schedule의 date는 오늘(${today})부터 시험일(${examDate}) 하루 전까지 빠짐없이 채우세요
- 각 날짜마다 하나의 항목만 생성하세요
- topic은 한국어로 구체적으로 작성하세요
- subject는 반드시 subjects 배열의 key 중 하나여야 합니다
- subjects의 color는 #7C5CFC, #22C97A, #F7A34F, #FF6B6B, #38BDF8 등 각각 다른 색상으로 지정하세요
- subtasks는 각 날짜별로 2~5개의 구체적인 세부 학습 항목을 배열로 작성하세요`;

  const prompt = includeSubtasks ? detailedPrompt : basicPrompt;

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
    const plan = JSON.parse(clean);

    return res.status(200).json(plan);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "플랜 생성 중 오류가 발생했습니다." });
  }
}
