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
            <div className="flex flex-wrap items-center gap-3 mr-auto">
                {members.map((member) => (
                    <div key={member.user_id} className="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-3 py-1">
                        <Avatar className="h-7 w-7 rounded-full ring-1 ring-white">
                            <AvatarImage src={member.users?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">{member.users?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
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
