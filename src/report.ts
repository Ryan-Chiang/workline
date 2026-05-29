import type { AgentContextWindow, AgentFacts, ReportWindow, SessionFacts, TokenUsage, ToolEvidence, WorkItem, CommandEvidence } from './types.ts';
import { reportLanguageName, type ReportLanguage } from './locale.ts';
import { formatInTimezone } from './time.ts';
import {
  boundedContextAgentTaskGuidance,
  finalReportEvidenceGuidance,
  outcomeAgentTaskGuidance,
  transactionalAgentTaskGuidance,
  weeklyAgentContextHarnessGuidance,
  workTopicAgentTaskGuidance,
} from './weekly-guidance.ts';

type ReportText = {
  title: string;
  period: string;
  timezone: string;
  generated: string;
  finalReportPath: string;
  noFactsTitle: string;
  extractedFacts: string;
  project: string;
  surface: string;
  completedWork: string;
  candidateCompletedWork: string;
  inProgressWork: string;
  needsConfirmationWork: string;
  commandEvidence: string;
  tokenUsage: string;
  warnings: string;
  evidenceIndex: string;
  none: string;
  unknownProject: string;
  approximate: string;
  tokenWarning: (sessionId: string) => string;
  lowConfidencePrefix: string;
  agentContextTitle: string;
  agentTask: string;
  agentTaskRead: string;
  agentTaskWrite: string;
  agentTaskConfidence: string;
  agentTaskEvidence: string;
};

