'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Database } from '@/types/supabase'

type PracticeEvent = Database['public']['Tables']['practice_events']['Row']

interface ScheduleListProps {
    practiceEvents: PracticeEvent[]
}

export function ScheduleList({ practiceEvents }: ScheduleListProps) {
    const [copied, setCopied] = useState(false)

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

    if (mergedEvents.length === 0) return null

    return (
        <Card className="w-full max-w-5xl mx-auto mt-8 shadow-sm border-dashed">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg font-bold text-gray-700">決定スケジュール一覧</CardTitle>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'コピー完了' : '一括コピー'}
                </Button>
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
