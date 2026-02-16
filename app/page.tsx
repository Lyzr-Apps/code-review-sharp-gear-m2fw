'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  VscSearch, VscShield, VscWarning, VscError, VscInfo, VscCheck,
  VscCopy, VscChevronDown, VscChevronRight, VscTrash, VscLock,
  VscKey, VscEye
} from 'react-icons/vsc'
import { HiOutlineShieldCheck, HiOutlineExclamationCircle } from 'react-icons/hi'

const AGENT_ID = '6993612096cbde6a643c0a2c'

const AGENTS = [
  { id: '6993612096cbde6a643c0a2c', name: 'PII Detection Agent', role: 'Scans text for PII, classifies severity, provides remediation' },
]

const THEME_VARS = {
  '--background': '222 47% 11%',
  '--foreground': '210 40% 96%',
  '--card': '222 38% 16%',
  '--card-foreground': '210 40% 96%',
  '--popover': '222 38% 18%',
  '--popover-foreground': '210 40% 96%',
  '--primary': '173 80% 50%',
  '--primary-foreground': '222 47% 11%',
  '--secondary': '222 38% 20%',
  '--secondary-foreground': '210 40% 96%',
  '--accent': '142 76% 50%',
  '--accent-foreground': '222 47% 11%',
  '--destructive': '0 84% 60%',
  '--muted': '215 20% 25%',
  '--muted-foreground': '215 20% 55%',
  '--border': '217 33% 22%',
  '--input': '217 33% 25%',
  '--ring': '173 80% 50%',
  '--radius': '0.75rem',
} as React.CSSProperties

// --- TypeScript Interfaces ---
interface ScanSummary {
  total_pii_found?: number
  critical_count?: number
  high_count?: number
  medium_count?: number
  low_count?: number
  categories_detected?: string[]
}

interface RiskAssessment {
  risk_score?: number
  risk_level?: string
  compliance_flags?: string[]
  overall_assessment?: string
}

interface Finding {
  pii_type?: string
  severity?: string
  matched_text?: string
  location?: string
  context?: string
  explanation?: string
}

interface RemediationItem {
  priority?: string
  action?: string
  description?: string
  compliance_reference?: string
}

interface PIIResult {
  scan_summary?: ScanSummary
  risk_assessment?: RiskAssessment
  findings?: Finding[]
  remediation?: RemediationItem[]
}

// --- PII Types ---
const PII_TYPES = [
  'Names', 'Email Addresses', 'Phone Numbers', 'SSN', 'Credit Cards',
  'Dates of Birth', 'Physical Addresses', 'IP Addresses', 'Driver License',
  'Medical IDs', 'Employee IDs', 'Passwords'
]

// --- Sample Data ---
const SAMPLE_TEXT = `Customer Record #4521
Name: Sarah Jane Thompson
Email: sarah.thompson@globalcorp.com
Phone: (415) 555-0187
Date of Birth: March 15, 1988

Billing Information:
Credit Card: 4532-1234-5678-9012
Expiration: 09/2026
SSN: 456-78-9012

Shipping Address:
1247 Oak Valley Drive, Apt 3B
San Francisco, CA 94110

Employee Notes:
Sarah's employee ID is EMP-2847. Her manager John Davis (john.davis@globalcorp.com)
approved the discount. IP address for last login: 192.168.45.201
Driver's License: D1234567 (California)
Medical Insurance ID: MED-9928-4415

Additional contact: husband Mark Thompson, phone 415-555-0293`

