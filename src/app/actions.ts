'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { listEvents } from '@/utils/google-calendar'

function generateInviteCode(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

export async function updateProfile(formData: FormData) {
    const displayName = formData.get('displayName') as string
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('ログインが必要です')
    }

    const { error } = await supabase
        .from('users')
        .update({ display_name: displayName })
        .eq('id', user.id)

    if (error) {
        console.error('Error updating profile:', error)
        throw new Error('プロフィールの更新に失敗しました')
    }

    revalidatePath('/', 'layout')
    return { success: true }
}

export async function createGroup(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 1. Create Group with unique 6-digit code
    let inviteCode = ''
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 10) {
        inviteCode = generateInviteCode(6)
        const { data: existing } = await supabase
            .from('groups')
            .select('id')
            .eq('invite_code', inviteCode)
            .maybeSingle()

        if (!existing) {
            isUnique = true
        }
        attempts++
    }

    const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
            name,
            created_by: user.id,
            invite_code: inviteCode
        })
        .select()
        .single()

    if (groupError) {
        console.error('Error creating group:', groupError)
        throw new Error('グループ作成に失敗しました')
    }

    // 2. Add creator as admin member
    const { error: memberError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'admin',
    })

    if (memberError) {
        console.error('Error adding member:', memberError)
        // Ideally roll back group creation here, but for MVP we might skip complex rollback logic
        throw new Error('グループへのメンバー追加に失敗しました')
    }

    revalidatePath('/')
    return { success: true, groupId: group.id }
}

export async function joinGroup(formData: FormData) {
    const supabase = await createClient()
    const code = formData.get('code') as string

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // 1. Find group by invite code
    const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', code)
        .single()

    if (groupError || !group) {
        console.error('Error finding group:', groupError)
        throw new Error('無効な招待コードです')
    }

    // 2. Add user as member
    const { error: memberError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
    })

    if (memberError) {
        if (memberError.code === '23505') { // Unique violation
            throw new Error('すでにこのグループのメンバーです')
        }
        console.error('Error joining group:', memberError)
        throw new Error('グループ参加に失敗しました')
    }

    revalidatePath('/')
    return { success: true, groupId: group.id }
}


export async function toggleAvailability(
    groupId: string,
    startTime: string, // ISO string
    endTime: string,   // ISO string
    priority: number | null // null = remove, 1 = △
) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('認証されていません')
    }

    // Verify membership
    const { data: member, error: memberError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

    if (memberError || !member) {
        throw new Error('グループメンバーではありません')
    }

    if (priority !== null) {
        // Delete existing first to avoid duplicates (since we don't have a unique constraint)
        await supabase
            .from('availabilities')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .eq('start_time', startTime)
            .eq('end_time', endTime)

        // Then Insert
        const { error } = await supabase.from('availabilities').insert({
            group_id: groupId,
            user_id: user.id,
            start_time: startTime,
            end_time: endTime,
            priority,
        })
        if (error) {
            console.error('Error inserting availability:', error)
            throw new Error('空き状況の追加に失敗しました')
        }
    } else {
        // Delete
        const { error } = await supabase
            .from('availabilities')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .eq('start_time', startTime)
            .eq('end_time', endTime)

        if (error) {
            console.error('Error deleting availability:', error)
            throw new Error('空き状況の削除に失敗しました')
        }
    }

    revalidatePath(`/groups/${groupId}`)
    return { success: true }
}