// 这里只维护固定 UI/报告外壳文案；提取到的 summary、命令、路径和证据文本保持原文。
const textByLanguage: Record<ReportLanguage, ReportText> = {
  en: {
    title: 'Workline Weekly Fact Summary',
    period: 'Period',
    timezone: 'Timezone',
    generated: 'Generated',
    finalReportPath: 'Final report path',
    noFactsTitle: 'No local Agent session facts found',
    extractedFacts: 'Extracted facts',
    project: 'Project',
    surface: 'Surface',
    completedWork: 'Completed work',
    candidateCompletedWork: 'Candidate completed work',
    inProgressWork: 'In-progress / to-confirm work',
    needsConfirmationWork: 'In progress / needs confirmation',
    commandEvidence: 'Command evidence',
    tokenUsage: 'Token usage',
    warnings: 'Warnings and low-confidence notes',
    evidenceIndex: 'Evidence index',
    none: 'None',
    unknownProject: 'Unknown project',
    approximate: 'approximate',
    tokenWarning: (sessionId) => `Token usage for session ${sessionId} is approximate because no pre-window baseline was found.`,
    lowConfidencePrefix: 'Agent message',
    agentContextTitle: 'Workline Weekly Agent Context',
    agentTask: 'Agent task',
    agentTaskRead: 'Read these extracted local facts and write a management-oriented weekly report.',
    agentTaskWrite: 'Write the final Markdown report to the final report path above.',
    agentTaskConfidence: 'Do not automatically exclude low-confidence content; keep a concise confidence or evidence marker when including it.',
    agentTaskEvidence: 'Attach outcome references only when an outcome has a clear deliverable; do not create a standalone evidence appendix unless the user asks.',
  },
  'zh-Hans': {
    title: 'Workline 周报事实摘要',
    period: '周期',
    timezone: '时区',
    generated: '生成时间',
    finalReportPath: '最终报告路径',
    noFactsTitle: '未找到本地 Agent 会话事实',
    extractedFacts: '提取事实',
    project: '项目',
    surface: '界面',
    completedWork: '已完成工作',
    candidateCompletedWork: '候选已完成工作',
    inProgressWork: '进行中 / 待确认工作',
    needsConfirmationWork: '进行中 / 待确认',
    commandEvidence: '命令证据',
    tokenUsage: 'Token 使用量',
    warnings: '警告和低置信度说明',
    evidenceIndex: '证据索引',
    none: '无',
    unknownProject: '未知项目',
    approximate: '近似',
    tokenWarning: (sessionId) => `会话 ${sessionId} 的 token 使用量为近似值，因为没有找到周期前基线。`,
    lowConfidencePrefix: 'Agent 消息',
    agentContextTitle: 'Workline 周报 Agent 上下文',
    agentTask: 'Agent 任务',
    agentTaskRead: '阅读这些提取出的本地事实，并写出面向管理汇报的周报。',
    agentTaskWrite: '将最终 Markdown 周报写入上方最终报告路径。',
    agentTaskConfidence: '不要自动排除低置信度内容；纳入时保留简洁的置信度或证据标记。',
    agentTaskEvidence: '只有 outcome 形成明确交付成果时，才把可访问链接或定位信息自然融入正文；除非用户要求，不要单独创建证据附录。',
  },
  'zh-Hant': {
    title: 'Workline 週報事實摘要',
    period: '週期',
    timezone: '時區',
    generated: '產生時間',
    finalReportPath: '最終報告路徑',
    noFactsTitle: '未找到本機 Agent 會話事實',
    extractedFacts: '擷取事實',
    project: '專案',
    surface: '介面',
    completedWork: '已完成工作',
    candidateCompletedWork: '候選已完成工作',
    inProgressWork: '進行中 / 待確認工作',
    needsConfirmationWork: '進行中 / 待確認',
    commandEvidence: '命令證據',
    tokenUsage: 'Token 使用量',
    warnings: '警告和低信心說明',
    evidenceIndex: '證據索引',
    none: '無',
    unknownProject: '未知專案',
    approximate: '近似',
    tokenWarning: (sessionId) => `會話 ${sessionId} 的 token 使用量為近似值，因為沒有找到週期前基線。`,
    lowConfidencePrefix: 'Agent 訊息',
    agentContextTitle: 'Workline 週報 Agent 上下文',
    agentTask: 'Agent 任務',
    agentTaskRead: '閱讀這些擷取出的本地事實，並寫出面向管理彙報的週報。',
    agentTaskWrite: '將最終 Markdown 週報寫入上方最終報告路徑。',
    agentTaskConfidence: '不要自動排除低信心內容；納入時保留簡潔的信心或證據標記。',
    agentTaskEvidence: '可用時將證據引用附在成果項目上；除非使用者要求，不要單獨建立證據附錄。',
  },
  ja: {
    title: 'Workline 週次ファクトサマリー',
    period: '期間',
    timezone: 'タイムゾーン',
    generated: '生成日時',
    finalReportPath: '最終レポートパス',
    noFactsTitle: 'ローカル Agent セッションの事実が見つかりません',
    extractedFacts: '抽出された事実',
    project: 'プロジェクト',
    surface: 'サーフェス',
    completedWork: '完了した作業',
    candidateCompletedWork: '完了候補の作業',
    inProgressWork: '進行中 / 確認が必要な作業',
    needsConfirmationWork: '進行中 / 確認が必要',
    commandEvidence: 'コマンド証跡',
    tokenUsage: 'Token 使用量',
    warnings: '警告と低信頼度メモ',
    evidenceIndex: '証跡索引',
    none: 'なし',
    unknownProject: '不明なプロジェクト',
    approximate: '概算',
    tokenWarning: (sessionId) => `セッション ${sessionId} の token 使用量は、期間前の基準値がないため概算です。`,
    lowConfidencePrefix: 'Agent メッセージ',
    agentContextTitle: 'Workline 週次 Agent コンテキスト',
    agentTask: 'Agent タスク',
    agentTaskRead: '抽出されたローカル事実を読み、管理向けの週次レポートを書いてください。',
    agentTaskWrite: '最終 Markdown レポートを上記の最終レポートパスに書き込んでください。',
    agentTaskConfidence: '低信頼度の内容を自動的に除外しないでください。含める場合は簡潔な信頼度または証跡マーカーを残してください。',
    agentTaskEvidence: '可能な場合は成果項目に証跡参照を付けてください。ユーザーが求めない限り、独立した証跡付録は作らないでください。',
  },
  ko: {
    title: 'Workline 주간 사실 요약',
    period: '기간',
    timezone: '시간대',
    generated: '생성 시간',
    finalReportPath: '최종 보고서 경로',
    noFactsTitle: '로컬 Agent 세션 사실을 찾을 수 없음',
    extractedFacts: '추출된 사실',
    project: '프로젝트',
    surface: '표면',
    completedWork: '완료된 작업',
    candidateCompletedWork: '완료 후보 작업',
    inProgressWork: '진행 중 / 확인 필요 작업',
    needsConfirmationWork: '진행 중 / 확인 필요',
    commandEvidence: '명령 증거',
    tokenUsage: 'Token 사용량',
    warnings: '경고 및 낮은 신뢰도 메모',
    evidenceIndex: '증거 색인',
    none: '없음',
    unknownProject: '알 수 없는 프로젝트',
    approximate: '추정',
    tokenWarning: (sessionId) => `세션 ${sessionId}의 token 사용량은 기간 전 기준값이 없어 추정치입니다.`,
    lowConfidencePrefix: 'Agent 메시지',
    agentContextTitle: 'Workline 주간 Agent 컨텍스트',
    agentTask: '에이전트 작업',
    agentTaskRead: '추출된 로컬 사실을 읽고 관리용 주간 보고서를 작성하세요.',
    agentTaskWrite: '최종 Markdown 보고서를 위의 최종 보고서 경로에 작성하세요.',
    agentTaskConfidence: '낮은 신뢰도 내용을 자동으로 제외하지 마세요. 포함할 때는 간단한 신뢰도 또는 증거 표시를 남기세요.',
    agentTaskEvidence: '가능하면 성과 항목에 증거 참조를 붙이세요. 사용자가 요청하지 않는 한 별도 증거 부록을 만들지 마세요.',
  },
  es: {
    title: 'Resumen de hechos semanal de Workline',
    period: 'Periodo',
    timezone: 'Zona horaria',
    generated: 'Generado',
    finalReportPath: 'Ruta del informe final',
    noFactsTitle: 'No se encontraron hechos de sesiones locales de Agent',
    extractedFacts: 'Hechos extraidos',
    project: 'Proyecto',
    surface: 'Superficie',
    completedWork: 'Trabajo completado',
    candidateCompletedWork: 'Trabajo completado candidato',
    inProgressWork: 'En curso / requiere confirmacion',
    needsConfirmationWork: 'En curso / requiere confirmacion',
    commandEvidence: 'Evidencia de comandos',
    tokenUsage: 'Uso de tokens',
    warnings: 'Advertencias y notas de baja confianza',
    evidenceIndex: 'Indice de evidencia',
    none: 'Ninguno',
    unknownProject: 'Proyecto desconocido',
    approximate: 'aproximado',
    tokenWarning: (sessionId) => `El uso de tokens de la sesion ${sessionId} es aproximado porque no se encontro una linea base anterior al periodo.`,
    lowConfidencePrefix: 'Mensaje del agente',
    agentContextTitle: 'Contexto semanal de Agent de Workline',
    agentTask: 'Tarea del agente',
    agentTaskRead: 'Lee estos hechos locales extraidos y escribe un informe semanal orientado a gestion.',
    agentTaskWrite: 'Escribe el informe final en Markdown en la ruta del informe final indicada arriba.',
    agentTaskConfidence: 'No excluyas automaticamente contenido de baja confianza; si lo incluyes, conserva una marca breve de confianza o evidencia.',
    agentTaskEvidence: 'Adjunta referencias de evidencia a los logros cuando existan; no crees un apendice de evidencia separado salvo que el usuario lo pida.',
  },
  fr: {
    title: 'Synthese factuelle hebdomadaire Workline',
    period: 'Periode',
    timezone: 'Fuseau horaire',
    generated: 'Genere',
    finalReportPath: 'Chemin du rapport final',
    noFactsTitle: 'Aucun fait de session Agent locale trouve',
    extractedFacts: 'Faits extraits',
    project: 'Projet',
    surface: 'Surface',
    completedWork: 'Travail terminé',
    candidateCompletedWork: 'Travail termine candidat',
    inProgressWork: 'En cours / a confirmer',
    needsConfirmationWork: 'En cours / a confirmer',
    commandEvidence: 'Preuves de commandes',
    tokenUsage: 'Utilisation des tokens',
    warnings: 'Avertissements et notes de faible confiance',
    evidenceIndex: 'Index des preuves',
    none: 'Aucun',
    unknownProject: 'Projet inconnu',
    approximate: 'approximatif',
    tokenWarning: (sessionId) => `L'utilisation des tokens pour la session ${sessionId} est approximative, car aucune base avant la periode n'a ete trouvee.`,
    lowConfidencePrefix: 'Message agent',
    agentContextTitle: 'Contexte hebdomadaire Agent Workline',
    agentTask: 'Tache agent',
    agentTaskRead: 'Lis ces faits locaux extraits et redige un rapport hebdomadaire oriente management.',
    agentTaskWrite: 'Ecris le rapport Markdown final dans le chemin du rapport final indique ci-dessus.',
    agentTaskConfidence: 'N exclus pas automatiquement le contenu de faible confiance ; si tu l inclus, garde une marque breve de confiance ou de preuve.',
    agentTaskEvidence: 'Ajoute les references de preuve aux realisations quand elles existent ; ne cree pas d annexe de preuves separee sauf demande utilisateur.',
  },
  de: {
    title: 'Workline woechentliche Faktenzusammenfassung',
    period: 'Zeitraum',
    timezone: 'Zeitzone',
    generated: 'Erstellt',
    finalReportPath: 'Pfad zum Abschlussbericht',
    noFactsTitle: 'Keine lokalen Agent-Sitzungsfakten gefunden',
    extractedFacts: 'Extrahierte Fakten',
    project: 'Projekt',
    surface: 'Oberflaeche',
    completedWork: 'Abgeschlossene Arbeit',
    candidateCompletedWork: 'Kandidat fuer abgeschlossene Arbeit',
    inProgressWork: 'In Arbeit / zu bestaetigen',
    needsConfirmationWork: 'In Arbeit / zu bestaetigen',
    commandEvidence: 'Befehlsnachweise',
    tokenUsage: 'Token-Nutzung',
    warnings: 'Warnungen und Hinweise mit geringer Sicherheit',
    evidenceIndex: 'Nachweisindex',
    none: 'Keine',
    unknownProject: 'Unbekanntes Projekt',
    approximate: 'annaehernd',
    tokenWarning: (sessionId) => `Die Token-Nutzung fuer Sitzung ${sessionId} ist annaehend, da keine Basislinie vor dem Zeitraum gefunden wurde.`,
    lowConfidencePrefix: 'Agent-Nachricht',
    agentContextTitle: 'Workline Wochenkontext fuer Agent',
    agentTask: 'Agent-Aufgabe',
    agentTaskRead: 'Lies diese extrahierten lokalen Fakten und schreibe einen managementorientierten Wochenbericht.',
    agentTaskWrite: 'Schreibe den finalen Markdown-Bericht in den oben angegebenen Pfad.',
    agentTaskConfidence: 'Schliesse Inhalte mit geringer Sicherheit nicht automatisch aus; fuege bei Aufnahme eine kurze Sicherheits- oder Nachweismarkierung hinzu.',
    agentTaskEvidence: 'Fuege Nachweisreferenzen an Ergebnis-Eintraege an, wenn vorhanden; erstelle keinen separaten Nachweisanhang, ausser der Nutzer verlangt es.',
  },
  it: {
    title: 'Riepilogo fattuale settimanale Workline',
    period: 'Periodo',
    timezone: 'Fuso orario',
    generated: 'Generato',
    finalReportPath: 'Percorso del report finale',
    noFactsTitle: 'Nessun fatto di sessione Agent locale trovato',
    extractedFacts: 'Fatti estratti',
    project: 'Progetto',
    surface: 'Superficie',
    completedWork: 'Lavoro completato',
    candidateCompletedWork: 'Lavoro completato candidato',
    inProgressWork: 'In corso / da confermare',
    needsConfirmationWork: 'In corso / da confermare',
    commandEvidence: 'Evidenze dei comandi',
    tokenUsage: 'Uso dei token',
    warnings: 'Avvisi e note a bassa confidenza',
    evidenceIndex: 'Indice delle evidenze',
    none: 'Nessuno',
    unknownProject: 'Progetto sconosciuto',
    approximate: 'approssimativo',
    tokenWarning: (sessionId) => `L'uso dei token per la sessione ${sessionId} e approssimativo perche non e stata trovata una baseline precedente al periodo.`,
    lowConfidencePrefix: 'Messaggio agente',
    agentContextTitle: 'Contesto settimanale Agent Workline',
    agentTask: 'Attivita agente',
    agentTaskRead: 'Leggi questi fatti locali estratti e scrivi un report settimanale orientato al management.',
    agentTaskWrite: 'Scrivi il report finale Markdown nel percorso indicato sopra.',
    agentTaskConfidence: 'Non escludere automaticamente contenuti a bassa confidenza; se li includi, mantieni un breve indicatore di confidenza o evidenza.',
    agentTaskEvidence: 'Allega riferimenti alle evidenze ai risultati quando disponibili; non creare un appendice separata delle evidenze salvo richiesta dell utente.',
  },
  pt: {
    title: 'Resumo factual semanal Workline',
    period: 'Periodo',
    timezone: 'Fuso horario',
    generated: 'Gerado',
    finalReportPath: 'Caminho do relatorio final',
    noFactsTitle: 'Nenhum fato de sessao local de Agent encontrado',
    extractedFacts: 'Fatos extraidos',
    project: 'Projeto',
    surface: 'Superficie',
    completedWork: 'Trabalho concluido',
    candidateCompletedWork: 'Trabalho concluido candidato',
    inProgressWork: 'Em andamento / precisa confirmacao',
    needsConfirmationWork: 'Em andamento / precisa confirmacao',
    commandEvidence: 'Evidencia de comandos',
    tokenUsage: 'Uso de tokens',
    warnings: 'Avisos e notas de baixa confianca',
    evidenceIndex: 'Indice de evidencias',
    none: 'Nenhum',
    unknownProject: 'Projeto desconhecido',
    approximate: 'aproximado',
    tokenWarning: (sessionId) => `O uso de tokens da sessao ${sessionId} e aproximado porque nenhuma linha de base anterior ao periodo foi encontrada.`,
    lowConfidencePrefix: 'Mensagem do agente',
    agentContextTitle: 'Contexto semanal Agent Workline',
    agentTask: 'Tarefa do agente',
    agentTaskRead: 'Leia estes fatos locais extraidos e escreva um relatorio semanal orientado a gestao.',
    agentTaskWrite: 'Escreva o relatorio final em Markdown no caminho indicado acima.',
    agentTaskConfidence: 'Nao exclua automaticamente conteudo de baixa confianca; ao inclui-lo, mantenha uma marca breve de confianca ou evidencia.',
    agentTaskEvidence: 'Anexe referencias de evidencias aos itens de realizacao quando disponiveis; nao crie um apendice separado salvo se o usuario pedir.',
  },
  nl: {
    title: 'Workline wekelijkse feitenoverzicht',
    period: 'Periode',
    timezone: 'Tijdzone',
    generated: 'Gegenereerd',
    finalReportPath: 'Pad naar eindrapport',
    noFactsTitle: 'Geen lokale Agent-sessief feiten gevonden',
    extractedFacts: 'Geextraheerde feiten',
    project: 'Project',
    surface: 'Oppervlak',
    completedWork: 'Afgerond werk',
    candidateCompletedWork: 'Kandidaat afgerond werk',
    inProgressWork: 'Lopend / te bevestigen',
    needsConfirmationWork: 'Lopend / te bevestigen',
    commandEvidence: 'Commandobewijs',
    tokenUsage: 'Tokengebruik',
    warnings: 'Waarschuwingen en notities met lage zekerheid',
    evidenceIndex: 'Bewijsindex',
    none: 'Geen',
    unknownProject: 'Onbekend project',
    approximate: 'benaderd',
    tokenWarning: (sessionId) => `Tokengebruik voor sessie ${sessionId} is benaderd omdat geen basislijn voor de periode is gevonden.`,
    lowConfidencePrefix: 'Agentbericht',
    agentContextTitle: 'Workline wekelijkse Agent-context',
    agentTask: 'Agenttaak',
    agentTaskRead: 'Lees deze geextraheerde lokale feiten en schrijf een managementgericht weekrapport.',
    agentTaskWrite: 'Schrijf het uiteindelijke Markdown-rapport naar het hierboven genoemde pad.',
    agentTaskConfidence: 'Sluit inhoud met lage zekerheid niet automatisch uit; houd bij opname een korte zekerheids- of bewijsmarkering aan.',
    agentTaskEvidence: 'Koppel bewijsreferenties aan resultaatitems wanneer beschikbaar; maak geen aparte bewijsbijlage tenzij de gebruiker daarom vraagt.',
  },
  pl: {
    title: 'Tygodniowe podsumowanie faktow Workline',
    period: 'Okres',
    timezone: 'Strefa czasowa',
    generated: 'Wygenerowano',
    finalReportPath: 'Sciezka raportu koncowego',
    noFactsTitle: 'Nie znaleziono faktow lokalnych sesji Agent',
    extractedFacts: 'Wyodrebnione fakty',
    project: 'Projekt',
    surface: 'Powierzchnia',
    completedWork: 'Ukonczona praca',
    candidateCompletedWork: 'Kandydat na ukonczona prace',
    inProgressWork: 'W toku / do potwierdzenia',
    needsConfirmationWork: 'W toku / do potwierdzenia',
    commandEvidence: 'Dowody polecen',
    tokenUsage: 'Uzycie tokenow',
    warnings: 'Ostrzezenia i notatki o niskiej pewnosci',
    evidenceIndex: 'Indeks dowodow',
    none: 'Brak',
    unknownProject: 'Nieznany projekt',
    approximate: 'przyblizone',
    tokenWarning: (sessionId) => `Uzycie tokenow dla sesji ${sessionId} jest przyblizone, poniewaz nie znaleziono bazowego pomiaru sprzed okresu.`,
    lowConfidencePrefix: 'Wiadomosc agenta',
    agentContextTitle: 'Tygodniowy kontekst Agent Workline',
    agentTask: 'Zadanie agenta',
    agentTaskRead: 'Przeczytaj wyodrebnione lokalne fakty i napisz tygodniowy raport zarzadzajacy.',
    agentTaskWrite: 'Zapisz koncowy raport Markdown w podanej wyzej sciezce.',
    agentTaskConfidence: 'Nie wykluczaj automatycznie tresci o niskiej pewnosci; gdy je uwzgledniasz, zachowaj krotki znacznik pewnosci lub dowodu.',
    agentTaskEvidence: 'Dolacz referencje dowodowe do osiagniec, gdy sa dostepne; nie tworz osobnego zalacznika dowodowego, chyba ze uzytkownik o to poprosi.',
  },
};