const SAMPLE_RESULT: PIIResult = {
  scan_summary: {
    total_pii_found: 14,
    critical_count: 3,
    high_count: 5,
    medium_count: 4,
    low_count: 2,
    categories_detected: [
      'Full Names', 'Email Addresses', 'Phone Numbers', 'Social Security Numbers',
      'Credit Card Numbers', 'Dates of Birth', 'Physical Addresses', 'IP Addresses',
      'Driver License Numbers', 'Medical IDs', 'Employee IDs'
    ]
  },
  risk_assessment: {
    risk_score: 92,
    risk_level: 'critical',
    compliance_flags: ['GDPR Article 9', 'CCPA Section 1798.140', 'HIPAA PHI', 'PCI DSS Requirement 3'],
    overall_assessment: 'This data contains a high concentration of sensitive PII including financial data (credit card, SSN), health-related identifiers (Medical Insurance ID), and multiple forms of direct identifiers. Immediate remediation is required to prevent data breach exposure. The combination of full name with SSN and credit card number creates an extreme identity theft risk.'
  },
  findings: [
    { pii_type: 'Social Security Number', severity: 'critical', matched_text: '456-78-9012', location: 'Line 10', context: 'SSN: 456-78-9012', explanation: 'A Social Security Number was detected. SSNs are classified as critical PII due to their permanent nature and direct use in identity theft.' },
    { pii_type: 'Credit Card Number', severity: 'critical', matched_text: '4532-1234-5678-9012', location: 'Line 8', context: 'Credit Card: 4532-1234-5678-9012', explanation: 'A credit card number (Visa) was detected. This is PCI DSS regulated data that must never be stored in plain text.' },
    { pii_type: 'Driver License Number', severity: 'critical', matched_text: 'D1234567', location: 'Line 18', context: "Driver's License: D1234567 (California)", explanation: 'A state-issued driver license number was detected. Combined with the name, this enables identity fraud.' },
    { pii_type: 'Full Name', severity: 'high', matched_text: 'Sarah Jane Thompson', location: 'Line 2', context: 'Name: Sarah Jane Thompson', explanation: 'A full legal name was detected. When combined with other PII in this record, it creates a complete identity profile.' },
    { pii_type: 'Email Address', severity: 'high', matched_text: 'sarah.thompson@globalcorp.com', location: 'Line 3', context: 'Email: sarah.thompson@globalcorp.com', explanation: 'A corporate email address was detected, revealing both personal identity and organizational affiliation.' },
    { pii_type: 'Phone Number', severity: 'high', matched_text: '(415) 555-0187', location: 'Line 4', context: 'Phone: (415) 555-0187', explanation: 'A US phone number with area code was detected. This is directly linkable PII.' },
    { pii_type: 'Physical Address', severity: 'high', matched_text: '1247 Oak Valley Drive, Apt 3B, San Francisco, CA 94110', location: 'Lines 12-13', context: 'Shipping Address section', explanation: 'A complete residential address including apartment number and ZIP code was detected.' },
    { pii_type: 'Medical Insurance ID', severity: 'high', matched_text: 'MED-9928-4415', location: 'Line 19', context: 'Medical Insurance ID: MED-9928-4415', explanation: 'A medical insurance identifier was detected. This is classified as Protected Health Information (PHI) under HIPAA.' },
    { pii_type: 'Date of Birth', severity: 'medium', matched_text: 'March 15, 1988', location: 'Line 5', context: 'Date of Birth: March 15, 1988', explanation: 'A complete date of birth was detected. Combined with name, this is a key identity verification factor.' },
    { pii_type: 'IP Address', severity: 'medium', matched_text: '192.168.45.201', location: 'Line 17', context: 'IP address for last login: 192.168.45.201', explanation: 'An IP address was detected. While this is a private range address, it reveals network location information.' },
    { pii_type: 'Email Address', severity: 'medium', matched_text: 'john.davis@globalcorp.com', location: 'Line 16', context: 'manager John Davis (john.davis@globalcorp.com)', explanation: 'A secondary email address was detected, identifying another individual by name and email.' },
    { pii_type: 'Phone Number', severity: 'medium', matched_text: '415-555-0293', location: 'Line 21', context: 'phone 415-555-0293', explanation: 'A secondary phone number was detected for an additional contact person.' },
    { pii_type: 'Employee ID', severity: 'low', matched_text: 'EMP-2847', location: 'Line 16', context: "employee ID is EMP-2847", explanation: 'An internal employee identifier was detected. While not public PII, it links to internal systems.' },
    { pii_type: 'Full Name', severity: 'low', matched_text: 'Mark Thompson', location: 'Line 21', context: 'husband Mark Thompson', explanation: 'A secondary person name was detected with a familial relationship reference.' },
  ],
  remediation: [
    { priority: 'critical', action: 'Remove or tokenize SSN and Credit Card data immediately', description: 'Social Security Numbers and credit card numbers must never be stored in plain text. Implement tokenization or encryption at rest. Use masked display (e.g., ***-**-9012) for any necessary viewing.', compliance_reference: 'PCI DSS Requirement 3.4, NIST SP 800-122' },
    { priority: 'critical', action: 'Encrypt driver license and medical insurance IDs', description: 'Government-issued IDs and health identifiers require encryption and access controls. Implement field-level encryption for these data elements.', compliance_reference: 'HIPAA Security Rule 164.312(a)(1), CCPA 1798.150' },
    { priority: 'high', action: 'Implement data minimization for personal identifiers', description: 'Evaluate whether full names, complete addresses, and dates of birth need to be stored in this format. Consider pseudonymization or partial redaction where full data is not required.', compliance_reference: 'GDPR Article 5(1)(c), CCPA 1798.100' },
    { priority: 'high', action: 'Restrict access with role-based controls', description: 'This record contains sufficient data for complete identity theft. Implement strict role-based access controls (RBAC) and audit logging for any access to this data.', compliance_reference: 'GDPR Article 32, SOC 2 CC6.1' },
    { priority: 'medium', action: 'Redact secondary individual PII', description: 'The record contains PII for secondary individuals (John Davis, Mark Thompson) who may not have consented to this data storage. Remove or anonymize these references.', compliance_reference: 'GDPR Article 6(1), CCPA 1798.100(a)' },
    { priority: 'low', action: 'Review IP address and employee ID storage', description: 'Assess whether IP address logging and employee ID references are necessary in this customer record. Consider storing these in separate, access-controlled systems.', compliance_reference: 'GDPR Recital 30, ISO 27001 A.8.2' },
  ]
}

