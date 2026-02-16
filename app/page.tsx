'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  VscCode, VscBug, VscDashboard, VscLightbulb, VscMail,
  VscCheck, VscChevronDown, VscChevronRight, VscCopy,
  VscWarning, VscError, VscInfo, VscTrash, VscSend, VscSearch
} from 'react-icons/vsc'
import { HiOutlineCheckCircle, HiOutlineExclamationCircle } from 'react-icons/hi'

const MANAGER_AGENT_ID = '699356edc1a177c86d6ed9b1'

const AGENTS = [
  { id: '699356edc1a177c86d6ed9b1', name: 'Code Review Coordinator', role: 'Manager - routes to sub-agents' },
  { id: '699356bb606d81ae3a56a988', name: 'Bug Detection Agent', role: 'Bugs, errors, vulnerabilities' },
  { id: '699356bc606d81ae3a56a98a', name: 'Performance Analyzer', role: 'Bottlenecks and complexity' },
  { id: '699356d2b6bc6d320bbb024b', name: 'Report & Delivery', role: 'Compiles and sends via Gmail' },
]

const LANGUAGES = [
  'auto-detect', 'python', 'javascript', 'typescript', 'java', 'go',
  'c++', 'rust', 'ruby', 'php', 'c#', 'swift', 'kotlin'
]

const THEME_VARS = {
  '--background': '231 18% 14%',
  '--foreground': '60 30% 96%',
  '--card': '232 16% 18%',
  '--card-foreground': '60 30% 96%',
  '--popover': '232 16% 22%',
  '--popover-foreground': '60 30% 96%',
  '--primary': '265 89% 72%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '232 16% 24%',
  '--secondary-foreground': '60 30% 96%',
  '--accent': '135 94% 60%',
  '--accent-foreground': '231 18% 10%',
  '--destructive': '0 100% 62%',
  '--muted': '232 16% 28%',
  '--muted-foreground': '228 10% 62%',
  '--border': '232 16% 28%',
  '--input': '232 16% 32%',
  '--ring': '265 89% 72%',
  '--radius': '0.875rem',
  '--chart-1': '265 89% 72%',
  '--chart-2': '135 94% 60%',
  '--chart-3': '191 97% 70%',
  '--chart-4': '326 100% 68%',
  '--chart-5': '31 100% 65%',
} as React.CSSProperties

interface BugItem {
  severity?: string
  title?: string
  description?: string
  line_reference?: string
  category?: string
}

interface BugSummary {
  total_bugs?: number
  critical_count?: number
  warning_count?: number
  info_count?: number
}

interface PerfIssue {
  priority?: string
  title?: string
  description?: string
  recommendation?: string
  impact?: string
}

interface PerfSummary {
  total_issues?: number
  high_priority?: number
  medium_priority?: number
  low_priority?: number
}

interface SuggestionItem {
  rank?: number
  suggestion?: string
  reason?: string
}

interface AnalysisResult {
  bug_report?: {
    bugs?: BugItem[]
    summary?: BugSummary
  }
  performance_report?: {
    issues?: PerfIssue[]
    complexity_rating?: string
    summary?: PerfSummary
  }
  delivery_status?: {
    report_sent?: boolean
    recipient_email?: string
  }
  suggestions?: SuggestionItem[]
}

const SAMPLE_CODE = `def process_data(data):
    results = []
    for i in range(len(data)):
        item = data[i]
        if item['type'] == 'active':
            value = item['amount'] / item['count']
            results.append(value)

    total = 0
    for r in results:
        total = total + r

    avg = total / len(results)

    connection = open_db_connection()
    for result in results:
        connection.execute(
            "INSERT INTO results VALUES (" + str(result) + ")"
        )

    return {'average': avg, 'results': results}`