// 上下文预算只作用于 agent-context；fact summary 保留完整事实，便于审计和调试。
const agentContextBudget = {
  workItemPreviewChars: 240,
  commandPreviewChars: 160,
  visibleCommandsPerSurface: 5,
  visibleToolTargetsPerSession: 5,
};

function textFor(language: ReportLanguage | undefined): ReportText {
  return textByLanguage[language ?? 'en'];
}

function finalReportLanguageInstruction(language: ReportLanguage | undefined): string {
  const resolved = language ?? 'en';
  if (resolved === 'zh-Hans') {
    return '报告语言已解析为简体中文；使用简体中文写最终报告的标题、周期、章节名和正文。不要因为上下文、issue、命令或证据语言不同而切换最终报告语言。';
  }
  if (resolved === 'zh-Hant') {
    return '報告語言已解析為繁體中文；使用繁體中文撰寫最終報告的標題、週期、章節名和正文。不要因為上下文、issue、命令或證據語言不同而切換最終報告語言。';
  }

  return `Report language was resolved as ${reportLanguageName(resolved)}; use ${reportLanguageName(resolved)} for the final report title, period line, headings, and body. Do not switch final report language because the context, issues, commands, or evidence use another language.`;
}

function finalReportOpeningInstruction(language: ReportLanguage | undefined): string {
  const resolved = language ?? 'en';
  if (resolved === 'zh-Hans') {
    return '最终 Markdown 报告必须以两行开头：第一行使用 `{report display name} 工作推进进展`；没有可信展示名时使用 `工作推进进展`。第二行使用 `周期：{startDate} 至 {endDate}`。两个日期均使用 `yyyy-MM-dd`。';
  }
  if (resolved === 'zh-Hant') {
    return '最終 Markdown 報告必須以兩行開頭：第一行使用 `{report display name} 工作推進進展`；沒有可信展示名時使用 `工作推進進展`。第二行使用 `週期：{startDate} 至 {endDate}`。兩個日期均使用 `yyyy-MM-dd`。';
  }

  return 'Start the final Markdown report with exactly two localized opening lines: first a report title that includes `{report display name}` only when identity evidence is reliable, then a period line using `{startDate}` and `{endDate}`. Format both dates as `yyyy-MM-dd`.';
}