export async function bulkToggleAvailability(
    groupId: string,
    date: string, // ISO date string (YYYY-MM-DD)
    priority: number | null // null = remove all, 1 = add all as △
) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('認証されていません')
    }

    // Verify membership
    const { data: member, error: memberError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

    if (memberError || !member) {
        throw new Error('グループメンバーではありません')
    }

    const START_HOUR = 5
    const END_HOUR = 29
    const targetDate = new Date(date)

    if (priority === null) {
        // Delete all availabilities for this day
        const startTime = new Date(targetDate)
        startTime.setHours(START_HOUR, 0, 0, 0)
        const endTime = new Date(targetDate)
        endTime.setHours(END_HOUR, 0, 0, 0)

        const { error } = await supabase
            .from('availabilities')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .gte('start_time', startTime.toISOString())
            .lt('start_time', endTime.toISOString())

        if (error) {
            console.error('Error deleting availabilities:', error)
            throw new Error('空き状況の削除に失敗しました')
        }
    } else {
        // Add availabilities for all hours in the day
        const availabilities = []
        for (let hour = START_HOUR; hour < END_HOUR; hour++) {
            const start = new Date(targetDate)
            start.setHours(hour, 0, 0, 0)
            const end = new Date(targetDate)
            end.setHours(hour + 1, 0, 0, 0)

            availabilities.push({
                group_id: groupId,
                user_id: user.id,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                priority,
            })
        }

        // First delete existing ones to avoid conflicts
        const startTime = new Date(targetDate)
        startTime.setHours(START_HOUR, 0, 0, 0)
        const endTime = new Date(targetDate)
        endTime.setHours(END_HOUR, 0, 0, 0)

        await supabase
            .from('availabilities')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .gte('start_time', startTime.toISOString())
            .lt('start_time', endTime.toISOString())

        // Then insert new ones
        const { error } = await supabase
            .from('availabilities')
            .insert(availabilities)

        if (error) {
            console.error('Error inserting availabilities:', error)
            throw new Error('空き状況の追加に失敗しました')
        }
    }

    revalidatePath(`/groups/${groupId}`)
    return { success: true }
}

export async function updateAvailabilities(
    groupId: string,
    mode: 'add' | 'remove',
    slots: { start: string; end: string }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    if (mode === 'remove') {
        const startTimes = slots.map(s => s.start)
        const { error } = await supabase
            .from('availabilities')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .in('start_time', startTimes)
        if (error) throw new Error('Failed to delete availabilities')
    } else {
        const startTimes = slots.map(s => s.start)

        // 1. Delete existing (to prevent duplicates)
        const { error: deleteError } = await supabase
            .from('availabilities')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .in('start_time', startTimes)

        if (deleteError) throw new Error('Failed to cleanup existing availabilities')

        // 2. Insert new
        const rows = slots.map(s => ({
            group_id: groupId,
            user_id: user.id,
            start_time: s.start,
            end_time: s.end,
            priority: 1
        }))
        const { error } = await supabase
            .from('availabilities')
            .insert(rows)

        if (error) throw new Error('Failed to update availabilities')
    }

    revalidatePath(`/groups/${groupId}`)
    return { success: true }
}



export async function fetchCalendarEvents(start: string, end: string) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return { events: [], synced: false, syncedCount: 0, hasToken: false, error: 'セッションが見つかりません' }
    }
    if (!session.provider_token) {
        return { events: [], synced: false, syncedCount: 0, hasToken: false, error: 'Google連携が無効です。再度ログインしてください。' }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { events: [], synced: false, syncedCount: 0, hasToken: false, error: 'ユーザーが見つかりません' }

    try {
        const events = await listEvents(session.provider_token, start, end)

        // 背景で忙しい時間帯を同期する
        const busySlots = events.map(event => {
            const s = new Date(event.start.dateTime || event.start.date || '')
            const e = new Date(event.end.dateTime || event.end.date || '')

            return {
                user_id: user.id,
                start_time: s.toISOString(),
                end_time: e.toISOString()
            }
        }).filter(slot => slot.start_time && slot.end_time)

        let synced = false
        let syncedCount = 0
        if (busySlots.length > 0) {
            console.log(`Syncing ${busySlots.length} busy slots for user ${user.id}`)
            await supabase.from('user_busy_slots').delete().eq('user_id', user.id)
                .gte('start_time', start).lte('start_time', end)

            const { error: upsertError } = await supabase.from('user_busy_slots').upsert(busySlots, { onConflict: 'user_id,start_time' })
            if (upsertError) {
                console.error('Failed to upsert busy slots:', upsertError)
                return { events, synced: false, syncedCount: 0, hasToken: true, error: `保存失敗: ${upsertError.message}` }
            } else {
                console.log('Successfully synced busy slots')
                synced = true
                syncedCount = busySlots.length
            }
        }

        return { events, synced, syncedCount, hasToken: true }
    } catch (error: any) {
        console.error('Failed to fetch calendar events:', error)
        return { events: [], synced: false, syncedCount: 0, hasToken: true, error: `通信エラー: ${error.message || 'Unknown'}` }
    }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function createPracticeEvent(
    groupId: string,
    startTime: string,
    endTime: string
) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('認証されていません')
    }

    // Verify membership
    const { data: member, error: memberError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

    if (memberError || !member) {
        console.error('Membership verification error:', memberError)
        throw new Error('グループメンバーではありません')
    }

    const { error } = await supabase.from('practice_events').insert({
        group_id: groupId,
        start_time: startTime,
        end_time: endTime,
        created_by: user.id,
    })

    if (error) {
        // Ignore duplicate key error (23505) - treat as success
        if (error.code === '23505') {
            console.log('Practice event already exists, skipping creation.')
            return { success: true }
        }

        console.error('Error creating practice event:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
        })
        throw new Error(`練習予定の作成に失敗しました: ${error.message}`)
    }

    revalidatePath(`/groups/${groupId}`)
    return { success: true }
}