const SAMPLE_RESULT: AnalysisResult = {
  bug_report: {
    bugs: [
      { severity: 'critical', title: 'SQL Injection Vulnerability', description: 'String concatenation used to build SQL query on line 17. This allows SQL injection attacks through the result variable.', line_reference: 'Line 17', category: 'Security' },
      { severity: 'critical', title: 'ZeroDivisionError Risk', description: 'Division by len(results) on line 13 without checking if results list is empty. Will crash when no active items exist.', line_reference: 'Line 13', category: 'Logic Error' },
      { severity: 'warning', title: 'ZeroDivisionError in Loop', description: "Division by item['count'] on line 6 without checking if count is zero.", line_reference: 'Line 6', category: 'Logic Error' },
      { severity: 'warning', title: 'Resource Leak', description: 'Database connection opened on line 15 is never closed. This will cause connection pool exhaustion over time.', line_reference: 'Line 15', category: 'Resource Management' },
      { severity: 'info', title: 'Non-Pythonic Iteration', description: 'Using range(len(data)) instead of iterating directly over data. Consider using enumerate() or direct iteration for clarity.', line_reference: 'Line 3', category: 'Code Style' },
    ],
    summary: { total_bugs: 5, critical_count: 2, warning_count: 2, info_count: 1 }
  },
  performance_report: {
    issues: [
      { priority: 'high', title: 'Repeated Database Calls in Loop', description: 'Individual INSERT statements executed inside a loop on line 17.', recommendation: 'Use batch inserts or executemany() to reduce round-trips to the database.', impact: 'O(n) database calls instead of O(1) with batching.' },
      { priority: 'medium', title: 'Redundant Loop for Summation', description: 'Separate loop used for summing results when it could be done in the first loop.', recommendation: 'Combine the summation into the initial processing loop to eliminate the second pass.', impact: 'Reduces iterations from 2n to n.' },
      { priority: 'low', title: 'Suboptimal List Access Pattern', description: 'Using index-based access with range(len()) instead of direct iteration.', recommendation: 'Use for item in data: instead of index-based access for cleaner and marginally faster code.', impact: 'Minor improvement in readability and negligible speed gain.' },
    ],
    complexity_rating: 'O(n) with high constant factor',
    summary: { total_issues: 3, high_priority: 1, medium_priority: 1, low_priority: 1 }
  },
  delivery_status: {
    report_sent: true,
    recipient_email: 'developer@example.com'
  },
  suggestions: [
    { rank: 1, suggestion: 'Use parameterized queries for all database operations', reason: 'Eliminates SQL injection vulnerability, the most critical security issue found.' },
    { rank: 2, suggestion: 'Add guard clauses for division operations', reason: 'Prevents ZeroDivisionError crashes in both the loop and average calculation.' },
    { rank: 3, suggestion: 'Implement context managers for database connections', reason: 'Ensures connections are properly closed even when exceptions occur.' },
    { rank: 4, suggestion: 'Use batch database inserts', reason: 'Dramatically improves performance by reducing database round-trips from O(n) to O(1).' },
    { rank: 5, suggestion: 'Consolidate loops into a single pass', reason: 'Improves efficiency and readability by processing and summing in one iteration.' },
  ]
}

function getSeverityStyles(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (s === 'warning') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
}

function getSeverityIcon(severity: string) {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return <VscError className="h-4 w-4 text-red-400 flex-shrink-0" />
  if (s === 'warning') return <VscWarning className="h-4 w-4 text-amber-400 flex-shrink-0" />
  return <VscInfo className="h-4 w-4 text-cyan-400 flex-shrink-0" />
}

function getPriorityStyles(priority: string): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'high') return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (p === 'medium') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