function finalReportDisplayNameInstruction(language: ReportLanguage | undefined): string {
  const resolved = language ?? 'en';
  if (resolved === 'zh-Hans') {
    return '从可用身份事实解析报告展示名，优先使用明确用户偏好和人类可读展示名，而不是技术用户名、login 或 handle。没有可信展示名时省略展示名。';
  }
  if (resolved === 'zh-Hant') {
    return '從可用身份事實解析報告展示名，優先使用明確使用者偏好和人類可讀展示名，而不是技術使用者名稱、login 或 handle。沒有可信展示名時省略展示名。';
  }

  return 'Resolve the report display name from available identity evidence. Prefer explicit user preference and human-readable display names over technical usernames, logins, or handles. Omit the display name when reliable identity evidence is unavailable.';
}

function finalReportUnsafeNameInstruction(language: ReportLanguage | undefined): string {
  const resolved = language ?? 'en';
  if (resolved === 'zh-Hans') {
    return '不要从 remote owner、仓库 namespace、邮箱前缀或机器用户名推断报告展示名；不要写 `你的名字` 或其他占位称呼。';
  }
  if (resolved === 'zh-Hant') {
    return '不要從 remote owner、倉庫 namespace、電子郵件前綴或機器使用者名稱推斷報告展示名；不要寫 `你的名字` 或其他佔位稱呼。';
  }

  return 'Do not infer the report display name from remote owners, repository namespaces, email prefixes, or machine usernames. Do not write placeholder display names such as `你的名字`, `your name`, or equivalent placeholders.';
}