export async function deletePracticeEvent(eventId: string, groupId: string) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('認証されていません')
    }

    // Verify membership
    const { data: member, error: memberError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

    if (memberError || !member) {
        console.error('Membership verification error:', memberError)
        throw new Error('グループメンバーではありません')
    }

    const { error } = await supabase
        .from('practice_events')
        .delete()
        .eq('id', eventId)
        .eq('group_id', groupId)

    if (error) {
        console.error('Error deleting practice event:', error)
        throw new Error(`練習予定の削除に失敗しました: ${error.message}`)
    }

    revalidatePath(`/groups/${groupId}`)
    return { success: true }
}

export async function leaveGroup(groupId: string) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    // 1. Check member count BEFORE leaving
    const { count, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)

    if (countError) {
        throw new Error('Failed to check member count')
    }

    if (count === 1) {
        // Only this user is left, delete the group (cascading will delete the member)
        console.log(`Auto-cleaning group ${groupId} as it was the last member.`)
        const { error: groupDeleteError } = await supabase
            .from('groups')
            .delete()
            .eq('id', groupId)

        if (groupDeleteError) {
            throw new Error('Failed to delete empty group')
        }
    } else {
        // Other members exist, just leave the group
        const { error: leaveError } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id)

        if (leaveError) {
            throw new Error('Failed to leave group')
        }
    }

    revalidatePath('/')
    redirect('/')
}

export async function deleteGroup(groupId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('認証されていません')
    }

    // Verify ownership
    const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single()

    if (groupError || !group) {
        throw new Error('グループが見つかりません')
    }

    if (group.created_by !== user.id) {
        throw new Error('削除権限がありません')
    }

    const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)

    if (deleteError) {
        console.error('Error deleting group:', deleteError)
        throw new Error('グループの削除に失敗しました')
    }

    revalidatePath('/')
    return { success: true }
}

export async function updatePracticeEvents(
    groupId: string,
    mode: 'add' | 'remove',
    slots: { start: string; end: string }[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Verify admin role (only admins can manage practice schedule)
    const { data: member, error: memberError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

    if (memberError || !member || member.role !== 'admin') {
        throw new Error('管理者権限が必要です')
    }

    let successCount = 0;
    const errors: any[] = [];

    if (mode === 'remove') {
        // Try deleting individually directly
        await Promise.all(slots.map(async (slot) => {
            const { error } = await supabase
                .from('practice_events')
                .delete()
                .eq('group_id', groupId)
                .eq('start_time', slot.start)

            if (error) {
                console.error(`Failed to delete event at ${slot.start}:`, error)
                errors.push({ slot: slot.start, error })
            } else {
                successCount++;
            }
        }))
    } else {
        // Try inserting individually
        await Promise.all(slots.map(async (slot) => {
            const { error } = await supabase
                .from('practice_events')
                .insert({
                    group_id: groupId,
                    start_time: slot.start,
                    end_time: slot.end,
                    created_by: user.id
                })

            if (error) {
                // Ignore duplicate key error (23505)
                if (error.code === '23505') {
                    successCount++; // Treat as success
                    return;
                }
                console.error(`Failed to insert event at ${slot.start}:`, error)
                errors.push({ slot: slot.start, error })
            } else {
                successCount++;
            }
        }))
    }

    console.log(`Update practice events result: ${successCount} successes, ${errors.length} errors`)

    revalidatePath(`/groups/${groupId}`)
    return { success: errors.length === 0, count: successCount, errors }
}

export async function deleteCleanupEvent(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('practice_events').delete().eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/cleanup')
}