function CodeEditorArea({ code, onChange, lineCount }: { code: string; onChange: (val: string) => void; lineCount: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const lines = useMemo(() => {
    const count = Math.max(lineCount, 20)
    return Array.from({ length: count }, (_, i) => i + 1)
  }, [lineCount])

  return (
    <div className="relative flex rounded-xl overflow-hidden border border-border shadow-xl" style={{ backgroundColor: 'hsl(231 18% 10%)' }}>
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 select-none overflow-hidden py-3 px-2 text-right font-mono text-xs leading-6"
        style={{ color: 'hsl(228 10% 38%)', width: '3.5rem' }}
      >
        {lines.map(n => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <div className="w-px flex-shrink-0" style={{ backgroundColor: 'hsl(232 16% 20%)' }} />
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder="Paste your code here..."
        spellCheck={false}
        className="flex-1 resize-none bg-transparent py-3 px-4 font-mono text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        style={{ minHeight: '400px', tabSize: 4 }}
      />
    </div>
  )
}

function LoadingSkeletons() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <VscSearch className="h-5 w-5 text-primary animate-pulse" />
        <span className="text-sm text-muted-foreground animate-pulse">Analyzing your code...</span>
      </div>
      {[1, 2, 3].map(i => (
        <Card key={i} className="border-border shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EmptyResultsState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'hsl(232 16% 20%)' }}>
        <VscCode className="h-12 w-12 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Submit code to see analysis results</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">Paste your code in the left panel, select a language, provide a recipient email, and click analyze.</p>
    </div>
  )
}

function BugReportSection({
  bugs, summary, expandedSections, toggleSection, onCopy, copiedId
}: {
  bugs: BugItem[]
  summary: BugSummary
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
}) {
  const totalBugs = summary?.total_bugs ?? 0
  const criticalCount = summary?.critical_count ?? 0
  const warningCount = summary?.warning_count ?? 0
  const infoCount = summary?.info_count ?? 0
  const isOpen = expandedSections['bugs'] !== false

  return (
    <Card className="border-border shadow-xl">
      <Collapsible open={isOpen} onOpenChange={() => toggleSection('bugs')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-500/15">
                  <VscBug className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Bug Report</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{totalBugs} issue{totalBugs !== 1 ? 's' : ''} found</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5">
                  {criticalCount > 0 && <Badge className={getSeverityStyles('critical')} variant="outline">{criticalCount} Critical</Badge>}
                  {warningCount > 0 && <Badge className={getSeverityStyles('warning')} variant="outline">{warningCount} Warning</Badge>}
                  {infoCount > 0 && <Badge className={getSeverityStyles('info')} variant="outline">{infoCount} Info</Badge>}
                </div>
                {isOpen ? <VscChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <VscChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="flex sm:hidden items-center gap-1.5 mb-2">
              {criticalCount > 0 && <Badge className={getSeverityStyles('critical')} variant="outline">{criticalCount} Critical</Badge>}
              {warningCount > 0 && <Badge className={getSeverityStyles('warning')} variant="outline">{warningCount} Warning</Badge>}
              {infoCount > 0 && <Badge className={getSeverityStyles('info')} variant="outline">{infoCount} Info</Badge>}
            </div>
            {bugs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No bugs found -- great work!</p>
            ) : (
              bugs.map((bug, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2" style={{ backgroundColor: 'hsl(232 16% 15%)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getSeverityIcon(bug?.severity ?? '')}
                      <span className="font-medium text-sm text-foreground">{bug?.title ?? 'Untitled'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge className={getSeverityStyles(bug?.severity ?? '')} variant="outline">
                        {(bug?.severity ?? 'info').toUpperCase()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onCopy(`${bug?.title ?? ''}: ${bug?.description ?? ''}`, `bug-${idx}`); }}
                      >
                        {copiedId === `bug-${idx}` ? <VscCheck className="h-3.5 w-3.5 text-green-400" /> : <VscCopy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{bug?.description ?? ''}</p>
                  <div className="flex items-center gap-3 text-xs">
                    {bug?.line_reference && (
                      <span className="font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'hsl(265 89% 72% / 0.15)', color: 'hsl(265 89% 78%)' }}>{bug.line_reference}</span>
                    )}
                    {bug?.category && (
                      <span className="text-muted-foreground">{bug.category}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function PerformanceSection({
  issues, summary, complexityRating, expandedSections, toggleSection, onCopy, copiedId
}: {
  issues: PerfIssue[]
  summary: PerfSummary
  complexityRating: string
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
}) {
  const totalIssues = summary?.total_issues ?? 0
  const highCount = summary?.high_priority ?? 0
  const medCount = summary?.medium_priority ?? 0
  const lowCount = summary?.low_priority ?? 0
  const isOpen = expandedSections['perf'] !== false

  return (
    <Card className="border-border shadow-xl">
      <Collapsible open={isOpen} onOpenChange={() => toggleSection('perf')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/15">
                  <VscDashboard className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Performance Analysis</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{totalIssues} bottleneck{totalIssues !== 1 ? 's' : ''} detected</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {complexityRating && (
                  <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 hidden sm:inline-flex" variant="outline">{complexityRating}</Badge>
                )}
                {isOpen ? <VscChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <VscChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {complexityRating && (
                <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 sm:hidden" variant="outline">{complexityRating}</Badge>
              )}
              {highCount > 0 && <Badge className={getPriorityStyles('high')} variant="outline">{highCount} High</Badge>}
              {medCount > 0 && <Badge className={getPriorityStyles('medium')} variant="outline">{medCount} Medium</Badge>}
              {lowCount > 0 && <Badge className={getPriorityStyles('low')} variant="outline">{lowCount} Low</Badge>}
            </div>
            {issues.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No performance issues found.</p>
            ) : (
              issues.map((issue, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2" style={{ backgroundColor: 'hsl(232 16% 15%)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge className={getPriorityStyles(issue?.priority ?? '')} variant="outline">
                        {(issue?.priority ?? 'low').toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm text-foreground">{issue?.title ?? 'Untitled'}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); onCopy(`${issue?.title ?? ''}: ${issue?.description ?? ''}\nRecommendation: ${issue?.recommendation ?? ''}`, `perf-${idx}`); }}
                    >
                      {copiedId === `perf-${idx}` ? <VscCheck className="h-3.5 w-3.5 text-green-400" /> : <VscCopy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{issue?.description ?? ''}</p>
                  {issue?.recommendation && (
                    <div className="rounded-md p-2.5" style={{ backgroundColor: 'hsl(135 94% 60% / 0.07)' }}>
                      <p className="text-xs font-medium mb-1" style={{ color: 'hsl(135 94% 65%)' }}>Recommendation</p>
                      <p className="text-sm text-foreground/80">{issue.recommendation}</p>
                    </div>
                  )}
                  {issue?.impact && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground/70">Impact:</span> {issue.impact}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function SuggestionsSection({
  suggestions, expandedSections, toggleSection, onCopy, copiedId
}: {
  suggestions: SuggestionItem[]
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
}) {
  const isOpen = expandedSections['suggestions'] !== false

  return (
    <Card className="border-border shadow-xl">
      <Collapsible open={isOpen} onOpenChange={() => toggleSection('suggestions')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ backgroundColor: 'hsl(135 94% 60% / 0.15)' }}>
                  <VscLightbulb className="h-5 w-5" style={{ color: 'hsl(135 94% 65%)' }} />
                </div>
                <div>
                  <CardTitle className="text-base">Improvement Suggestions</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{suggestions.length} actionable recommendation{suggestions.length !== 1 ? 's' : ''}</CardDescription>
                </div>
              </div>
              {isOpen ? <VscChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <VscChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No suggestions available.</p>
            ) : (
              suggestions.map((s, idx) => (
                <div key={idx} className="flex gap-3 items-start rounded-lg border border-border p-3" style={{ backgroundColor: 'hsl(232 16% 15%)' }}>
                  <div className="flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0 font-mono text-xs font-bold" style={{ backgroundColor: 'hsl(265 89% 72% / 0.2)', color: 'hsl(265 89% 78%)' }}>
                    {s?.rank ?? idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">{s?.suggestion ?? ''}</p>
                    {s?.reason && <p className="text-xs text-muted-foreground leading-relaxed">{s.reason}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); onCopy(`${s?.suggestion ?? ''}: ${s?.reason ?? ''}`, `sug-${idx}`); }}
                  >
                    {copiedId === `sug-${idx}` ? <VscCheck className="h-3.5 w-3.5 text-green-400" /> : <VscCopy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function AgentStatusPanel({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <Card className="border-border">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {AGENTS.map(agent => {
            const isActive = activeAgentId === agent.id
            return (
              <div
                key={agent.id}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
                style={{ backgroundColor: isActive ? 'hsl(265 89% 72% / 0.1)' : 'transparent' }}
              >
                <div
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: isActive
                      ? 'hsl(265 89% 72%)'
                      : activeAgentId
                        ? 'hsl(228 10% 38%)'
                        : 'hsl(135 94% 55%)'
                  }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('auto-detect')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showSampleData, setShowSampleData] = useState(false)

  const validateEmail = useCallback((email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }, [])

  // Determine what to display
  const displayCode = showSampleData && !code ? SAMPLE_CODE : code
  const displayResult = showSampleData && !analysisResult ? SAMPLE_RESULT : analysisResult
  const displayEmail = showSampleData && !recipientEmail ? 'developer@example.com' : recipientEmail

  const lineCount = useMemo(() => {
    return displayCode.split('\n').length
  }, [displayCode])

  const handleAnalyze = useCallback(async () => {
    const codeToAnalyze = displayCode.trim()
    const emailToUse = displayEmail.trim()

    if (!codeToAnalyze || !emailToUse) return
    if (!validateEmail(emailToUse)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setEmailError(null)
    setAnalysisResult(null)
    setActiveAgentId(MANAGER_AGENT_ID)

    const langLabel = language === 'auto-detect' ? '' : language
    const message = `Please analyze the following code and send the report to ${emailToUse}.\n\nProgramming Language: ${language}\n\nCode:\n\`\`\`${langLabel}\n${codeToAnalyze}\n\`\`\`\n\nRecipient Email: ${emailToUse}`

    try {
      const result = await callAIAgent(message, MANAGER_AGENT_ID)
      if (result.success) {
        setAnalysisResult(result?.response?.result as AnalysisResult)
      } else {
        setError(result?.error ?? 'Analysis failed. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsAnalyzing(false)
      setActiveAgentId(null)
    }
  }, [displayCode, displayEmail, language, validateEmail])

  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const handleClear = useCallback(() => {
    setCode('')
    setLanguage('auto-detect')
    setRecipientEmail('')
    setAnalysisResult(null)
    setError(null)
    setEmailError(null)
    setExpandedSections({})
    setShowSampleData(false)
  }, [])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }))
  }, [])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipientEmail(e.target.value)
    if (emailError) setEmailError(null)
  }, [emailError])

  const handleCodeChange = useCallback((val: string) => {
    setCode(val)
    if (showSampleData) setShowSampleData(false)
  }, [showSampleData])

  // Safely extract result data
  const bugs = Array.isArray(displayResult?.bug_report?.bugs) ? displayResult.bug_report.bugs : []
  const bugSummary: BugSummary = displayResult?.bug_report?.summary ?? { total_bugs: 0, critical_count: 0, warning_count: 0, info_count: 0 }
  const perfIssues = Array.isArray(displayResult?.performance_report?.issues) ? displayResult.performance_report.issues : []
  const perfSummary: PerfSummary = displayResult?.performance_report?.summary ?? { total_issues: 0, high_priority: 0, medium_priority: 0, low_priority: 0 }
  const complexityRating = displayResult?.performance_report?.complexity_rating ?? ''
  const suggestionsList = Array.isArray(displayResult?.suggestions) ? displayResult.suggestions : []
  const deliveryStatus = displayResult?.delivery_status ?? { report_sent: false, recipient_email: '' }

  const isFormValid = displayCode.trim().length > 0 && displayEmail.trim().length > 0
  const hasResults = displayResult !== null

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl" style={{ backgroundColor: 'hsl(231 18% 14% / 0.92)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/20">
              <VscCode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground" style={{ letterSpacing: '-0.01em' }}>CodeSense</h1>
              <p className="text-xs text-muted-foreground hidden sm:block" style={{ letterSpacing: '-0.01em' }}>AI-Powered Code Review and Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">Sample Data</Label>
            <Switch
              id="sample-toggle"
              checked={showSampleData}
              onCheckedChange={setShowSampleData}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Input Panel */}
          <div className="w-full lg:w-3/5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <VscCode className="h-4 w-4 text-primary" />
                Code Input
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Paste the code you want analyzed below</p>
            </div>

            <CodeEditorArea
              code={displayCode}
              onChange={handleCodeChange}
              lineCount={lineCount}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="language-select" className="text-xs font-medium text-foreground">Programming Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language-select" className="bg-input border-border text-foreground h-9">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang} value={lang}>
                        {lang === 'auto-detect' ? 'Auto-detect' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recipient-email" className="text-xs font-medium text-foreground">
                  Recipient Email <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <VscMail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="recipient-email"
                    type="email"
                    placeholder="Enter email for report delivery"
                    value={showSampleData && !recipientEmail ? 'developer@example.com' : recipientEmail}
                    onChange={handleEmailChange}
                    className="bg-input border-border text-foreground h-9 pl-9 text-sm"
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                    <HiOutlineExclamationCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !isFormValid}
              className="w-full h-10 font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <VscSearch className="h-4 w-4 animate-spin" />
                  Analyzing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <VscSend className="h-4 w-4" />
                  Analyze and Send Report
                </span>
              )}
            </Button>

            {/* Agent Status Panel */}
            <AgentStatusPanel activeAgentId={activeAgentId} />
          </div>

          {/* Right Column - Results Panel */}
          <div className="w-full lg:w-2/5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <VscDashboard className="h-4 w-4 text-primary" />
                Analysis Results
              </h2>
              <p className="text-xs text-muted-foreground">Review findings and recommendations</p>
            </div>

            <ScrollArea className="lg:h-[calc(100vh-10rem)]">
              <div className="space-y-4 pr-1">
                {isAnalyzing ? (
                  <LoadingSkeletons />
                ) : !hasResults ? (
                  <EmptyResultsState />
                ) : (
                  <>
                    {/* Delivery Status Banner */}
                    {deliveryStatus?.report_sent && (
                      <div className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: 'hsl(135 94% 60% / 0.3)', backgroundColor: 'hsl(135 94% 60% / 0.07)' }}>
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0" style={{ backgroundColor: 'hsl(135 94% 60% / 0.2)' }}>
                          <HiOutlineCheckCircle className="h-5 w-5" style={{ color: 'hsl(135 94% 65%)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'hsl(135 94% 70%)' }}>Report Delivered</p>
                          <p className="text-xs text-muted-foreground truncate">Sent to {deliveryStatus?.recipient_email ?? 'recipient'}</p>
                        </div>
                      </div>
                    )}

                    {/* Bug Report */}
                    <BugReportSection
                      bugs={bugs}
                      summary={bugSummary}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                    />

                    {/* Performance Report */}
                    <PerformanceSection
                      issues={perfIssues}
                      summary={perfSummary}
                      complexityRating={complexityRating}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                    />

                    {/* Suggestions */}
                    <SuggestionsSection
                      suggestions={suggestionsList}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                    />

                    {/* Clear Button */}
                    <Button
                      onClick={handleClear}
                      variant="outline"
                      className="w-full h-9 text-sm border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <VscTrash className="h-4 w-4 mr-2" />
                      Clear and New Analysis
                    </Button>
                  </>
                )}

                {/* Error state when no results yet */}
                {error && !hasResults && !isAnalyzing && (
                  <div className="rounded-xl border border-red-500/30 p-5 text-center" style={{ backgroundColor: 'hsl(0 100% 62% / 0.06)' }}>
                    <HiOutlineExclamationCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-red-400 mb-1">Analysis Failed</p>
                    <p className="text-xs text-muted-foreground mb-3">{error}</p>
                    <Button
                      onClick={handleAnalyze}
                      variant="outline"
                      size="sm"
                      className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={isAnalyzing || !isFormValid}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  )
}
