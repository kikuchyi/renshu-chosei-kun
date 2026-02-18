
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CreateGroupDialog } from '@/components/create-group-dialog'
import { JoinGroupDialog } from '@/components/join-group-dialog'
import { GroupList } from '@/components/group-list'
import { logout } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { LogOut, Settings } from 'lucide-react'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch groups user is a member of
  const { data: members, error } = await supabase
    .from('group_members')
    .select('*, groups(*)')
    .eq('user_id', user.id)

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching groups:', error)
    return <div>Error loading groups</div>
  }

  // Extract groups from members data
  const groups = members?.map((member: any) => member.groups).filter(Boolean) || []

  const displayName = profile?.display_name || 'ゲスト'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate mr-2">
              {displayName}
            </h1>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">プロフィール設定</span>
                </Link>
              </Button>
              <form action={logout} className="inline">
                <Button type="submit" variant="ghost" size="icon" className="h-9 w-9">
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">ログアウト</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <JoinGroupDialog />
          <CreateGroupDialog />
        </div>

        {/* Group List */}
        <GroupList groups={groups} currentUserId={user.id} />
      </main>
    </div>
  )
}
