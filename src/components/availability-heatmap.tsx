'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ScheduleList } from './schedule-list'
import {
    Card,
    CardContent,
    CardHeader, CardTitle, CardDescription
} from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/supabase'
import { fetchCalendarEvents, createPracticeEvent, deletePracticeEvent, updatePracticeEvents } from '@/app/actions'
import type { CalendarEvent } from '@/utils/google-calendar'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type Availability = Database['public']['Tables']['availabilities']['Row'] & {
    users?: { display_name: string | null } // Joined user data if needed
}

type PracticeEvent = Database['public']['Tables']['practice_events']['Row']
type BusySlot = Database['public']['Tables']['user_busy_slots']['Row']

interface AvailabilityHeatmapProps {
    availabilities: Availability[]
    totalMembers: number // To calculate intensity
    groupId: string
    practiceEvents: PracticeEvent[]
    busySlots: BusySlot[]
}

const START_HOUR = 5
const END_HOUR = 29

export function AvailabilityHeatmap({
    availabilities,
    totalMembers,
    groupId,
    practiceEvents,
    busySlots,
}: AvailabilityHeatmapProps) {
    const router = useRouter()
    console.log('AvailabilityHeatmap Rendered - v1.5.2 - busySlots count:', busySlots.length)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
    const [syncStatus, setSyncStatus] = useState<{
        loading: boolean;
        synced: boolean;
        count: number;
        hasToken: boolean;
        error?: string;
    }>({ loading: true, synced: false, count: 0, hasToken: true })
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set()) // keep this for whatever uses it? actually it seems unused in provided view.
    const [isPending, startTransition] = useTransition()

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false)
    const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
    const [selectedDragSlotIds, setSelectedDragSlotIds] = useState<Set<string>>(new Set())

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i))
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)


    // Monthly view calculations
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const firstDayOfMonth = startOfWeek(monthStart, { weekStartsOn: 1 })
    const lastDayOfMonth = addDays(firstDayOfMonth, 41) // 6 weeks max
    const calendarDays = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth })

    const handlePrevWeek = () => setCurrentDate(prev => subWeeks(prev, 1))
    const handleNextWeek = () => setCurrentDate(prev => addWeeks(prev, 1))
    const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1))
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1))
    const handleToday = () => setCurrentDate(new Date())

    // Fetch calendar events for current week and sync to DB
    const fetchEvents = async () => {
        setSyncStatus(prev => ({ ...prev, loading: true }))
        try {
            const start = weekDays[0].toISOString()
            const end = addDays(weekDays[6], 2).toISOString()
            const result: any = await fetchCalendarEvents(start, end)

            setCalendarEvents(result.events || [])
            setSyncStatus({
                loading: false,
                synced: result.synced || false,
                count: result.syncedCount || 0,
                hasToken: result.hasToken ?? true,
                error: result.error
            })

            if (result.synced) {
                router.refresh()
            }
        } catch (error: any) {
            console.error('Failed to fetch calendar events:', error)
            setSyncStatus({
                loading: false,
                synced: false,
                count: 0,
                hasToken: true,
                error: '通信エラーが発生しました'
            })
        }
    }

    useEffect(() => {
        fetchEvents()
    }, [currentDate])

    const getScore = (date: Date, hour: number) => {
        const start = new Date(date)
        start.setHours(hour, 0, 0, 0)

        const score = availabilities
            .filter(a => new Date(a.start_time).getTime() === start.getTime())
            .reduce((sum, a) => sum + (a.priority || 0), 0)
        return score
    }

    const isBusy = (date: Date, hour: number) => {
        const slotStart = new Date(date)
        slotStart.setHours(hour, 0, 0, 0)
        const slotEnd = new Date(date)
        slotEnd.setHours(hour + 1, 0, 0, 0)

        // Check internal busy slots (all members)
        const hasBusySlot = busySlots.some(slot => {
            const start = new Date(slot.start_time)
            const end = new Date(slot.end_time)
            return start < slotEnd && end > slotStart
        })

        if (hasBusySlot) return true

        // Check current user's Google Calendar events (already fetched for week)
        return calendarEvents.some(event => {
            const eventStart = new Date(event.start.dateTime || event.start.date || '')
            const eventEnd = new Date(event.end.dateTime || event.end.date || '')

            if (eventEnd.getTime() <= slotStart.getTime()) return false
            if (eventStart.getTime() >= slotEnd.getTime()) return false

            return true
        })
    }

    const getIntensityClass = (score: number, busy: boolean) => {
        // If anyone is busy, show gray
        if (busy) return "bg-gray-300 border-gray-400 text-gray-700 opacity-80"

        // If no score, show white
        if (score === 0) return "bg-white border-gray-200"

        // Yellow gradient based on score (priority sum)
        if (score >= 5) return "bg-yellow-500 border-yellow-600 text-white shadow-sm"
        if (score >= 4) return "bg-yellow-400 border-yellow-500 text-yellow-900"
        if (score >= 3) return "bg-yellow-300 border-yellow-400 text-yellow-900"
        if (score >= 2) return "bg-yellow-200 border-yellow-300 text-yellow-900"
        return "bg-yellow-100 border-yellow-200 text-yellow-800"
    }

    // Get total score for a day (for monthly view)
    const getDayScore = (date: Date) => {
        let totalScore = 0
        for (let hour = START_HOUR; hour < END_HOUR; hour++) {
            totalScore += getScore(date, hour)
        }
        return totalScore
    }

    const getDayIntensityClass = (score: number) => {
        if (score === 0) return "bg-white border-gray-200 text-gray-500"
        if (score >= 20) return "bg-yellow-500 border-yellow-600 text-white"
        if (score >= 15) return "bg-yellow-400 border-yellow-500 text-yellow-900"
        if (score >= 10) return "bg-yellow-300 border-yellow-400 text-yellow-900"
        if (score >= 5) return "bg-yellow-200 border-yellow-300 text-yellow-900"
        return "bg-yellow-100 border-yellow-200 text-yellow-800"
    }

    // Map of confirmed practice slots for O(1) lookup
    // Key: Timestamp of the start time, Value: eventId
    const confirmedSlots = React.useMemo(() => {
        const map = new Map<number, string>()
        practiceEvents.forEach(event => {
            const date = new Date(event.start_time)
            map.set(date.getTime(), event.id)
        })
        return map
    }, [practiceEvents])

    const getPracticeEventId = (day: Date, hour: number) => {
        const start = new Date(day)
        start.setHours(hour, 0, 0, 0)
        return confirmedSlots.get(start.getTime())
    }

    const handleDragStart = (day: Date, hour: number) => {
        if (viewMode !== 'week') return

        setIsDragging(true)
        const practiceId = getPracticeEventId(day, hour)
        const mode = practiceId ? 'remove' : 'add'
        setDragMode(mode)

        const slotId = `${day.toISOString()}-${hour}`
        setSelectedDragSlotIds(new Set([slotId]))
    }

    const handleDragEnter = (day: Date, hour: number) => {
        if (!isDragging || viewMode !== 'week') return

        const slotId = `${day.toISOString()}-${hour}`
        setSelectedDragSlotIds(prev => {
            const newSet = new Set(prev)
            newSet.add(slotId)
            return newSet
        })
    }

    const handleDragEnd = () => {
        if (!isDragging || !dragMode || selectedDragSlotIds.size === 0) {
            setIsDragging(false)
            setDragMode(null)
            setSelectedDragSlotIds(new Set())
            return
        }

        const slots = Array.from(selectedDragSlotIds).map(id => {
            const lastDashIndex = id.lastIndexOf('-')
            const dateStr = id.substring(0, lastDashIndex)
            const hourStr = id.substring(lastDashIndex + 1)
            const date = new Date(dateStr)
            const hour = parseInt(hourStr)

            const start = new Date(date)
            start.setHours(hour, 0, 0, 0)
            const end = new Date(date)
            end.setHours(hour + 1, 0, 0, 0)

            return {
                start: start.toISOString(),
                end: end.toISOString()
            }
        })

        startTransition(async () => {
            try {
                const result = await updatePracticeEvents(groupId, dragMode, slots)
                if (!result.success) {
                    console.error('Update failed:', result.errors)
                    const firstError = result.errors[0]?.error
                    const errorMessage = firstError?.message || '不明なエラー'
                    const errorCode = firstError?.code || 'unknown'
                    toast.error(`更新失敗: ${errorMessage} (${errorCode})`)
                } else {
                    toast.success('更新しました')
                }
            } catch (error) {
                console.error('Update operation failed:', error)
                toast.error('更新に失敗しました')
            }
        })

        setIsDragging(false)
        setDragMode(null)
        setSelectedDragSlotIds(new Set())
    }

    // Effect to handle global mouse up
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                handleDragEnd()
            }
        }
        window.addEventListener('mouseup', handleGlobalMouseUp)
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }, [isDragging, dragMode, selectedDragSlotIds])


    // Get practice events for a specific day
    const getPracticeEventsForDay = (date: Date) => {
        // Filter events that match the year, month, and day
        return practiceEvents.filter(event => {
            const eventStart = new Date(event.start_time)
            return eventStart.getFullYear() === date.getFullYear() &&
                eventStart.getMonth() === date.getMonth() &&
                eventStart.getDate() === date.getDate()
        }).map(event => ({
            start: new Date(event.start_time),
            end: new Date(event.end_time)
        }))
    }


    // Helper to merge continuous events for display
    const mergeContinuousEvents = (events: { start: Date; end: Date }[]) => {
        if (events.length === 0) return []

        // Sort by start time
        const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())

        const merged: { start: Date; end: Date }[] = []
        let current = sorted[0]

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i]
            if (current.end.getTime() === next.start.getTime()) {
                // Merge continuous events
                current = { ...current, end: next.end }
            } else {
                merged.push(current)
                current = next
            }
        }
        merged.push(current)
        return merged
    }


    // Handle cell click for toggling practice event
    const handleCellClick = (date: Date, hour: number) => {
        const busy = isBusy(date, hour)
        if (busy) return

        startTransition(async () => {
            try {
                const eventId = getPracticeEventId(date, hour)

                if (eventId) {
                    await deletePracticeEvent(eventId, groupId)
                    toast.success('練習予定を取り消しました')
                } else {
                    const start = new Date(date)
                    start.setHours(hour, 0, 0, 0)
                    const end = new Date(start)
                    end.setHours(hour + 1, 0, 0, 0)

                    await createPracticeEvent(
                        groupId,
                        start.toISOString(),
                        end.toISOString()
                    )
                    toast.success('練習予定を決定しました')
                }
                router.refresh()
            } catch (error) {
                console.error('Failed to toggle practice event:', error)
                toast.error('操作に失敗しました')
            }
        })
    }

    // Filter events based on view
    const filteredEvents = React.useMemo(() => {
        if (viewMode === 'week') {
            const start = weekDays[0]
            const end = addDays(weekDays[6], 1)
            return practiceEvents.filter(e => {
                const eStart = new Date(e.start_time)
                return eStart >= start && eStart < end
            })
        } else {
            const start = calendarDays[0]
            const end = addDays(calendarDays[calendarDays.length - 1], 1)
            return practiceEvents.filter(e => {
                const eStart = new Date(e.start_time)
                return eStart >= start && eStart < end
            })
        }
    }, [viewMode, practiceEvents, weekDays, calendarDays])

    return (
        <div className="space-y-6">
            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold">
                            {viewMode === 'week' ? '練習日の決定' : '月間カレンダー'}
                        </CardTitle>
                        <CardDescription>
                            {viewMode === 'week'
                                ? 'クリックして練習可能な時間帯を決定/解除してください。'
                                : '決定済みの練習予定が表示されます。'
                            }
                        </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="bg-slate-100 p-1 rounded-lg flex text-sm">
                            <button
                                onClick={() => setViewMode('week')}
                                className={cn(
                                    "px-3 py-1.5 rounded-md transition-all",
                                    viewMode === 'week' ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                週間
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={cn(
                                    "px-3 py-1.5 rounded-md transition-all",
                                    viewMode === 'month' ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                月間
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-white border border-gray-200 rounded-sm"></div>
                            <span>調整中</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-yellow-300 border border-yellow-400 rounded-sm"></div>
                            <span>候補（濃いほど高評価）</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-green-500 border border-green-600 rounded-sm"></div>
                            <span>練習決定</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-gray-300 border border-gray-400 rounded-sm"></div>
                            <span>他メンバーの予定あり</span>
                        </div>

                        <div className="ml-auto flex items-center gap-3">
                            {syncStatus.loading ? (
                                <div className="text-[10px] text-gray-400 animate-pulse">同期中...</div>
                            ) : syncStatus.error ? (
                                <div className="text-[10px] text-red-500 font-medium">{syncStatus.error}</div>
                            ) : !syncStatus.hasToken ? (
                                <div className="text-[10px] text-amber-600 font-medium">Google連携未完了</div>
                            ) : (
                                <div className="flex flex-col items-end gap-0.5">
                                    <div className="text-[10px] font-medium text-blue-600">
                                        同期済み: {busySlots.length}件
                                        {busySlots.length > 0 && ` (対象:${new Set(busySlots.map(s => s.user_id)).size}名)`}
                                    </div>
                                    <div className="text-[9px] text-gray-300 mt-0.5">v1.5.2</div>
                                    <button
                                        onClick={() => fetchEvents()}
                                        className="text-[9px] text-gray-400 hover:text-blue-600 underline"
                                    >
                                        今すぐ同期
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Controls */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                            <Button variant="outline" size="icon" onClick={viewMode === 'week' ? handlePrevWeek : handlePrevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h3 className="text-lg font-semibold min-w-[200px] text-center">
                                {viewMode === 'week'
                                    ? `${format(weekDays[0], 'M月d日', { locale: ja })} - ${format(weekDays[6], 'd日', { locale: ja })}`
                                    : format(currentDate, 'yyyy年 M月', { locale: ja })
                                }
                            </h3>
                            <Button variant="outline" size="icon" onClick={viewMode === 'week' ? handleNextWeek : handleNextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            {viewMode === 'week' && (
                                <Button variant="outline" onClick={handleToday} className="ml-2">
                                    今日
                                </Button>
                            )}
                        </div>

                        {viewMode === 'week' && (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                                        <span>決定</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-gray-100 rounded mr-1"></div>
                                        <span>予定</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {viewMode === 'week' ? (
                        <div className="w-full overflow-x-auto pb-4">
                            <div className="min-w-[600px]">
                                {/* Header Row */}
                                <div className="grid grid-cols-8 gap-1 mb-2">
                                    <div className="p-2 text-center text-gray-500 text-xs font-medium pt-8">
                                        時間
                                    </div>
                                    {weekDays.map((day, i) => (
                                        <div key={i} className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
                                            <div className="text-xs text-gray-500 font-medium mb-1">
                                                {format(day, 'E', { locale: ja })}
                                            </div>
                                            <div className={cn(
                                                "text-lg font-bold rounded-full w-8 h-8 flex items-center justify-center",
                                                isSameDay(day, new Date()) ? "bg-blue-600 text-white shadow-md" : "text-gray-700"
                                            )}>
                                                {format(day, 'd')}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Heatmap Grid */}
                                <div className="space-y-1">
                                    {hours.map((hour) => (
                                        <div key={hour} className="grid grid-cols-8 gap-1">
                                            <div className="p-2 text-right text-xs text-gray-400 font-mono -mt-2.5 pr-4">
                                                {hour}:00
                                            </div>
                                            {weekDays.map((day, dayIndex) => {
                                                const score = getScore(day, hour)
                                                const busy = isBusy(day, hour)
                                                const intensityClass = getIntensityClass(score, busy)
                                                const practiceId = getPracticeEventId(day, hour)
                                                const isPractice = !!practiceId

                                                return (
                                                    <div
                                                        key={dayIndex}
                                                        onMouseDown={() => handleDragStart(day, hour)}
                                                        onMouseEnter={() => handleDragEnter(day, hour)}
                                                        onClick={() => !isDragging && handleCellClick(day, hour)}
                                                        className={cn(
                                                            "h-10 rounded-md transition-all duration-200 cursor-pointer border relative group select-none flex items-center justify-center",
                                                            intensityClass,
                                                            (isPractice && !(isDragging && dragMode === 'remove' && selectedDragSlotIds.has(`${day.toISOString()}-${hour}`))) && "bg-green-500 border-green-600 cursor-pointer hover:bg-green-600 z-10",
                                                            (isDragging && dragMode === 'add' && selectedDragSlotIds.has(`${day.toISOString()}-${hour}`)) && "bg-green-500 border-green-600"
                                                        )}
                                                        title={
                                                            isPractice ? "決定済みの練習予定 (クリックで解除)" :
                                                                busy ? "予定あり" :
                                                                    `${format(day, 'M/d')} ${hour}:00 - スコア: ${score}`
                                                        }
                                                    >
                                                        {isPractice && (
                                                            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                                                                決定
                                                            </div>
                                                        )}
                                                        {busy && !isPractice && (
                                                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px] font-medium">
                                                                予定
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Monthly View */
                        <div className="w-full">
                            <div className="w-full min-w-[350px]">
                                {/* Calendar Header */}
                                <div className="grid grid-cols-7 gap-px mb-2">
                                    {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
                                        <div key={i} className="text-center py-2 text-sm font-bold text-gray-500">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-2">
                                    {calendarDays.map((day, i) => {
                                        const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                                        const isToday = isSameDay(day, new Date())
                                        const dayScore = getDayScore(day)
                                        const intensityClass = isCurrentMonth ? getDayIntensityClass(dayScore) : "bg-gray-50"
                                        const dayPracticeEvents = getPracticeEventsForDay(day)
                                        const mergedEvents = mergeContinuousEvents(dayPracticeEvents)

                                        return (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "min-h-[100px] p-2 rounded-lg border flex flex-col transition-colors",
                                                    intensityClass,
                                                    !isCurrentMonth && "opacity-50",
                                                    isToday && "ring-2 ring-blue-500"
                                                )}
                                                title={`${format(day, 'M月d日', { locale: ja })}: スコア ${dayScore}`}
                                            >
                                                <div className="text-xs font-medium mb-1">
                                                    {format(day, 'd')}
                                                </div>
                                                {mergedEvents.length > 0 && (
                                                    <div className="space-y-1 flex-1">
                                                        {mergedEvents.map((event, i) => (
                                                            <div
                                                                key={i}
                                                                className="bg-green-500 text-white text-xs px-1 py-0.5 rounded font-medium"
                                                            >
                                                                {format(event.start, 'HH:mm')}-{format(event.end, 'HH:mm')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {mergedEvents.length === 0 && dayScore > 0 && (
                                                    <div className="text-center flex-1 flex items-center justify-center">
                                                        <span className="text-sm font-bold">{dayScore}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <ScheduleList practiceEvents={filteredEvents} />
        </div>
    )
}