function finalReportScanStructureInstruction(language: ReportLanguage | undefined): string {
  const resolved = language ?? 'en';
  if (resolved === 'zh-Hans') {
    return '最终报告优先快速扫读：开头两行后直接写一段简短整体摘要；不要把 `Overview` 或 `Work topics` 作为固定可见章节标题，直接使用人类可读主题名作为二级标题，并在标题下直接列 outcome bullets。';
  }
  if (resolved === 'zh-Hant') {
    return '最終報告優先快速掃讀：開頭兩行後直接寫一段簡短整體摘要；不要把 `Overview` 或 `Work topics` 作為固定可見章節標題，直接使用人類可讀主題名作為二級標題，並在標題下直接列 outcome bullets。';
  }

  return 'Keep the final report scan-first: write a short overall summary immediately after the opening lines; do not use `Overview` or `Work topics` as fixed visible section headings. Use human-readable topic headings directly, then list outcome bullets directly under each topic heading.';
}

function bullet(lines: string[], text: ReportText): string[] {
  return lines.length ? lines.map((line) => `- ${line}`) : [`- ${text.none}`];
}

// token 汇总在分组后计算，保证每个 surface 展示的是对应会话在报告窗口内的实际用量。
function totalTokens(sessions: SessionFacts[]): TokenUsage {
  return sessions.reduce<TokenUsage>((sum, session) => ({
    input_tokens: sum.input_tokens + session.tokenUsage.input_tokens,
    cached_input_tokens: sum.cached_input_tokens + session.tokenUsage.cached_input_tokens,
    output_tokens: sum.output_tokens + session.tokenUsage.output_tokens,
    reasoning_output_tokens: sum.reasoning_output_tokens + session.tokenUsage.reasoning_output_tokens,
    total_tokens: sum.total_tokens + session.tokenUsage.total_tokens,
    approximate: sum.approximate || session.tokenUsage.approximate,
  }), {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    approximate: false,
  });
}

function tokenLine(usage: TokenUsage, text: ReportText): string {
  const approximate = usage.approximate ? ` (${text.approximate})` : '';
  return `total=${usage.total_tokens}${approximate}, input=${usage.input_tokens}, cached_input=${usage.cached_input_tokens}, output=${usage.output_tokens}, reasoning_output=${usage.reasoning_output_tokens}`;
}

// 这里的分组仍然面向事实来源；面向人的工作内容命名交给 Agent，因为它需要上下文和措辞判断。
function groupByProject(sessions: SessionFacts[], text: ReportText): Map<string, SessionFacts[]> {
  const grouped = new Map<string, SessionFacts[]>();
  for (const session of sessions) {
    const key = session.cwd || session.project || text.unknownProject;
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }
  return grouped;
}

function groupBySurface(sessions: SessionFacts[]): Map<string, SessionFacts[]> {
  const grouped = new Map<string, SessionFacts[]>();
  for (const session of sessions) {
    grouped.set(session.surface, [...(grouped.get(session.surface) ?? []), session]);
  }
  return grouped;
}

function formatWorkItem(item: WorkItem, session: SessionFacts, timezone: string): string {
  const branch = session.git?.branch ? ` branch=${session.git.branch}` : '';
  return `${item.summary} (${formatInTimezone(item.time, timezone)}, session=${session.id}${branch}, evidence=${item.evidenceFile})`;
}

function tokenWarnings(sessions: SessionFacts[], text: ReportText): string[] {
  return sessions
    .filter((session) => session.tokenUsage.approximate)
    .map((session) => text.tokenWarning(session.id));
}

function lowConfidenceNotes(sessions: SessionFacts[], timezone: string, text: ReportText): string[] {
  return sessions.flatMap((session) => session.lowConfidence.map((item) => {
    return `${text.lowConfidencePrefix}: ${item.summary} (${formatInTimezone(item.time, timezone)}, session=${session.id}, evidence=${item.evidenceFile})`;
  }));
}

function evidenceFiles(facts: AgentFacts): string[] {
  return [...new Set(facts.sessions.flatMap((session) => [
    session.evidenceFile,
    ...session.completed.map((item) => item.evidenceFile),
    ...session.inProgress.map((item) => item.evidenceFile),
    ...session.lowConfidence.map((item) => item.evidenceFile),
    ...session.commands.map((command) => command.evidenceFile),
    ...(session.toolEvents ?? []).map((event) => event.evidenceFile),
  ]))].sort();
}

// 紧凑 evidence id 用于降低 agent-context 体积，同时通过索引可逆地指向本地证据文件。
type EvidenceRefs = {
  ref: (file: string) => string;
  indexLines: () => string[];
};

// 省略说明让上下文裁剪显式化；Agent 应从证据文件恢复细节，而不是把未展示内容当作不存在。
type AgentContextNotes = {
  truncatedWorkItems: Map<string, number>;
  truncatedCommands: Map<string, number>;
  omittedCommands: Array<{
    surface: string;
    count: number;
    refs: string[];
  }>;
};

function createEvidenceRefs(facts: AgentFacts): EvidenceRefs {
  const refs = new Map(evidenceFiles(facts).map((file, index) => [file, `[E${index + 1}]`]));
  return {
    ref(file: string): string {
      return refs.get(file) ?? '[E?]';
    },
    indexLines(): string[] {
      return [...refs.entries()].map(([file, ref]) => `${ref} ${file}`);
    },
  };
}

function emptyAgentContextNotes(): AgentContextNotes {
  return {
    truncatedWorkItems: new Map(),
    truncatedCommands: new Map(),
    omittedCommands: [],
  };
}

