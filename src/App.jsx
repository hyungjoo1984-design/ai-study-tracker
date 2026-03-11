import { useState, useEffect } from "react";

const DARK   = "#0E0E1A";
const ACCENT = "#7C5CFC";

const today       = () => new Date().toISOString().slice(0, 10);
const fmt         = (d) => d ? d.replace(/-/g, ".") : "";
const daysBetween = (a, b) => {
  if (!b) return 0;
  const diff = Math.ceil((new Date(b) - new Date(a)) / 86400000);
  return diff > 0 ? diff : 0;
};

const KEY_USERS   = "stt_users";
const KEY_SESSION = "stt_session";

// Storage functions using localStorage for web deployment
const loadUsers   = async () => { 
  try { 
    const data = localStorage.getItem(KEY_USERS);
    return data ? JSON.parse(data) : {}; 
  } catch { return {}; } 
};
const saveUsers   = async (u) => { 
  try { 
    localStorage.setItem(KEY_USERS, JSON.stringify(u)); 
  } catch {} 
};
const loadSession = async () => { 
  try { 
    return localStorage.getItem(KEY_SESSION) || null; 
  } catch { return null; } 
};
const saveSession = async (nick) => { 
  try { 
    if (nick) localStorage.setItem(KEY_SESSION, nick); 
    else localStorage.removeItem(KEY_SESSION); 
  } catch {} 
};

const hashPassword = async (pw) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
};

const generatePlan = async (form) => {
  const res = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      field: form.field,
      examDate: form.examDate,
      dailyHours: form.dailyHours,
      background: form.background,
      notes: form.notes,
      includeSubtasks: form.includeSubtasks || false,
      today: today()
    })
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "플랜 생성 실패");
  }
  
  return await res.json();
};

// Bottom Navigation Component
const BottomNav = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { key: "plan", label: "플랜", icon: "📋" },
    { key: "performance", label: "성과", icon: "📊" },
    { key: "calendar", label: "일정", icon: "📅" },
    { key: "achievement", label: "달성", icon: "🏆" },
    { key: "record", label: "기록", icon: "📝" },
    { key: "settings", label: "설정", icon: "⚙️" },
  ];

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#16162A",
      borderTop: "1px solid #2A2A45",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      padding: "8px 0 12px",
      zIndex: 100,
    }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 8px",
            borderRadius: 12,
            transition: "all 0.2s",
          }}
        >
          <span style={{
            fontSize: 20,
            filter: activeTab === tab.key ? "none" : "grayscale(100%)",
            opacity: activeTab === tab.key ? 1 : 0.5,
            transition: "all 0.2s",
          }}>
            {tab.icon}
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: activeTab === tab.key ? 700 : 500,
            color: activeTab === tab.key ? ACCENT : "#666",
            transition: "all 0.2s",
          }}>
            {tab.label}
          </span>
          {activeTab === tab.key && (
            <div style={{
              position: "absolute",
              bottom: 0,
              width: 20,
              height: 3,
              background: ACCENT,
              borderRadius: "3px 3px 0 0",
            }} />
          )}
        </button>
      ))}
    </div>
  );
};

