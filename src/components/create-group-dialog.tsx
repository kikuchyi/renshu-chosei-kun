'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createGroup } from '@/app/actions'
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
import { Plus } from 'lucide-react'

export function CreateGroupDialog() {
    const [open, setOpen] = useState(false)

    async function clientAction(formData: FormData) {
        try {
            await createGroup(formData)
            toast.success('グループを作成しました')
            setOpen(false)
        } catch (error) {
            if (error instanceof Error) {
                toast.error(error.message)
            } else {
                toast.error('グループ作成に失敗しました')
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    グループ作成
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>グループ作成</DialogTitle>
                    <DialogDescription>
                        新しいグループを作成して、バンド活動を始めましょう。
                    </DialogDescription>
                </DialogHeader>
                <form action={clientAction}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                グループ名
                            </Label>
                            <Input id="name" name="name" className="col-span-3" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">作成</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
