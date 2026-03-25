import { useState, useRef } from "react";

const TARGETS = ["ChatGPT", "Gemini", "Claude", "Grok", "기타 범용"];

const OUTPUT_PERSPECTIVES = [
  { key: "ceo",       label: "경영자 관점",      icon: "👔", desc: "전략·의사결정·비전 중심" },
  { key: "product",   label: "상품개발자 관점",   icon: "🔧", desc: "기능·UX·로드맵 중심" },
  { key: "marketing", label: "마케팅전문가 관점", icon: "📣", desc: "고객·채널·캠페인 중심" },
  { key: "purchase",  label: "구매 관점",        icon: "🛒", desc: "원가·공급망·조달 중심" },
  { key: "sales",     label: "영업 관점",        icon: "🤝", desc: "고객확보·매출·채널 중심" },
  { key: "synthesis", label: "연관된 관점(요청)", icon: "🔍", desc: "전체 관점 통합·결론 도출" },
];

const ROLES = [
  { key: "ceo",        label: "김정문알로에 CEO" },
  { key: "marketing",  label: "마케팅담당자" },
  { key: "sales",      label: "영업총괄" },
  { key: "product",    label: "상품개발자" },
  { key: "custom",     label: "기타 (직접입력)" },
];

const CATEGORIES = [
  { key: "context",     label: "문맥 (Context)",           icon: "◉", placeholder: "예: 스타트업, B2B SaaS, 소비재 브랜드..." },
  { key: "constraints", label: "제한 조건 (Constraints)",  icon: "◫", placeholder: "예: 전문 용어 금지, 존댓말, 500자 이내..." },
];

const optimizedSystemPrompt = `당신은 세계 최고 수준의 AI 프롬프트 엔지니어입니다.
ReAct(Reasoning + Acting), Tree of Thoughts, Chain of Thought, APE(Automatic Prompt Engineer) 기법을 통합하여 최고 품질의 프롬프트를 설계하세요.

[적용 기법]
- ReAct: 사고(Thought) → 행동(Action) → 관찰(Observation) 구조로 AI가 단계적으로 추론하도록 유도
- Tree of Thoughts: 여러 가능성을 분기 탐색 후 최선의 경로를 선택하도록 지시
- Chain of Thought: 복잡한 문제를 단계별로 분해하여 논리적으로 해결하도록 유도
- APE: 자동으로 최적의 지시어와 예시를 포함하여 AI 출력 품질을 극대화

[프롬프트 구성 원칙]
1. 역할(Role), 문맥(Context), 출력 형태, 제한조건을 통합하여 정교한 프롬프트 작성
2. 관점이 선택된 경우 각 관점별 섹션을 명확히 구분하고 마지막에 [종합 분석] 포함
3. AI가 스스로 검토(Self-reflection)하고 최적의 답변을 생성하도록 메타 지시 포함
4. 구체적인 출력 형식, 예시, 평가 기준을 프롬프트 안에 명시
5. 프롬프트는 즉시 붙여넣기 가능한 완성형으로 작성

[출력 형식 - 반드시 준수]
아래 구분자 형식으로만 응답하세요.

%%PROMPT%%
(완성된 최적화 프롬프트 전체 내용)
%%TIPS%%
(팁1)
(팁2)
(팁3)
%%END%%`;

const systemPrompt = `당신은 AI 프롬프트 엔지니어링 전문가입니다.
사용자가 간단한 요청과 선택 사항을 입력하면, 해당 AI에 최적화된 완성도 높은 프롬프트를 작성해주세요.

규칙:
1. 역할(Role), 문맥(Context), 출력 형태(Output Format), 제한조건(Constraints)을 자연스럽게 통합해서 하나의 매끄러운 프롬프트를 만드세요.
2. 출력 형태에 특정 관점(경영자/상품개발자/마케팅전문가/구매/영업)이 지정된 경우, 반드시 각 관점별 섹션을 나눠서 답변하도록 프롬프트에 명시하세요.
3. 관점이 하나라도 선택된 경우, 또는 [종합 분석]이 선택된 경우, 선택된 모든 관점별 분석 이후에 반드시 [종합 분석] 섹션을 포함하도록 프롬프트에 명시하세요. 종합 분석에서는 각 관점의 핵심 인사이트를 통합하여 실행 가능한 결론과 우선순위를 도출해달라고 요청하세요.
4. 사용자가 입력하지 않은 항목은 요청 내용을 바탕으로 AI가 합리적으로 추론해 채워주세요.
5. 프롬프트는 즉시 해당 AI에 붙여넣기 할 수 있도록 완성된 형태로 작성하세요.

[출력 형식 - 반드시 준수]
아래 구분자 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

%%PROMPT%%
(완성된 프롬프트 전체 내용)
%%TIPS%%
(팁1)
(팁2)
(팁3)
%%END%%`;


