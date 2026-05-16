'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Database } from 'lucide-react'

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newPrompt, setNewPrompt] = useState({ style_name: '', pose_name: '', prompt_text: '' })

  const fetchPrompts = async () => {
    const res = await fetch('/api/prompts')
    const json = await res.json()
    setPrompts(json.prompts || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrompt),
    })
    setNewPrompt({ style_name: '', pose_name: '', prompt_text: '' })
    fetchPrompts()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' })
    fetchPrompts()
  }

  const handleSeed = async () => {
    setLoading(true)
    await fetch('/api/prompts/seed', { method: 'POST' })
    fetchPrompts()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Prompts Configuration</h1>
          <p className="text-muted-foreground mt-2">
            {prompts.length} prompts configured. Each face will generate {prompts.length} images.
          </p>
        </div>
        <button
          onClick={handleSeed}
          className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 border border-border"
        >
          <Database className="h-4 w-4" /> Seed Default Prompts
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-card p-6 rounded-xl border border-border sticky top-8">
            <h2 className="text-xl font-bold text-foreground mb-4">Add New Prompt</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Style</label>
                <input
                  type="text"
                  placeholder="e.g. Cyberpunk"
                  value={newPrompt.style_name}
                  onChange={(e) => setNewPrompt({ ...newPrompt, style_name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pose</label>
                <input
                  type="text"
                  placeholder="e.g. Action Scene"
                  value={newPrompt.pose_name}
                  onChange={(e) => setNewPrompt({ ...newPrompt, pose_name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Full Prompt Text</label>
                <textarea
                  placeholder="Detailed prompt description..."
                  value={newPrompt.prompt_text}
                  onChange={(e) => setNewPrompt({ ...newPrompt, prompt_text: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                <Plus className="h-4 w-4" /> Add Prompt
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-muted-foreground animate-pulse">Loading prompts...</div>
          ) : prompts.length === 0 ? (
            <div className="text-center p-12 border border-dashed border-border rounded-xl text-muted-foreground">
              No prompts configured. Add one or seed defaults.
            </div>
          ) : (
            prompts.map((prompt) => (
              <div key={prompt.id} className="bg-card p-4 rounded-xl border border-border flex flex-col sm:flex-row gap-4 items-start justify-between group">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/20 text-primary px-2 py-1 rounded text-xs font-semibold">
                      {prompt.style_name}
                    </span>
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs font-semibold border border-border">
                      {prompt.pose_name}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{prompt.prompt_text}</p>
                </div>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-2 rounded-md hover:bg-destructive/10"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
