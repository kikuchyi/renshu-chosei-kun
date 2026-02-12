
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CreateGroupDialog } from '@/components/create-group-dialog'
import { JoinGroupDialog } from '@/components/join-group-dialog'
import { GroupList } from '@/components/group-list'
import { logout } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
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
    // Handle error gracefully
    return <div>Error loading groups</div>
  }

  // Extract groups from members data
  const groups = members?.map((member: any) => member.groups).filter(Boolean) || []

  const displayName = profile?.display_name || 'ゲスト'

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{displayName}のグループ</h1>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">
              プロフィール設定
            </Link>
          </Button>
          <JoinGroupDialog />
          <CreateGroupDialog />
          <form action={logout} className="inline">
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </form>
        </div>
      </div>

      <GroupList groups={groups} currentUserId={user.id} />
    </div>
  )
}
