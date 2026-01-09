import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'
import {
  Search,
  Send,
  Copy,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  Upload,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// Agent ID and RAG ID
const AGENT_ID = "69618f6cc57d451439d4d682"
const RAG_ID = "69618f5aee18986913060e4b"

// TypeScript interfaces based on REAL response schema
interface Source {
  document?: string
  excerpt?: string
  page?: number
  [key: string]: any
}

interface KnowledgeSearchResult {
  answer: string
  sources: Source[]
  context_maintained: boolean
  follow_up_suggestions: string[]
  confidence: number
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  response?: KnowledgeSearchResult
}

interface UploadedFile {
  name: string
  size: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

// Starter questions
const STARTER_QUESTIONS = [
  "What are the key findings?",
  "Summarize the main conclusions",
  "What are the important dates mentioned?",
  "Explain the methodology used"
]

export default function Home() {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(`session-${Date.now()}`)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Handle sending a message
  const handleSend = async (message: string) => {
    if (!message.trim() || loading) return

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await callAIAgent(message.trim(), AGENT_ID, { session_id: sessionId })

      if (result.success && result.response.status === 'success') {
        const assistantMessage: ConversationMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response.result.answer || 'No answer provided',
          timestamp: new Date(),
          response: result.response.result as KnowledgeSearchResult
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        const errorMessage: ConversationMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: result.response.message || 'Sorry, I encountered an error processing your request.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage: ConversationMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Network error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Handle starter question click
  const handleStarterClick = (question: string) => {
    handleSend(question)
  }

  // Handle new conversation
  const handleNewConversation = () => {
    setMessages([])
    setSessionId(`session-${Date.now()}`)
    setInput('')
    inputRef.current?.focus()
  }

  // Handle copy response
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      status: 'uploading' as const
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Upload files to RAG
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileIndex = uploadedFiles.length + i

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`https://rag-prod.studio.lyzr.ai/v2/rag/${RAG_ID}/ingest`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        setUploadedFiles(prev => prev.map((f, idx) =>
          idx === fileIndex ? { ...f, status: 'completed' as const } : f
        ))
      } catch (error) {
        setUploadedFiles(prev => prev.map((f, idx) =>
          idx === fileIndex ? {
            ...f,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ))
      }
    }
  }

  // Remove uploaded file from list
  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, idx) => idx !== index))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Knowledge Search</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload PDFs
            </Button>
            {messages.length > 0 && (
              <Button
                onClick={handleNewConversation}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Conversation Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && !loading ? (
            <WelcomeState onQuestionClick={handleStarterClick} />
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((message) => (
                <MessageBlock
                  key={message.id}
                  message={message}
                  onCopy={handleCopy}
                />
              ))}
              {loading && <LoadingState />}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky bottom-0">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend(input)
              }}
              className="relative"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your documents..."
                disabled={loading}
                className="h-12 pr-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-teal-500 focus:ring-teal-500/20"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || loading}
                className="absolute right-2 top-2 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          uploadedFiles={uploadedFiles}
          onClose={() => setShowUploadModal(false)}
          onFileUpload={handleFileUpload}
          onRemoveFile={handleRemoveFile}
          fileInputRef={fileInputRef}
        />
      )}
    </div>
  )
}

