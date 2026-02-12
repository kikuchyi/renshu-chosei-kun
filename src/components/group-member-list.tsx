'use client'

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { leaveGroup } from "@/app/actions"
import { useTransition } from "react"
import { toast } from "sonner"
import type { Database } from "@/types/supabase"

type Member = Database['public']['Tables']['group_members']['Row'] & {
    users: Database['public']['Tables']['users']['Row']
}

interface GroupMemberListProps {
    groupId: string
    currentUserId: string
    members: Member[]
}

export function GroupMemberList({ groupId, currentUserId, members }: GroupMemberListProps) {
    const [isPending, startTransition] = useTransition()

    const handleLeave = () => {
        startTransition(async () => {
            try {
                await leaveGroup(groupId)
                toast.success("グループから退会しました")
            } catch (error) {
                console.error("Failed to leave group:", error)
                toast.error("退会に失敗しました")
            }
        })
    }

    return (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow mb-6">
            <h2 className="text-lg font-bold mr-4">メンバー:</h2>
            <div className="flex -space-x-2 overflow-hidden mr-auto">
                {members.map((member) => (
                    <div key={member.user_id} className="relative group">
                        <Avatar className="inline-block h-10 w-10 rounded-full ring-2 ring-white cursor-help">
                            <AvatarImage src={member.users?.avatar_url || ''} />
                            <AvatarFallback>{member.users?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none mb-1">
                            {member.users?.display_name || '不明なユーザー'}
                        </span>
                    </div>
                ))}
            </div>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isPending}>
                        グループを抜ける
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>本当にこのグループを抜けますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                            この操作は取り消せません。再度参加するには招待コードが必要です。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLeave} disabled={isPending} className="bg-red-600 hover:bg-red-700">
                            退会する
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