export default function App() {
  const [screen,         setScreen]        = useState("loading");
  const [loginMode,      setLoginMode]     = useState("enter");
  const [nickInput,      setNickInput]     = useState("");
  const [pwInput,        setPwInput]       = useState("");
  const [pwConfirmInput, setPwConfirmInput]= useState("");
  const [showPw,         setShowPw]        = useState(false);
  const [showPwConfirm,  setShowPwConfirm] = useState(false);
  const [nickError,      setNickError]     = useState("");
  const [nickname,       setNickname]      = useState("");
  const [users,          setUsers]         = useState({});
  const [activePlanIdx,  setActivePlanIdx] = useState(0);
  const [logs,           setLogs]          = useState({});
  const [view,           setView]          = useState("schedule");
  const [expandedDay,    setExpandedDay]   = useState(null); // day number for expanded subtasks
  const [selectedDay,    setSelectedDay]   = useState(null);
  const [hoursInput,     setHoursInput]    = useState("1");
  const [noteInput,      setNoteInput]     = useState("");
  const [scoreInput,     setScoreInput]    = useState("");
  const [editingLog,     setEditingLog]    = useState(null);
  const [editHours,      setEditHours]     = useState("");
  const [editNote,       setEditNote]      = useState("");
  const [editScore,      setEditScore]     = useState("");
  const [deleteConfirmDay,  setDeleteConfirmDay]  = useState(null);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState(null);
  const [form,           setForm]          = useState({ field:"", examDate:"", dailyHours:"1", background:"", notes:"", includeSubtasks:false });
  const [creating,       setCreating]      = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [createElapsed,  setCreateElapsed]  = useState(0);
  const [createError,    setCreateError]   = useState("");
  const [activeTab,      setActiveTab]     = useState("plan");
  const [resultModal,    setResultModal]   = useState(null); // plan index for result recording
  const [resultForm,     setResultForm]    = useState({ resultDate:"", status:"waiting", score:"", certDate:"" });
  const [calendarMonth,  setCalendarMonth] = useState(new Date());
  const [selectedDate,   setSelectedDate]  = useState(null);
  
  // Record tab states
  const [recordView,     setRecordView]    = useState("materials"); // materials, quiz, wrongAnswers
  const [materials,      setMaterials]     = useState([]); // { id, title, type, url, planIdx, tags, notes, createdAt }
  const [materialModal,  setMaterialModal] = useState(null); // null or material object for editing
  const [materialForm,   setMaterialForm]  = useState({ title:"", type:"book", url:"", planIdx:-1, tags:"", notes:"", fileData:"", fileName:"", fileType:"" });
  const [quizSets,       setQuizSets]      = useState([]); // { id, planIdx, quizzes: [...], createdAt, results: { completed, correct, answers } }
  const [wrongAnswers,   setWrongAnswers]  = useState([]); // { setId, quizIdx, answeredAt, selectedAnswer }
  const [quizModal,      setQuizModal]     = useState(null); // null or "generate"
  const [quizMode,       setQuizMode]      = useState(null); // null or { setId, currentIdx, answers }
  const [generatingQuiz, setGeneratingQuiz]= useState(false);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState(-1); // -1 = all, index = specific plan
  const [expandedSetId,  setExpandedSetId] = useState(null); // for accordion
  const [editDateModal,  setEditDateModal] = useState(null); // { planIdx, currentDate }
  const [newExamDate,    setNewExamDate]   = useState("");
  const [updatingDate,   setUpdatingDate]  = useState(false);
  const [quizModalStep,  setQuizModalStep] = useState("selectPlan"); // "selectPlan" | "selectDays"
  const [selectedQuizPlanIdx, setSelectedQuizPlanIdx] = useState(null);
  const [selectedQuizDays, setSelectedQuizDays] = useState([]); // array of day numbers

  useEffect(() => {
    (async () => {
      const u = await loadUsers();
      setUsers(u);
      const sess = await loadSession();
      if (sess && u[sess]) { 
        setNickname(sess); 
        setMaterials(u[sess].materials || []);
        setQuizSets(u[sess].quizSets || []);
        setWrongAnswers(u[sess].wrongAnswers || []);
        setScreen("dashboard"); 
      }
      else setScreen("login");
    })();
  }, []);

  // Progress timer for plan creation
  useEffect(() => {
    if (!creating) {
      setCreateProgress(0);
      setCreateElapsed(0);
      return;
    }
    
    const estimatedTime = form.includeSubtasks ? 60 : 20; // seconds
    const interval = setInterval(() => {
      setCreateElapsed(prev => {
        const next = prev + 0.5;
        // Progress increases faster at start, slower near end
        const progress = Math.min(95, (next / estimatedTime) * 100);
        setCreateProgress(progress);
        return next;
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [creating, form.includeSubtasks]);

  const validatePassword = (pw) => {
    if (pw.length < 6)                   return "비밀번호는 6자 이상이어야 해요.";
    if (!/[a-zA-Zㄱ-ㅎ가-힣]/.test(pw)) return "문자(영문 또는 한글)를 포함해야 해요.";
    if (!/[0-9]/.test(pw))               return "숫자를 포함해야 해요.";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(pw)) return "특수문자(!@#$ 등)를 포함해야 해요.";
    return null;
  };

  const handleNickCheck = async () => {
    const nick = nickInput.trim();
    if (!nick)            { setNickError("닉네임을 입력해주세요."); return; }
    if (nick.length > 12) { setNickError("12자 이내로 입력해주세요."); return; }
    setNickError("");
    const u = await loadUsers();
    setLoginMode(u[nick] ? "existUser" : "newUser");
    setPwInput(""); setPwConfirmInput("");
  };

  const handleSignup = async () => {
    const pwError = validatePassword(pwInput);
    if (pwError)                    { setNickError(pwError); return; }
    if (pwInput !== pwConfirmInput) { setNickError("비밀번호가 일치하지 않아요."); return; }
    setNickError("");
    const nick = nickInput.trim();
    const hash = await hashPassword(pwInput);
    const u = await loadUsers();
    u[nick] = { passwordHash: hash, plans: [], materials: [], quizSets: [], wrongAnswers: [] };
    await saveUsers(u); setUsers(u);
    await saveSession(nick); setNickname(nick);
    setMaterials([]); setQuizSets([]); setWrongAnswers([]);
    setActiveTab("plan");
    setScreen("dashboard");
  };

  const handleLogin = async () => {
    if (!pwInput) { setNickError("비밀번호를 입력해주세요."); return; }
    const nick = nickInput.trim();
    const u = await loadUsers();
    const hash = await hashPassword(pwInput);
    if (u[nick]?.passwordHash !== hash) { setNickError("비밀번호가 틀렸어요. 다시 확인해주세요."); return; }
    setNickError(""); setUsers(u);
    await saveSession(nick); setNickname(nick);
    setMaterials(u[nick].materials || []);
    setQuizSets(u[nick].quizSets || []);
    setWrongAnswers(u[nick].wrongAnswers || []);
    setActiveTab("plan");
    setScreen("dashboard");
  };

  const handleLogout = async () => {
    await saveSession(null);
    setNickname(""); setNickInput(""); setPwInput(""); setPwConfirmInput("");
    setLoginMode("enter"); setScreen("login");
  };

  const resetToNickInput = () => { setLoginMode("enter"); setNickError(""); setPwInput(""); setPwConfirmInput(""); };

  const handleCreate = async () => {
    if (!form.field.trim())       { setCreateError("시험명을 입력해주세요."); return; }
    if (!form.examDate)           { setCreateError("시험일을 선택해주세요."); return; }
    if (form.examDate <= today()) { setCreateError("시험일은 오늘 이후여야 해요."); return; }
    setCreateError(""); setCreating(true);
    try {
      const plan = await generatePlan(form);
      plan.logs = {}; plan.createdAt = today(); plan.examDate = form.examDate;
      const u = await loadUsers();
      u[nickname].plans = [plan, ...(u[nickname].plans || [])];
      setUsers({ ...u }); await saveUsers(u);
      setActivePlanIdx(0); setLogs({}); setView("schedule");
      setActiveTab("plan");
      setScreen("dashboard");
    } catch (e) {
      setCreateError("플랜 생성 중 오류가 발생했어요. 다시 시도해주세요."); console.error(e);
    } finally { setCreating(false); }
  };

  const switchPlan = (idx) => {
    const p = (users[nickname]?.plans || [])[idx];
    if (!p) return;
    setActivePlanIdx(idx); setLogs(p.logs || {}); setView("schedule");
  };

  const deletePlan = async (idx) => {
    const u = await loadUsers();
    if (!u[nickname]?.plans) return;
    u[nickname].plans.splice(idx, 1);
    setUsers({ ...u }); await saveUsers(u);
    setDeleteConfirmPlan(null); setScreen("dashboard");
  };

  const updateExamDate = async () => {
    if (!editDateModal || !newExamDate) return;
    if (newExamDate <= today()) {
      alert("시험일은 오늘 이후여야 해요.");
      return;
    }
    
    setUpdatingDate(true);
    try {
      const plan = allPlans[editDateModal.planIdx];
      if (!plan) return;
      
      // AI로 새 스케줄 생성
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: plan.title,
          examDate: newExamDate,
          dailyHours: "1",
          background: "",
          notes: "기존 플랜 날짜 변경으로 인한 재생성",
          includeSubtasks: plan.schedule?.[0]?.subtasks?.length > 0
        })
      });
      
      if (!res.ok) throw new Error("스케줄 재생성 실패");
      
      const newPlan = await res.json();
      
      const u = await loadUsers();
      if (!u[nickname]?.plans?.[editDateModal.planIdx]) return;
      
      // 기존 플랜 업데이트 (제목 유지, 스케줄/날짜 변경, 기록 초기화)
      u[nickname].plans[editDateModal.planIdx] = {
        ...u[nickname].plans[editDateModal.planIdx],
        examDate: newExamDate,
        subjects: newPlan.subjects,
        schedule: newPlan.schedule,
        logs: {} // 학습 기록 초기화
      };
      
      await saveUsers(u);
      setUsers({ ...u });
      
      // 현재 보고 있는 플랜이면 logs도 초기화
      if (activePlanIdx === editDateModal.planIdx) {
        setLogs({});
      }
      
      setEditDateModal(null);
      setNewExamDate("");
      alert("시험일이 변경되고 스케줄이 재생성되었어요!");
    } catch (e) {
      console.error("Date update failed:", e);
      alert("날짜 변경 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setUpdatingDate(false);
    }
  };

  const openLog = (day) => {
    const ex = logs[day.day];
    setHoursInput(ex?.hours?.toString() || "1");
    setNoteInput(ex?.note || ""); setScoreInput(ex?.score || "");
    setSelectedDay(day);
  };

  const saveLog = async () => {
    if (!selectedDay) return;
    const updated = { ...logs, [selectedDay.day]: { done:true, hours:parseFloat(hoursInput)||1, note:noteInput, score:scoreInput, date:today() } };
    setLogs(updated);
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[activePlanIdx]) return;
    u[nickname].plans[activePlanIdx].logs = updated;
    await saveUsers(u); setUsers({ ...u }); setSelectedDay(null);
  };

  const startEdit = (day) => {
    const l = logs[day.day];
    setEditHours(l?.hours?.toString() || "1"); setEditNote(l?.note || ""); setEditScore(l?.score || "");
    setEditingLog(day);
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    const updated = { ...logs, [editingLog.day]: { ...logs[editingLog.day], hours:parseFloat(editHours)||1, note:editNote, score:editScore } };
    setLogs(updated);
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[activePlanIdx]) return;
    u[nickname].plans[activePlanIdx].logs = updated;
    await saveUsers(u); setUsers({ ...u }); setEditingLog(null);
  };

  const deleteLog = async (dayNum) => {
    const updated = { ...logs };
    delete updated[dayNum];
    setLogs(updated);
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[activePlanIdx]) return;
    u[nickname].plans[activePlanIdx].logs = updated;
    await saveUsers(u); setUsers({ ...u }); setDeleteConfirmDay(null);
  };

  // Subtask functions
  const toggleSubtask = async (dayNum, subtaskIdx) => {
    const currentLog = logs[dayNum] || {};
    const currentSubtasks = currentLog.subtasksDone || [];
    const newSubtasks = [...currentSubtasks];
    newSubtasks[subtaskIdx] = !newSubtasks[subtaskIdx];
    
    const updated = { 
      ...logs, 
      [dayNum]: { 
        ...currentLog, 
        subtasksDone: newSubtasks 
      } 
    };
    setLogs(updated);
    
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[activePlanIdx]) return;
    u[nickname].plans[activePlanIdx].logs = updated;
    await saveUsers(u); 
    setUsers({ ...u });
  };

  const toggleAllSubtasks = async (dayNum, subtasksLength, allChecked) => {
    const currentLog = logs[dayNum] || {};
    const newSubtasks = Array(subtasksLength).fill(!allChecked);
    
    const updated = { 
      ...logs, 
      [dayNum]: { 
        ...currentLog, 
        subtasksDone: newSubtasks 
      } 
    };
    setLogs(updated);
    
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[activePlanIdx]) return;
    u[nickname].plans[activePlanIdx].logs = updated;
    await saveUsers(u); 
    setUsers({ ...u });
  };

  const openResultModal = (planIdx) => {
    const p = allPlans[planIdx];
    if (p?.result) {
      setResultForm({
        resultDate: p.result.resultDate || "",
        status: p.result.status || "waiting",
        score: p.result.score || "",
        certDate: p.result.certDate || ""
      });
    } else {
      setResultForm({ resultDate:"", status:"waiting", score:"", certDate:"" });
    }
    setResultModal(planIdx);
  };

  const saveResult = async () => {
    if (resultModal === null) return;
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[resultModal]) return;
    u[nickname].plans[resultModal].result = { ...resultForm };
    await saveUsers(u);
    setUsers({ ...u });
    setResultModal(null);
  };

  const deleteResult = async (planIdx) => {
    const u = await loadUsers();
    if (!u[nickname]?.plans?.[planIdx]) return;
    delete u[nickname].plans[planIdx].result;
    await saveUsers(u);
    setUsers({ ...u });
  };

  // Materials & Quiz functions
  const loadUserData = async () => {
    const u = await loadUsers();
    if (u[nickname]) {
      setMaterials(u[nickname].materials || []);
      setQuizSets(u[nickname].quizSets || []);
      setWrongAnswers(u[nickname].wrongAnswers || []);
    }
  };

  const saveMaterial = async () => {
    const u = await loadUsers();
    if (!u[nickname]) return;
    
    const newMaterial = {
      id: materialModal?.id || Date.now(),
      title: materialForm.title,
      type: materialForm.type,
      url: materialForm.url,
      planIdx: materialForm.planIdx,
      tags: materialForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: materialForm.notes,
      fileData: materialForm.fileData || "",
      fileName: materialForm.fileName || "",
      fileType: materialForm.fileType || "",
      createdAt: materialModal?.createdAt || today()
    };
    
    let updatedMaterials;
    if (materialModal?.id) {
      updatedMaterials = materials.map(m => m.id === materialModal.id ? newMaterial : m);
    } else {
      updatedMaterials = [newMaterial, ...materials];
    }
    
    u[nickname].materials = updatedMaterials;
    await saveUsers(u);
    setMaterials(updatedMaterials);
    setMaterialModal(null);
    setMaterialForm({ title:"", type:"book", url:"", planIdx:-1, tags:"", notes:"", fileData:"", fileName:"", fileType:"" });
  };

  const deleteMaterial = async (id) => {
    const u = await loadUsers();
    if (!u[nickname]) return;
    const updatedMaterials = materials.filter(m => m.id !== id);
    u[nickname].materials = updatedMaterials;
    await saveUsers(u);
    setMaterials(updatedMaterials);
  };

  const deleteQuizSet = async (setId) => {
    const u = await loadUsers();
    if (!u[nickname]) return;
    const updatedSets = quizSets.filter(s => s.id !== setId);
    u[nickname].quizSets = updatedSets;
    await saveUsers(u);
    setQuizSets(updatedSets);
  };

  const generateAIQuiz = async (planIdx, selectedDays = []) => {
    setGeneratingQuiz(true);
    try {
      const plan = allPlans[planIdx];
      const planMaterials = materials.filter(m => m.planIdx === planIdx);
      
      // 선택한 날짜들의 topic 추출 (없으면 전체)
      let selectedTopics = "";
      if (selectedDays.length > 0 && plan?.schedule) {
        const topics = plan.schedule
          .filter(d => selectedDays.includes(d.day))
          .map(d => `- Day ${d.day}: ${d.topic}`)
          .join("\n");
        selectedTopics = topics;
      }
      
      // 기존 퀴즈 질문들 (중복 방지용)
      const existingQuestions = quizSets
        .filter(s => s.planIdx === planIdx)
        .flatMap(s => s.quizzes.map(q => q.question))
        .join("\n");
      
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTitle: plan?.title || "일반 학습",
          materials: planMaterials.map(m => `- ${m.title} (${m.type}): ${m.notes || "메모 없음"}`).join("\n") || "등록된 자료 없음",
          existingQuestions: existingQuestions,
          selectedTopics: selectedTopics
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "퀴즈 생성 실패");
      }
      
      const parsed = await res.json();
      
      const u = await loadUsers();
      if (!u[nickname]) return;
      
      // 새 퀴즈 세트 생성
      const newSet = {
        id: Date.now(),
        planIdx: planIdx,
        quizzes: parsed.quizzes.map((q, i) => ({
          question: q.question,
          options: q.options,
          answer: q.answer,
          source: q.source || "AI생성"
        })),
        createdAt: today(),
        topicLabel: selectedDays.length > 0 ? `Day ${selectedDays.join(", ")}` : "전체",
        results: null // { completed: true, correct: 7, answers: [...] }
      };
      
      const updatedSets = [newSet, ...quizSets];
      u[nickname].quizSets = updatedSets;
      await saveUsers(u);
      setQuizSets(updatedSets);
      setQuizModal(null);
      setQuizModalStep("selectPlan");
      setSelectedQuizPlanIdx(null);
      setSelectedQuizDays([]);
    } catch (e) {
      console.error("Quiz generation failed:", e);
      alert("퀴즈 생성 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const startQuizSet = (setId) => {
    const set = quizSets.find(s => s.id === setId);
    if (!set) return;
    setQuizMode({ setId, currentIdx: 0, answers: [], showResult: false });
  };

  const answerQuiz = async (selectedIdx) => {
    if (!quizMode) return;
    const set = quizSets.find(s => s.id === quizMode.setId);
    if (!set) return;
    
    const currentQuiz = set.quizzes[quizMode.currentIdx];
    const isCorrect = selectedIdx === currentQuiz.answer;
    
    const newAnswers = [...quizMode.answers, { selected: selectedIdx, correct: isCorrect }];
    
    // 오답 저장
    if (!isCorrect) {
      const u = await loadUsers();
      if (u[nickname]) {
        const newWrong = { setId: quizMode.setId, quizIdx: quizMode.currentIdx, answeredAt: today(), selectedAnswer: selectedIdx };
        const updatedWrong = [newWrong, ...(u[nickname].wrongAnswers || [])];
        u[nickname].wrongAnswers = updatedWrong;
        await saveUsers(u);
        setWrongAnswers(updatedWrong);
      }
    }
    
    if (quizMode.currentIdx < set.quizzes.length - 1) {
      setQuizMode({ ...quizMode, currentIdx: quizMode.currentIdx + 1, answers: newAnswers });
    } else {
      // 퀴즈 완료 - 결과 저장
      const correctCount = newAnswers.filter(a => a.correct).length;
      const u = await loadUsers();
      if (u[nickname]) {
        const updatedSets = quizSets.map(s => 
          s.id === quizMode.setId 
            ? { ...s, results: { completed: true, correct: correctCount, answers: newAnswers } }
            : s
        );
        u[nickname].quizSets = updatedSets;
        await saveUsers(u);
        setQuizSets(updatedSets);
      }
      setQuizMode({ ...quizMode, answers: newAnswers, showResult: true });
    }
  };

  const clearWrongAnswer = async (setId, quizIdx) => {
    const u = await loadUsers();
    if (!u[nickname]) return;
    const updatedWrong = wrongAnswers.filter(w => !(w.setId === setId && w.quizIdx === quizIdx));
    u[nickname].wrongAnswers = updatedWrong;
    await saveUsers(u);
    setWrongAnswers(updatedWrong);
  };

  const plans    = users[nickname]?.plans || [];
  const plan     = plans[activePlanIdx];
  const schedule = plan?.schedule || [];
  const subjects = plan?.subjects || [];
  const daysLeft = plan ? daysBetween(today(), plan.examDate) : 0;
  const totalDone  = Object.values(logs).filter(l => l?.done).length;
  const totalHours = Object.values(logs).reduce((s, l) => s + (l?.hours || 0), 0);
  const progress   = schedule.length ? Math.round((totalDone / schedule.length) * 100) : 0;
  const weekGroups = [];
  for (let i = 0; i < schedule.length; i += 7) weekGroups.push(schedule.slice(i, i + 7));

  // Calculate stats for all plans
  const allPlans = users[nickname]?.plans || [];
  const totalStudyHours  = allPlans.reduce((sum,p) => sum + Object.values(p.logs||{}).reduce((s,l) => s+(l?.hours||0),0), 0);
  const activePlansCount = allPlans.filter(p => daysBetween(today(), p.examDate) > 0).length;
  const totalCompletedDays = allPlans.reduce((sum,p) => sum + Object.values(p.logs||{}).filter(l=>l?.done).length, 0);

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (screen === "loading") return (
    <div style={{ minHeight:"100vh", background:DARK, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <div style={{ width:40, height:40, border:`3px solid ${ACCENT}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ color:"#666", fontSize:13 }}>불러오는 중...</div>
    </div>
  );

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (screen === "login") return (
    <div style={{ minHeight:"100vh", background:DARK, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 24px", fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📚</div>
          <div style={{ fontSize:24, fontWeight:800, color:"white", marginBottom:6 }}>AI 스터디 트래커</div>
          <div style={{ fontSize:13, color:"#555" }}>닉네임과 비밀번호로 내 기록을 안전하게 관리해요</div>
        </div>
        <div style={{ background:"#16162A", borderRadius:20, padding:"28px 24px", border:"1px solid #2A2A45" }}>

          {loginMode === "enter" && (<>
            <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:8 }}>닉네임</div>
            <input value={nickInput} onChange={e => { setNickInput(e.target.value); setNickError(""); }}
              onKeyDown={e => e.key === "Enter" && handleNickCheck()} placeholder="예: Amy, 스터디왕, 합격각"
              style={{ width:"100%", padding:"13px 16px", borderRadius:12, border:`1.5px solid ${nickError?"#E05555":"#2A2A45"}`, background:"#0E0E1A", color:"white", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
            {nickError && <div style={{ fontSize:11, color:"#E05555", marginBottom:8 }}>{nickError}</div>}
            <div style={{ fontSize:11, color:"#444", marginBottom:20, lineHeight:1.7 }}>처음 사용하면 계정이 자동 생성돼요.<br/>기존 닉네임 입력 시 비밀번호 확인 후 입장해요.</div>
            <button onClick={handleNickCheck} style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:15, cursor:"pointer" }}>다음 →</button>
          </>)}

          {loginMode === "newUser" && (<>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <button onClick={resetToNickInput} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:18, padding:0 }}>←</button>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"white" }}>👋 처음 오셨군요!</div>
                <div style={{ fontSize:11, color:"#556", marginTop:2 }}>닉네임 <strong style={{ color:ACCENT }}>'{nickInput}'</strong> 으로 계정을 만들게요.</div>
              </div>
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:7 }}>비밀번호 설정</div>
            <div style={{ position:"relative", marginBottom:10 }}>
              <input type={showPw?"text":"password"} value={pwInput} onChange={e => { setPwInput(e.target.value); setNickError(""); }} placeholder="문자+숫자+기호 조합 6자 이상"
                style={{ width:"100%", padding:"13px 44px 13px 16px", borderRadius:12, border:`1.5px solid ${nickError?"#E05555":"#2A2A45"}`, background:"#0E0E1A", color:"white", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <button onClick={() => setShowPw(p=>!p)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16, padding:0 }}>{showPw?"🙈":"👁"}</button>
            </div>
            {pwInput.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                {[
                  { label:"6자 이상",  ok: pwInput.length >= 6 },
                  { label:"문자 포함", ok: /[a-zA-Zㄱ-ㅎ가-힣]/.test(pwInput) },
                  { label:"숫자 포함", ok: /[0-9]/.test(pwInput) },
                  { label:"기호 포함", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(pwInput) },
                ].map(c => (
                  <div key={c.label} style={{ fontSize:10, fontWeight:600, padding:"3px 9px", borderRadius:99, background:c.ok?"#0D2A1A":"#1E1E2A", color:c.ok?"#22C97A":"#555", border:`1px solid ${c.ok?"#22C97A44":"#2A2A45"}`, transition:"all .2s" }}>{c.ok?"✓":"○"} {c.label}</div>
                ))}
              </div>
            )}
            <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:7 }}>비밀번호 확인</div>
            <div style={{ position:"relative", marginBottom:8 }}>
              <input type={showPwConfirm?"text":"password"} value={pwConfirmInput} onChange={e => { setPwConfirmInput(e.target.value); setNickError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSignup()} placeholder="비밀번호를 다시 입력해주세요"
                style={{ width:"100%", padding:"13px 44px 13px 16px", borderRadius:12, border:`1.5px solid ${nickError?"#E05555":"#2A2A45"}`, background:"#0E0E1A", color:"white", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <button onClick={() => setShowPwConfirm(p=>!p)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16, padding:0 }}>{showPwConfirm?"🙈":"👁"}</button>
            </div>
            {nickError && <div style={{ fontSize:11, color:"#E05555", marginBottom:8 }}>{nickError}</div>}
            <div style={{ fontSize:11, color:"#444", marginBottom:20, lineHeight:1.6 }}>⚠️ 비밀번호를 잊으면 계정 복구가 불가능해요.</div>
            <button onClick={handleSignup} style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:15, cursor:"pointer" }}>🎉 계정 만들고 시작하기</button>
          </>)}

          {loginMode === "existUser" && (<>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <button onClick={resetToNickInput} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:18, padding:0 }}>←</button>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"white" }}>🔐 반갑습니다!</div>
                <div style={{ fontSize:11, color:"#556", marginTop:2 }}><strong style={{ color:ACCENT }}>'{nickInput}'</strong> 님의 비밀번호를 입력해주세요.</div>
              </div>
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:7 }}>비밀번호</div>
            <div style={{ position:"relative", marginBottom:8 }}>
              <input type={showPw?"text":"password"} value={pwInput} onChange={e => { setPwInput(e.target.value); setNickError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="비밀번호 입력"
                style={{ width:"100%", padding:"13px 44px 13px 16px", borderRadius:12, border:`1.5px solid ${nickError?"#E05555":"#2A2A45"}`, background:"#0E0E1A", color:"white", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              <button onClick={() => setShowPw(p=>!p)} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16, padding:0 }}>{showPw?"🙈":"👁"}</button>
            </div>
            {nickError && <div style={{ fontSize:11, color:"#E05555", marginBottom:8 }}>{nickError}</div>}
            <div style={{ fontSize:11, color:"#444", marginBottom:20 }}>비밀번호를 잊으셨다면 관리자에게 문의해주세요.</div>
            <button onClick={handleLogin} style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:15, cursor:"pointer" }}>🔓 로그인</button>
          </>)}
        </div>
      </div>
    </div>
  );

  // ── DASHBOARD (with Bottom Navigation) ───────────────────────────────────
  if (screen === "dashboard") {
    return (
      <div style={{ minHeight:"100vh", background:DARK, fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif", paddingBottom:80 }}>
        
        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${DARK},#1A1035,#0D1A35)`, padding:"28px 24px 24px" }}>
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:3, color:"#556688", marginBottom:6, textTransform:"uppercase" }}>AI Study Tracker</div>
                <div style={{ fontSize:20, fontWeight:800, color:"white", marginBottom:3 }}>안녕하세요, {nickname} 님 👋</div>
                <div style={{ fontSize:12, color:"#556688" }}>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
              </div>
              <button onClick={handleLogout} style={{ fontSize:11, color:"#888", background:"#1E1E32", border:"1px solid #2A2A45", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>로그아웃</button>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              {[
                { label:"전체 플랜", value:allPlans.length,            unit:"개", color:"#A78BFA" },
                { label:"진행 중",   value:activePlansCount,           unit:"개", color:"#22C97A" },
                { label:"총 학습",   value:totalStudyHours.toFixed(1), unit:"h",  color:"#F7A34F" },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}<span style={{ fontSize:11, marginLeft:2 }}>{s.unit}</span></div>
                  <div style={{ fontSize:10, color:"#556688", marginTop:3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ maxWidth:680, margin:"0 auto", padding:"20px 20px 0" }}>
          
          {/* 플랜 탭 */}
          {activeTab === "plan" && (
            <>
              {allPlans.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 0" }}>
                  <div style={{ fontSize:44, marginBottom:14 }}>🎯</div>
                  <div style={{ fontSize:18, fontWeight:800, color:"white", marginBottom:8 }}>첫 스터디 플랜을 만들어봐요!</div>
                  <div style={{ fontSize:13, color:"#556", marginBottom:28, lineHeight:1.7 }}>시험 정보를 입력하면 Claude AI가<br/>맞춤 공부 스케줄을 자동으로 짜줘요.</div>
                  <button onClick={() => setScreen("create")} style={{ padding:"14px 32px", borderRadius:14, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>✨ 새 스터디 플랜 만들기</button>
                </div>
              ) : (<>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"white" }}>내 스터디 플랜</div>
                  <button onClick={() => setScreen("create")} style={{ fontSize:12, color:"#A78BFA", background:"#1E1035", border:"1px solid #3A2A60", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontWeight:600 }}>+ 새 플랜</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {allPlans.map((p,i) => {
                    const pLogs=p.logs||{}, pSchedule=p.schedule||[];
                    const pDone=Object.values(pLogs).filter(l=>l?.done).length;
                    const pHours=Object.values(pLogs).reduce((s,l)=>s+(l?.hours||0),0);
                    const pProgress=pSchedule.length?Math.round((pDone/pSchedule.length)*100):0;
                    const pDaysLeft=daysBetween(today(),p.examDate);
                    const isExpired=pDaysLeft===0, isUrgent=pDaysLeft>0&&pDaysLeft<=7;
                    const todayTask=pSchedule.find(d=>d.date===today()&&!pLogs[d.day]?.done);
                    const lastStudied=pSchedule.filter(d=>pLogs[d.day]?.done).sort((a,b)=>b.date.localeCompare(a.date))[0];
                    return (
                      <div key={i} style={{ background:"#16162A", borderRadius:16, padding:"18px 18px 16px", border:`1.5px solid ${isUrgent?"#FF6B6B33":isExpired?"#33333A":"#2A2A45"}`, cursor:"pointer" }}
                        onClick={() => { setActivePlanIdx(i); setLogs(p.logs||{}); setView("schedule"); setScreen("tracker"); }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                              <div style={{ fontSize:14, fontWeight:800, color:isExpired?"#555":"white", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                              {isExpired && <span style={{ fontSize:9, background:"#2A2A2A", color:"#555", borderRadius:99, padding:"2px 7px", fontWeight:700, flexShrink:0 }}>종료</span>}
                              {isUrgent  && <span style={{ fontSize:9, background:"#FF6B6B22", color:"#FF6B6B", borderRadius:99, padding:"2px 7px", fontWeight:700, flexShrink:0 }}>D-{pDaysLeft}</span>}
                            </div>
                            <div style={{ fontSize:11, color:"#445566", display:"flex", alignItems:"center", gap:6 }}>
                              시험일 {fmt(p.examDate)}
                              <button 
                                onClick={e => { e.stopPropagation(); setEditDateModal({ planIdx: i, currentDate: p.examDate }); setNewExamDate(p.examDate); }}
                                style={{ background:"none", border:"none", color:"#667799", cursor:"pointer", padding:0, fontSize:12 }}>
                                ✏️
                              </button>
                              {!isExpired&&<span style={{ color:isUrgent?"#FF6B6B":"#6677AA" }}>· D-{pDaysLeft}</span>}
                            </div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, marginLeft:12, flexShrink:0 }}>
                            <button onClick={e => { e.stopPropagation(); setDeleteConfirmPlan(i); }}
                              style={{ fontSize:10, color:"#E05555", background:"#2A1010", border:"1px solid #FF444422", borderRadius:7, padding:"3px 8px", cursor:"pointer", fontWeight:600 }}>🗑 삭제</button>
                            <div style={{ position:"relative", width:48, height:48 }}>
                              <svg width="48" height="48" style={{ transform:"rotate(-90deg)" }}>
                                <circle cx="24" cy="24" r="19" fill="none" stroke="#2A2A45" strokeWidth="4"/>
                                <circle cx="24" cy="24" r="19" fill="none" stroke={isExpired?"#333":ACCENT} strokeWidth="4"
                                  strokeDasharray={`${2*Math.PI*19}`} strokeDashoffset={`${2*Math.PI*19*(1-pProgress/100)}`}
                                  strokeLinecap="round" style={{ transition:"stroke-dashoffset .5s" }}/>
                              </svg>
                              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:isExpired?"#444":"#A78BFA" }}>{pProgress}%</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ background:"#0E0E1A", borderRadius:99, height:5, overflow:"hidden", marginBottom:12 }}>
                          <div style={{ background:`linear-gradient(90deg,${ACCENT},#A78BFA)`, height:"100%", width:`${pProgress}%`, borderRadius:99, transition:"width .5s", opacity:isExpired?0.3:1 }}/>
                        </div>
                        <div style={{ display:"flex" }}>
                          {[
                            { icon:"✅", label:"완료",   value:`${pDone}/${pSchedule.length}일` },
                            { icon:"⏱", label:"학습",   value:`${pHours.toFixed(1)}h` },
                            { icon:"📅", label:"마지막", value:lastStudied?fmt(lastStudied.date):"없음" },
                          ].map((s,si) => (
                            <div key={si} style={{ flex:1, textAlign:"center", borderLeft:si>0?"1px solid #1E1E2A":"none", paddingLeft:si>0?8:0 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:isExpired?"#444":"#CCC" }}>{s.value}</div>
                              <div style={{ fontSize:10, color:"#445566", marginTop:2 }}>{s.icon} {s.label}</div>
                            </div>
                          ))}
                        </div>
                        {todayTask && (
                          <div style={{ marginTop:12, background:"#1A1A30", borderRadius:9, padding:"8px 11px", borderLeft:`3px solid ${ACCENT}` }}>
                            <div style={{ fontSize:10, color:"#667799", marginBottom:2 }}>📌 오늘 할 일</div>
                            <div style={{ fontSize:12, color:"#CCC", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{todayTask.topic}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>)}
            </>
          )}

          {/* 성과 탭 */}
          {activeTab === "performance" && (
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:20 }}>📊 나의 학습 성과</div>
              
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                <div style={{ background:"#16162A", borderRadius:16, padding:"20px", textAlign:"center", border:"1px solid #2A2A45" }}>
                  <div style={{ fontSize:32, fontWeight:800, color:"#22C97A" }}>{totalStudyHours.toFixed(1)}</div>
                  <div style={{ fontSize:12, color:"#667799", marginTop:4 }}>총 학습 시간</div>
                </div>
                <div style={{ background:"#16162A", borderRadius:16, padding:"20px", textAlign:"center", border:"1px solid #2A2A45" }}>
                  <div style={{ fontSize:32, fontWeight:800, color:"#F7A34F" }}>{totalCompletedDays}</div>
                  <div style={{ fontSize:12, color:"#667799", marginTop:4 }}>완료한 학습일</div>
                </div>
              </div>

              <div style={{ background:"#16162A", borderRadius:16, padding:"20px", border:"1px solid #2A2A45", marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:16 }}>플랜별 학습 현황</div>
                {allPlans.length === 0 ? (
                  <div style={{ textAlign:"center", color:"#556", padding:"20px 0" }}>아직 플랜이 없어요</div>
                ) : (
                  allPlans.map((p, i) => {
                    const pLogs = p.logs || {};
                    const pSchedule = p.schedule || [];
                    const pHours = Object.values(pLogs).reduce((s,l)=>s+(l?.hours||0),0);
                    const pProgress = pSchedule.length ? Math.round((Object.values(pLogs).filter(l=>l?.done).length / pSchedule.length) * 100) : 0;
                    return (
                      <div key={i} style={{ marginBottom:i < allPlans.length - 1 ? 12 : 0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                          <span style={{ fontSize:12, color:"#CCC", fontWeight:600 }}>{p.title}</span>
                          <span style={{ fontSize:11, color:"#A78BFA" }}>{pHours.toFixed(1)}h</span>
                        </div>
                        <div style={{ background:"#0E0E1A", borderRadius:99, height:6, overflow:"hidden" }}>
                          <div style={{ background:`linear-gradient(90deg,${ACCENT},#A78BFA)`, height:"100%", width:`${pProgress}%`, borderRadius:99 }}/>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 일정 탭 (캘린더) */}
          {activeTab === "calendar" && (() => {
            // Calendar helper functions
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const todayStr = today();
            
            // Get all events for the month
            const getEventsForDate = (dateStr) => {
              const events = { exams: [], studies: [], reminders: [] };
              allPlans.forEach((p, idx) => {
                // Check if it's exam date
                if (p.examDate === dateStr) {
                  events.exams.push({ plan: p, idx });
                }
                // Check for study completion
                const schedule = p.schedule || [];
                const logs = p.logs || {};
                schedule.forEach(s => {
                  if (s.date === dateStr && logs[s.day]?.done) {
                    events.studies.push({ plan: p, day: s, log: logs[s.day], idx });
                  }
                });
                // Check for reminders (D-7, D-3, D-1)
                const daysUntilExam = daysBetween(dateStr, p.examDate);
                if ([7, 3, 1].includes(daysUntilExam) && dateStr >= todayStr) {
                  events.reminders.push({ plan: p, daysLeft: daysUntilExam, idx });
                }
              });
              return events;
            };
            
            // Find closest upcoming exam
            const upcomingExams = allPlans
              .filter(p => p.examDate >= todayStr)
              .sort((a, b) => a.examDate.localeCompare(b.examDate));
            const closestExam = upcomingExams[0];
            const closestDaysLeft = closestExam ? daysBetween(todayStr, closestExam.examDate) : null;
            
            // Calculate monthly stats
            const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
            let monthlyStudyDays = 0;
            let monthlyStudyHours = 0;
            allPlans.forEach(p => {
              const schedule = p.schedule || [];
              const logs = p.logs || {};
              schedule.forEach(s => {
                if (s.date >= monthStart && s.date <= monthEnd && logs[s.day]?.done) {
                  monthlyStudyDays++;
                  monthlyStudyHours += logs[s.day]?.hours || 0;
                }
              });
            });
            
            // Generate calendar days
            const calendarDays = [];
            for (let i = 0; i < firstDay; i++) calendarDays.push(null);
            for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
            
            return (
              <div>
                {/* D-Day Widget */}
                {closestExam && (
                  <div style={{
                    background: closestDaysLeft <= 7 
                      ? "linear-gradient(135deg, #FF6B6B, #FF8E8E)" 
                      : "linear-gradient(135deg, #7C5CFC, #A78BFA)",
                    borderRadius: 20,
                    padding: "20px",
                    marginBottom: 20,
                    position: "relative",
                    overflow: "hidden"
                  }}>
                    <div style={{ position:"absolute", top:10, right:15, fontSize:40, opacity:0.2 }}>🎯</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginBottom:4 }}>가장 가까운 시험</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:8, paddingRight:50 }}>{closestExam.title}</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                      <span style={{ fontSize:36, fontWeight:800, color:"white" }}>D-{closestDaysLeft}</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)" }}>{fmt(closestExam.examDate)}</span>
                    </div>
                    {closestDaysLeft <= 7 && (
                      <div style={{ marginTop:10, fontSize:11, color:"rgba(255,255,255,0.9)", background:"rgba(0,0,0,0.2)", padding:"6px 10px", borderRadius:8, display:"inline-block" }}>
                        ⚡ 시험이 얼마 남지 않았어요!
                      </div>
                    )}
                  </div>
                )}
                
                {/* Monthly Summary */}
                <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                  <div style={{ flex:1, background:"#16162A", borderRadius:14, padding:"14px", textAlign:"center", border:"1px solid #2A2A45" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:"#22C97A" }}>{monthlyStudyDays}</div>
                    <div style={{ fontSize:10, color:"#667799", marginTop:2 }}>이번 달 학습일</div>
                  </div>
                  <div style={{ flex:1, background:"#16162A", borderRadius:14, padding:"14px", textAlign:"center", border:"1px solid #2A2A45" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:"#F7A34F" }}>{monthlyStudyHours.toFixed(1)}h</div>
                    <div style={{ fontSize:10, color:"#667799", marginTop:2 }}>이번 달 학습시간</div>
                  </div>
                  <div style={{ flex:1, background:"#16162A", borderRadius:14, padding:"14px", textAlign:"center", border:"1px solid #2A2A45" }}>
                    <div style={{ fontSize:22, fontWeight:800, color:"#A78BFA" }}>{upcomingExams.length}</div>
                    <div style={{ fontSize:10, color:"#667799", marginTop:2 }}>예정된 시험</div>
                  </div>
                </div>

                {/* Calendar */}
                <div style={{ background:"#16162A", borderRadius:20, padding:"20px", border:"1px solid #2A2A45" }}>
                  {/* Month Navigation */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                    <button onClick={() => setCalendarMonth(new Date(year, month - 1))}
                      style={{ background:"#0E0E1A", border:"1px solid #2A2A45", borderRadius:10, padding:"8px 14px", color:"#888", cursor:"pointer", fontSize:14 }}>
                      ←
                    </button>
                    <div style={{ fontSize:16, fontWeight:800, color:"white" }}>
                      {year}년 {month + 1}월
                    </div>
                    <button onClick={() => setCalendarMonth(new Date(year, month + 1))}
                      style={{ background:"#0E0E1A", border:"1px solid #2A2A45", borderRadius:10, padding:"8px 14px", color:"#888", cursor:"pointer", fontSize:14 }}>
                      →
                    </button>
                  </div>
                  
                  {/* Weekday Headers */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4, marginBottom:8 }}>
                    {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                      <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:600, color: i === 0 ? "#FF6B6B" : i === 6 ? "#38BDF8" : "#667799", padding:"6px 0" }}>
                        {d}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4 }}>
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={i} />;
                      
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isToday = dateStr === todayStr;
                      const events = getEventsForDate(dateStr);
                      const hasExam = events.exams.length > 0;
                      const hasStudy = events.studies.length > 0;
                      const hasReminder = events.reminders.length > 0;
                      const dayOfWeek = (firstDay + day - 1) % 7;
                      
                      return (
                        <button
                          key={i}
                          onClick={() => (hasExam || hasStudy || hasReminder) && setSelectedDate({ dateStr, events })}
                          style={{
                            aspectRatio: "1",
                            background: isToday ? ACCENT : hasExam ? "#FF6B6B22" : "transparent",
                            border: hasExam ? "2px solid #FF6B6B" : hasReminder ? "2px dashed #F7A34F" : "none",
                            borderRadius: 12,
                            cursor: (hasExam || hasStudy || hasReminder) ? "pointer" : "default",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2,
                            position: "relative",
                            transition: "all 0.2s",
                          }}
                        >
                          <span style={{
                            fontSize: 13,
                            fontWeight: isToday ? 800 : 500,
                            color: isToday ? "white" : dayOfWeek === 0 ? "#FF6B6B" : dayOfWeek === 6 ? "#38BDF8" : "#CCC"
                          }}>
                            {day}
                          </span>
                          {/* Event Dots */}
                          <div style={{ display:"flex", gap:2, height:6 }}>
                            {hasExam && <div style={{ width:6, height:6, borderRadius:"50%", background:"#FF6B6B" }} />}
                            {hasStudy && <div style={{ width:6, height:6, borderRadius:"50%", background:"#22C97A" }} />}
                            {hasReminder && !hasExam && <div style={{ width:6, height:6, borderRadius:"50%", background:"#F7A34F" }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Legend */}
                  <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:16, paddingTop:16, borderTop:"1px solid #2A2A45" }}>
                    {[
                      { color:"#FF6B6B", label:"시험일" },
                      { color:"#22C97A", label:"학습완료" },
                      { color:"#F7A34F", label:"리마인더" },
                    ].map(l => (
                      <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:l.color }} />
                        <span style={{ fontSize:10, color:"#667799" }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming Exams List */}
                {upcomingExams.length > 0 && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:12 }}>📌 다가오는 시험</div>
                    {upcomingExams.slice(0, 3).map((p, i) => {
                      const dLeft = daysBetween(todayStr, p.examDate);
                      const isUrgent = dLeft <= 7;
                      return (
                        <div key={i} style={{
                          background:"#16162A",
                          borderRadius:14,
                          padding:"14px 16px",
                          marginBottom:8,
                          border:`1.5px solid ${isUrgent ? "#FF6B6B44" : "#2A2A45"}`,
                          display:"flex",
                          justifyContent:"space-between",
                          alignItems:"center"
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"white", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                            <div style={{ fontSize:11, color:"#667799", marginTop:2 }}>{fmt(p.examDate)}</div>
                          </div>
                          <div style={{
                            background: isUrgent ? "#FF6B6B22" : "#A78BFA22",
                            color: isUrgent ? "#FF6B6B" : "#A78BFA",
                            fontSize:12,
                            fontWeight:700,
                            padding:"6px 12px",
                            borderRadius:99,
                            flexShrink:0,
                            marginLeft:12
                          }}>
                            D-{dLeft}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 달성 탭 */}
          {activeTab === "achievement" && (
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:20 }}>🏆 달성 현황</div>
              
              {/* 합격 축하 섹션 */}
              {(() => {
                const passedPlans = allPlans.filter(p => p.result?.status === "passed");
                if (passedPlans.length > 0) {
                  return (
                    <div style={{ marginBottom:24 }}>
                      {/* 축하 헤더 */}
                      <div style={{ 
                        background: "linear-gradient(135deg, #FFD700, #FFA500)", 
                        borderRadius: 20, 
                        padding: "24px 20px", 
                        textAlign: "center",
                        marginBottom: 16,
                        position: "relative",
                        overflow: "hidden"
                      }}>
                        <div style={{ position:"absolute", top:10, left:20, fontSize:24, opacity:0.3 }}>✨</div>
                        <div style={{ position:"absolute", top:15, right:25, fontSize:20, opacity:0.3 }}>🎊</div>
                        <div style={{ position:"absolute", bottom:10, left:30, fontSize:18, opacity:0.3 }}>🎉</div>
                        <div style={{ position:"absolute", bottom:15, right:20, fontSize:22, opacity:0.3 }}>⭐</div>
                        <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
                        <div style={{ fontSize:18, fontWeight:800, color:"#1A1A2E" }}>축하합니다!</div>
                        <div style={{ fontSize:13, color:"#5A4A00", marginTop:4 }}>
                          {passedPlans.length}개의 자격증에 합격하셨어요!
                        </div>
                      </div>
                      
                      {/* 합격 자격증 목록 */}
                      <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:12 }}>🏅 취득 자격증</div>
                      {passedPlans.map((p, i) => (
                        <div key={i} style={{
                          background: "linear-gradient(135deg, #1A2035, #1E2845)",
                          borderRadius: 16,
                          padding: "16px 18px",
                          marginBottom: 10,
                          border: "1.5px solid #3A4A70",
                          display: "flex",
                          alignItems: "center",
                          gap: 14
                        }}>
                          <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #FFD700, #FFA500)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                            flexShrink: 0
                          }}>🏆</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:"white", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {p.title}
                            </div>
                            <div style={{ fontSize:11, color:"#8899AA" }}>
                              {p.result?.certDate && `취득일: ${fmt(p.result.certDate)}`}
                              {p.result?.score && ` · 점수: ${p.result.score}`}
                            </div>
                          </div>
                          <div style={{
                            background: "#22C97A22",
                            color: "#22C97A",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 99,
                            flexShrink: 0
                          }}>합격</div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}

              {/* 시험 결과 기록 섹션 */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:12 }}>📋 시험 결과 기록</div>
                {allPlans.length === 0 ? (
                  <div style={{ background:"#16162A", borderRadius:16, padding:"30px 20px", textAlign:"center", border:"1px solid #2A2A45" }}>
                    <div style={{ fontSize:13, color:"#556" }}>아직 플랜이 없어요</div>
                  </div>
                ) : (
                  allPlans.map((p, i) => {
                    const result = p.result;
                    const statusColors = {
                      waiting: { bg:"#F7A34F22", color:"#F7A34F", label:"대기중" },
                      passed: { bg:"#22C97A22", color:"#22C97A", label:"합격" },
                      failed: { bg:"#E0555522", color:"#E05555", label:"불합격" }
                    };
                    const statusInfo = statusColors[result?.status] || statusColors.waiting;
                    
                    return (
                      <div key={i} style={{
                        background: "#16162A",
                        borderRadius: 14,
                        padding: "14px 16px",
                        marginBottom: 10,
                        border: `1.5px solid ${result?.status === "passed" ? "#22C97A44" : "#2A2A45"}`
                      }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {p.title}
                            </div>
                            {result ? (
                              <div style={{ fontSize:11, color:"#667799", lineHeight:1.8 }}>
                                {result.resultDate && <div>📅 발표일: {fmt(result.resultDate)}</div>}
                                {result.score && <div>📊 점수: {result.score}</div>}
                                {result.certDate && <div>🎓 취득일: {fmt(result.certDate)}</div>}
                              </div>
                            ) : (
                              <div style={{ fontSize:11, color:"#556" }}>아직 결과를 기록하지 않았어요</div>
                            )}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0, marginLeft:12 }}>
                            {result && (
                              <div style={{
                                background: statusInfo.bg,
                                color: statusInfo.color,
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "4px 10px",
                                borderRadius: 99
                              }}>{statusInfo.label}</div>
                            )}
                            <button 
                              onClick={() => openResultModal(i)}
                              style={{
                                fontSize: 11,
                                color: ACCENT,
                                background: "#1E1035",
                                border: "1px solid #3A2A60",
                                borderRadius: 8,
                                padding: "5px 10px",
                                cursor: "pointer",
                                fontWeight: 600
                              }}
                            >
                              {result ? "수정" : "결과 기록"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* 배지 섹션 */}
              <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:12 }}>🎖 학습 배지</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginBottom:20 }}>
                {[
                  { icon:"🔥", label:"연속 학습", value:`${Math.min(totalCompletedDays, 7)}일`, unlocked: totalCompletedDays >= 1 },
                  { icon:"📚", label:"첫 플랜", value:"완료", unlocked: allPlans.length >= 1 },
                  { icon:"⏰", label:"10시간", value:`${totalStudyHours >= 10 ? "달성" : `${totalStudyHours.toFixed(1)}h`}`, unlocked: totalStudyHours >= 10 },
                  { icon:"🎯", label:"5일 완료", value:`${totalCompletedDays}/5`, unlocked: totalCompletedDays >= 5 },
                  { icon:"💪", label:"30시간", value:`${totalStudyHours >= 30 ? "달성" : `${totalStudyHours.toFixed(1)}h`}`, unlocked: totalStudyHours >= 30 },
                  { icon:"🏅", label:"첫 합격", value: allPlans.some(p => p.result?.status === "passed") ? "달성" : "도전중", unlocked: allPlans.some(p => p.result?.status === "passed") },
                ].map((badge, i) => (
                  <div key={i} style={{
                    background: badge.unlocked ? "#1A2035" : "#16162A",
                    borderRadius: 16,
                    padding: "16px 12px",
                    textAlign: "center",
                    border: `1.5px solid ${badge.unlocked ? "#3A4A70" : "#2A2A45"}`,
                    opacity: badge.unlocked ? 1 : 0.5,
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 6, filter: badge.unlocked ? "none" : "grayscale(100%)" }}>{badge.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: badge.unlocked ? "white" : "#555" }}>{badge.label}</div>
                    <div style={{ fontSize: 10, color: badge.unlocked ? "#A78BFA" : "#444", marginTop: 2 }}>{badge.value}</div>
                  </div>
                ))}
              </div>

              {/* 전체 달성률 */}
              <div style={{ background:"#16162A", borderRadius:16, padding:"20px", border:"1px solid #2A2A45" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:12 }}>전체 달성률</div>
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ position:"relative", width:80, height:80 }}>
                    <svg width="80" height="80" style={{ transform:"rotate(-90deg)" }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#2A2A45" strokeWidth="6"/>
                      <circle cx="40" cy="40" r="34" fill="none" stroke={ACCENT} strokeWidth="6"
                        strokeDasharray={`${2*Math.PI*34}`} 
                        strokeDashoffset={`${2*Math.PI*34*(1-([totalCompletedDays >= 1, allPlans.length >= 1, totalStudyHours >= 10, totalCompletedDays >= 5, totalStudyHours >= 30, allPlans.some(p => p.result?.status === "passed")].filter(Boolean).length / 6))}`}
                        strokeLinecap="round"/>
                    </svg>
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#A78BFA" }}>
                      {Math.round(([totalCompletedDays >= 1, allPlans.length >= 1, totalStudyHours >= 10, totalCompletedDays >= 5, totalStudyHours >= 30, allPlans.some(p => p.result?.status === "passed")].filter(Boolean).length / 6) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:24, fontWeight:800, color:"white" }}>{[totalCompletedDays >= 1, allPlans.length >= 1, totalStudyHours >= 10, totalCompletedDays >= 5, totalStudyHours >= 30, allPlans.some(p => p.result?.status === "passed")].filter(Boolean).length}/6</div>
                    <div style={{ fontSize:12, color:"#667799" }}>배지 획득</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 기록 탭 */}
          {activeTab === "record" && (
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:16 }}>📝 학습 자료 & 퀴즈</div>
              
              {/* 플랜별 카테고리 카드 */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:10, marginBottom:4 }}>
                  {/* 전체 카드 */}
                  <div 
                    onClick={() => setSelectedPlanFilter(-1)}
                    style={{
                      minWidth: 140,
                      background: selectedPlanFilter === -1 ? `linear-gradient(135deg, ${ACCENT}, #A78BFA)` : "#16162A",
                      borderRadius: 16,
                      padding: "16px",
                      cursor: "pointer",
                      border: selectedPlanFilter === -1 ? "none" : "1px solid #2A2A45",
                      transition: "all 0.2s",
                      flexShrink: 0
                    }}>
                    <div style={{ fontSize:24, marginBottom:8 }}>📚</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:6 }}>전체 보기</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ fontSize:10, color: selectedPlanFilter === -1 ? "rgba(255,255,255,0.8)" : "#667799" }}>
                        📄 {materials.length}
                      </span>
                      <span style={{ fontSize:10, color: selectedPlanFilter === -1 ? "rgba(255,255,255,0.8)" : "#667799" }}>
                        ❓ {quizSets.reduce((sum, s) => sum + s.quizzes.length, 0)}
                      </span>
                    </div>
                  </div>
                  
                  {/* 플랜별 카드 */}
                  {allPlans.map((p, pi) => {
                    const planMaterialCount = materials.filter(m => m.planIdx === pi).length;
                    const planQuizCount = quizSets.filter(s => s.planIdx === pi).reduce((sum, s) => sum + s.quizzes.length, 0);
                    const planColors = ["#7C5CFC", "#22C97A", "#F7A34F", "#FF6B6B", "#38BDF8", "#E879F9"];
                    const cardColor = planColors[pi % planColors.length];
                    
                    return (
                      <div 
                        key={pi}
                        onClick={() => setSelectedPlanFilter(pi)}
                        style={{
                          minWidth: 160,
                          background: selectedPlanFilter === pi ? `linear-gradient(135deg, ${cardColor}, ${cardColor}CC)` : "#16162A",
                          borderRadius: 16,
                          padding: "16px",
                          cursor: "pointer",
                          border: selectedPlanFilter === pi ? "none" : "1px solid #2A2A45",
                          transition: "all 0.2s",
                          flexShrink: 0,
                          position: "relative",
                          overflow: "hidden"
                        }}>
                        {selectedPlanFilter === pi && (
                          <div style={{ position:"absolute", top:8, right:8, background:"rgba(255,255,255,0.3)", borderRadius:99, padding:"2px 6px", fontSize:9, color:"white", fontWeight:700 }}>
                            선택됨
                          </div>
                        )}
                        <div style={{ 
                          width:32, 
                          height:32, 
                          borderRadius:10, 
                          background: selectedPlanFilter === pi ? "rgba(255,255,255,0.2)" : `${cardColor}22`,
                          display:"flex", 
                          alignItems:"center", 
                          justifyContent:"center",
                          marginBottom:10
                        }}>
                          <span style={{ fontSize:16 }}>📋</span>
                        </div>
                        <div style={{ 
                          fontSize:12, 
                          fontWeight:700, 
                          color:"white", 
                          marginBottom:6,
                          overflow:"hidden",
                          textOverflow:"ellipsis",
                          whiteSpace:"nowrap"
                        }}>
                          {p.title}
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                          <span style={{ 
                            fontSize:10, 
                            color: selectedPlanFilter === pi ? "rgba(255,255,255,0.8)" : "#667799",
                            background: selectedPlanFilter === pi ? "rgba(255,255,255,0.15)" : "#0E0E1A",
                            padding:"2px 6px",
                            borderRadius:99
                          }}>
                            📄 {planMaterialCount}
                          </span>
                          <span style={{ 
                            fontSize:10, 
                            color: selectedPlanFilter === pi ? "rgba(255,255,255,0.8)" : "#667799",
                            background: selectedPlanFilter === pi ? "rgba(255,255,255,0.15)" : "#0E0E1A",
                            padding:"2px 6px",
                            borderRadius:99
                          }}>
                            ❓ {planQuizCount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 미분류 카드 - 참고자료만 */}
                  {(() => {
                    const unlinkedMaterials = materials.filter(m => m.planIdx === -1).length;
                    if (unlinkedMaterials === 0) return null;
                    return (
                      <div 
                        onClick={() => setSelectedPlanFilter(-2)}
                        style={{
                          minWidth: 140,
                          background: selectedPlanFilter === -2 ? "linear-gradient(135deg, #667799, #556688)" : "#16162A",
                          borderRadius: 16,
                          padding: "16px",
                          cursor: "pointer",
                          border: selectedPlanFilter === -2 ? "none" : "1px solid #2A2A45",
                          transition: "all 0.2s",
                          flexShrink: 0
                        }}>
                        <div style={{ fontSize:24, marginBottom:8 }}>📁</div>
                        <div style={{ fontSize:13, fontWeight:700, color:"white", marginBottom:6 }}>미분류</div>
                        <div style={{ display:"flex", gap:8 }}>
                          <span style={{ fontSize:10, color: selectedPlanFilter === -2 ? "rgba(255,255,255,0.8)" : "#667799" }}>
                            📄 {unlinkedMaterials}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ fontSize:10, color:"#556", textAlign:"center" }}>← 스와이프하여 플랜 선택 →</div>
              </div>

              {/* Sub-tabs */}
              <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                {[
                  { key:"materials", label:"📚 참고자료", count: selectedPlanFilter === -1 ? materials.length : selectedPlanFilter === -2 ? materials.filter(m => m.planIdx === -1).length : materials.filter(m => m.planIdx === selectedPlanFilter).length },
                  { key:"quiz", label:"❓ 퀴즈", count: selectedPlanFilter === -1 ? quizSets.length : selectedPlanFilter >= 0 ? quizSets.filter(s => s.planIdx === selectedPlanFilter).length : 0 },
                  { key:"wrongAnswers", label:"📕 오답노트", count: wrongAnswers.length },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setRecordView(tab.key)}
                    style={{
                      flex:1,
                      padding:"10px 8px",
                      borderRadius:12,
                      border:"none",
                      cursor:"pointer",
                      fontWeight:600,
                      fontSize:11,
                      background: recordView === tab.key ? ACCENT : "#16162A",
                      color: recordView === tab.key ? "white" : "#888",
                      position:"relative"
                    }}>
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{
                        position:"absolute",
                        top:-4,
                        right:-4,
                        background:"#FF6B6B",
                        color:"white",
                        fontSize:9,
                        fontWeight:700,
                        padding:"2px 5px",
                        borderRadius:99
                      }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* 참고자료 섹션 */}
              {recordView === "materials" && (
                <div>
                  <button onClick={() => { setMaterialForm({ title:"", type:"book", url:"", planIdx: selectedPlanFilter >= 0 ? selectedPlanFilter : -1, tags:"", notes:"", fileData:"", fileName:"", fileType:"" }); setMaterialModal({}); }}
                    style={{ width:"100%", padding:"14px", borderRadius:14, border:"2px dashed #3A2A60", background:"transparent", color:"#A78BFA", fontWeight:600, fontSize:13, cursor:"pointer", marginBottom:16 }}>
                    + 새 참고자료 추가 {selectedPlanFilter >= 0 && `(${allPlans[selectedPlanFilter]?.title})`}
                  </button>
                  
                  {(() => {
                    const filteredMaterials = selectedPlanFilter === -1 
                      ? materials 
                      : selectedPlanFilter === -2 
                        ? materials.filter(m => m.planIdx === -1)
                        : materials.filter(m => m.planIdx === selectedPlanFilter);
                    
                    if (filteredMaterials.length === 0) {
                      return (
                        <div style={{ textAlign:"center", padding:"40px 0", color:"#556" }}>
                          <div style={{ fontSize:40, marginBottom:12 }}>📚</div>
                          <div style={{ fontSize:13 }}>
                            {selectedPlanFilter >= 0 
                              ? `"${allPlans[selectedPlanFilter]?.title}"에 등록된 자료가 없어요`
                              : selectedPlanFilter === -2
                                ? "미분류 자료가 없어요"
                                : "등록된 참고자료가 없어요"}
                          </div>
                          <div style={{ fontSize:11, color:"#444", marginTop:4 }}>서적, PDF, URL 등을 추가해보세요</div>
                        </div>
                      );
                    }
                    
                    return filteredMaterials.map(m => {
                      const linkedPlan = m.planIdx >= 0 ? allPlans[m.planIdx] : null;
                      return (
                        <div key={m.id} style={{ background:"#16162A", borderRadius:14, padding:"16px", marginBottom:10, border:"1px solid #2A2A45" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                <span style={{ fontSize:20 }}>
                                  {m.type === "book" ? "📖" : m.type === "pdf" ? "📄" : m.type === "url" ? "🔗" : m.type === "video" ? "🎬" : "📝"}
                                </span>
                                <div style={{ fontSize:14, fontWeight:700, color:"white" }}>{m.title}</div>
                              </div>
                              {selectedPlanFilter === -1 && linkedPlan && (
                                <div style={{ fontSize:10, color:"#A78BFA", marginBottom:6, background:"#1A1A30", padding:"4px 8px", borderRadius:6, display:"inline-block" }}>
                                  📋 {linkedPlan.title}
                                </div>
                              )}
                              {m.url && (
                                <div style={{ fontSize:11, color:"#667799", marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  🔗 {m.url}
                                </div>
                              )}
                              {m.fileData && (
                                <div style={{ marginBottom:8 }}>
                                  {/* 이미지 미리보기 */}
                                  {m.fileType?.includes("image") && (
                                    <div style={{ marginBottom:8 }}>
                                      <img 
                                        src={m.fileData} 
                                        alt={m.fileName} 
                                        style={{ width:"100%", maxHeight:150, objectFit:"cover", borderRadius:8, cursor:"pointer" }}
                                        onClick={() => window.open(m.fileData, '_blank')}
                                      />
                                    </div>
                                  )}
                                  {/* 파일 정보 및 다운로드 */}
                                  <div style={{ display:"flex", alignItems:"center", gap:8, background:"#0E0E1A", padding:"8px 10px", borderRadius:8 }}>
                                    <span style={{ fontSize:14 }}>
                                      {m.fileType?.includes("pdf") ? "📄" : "🖼️"}
                                    </span>
                                    <span style={{ fontSize:11, color:"#888", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                      {m.fileName}
                                    </span>
                                    <a 
                                      href={m.fileData} 
                                      download={m.fileName}
                                      style={{ fontSize:10, color:"#22C97A", background:"#0D2A1A", border:"none", borderRadius:6, padding:"4px 8px", textDecoration:"none", cursor:"pointer" }}>
                                      다운로드
                                    </a>
                                  </div>
                                </div>
                              )}
                              {m.notes && (
                                <div style={{ fontSize:12, color:"#888", marginBottom:8, lineHeight:1.5 }}>{m.notes}</div>
                              )}
                              {m.tags?.length > 0 && (
                                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                  {m.tags.map((tag, ti) => (
                                    <span key={ti} style={{ fontSize:10, background:"#2A2A45", color:"#A78BFA", padding:"3px 8px", borderRadius:99 }}>#{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:10 }}>
                              <button onClick={() => { setMaterialForm({ title:m.title, type:m.type, url:m.url, planIdx:m.planIdx, tags:m.tags?.join(", ")||"", notes:m.notes, fileData:m.fileData||"", fileName:m.fileName||"", fileType:m.fileType||"" }); setMaterialModal(m); }}
                                style={{ fontSize:10, color:"#A78BFA", background:"#1E1035", border:"none", borderRadius:7, padding:"5px 8px", cursor:"pointer" }}>수정</button>
                              <button onClick={() => deleteMaterial(m.id)}
                                style={{ fontSize:10, color:"#E05555", background:"#2A1010", border:"none", borderRadius:7, padding:"5px 8px", cursor:"pointer" }}>삭제</button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* 퀴즈 섹션 */}
              {recordView === "quiz" && !quizMode && (
                <div>
                  {/* AI 생성 버튼 */}
                  <button onClick={() => { setQuizModalStep("selectPlan"); setSelectedQuizPlanIdx(null); setSelectedQuizDays([]); setQuizModal("generate"); }}
                    style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:16 }}>
                    🤖 AI 퀴즈 생성 (10문제)
                  </button>
                  
                  {(() => {
                    const filteredSets = selectedPlanFilter === -1 
                      ? quizSets 
                      : quizSets.filter(s => s.planIdx === selectedPlanFilter);
                    
                    if (filteredSets.length === 0) {
                      return (
                        <div style={{ textAlign:"center", padding:"40px 0", color:"#556" }}>
                          <div style={{ fontSize:40, marginBottom:12 }}>❓</div>
                          <div style={{ fontSize:13 }}>
                            {selectedPlanFilter >= 0 
                              ? `"${allPlans[selectedPlanFilter]?.title}"에 퀴즈 세트가 없어요`
                              : "퀴즈 세트가 없어요"}
                          </div>
                          <div style={{ fontSize:11, color:"#444", marginTop:4 }}>AI 생성 버튼을 눌러 퀴즈를 만들어보세요</div>
                        </div>
                      );
                    }
                    
                    return (
                      <div>
                        {/* 재생성 버튼 */}
                        {selectedPlanFilter >= 0 && (
                          <button 
                            onClick={() => { 
                              setSelectedQuizPlanIdx(selectedPlanFilter); 
                              setSelectedQuizDays([]); 
                              setQuizModalStep("selectDays"); 
                              setQuizModal("generate"); 
                            }}
                            disabled={generatingQuiz}
                            style={{ 
                              width:"100%", 
                              padding:"14px", 
                              borderRadius:12, 
                              border:"1.5px solid #7C5CFC", 
                              background: generatingQuiz ? "#333" : "transparent", 
                              color: generatingQuiz ? "#888" : "#A78BFA", 
                              fontWeight:600, 
                              fontSize:13, 
                              cursor: generatingQuiz ? "not-allowed" : "pointer",
                              marginBottom:16,
                              display:"flex",
                              alignItems:"center",
                              justifyContent:"center",
                              gap:8
                            }}>
                            {generatingQuiz ? (
                              <>
                                <div style={{ width:16, height:16, border:"2px solid #A78BFA", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
                                새 퀴즈 생성 중...
                              </>
                            ) : (
                              "🔄 새 퀴즈 세트 생성 (범위 선택)"
                            )}
                          </button>
                        )}
                        
                        <div style={{ fontSize:11, color:"#667799", marginBottom:12 }}>
                          총 {filteredSets.length}개 세트 · {filteredSets.reduce((sum, s) => sum + s.quizzes.length, 0)}문제
                        </div>
                        
                        {/* 세트 목록 - 아코디언 */}
                        {filteredSets.map((set, si) => {
                          const isExpanded = expandedSetId === set.id;
                          const linkedPlan = set.planIdx >= 0 ? allPlans[set.planIdx] : null;
                          const hasResult = set.results?.completed;
                          const correctCount = set.results?.correct || 0;
                          const totalCount = set.quizzes.length;
                          
                          return (
                            <div key={set.id} style={{ marginBottom:10 }}>
                              {/* 세트 헤더 */}
                              <div 
                                onClick={() => setExpandedSetId(isExpanded ? null : set.id)}
                                style={{ 
                                  background:"#16162A", 
                                  borderRadius: isExpanded ? "14px 14px 0 0" : "14px", 
                                  padding:"16px", 
                                  border:"1px solid #2A2A45",
                                  borderBottom: isExpanded ? "none" : "1px solid #2A2A45",
                                  cursor:"pointer",
                                  transition:"all 0.2s"
                                }}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                      <span style={{ fontSize:14, fontWeight:700, color:"white" }}>📝 세트 {filteredSets.length - si}</span>
                                      {hasResult ? (
                                        <span style={{ 
                                          fontSize:11, 
                                          fontWeight:700, 
                                          padding:"3px 8px", 
                                          borderRadius:99, 
                                          background: correctCount >= totalCount * 0.8 ? "#0D2A1A" : correctCount >= totalCount * 0.5 ? "#2A2A10" : "#2A1010",
                                          color: correctCount >= totalCount * 0.8 ? "#22C97A" : correctCount >= totalCount * 0.5 ? "#F7A34F" : "#FF6B6B"
                                        }}>
                                          {correctCount}/{totalCount} 맞춤
                                        </span>
                                      ) : (
                                        <span style={{ fontSize:10, color:"#667799", background:"#1A1A30", padding:"3px 8px", borderRadius:99 }}>
                                          ⏳ 미풀이
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize:11, color:"#667799" }}>
                                      {linkedPlan && <span style={{ color:"#A78BFA" }}>📋 {linkedPlan.title} · </span>}
                                      {set.topicLabel && <span style={{ color:"#22C97A" }}>📚 {set.topicLabel} · </span>}
                                      {set.createdAt?.replace(/-/g, ".")} 생성
                                    </div>
                                  </div>
                                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); startQuizSet(set.id); }}
                                      style={{ fontSize:11, color:"white", background:"#22C97A", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:600 }}>
                                      {hasResult ? "다시 풀기" : "풀기"}
                                    </button>
                                    <span style={{ fontSize:16, color:"#667799", transition:"transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* 문제 목록 (아코디언 펼침) */}
                              {isExpanded && (
                                <div style={{ 
                                  background:"#0E0E1A", 
                                  borderRadius:"0 0 14px 14px", 
                                  border:"1px solid #2A2A45",
                                  borderTop:"none",
                                  padding:"12px"
                                }}>
                                  {set.quizzes.map((q, qi) => {
                                    const answered = set.results?.answers?.[qi];
                                    return (
                                      <div key={qi} style={{ 
                                        background:"#16162A", 
                                        borderRadius:10, 
                                        padding:"12px 14px", 
                                        marginBottom: qi < set.quizzes.length - 1 ? 8 : 0,
                                        borderLeft: answered ? `3px solid ${answered.correct ? "#22C97A" : "#FF6B6B"}` : "3px solid #2A2A45"
                                      }}>
                                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                                          <div style={{ flex:1 }}>
                                            <div style={{ fontSize:12, fontWeight:600, color:"white", marginBottom:4 }}>
                                              Q{qi + 1}. {q.question}
                                            </div>
                                            {q.source && (
                                              <div style={{ fontSize:9, color:"#556" }}>📚 {q.source}</div>
                                            )}
                                          </div>
                                          {answered && (
                                            <span style={{ fontSize:16, marginLeft:8, flexShrink:0 }}>
                                              {answered.correct ? "✅" : "❌"}
                                            </span>
                                          )}
                                        </div>
                                        {answered && !answered.correct && (
                                          <div style={{ marginTop:8, padding:"8px 10px", background:"#0D1A10", borderRadius:6, fontSize:11 }}>
                                            <div style={{ color:"#FF6B6B", marginBottom:2 }}>내 답: {q.options[answered.selected]}</div>
                                            <div style={{ color:"#22C97A" }}>정답: {q.options[q.answer]}</div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  
                                  {/* 삭제 버튼 */}
                                  <button 
                                    onClick={() => deleteQuizSet(set.id)}
                                    style={{ width:"100%", marginTop:12, padding:"10px", borderRadius:8, border:"1px solid #FF6B6B33", background:"#2A1010", color:"#FF6B6B", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                                    🗑 이 세트 삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* 퀴즈 풀이 모드 */}
              {recordView === "quiz" && quizMode && !quizMode.showResult && (
                <div>
                  {(() => {
                    const set = quizSets.find(s => s.id === quizMode.setId);
                    if (!set) return null;
                    const currentQuiz = set.quizzes[quizMode.currentIdx];
                    if (!currentQuiz) return null;
                    
                    return (
                      <div style={{ background:"#16162A", borderRadius:20, padding:"24px 20px", border:"1px solid #2A2A45" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                          <span style={{ fontSize:12, color:"#667799" }}>문제 {quizMode.currentIdx + 1} / {set.quizzes.length}</span>
                          <button onClick={() => setQuizMode(null)} style={{ fontSize:11, color:"#888", background:"none", border:"none", cursor:"pointer" }}>✕ 종료</button>
                        </div>
                        <div style={{ background:"#0E0E1A", borderRadius:99, height:4, marginBottom:24 }}>
                          <div style={{ background:ACCENT, height:"100%", width:`${((quizMode.currentIdx + 1) / set.quizzes.length) * 100}%`, borderRadius:99, transition:"width 0.3s" }} />
                        </div>
                        <div style={{ fontSize:16, fontWeight:700, color:"white", marginBottom:24, lineHeight:1.6 }}>
                          {currentQuiz.question}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          {currentQuiz.options.map((opt, oi) => (
                            <button key={oi} onClick={() => answerQuiz(oi)}
                              style={{
                                width:"100%",
                                padding:"14px 16px",
                                borderRadius:12,
                                border:"1.5px solid #2A2A45",
                                background:"#0E0E1A",
                                color:"white",
                                fontSize:13,
                                textAlign:"left",
                                cursor:"pointer",
                                transition:"all 0.2s"
                              }}>
                              <span style={{ color:"#A78BFA", fontWeight:700, marginRight:10 }}>{oi + 1}</span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 퀴즈 결과 */}
              {recordView === "quiz" && quizMode?.showResult && (
                <div style={{ textAlign:"center" }}>
                  {(() => {
                    const set = quizSets.find(s => s.id === quizMode.setId);
                    if (!set) return null;
                    const correctCount = quizMode.answers.filter(a => a.correct).length;
                    const totalCount = set.quizzes.length;
                    const percentage = Math.round((correctCount / totalCount) * 100);
                    
                    return (
                      <>
                        <div style={{ background:"linear-gradient(135deg, #1A2035, #1E2845)", borderRadius:20, padding:"30px 24px", border:"1px solid #3A4A70", marginBottom:20 }}>
                          <div style={{ fontSize:48, marginBottom:12 }}>
                            {percentage >= 80 ? "🎉" : percentage >= 50 ? "👍" : "💪"}
                          </div>
                          <div style={{ fontSize:20, fontWeight:800, color:"white", marginBottom:8 }}>퀴즈 완료!</div>
                          <div style={{ fontSize:32, fontWeight:800, color: percentage >= 80 ? "#22C97A" : percentage >= 50 ? "#F7A34F" : "#FF6B6B" }}>
                            {correctCount} / {totalCount}
                          </div>
                          <div style={{ fontSize:13, color:"#667799", marginTop:8 }}>
                            정답률 {percentage}%
                          </div>
                        </div>
                        
                        {/* 틀린 문제 요약 */}
                        {quizMode.answers.some(a => !a.correct) && (
                          <div style={{ background:"#16162A", borderRadius:16, padding:"16px", marginBottom:20, border:"1px solid #2A2A45", textAlign:"left" }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"#FF6B6B", marginBottom:12 }}>❌ 틀린 문제</div>
                            {quizMode.answers.map((ans, idx) => {
                              if (ans.correct) return null;
                              const q = set.quizzes[idx];
                              return (
                                <div key={idx} style={{ fontSize:12, color:"#888", marginBottom:8, padding:"10px", background:"#0E0E1A", borderRadius:8 }}>
                                  <div style={{ color:"white", marginBottom:4 }}>Q{idx + 1}. {q.question}</div>
                                  <div style={{ color:"#FF6B6B", fontSize:11, marginBottom:2 }}>내 답: {q.options[ans.selected]}</div>
                                  <div style={{ color:"#22C97A", fontSize:11 }}>정답: {q.options[q.answer]}</div>
                                </div>
                              );
                            })}
                            <div style={{ fontSize:11, color:"#667799", marginTop:8 }}>💡 오답노트에 자동 저장되었어요</div>
                          </div>
                        )}
                        
                        <div style={{ display:"flex", gap:10 }}>
                          <button onClick={() => { setQuizMode(null); startQuizSet(set.id); }}
                            style={{ flex:1, padding:"14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"transparent", color:"#A78BFA", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                            다시 풀기
                          </button>
                          <button onClick={() => setQuizMode(null)}
                            style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:ACCENT, color:"white", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                            확인
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 오답노트 섹션 */}
              {recordView === "wrongAnswers" && (
                <div>
                  {wrongAnswers.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"40px 0", color:"#556" }}>
                      <div style={{ fontSize:40, marginBottom:12 }}>📕</div>
                      <div style={{ fontSize:13 }}>오답이 없어요!</div>
                      <div style={{ fontSize:11, color:"#444", marginTop:4 }}>퀴즈를 풀고 틀린 문제를 복습하세요</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize:11, color:"#667799", marginBottom:12 }}>
                        총 {wrongAnswers.length}개 오답
                      </div>
                      
                      {wrongAnswers.map((wrong, wi) => {
                        const set = quizSets.find(s => s.id === wrong.setId);
                        if (!set) return null;
                        const q = set.quizzes[wrong.quizIdx];
                        if (!q) return null;
                        const linkedPlan = set.planIdx >= 0 ? allPlans[set.planIdx] : null;
                        
                        return (
                          <div key={wi} style={{ background:"#16162A", borderRadius:14, padding:"16px", marginBottom:10, border:"1px solid #FF6B6B33" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                              <div style={{ flex:1 }}>
                                {linkedPlan && (
                                  <div style={{ fontSize:9, color:"#A78BFA", marginBottom:6 }}>📋 {linkedPlan.title}</div>
                                )}
                                <div style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:8 }}>{q.question}</div>
                                <div style={{ fontSize:12, color:"#FF6B6B", marginBottom:4 }}>✗ 내 답: {q.options[wrong.selectedAnswer]}</div>
                                <div style={{ fontSize:12, color:"#22C97A", marginBottom:6 }}>✓ 정답: {q.options[q.answer]}</div>
                                <div style={{ fontSize:10, color:"#556" }}>{wrong.answeredAt?.replace(/-/g, ".")}</div>
                              </div>
                              <button onClick={() => clearWrongAnswer(wrong.setId, wrong.quizIdx)}
                                style={{ fontSize:10, color:"#22C97A", background:"#0D2A1A", border:"1px solid #22C97A44", borderRadius:7, padding:"5px 10px", cursor:"pointer", flexShrink:0, marginLeft:10 }}>
                                ✓ 완료
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 설정 탭 */}
          {activeTab === "settings" && (
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:20 }}>⚙️ 설정</div>
              
              <div style={{ background:"#16162A", borderRadius:16, padding:"20px", border:"1px solid #2A2A45", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
                    {nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:"white" }}>{nickname}</div>
                    <div style={{ fontSize:12, color:"#667799", marginTop:2 }}>플랜 {allPlans.length}개 · 총 {totalStudyHours.toFixed(1)}시간 학습</div>
                  </div>
                </div>
              </div>

              <div style={{ background:"#16162A", borderRadius:16, border:"1px solid #2A2A45", overflow:"hidden", marginBottom:16 }}>
                {[
                  { icon:"📋", label:"새 플랜 만들기", action:() => setScreen("create") },
                  { icon:"📊", label:"학습 통계", action:() => setActiveTab("performance") },
                  { icon:"🏆", label:"달성 현황", action:() => setActiveTab("achievement") },
                  { icon:"📚", label:"참고자료 관리", action:() => { setActiveTab("record"); setRecordView("materials"); } },
                  { icon:"❓", label:"퀴즈 관리", action:() => { setActiveTab("record"); setRecordView("quiz"); } },
                ].map((item, i) => (
                  <button key={i} onClick={item.action} style={{
                    width:"100%",
                    display:"flex",
                    alignItems:"center",
                    gap:12,
                    padding:"16px 20px",
                    background:"none",
                    border:"none",
                    borderTop:i>0?"1px solid #2A2A45":"none",
                    cursor:"pointer",
                    textAlign:"left",
                  }}>
                    <span style={{ fontSize:18 }}>{item.icon}</span>
                    <span style={{ fontSize:14, color:"white", fontWeight:500 }}>{item.label}</span>
                    <span style={{ marginLeft:"auto", color:"#555" }}>→</span>
                  </button>
                ))}
              </div>

              <div style={{ background:"#16162A", borderRadius:16, padding:"16px", border:"1px solid #2A2A45", marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:12 }}>📊 내 데이터</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div style={{ background:"#0E0E1A", borderRadius:10, padding:"12px", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:800, color:"#A78BFA" }}>{materials.length}</div>
                    <div style={{ fontSize:10, color:"#667799" }}>참고자료</div>
                  </div>
                  <div style={{ background:"#0E0E1A", borderRadius:10, padding:"12px", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:800, color:"#22C97A" }}>{quizSets.reduce((sum, s) => sum + s.quizzes.length, 0)}</div>
                    <div style={{ fontSize:10, color:"#667799" }}>퀴즈</div>
                  </div>
                </div>
              </div>

              <button onClick={handleLogout} style={{
                width:"100%",
                padding:"16px 0",
                borderRadius:14,
                border:"1px solid #E0555544",
                background:"#1A1010",
                color:"#E05555",
                fontWeight:700,
                fontSize:14,
                cursor:"pointer",
              }}>
                🚪 로그아웃
              </button>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Delete Plan Confirm Modal */}
        {deleteConfirmPlan !== null && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }}
            onClick={() => setDeleteConfirmPlan(null)}>
            <div style={{ background:"#16162A", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:340, textAlign:"center", border:"1px solid #2A2A45" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:36, marginBottom:12 }}>⚠️</div>
              <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:8 }}>플랜을 삭제할까요?</div>
              <div style={{ fontSize:13, color:"#FF6B6B", marginBottom:6, fontWeight:600 }}>{allPlans[deleteConfirmPlan]?.title}</div>
              <div style={{ fontSize:12, color:"#445566", marginBottom:24, lineHeight:1.6 }}>모든 학습 기록이 영구 삭제되며<br/>복구할 수 없어요.</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setDeleteConfirmPlan(null)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"1px solid #2A2A45", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>취소</button>
                <button onClick={() => deletePlan(deleteConfirmPlan)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", background:"#E05555", color:"white", fontWeight:700, cursor:"pointer", fontSize:13 }}>삭제</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Date Modal (Dashboard) */}
        {editDateModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }} onClick={()=>!updatingDate && setEditDateModal(null)}>
            <div style={{ background:"#16162A", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:380, textAlign:"center", border:"1px solid #2A2A45" }} onClick={e=>e.stopPropagation()}>
              {updatingDate ? (
                <>
                  <div style={{ width:48, height:48, border:`3px solid ${ACCENT}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 20px" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ fontSize:15, fontWeight:700, color:"white", marginBottom:8 }}>스케줄 재생성 중...</div>
                  <div style={{ fontSize:12, color:"#667799", lineHeight:1.6 }}>AI가 새 날짜에 맞춰<br/>학습 스케줄을 다시 만들고 있어요</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
                  <div style={{ fontSize:16, fontWeight:800, color:"white", marginBottom:6 }}>시험일 변경</div>
                  <div style={{ fontSize:12, color:"#667799", marginBottom:20, lineHeight:1.6 }}>
                    새 날짜에 맞춰 AI가 스케줄을 재생성해요.<br/>
                    <span style={{ color:"#FF6B6B" }}>⚠️ 기존 학습 기록은 초기화됩니다.</span>
                  </div>
                  
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, color:"#667799", marginBottom:6, textAlign:"left" }}>현재 시험일: {fmt(editDateModal.currentDate)}</div>
                    <input 
                      type="date" 
                      value={newExamDate} 
                      onChange={e => setNewExamDate(e.target.value)}
                      min={new Date(Date.now() + 86400000).toISOString().slice(0,10)}
                      style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #2A2A45", background:"#0E0E1A", color:"white", fontSize:14, outline:"none", boxSizing:"border-box", colorScheme:"dark" }} 
                    />
                  </div>
                  
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={()=>setEditDateModal(null)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"1px solid #2A2A45", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>취소</button>
                    <button 
                      onClick={updateExamDate} 
                      disabled={!newExamDate || newExamDate === editDateModal.currentDate}
                      style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", background: (newExamDate && newExamDate !== editDateModal.currentDate) ? ACCENT : "#333", color:"white", fontWeight:700, cursor: (newExamDate && newExamDate !== editDateModal.currentDate) ? "pointer" : "not-allowed", fontSize:13 }}>
                      변경하기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Result Recording Modal */}
        {resultModal !== null && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }}
            onClick={() => setResultModal(null)}>
            <div style={{ background:"#16162A", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:400, border:"1px solid #2A2A45" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:18, fontWeight:800, color:"white", marginBottom:6 }}>📋 시험 결과 기록</div>
              <div style={{ fontSize:12, color:"#667799", marginBottom:20, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {allPlans[resultModal]?.title}
              </div>
              
              {/* 합격 여부 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>합격 여부 *</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { key:"waiting", label:"대기중", icon:"⏳", color:"#F7A34F" },
                    { key:"passed", label:"합격", icon:"🎉", color:"#22C97A" },
                    { key:"failed", label:"불합격", icon:"😢", color:"#E05555" },
                  ].map(s => (
                    <button key={s.key} onClick={() => setResultForm(f => ({ ...f, status: s.key }))}
                      style={{
                        flex:1,
                        padding:"12px 8px",
                        borderRadius:12,
                        cursor:"pointer",
                        fontWeight:600,
                        fontSize:12,
                        background: resultForm.status === s.key ? `${s.color}22` : "#0E0E1A",
                        color: resultForm.status === s.key ? s.color : "#666",
                        border: `1.5px solid ${resultForm.status === s.key ? s.color : "#2A2A45"}`,
                        transition: "all 0.2s"
                      }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 결과 발표일 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>📅 결과 발표일</div>
                <input 
                  type="date" 
                  value={resultForm.resultDate} 
                  onChange={e => setResultForm(f => ({ ...f, resultDate: e.target.value }))}
                  style={{ 
                    width:"100%", 
                    padding:"12px 14px", 
                    borderRadius:12, 
                    border:"1.5px solid #2A2A45", 
                    background:"#0E0E1A", 
                    color:"white", 
                    fontSize:13, 
                    outline:"none", 
                    boxSizing:"border-box" 
                  }} 
                />
              </div>

              {/* 점수 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>📊 점수</div>
                <input 
                  type="text" 
                  value={resultForm.score} 
                  onChange={e => setResultForm(f => ({ ...f, score: e.target.value }))}
                  placeholder="예: 85점, 750점, Pass"
                  style={{ 
                    width:"100%", 
                    padding:"12px 14px", 
                    borderRadius:12, 
                    border:"1.5px solid #2A2A45", 
                    background:"#0E0E1A", 
                    color:"white", 
                    fontSize:13, 
                    outline:"none", 
                    boxSizing:"border-box" 
                  }} 
                />
              </div>

              {/* 자격증 취득일 (합격 시에만 표시) */}
              {resultForm.status === "passed" && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>🎓 자격증 취득일</div>
                  <input 
                    type="date" 
                    value={resultForm.certDate} 
                    onChange={e => setResultForm(f => ({ ...f, certDate: e.target.value }))}
                    style={{ 
                      width:"100%", 
                      padding:"12px 14px", 
                      borderRadius:12, 
                      border:"1.5px solid #2A2A45", 
                      background:"#0E0E1A", 
                      color:"white", 
                      fontSize:13, 
                      outline:"none", 
                      boxSizing:"border-box" 
                    }} 
                  />
                </div>
              )}

              {/* 버튼 */}
              <div style={{ display:"flex", gap:10, marginTop:24 }}>
                <button onClick={() => setResultModal(null)} 
                  style={{ flex:1, padding:"14px 0", borderRadius:12, border:"1px solid #2A2A45", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>
                  취소
                </button>
                {allPlans[resultModal]?.result && (
                  <button onClick={() => { deleteResult(resultModal); setResultModal(null); }} 
                    style={{ padding:"14px 16px", borderRadius:12, border:"none", background:"#E0555522", color:"#E05555", fontWeight:600, cursor:"pointer", fontSize:13 }}>
                    삭제
                  </button>
                )}
                <button onClick={saveResult} 
                  style={{ flex:2, padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, cursor:"pointer", fontSize:13 }}>
                  저장하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date Detail Modal */}
        {selectedDate && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }}
            onClick={() => setSelectedDate(null)}>
            <div style={{ background:"#16162A", borderRadius:20, padding:"24px", width:"100%", maxWidth:400, maxHeight:"80vh", overflow:"auto", border:"1px solid #2A2A45" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div style={{ fontSize:18, fontWeight:800, color:"white" }}>📅 {fmt(selectedDate.dateStr)}</div>
                <button onClick={() => setSelectedDate(null)} style={{ background:"none", border:"none", color:"#666", fontSize:20, cursor:"pointer" }}>×</button>
              </div>
              
              {/* Exam Day Section */}
              {selectedDate.events.exams.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#FF6B6B", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:16 }}>🎯</span> 시험일
                  </div>
                  {selectedDate.events.exams.map((e, i) => (
                    <div key={i} style={{
                      background:"#FF6B6B11",
                      borderRadius:12,
                      padding:"14px 16px",
                      marginBottom:8,
                      border:"1px solid #FF6B6B33"
                    }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"white" }}>{e.plan.title}</div>
                      <div style={{ fontSize:11, color:"#FF6B6B", marginTop:4 }}>D-Day 🔥</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reminder Section */}
              {selectedDate.events.reminders.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#F7A34F", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:16 }}>⏰</span> 리마인더
                  </div>
                  {selectedDate.events.reminders.map((r, i) => (
                    <div key={i} style={{
                      background:"#F7A34F11",
                      borderRadius:12,
                      padding:"14px 16px",
                      marginBottom:8,
                      border:"1px solid #F7A34F33"
                    }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"white" }}>{r.plan.title}</div>
                      <div style={{ fontSize:11, color:"#F7A34F", marginTop:4 }}>
                        {r.daysLeft === 7 && "📢 일주일 남았어요!"}
                        {r.daysLeft === 3 && "⚡ 3일 남았어요! 막바지 스퍼트!"}
                        {r.daysLeft === 1 && "🔥 내일이 시험이에요!"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Study Completion Section */}
              {selectedDate.events.studies.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#22C97A", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:16 }}>✅</span> 완료한 학습
                  </div>
                  {selectedDate.events.studies.map((s, i) => (
                    <div key={i} style={{
                      background:"#22C97A11",
                      borderRadius:12,
                      padding:"14px 16px",
                      marginBottom:8,
                      border:"1px solid #22C97A33"
                    }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#A78BFA", marginBottom:4 }}>{s.plan.title}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:"white" }}>{s.day.topic}</div>
                      <div style={{ display:"flex", gap:12, marginTop:8 }}>
                        {s.log.hours && <span style={{ fontSize:11, color:"#667799" }}>⏱ {s.log.hours}h</span>}
                        {s.log.score && <span style={{ fontSize:11, color:"#667799" }}>⭐ {s.log.score}</span>}
                      </div>
                      {s.log.note && (
                        <div style={{ fontSize:11, color:"#888", marginTop:8, fontStyle:"italic", padding:"8px 10px", background:"#0E0E1A", borderRadius:8 }}>
                          "{s.log.note}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {selectedDate.events.exams.length === 0 && selectedDate.events.reminders.length === 0 && selectedDate.events.studies.length === 0 && (
                <div style={{ textAlign:"center", padding:"30px 0", color:"#556" }}>
                  이 날은 기록이 없어요
                </div>
              )}

              <button onClick={() => setSelectedDate(null)} 
                style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:"#0E0E1A", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13, marginTop:10 }}>
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Material Modal */}
        {materialModal !== null && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }}
            onClick={() => setMaterialModal(null)}>
            <div style={{ background:"#16162A", borderRadius:20, padding:"24px", width:"100%", maxWidth:400, maxHeight:"85vh", overflow:"auto", border:"1px solid #2A2A45" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:18, fontWeight:800, color:"white", marginBottom:20 }}>
                {materialModal?.id ? "📚 자료 수정" : "📚 새 참고자료"}
              </div>
              
              {/* 자료 유형 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>자료 유형</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { key:"book", label:"서적", icon:"📖" },
                    { key:"pdf", label:"PDF", icon:"📄" },
                    { key:"url", label:"URL", icon:"🔗" },
                    { key:"video", label:"영상", icon:"🎬" },
                    { key:"note", label:"메모", icon:"📝" },
                  ].map(t => (
                    <button key={t.key} onClick={() => setMaterialForm(f => ({ ...f, type: t.key }))}
                      style={{
                        flex:1,
                        padding:"10px 4px",
                        borderRadius:10,
                        cursor:"pointer",
                        fontSize:10,
                        fontWeight:600,
                        background: materialForm.type === t.key ? `${ACCENT}22` : "#0E0E1A",
                        color: materialForm.type === t.key ? ACCENT : "#666",
                        border: `1.5px solid ${materialForm.type === t.key ? ACCENT : "#2A2A45"}`,
                      }}>
                      <div style={{ fontSize:16, marginBottom:2 }}>{t.icon}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>제목 *</div>
                <input value={materialForm.title} onChange={e => setMaterialForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 빅데이터분석기사 필기 교재"
                  style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"#0E0E1A", color:"white", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              {/* URL */}
              {(materialForm.type === "url" || materialForm.type === "pdf" || materialForm.type === "video") && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>URL / 링크</div>
                  <input value={materialForm.url} onChange={e => setMaterialForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"#0E0E1A", color:"white", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
              )}

              {/* 파일 첨부 (서적, PDF, 메모) */}
              {(materialForm.type === "book" || materialForm.type === "pdf" || materialForm.type === "note") && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>
                    📎 파일 첨부 (이미지 또는 PDF)
                  </div>
                  
                  {/* 파일 업로드 버튼 */}
                  <label style={{
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    gap:8,
                    padding:"14px",
                    borderRadius:12,
                    border:"2px dashed #3A3A55",
                    background:"#0E0E1A",
                    color:"#888",
                    fontSize:12,
                    cursor:"pointer",
                    transition:"all 0.2s"
                  }}>
                    <input 
                      type="file" 
                      accept="image/*,.pdf"
                      style={{ display:"none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert("파일 크기는 5MB 이하여야 해요.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setMaterialForm(f => ({
                              ...f,
                              fileData: ev.target.result,
                              fileName: file.name,
                              fileType: file.type
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {materialForm.fileData ? "📁 다른 파일 선택" : "📁 파일 선택하기"}
                  </label>
                  
                  {/* 첨부된 파일 미리보기 */}
                  {materialForm.fileData && (
                    <div style={{ marginTop:12, background:"#0E0E1A", borderRadius:12, padding:12, border:"1px solid #2A2A45" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:16 }}>
                            {materialForm.fileType?.includes("pdf") ? "📄" : "🖼️"}
                          </span>
                          <span style={{ fontSize:11, color:"#AAA", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {materialForm.fileName}
                          </span>
                        </div>
                        <button
                          onClick={() => setMaterialForm(f => ({ ...f, fileData:"", fileName:"", fileType:"" }))}
                          style={{ background:"#E0555522", border:"none", borderRadius:6, padding:"4px 8px", color:"#E05555", fontSize:10, cursor:"pointer" }}>
                          삭제
                        </button>
                      </div>
                      
                      {/* 이미지 미리보기 */}
                      {materialForm.fileType?.includes("image") && (
                        <img 
                          src={materialForm.fileData} 
                          alt="미리보기" 
                          style={{ width:"100%", maxHeight:200, objectFit:"contain", borderRadius:8 }}
                        />
                      )}
                      
                      {/* PDF 아이콘 */}
                      {materialForm.fileType?.includes("pdf") && (
                        <div style={{ textAlign:"center", padding:20, color:"#888" }}>
                          <div style={{ fontSize:40, marginBottom:8 }}>📄</div>
                          <div style={{ fontSize:11 }}>PDF 파일이 첨부되었어요</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div style={{ fontSize:10, color:"#556", marginTop:6 }}>
                    * 최대 5MB, 이미지(JPG, PNG) 또는 PDF
                  </div>
                </div>
              )}

              {/* 연결 플랜 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>연결할 플랜</div>
                <select value={materialForm.planIdx} onChange={e => setMaterialForm(f => ({ ...f, planIdx: Number(e.target.value) }))}
                  style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"#0E0E1A", color:"white", fontSize:13, outline:"none", boxSizing:"border-box" }}>
                  <option value={-1}>플랜 미지정</option>
                  {allPlans.map((p, i) => (
                    <option key={i} value={i}>{p.title}</option>
                  ))}
                </select>
              </div>

              {/* 태그 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>태그 (쉼표로 구분)</div>
                <input value={materialForm.tags} onChange={e => setMaterialForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="예: 이론, 기출, 핵심정리"
                  style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"#0E0E1A", color:"white", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              {/* 메모 */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:8 }}>메모</div>
                <textarea value={materialForm.notes} onChange={e => setMaterialForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="자료에 대한 메모..."
                  rows={3}
                  style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"#0E0E1A", color:"white", fontSize:13, outline:"none", boxSizing:"border-box", resize:"none" }} />
              </div>

              {/* 버튼 */}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setMaterialModal(null)}
                  style={{ flex:1, padding:"14px 0", borderRadius:12, border:"1px solid #2A2A45", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>
                  취소
                </button>
                <button onClick={saveMaterial} disabled={!materialForm.title.trim()}
                  style={{ flex:2, padding:"14px 0", borderRadius:12, border:"none", background: materialForm.title.trim() ? `linear-gradient(135deg,${ACCENT},#A78BFA)` : "#333", color:"white", fontWeight:700, cursor: materialForm.title.trim() ? "pointer" : "not-allowed", fontSize:13 }}>
                  저장하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Generate Modal */}
        {quizModal === "generate" && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }}
            onClick={() => !generatingQuiz && (quizModalStep === "selectDays" ? (setQuizModalStep("selectPlan"), setSelectedQuizPlanIdx(null), setSelectedQuizDays([])) : setQuizModal(null))}>
            <div style={{ background:"#16162A", borderRadius:20, padding:"24px", width:"100%", maxWidth:450, maxHeight:"80vh", border:"1px solid #2A2A45", display:"flex", flexDirection:"column" }}
              onClick={e => e.stopPropagation()}>
              
              {generatingQuiz ? (
                <div style={{ textAlign:"center", padding:"30px 0" }}>
                  <div style={{ width:40, height:40, border:`3px solid ${ACCENT}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ fontSize:13, color:"#A78BFA" }}>AI가 10문제를 생성 중이에요...</div>
                  <div style={{ fontSize:11, color:"#556", marginTop:4 }}>잠시만 기다려주세요 (약 20~30초)</div>
                </div>
              ) : quizModalStep === "selectPlan" ? (
                <>
                  <div style={{ fontSize:18, fontWeight:800, color:"white", marginBottom:8 }}>🤖 AI 퀴즈 생성</div>
                  <div style={{ fontSize:12, color:"#667799", marginBottom:20 }}>퀴즈를 생성할 플랜을 선택하세요</div>
                  
                  {allPlans.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"20px 0", color:"#556" }}>
                      <div style={{ fontSize:13, marginBottom:8 }}>플랜이 없어요</div>
                      <div style={{ fontSize:11 }}>플랜을 먼저 생성해주세요</div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {allPlans.map((p, i) => {
                        const existingSets = quizSets.filter(s => s.planIdx === i);
                        return (
                          <button key={i} onClick={() => { setSelectedQuizPlanIdx(i); setQuizModalStep("selectDays"); setSelectedQuizDays([]); }}
                            style={{
                              width:"100%",
                              padding:"16px",
                              borderRadius:14,
                              border:"1.5px solid #2A2A45",
                              background:"#0E0E1A",
                              color:"white",
                              textAlign:"left",
                              cursor:"pointer",
                            }}>
                            <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{p.title}</div>
                            <div style={{ fontSize:11, color:"#667799" }}>
                              📅 {p.schedule?.length || 0}일 스케줄 · 퀴즈 세트 {existingSets.length}개
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  <button onClick={() => setQuizModal(null)}
                    style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"1px solid #2A2A45", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13, marginTop:16 }}>
                    취소
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <button onClick={() => { setQuizModalStep("selectPlan"); setSelectedQuizPlanIdx(null); setSelectedQuizDays([]); }}
                      style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:16, padding:0 }}>←</button>
                    <div>
                      <div style={{ fontSize:16, fontWeight:800, color:"white" }}>📚 출제 범위 선택</div>
                      <div style={{ fontSize:11, color:"#667799", marginTop:2 }}>{allPlans[selectedQuizPlanIdx]?.title}</div>
                    </div>
                  </div>
                  
                  {/* 전체 선택 / 해제 */}
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    <button 
                      onClick={() => setSelectedQuizDays(allPlans[selectedQuizPlanIdx]?.schedule?.map(d => d.day) || [])}
                      style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid #2A2A45", background:"#0E0E1A", color:"#A78BFA", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      ✅ 전체 선택
                    </button>
                    <button 
                      onClick={() => setSelectedQuizDays([])}
                      style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid #2A2A45", background:"#0E0E1A", color:"#888", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      ❌ 전체 해제
                    </button>
                  </div>
                  
                  <div style={{ fontSize:11, color:"#556", marginBottom:8 }}>
                    {selectedQuizDays.length}개 선택됨 {selectedQuizDays.length === 0 && "(전체 범위에서 출제)"}
                  </div>
                  
                  {/* 날짜 목록 */}
                  <div style={{ flex:1, overflowY:"auto", marginBottom:16, maxHeight:"40vh" }}>
                    {allPlans[selectedQuizPlanIdx]?.schedule?.map((day, di) => {
                      const isSelected = selectedQuizDays.includes(day.day);
                      return (
                        <div 
                          key={day.day}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedQuizDays(selectedQuizDays.filter(d => d !== day.day));
                            } else {
                              setSelectedQuizDays([...selectedQuizDays, day.day]);
                            }
                          }}
                          style={{ 
                            display:"flex", 
                            alignItems:"center", 
                            gap:12, 
                            padding:"12px", 
                            background: isSelected ? "#1A1035" : "#0E0E1A", 
                            borderRadius:10, 
                            marginBottom:6, 
                            cursor:"pointer",
                            border: isSelected ? `1.5px solid ${ACCENT}` : "1.5px solid #2A2A45",
                            transition:"all 0.15s"
                          }}>
                          <div style={{ 
                            width:20, height:20, borderRadius:4, 
                            background: isSelected ? ACCENT : "transparent", 
                            border: isSelected ? "none" : "2px solid #3A3A5A",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            flexShrink:0
                          }}>
                            {isSelected && <span style={{ color:"white", fontSize:12 }}>✓</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, color:"#667799", marginBottom:2 }}>Day {day.day} · {day.date?.replace(/-/g, ".")}</div>
                            <div style={{ fontSize:12, fontWeight:600, color:"white", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{day.topic}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 생성 버튼 */}
                  <button 
                    onClick={() => generateAIQuiz(selectedQuizPlanIdx, selectedQuizDays)}
                    style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, cursor:"pointer", fontSize:14 }}>
                    🤖 {selectedQuizDays.length > 0 ? `선택한 ${selectedQuizDays.length}개 범위에서` : "전체 범위에서"} 퀴즈 생성
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CREATE ───────────────────────────────────────────────────────────────
  if (screen === "create") return (
    <div style={{ minHeight:"100vh", background:DARK, fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif", paddingBottom:100 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px", borderBottom:"1px solid #1E1E32" }}>
        <button onClick={() => setScreen("dashboard")} style={{ fontSize:13, color:"#888", background:"none", border:"none", cursor:"pointer" }}>← 뒤로</button>
        <div style={{ fontSize:14, fontWeight:700, color:"white" }}>새 스터디 플랜</div>
        <div style={{ width:40 }} />
      </div>
      <div style={{ maxWidth:520, margin:"0 auto", padding:"28px 24px" }}>
        <div style={{ fontSize:13, color:"#888", marginBottom:24, lineHeight:1.7 }}>아래 정보를 입력하면 Claude AI가 맞춤 공부 스케줄을 자동으로 생성해요.</div>
        {[
          { label:"📖 시험명 / 공부 분야 *", key:"field",      placeholder:"예: 빅데이터분석기사 필기, TOEIC, 정보처리기사", type:"text" },
          { label:"📅 시험일/목표일 *",      key:"examDate",   placeholder:"",                                              type:"date" },
          { label:"🎓 기존 배경지식",         key:"background", placeholder:"예: ADsP 합격, 통계 기초 있음, 완전 비전공자",   type:"text" },
          { label:"📝 추가 메모",             key:"notes",      placeholder:"예: 통계가 약함, 주말엔 2시간 가능",            type:"text" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:7 }}>{f.label}</div>
            <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
              style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #2A2A45", background:"#16162A", color:"white", fontSize:13, outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
          </div>
        ))}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:7 }}>⏰ 하루 학습 시간</div>
          <div style={{ display:"flex", gap:8 }}>
            {["0.5","1","1.5","2","3"].map(h => (
              <button key={h} onClick={() => setForm(p => ({ ...p, dailyHours: h }))}
                style={{ flex:1, padding:"10px 0", borderRadius:10, cursor:"pointer", fontWeight:600, fontSize:13, background:form.dailyHours===h?ACCENT:"#16162A", color:form.dailyHours===h?"white":"#666", border:`1.5px solid ${form.dailyHours===h?ACCENT:"#2A2A45"}` }}>
                {h}h
              </button>
            ))}
          </div>
        </div>
        
        {/* 세부 목차 옵션 */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#AAA", marginBottom:7 }}>📋 플랜 상세 옵션</div>
          <div style={{ display:"flex", gap:8 }}>
            <button 
              onClick={() => setForm(p => ({ ...p, includeSubtasks: false }))}
              style={{ 
                flex:1, 
                padding:"12px 10px", 
                borderRadius:10, 
                cursor:"pointer", 
                fontWeight:600, 
                fontSize:12, 
                background: !form.includeSubtasks ? ACCENT : "#16162A", 
                color: !form.includeSubtasks ? "white" : "#666", 
                border:`1.5px solid ${!form.includeSubtasks ? ACCENT : "#2A2A45"}`,
                textAlign:"center"
              }}>
              ⚡ 기본 (빠름)
              <div style={{ fontSize:10, marginTop:4, opacity:0.8 }}>~15초</div>
            </button>
            <button 
              onClick={() => setForm(p => ({ ...p, includeSubtasks: true }))}
              style={{ 
                flex:1, 
                padding:"12px 10px", 
                borderRadius:10, 
                cursor:"pointer", 
                fontWeight:600, 
                fontSize:12, 
                background: form.includeSubtasks ? ACCENT : "#16162A", 
                color: form.includeSubtasks ? "white" : "#666", 
                border:`1.5px solid ${form.includeSubtasks ? ACCENT : "#2A2A45"}`,
                textAlign:"center"
              }}>
              📝 세부 목차 포함
              <div style={{ fontSize:10, marginTop:4, opacity:0.8 }}>~60초</div>
            </button>
          </div>
          <div style={{ fontSize:10, color:"#555", marginTop:8, lineHeight:1.5 }}>
            💡 세부 목차: 각 날짜별로 체크할 수 있는 세부 학습 항목이 추가돼요
          </div>
        </div>
        
        {createError && <div style={{ fontSize:12, color:"#E05555", marginBottom:12, padding:"10px 14px", background:"#2A1010", borderRadius:10 }}>{createError}</div>}
        
        {creating ? (
          <div style={{ background:"#16162A", borderRadius:14, padding:"20px", border:"1px solid #2A2A45" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ 
                  width:20, height:20, 
                  border:"2px solid #7C5CFC", 
                  borderTopColor:"transparent", 
                  borderRadius:"50%", 
                  animation:"spin 1s linear infinite" 
                }} />
                <span style={{ fontSize:13, color:"white", fontWeight:600 }}>AI가 플랜 생성 중...</span>
              </div>
              <span style={{ fontSize:12, color:"#A78BFA", fontWeight:700 }}>{Math.round(createProgress)}%</span>
            </div>
            
            {/* Progress bar */}
            <div style={{ background:"#0E0E1A", borderRadius:99, height:8, overflow:"hidden", marginBottom:12 }}>
              <div style={{ 
                background:`linear-gradient(90deg, ${ACCENT}, #A78BFA)`, 
                height:"100%", 
                width:`${createProgress}%`, 
                borderRadius:99,
                transition:"width 0.3s ease"
              }} />
            </div>
            
            {/* Time info */}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666" }}>
              <span>⏱️ 경과: {Math.floor(createElapsed)}초</span>
              <span>예상: {form.includeSubtasks ? "~60초" : "~20초"}</span>
            </div>
            
            {/* Stage messages */}
            <div style={{ marginTop:12, fontSize:11, color:"#888", textAlign:"center" }}>
              {createProgress < 20 && "📚 시험 정보 분석 중..."}
              {createProgress >= 20 && createProgress < 40 && "📅 학습 일정 계획 중..."}
              {createProgress >= 40 && createProgress < 60 && "📝 과목별 커리큘럼 생성 중..."}
              {createProgress >= 60 && createProgress < 80 && "🎯 맞춤 학습 내용 배치 중..."}
              {createProgress >= 80 && "✨ 마무리 중..."}
            </div>
            
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <button onClick={handleCreate}
            style={{ width:"100%", padding:"16px 0", borderRadius:14, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:15, cursor:"pointer" }}>
            🚀 AI 스터디 플랜 생성하기
          </button>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setScreen("dashboard"); }} />
    </div>
  );

  // ── TRACKER ──────────────────────────────────────────────────────────────
  if (screen === "tracker" && plan) return (
    <div style={{ fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background:"#F4F6FA", minHeight:"100vh", paddingBottom:100 }}>
      <div style={{ background:`linear-gradient(135deg,${DARK},#1A1035,#0D1A35)`, padding:"22px 20px 20px", color:"white" }}>
        <div style={{ maxWidth:680, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={() => { setScreen("dashboard"); setActiveTab("plan"); }} style={{ fontSize:11, color:"#888", background:"none", border:"none", cursor:"pointer", padding:0 }}>← 전체보기</button>
              {plans.length > 1 && (
                <select value={activePlanIdx} onChange={e => switchPlan(Number(e.target.value))}
                  style={{ fontSize:11, background:"#1E1E32", color:"#AAA", border:"1px solid #2A2A45", borderRadius:6, padding:"3px 8px", cursor:"pointer", outline:"none" }}>
                  {plans.map((p,i) => <option key={i} value={i}>{p.title}</option>)}
                </select>
              )}
            </div>
            <button onClick={() => setScreen("create")} style={{ fontSize:11, color:"#A78BFA", background:"#1E1035", border:"1px solid #3A2A60", borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>+ 새 플랜</button>
          </div>
          <div style={{ fontSize:10, letterSpacing:3, color:"#556688", marginBottom:4, textTransform:"uppercase" }}>AI Study Tracker</div>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:2 }}>{plan.title}</div>
          <div style={{ fontSize:11, color:"#667799", marginBottom:16 }}>시험일 {fmt(plan.examDate)} · <span style={{ color:daysLeft<=7?"#FF6B6B":"#A78BFA" }}>D-{daysLeft}</span></div>
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:14, padding:"13px 16px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
              <span style={{ fontSize:11, color:"#667799" }}>전체 진도</span>
              <span style={{ fontSize:17, fontWeight:800, color:"#A78BFA" }}>{progress}%</span>
            </div>
            <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:99, height:7, overflow:"hidden" }}>
              <div style={{ background:`linear-gradient(90deg,${ACCENT},#A78BFA)`, height:"100%", width:`${progress}%`, borderRadius:99, transition:"width .5s" }} />
            </div>
            <div style={{ display:"flex", gap:16, marginTop:10 }}>
              <span style={{ fontSize:11, color:"#667799" }}>✅ <strong style={{ color:"white" }}>{totalDone}</strong>/{schedule.length}일</span>
              <span style={{ fontSize:11, color:"#667799" }}>⏱ <strong style={{ color:"white" }}>{totalHours.toFixed(1)}</strong>h</span>
              <span style={{ fontSize:11, color:"#667799" }}>📅 D-<strong style={{ color:daysLeft<=7?"#FF6B6B":"white" }}>{daysLeft}</strong></span>
            </div>
          </div>
          {subjects.length > 0 && (
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {subjects.map(s => {
                const days=schedule.filter(d=>d.subject===s.key), done=days.filter(d=>logs[d.day]?.done).length;
                const pct=days.length?Math.round((done/days.length)*100):0;
                return (
                  <div key={s.key} style={{ flex:"1 1 80px", background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"7px 8px", textAlign:"center", minWidth:70 }}>
                    <div style={{ fontSize:10, color:s.color, fontWeight:700, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.label}</div>
                    <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:99, height:3, overflow:"hidden" }}>
                      <div style={{ background:s.color, height:"100%", width:`${pct}%`, borderRadius:99 }} />
                    </div>
                    <div style={{ fontSize:10, color:"#556", marginTop:3 }}>{done}/{days.length}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"14px 20px 0" }}>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[["schedule","📋 스케줄"],["log","📝 기록"],["manage","⚙️ 관리"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding:"8px 14px", borderRadius:99, border:"none", cursor:"pointer", fontWeight:600, fontSize:12, background:view===v?DARK:"#E8ECF2", color:view===v?"white":"#666" }}>{l}</button>
          ))}
        </div>

        {view === "schedule" && weekGroups.map((days,wi) => {
          const doneCnt=days.filter(d=>logs[d.day]?.done).length;
          const weekDayNumbers = days.map(d => d.day);
          return (
            <div key={wi} style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#999" }}>{wi+1}주차</span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedQuizPlanIdx(activePlanIdx);
                      setSelectedQuizDays(weekDayNumbers);
                      setQuizModalStep("selectDays");
                      setQuizModal("generate");
                    }}
                    style={{ fontSize:10, color:ACCENT, background:"#F5F0FF", border:"none", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontWeight:600 }}>
                    🤖 퀴즈
                  </button>
                  <span style={{ fontSize:10, color:"#BBB" }}>{doneCnt}/{days.length} 완료</span>
                </div>
              </div>
              {days.map(day => {
                const subj=subjects.find(s=>s.key===day.subject), done=logs[day.day]?.done;
                const isPast=day.date<today(), isToday=day.date===today();
                const isExpanded = expandedDay === day.day;
                const subtasks = day.subtasks || [];
                const subtasksDone = logs[day.day]?.subtasksDone || [];
                const completedSubtasks = subtasksDone.filter(Boolean).length;
                const allSubtasksChecked = subtasks.length > 0 && completedSubtasks === subtasks.length;
                
                return (
                  <div key={day.day} style={{ marginBottom:6 }}>
                    {/* Main topic row */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (subtasks.length > 0) {
                          setExpandedDay(isExpanded ? null : day.day);
                        } else if (!done) {
                          openLog(day);
                        }
                      }}
                      style={{ 
                        display:"flex", 
                        gap:12, 
                        alignItems:"flex-start", 
                        padding:"12px 14px", 
                        background:done?"white":isToday?"#EEF2FF":"white", 
                        borderRadius: isExpanded ? "12px 12px 0 0" : 12, 
                        border:`1.5px solid ${done?"#22C97A22":isToday?`${ACCENT}44`:"#E8ECF2"}`,
                        borderBottom: isExpanded ? "none" : undefined,
                        cursor:"pointer", 
                        opacity:isPast&&!done?0.5:1 
                      }}>
                      <div style={{ marginTop:2, width:18, height:18, borderRadius:"50%", background:done?"#22C97A":"#E8ECF2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {done && <span style={{ fontSize:10 }}>✓</span>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                          <span style={{ fontSize:9, fontWeight:700, color:subj?.color||"#999", background:`${subj?.color||"#999"}18`, padding:"2px 7px", borderRadius:99 }}>{subj?.label||""}</span>
                          {isToday && <span style={{ fontSize:9, background:`${ACCENT}22`, color:ACCENT, borderRadius:99, padding:"2px 6px", fontWeight:700 }}>오늘</span>}
                          {subtasks.length > 0 && (
                            <span style={{ fontSize:9, background:"#F0F0F5", color:"#666", borderRadius:99, padding:"2px 6px", fontWeight:600 }}>
                              {completedSubtasks}/{subtasks.length}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#1A1A2E", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{day.topic}</div>
                        <div style={{ fontSize:10, color:"#AAA", marginTop:2 }}>{fmt(day.date)} · Day {day.day}</div>
                        {done && logs[day.day]?.hours && <div style={{ fontSize:10, color:"#22C97A", marginTop:2 }}>⏱ {logs[day.day].hours}h 완료</div>}
                      </div>
                      {subtasks.length > 0 && (
                        <div style={{ flexShrink:0, color:"#AAA", fontSize:12, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
                          ▼
                        </div>
                      )}
                    </div>
                    
                    {/* Subtasks dropdown */}
                    {isExpanded && subtasks.length > 0 && (
                      <div style={{ 
                        background:"#F8F9FC", 
                        borderRadius:"0 0 12px 12px", 
                        border:`1.5px solid ${isToday?`${ACCENT}44`:"#E8ECF2"}`,
                        borderTop:"none",
                        padding:"12px 14px",
                        marginTop:"-1px"
                      }}>
                        {/* Toggle all button */}
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAllSubtasks(day.day, subtasks.length, allSubtasksChecked);
                          }}
                          style={{ 
                            display:"flex", 
                            alignItems:"center", 
                            gap:8, 
                            marginBottom:10, 
                            paddingBottom:10, 
                            borderBottom:"1px dashed #E0E0E5",
                            cursor:"pointer"
                          }}>
                          <div style={{ 
                            width:16, 
                            height:16, 
                            borderRadius:4, 
                            background: allSubtasksChecked ? ACCENT : "white",
                            border: allSubtasksChecked ? `1.5px solid ${ACCENT}` : "1.5px solid #CCC",
                            display:"flex", 
                            alignItems:"center", 
                            justifyContent:"center",
                            flexShrink:0
                          }}>
                            {allSubtasksChecked && <span style={{ fontSize:10, color:"white" }}>✓</span>}
                          </div>
                          <span style={{ fontSize:11, color:"#666", fontWeight:600 }}>
                            {allSubtasksChecked ? "모두 해제" : "모두 체크"}
                          </span>
                        </div>
                        
                        {/* Subtask items */}
                        {subtasks.map((subtask, idx) => {
                          const isChecked = subtasksDone[idx] || false;
                          return (
                            <div 
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSubtask(day.day, idx);
                              }}
                              style={{ 
                                display:"flex", 
                                alignItems:"flex-start", 
                                gap:10, 
                                padding:"8px 0",
                                cursor:"pointer",
                                borderBottom: idx < subtasks.length - 1 ? "1px solid #EAEAEF" : "none"
                              }}>
                              <div style={{ 
                                width:18, 
                                height:18, 
                                borderRadius:4, 
                                background: isChecked ? "#22C97A" : "white",
                                border: isChecked ? "1.5px solid #22C97A" : "1.5px solid #CCC",
                                display:"flex", 
                                alignItems:"center", 
                                justifyContent:"center",
                                flexShrink:0,
                                marginTop:1
                              }}>
                                {isChecked && <span style={{ fontSize:10, color:"white" }}>✓</span>}
                              </div>
                              <span style={{ 
                                fontSize:12, 
                                color: isChecked ? "#999" : "#333",
                                textDecoration: isChecked ? "line-through" : "none",
                                lineHeight:1.4
                              }}>
                                {subtask}
                              </span>
                            </div>
                          );
                        })}
                        
                        {/* Complete day button */}
                        {!done && (
                          <div style={{ display:"flex", gap:8, marginTop:12 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openLog(day);
                              }}
                              style={{
                                flex:2,
                                padding:"10px",
                                borderRadius:8,
                                border:"none",
                                background: allSubtasksChecked ? "#22C97A" : ACCENT,
                                color:"white",
                                fontSize:12,
                                fontWeight:600,
                                cursor:"pointer"
                              }}>
                              ✅ 오늘 학습 완료하기
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuizPlanIdx(activePlanIdx);
                                setSelectedQuizDays([day.day]);
                                setQuizModalStep("selectDays");
                                setQuizModal("generate");
                              }}
                              style={{
                                flex:1,
                                padding:"10px",
                                borderRadius:8,
                                border:"1.5px solid #7C5CFC44",
                                background:"#F5F0FF",
                                color:ACCENT,
                                fontSize:11,
                                fontWeight:600,
                                cursor:"pointer"
                              }}>
                              🤖 퀴즈
                            </button>
                          </div>
                        )}
                        {done && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuizPlanIdx(activePlanIdx);
                              setSelectedQuizDays([day.day]);
                              setQuizModalStep("selectDays");
                              setQuizModal("generate");
                            }}
                            style={{
                              width:"100%",
                              marginTop:12,
                              padding:"10px",
                              borderRadius:8,
                              border:"1.5px solid #7C5CFC44",
                              background:"#F5F0FF",
                              color:ACCENT,
                              fontSize:11,
                              fontWeight:600,
                              cursor:"pointer"
                            }}>
                            🤖 이 범위에서 퀴즈 생성
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {view === "log" && (
          <div>
            {Object.entries(logs).filter(([,l])=>l?.done).length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#AAA", fontSize:13 }}>아직 완료한 학습이 없어요.</div>
            ) : (
              Object.entries(logs).filter(([,l])=>l?.done).sort(([a],[b])=>Number(b)-Number(a)).map(([dayNum,l]) => {
                const day=schedule.find(d=>d.day===Number(dayNum)), subj=subjects.find(s=>s.key===day?.subject);
                return (
                  <div key={dayNum} style={{ background:"white", borderRadius:12, padding:"13px 14px", marginBottom:8, border:"1.5px solid #E8ECF2" }}>
                    {editingLog?.day === Number(dayNum) ? (
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#1A1A2E", marginBottom:10 }}>{day?.topic}</div>
                        {[{label:"⏱ 학습 시간",val:editHours,set:setEditHours,ph:"1"},{label:"💬 메모",val:editNote,set:setEditNote,ph:"오늘 공부 내용..."},{label:"⭐ 이해도",val:editScore,set:setEditScore,ph:"예: ★★★★☆"}].map(f=>(
                          <div key={f.label} style={{ marginBottom:8 }}>
                            <div style={{ fontSize:10, color:"#888", marginBottom:4 }}>{f.label}</div>
                            <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1.5px solid #E0E0E0", fontSize:12, outline:"none", boxSizing:"border-box" }} />
                          </div>
                        ))}
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={()=>setEditingLog(null)} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid #ddd", background:"none", color:"#888", cursor:"pointer", fontSize:12 }}>취소</button>
                          <button onClick={saveEdit} style={{ flex:2, padding:"8px 0", borderRadius:8, border:"none", background:ACCENT, color:"white", fontWeight:700, cursor:"pointer", fontSize:12 }}>저장</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:10, color:subj?.color||"#999", fontWeight:700, marginBottom:3 }}>{subj?.label} · Day {dayNum}</div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#1A1A2E" }}>{day?.topic}</div>
                          <div style={{ fontSize:10, color:"#AAA", marginTop:3 }}>{l.hours&&`⏱ ${l.hours}h`}{l.score&&` · ${l.score}`}</div>
                          {l.note && <div style={{ fontSize:11, color:"#666", marginTop:4, fontStyle:"italic" }}>"{l.note}"</div>}
                        </div>
                        <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:8 }}>
                          <button onClick={()=>startEdit(day)} style={{ fontSize:10, color:"#7C5CFC", background:"#EEF2FF", border:"none", borderRadius:7, padding:"4px 8px", cursor:"pointer" }}>수정</button>
                          <button onClick={()=>setDeleteConfirmDay(Number(dayNum))} style={{ fontSize:10, color:"#E05555", background:"#FEF2F2", border:"none", borderRadius:7, padding:"4px 8px", cursor:"pointer" }}>삭제</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === "manage" && (
          <div>
            <div style={{ background:"white", borderRadius:12, padding:"16px", marginBottom:12, border:"1.5px solid #E8ECF2" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1A1A2E", marginBottom:12 }}>플랜 정보</div>
              <div style={{ fontSize:12, color:"#666", lineHeight:2.2 }}>
                <div>📋 {plan.title}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span>📅 시험일: {fmt(plan.examDate)}</span>
                  <button 
                    onClick={() => { setEditDateModal({ planIdx: activePlanIdx, currentDate: plan.examDate }); setNewExamDate(plan.examDate); }}
                    style={{ fontSize:11, color:"#7C5CFC", background:"#EEF2FF", border:"none", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>
                    ✏️ 변경
                  </button>
                </div>
                <div>📆 생성일: {fmt(plan.createdAt)}</div>
                <div>📊 총 {schedule.length}일 스케줄</div>
              </div>
            </div>
            <button onClick={() => setDeleteConfirmPlan(activePlanIdx)} style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:"#FEF2F2", color:"#E05555", fontWeight:700, fontSize:14, cursor:"pointer" }}>🗑 이 플랜 삭제하기</button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setScreen("dashboard"); }} />

      {selectedDay && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }} onClick={()=>setSelectedDay(null)}>
          <div style={{ background:"white", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px", width:"100%", maxWidth:520 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:11, color:subjects.find(s=>s.key===selectedDay.subject)?.color||"#999", fontWeight:700, marginBottom:4 }}>{subjects.find(s=>s.key===selectedDay.subject)?.label} · Day {selectedDay.day}</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#1A1A2E", marginBottom:16 }}>{selectedDay.topic}</div>
            {[{label:"⏱ 학습 시간 (h)",val:hoursInput,set:setHoursInput,ph:"1"},{label:"💬 메모",val:noteInput,set:setNoteInput,ph:"오늘 공부 내용이나 느낀 점..."},{label:"⭐ 이해도",val:scoreInput,set:setScoreInput,ph:"예: ★★★★☆"}].map(f=>(
              <div key={f.label} style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>{f.label}</div>
                <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid #E0E0E0", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
            <button onClick={saveLog} style={{ width:"100%", padding:"14px 0", borderRadius:12, border:"none", background:`linear-gradient(135deg,${ACCENT},#A78BFA)`, color:"white", fontWeight:700, fontSize:14, cursor:"pointer", marginTop:4 }}>✅ 완료 기록하기</button>
          </div>
        </div>
      )}

      {deleteConfirmDay !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }} onClick={()=>setDeleteConfirmDay(null)}>
          <div style={{ background:"white", borderRadius:20, padding:"24px", width:"100%", maxWidth:320, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:32, marginBottom:10 }}>🗑</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#1A1A2E", marginBottom:6 }}>기록을 삭제할까요?</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:20 }}>Day {deleteConfirmDay} 학습 기록이 삭제돼요.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setDeleteConfirmDay(null)} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1.5px solid #E0E0E0", background:"none", color:"#888", cursor:"pointer", fontSize:13 }}>취소</button>
              <button onClick={()=>deleteLog(deleteConfirmDay)} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"none", background:"#E05555", color:"white", fontWeight:700, cursor:"pointer", fontSize:13 }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmPlan !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }} onClick={()=>setDeleteConfirmPlan(null)}>
          <div style={{ background:"white", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:340, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:36, marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#1A1A2E", marginBottom:8 }}>플랜을 삭제할까요?</div>
            <div style={{ fontSize:13, color:"#E05555", marginBottom:6, fontWeight:600 }}>{plan?.title}</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:24, lineHeight:1.6 }}>모든 학습 기록이 영구 삭제되며<br/>복구할 수 없어요.</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setDeleteConfirmPlan(null)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"1.5px solid #E0E0E0", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>취소</button>
              <button onClick={()=>deletePlan(deleteConfirmPlan)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", background:"#E05555", color:"white", fontWeight:700, cursor:"pointer", fontSize:13 }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Date Modal */}
      {editDateModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"0 24px" }} onClick={()=>!updatingDate && setEditDateModal(null)}>
          <div style={{ background:"white", borderRadius:20, padding:"28px 24px", width:"100%", maxWidth:380, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            {updatingDate ? (
              <>
                <div style={{ width:48, height:48, border:`3px solid ${ACCENT}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 20px" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{ fontSize:15, fontWeight:700, color:"#1A1A2E", marginBottom:8 }}>스케줄 재생성 중...</div>
                <div style={{ fontSize:12, color:"#888", lineHeight:1.6 }}>AI가 새 날짜에 맞춰<br/>학습 스케줄을 다시 만들고 있어요</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
                <div style={{ fontSize:16, fontWeight:800, color:"#1A1A2E", marginBottom:6 }}>시험일 변경</div>
                <div style={{ fontSize:12, color:"#888", marginBottom:20, lineHeight:1.6 }}>
                  새 날짜에 맞춰 AI가 스케줄을 재생성해요.<br/>
                  <span style={{ color:"#E05555" }}>⚠️ 기존 학습 기록은 초기화됩니다.</span>
                </div>
                
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, color:"#888", marginBottom:6, textAlign:"left" }}>현재 시험일: {fmt(editDateModal.currentDate)}</div>
                  <input 
                    type="date" 
                    value={newExamDate} 
                    onChange={e => setNewExamDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0,10)}
                    style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #E0E0E0", fontSize:14, outline:"none", boxSizing:"border-box", colorScheme:"light" }} 
                  />
                </div>
                
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setEditDateModal(null)} style={{ flex:1, padding:"13px 0", borderRadius:12, border:"1.5px solid #E0E0E0", background:"none", color:"#888", fontWeight:600, cursor:"pointer", fontSize:13 }}>취소</button>
                  <button 
                    onClick={updateExamDate} 
                    disabled={!newExamDate || newExamDate === editDateModal.currentDate}
                    style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", background: (newExamDate && newExamDate !== editDateModal.currentDate) ? ACCENT : "#DDD", color:"white", fontWeight:700, cursor: (newExamDate && newExamDate !== editDateModal.currentDate) ? "pointer" : "not-allowed", fontSize:13 }}>
                    변경하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return null;
}
