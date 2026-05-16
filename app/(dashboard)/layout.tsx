import Link from 'next/link'
import { LayoutDashboard, Users, Image as ImageIcon, Briefcase, FileText } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/faces', label: 'Faces', icon: Users },
    { href: '/prompts', label: 'Prompts', icon: FileText },
    { href: '/gallery', label: 'Gallery', icon: ImageIcon },
    { href: '/jobs', label: 'Jobs', icon: Briefcase },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="flex h-16 items-center px-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary">AIGFStudio</h1>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-background overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