function normalizedInline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// 预览统一压成单行，避免长命令或长消息淹没上下文，同时保留可追溯性。
function previewText(value: string, limit: number): { text: string; truncated: boolean } {
  const normalized = normalizedInline(value);
  if (normalized.length <= limit) {
    return { text: normalized, truncated: false };
  }

  return {
    text: `${normalized.slice(0, limit).trimEnd()}...`,
    truncated: true,
  };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatAgentWorkItem(
  item: WorkItem,
  session: SessionFacts,
  timezone: string,
  evidenceRefs: EvidenceRefs,
  notes: AgentContextNotes,
): string {
  const branch = session.git?.branch ? ` branch=${session.git.branch}` : '';
  const evidence = evidenceRefs.ref(item.evidenceFile);
  const preview = previewText(item.summary, agentContextBudget.workItemPreviewChars);
  if (preview.truncated) {
    increment(notes.truncatedWorkItems, evidence);
  }
  const marker = preview.truncated ? ` [truncated; full text in ${evidence}]` : '';
  const source = item.sourceType ? ` source=${item.sourceType}` : '';
  return `${preview.text}${marker} (${formatInTimezone(item.time, timezone)}, session=${session.id}${branch}${source}, evidence=${evidence})`;
}

// 失败命令、验证命令和 git 状态优先可见，因为它们最能支撑完成情况或残余风险判断。
function commandPriority(command: CommandEvidence): number {
  if (command.exitCode !== undefined && command.exitCode !== 0) {
    return 100;
  }

  const text = command.command.toLowerCase();
  if (/\bopenspec(?:-chinese)?\s+validate\b/.test(text) ||
      /\bnode\s+--test\b/.test(text) ||
      /\bnpm\s+(?:test|run\s+(?:test|build|lint|smoke))\b/.test(text) ||
      /\b(?:pnpm|yarn)\s+(?:test|run\s+(?:test|build|lint|smoke))\b/.test(text)) {
    return 80;
  }

  if (/\bgit\s+(?:status|diff|log|rev-list)\b/.test(text)) {
    return 70;
  }

  return 0;
}

// 命令选择保持确定性：先高信号命令，再最近命令；被省略数量仍回指同一组证据引用。
function selectAgentCommands(commands: CommandEvidence[]): { visible: CommandEvidence[]; omitted: CommandEvidence[] } {
  if (commands.length <= agentContextBudget.visibleCommandsPerSurface) {
    return { visible: commands, omitted: [] };
  }

  const selected = new Set<number>();
  const indexed = commands.map((command, index) => ({ command, index }));
  const addUntilFull = (items: typeof indexed): void => {
    for (const item of items) {
      if (selected.size >= agentContextBudget.visibleCommandsPerSurface) {
        return;
      }
      selected.add(item.index);
    }
  };

  addUntilFull(indexed
    .filter((item) => commandPriority(item.command) === 100)
    .toSorted((left, right) => left.command.time.getTime() - right.command.time.getTime() || left.index - right.index));
  addUntilFull(indexed
    .filter((item) => commandPriority(item.command) >= 70 && !selected.has(item.index))
    .toSorted((left, right) => commandPriority(right.command) - commandPriority(left.command) ||
      left.command.time.getTime() - right.command.time.getTime() ||
      left.index - right.index));
  addUntilFull(indexed
    .filter((item) => !selected.has(item.index))
    .toSorted((left, right) => right.command.time.getTime() - left.command.time.getTime() || left.index - right.index));

  return {
    visible: indexed.filter((item) => selected.has(item.index)).map((item) => item.command),
    omitted: indexed.filter((item) => !selected.has(item.index)).map((item) => item.command),
  };
}

function formatAgentCommand(
  command: CommandEvidence,
  session: SessionFacts,
  timezone: string,
  evidenceRefs: EvidenceRefs,
  notes: AgentContextNotes,
): string {
  const evidence = evidenceRefs.ref(command.evidenceFile);
  const preview = previewText(command.command, agentContextBudget.commandPreviewChars);
  if (preview.truncated) {
    increment(notes.truncatedCommands, evidence);
  }
  const marker = preview.truncated ? ` [truncated; full command in ${evidence}]` : '';
  const exit = command.exitCode === undefined ? '' : ` exit=${command.exitCode}`;
  return `\`${preview.text}${marker}\`${exit} (${formatInTimezone(command.time, timezone)}, session=${session.id}, evidence=${evidence})`;
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    increment(counts, keyFor(item));
  }
  return counts;
}

function toolAction(tool: string): string {
  switch (tool.toLowerCase()) {
    case 'read':
      return 'read';
    case 'grep':
      return 'searched';
    case 'glob':
      return 'globbed';
    case 'ls':
      return 'listed';
    case 'write':
      return 'written';
    case 'todowrite':
      return 'updated';
    case 'edit':
    case 'multiedit':
      return 'edited';
    default:
      return 'used';
  }
}

function timesLabel(count: number): string {
  return count === 1 ? '1 time' : `${count} times`;
}

function toolCategoryCount(events: ToolEvidence[], category: ToolEvidence['category']): number {
  return events.filter((event) => event.category === category).length;
}

function visibleToolGroups(events: ToolEvidence[], labelFor: (event: ToolEvidence) => string): string[] {
  const counts = countBy(events, labelFor);
  const firstSeen = new Map<string, number>();
  for (const event of events) {
    const label = labelFor(event);
    firstSeen.set(label, Math.min(firstSeen.get(label) ?? Number.POSITIVE_INFINITY, event.time.getTime()));
  }
  const grouped = [...counts.entries()]
    .toSorted((left, right) => right[1] - left[1] ||
      (firstSeen.get(left[0]) ?? 0) - (firstSeen.get(right[0]) ?? 0) ||
      left[0].localeCompare(right[0]));
  const visible = grouped.slice(0, agentContextBudget.visibleToolTargetsPerSession);
  const omitted = grouped.length - visible.length;
  const lines = visible.map(([label, count]) => `${label} ${timesLabel(count)}`);
  if (omitted > 0) {
    lines.push(`${omitted} more target${omitted === 1 ? '' : 's'} summarized in raw evidence`);
  }
  return lines;
}

function formatToolCategory(events: ToolEvidence[], category: ToolEvidence['category']): string | undefined {
  const categoryEvents = events.filter((event) => event.category === category);
  if (categoryEvents.length === 0) {
    return undefined;
  }

  if (category === 'planning') {
    return visibleToolGroups(categoryEvents, (event) => `${event.tool} ${toolAction(event.tool)}`).join('; ');
  }

  return visibleToolGroups(categoryEvents, (event) => `${event.target} ${toolAction(event.tool)}`).join('; ');
}

