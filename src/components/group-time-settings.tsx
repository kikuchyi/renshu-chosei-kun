'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Settings2 } from 'lucide-react'
import { updateGroupTimeRange } from '@/app/actions'
import { toast } from 'sonner'

interface GroupTimeSettingsProps {
    groupId: string
    initialStartHour: number
    initialEndHour: number
}

export function GroupTimeSettings({
    groupId,
    initialStartHour,
    initialEndHour,
}: GroupTimeSettingsProps) {
    const [open, setOpen] = useState(false)
    const [startHour, setStartHour] = useState(initialStartHour.toString())
    const [endHour, setEndHour] = useState(initialEndHour.toString())
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleSave = () => {
        const start = parseInt(startHour)
        const end = parseInt(endHour)

        if (start >= end) {
            toast.error('終了時間は開始時間より後に設定してください')
            return
        }

        startTransition(async () => {
            try {
                await updateGroupTimeRange(groupId, start, end)
                toast.success('表示時間帯を更新しました')
                setOpen(false)
                router.refresh()
            } catch (error: any) {
                toast.error(error.message || '更新に失敗しました')
            }
        })
    }

    const hours = Array.from({ length: 49 }, (_, i) => i)

    const formatHour = (h: number) => {
        if (h < 24) return `${h}:00`
        return `翌${h - 24}:00`
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings2 className="mr-2 h-4 w-4" />
                    表示時間帯の設定
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>表示時間帯の設定</DialogTitle>
                    <DialogDescription>
                        予定入力画面とヒートマップに表示する時間帯を設定します。
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="start" className="text-right">
                            開始時間
                        </Label>
                        <Select value={startHour} onValueChange={setStartHour}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="開始時間を選択" />
                            </SelectTrigger>
                            <SelectContent>
                                {hours.slice(0, 24).map((h) => (
                                    <SelectItem key={h} value={h.toString()}>
                                        {formatHour(h)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="end" className="text-right">
                            終了時間
                        </Label>
                        <Select value={endHour} onValueChange={setEndHour}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="終了時間を選択" />
                            </SelectTrigger>
                            <SelectContent>
                                {hours.slice(parseInt(startHour) + 1).map((h) => (
                                    <SelectItem key={h} value={h.toString()}>
                                        {formatHour(h)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? '保存中...' : '設定を保存'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
