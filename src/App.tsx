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
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type PairKey = 'USDJPY' | 'EURUSD' | 'GBPJPY' | 'AUDJPY'
type TabKey = 'market' | 'pretrade' | 'journal' | 'rules'
type PairStatus = '環境認識前' | '監視中' | '環境認識後'

type MarketItem = {
  id: string
  label: string
  checked: boolean
}

type PairAnalysis = {
  pair: PairKey
  status: PairStatus
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
  '月間損失上限は250,000円。上限に達したらその月は新規エントリーしない',
  '1トレードの許容損失は50,000円までに固定する',
  '月の目標トレード回数は5回。無理に回数を埋めない',
  '監視銘柄は毎月1日に4通貨だけ選別し、各通貨は月1〜2本を目安にする',
  '環境認識はH4〜M15で行い、H4・H1が上昇トレンドでない場合は見送る',
  'H4でチャネル上限から折り返している局面はエントリーしない',
  'H1最安値起点のラインを上抜けていない場合はエントリーしない',
  'H1最安値起点ラインを上抜けた後の押し目が半値戻し付近でない場合は見送る',
  '1本目はH1上昇チャネル下限付近だけを候補にする',
  'M15下降チャネルの安値更新失敗を確認する',
  'M15下降チャネルを逆ブレイクした後だけを候補にする',
  'M15が上昇転換した後、下降チャネルのロールリバーサル付近で入る',
  '1本目の損切りはM15上昇転換の起点の安値に置く',
  'RRが1.5〜3に収まる場面だけを狙う',
  '2本目前に1本目のストップを建値または微益へ移動し、1本目をリスクフリーにする',
  '2本目以降の追加リスクは最大15,000円までにする',
  '追加ロットは必ず前回より小さくする',
  '1本目が含み益でない状態の追加エントリーは禁止する',
  'M15で新しい押し安値を作って高値更新したら、全ポジションのストップをその押し安値の少し下へ引き上げる',
]

const oldBaseRules = [
  '損切り位置を決める前にエントリーしない',
  '1回の許容損失は資金の1%以内',
  '重要指標の前後30分は新規エントリーしない',
  '上位足と逆方向の短期足サインだけで入らない',
  '連敗した日はロットを上げず、次のセットアップまで待つ',
]

const quizQuestions = [
  {
    question: '1トレードの許容損失額は？',
    options: ['50,000円', '15,000円', '250,000円'],
    answer: '50,000円',
  },
  {
    question: '1本目の損切り位置は？',
    options: ['M15上昇転換の起点の安値', 'H1チャネル上限', '直近高値の少し上'],
    answer: 'M15上昇転換の起点の安値',
  },
  {
    question: '2本目を入れる前に必ず行うことは？',
    options: [
      '1本目のストップを建値または微益へ移動',
      '1本目のロットを増やす',
      '含み損のまま平均建値を下げる',
    ],
    answer: '1本目のストップを建値または微益へ移動',
  },
]

const pairNames: PairKey[] = ['USDJPY', 'EURUSD', 'GBPJPY', 'AUDJPY']
const pairStatuses: PairStatus[] = ['環境認識前', '監視中', '環境認識後']

const biasOptions: PairAnalysis['bias'][] = [
  '中立',
  '上昇トレンド',
  '下降トレンド',
  'チャンス',
]

const defaultChecklist = [
  '月初に選別した4通貨の中だけを確認',
  'H4でチャネル上限から折り返していない',
  'H4・H1が上昇トレンド',
  'H1最安値起点ラインを上抜け済み',
  '上抜け後の押し目が半値戻し付近',
  'H1上昇チャネル下限付近',
  'M15下降チャネルの安値更新失敗を確認',
  'M15下降チャネルの逆ブレイクを確認',
  'M15上昇転換後の下降チャネル・ロールリバーサル付近',
  'RR 1.5〜3の利確候補がある',
]

const oldDefaultChecklist = [
  '日足の方向を確認',
  '4時間足の方向を確認',
  '重要水平線を確認',
  '本日の経済指標を確認',
  'エントリー候補か見送りかを決定',
]