// --- Helpers ---
function getSeverityColor(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'hsl(0 84% 60%)'
  if (s === 'high') return 'hsl(25 95% 60%)'
  if (s === 'medium' || s === 'moderate') return 'hsl(38 92% 55%)'
  return 'hsl(142 76% 50%)'
}

function getSeverityBg(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'bg-red-500/15 text-red-400 border border-red-500/30'
  if (s === 'high') return 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
  if (s === 'medium' || s === 'moderate') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
}

function getSeverityIcon(severity: string) {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return <VscError className="h-4 w-4 text-red-400 flex-shrink-0" />
  if (s === 'high') return <VscWarning className="h-4 w-4 text-orange-400 flex-shrink-0" />
  if (s === 'medium' || s === 'moderate') return <VscWarning className="h-4 w-4 text-amber-400 flex-shrink-0" />
  return <VscInfo className="h-4 w-4 text-emerald-400 flex-shrink-0" />
}

function getRiskColor(level: string): string {
  const l = (level ?? '').toLowerCase()
  if (l === 'critical') return 'hsl(0 84% 60%)'
  if (l === 'high') return 'hsl(25 95% 60%)'
  if (l === 'moderate') return 'hsl(38 92% 55%)'
  return 'hsl(142 76% 50%)'
}

function getPriorityBg(priority: string): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'critical') return 'bg-red-500/15 text-red-400 border border-red-500/30'
  if (p === 'high') return 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
  if (p === 'medium') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
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

// --- Sub-Components ---

function DataEditorArea({ text, onChange, lineCount }: { text: string; onChange: (val: string) => void; lineCount: number }) {
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
    <div className="relative flex rounded-lg overflow-hidden border border-border shadow-xl" style={{ backgroundColor: 'hsl(222 47% 8%)' }}>
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 select-none overflow-hidden py-3 px-2 text-right font-mono text-xs leading-6"
        style={{ color: 'hsl(215 20% 35%)', width: '3.5rem' }}
      >
        {lines.map(n => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <div className="w-px flex-shrink-0" style={{ backgroundColor: 'hsl(217 33% 18%)' }} />
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder="Paste your text, data, or documents here to scan for PII..."
        spellCheck={false}
        className="flex-1 resize-none bg-transparent py-3 px-4 font-mono text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
        style={{ minHeight: '420px', tabSize: 4 }}
      />
    </div>
  )
}

function RiskScoreGauge({ score, level }: { score: number; level: string }) {
  const color = getRiskColor(level)
  const circumference = 2 * Math.PI * 54
  const progress = ((score ?? 0) / 100) * circumference
  const offset = circumference - progress

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(217 33% 18%)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score ?? 0}</span>
          <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
        </div>
      </div>
      <Badge className={`mt-3 text-xs font-semibold uppercase tracking-wider ${getSeverityBg(level)}`} variant="outline">
        {level ?? 'Unknown'} Risk
      </Badge>
    </div>
  )
}

