import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type PairKey = 'USDJPY' | 'EURUSD' | 'GBPJPY' | 'AUDJPY'
type TabKey = 'market' | 'pretrade' | 'journal' | 'rules'

type MarketItem = {
  id: string
  label: string
  checked: boolean
}

type PairAnalysis = {
  pair: PairKey
  watched: boolean
  bias: '中立' | '上昇トレンド' | '下降トレンド' | 'チャンス'
  items: MarketItem[]
  memo: string
}

type JournalEntry = {
  id: string
  date: string
  pair: string
  result: 'ルール通り' | '反省あり' | '見送り'
  note: string
}

type AppState = {
  gateDate: string
  quizScore: number
  marketDate: string
  analyses: PairAnalysis[]
  pretradeDate: string
  pretrade: MarketItem[]
  journals: JournalEntry[]
  rules: string[]
}

const STORAGE_KEY = 'fx-trade-support-v1'

const baseRules = [
  '損切り位置を決める前にエントリーしない',
  '1回の許容損失は資金の1%以内',
  '重要指標の前後30分は新規エントリーしない',
  '上位足と逆方向の短期足サインだけで入らない',
  '連敗した日はロットを上げず、次のセットアップまで待つ',
]

const quizQuestions = [
  {
    question: 'エントリー前に最初に確認するものは？',
    options: ['損切り位置と許容損失', 'SNSの予想', '直近の勝敗'],
    answer: '損切り位置と許容損失',
  },
  {
    question: '重要指標の前後30分に取る行動は？',
    options: ['新規エントリーを控える', 'ロットを上げる', '短期足だけで判断する'],
    answer: '新規エントリーを控える',
  },
  {
    question: '連敗後に避けたい行動は？',
    options: ['取り返し目的のロット上げ', '見送り', '振り返りを書く'],
    answer: '取り返し目的のロット上げ',
  },
]

const pairNames: PairKey[] = ['USDJPY', 'EURUSD', 'GBPJPY', 'AUDJPY']

const biasOptions: PairAnalysis['bias'][] = [
  '中立',
  '上昇トレンド',
  '下降トレンド',
  'チャンス',
]

const defaultChecklist = [
  '日足の方向を確認',
  '4時間足の方向を確認',
  '重要水平線を確認',
  '本日の経済指標を確認',
  'エントリー候補か見送りかを決定',
]

const pretradeItems = [
  'エントリー根拠が2つ以上ある',
  '損切り位置がチャート上で明確',
  'リスクリワードが1:1.5以上',
  '許容損失内のロットになっている',
  '焦り・怒り・取り返し目的ではない',
]

const tabs: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: 'market', label: '相場分析', icon: BarChart3 },
  { key: 'pretrade', label: 'エントリー前', icon: ClipboardCheck },
  { key: 'journal', label: '日誌', icon: Edit3 },
  { key: 'rules', label: 'ルール', icon: ShieldCheck },
]

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const createChecklist = (labels: string[]) =>
  labels.map((label) => ({
    id: crypto.randomUUID(),
    label,
    checked: false,
  }))

const createAnalyses = (): PairAnalysis[] =>
  pairNames.map((pair) => ({
    pair,
    watched: true,
    bias: '中立',
    items: createChecklist(defaultChecklist),
    memo: '',
  }))

const normalizeAnalysis = (analysis: Partial<PairAnalysis>): PairAnalysis => {
  const fallback = createAnalyses().find((item) => item.pair === analysis.pair)
  const rawBias = analysis.bias as string | undefined
  const migratedBias =
    rawBias === '買い目線'
      ? '上昇トレンド'
      : rawBias === '売り目線'
        ? '下降トレンド'
        : rawBias === '見送り'
          ? '中立'
          : rawBias

  return {
    pair: (analysis.pair ?? fallback?.pair ?? 'USDJPY') as PairKey,
    watched: analysis.watched ?? true,
    bias: biasOptions.includes(migratedBias as PairAnalysis['bias'])
      ? (migratedBias as PairAnalysis['bias'])
      : '中立',
    items: analysis.items?.length
      ? analysis.items
      : createChecklist(defaultChecklist),
    memo: analysis.memo ?? '',
  }
}

