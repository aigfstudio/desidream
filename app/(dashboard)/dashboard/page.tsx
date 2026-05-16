'use client'

import { useState, useEffect } from 'react'
import { Users, FileText, Image as ImageIcon, Briefcase, Play, Pause, RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('/api/batch/status')
      const data = await res.json()
      setStats(data.stats)
      setSession(data.session)
      setLoading(false)
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleAction = async (action: 'start' | 'pause' | 'resume') => {
    await fetch(`/api/batch/${action}`, { method: 'POST' })
    // fetchStatus will auto-update in 5s
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Loading dashboard...</div>
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pipeline Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage your bulk AI image generation process.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-xl border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-5 w-5" />
            <span className="font-medium">Total Faces</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats?.facesCount || 0}</div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FileText className="h-5 w-5" />
            <span className="font-medium">Total Prompts</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats?.promptsCount || 0}</div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ImageIcon className="h-5 w-5" />
            <span className="font-medium">Total Images Expected</span>
          </div>
          <div className="text-3xl font-bold text-primary">
            {(stats?.facesCount || 0) * (stats?.promptsCount || 0)}
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Briefcase className="h-5 w-5" />
            <span className="font-medium">Failed Jobs</span>
          </div>
          <div className="text-3xl font-bold text-destructive">{session?.failed_jobs || 0}</div>
        </div>
      </div>

      {/* Active Session Controls */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Current Batch Session</h2>
        
        {session ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className={`text-lg font-medium capitalize 
                  ${session.status === 'running' ? 'text-primary' : ''}
                  ${session.status === 'paused' ? 'text-yellow-500' : ''}
                  ${session.status === 'completed' ? 'text-blue-500' : ''}
                `}>
                  {session.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Progress</div>
                <div className="text-lg font-medium text-foreground">
                  {session.completed_jobs} / {session.total_jobs} ({((session.completed_jobs / session.total_jobs) * 100).toFixed(1)}%)
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${(session.completed_jobs / session.total_jobs) * 100}%` }}
              />
            </div>

            <div className="flex gap-4">
              {session.status === 'paused' ? (
                <button 
                  onClick={() => handleAction('resume')}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  <Play className="h-4 w-4" /> Resume Batch
                </button>
              ) : session.status === 'running' ? (
                <button 
                  onClick={() => handleAction('pause')}
                  className="flex items-center gap-2 bg-yellow-600 text-primary-foreground px-4 py-2 rounded-md hover:bg-yellow-600/90"
                >
                  <Pause className="h-4 w-4" /> Pause Batch
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No active batch session.</p>
            <button 
              onClick={() => handleAction('start')}
              className="flex items-center justify-center gap-2 mx-auto bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90"
            >
              <Play className="h-5 w-5" /> Start New Batch
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
