'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { joinGroup } from '@/app/actions'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users } from 'lucide-react'

export function JoinGroupDialog() {
    const [open, setOpen] = useState(false)

    async function clientAction(formData: FormData) {
        try {
            await joinGroup(formData)
            toast.success('グループに参加しました')
            setOpen(false)
        } catch (error) {
            if (error instanceof Error) {
                toast.error(error.message)
            } else {
                toast.error('グループ参加に失敗しました')
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Users className="mr-2 h-4 w-4" />
                    グループに参加
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>グループに参加</DialogTitle>
                    <DialogDescription>
                        招待コードを入力してグループに参加します。
                    </DialogDescription>
                </DialogHeader>
                <form action={clientAction}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="code" className="text-right">
                                招待コード
                            </Label>
                            <Input id="code" name="code" className="col-span-3" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">参加</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