// 구분자 기반 파싱 헬퍼 - JSON 미사용으로 파싱 오류 원천 차단
function parseAIResponse(raw) {
  const promptMatch = raw.split("%%PROMPT%%")[1];
  if (!promptMatch) return null;
  const afterPrompt = promptMatch.split("%%TIPS%%");
  const prompt = afterPrompt[0].trim();
  const tips = [];
  if (afterPrompt[1]) {
    const tipsSection = afterPrompt[1].split("%%END%%")[0];
    const matches = tipsSection.match(/\(([^)]+)\)/g) || [];
    matches.forEach(m => tips.push(m.slice(1, -1).trim()));
  }
  return { prompt, tips };
}

export default function App() {
  const [userInput, setUserInput] = useState("");
  const [target, setTarget] = useState("ChatGPT");
  const [fields, setFields] = useState({ role: "김정문알로에 CEO", context: "", constraints: "존댓말 사용, 전문용어는 쉬운 풀이 포함, 한글로 작성, 글자 수 제한없이" });
  const [selectedRole, setSelectedRole] = useState("ceo");
  const [customRole, setCustomRole] = useState("");
  const [selectedPerspectives, setSelectedPerspectives] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const resultRef = useRef(null);

  const togglePerspective = (key) => {
    setSelectedPerspectives(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleRoleSelect = (key) => {
    setSelectedRole(key);
    if (key !== "custom") {
      const role = ROLES.find(r => r.key === key);
      setFields(f => ({ ...f, role: role.label }));
    } else {
      setFields(f => ({ ...f, role: customRole }));
    }
  };

  const handleExtractContext = async () => {
    if (!userInput.trim()) { setError("먼저 요청 내용을 입력해주세요!"); return; }
    setContextLoading(true);
    setError("");
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 300,
          system: `사용자의 요청 텍스트를 분석하여 문맥(Context)을 추출하세요.
문맥이란 이 요청이 어떤 상황/산업/조직/배경에서 나온 것인지를 간결하게 표현한 것입니다.
예: "스타트업 마케팅 팀, B2B SaaS 제품 출시 준비 중"
예: "중소기업 경영진, 신규 사업 검토 단계"
예: "온라인 쇼핑몰 운영자, 계절 프로모션 기획 중"

반드시 순수 텍스트 한 줄(50자 이내)만 반환하세요. 설명이나 따옴표 없이.`,
          messages: [{ role: "user", content: `다음 요청의 문맥을 추출해주세요:

${userInput}` }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const extracted = data.content?.[0]?.text?.trim() || "";
      if (extracted) setFields(f => ({ ...f, context: extracted }));
    } catch (e) {
      setError("문맥 추출 오류: " + (e.message || "다시 시도해주세요."));
    } finally {
      setContextLoading(false);
    }
  };

  const buildMessage = (isOptimized) => {
    const filledFields = Object.entries(fields)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => {
        const allCats = [...CATEGORIES, { key: "role", label: "역할 (Role)" }];
        const cat = allCats.find(c => c.key === k);
        return cat ? `- ${cat.label}: ${v}` : "";
      }).filter(Boolean).join("\n");

    const perspectiveLabels = selectedPerspectives.map(k =>
      OUTPUT_PERSPECTIVES.find(p => p.key === k)?.label
    ).filter(Boolean);

    const outputLine = perspectiveLabels.length > 0
      ? `- 출력 형태: ${perspectiveLabels.join(", ")} 으로 구분하여 각 관점에서 분석 및 답변`
      : "";

    const allFields = [filledFields, outputLine].filter(Boolean).join("\n");
    const suffix = isOptimized
      ? "\n\nReAct(사고→행동→관찰), Tree of Thoughts(다중경로 탐색), APE(최적 지시어 자동설계), Chain of Thought 기법을 통합 적용하여 최고 품질의 프롬프트를 작성해주세요."
      : "\n\n위 내용을 바탕으로 최적화된 프롬프트를 작성해주세요.";

    return `대상 AI: ${target}
사용자 요청: ${userInput}
${allFields ? `\n사전 입력 사항:\n${allFields}` : ""}${suffix}`;
  };

  const callAPI = async (sysPrompt, userMsg, isOptimized) => {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: sysPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const raw = data.content?.[0]?.text || "";
    const parsed = parseAIResponse(raw);
    if (!parsed) throw new Error("응답을 파싱할 수 없습니다. 다시 시도해주세요.");
    return { ...parsed, isOptimized };
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) { setError("원하는 내용을 입력해주세요!"); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const result = await callAPI(systemPrompt, buildMessage(false), false);
      setResult(result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError("오류: " + (e.message || "다시 시도해주세요."));
    } finally { setLoading(false); }
  };

  const handleOptimizedGenerate = async () => {
    if (!userInput.trim()) { setError("원하는 내용을 입력해주세요!"); return; }
    setError(""); setLoadingOpt(true); setResult(null);
    try {
      const result = await callAPI(optimizedSystemPrompt, buildMessage(true), true);
      setResult(result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError("오류: " + (e.message || "다시 시도해주세요."));
    } finally { setLoadingOpt(false); }
  };

    const handleCopy = () => {
    if (!result?.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setResult(null);
    setUserInput("");
    setFields({ role: "김정문알로에 CEO", context: "", constraints: "존댓말 사용, 전문용어는 쉬운 풀이 포함, 한글로 작성, 글자 수 제한없이" });
    setSelectedRole("ceo");
    setCustomRole("");
    setSelectedPerspectives([]);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      color: "#e8e6f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #7c4dff44; }
        .header-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(2rem, 5vw, 3.2rem);
          background: linear-gradient(135deg, #c084fc 0%, #818cf8 50%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }
        .card {
          background: #13121a;
          border: 1px solid #1e1c2e;
          border-radius: 16px;
          padding: 24px;
          transition: border-color 0.2s;
        }
        .card:focus-within { border-color: #7c4dff55; }
        .label {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #8b87a8;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .textarea, .input {
          width: 100%;
          background: #0d0c14;
          border: 1px solid #1e1c2e;
          border-radius: 10px;
          color: #e8e6f0;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
        }
        .textarea { padding: 14px 16px; resize: vertical; min-height: 90px; }
        .input { padding: 10px 14px; height: 42px; }
        .textarea:focus, .input:focus {
          border-color: #7c4dff88;
          box-shadow: 0 0 0 3px #7c4dff18;
        }
        .textarea::placeholder, .input::placeholder { color: #3a3850; }
        .chip {
          padding: 8px 16px;
          border-radius: 50px;
          border: 1px solid #1e1c2e;
          background: transparent;
          color: #6b6880;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .chip:hover { border-color: #7c4dff55; color: #a78bfa; }
        .chip.active {
          background: #7c4dff22;
          border-color: #7c4dff;
          color: #c084fc;
        }
        .perspective-card {
          flex: 1;
          min-width: 130px;
          padding: 16px;
          background: #0f0e18;
          border: 1.5px solid #1e1c2e;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.18s;
          text-align: left;
          font-family: inherit;
          position: relative;
          overflow: hidden;
          user-select: none;
        }
        .perspective-card:hover {
          border-color: #7c4dff66;
          background: #13121f;
          transform: translateY(-2px);
        }
        .perspective-card.active {
          border-color: #7c4dff;
          background: #7c4dff18;
          box-shadow: 0 0 20px #7c4dff28;
          transform: translateY(-2px);
        }
        .p-checkbox {
          position: absolute;
          top: 10px; right: 10px;
          width: 18px; height: 18px;
          border-radius: 50%;
          border: 1.5px solid #2e2c42;
          background: #0a0a0f;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
          color: transparent;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .perspective-card.active .p-checkbox {
          background: #7c4dff;
          border-color: #7c4dff;
          color: white;
        }
        .p-icon { font-size: 24px; margin-bottom: 8px; display: block; }
        .p-label {
          font-size: 13px;
          font-weight: 700;
          color: #d4d0e8;
          margin-bottom: 3px;
          display: block;
          line-height: 1.3;
          padding-right: 20px;
        }
        .p-desc { font-size: 11px; color: #4a4760; }
        .perspective-card.active .p-label { color: #c084fc; }
        .perspective-card.active .p-desc { color: #6b5fa8; }
        .generate-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #7c4dff, #4f8cff);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          font-family: inherit;
          letter-spacing: 0.03em;
        }
        .generate-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .optimized-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          border: 1.5px solid #f59e0b;
          background: linear-gradient(135deg, #78350f, #92400e);
          color: #fde68a;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          font-family: inherit;
          letter-spacing: 0.03em;
          margin-top: 10px;
          position: relative;
        }
        .optimized-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 0 20px #f59e0b44; }
        .optimized-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .optimized-badge {
          display: inline-block;
          background: #f59e0b22;
          border: 1px solid #f59e0b66;
          border-radius: 50px;
          padding: 2px 8px;
          font-size: 10px;
          color: #fbbf24;
          margin-left: 6px;
          vertical-align: middle;
          letter-spacing: 0.05em;
        }
        .result-optimized {
          border-color: #f59e0b66 !important;
          background: #1a1200 !important;
        }
        .result-box {
          background: #0d0c14;
          border: 1px solid #7c4dff44;
          border-radius: 12px;
          padding: 20px;
          font-family: 'DM Mono', monospace;
          font-size: 13.5px;
          line-height: 1.85;
          color: #c9c5e0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .copy-btn {
          padding: 8px 18px;
          border-radius: 8px;
          border: 1px solid #7c4dff55;
          background: #7c4dff18;
          color: #a78bfa;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .copy-btn:hover { background: #7c4dff33; }
        .tip-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #1a1826;
          font-size: 13px;
          color: #8b8699;
          line-height: 1.6;
        }
        .tip-item:last-child { border-bottom: none; }
        .tip-dot { color: #7c4dff; font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .section-title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #8b87a8;
          margin-bottom: 12px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          background: #7c4dff18;
          border: 1px solid #7c4dff44;
          border-radius: 50px;
          font-size: 11px;
          color: #a78bfa;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .pulse {
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #fff;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        .fade-in { animation: fadeUp 0.4s ease both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .selected-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .selected-tag {
          padding: 3px 10px;
          background: #7c4dff22;
          border: 1px solid #7c4dff55;
          border-radius: 50px;
          font-size: 12px;
          color: #c084fc;
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", padding: "60px 20px 40px", borderBottom: "1px solid #13121a" }}>
        <div style={{ marginBottom: 12 }}>
          <span className="badge">✦ AI Prompt Studio</span>
        </div>
        <h1 className="header-title">프롬프트 마법사</h1>
        <p style={{ color: "#4a4760", marginTop: 12, fontSize: 14 }}>
          간단한 요청 → 완성도 높은 AI 프롬프트 자동 생성
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Step 1 - 대상 AI */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">01 — 대상 AI 선택</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TARGETS.map(t => (
              <button key={t} className={`chip ${target === t ? "active" : ""}`} onClick={() => setTarget(t)}>{t}</button>
            ))}
          </div>
        </div>

        {/* Step 2 - 역할 선택 */}
        <div style={{ marginBottom: 28 }} className="card">
          <div className="label">◈ 02 — 역할 선택</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {ROLES.map(r => (
              <button
                key={r.key}
                className={`chip ${selectedRole === r.key ? "active" : ""}`}
                onClick={() => handleRoleSelect(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {selectedRole === "custom" && (
            <input
              className="input"
              placeholder="역할을 직접 입력하세요"
              value={customRole}
              onChange={e => {
                setCustomRole(e.target.value);
                setFields(f => ({ ...f, role: e.target.value }));
              }}
              style={{ marginTop: 4 }}
              autoFocus
            />
          )}
          {selectedRole !== "custom" && fields.role && (
            <div style={{ fontSize: 12, color: "#7c4dff", marginTop: 4 }}>
              ◈ 현재 역할: {fields.role}
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div style={{ marginBottom: 28 }} className="card">
          <div className="label">◈ 03 — 원하는 내용을 자유롭게 입력하세요</div>
          <textarea
            className="textarea"
            placeholder={"예: 우리 서비스의 SNS 홍보 문구를 만들어줘\n예: 신제품 출시 전략을 분석해줘\n예: 분기 실적 보고서 작성을 도와줘"}
            value={userInput}
            onChange={e => {
              setUserInput(e.target.value);
              if (fields.context) setFields(f => ({ ...f, context: "" }));
            }}
            style={{ minHeight: 110 }}
          />
        </div>

        {/* Step 3 - 출력 관점 */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">04 — 관점 선택
            <span style={{ marginLeft: 8, fontSize: 11, color: "#7c4dff", fontWeight: 600, letterSpacing: "0.05em", background: "#7c4dff18", border: "1px solid #7c4dff44", borderRadius: 50, padding: "2px 8px" }}>
              ☑ 중복 선택 가능
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {OUTPUT_PERSPECTIVES.map(p => (
              <button
                key={p.key}
                className={`perspective-card ${selectedPerspectives.includes(p.key) ? "active" : ""}`}
                onClick={() => togglePerspective(p.key)}
              >
                <span className="p-checkbox">✓</span>
                <span className="p-icon">{p.icon}</span>
                <span className="p-label">{p.label}</span>
                <span className="p-desc">{p.desc}</span>
              </button>
            ))}
          </div>
          {selectedPerspectives.length === 0 ? (
            <p style={{ fontSize: 12, color: "#3a3850", marginTop: 10 }}>
              선택하지 않으면 AI가 자동으로 최적의 출력 형태를 결정합니다
            </p>
          ) : (
            <div className="selected-tags">
              {selectedPerspectives.map(k => {
                const p = OUTPUT_PERSPECTIVES.find(x => x.key === k);
                return <span key={k} className="selected-tag">{p.icon} {p.label}</span>;
              })}
            </div>
          )}
        </div>

        {/* Step 4 - 추가 설정 */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">05 — 추가 설정 (선택사항)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="card" style={cat.key === "context" ? { gridColumn: "1 / -1" } : {}}>
                <div className="label" style={{ justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#7c4dff" }}>{cat.icon}</span>
                    {cat.label}
                  </span>
                  {cat.key === "context" && (
                    <button
                      onClick={handleExtractContext}
                      disabled={contextLoading || !userInput.trim()}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 12px", borderRadius: 20,
                        border: "1px solid #7c4dff66",
                        background: contextLoading ? "#7c4dff10" : "#7c4dff22",
                        color: "#a78bfa", fontSize: 11, fontWeight: 700,
                        cursor: contextLoading || !userInput.trim() ? "not-allowed" : "pointer",
                        opacity: !userInput.trim() ? 0.4 : 1,
                        transition: "all 0.15s", fontFamily: "inherit",
                        letterSpacing: "0.05em", textTransform: "uppercase",
                      }}
                    >
                      {contextLoading ? (
                        <><span className="pulse" style={{ background: "#a78bfa" }} /> 분석 중...</>
                      ) : (
                        <><span>✦</span> AI 자동 추출</>
                      )}
                    </button>
                  )}
                </div>
                <input
                  className="input"
                  placeholder={cat.key === "context" ? "✦ 위 버튼으로 AI가 자동 분석하거나 직접 입력하세요" : cat.placeholder}
                  value={fields[cat.key]}
                  onChange={e => setFields(f => ({ ...f, [cat.key]: e.target.value }))}
                  style={cat.key === "context" && fields.context ? { color: "#c084fc" } : {}}
                />
                {cat.key === "context" && fields.context && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#4a4760", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#7c4dff" }}>◈</span> AI가 추출한 문맥 · 직접 수정 가능
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Generate */}
        {error && (
          <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, paddingLeft: 4 }}>⚠ {error}</div>
        )}
        <button className="generate-btn" onClick={handleGenerate} disabled={loading || loadingOpt}>
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span className="pulse" />
              프롬프트 생성 중...
            </span>
          ) : "✦  프롬프트 생성하기"}
        </button>

        <button className="optimized-btn" onClick={handleOptimizedGenerate} disabled={loading || loadingOpt}>
          {loadingOpt ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span className="pulse" style={{ background: "#fbbf24" }} />
              최적화 프롬프트 생성 중...
            </span>
          ) : (
            <span>
              ✦ 최적화 프롬프트 생성하기
              <span className="optimized-badge">ReAct · ToT · APE</span>
            </span>
          )}
        </button>

        {/* Result */}
        {result && (
          <div ref={resultRef} className="fade-in" style={{ marginTop: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="section-title" style={{ margin: 0 }}>
                {result.isOptimized ? "⚡ 최적화 프롬프트" : "✦ 생성된 프롬프트"}
                {result.isOptimized && <span className="optimized-badge">ReAct · ToT · APE</span>}
              </div>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? "✓ 복사됨!" : "복사하기"}
              </button>
            </div>
            <div className={result.isOptimized ? "result-box result-optimized" : "result-box"}>{result.prompt}</div>

            {result.tips?.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="section-title">활용 팁</div>
                <div className="card">
                  {result.tips.map((tip, i) => (
                    <div key={i} className="tip-item">
                      <span className="tip-dot">›</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleReset}
              style={{ marginTop: 20, background: "none", border: "none", color: "#4a4760", cursor: "pointer", fontSize: 13, padding: "8px 0", width: "100%", textAlign: "center" }}
            >
              ↺ 새 프롬프트 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