function toolEvidenceRefs(events: ToolEvidence[], evidenceFor: (file: string) => string): string {
  return [...new Set(events.map((event) => evidenceFor(event.evidenceFile)))].join(', ');
}

function shouldRequireRawEvidenceForClaudeTools(session: SessionFacts): boolean {
  const events = session.toolEvents ?? [];
  return session.source === 'claude' &&
    events.some((event) => event.category === 'output') &&
    session.completed.length === 0 &&
    session.inProgress.length === 0 &&
    session.lowConfidence.length > 0;
}

function toolActivityLabel(session: SessionFacts): string {
  return session.source === 'claude' ? 'Claude Code tool activity' : `${session.surface} tool activity`;
}

function formatToolEvidenceLines(session: SessionFacts, evidenceFor: (file: string) => string): string[] {
  const events = session.toolEvents ?? [];
  if (events.length === 0) {
    return [];
  }

  const outputCount = toolCategoryCount(events, 'output');
  const explorationCount = toolCategoryCount(events, 'exploration');
  const planningCount = toolCategoryCount(events, 'planning');
  const evidence = toolEvidenceRefs(events, evidenceFor);
  const lines = [
    `${toolActivityLabel(session)}: ${events.length} events summarized (outputs=${outputCount}, exploration=${explorationCount}, planning=${planningCount}; evidence=${evidence})`,
  ];
  const output = formatToolCategory(events, 'output');
  if (output) {
    lines.push(`High-value edits: ${output}`);
  }
  const exploration = formatToolCategory(events, 'exploration');
  if (exploration) {
    lines.push(`Exploration: ${exploration}`);
  }
  const planning = formatToolCategory(events, 'planning');
  if (planning) {
    lines.push(`Planning: ${planning}`);
  }
  if (shouldRequireRawEvidenceForClaudeTools(session)) {
    lines.push(`Read raw evidence ${evidence} before excluding or downgrading this session because it has file edit evidence but only low-confidence narrative.`);
  }
  return lines;
}

function languageQualityGate(language: ReportLanguage | undefined): string {
  const name = reportLanguageName(language ?? 'en');
  if (language === 'zh-Hans') {
    return `Language quality gate: final report language is ${name}. Translate common English shorthand when a natural ${name} business term exists; examples: GTM -> 获客/上市策略; local-first freemium -> 本地优先的免费增值; Free Local -> 本地免费版.`;
  }
  if (language === 'zh-Hant') {
    return `Language quality gate: final report language is ${name}. Translate common English shorthand when a natural ${name} business term exists; examples: GTM -> 獲客/上市策略; local-first freemium -> 本地優先的免費增值; Free Local -> 本地免費版.`;
  }
  return `Language quality gate: final report language is ${name}. Translate common English shorthand when a natural ${name} business term exists.`;
}

function qualityGateLines(
  facts: AgentFacts,
  language: ReportLanguage | undefined,
  evidenceRefs: EvidenceRefs,
): string[] {
  const lines = [
    languageQualityGate(language),
    'Use the Report language declared above; source evidence language must not override it.',
  ];
  const workspaceSessions = facts.sessions.filter((session) => session.source === 'workspace' || session.surface === 'Workspace');

  if (workspaceSessions.length > 0) {
    lines.push('Workspace/Git diff facts are included as draft or in-progress evidence.');
    for (const session of workspaceSessions) {
      lines.push(`Workspace draft evidence found in ${evidenceRefs.ref(session.evidenceFile)}; do not report it as completed unless commit, release, or external publication evidence exists.`);
    }
  }

  for (const session of facts.sessions) {
    if (session.completed.length === 0 &&
        session.inProgress.length === 0 &&
        session.lowConfidence.length === 0 &&
        session.commands.length >= 6) {
      lines.push(`Anomaly gate: session=${session.id} has ${session.commands.length} command evidence items but no candidate outcome; review ${evidenceRefs.ref(session.evidenceFile)} before excluding or downgrading it.`);
    }
  }

  return lines;
}

// 预算说明属于事实包，不属于最终报告结构；它只说明 Agent 需要时从哪里恢复被省略细节。
function agentOmissionNotes(notes: AgentContextNotes): string[] {
  const lines: string[] = [];
  for (const [ref, count] of notes.truncatedWorkItems) {
    const label = count === 1 ? 'work item text' : 'work item texts';
    lines.push(`${count} ${label} truncated; full text remains available via ${ref}`);
  }
  for (const [ref, count] of notes.truncatedCommands) {
    const label = count === 1 ? 'command text' : 'command texts';
    lines.push(`${count} ${label} truncated; full commands remain available via ${ref}`);
  }
  for (const omitted of notes.omittedCommands) {
    const label = omitted.count === 1 ? 'command evidence item' : 'command evidence items';
    lines.push(`${omitted.count} ${label} omitted for ${omitted.surface}; full commands remain available via ${omitted.refs.join(', ')}`);
  }
  return lines;
}

// Fact summary 刻意展示完整证据路径和未裁剪命令，更偏机器可审计表面，不是最终汇报文案。
function renderSurface(sessions: SessionFacts[], timezone: string, text: ReportText): string[] {
  const lines: string[] = [];
  const completed = sessions.flatMap((session) => session.completed.map((item) => {
    return formatWorkItem(item, session, timezone);
  }));
  const inProgress = sessions.flatMap((session) => session.inProgress.map((item) => {
    return formatWorkItem(item, session, timezone);
  }));
  const commands = sessions.flatMap((session) => session.commands.map((command) => {
    const exit = command.exitCode === undefined ? '' : ` exit=${command.exitCode}`;
    return `\`${command.command}\`${exit} (${formatInTimezone(command.time, timezone)}, session=${session.id}, evidence=${command.evidenceFile})`;
  }));
  const toolEvents = sessions.flatMap((session) => formatToolEvidenceLines(session, (file) => file));

  lines.push(`#### ${text.completedWork}`);
  lines.push(...bullet(completed, text), '');
  lines.push(`#### ${text.inProgressWork}`);
  lines.push(...bullet(inProgress, text), '');
  lines.push(`#### ${text.commandEvidence}`);
  lines.push(...bullet(commands, text), '');
  if (toolEvents.length > 0) {
    lines.push('#### Tool evidence');
    lines.push(...toolEvents, '');
  }
  lines.push(`#### ${text.tokenUsage}`);
  lines.push(`- ${tokenLine(totalTokens(sessions), text)}`);
  return lines;
}

