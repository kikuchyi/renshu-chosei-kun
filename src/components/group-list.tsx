'use client'

import React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Trash2 } from 'lucide-react'
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
            <div className="text-center p-8 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900">グループがまだありません</h3>
                <p className="text-gray-500 mt-1">グループを作成するか、既存のグループに参加してください。</p>
            </div>
        )
    }

    const copyToClipboard = (text: string) => {
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
                <Card key={group.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            <Link href={`/groups/${group.id}`} className="hover:underline">
                                {group.name}
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <span>Code: {group.invite_code}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => copyToClipboard(group.invite_code)}
                                >
                                    <Copy className="h-3 w-3" />
                                    <span className="sr-only">Copy invite code</span>
                                </Button>
                            </div>

                            {group.created_by === currentUserId && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-400 hover:text-red-500 transition-colors"
                                            disabled={isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete group</span>
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
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