function ScanSummaryGrid({ summary }: { summary: ScanSummary }) {
  const counts = [
    { label: 'Total PII', count: summary?.total_pii_found ?? 0, color: 'hsl(173 80% 50%)' },
    { label: 'Critical', count: summary?.critical_count ?? 0, color: 'hsl(0 84% 60%)' },
    { label: 'High', count: summary?.high_count ?? 0, color: 'hsl(25 95% 60%)' },
    { label: 'Medium', count: summary?.medium_count ?? 0, color: 'hsl(38 92% 55%)' },
    { label: 'Low', count: summary?.low_count ?? 0, color: 'hsl(142 76% 50%)' },
  ]

  return (
    <div className="grid grid-cols-5 gap-2">
      {counts.map((item) => (
        <div key={item.label} className="text-center rounded-lg p-2.5" style={{ backgroundColor: 'hsl(222 47% 8%)' }}>
          <div className="text-xl font-bold" style={{ color: item.color }}>{item.count}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function FindingsSection({
  findings, expandedSections, toggleSection, onCopy, copiedId, filterSeverity, setFilterSeverity
}: {
  findings: Finding[]
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
  filterSeverity: string
  setFilterSeverity: (v: string) => void
}) {
  const isOpen = expandedSections['findings'] !== false

  const filteredFindings = useMemo(() => {
    if (filterSeverity === 'all') return findings
    return findings.filter(f => (f?.severity ?? '').toLowerCase() === filterSeverity)
  }, [findings, filterSeverity])

  return (
    <Card className="border-border shadow-xl">
      <Collapsible open={isOpen} onOpenChange={() => toggleSection('findings')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ backgroundColor: 'hsl(25 95% 60% / 0.15)' }}>
                  <VscEye className="h-5 w-5" style={{ color: 'hsl(25 95% 60%)' }} />
                </div>
                <div>
                  <CardTitle className="text-base">PII Findings</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{findings.length} item{findings.length !== 1 ? 's' : ''} detected</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/15 text-primary border border-primary/30 hidden sm:inline-flex" variant="outline">{findings.length}</Badge>
                {isOpen ? <VscChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <VscChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
                <button
                  key={sev}
                  onClick={(e) => { e.stopPropagation(); setFilterSeverity(sev); }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterSeverity === sev ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                >
                  {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              ))}
            </div>

            {filteredFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No findings matching this filter.</p>
            ) : (
              filteredFindings.map((finding, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2.5" style={{ backgroundColor: 'hsl(222 47% 8%)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                      {getSeverityIcon(finding?.severity ?? '')}
                      <Badge className={getSeverityBg(finding?.severity ?? '')} variant="outline">
                        {(finding?.severity ?? 'low').toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm text-foreground">{finding?.pii_type ?? 'Unknown PII'}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); onCopy(`${finding?.pii_type ?? ''}: ${finding?.matched_text ?? ''} - ${finding?.explanation ?? ''}`, `finding-${idx}`); }}
                    >
                      {copiedId === `finding-${idx}` ? <VscCheck className="h-3.5 w-3.5 text-emerald-400" /> : <VscCopy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  {/* Matched text with redaction style */}
                  <div className="rounded-md px-3 py-2 font-mono text-sm" style={{ backgroundColor: 'hsl(0 84% 60% / 0.08)', borderLeft: `3px solid ${getSeverityColor(finding?.severity ?? '')}` }}>
                    <span className="text-xs text-muted-foreground block mb-1">Matched Text</span>
                    <span className="text-foreground">{finding?.matched_text ?? ''}</span>
                  </div>

                  {/* Location */}
                  {finding?.location && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'hsl(173 80% 50% / 0.1)', color: 'hsl(173 80% 55%)' }}>
                        {finding.location}
                      </span>
                    </div>
                  )}

                  {/* Context */}
                  {finding?.context && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">Context: </span>
                      <span className="font-mono">{finding.context}</span>
                    </div>
                  )}

                  {/* Explanation */}
                  {finding?.explanation && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{finding.explanation}</p>
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

function RemediationSection({
  remediation, expandedSections, toggleSection, onCopy, copiedId
}: {
  remediation: RemediationItem[]
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  onCopy: (text: string, id: string) => void
  copiedId: string | null
}) {
  const isOpen = expandedSections['remediation'] !== false

  return (
    <Card className="border-border shadow-xl">
      <Collapsible open={isOpen} onOpenChange={() => toggleSection('remediation')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ backgroundColor: 'hsl(142 76% 50% / 0.15)' }}>
                  <HiOutlineShieldCheck className="h-5 w-5" style={{ color: 'hsl(142 76% 55%)' }} />
                </div>
                <div>
                  <CardTitle className="text-base">Remediation Actions</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{remediation.length} action{remediation.length !== 1 ? 's' : ''} recommended</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hidden sm:inline-flex" variant="outline">{remediation.length}</Badge>
                {isOpen ? <VscChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <VscChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {remediation.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No remediation actions needed.</p>
            ) : (
              remediation.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2" style={{ backgroundColor: 'hsl(222 47% 8%)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full flex-shrink-0 font-mono text-xs font-bold mt-0.5" style={{ backgroundColor: 'hsl(173 80% 50% / 0.15)', color: 'hsl(173 80% 55%)' }}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={getPriorityBg(item?.priority ?? '')} variant="outline">
                            {(item?.priority ?? 'low').toUpperCase()}
                          </Badge>
                          <span className="font-medium text-sm text-foreground">{item?.action ?? 'Action Required'}</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item?.description ?? ''}</p>
                        {item?.compliance_reference && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <VscLock className="h-3 w-3 text-primary flex-shrink-0" />
                            <span className="text-xs font-mono" style={{ color: 'hsl(173 80% 55%)' }}>
                              {item.compliance_reference}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); onCopy(`${item?.action ?? ''}: ${item?.description ?? ''} (${item?.compliance_reference ?? ''})`, `rem-${idx}`); }}
                    >
                      {copiedId === `rem-${idx}` ? <VscCheck className="h-3.5 w-3.5 text-emerald-400" /> : <VscCopy className="h-3.5 w-3.5" />}
                    </Button>
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

function LoadingSkeletons() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <VscSearch className="h-5 w-5 text-primary animate-pulse" />
        <span className="text-sm text-muted-foreground animate-pulse">Scanning for PII...</span>
      </div>
      {/* Risk score skeleton */}
      <Card className="border-border shadow-lg">
        <CardContent className="py-6 flex flex-col items-center">
          <Skeleton className="h-36 w-36 rounded-full" />
          <Skeleton className="h-5 w-24 mt-3 rounded-full" />
          <Skeleton className="h-3 w-48 mt-3" />
        </CardContent>
      </Card>
      {/* Summary skeleton */}
      <Card className="border-border shadow-lg">
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
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-2 pt-2 flex-wrap">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Findings skeleton */}
      {[1, 2].map(i => (
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
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EmptyResultsState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: 'hsl(222 38% 18%)' }}>
        <VscShield className="h-12 w-12 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Submit data to scan for PII</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">Paste text, customer records, logs, or any data in the left panel and click scan. PII Shield will detect and classify all personally identifiable information.</p>
    </div>
  )
}

function AgentStatusPanel({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <Card className="border-border">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="space-y-1.5">
          {AGENTS.map(agent => {
            const isActive = activeAgentId === agent.id
            return (
              <div
                key={agent.id}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
                style={{ backgroundColor: isActive ? 'hsl(173 80% 50% / 0.08)' : 'transparent' }}
              >
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: isActive
                      ? 'hsl(173 80% 50%)'
                      : activeAgentId
                        ? 'hsl(215 20% 35%)'
                        : 'hsl(142 76% 50%)'
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

// --- Main Page Component ---
export default function Page() {
  const [inputText, setInputText] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<PIIResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showSampleData, setShowSampleData] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState('all')

  // Determine display data
  const displayText = showSampleData && !inputText ? SAMPLE_TEXT : inputText
  const displayResult = showSampleData && !scanResult ? SAMPLE_RESULT : scanResult

  const lineCount = useMemo(() => {
    return displayText.split('\n').length
  }, [displayText])

  const handleScan = useCallback(async () => {
    const textToScan = displayText.trim()
    if (!textToScan) return

    setIsScanning(true)
    setError(null)
    setScanResult(null)
    setActiveAgentId(AGENT_ID)
    setFilterSeverity('all')

    const message = `Please scan the following text/data for any Personally Identifiable Information (PII):\n\n${textToScan}`

    try {
      const result = await callAIAgent(message, AGENT_ID)
      if (result.success) {
        setScanResult(result?.response?.result as PIIResult)
      } else {
        setError(result?.error ?? 'Scan failed. Please try again.')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsScanning(false)
      setActiveAgentId(null)
    }
  }, [displayText])

  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const handleClear = useCallback(() => {
    setInputText('')
    setScanResult(null)
    setError(null)
    setExpandedSections({})
    setShowSampleData(false)
    setFilterSeverity('all')
  }, [])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }))
  }, [])

  const handleTextChange = useCallback((val: string) => {
    setInputText(val)
    if (showSampleData) setShowSampleData(false)
  }, [showSampleData])

  // Safely extract result data
  const summary: ScanSummary = displayResult?.scan_summary ?? {}
  const riskAssessment: RiskAssessment = displayResult?.risk_assessment ?? {}
  const findings = Array.isArray(displayResult?.findings) ? displayResult.findings : []
  const remediation = Array.isArray(displayResult?.remediation) ? displayResult.remediation : []

  const hasResults = displayResult !== null
  const isFormValid = displayText.trim().length > 0

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border backdrop-blur-xl" style={{ backgroundColor: 'hsl(222 47% 11% / 0.92)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ backgroundColor: 'hsl(173 80% 50% / 0.15)' }}>
              <VscShield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground" style={{ letterSpacing: '-0.01em' }}>PII Shield</h1>
              <p className="text-xs text-muted-foreground hidden sm:block" style={{ letterSpacing: '-0.01em' }}>AI-Powered PII Detection & Data Privacy Scanner</p>
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
          {/* Left Column - Data Input (55%) */}
          <div className="w-full lg:w-[55%] space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <VscSearch className="h-4 w-4 text-primary" />
                Scan Data
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Paste text, customer records, logs, CSVs, or any data to scan for personally identifiable information.</p>
            </div>

            <DataEditorArea
              text={displayText}
              onChange={handleTextChange}
              lineCount={lineCount}
            />

            <Button
              onClick={handleScan}
              disabled={isScanning || !isFormValid}
              className="w-full h-10 font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
            >
              {isScanning ? (
                <span className="flex items-center gap-2">
                  <VscSearch className="h-4 w-4 animate-spin" />
                  Scanning for PII...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <VscShield className="h-4 w-4" />
                  Scan for PII
                </span>
              )}
            </Button>

            {/* PII Types Info */}
            <Card className="border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <VscKey className="h-3.5 w-3.5" />
                  Detectable PII Types
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {PII_TYPES.map(type => (
                    <Badge key={type} className="bg-secondary/60 text-foreground/70 border border-border text-xs" variant="outline">
                      {type}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Agent Status Panel */}
            <AgentStatusPanel activeAgentId={activeAgentId} />
          </div>

          {/* Right Column - Results (45%) */}
          <div className="w-full lg:w-[45%]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <HiOutlineShieldCheck className="h-4 w-4 text-primary" />
                  Scan Results
                </h2>
                <p className="text-xs text-muted-foreground">Risk assessment, findings, and remediation</p>
              </div>
              {hasResults && (
                <Button
                  onClick={handleClear}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <VscTrash className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <ScrollArea className="lg:h-[calc(100vh-10rem)]">
              <div className="space-y-4 pr-1">
                {isScanning ? (
                  <LoadingSkeletons />
                ) : !hasResults ? (
                  <EmptyResultsState />
                ) : (
                  <>
                    {/* Risk Score Card */}
                    <Card className="border-border shadow-xl">
                      <CardContent className="py-6">
                        <RiskScoreGauge
                          score={riskAssessment?.risk_score ?? 0}
                          level={riskAssessment?.risk_level ?? 'low'}
                        />

                        {/* Compliance Flags */}
                        {Array.isArray(riskAssessment?.compliance_flags) && (riskAssessment.compliance_flags.length ?? 0) > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-muted-foreground text-center mb-2 flex items-center justify-center gap-1">
                              <VscLock className="h-3 w-3" />
                              Compliance Flags
                            </p>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {riskAssessment.compliance_flags.map((flag, idx) => (
                                <Badge key={idx} className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs" variant="outline">
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Overall Assessment */}
                        {riskAssessment?.overall_assessment && (
                          <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: 'hsl(222 47% 8%)' }}>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Overall Assessment</p>
                            <div className="text-sm text-foreground/85 leading-relaxed">
                              {renderMarkdown(riskAssessment.overall_assessment)}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Scan Summary Card */}
                    <Card className="border-border shadow-xl">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ backgroundColor: 'hsl(173 80% 50% / 0.15)' }}>
                            <VscSearch className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Scan Summary</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{summary?.total_pii_found ?? 0} PII instances found</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <ScanSummaryGrid summary={summary} />

                        {/* Categories Detected */}
                        {Array.isArray(summary?.categories_detected) && (summary.categories_detected.length ?? 0) > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Categories Detected</p>
                            <div className="flex flex-wrap gap-1.5">
                              {summary.categories_detected.map((cat, idx) => (
                                <Badge key={idx} className="bg-primary/10 text-primary border border-primary/25 text-xs" variant="outline">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Findings Section */}
                    <FindingsSection
                      findings={findings}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                      filterSeverity={filterSeverity}
                      setFilterSeverity={setFilterSeverity}
                    />

                    {/* Remediation Section */}
                    <RemediationSection
                      remediation={remediation}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                    />

                    {/* Copy Full Report */}
                    <Button
                      onClick={() => {
                        const reportText = [
                          `PII Shield Scan Report`,
                          `Risk Score: ${riskAssessment?.risk_score ?? 0}/100 (${riskAssessment?.risk_level ?? 'unknown'})`,
                          `Total PII Found: ${summary?.total_pii_found ?? 0}`,
                          ``,
                          `Assessment: ${riskAssessment?.overall_assessment ?? ''}`,
                          ``,
                          `Compliance Flags: ${Array.isArray(riskAssessment?.compliance_flags) ? riskAssessment.compliance_flags.join(', ') : 'None'}`,
                          ``,
                          `Findings:`,
                          ...findings.map((f, i) => `${i + 1}. [${(f?.severity ?? 'low').toUpperCase()}] ${f?.pii_type ?? 'Unknown'}: ${f?.matched_text ?? ''} (${f?.location ?? ''})`),
                          ``,
                          `Remediation:`,
                          ...remediation.map((r, i) => `${i + 1}. [${(r?.priority ?? 'low').toUpperCase()}] ${r?.action ?? ''}: ${r?.description ?? ''}`)
                        ].join('\n')
                        handleCopy(reportText, 'full-report')
                      }}
                      variant="outline"
                      className="w-full h-9 text-sm border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      {copiedId === 'full-report' ? (
                        <span className="flex items-center gap-2">
                          <VscCheck className="h-4 w-4 text-emerald-400" />
                          Report Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <VscCopy className="h-4 w-4" />
                          Copy Full Report
                        </span>
                      )}
                    </Button>
                  </>
                )}

                {/* Error state */}
                {error && !hasResults && !isScanning && (
                  <div className="rounded-xl border border-red-500/30 p-5 text-center" style={{ backgroundColor: 'hsl(0 84% 60% / 0.06)' }}>
                    <HiOutlineExclamationCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-red-400 mb-1">Scan Failed</p>
                    <p className="text-xs text-muted-foreground mb-3">{error}</p>
                    <Button
                      onClick={handleScan}
                      variant="outline"
                      size="sm"
                      className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={isScanning || !isFormValid}
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