// 用户需要审计事实时使用稳定渲染器；最终管理周报仍由当前 Agent 读取 context 后成文。
export function renderWeeklyFactSummary(facts: AgentFacts, window: ReportWindow): string {
  const text = textFor(window.reportLanguage);
  const lines: string[] = [
    `# ${text.title}`,
    '',
    `- ${text.period}: ${formatInTimezone(window.since, window.timezone)} - ${formatInTimezone(window.until, window.timezone)}`,
    `- ${text.timezone}: ${window.timezone}`,
    `- ${text.generated}: ${formatInTimezone(window.generatedAt, window.timezone)}`,
    '',
  ];

  const projects = groupByProject(facts.sessions, text);
  if (projects.size === 0) {
    lines.push(`## ${text.noFactsTitle}`, '', `- ${text.none}`, '');
  }

  for (const [project, projectSessions] of projects) {
    lines.push(`## ${project}`, '');
    for (const [surface, surfaceSessions] of groupBySurface(projectSessions)) {
      lines.push(`### ${surface}`, '');
      lines.push(...renderSurface(surfaceSessions, window.timezone, text), '');
    }
  }

  lines.push(`## ${text.warnings}`);
  lines.push(...bullet([...facts.warnings, ...tokenWarnings(facts.sessions, text), ...lowConfidenceNotes(facts.sessions, window.timezone, text)], text));
  lines.push('');

  return lines.join('\n');
}

export const renderWeeklyReport = renderWeeklyFactSummary;

// agent-context 是带预算的证据包加写作契约，用来连接本地事实和当前 Agent 的管理汇报。
export function renderWeeklyAgentContext(facts: AgentFacts, window: AgentContextWindow): string {
  const text = textFor(window.reportLanguage);
  const evidenceRefs = createEvidenceRefs(facts);
  const notes = emptyAgentContextNotes();
  const lines: string[] = [
    `# ${text.agentContextTitle}`,
    '',
    `- ${text.period}: ${formatInTimezone(window.since, window.timezone)} - ${formatInTimezone(window.until, window.timezone)}`,
    `- ${text.timezone}: ${window.timezone}`,
    `- ${text.generated}: ${formatInTimezone(window.generatedAt, window.timezone)}`,
    `- ${text.finalReportPath}: ${window.finalReportPath}`,
    `- Report language: ${reportLanguageName(window.reportLanguage ?? 'en')}`,
    `- Report language source: ${window.reportLanguageSource ?? 'fallback'}`,
    `- Report language confidence: ${window.reportLanguageConfidence ?? 'low'}`,
    '',
    `## ${text.agentTask}`,
    `- ${text.agentTaskRead}`,
    ...weeklyAgentContextHarnessGuidance.map((line) => `- ${line}`),
    `- ${text.agentTaskWrite}`,
    `- ${finalReportLanguageInstruction(window.reportLanguage)}`,
    `- ${finalReportOpeningInstruction(window.reportLanguage)}`,
    `- ${finalReportDisplayNameInstruction(window.reportLanguage)}`,
    `- ${finalReportUnsafeNameInstruction(window.reportLanguage)}`,
    `- ${finalReportScanStructureInstruction(window.reportLanguage)}`,
    ...outcomeAgentTaskGuidance.map((line) => `- ${line}`),
    ...transactionalAgentTaskGuidance.map((line) => `- ${line}`),
    ...workTopicAgentTaskGuidance.map((line) => `- ${line}`),
    `- ${text.agentTaskConfidence}`,
    `- ${text.agentTaskEvidence}`,
    ...finalReportEvidenceGuidance.map((line) => `- ${line}`),
    ...boundedContextAgentTaskGuidance.map((line) => `- ${line}`),
    '',
    '## Quality gates',
    ...qualityGateLines(facts, window.reportLanguage, evidenceRefs).map((line) => `- ${line}`),
    '',
  ];

  const projects = groupByProject(facts.sessions, text);
  if (projects.size === 0) {
    lines.push(`## ${text.extractedFacts}`, '', `- ${text.none}`, '');
  }

  for (const [project, projectSessions] of projects) {
    lines.push(`## ${text.project}: ${project}`, '');
    for (const [surface, surfaceSessions] of groupBySurface(projectSessions)) {
      lines.push(`### ${text.surface}: ${surface}`, '');
      lines.push(`#### ${text.candidateCompletedWork}`);
      lines.push(...bullet(surfaceSessions.flatMap((session) => session.completed.map((item) => {
        return formatAgentWorkItem(item, session, window.timezone, evidenceRefs, notes);
      })), text), '');
      lines.push(`#### ${text.needsConfirmationWork}`);
      lines.push(...bullet(surfaceSessions.flatMap((session) => session.inProgress.map((item) => {
        return formatAgentWorkItem(item, session, window.timezone, evidenceRefs, notes);
      })), text), '');
      lines.push(`#### ${text.commandEvidence}`);
      lines.push(...bullet(surfaceSessions.flatMap((session) => {
        const selected = selectAgentCommands(session.commands);
        if (selected.omitted.length > 0) {
          notes.omittedCommands.push({
            surface,
            count: selected.omitted.length,
            refs: [...new Set(selected.omitted.map((command) => evidenceRefs.ref(command.evidenceFile)))],
          });
        }
        return selected.visible.map((command) => {
          return formatAgentCommand(command, session, window.timezone, evidenceRefs, notes);
        });
      }), text), '');
      const toolEvents = surfaceSessions.flatMap((session) => {
        return formatToolEvidenceLines(session, (file) => evidenceRefs.ref(file));
      });
      if (toolEvents.length > 0) {
        lines.push('#### Tool evidence');
        lines.push(...toolEvents.map((line) => `- ${line}`), '');
      }
      lines.push(`#### ${text.tokenUsage}`);
      lines.push(`- ${tokenLine(totalTokens(surfaceSessions), text)}`, '');
    }
  }

  lines.push(`## ${text.warnings}`);
  lines.push(...bullet([
    ...facts.warnings,
    ...tokenWarnings(facts.sessions, text),
    ...facts.sessions.flatMap((session) => session.lowConfidence.map((item) => {
      return `${text.lowConfidencePrefix}: ${formatAgentWorkItem(item, session, window.timezone, evidenceRefs, notes)}`;
    })),
  ], text));
  lines.push('');
  const budgetNotes = agentOmissionNotes(notes);
  if (budgetNotes.length > 0) {
    lines.push('## Context budget notes');
    lines.push(...bullet(budgetNotes, text));
    lines.push('');
  }
  lines.push(`## ${text.evidenceIndex}`);
  lines.push(...bullet(evidenceRefs.indexLines(), text));
  lines.push('');

  return lines.join('\n');
}
