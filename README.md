# 📚 AI 스터디 트래커

Claude AI가 만들어주는 맞춤 공부 스케줄러

![AI Study Tracker](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)

## ✨ 주요 기능

### 📋 플랜 관리
- AI가 시험 정보를 바탕으로 맞춤 학습 스케줄 자동 생성
- 일별 학습 완료 체크 및 진도 추적
- D-Day 카운트다운

### 📊 성과 분석
- 총 학습 시간 및 완료일 통계
- 플랜별 진행률 시각화

### 📅 일정 관리
- 월간 캘린더 뷰
- 시험일 마커 및 리마인더 (D-7, D-3, D-1)
- 날짜별 학습 내용 상세보기

### 🏆 달성 현황
- 배지 시스템 (연속 학습, 시간 달성 등)
- 자격증 시험 결과 기록 (합격/불합격/점수)
- 합격 축하 UI

### 📝 학습 자료 & 퀴즈
- 참고자료 관리 (서적, PDF, URL, 영상, 메모)
- 플랜별 카테고리 카드로 자료 분류
- AI 퀴즈 자동 생성 (5지선다)
- 오답노트 자동 저장 및 복습

### ⚙️ 설정
- 닉네임/비밀번호 기반 계정 관리
- 데이터 로컬 저장

## 🚀 배포 방법 (Vercel)

### 방법 1: GitHub 연동 (권장)

1. **GitHub에 저장소 생성**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ai-study-tracker.git
   git push -u origin main
   ```

2. **Vercel에서 배포**
   - [vercel.com](https://vercel.com)에 로그인
   - "New Project" 클릭
   - GitHub 저장소 Import
   - Framework Preset: **Vite** 선택
   - "Deploy" 클릭

### 방법 2: Vercel CLI

1. **Vercel CLI 설치**
   ```bash
   npm install -g vercel
   ```

2. **프로젝트 빌드 및 배포**
   ```bash
   npm install
   npm run build
   vercel --prod
   ```

## 💻 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

## 🔧 환경 설정

### API 키 설정 (선택)

AI 퀴즈 생성 기능을 사용하려면 Anthropic API 키가 필요합니다.
현재는 클라이언트에서 직접 API를 호출하고 있어, 프로덕션 환경에서는 
백엔드 프록시 서버를 통해 API 키를 안전하게 관리하는 것을 권장합니다.

## 📁 프로젝트 구조

```
ai-study-tracker/
├── index.html          # HTML 엔트리
├── package.json        # 프로젝트 설정
├── vite.config.js      # Vite 설정
├── .gitignore
├── README.md
└── src/
    ├── main.jsx        # React 엔트리
    └── App.jsx         # 메인 컴포넌트
```

## 🛠 기술 스택

- **Frontend**: React 18
- **Build Tool**: Vite 5
- **Styling**: Inline CSS
- **Storage**: localStorage
- **AI**: Claude API (Anthropic)
- **Deployment**: Vercel

## 📱 반응형 디자인

모바일 우선 설계로 모든 기기에서 최적화된 경험을 제공합니다.

## 📄 라이센스

MIT License

---

Made with ❤️ and Claude AI
