'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteAllPracticeEvents } from '@/app/actions'
import type { Database } from '@/types/supabase'
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

type PracticeEvent = Database['public']['Tables']['practice_events']['Row']

interface ScheduleListProps {
    practiceEvents: PracticeEvent[]
    groupId: string
}

export function ScheduleList({ practiceEvents, groupId }: ScheduleListProps) {
    const [copied, setCopied] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Helper to merge continuous events for display
    const mergeContinuousEvents = (events: PracticeEvent[]) => {
        if (events.length === 0) return []

        // Sort by start time
        const sorted = [...events].sort((a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )

        const merged: { start: Date; end: Date }[] = []
        if (sorted.length === 0) return merged

        let currentStart = new Date(sorted[0].start_time)
        let currentEnd = new Date(sorted[0].end_time)

        for (let i = 1; i < sorted.length; i++) {
            const nextStart = new Date(sorted[i].start_time)
            const nextEnd = new Date(sorted[i].end_time)

            // If current end time equals next start time (with small tollerance or exact)
            if (currentEnd.getTime() === nextStart.getTime()) {
                currentEnd = nextEnd
            } else {
                merged.push({ start: currentStart, end: currentEnd })
                currentStart = nextStart
                currentEnd = nextEnd
            }
        }
        merged.push({ start: currentStart, end: currentEnd })
        return merged
    }

    const mergedEvents = mergeContinuousEvents(practiceEvents)

    const formatEventText = (event: { start: Date; end: Date }) => {
        const dateStr = format(event.start, 'M/d(E)', { locale: ja })
        const timeStr = `${format(event.start, 'HH:mm')}～${format(event.end, 'HH:mm')}`
        return `${dateStr} ${timeStr}`
    }

    const copyToClipboard = () => {
        const text = mergedEvents.map(formatEventText).join('\n')
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            toast.success('スケジュールをコピーしました')
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const handleDeleteAll = () => {
        startTransition(async () => {
            try {
                await deleteAllPracticeEvents(groupId)
                toast.success('全てのスケジュールを取り消しました')
            } catch (error: any) {
                toast.error(error.message || '削除に失敗しました')
            }
        })
    }

    if (mergedEvents.length === 0) return null

    return (
        <Card className="w-full max-w-5xl mx-auto mt-8 shadow-sm border-dashed">
            <CardHeader className="py-4 space-y-3">
                <CardTitle className="text-lg font-bold text-gray-700">決定スケジュール一覧</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        {copied ? 'コピー完了' : '一括コピー'}
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={isPending}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                一括取り消し
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>全てのスケジュールを取り消しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                    決定済みの{mergedEvents.length}件のスケジュールを全て取り消します。この操作は取り消せません。
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteAll}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    {isPending ? '削除中...' : '全て取り消す'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            <CardContent>
                <div className="bg-slate-50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap border text-gray-700">
                    {mergedEvents.map((event, i) => (
                        <div key={i} className="mb-1 last:mb-0">
                            {formatEventText(event)}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