const pretradeItems = [
  '月間損失上限250,000円までの残枠がある',
  '今回の損失額は50,000円以内',
  '月5回の計画を超える無理なエントリーではない',
  'H4チャネル上限からの折り返しではない',
  'H4・H1が上昇トレンド',
  'H1最安値起点ラインを上抜け後、押し目が半値戻し付近',
  'H1上昇チャネル下限付近',
  'M15下降チャネル安値更新失敗を確認済み',
  'M15下降チャネル逆ブレイクを確認済み',
  'M15上昇転換後の下降チャネル・ロールリバーサル付近',
  '損切りはM15上昇転換の起点の安値',
  'RRは1.5〜3に収まっている',
  '増し玉時のみ: 既存ポジションは含み益で、ストップを建値または微益に移動済み',
  '増し玉時のみ: 追加ロットは前回より小さく、追加リスクは最大15,000円',
  '焦り・怒り・取り返し目的ではない',
]

const oldPretradeItems = [
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

const hasSameLabels = (items: MarketItem[] | undefined, labels: string[]) =>
  Boolean(
    items?.length === labels.length &&
      items.every((item, index) => item.label === labels[index]),
  )

const normalizeChecklist = (
  items: MarketItem[] | undefined,
  labels: string[],
  oldLabels: string[],
) => {
  if (!items?.length || hasSameLabels(items, oldLabels)) {
    return createChecklist(labels)
  }
  return items
}

const startsWithRules = (rules: string[], prefix: string[]) =>
  prefix.every((rule, index) => rules[index] === rule)

const normalizeRules = (rules: string[] | undefined) => {
  if (!rules?.length) return baseRules
  if (startsWithRules(rules, oldBaseRules)) {
    const customRules = rules
      .slice(oldBaseRules.length)
      .filter((rule) => !baseRules.includes(rule))
    return [...baseRules, ...customRules]
  }
  return rules
}

const createShuffledQuiz = () =>
  quizQuestions.map((question) => ({
    ...question,
    options: [...question.options].sort(() => Math.random() - 0.5),
  }))

const createAnalyses = (): PairAnalysis[] =>
  pairNames.map((pair) => ({
    pair,
    status: '環境認識前',
    bias: '中立',
    items: createChecklist(defaultChecklist),
    memo: '',
  }))

const normalizeAnalysis = (
  analysis: Partial<PairAnalysis> & { watched?: boolean },
): PairAnalysis => {
  const fallback = createAnalyses().find((item) => item.pair === analysis.pair)
  const rawBias = analysis.bias as string | undefined
  const rawStatus = analysis.status as string | undefined
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
    status: pairStatuses.includes(rawStatus as PairStatus)
      ? (rawStatus as PairStatus)
      : analysis.watched === false
        ? '環境認識後'
        : '監視中',
    bias: biasOptions.includes(migratedBias as PairAnalysis['bias'])
      ? (migratedBias as PairAnalysis['bias'])
      : '中立',
    items: normalizeChecklist(
      analysis.items,
      defaultChecklist,
      oldDefaultChecklist,
    ),
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
          ? normalizeChecklist(loaded.pretrade, pretradeItems, oldPretradeItems)
          : createChecklist(pretradeItems),
      rules: normalizeRules(loaded.rules),
    }
  } catch {
    return createInitialState()
  }
}