const createInitialState = (): AppState => ({
  gateDate: '',
  quizScore: 0,
  marketDate: todayKey(),
  analyses: createAnalyses(),
  pretradeDate: todayKey(),
  pretrade: createChecklist(pretradeItems),
  journals: [],
  rules: baseRules,
})

const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const loaded = { ...createInitialState(), ...JSON.parse(raw) } as AppState
    const today = todayKey()
    return {
      ...loaded,
      marketDate: today,
      analyses:
        loaded.marketDate === today
          ? loaded.analyses.map(normalizeAnalysis)
          : createAnalyses(),
      pretradeDate: today,
      pretrade:
        loaded.pretradeDate === today
          ? loaded.pretrade
          : createChecklist(pretradeItems),
    }
  } catch {
    return createInitialState()
  }
}

function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [activeTab, setActiveTab] = useState<TabKey>('market')
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizCorrect, setQuizCorrect] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [selectedPair, setSelectedPair] = useState<PairKey | null>(null)
  const [ruleDraft, setRuleDraft] = useState('')
  const [journalDraft, setJournalDraft] = useState({
    pair: 'USDJPY',
    result: 'ルール通り' as JournalEntry['result'],
    note: '',
  })

  const today = todayKey()
  const gateOpen = state.gateDate !== today

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const marketProgress = useMemo(() => {
    const watchedAnalyses = state.analyses.filter((analysis) => analysis.watched)
    const items = watchedAnalyses.flatMap((analysis) => analysis.items)
    if (items.length === 0) return 0
    const done = items.filter((item) => item.checked).length
    return Math.round((done / items.length) * 100)
  }, [state.analyses])

  const watchedAnalyses = useMemo(
    () => state.analyses.filter((analysis) => analysis.watched),
    [state.analyses],
  )

  const otherAnalyses = useMemo(
    () => state.analyses.filter((analysis) => !analysis.watched),
    [state.analyses],
  )

  const selectedAnalysis = selectedPair
    ? state.analyses.find((analysis) => analysis.pair === selectedPair)
    : undefined

  const pretradeProgress = useMemo(() => {
    const done = state.pretrade.filter((item) => item.checked).length
    return Math.round((done / state.pretrade.length) * 100)
  }, [state.pretrade])

  const todayJournalCount = state.journals.filter(
    (entry) => entry.date === today,
  ).length

  const answerQuiz = (answer: string) => {
    setSelectedAnswer(answer)
    const isCorrect = answer === quizQuestions[quizIndex].answer
    const nextCorrect = quizCorrect + (isCorrect ? 1 : 0)

    window.setTimeout(() => {
      if (quizIndex === quizQuestions.length - 1) {
        if (nextCorrect === quizQuestions.length) {
          setState((current) => ({
            ...current,
            gateDate: today,
            quizScore: nextCorrect,
          }))
        } else {
          setQuizIndex(0)
          setQuizCorrect(0)
        }
      } else {
        setQuizIndex((current) => current + 1)
        setQuizCorrect(nextCorrect)
      }
      setSelectedAnswer('')
    }, 450)
  }

  const toggleMarketItem = (pair: PairKey, itemId: string) => {
    setState((current) => ({
      ...current,
      analyses: current.analyses.map((analysis) =>
        analysis.pair === pair
          ? {
              ...analysis,
              items: analysis.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item,
              ),
            }
          : analysis,
      ),
    }))
  }

  const toggleWatchedPair = (pair: PairKey) => {
    setState((current) => ({
      ...current,
      analyses: current.analyses.map((analysis) =>
        analysis.pair === pair
          ? { ...analysis, watched: !analysis.watched }
          : analysis,
      ),
    }))
  }

  const updateBias = (pair: PairKey, bias: PairAnalysis['bias']) => {
    setState((current) => ({
      ...current,
      analyses: current.analyses.map((analysis) =>
        analysis.pair === pair ? { ...analysis, bias } : analysis,
      ),
    }))
  }

  const updateMemo = (pair: PairKey, memo: string) => {
    setState((current) => ({
      ...current,
      analyses: current.analyses.map((analysis) =>
        analysis.pair === pair ? { ...analysis, memo } : analysis,
      ),
    }))
  }

  const togglePretrade = (itemId: string) => {
    setState((current) => ({
      ...current,
      pretrade: current.pretrade.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      ),
    }))
  }

  const addJournal = () => {
    if (!journalDraft.note.trim()) return
    setState((current) => ({
      ...current,
      journals: [
        {
          id: crypto.randomUUID(),
          date: today,
          pair: journalDraft.pair,
          result: journalDraft.result,
          note: journalDraft.note.trim(),
        },
        ...current.journals,
      ],
    }))
    setJournalDraft({ pair: 'USDJPY', result: 'ルール通り', note: '' })
  }

  const addRule = () => {
    if (!ruleDraft.trim()) return
    setState((current) => ({
      ...current,
      rules: [...current.rules, ruleDraft.trim()],
    }))
    setRuleDraft('')
  }

  const removeRule = (index: number) => {
    setState((current) => ({
      ...current,
      rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
    }))
  }

  const resetToday = () => {
    setState((current) => ({
      ...current,
      gateDate: '',
      marketDate: today,
      analyses: createAnalyses(),
      pretradeDate: today,
      pretrade: createChecklist(pretradeItems),
    }))
    setQuizIndex(0)
    setQuizCorrect(0)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FX Trade Support</p>
          <h1>今日の準備を、ルール通りに。</h1>
        </div>
        <button className="ghost-button" type="button" onClick={resetToday}>
          <RotateCcw size={18} />
          今日をリセット
        </button>
      </header>

      <section className="summary-grid" aria-label="今日の状態">
        <MetricCard
          icon={CalendarCheck}
          label="朝の確認"
          value={state.gateDate === today ? '完了' : '未完了'}
          tone={state.gateDate === today ? 'good' : 'warn'}
        />
        <MetricCard
          icon={TrendingUp}
          label="相場分析"
          value={`${marketProgress}%`}
          tone={marketProgress === 100 ? 'good' : 'neutral'}
        />
        <MetricCard
          icon={Target}
          label="エントリー前"
          value={`${pretradeProgress}%`}
          tone={pretradeProgress === 100 ? 'good' : 'warn'}
        />
        <MetricCard
          icon={BookOpenCheck}
          label="本日の日誌"
          value={`${todayJournalCount}件`}
          tone="neutral"
        />
      </section>

      <nav className="tabbar" aria-label="メインメニュー">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              className={activeTab === tab.key ? 'active' : ''}
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'market' && (
        <section className="workspace">
          <SectionHeader
            title="今日の相場分析"
            description="監視通貨ごとに、方向・水平線・指標・見送り判断をチェックします。"
          />
          <aside className="watch-list" aria-label="ウォッチリスト">
            <div className="watch-list-heading">
              <div>
                <p className="eyebrow">Watch List</p>
                <h2>ウォッチリスト</h2>
              </div>
            </div>
            <div className="watch-list-groups">
              <div className="watch-list-group">
                <h3>監視中ペア</h3>
                {watchedAnalyses.length > 0 ? (
                  <div className="watch-chips">
                    {watchedAnalyses.map((analysis) => (
                      <span className="watch-chip" key={analysis.pair}>
                        <Check size={14} />
                        {analysis.pair}
                        <small>{analysis.bias}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">監視中の通貨ペアがありません。</p>
                )}
              </div>
              <div className="watch-list-group">
                <h3>その他</h3>
                {otherAnalyses.length > 0 ? (
                  <div className="watch-chips secondary">
                    {otherAnalyses.map((analysis) => (
                      <span className="watch-chip secondary" key={analysis.pair}>
                        {analysis.pair}
                        <small>{analysis.bias}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">その他の通貨ペアはありません。</p>
                )}
              </div>
            </div>
          </aside>
          <div className="pair-list-groups">
            <PairListGroup
              analyses={watchedAnalyses}
              title="監視中ペア"
              onSelect={setSelectedPair}
            />
            <PairListGroup
              analyses={otherAnalyses}
              title="その他"
              onSelect={setSelectedPair}
            />
          </div>
        </section>
      )}

      {activeTab === 'pretrade' && (
        <section className="workspace split-layout">
          <div>
            <SectionHeader
              title="エントリー前チェック"
              description="すべて満たすまで、取引OKにしないための最終確認です。"
            />
            <div className="large-checklist">
              {state.pretrade.map((item) => (
                <button
                  className={item.checked ? 'large-check done' : 'large-check'}
                  key={item.id}
                  type="button"
                  onClick={() => togglePretrade(item.id)}
                >
                  <span>{item.checked && <Check size={16} />}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <aside className="decision-panel">
            <ShieldCheck size={28} />
            <p className="eyebrow">TRADE DECISION</p>
            <h2>{pretradeProgress === 100 ? '取引OK' : 'まだ待つ'}</h2>
            <p>
              {pretradeProgress === 100
                ? '条件は揃っています。ロットを守って淡々と実行。'
                : '未確認項目があります。焦りがある日は見送りも正解です。'}
            </p>
          </aside>
        </section>
      )}

      {activeTab === 'journal' && (
        <section className="workspace split-layout">
          <div>
            <SectionHeader
              title="トレード日誌"
              description="勝敗より、ルール通りに判断できたかを残します。"
            />
            <div className="journal-form">
              <div className="field-row">
                <label>
                  通貨
                  <select
                    value={journalDraft.pair}
                    onChange={(event) =>
                      setJournalDraft((current) => ({
                        ...current,
                        pair: event.target.value,
                      }))
                    }
                  >
                    {pairNames.map((pair) => (
                      <option key={pair}>{pair}</option>
                    ))}
                  </select>
                </label>
                <label>
                  評価
                  <select
                    value={journalDraft.result}
                    onChange={(event) =>
                      setJournalDraft((current) => ({
                        ...current,
                        result: event.target.value as JournalEntry['result'],
                      }))
                    }
                  >
                    <option>ルール通り</option>
                    <option>反省あり</option>
                    <option>見送り</option>
                  </select>
                </label>
              </div>
              <textarea
                aria-label="日誌本文"
                placeholder="根拠、感情、改善点を短く記録"
                value={journalDraft.note}
                onChange={(event) =>
                  setJournalDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
              <button className="primary-button" type="button" onClick={addJournal}>
                <Plus size={18} />
                日誌を追加
              </button>
            </div>
          </div>
          <div className="journal-list" aria-label="日誌一覧">
            {state.journals.length === 0 ? (
              <p className="empty-state">まだ日誌はありません。</p>
            ) : (
              state.journals.slice(0, 8).map((entry) => (
                <article className="journal-entry" key={entry.id}>
                  <div>
                    <strong>{entry.pair}</strong>
                    <span>{entry.date}</span>
                  </div>
                  <p className="tag">{entry.result}</p>
                  <p>{entry.note}</p>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'rules' && (
        <section className="workspace split-layout">
          <div>
            <SectionHeader
              title="毎朝確認するルール"
              description="自分の負けパターンに合わせて、朝の確認文を育てます。"
            />
            <ol className="rule-list">
              {state.rules.map((rule, index) => (
                <li key={rule}>
                  <span>{rule}</span>
                  <button
                    aria-label={`${rule}を削除`}
                    type="button"
                    onClick={() => removeRule(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="rule-form">
            <label>
              新しいルール
              <textarea
                placeholder="例: 東京時間のレンジ中はブレイク確定まで待つ"
                value={ruleDraft}
                onChange={(event) => setRuleDraft(event.target.value)}
              />
            </label>
            <button className="primary-button" type="button" onClick={addRule}>
              <Plus size={18} />
              ルールを追加
            </button>
          </div>
        </section>
      )}

      {gateOpen && (
        <div className="gate-backdrop" role="dialog" aria-modal="true">
          <section className="gate-panel">
            <div className="gate-icon">
              <Lock size={24} />
            </div>
            <p className="eyebrow">Morning Gate</p>
            <h2>今日のルール確認</h2>
            <div className="rule-preview">
              {state.rules.slice(0, 3).map((rule) => (
                <p key={rule}>
                  <CheckCircle2 size={16} />
                  {rule}
                </p>
              ))}
            </div>
            <div className="quiz-box">
              <p className="quiz-count">
                {quizIndex + 1} / {quizQuestions.length}
              </p>
              <h3>{quizQuestions[quizIndex].question}</h3>
              <div className="quiz-options">
                {quizQuestions[quizIndex].options.map((option) => (
                  <button
                    className={
                      selectedAnswer === option
                        ? option === quizQuestions[quizIndex].answer
                          ? 'correct'
                          : 'wrong'
                        : ''
                    }
                    key={option}
                    type="button"
                    onClick={() => answerQuiz(option)}
                    disabled={Boolean(selectedAnswer)}
                  >
                    {option}
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </div>
            <p className="gate-note">
              全問正解すると、今日の分析画面に進めます。
            </p>
          </section>
        </div>
      )}

      {selectedAnalysis && (
        <div
          className="detail-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pair-detail-title"
        >
          <section className="pair-detail-panel">
            <header className="pair-detail-header">
              <div>
                <p className="eyebrow">Pair Detail</p>
                <h2 id="pair-detail-title">{selectedAnalysis.pair}</h2>
              </div>
              <button
                aria-label="詳細を閉じる"
                className="icon-button"
                type="button"
                onClick={() => setSelectedPair(null)}
              >
                <X size={20} />
              </button>
            </header>
            <button
              className={
                selectedAnalysis.watched
                  ? 'watch-toggle active'
                  : 'watch-toggle'
              }
              type="button"
              onClick={() => toggleWatchedPair(selectedAnalysis.pair)}
            >
              <span>
                {selectedAnalysis.watched ? (
                  <Check size={14} />
                ) : (
                  <Square size={14} />
                )}
              </span>
              {selectedAnalysis.watched ? '監視中' : '監視外'}
            </button>
            <div
              className="bias-segments"
              aria-label={`${selectedAnalysis.pair}のカテゴリ`}
            >
              {biasOptions.map((bias) => (
                <button
                  className={selectedAnalysis.bias === bias ? 'active' : ''}
                  key={bias}
                  type="button"
                  onClick={() => updateBias(selectedAnalysis.pair, bias)}
                >
                  {bias}
                </button>
              ))}
            </div>
            <div className="checklist">
              {selectedAnalysis.items.map((item) => (
                <button
                  className={item.checked ? 'check-row done' : 'check-row'}
                  key={item.id}
                  type="button"
                  onClick={() => toggleMarketItem(selectedAnalysis.pair, item.id)}
                >
                  <span>{item.checked && <Check size={14} />}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <textarea
              aria-label={`${selectedAnalysis.pair}のメモ`}
              placeholder="根拠、見送り理由、注目価格など"
              value={selectedAnalysis.memo}
              onChange={(event) =>
                updateMemo(selectedAnalysis.pair, event.target.value)
              }
            />
          </section>
        </div>
      )}
    </main>
  )
}

function PairListGroup({
  analyses,
  onSelect,
  title,
}: {
  analyses: PairAnalysis[]
  onSelect: (pair: PairKey) => void
  title: string
}) {
  return (
    <section className="pair-list-section">
      <h3>{title}</h3>
      {analyses.length > 0 ? (
        <div className="pair-list">
          {analyses.map((analysis) => (
            <button
              className={analysis.watched ? 'pair-row' : 'pair-row muted'}
              key={analysis.pair}
              type="button"
              onClick={() => onSelect(analysis.pair)}
            >
              <span>{analysis.pair}</span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-state">該当する通貨ペアはありません。</p>
      )}
    </section>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BarChart3
  label: string
  value: string
  tone: 'good' | 'warn' | 'neutral'
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <Icon size={20} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="section-header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  )
}

export default App