// Welcome state component
function WelcomeState({ onQuestionClick }: { onQuestionClick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6">
        <Search className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-3">
        Search Your Knowledge Base
      </h2>
      <p className="text-slate-400 text-lg mb-8 max-w-md">
        Ask questions about your documents and get answers with citations
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
        {STARTER_QUESTIONS.map((question, i) => (
          <button
            key={i}
            onClick={() => onQuestionClick(question)}
            className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-teal-500 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-left"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}

// Loading state component
function LoadingState() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Searching your knowledge base...</span>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-800/50 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-slate-800/50 rounded w-full animate-pulse" />
          <div className="h-4 bg-slate-800/50 rounded w-5/6 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// Message block component
function MessageBlock({
  message,
  onCopy
}: {
  message: ConversationMessage
  onCopy: (text: string) => void
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-teal-600 text-white">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="prose prose-invert max-w-none">
          <div className="text-slate-200 leading-relaxed">
            {message.response ? (
              <AnswerWithCitations
                answer={message.response.answer}
                sources={message.response.sources}
              />
            ) : (
              message.content
            )}
          </div>
        </div>

        {message.response && message.response.sources && message.response.sources.length > 0 && (
          <SourceCards sources={message.response.sources} />
        )}

        {message.response && message.response.follow_up_suggestions && message.response.follow_up_suggestions.length > 0 && (
          <FollowUpSuggestions suggestions={message.response.follow_up_suggestions} />
        )}

        <div className="flex items-center gap-3 pt-2">
          {message.response && message.response.confidence !== undefined && (
            <Badge variant="outline" className="border-slate-700 text-slate-400">
              {Math.round(message.response.confidence * 100)}% confidence
            </Badge>
          )}
          <Button
            onClick={() => onCopy(message.content)}
            size="sm"
            variant="ghost"
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
        </div>
      </div>
    </div>
  )
}

// Answer with inline citations
function AnswerWithCitations({ answer, sources }: { answer: string; sources: Source[] }) {
  if (!sources || sources.length === 0) {
    return <span>{answer}</span>
  }

  // Simple citation rendering - numbers in square brackets
  const parts = answer.split(/(\[\d+\])/)

  return (
    <span>
      {parts.map((part, i) => {
        const citationMatch = part.match(/\[(\d+)\]/)
        if (citationMatch) {
          const num = citationMatch[1]
          return (
            <sup
              key={i}
              className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-teal-400 bg-teal-950 border border-teal-800 rounded ml-0.5"
            >
              {num}
            </sup>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// Source cards component
function SourceCards({ sources }: { sources: Source[] }) {
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())

  const toggleSource = (index: number) => {
    const newExpanded = new Set(expandedSources)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSources(newExpanded)
  }

  if (!sources || sources.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-400 mb-2">Sources</div>
      {sources.map((source, index) => {
        const isExpanded = expandedSources.has(index)
        const documentName = source.document || source.title || `Source ${index + 1}`
        const excerpt = source.excerpt || source.content || source.text || ''
        const page = source.page

        return (
          <Card
            key={index}
            className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors"
          >
            <CardContent className="p-3">
              <button
                onClick={() => toggleSource(index)}
                className="w-full flex items-start gap-3 text-left"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-teal-400 bg-teal-950 border border-teal-800 rounded flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {documentName}
                    </span>
                    {page !== undefined && (
                      <Badge variant="outline" className="border-slate-700 text-slate-500 text-xs">
                        p. {page}
                      </Badge>
                    )}
                  </div>
                  {excerpt && (
                    <p className={`text-sm text-slate-400 mt-1 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {excerpt}
                    </p>
                  )}
                </div>
                {excerpt && (
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                )}
              </button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Follow-up suggestions component
function FollowUpSuggestions({ suggestions }: { suggestions: string[] }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-400">Follow-up questions</div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, i) => (
          <Badge
            key={i}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:border-teal-500 hover:text-teal-400 cursor-pointer transition-colors"
          >
            {suggestion}
          </Badge>
        ))}
      </div>
    </div>
  )
}

// Upload Modal component
function UploadModal({
  uploadedFiles,
  onClose,
  onFileUpload,
  onRemoveFile,
  fileInputRef
}: {
  uploadedFiles: UploadedFile[]
  onClose: () => void
  onFileUpload: (files: FileList | null) => void
  onRemoveFile: (index: number) => void
  fileInputRef: React.RefObject<HTMLInputElement>
}) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-slate-900 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Upload PDF Documents</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-slate-400 mb-6">
            Upload PDF documents to build your knowledge base. The agent will search through these documents to answer your questions.
          </p>

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-teal-500 hover:bg-slate-800/30 transition-all cursor-pointer mb-6"
          >
            <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium mb-1">Click to upload PDF files</p>
            <p className="text-sm text-slate-500">or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => onFileUpload(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Uploaded Files</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {file.status === 'uploading' && (
                        <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                      )}
                      {file.status === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      <Button
                        onClick={() => onRemoveFile(index)}
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-400 hover:bg-slate-800 h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-700">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