function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [activeTab, setActiveTab] = useState<TabKey>('market')
  const [shuffledQuiz, setShuffledQuiz] = useState(createShuffledQuiz)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizCorrect, setQuizCorrect] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [selectedPair, setSelectedPair] = useState<PairKey | null>(null)
  const [recognitionPair, setRecognitionPair] = useState<PairKey | null>(null)
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
    const completed = state.analyses.filter(
      (analysis) => analysis.status !== '環境認識前',
    ).length
    return Math.round((completed / state.analyses.length) * 100)
  }, [state.analyses])

  const beforeAnalyses = useMemo(
    () => state.analyses.filter((analysis) => analysis.status === '環境認識前'),
    [state.analyses],
  )

  const watchedAnalyses = useMemo(
    () => state.analyses.filter((analysis) => analysis.status === '監視中'),
    [state.analyses],
  )

  const afterAnalyses = useMemo(
    () => state.analyses.filter((analysis) => analysis.status === '環境認識後'),
    [state.analyses],
  )

  const selectedAnalysis = selectedPair
    ? state.analyses.find((analysis) => analysis.pair === selectedPair)
    : undefined

  const activeRecognitionPair =
    recognitionPair ?? (!gateOpen ? beforeAnalyses[0]?.pair ?? null : null)

  const recognitionAnalysis = activeRecognitionPair
    ? state.analyses.find((analysis) => analysis.pair === activeRecognitionPair)
    : undefined
  const recognitionStep = recognitionAnalysis
    ? state.analyses.length - beforeAnalyses.length + 1
    : state.analyses.length - beforeAnalyses.length

  const pretradeProgress = useMemo(() => {
    const done = state.pretrade.filter((item) => item.checked).length
    return Math.round((done / state.pretrade.length) * 100)
  }, [state.pretrade])

  const todayJournalCount = state.journals.filter(
    (entry) => entry.date === today,
  ).length

  const answerQuiz = (answer: string) => {
    setSelectedAnswer(answer)
    const isCorrect = answer === shuffledQuiz[quizIndex].answer
    const nextCorrect = quizCorrect + (isCorrect ? 1 : 0)

    window.setTimeout(() => {
      if (quizIndex === shuffledQuiz.length - 1) {
        if (nextCorrect === shuffledQuiz.length) {
          setState((current) => ({
            ...current,
            gateDate: today,
            quizScore: nextCorrect,
          }))
        } else {
          setQuizIndex(0)
          setQuizCorrect(0)
          setShuffledQuiz(createShuffledQuiz())
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

  const updatePairStatus = (pair: PairKey, status: PairStatus) => {
    setState((current) => ({
      ...current,
      analyses: current.analyses.map((analysis) =>
        analysis.pair === pair ? { ...analysis, status } : analysis,
      ),
    }))
  }

  const completeRecognition = (pair: PairKey, status: '監視中' | '環境認識後') => {
    const currentIndex = state.analyses.findIndex(
      (analysis) => analysis.pair === pair,
    )
    const nextPair = state.analyses
      .slice(currentIndex + 1)
      .find((analysis) => analysis.status === '環境認識前')?.pair

    updatePairStatus(pair, status)
    setRecognitionPair(nextPair ?? null)
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
    setShuffledQuiz(createShuffledQuiz())
    setSelectedPair(null)
    setRecognitionPair(null)
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
            description="H4〜M15で上昇トレンド、チャネル位置、見送り条件を確認します。"
          />
          <aside className="watch-list" aria-label="ウォッチリスト">
            <div className="watch-list-heading">
              <div>
                <p className="eyebrow">Watch List</p>
                <h2>環境認識ステータス</h2>
              </div>
            </div>
            <div className="watch-list-groups">
              <div className="watch-list-group">
                <h3>環境認識前</h3>
                {beforeAnalyses.length > 0 ? (
                  <div className="watch-chips pending">
                    {beforeAnalyses.map((analysis) => (
                      <button
                        className="watch-chip pending"
                        key={analysis.pair}
                        type="button"
                        onClick={() => setSelectedPair(analysis.pair)}
                      >
                        {analysis.pair}
                        <small>{analysis.bias}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">未確認の通貨ペアはありません。</p>
                )}
              </div>
              <div className="watch-list-group">
                <h3>監視中</h3>
                {watchedAnalyses.length > 0 ? (
                  <div className="watch-chips">
                    {watchedAnalyses.map((analysis) => (
                      <button
                        className="watch-chip"
                        key={analysis.pair}
                        type="button"
                        onClick={() => setSelectedPair(analysis.pair)}
                      >
                        <Check size={14} />
                        {analysis.pair}
                        <small>{analysis.bias}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">監視中の通貨ペアがありません。</p>
                )}
              </div>
              <div className="watch-list-group">
                <h3>環境認識後</h3>
                {afterAnalyses.length > 0 ? (
                  <div className="watch-chips secondary">
                    {afterAnalyses.map((analysis) => (
                      <button
                        className="watch-chip secondary"
                        key={analysis.pair}
                        type="button"
                        onClick={() => setSelectedPair(analysis.pair)}
                      >
                        {analysis.pair}
                        <small>{analysis.bias}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">放置した通貨ペアはありません。</p>
                )}
              </div>
            </div>
          </aside>
          <PairList analyses={state.analyses} onSelect={setSelectedPair} />
        </section>
      )}

      {activeTab === 'pretrade' && (
        <section className="workspace split-layout">
          <div>
            <SectionHeader
              title="エントリー前チェック"
              description="1本目と増し玉の条件がすべて揃った時だけ取引OKにします。"
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
                ? '条件は揃っています。損失額と損切り位置を守って淡々と実行。'
                : '未確認項目があります。1つでも欠けたら見送りです。'}
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
              title="トレードルール"
              description="月間損失、エントリー条件、見送り条件、増し玉と決済を固定します。"
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
                placeholder="例: 重要指標の前後30分は新規エントリーしない"
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
                {quizIndex + 1} / {shuffledQuiz.length}
              </p>
              <h3>{shuffledQuiz[quizIndex].question}</h3>
              <div className="quiz-options">
                {shuffledQuiz[quizIndex].options.map((option) => (
                  <button
                    className={
                      selectedAnswer === option
                        ? option === shuffledQuiz[quizIndex].answer
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

      {recognitionAnalysis && (
        <div
          className="recognition-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recognition-title"
        >
          <section className="recognition-panel">
            <header className="pair-detail-header">
              <div>
                <p className="eyebrow">
                  Environment Check {recognitionStep} / {state.analyses.length}
                </p>
                <h2 id="recognition-title">{recognitionAnalysis.pair}</h2>
              </div>
              <span className="status-pill">{recognitionAnalysis.status}</span>
            </header>
            <div
              className="bias-segments"
              aria-label={`${recognitionAnalysis.pair}のカテゴリ`}
            >
              {biasOptions.map((bias) => (
                <button
                  className={recognitionAnalysis.bias === bias ? 'active' : ''}
                  key={bias}
                  type="button"
                  onClick={() => updateBias(recognitionAnalysis.pair, bias)}
                >
                  {bias}
                </button>
              ))}
            </div>
            <div className="checklist">
              {recognitionAnalysis.items.map((item) => (
                <button
                  className={item.checked ? 'check-row done' : 'check-row'}
                  key={item.id}
                  type="button"
                  onClick={() =>
                    toggleMarketItem(recognitionAnalysis.pair, item.id)
                  }
                >
                  <span>{item.checked && <Check size={14} />}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <textarea
              aria-label={`${recognitionAnalysis.pair}のメモ`}
              placeholder="根拠、見送り理由、注目価格など"
              value={recognitionAnalysis.memo}
              onChange={(event) =>
                updateMemo(recognitionAnalysis.pair, event.target.value)
              }
            />
            <div className="recognition-actions">
              <button
                className="pass-button"
                type="button"
                onClick={() =>
                  completeRecognition(recognitionAnalysis.pair, '環境認識後')
                }
              >
                <X size={20} />
                放置する
              </button>
              <button
                className="watch-button"
                type="button"
                onClick={() =>
                  completeRecognition(recognitionAnalysis.pair, '監視中')
                }
              >
                <Check size={20} />
                監視する
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedAnalysis && !recognitionAnalysis && (
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
            <div
              className="status-segments"
              aria-label={`${selectedAnalysis.pair}の管理カテゴリ`}
            >
              {pairStatuses.map((status) => (
                <button
                  className={selectedAnalysis.status === status ? 'active' : ''}
                  key={status}
                  type="button"
                  onClick={() => updatePairStatus(selectedAnalysis.pair, status)}
                >
                  {status}
                </button>
              ))}
            </div>
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

function PairList({
  analyses,
  onSelect,
}: {
  analyses: PairAnalysis[]
  onSelect: (pair: PairKey) => void
}) {
  return (
    <section className="pair-list-section">
      <h3>通貨ペアリスト</h3>
      <div className="pair-list">
        {analyses.map((analysis) => (
          <button
            className={
              analysis.status === '環境認識前'
                ? 'pair-row pending'
                : analysis.status === '監視中'
                  ? 'pair-row'
                  : 'pair-row muted'
            }
            key={analysis.pair}
            type="button"
            onClick={() => onSelect(analysis.pair)}
          >
            <span>{analysis.pair}</span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
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
