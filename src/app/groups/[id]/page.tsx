
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AvailabilityInput } from '@/components/availability-input'
import { AvailabilityHeatmap } from '@/components/availability-heatmap'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { GroupMemberList } from '@/components/group-member-list'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{
        id: string
    }>
}

export default async function GroupPage(props: PageProps) {
    const params = await props.params
    const { id } = params

    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 1. Fetch group details
    const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single()

    if (groupError || !group) {
        return <div>グループが見つかりません</div>
    }

    // 2. Fetch availabilities
    const { data: availabilities } = await supabase
        .from('availabilities')
        .select('*')
        .eq('group_id', id)

    // 3. Fetch members with user details
    const { data: members } = await supabase
        .from('group_members')
        .select('*, users:user_id(*)')
        .eq('group_id', id)

    // 4. Fetch practice events
    const { data: practiceEvents } = await supabase
        .from('practice_events')
        .select('*')
        .eq('group_id', id)
        .order('start_time', { ascending: true })

    // 5. Fetch busy slots for all group members
    const memberIds = members?.map((m: any) => m.user_id) || []
    const { data: busySlots } = await supabase
        .from('user_busy_slots')
        .select('*')
        .in('user_id', memberIds)

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="mb-6">
                <Button variant="ghost" asChild className="mb-4 pl-0 hover:pl-0 hover:bg-transparent">
                    <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        ダッシュボードに戻る
                    </Link>
                </Button>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
                        <p className="text-sm text-gray-500">招待コード: {group.invite_code}</p>
                    </div>
                </div>

                <div className="space-y-8">
                    <section>
                        <GroupMemberList
                            groupId={group.id}
                            currentUserId={user.id}
                            members={members || []}
                        />
                        <AvailabilityInput
                            groupId={group.id}
                            userId={user.id}
                            availabilities={availabilities || []}
                        />
                    </section>

                    <div className="grid gap-6">
                        <section>
                            <AvailabilityHeatmap
                                availabilities={availabilities || []}
                                totalMembers={members?.length || 0}
                                groupId={group.id}
                                practiceEvents={practiceEvents || []}
                                busySlots={busySlots || []}
                            />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
