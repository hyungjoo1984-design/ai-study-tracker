# 📚 AI 스터디 트래커

Claude AI가 만들어주는 맞춤 공부 스케줄러

## ✨ 주요 기능

- 🤖 **AI 스케줄 생성**: Claude AI가 시험 정보를 바탕으로 맞춤 학습 계획 생성
- 📊 **학습 추적**: 일별 진도 체크, 학습 시간 기록
- 📅 **캘린더**: 월간 일정 관리, D-Day 카운트다운
- 🏆 **달성 현황**: 배지 시스템, 시험 결과 기록
- 📝 **참고자료 & 퀴즈**: AI 퀴즈 자동 생성, 오답노트

---

## 🚀 배포 방법 (Vercel)

### Step 1: GitHub에 업로드

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-study-tracker.git
git push -u origin main
```

### Step 2: Vercel 배포

1. [vercel.com](https://vercel.com) 접속 → GitHub 로그인
2. "Add New Project" → 저장소 Import
3. **Deploy** 클릭

### Step 3: ⚠️ 환경 변수 설정 (중요!)

AI 기능을 사용하려면 Anthropic API 키가 필요합니다.

1. Vercel 대시보드 → 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 아래 변수 추가:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (본인 API 키) |

4. **Save** 클릭
5. **Deployments** → **Redeploy** 클릭 (환경 변수 적용)

### Anthropic API 키 발급 방법

1. [console.anthropic.com](https://console.anthropic.com) 접속
2. 회원가입/로그인
3. **API Keys** → **Create Key**
4. 키 복사 후 Vercel 환경 변수에 붙여넣기

---

## 💻 로컬 개발

```bash
# 의존성 설치
npm install

# 환경 변수 설정
echo "ANTHROPIC_API_KEY=your-api-key" > .env

# 개발 서버 실행
npm run dev
```

---

## 📁 프로젝트 구조

```
ai-study-tracker/
├── api/
│   ├── generate-plan.js    # 플랜 생성 API
│   └── generate-quiz.js    # 퀴즈 생성 API
├── src/
│   ├── App.jsx             # 메인 앱
│   └── main.jsx            # 엔트리
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

Made with ❤️ and Claude AI
