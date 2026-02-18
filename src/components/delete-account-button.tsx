'use client'

import { useTransition } from 'react'
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
import { Trash2 } from 'lucide-react'
import { deleteAccount } from '@/app/actions'
import { toast } from 'sonner'

export function DeleteAccountButton() {
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        startTransition(async () => {
            try {
                await deleteAccount()
            } catch (error: any) {
                toast.error(error.message || 'アカウントの削除に失敗しました')
            }
        })
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={isPending}
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    アカウントを削除する
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>本当にアカウントを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                        <span className="block">この操作は取り消せません。以下のデータがすべて削除されます：</span>
                        <span className="block text-red-600 font-medium">
                            ・プロフィール情報<br />
                            ・すべてのグループからの退会<br />
                            ・入力済みの予定データ
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isPending ? '削除中...' : '削除する'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
