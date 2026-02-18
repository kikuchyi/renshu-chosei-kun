'use client'

import React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import { Copy, Trash2, ChevronRight, Users } from 'lucide-react'
import type { Database } from '@/types/supabase'
import { deleteGroup } from '@/app/actions'
import { useTransition } from 'react'
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

type Group = Database['public']['Tables']['groups']['Row']

export function GroupList({
    groups,
    currentUserId
}: {
    groups: Group[],
    currentUserId: string
}) {
    const [isPending, startTransition] = useTransition()

    if (groups.length === 0) {
        return (
            <div className="text-center py-16 px-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">グループがまだありません</h3>
                <p className="text-sm text-gray-500">グループを作成するか、既存のグループに参加してください。</p>
            </div>
        )
    }

    const copyToClipboard = (e: React.MouseEvent, text: string) => {
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        toast.success('招待コードをコピーしました')
    }

    const handleDelete = (groupId: string) => {
        startTransition(async () => {
            try {
                const result = await deleteGroup(groupId)
                if (result.success) {
                    toast.success('グループを削除しました')
                }
            } catch (error: any) {
                toast.error(error.message || '削除に失敗しました')
            }
        })
    }

    return (
        <div className="space-y-3">
            {groups.map((group) => (
                <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm active:bg-gray-50 transition-all"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                                {group.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-gray-400 font-mono truncate max-w-[180px]">
                                    {group.invite_code.slice(0, 8)}…
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-gray-400 hover:text-gray-600"
                                    onClick={(e) => copyToClipboard(e, group.invite_code)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            {group.created_by === currentUserId && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-300 hover:text-red-500 transition-colors"
                                            disabled={isPending}
                                            onClick={(e) => e.preventDefault()}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>本当にこのグループを削除しますか？</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                グループ「{group.name}」を完全に削除します。この操作は取り消せません。
                                                紐づいている予定データもすべて削除されます。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleDelete(group.id)}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                削除する
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <ChevronRight className="h-5 w-5 text-gray-300" />
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    )
}
