'use client'

import React, { useState, useEffect, useTransition, useOptimistic, useRef } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ScheduleList } from './schedule-list'
import {
    Card,
    CardContent,
    CardHeader, CardTitle, CardDescription
} from '@/components/ui/card'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
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
    groupId: string
    availabilities: Availability[]
    practiceEvents: (Database['public']['Tables']['practice_events']['Row'])[]
    busySlots: Database['public']['Tables']['user_busy_slots']['Row'][]
    calendarEvents: any[]
    startHour: number
    endHour: number
    currentDate: Date
    onDateChange: (date: Date | ((prev: Date) => Date)) => void
}

const INTENSITY_LEVELS = 5

export function AvailabilityHeatmap({
    groupId,
    availabilities,
    practiceEvents,
    busySlots,
    calendarEvents,
    startHour,
    endHour,
    currentDate,
    onDateChange,
}: AvailabilityHeatmapProps) {
    const router = useRouter()
    console.log('AvailabilityHeatmap Rendered - v1.5.3 - busySlots count:', busySlots.length)
    // const [currentDate, setCurrentDate] = useState(new Date()) // Lifted to GroupScheduleManager
    const [localCalendarEvents, setLocalCalendarEvents] = useState<CalendarEvent[]>([])
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

    // Optimistic UI
    const [optimisticPracticeEvents, addOptimisticPracticeEvent] = useOptimistic(
        practiceEvents,
        (state: PracticeEvent[], action: {
            type: 'add' | 'remove',
            slots?: { start: string, end: string }[],
            id?: string
        }) => {
            switch (action.type) {
                case 'add': {
                    const newSlots = action.slots || [];
                    const newEvents = newSlots.map(slot => ({
                        id: 'opt-' + Math.random(),
                        group_id: groupId,
                        start_time: slot.start,
                        end_time: slot.end,
                        created_at: new Date().toISOString(),
                        created_by: 'optimistic'
                    } as unknown as PracticeEvent));
                    return [...state, ...newEvents];
                }
                case 'remove': {
                    if (action.id) {
                        return state.filter(e => e.id !== action.id);
                    }
                    if (action.slots) {
                        const slotsToRemove = new Set(action.slots.map(s => new Date(s.start).getTime()));
                        return state.filter(e => !slotsToRemove.has(new Date(e.start_time).getTime()));
                    }
                    return state;
                }
            }
            return state;
        }
    );

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false)
    const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
    const [selectedDragSlotIds, setSelectedDragSlotIds] = useState<Set<string>>(new Set())

    // Long press refs
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const startPosRef = useRef<{ x: number, y: number } | null>(null)
    // Grid container ref for native touch event handling
    const gridRef = useRef<HTMLDivElement>(null)

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i))
    const timeSlots = Array.from({ length: (endHour - startHour) * 2 }, (_, i) => {
        const totalMinutes = i * 30
        const hour = startHour + Math.floor(totalMinutes / 60)
        const minute = totalMinutes % 60
        return { hour, minute }
    })


    // Monthly view calculations
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    // const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }) // Unused
    const firstDayOfMonth = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
    const lastDayOfMonth = addDays(firstDayOfMonth, 41) // 6 weeks max
    const calendarDays = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth })

    const handlePrevWeek = () => onDateChange(prev => subWeeks(prev, 1))
    const handleNextWeek = () => onDateChange(prev => addWeeks(prev, 1))
    const handlePrevMonth = () => onDateChange(prev => subMonths(prev, 1))
    const handleNextMonth = () => onDateChange(prev => addMonths(prev, 1))
    const handleToday = () => onDateChange(new Date())

    // Fetch calendar events for current week and sync to DB
    const fetchEvents = async () => {
        setSyncStatus(prev => ({ ...prev, loading: true }))
        try {
            const start = weekDays[0].toISOString()
            const end = addDays(weekDays[6], 2).toISOString()
            const result: any = await fetchCalendarEvents(start, end)

            setLocalCalendarEvents(result.events || [])
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

    const getScore = (date: Date, hour: number, minute: number) => {
        const start = new Date(date)
        start.setHours(hour, minute, 0, 0)

        const score = availabilities
            .filter(a => new Date(a.start_time).getTime() === start.getTime())
            .reduce((sum, a) => sum + (a.priority || 0), 0)
        return score
    }

    const getTriangleCount = (date: Date, hour: number, minute: number) => {
        const start = new Date(date)
        start.setHours(hour, minute, 0, 0)
        const users = new Set(
            availabilities
                .filter(a => new Date(a.start_time).getTime() === start.getTime() && (a.priority || 0) > 0)
                .map(a => a.user_id)
        )
        return users.size
    }

    const isBusy = (date: Date, hour: number, minute: number) => {
        const slotStart = new Date(date)
        slotStart.setHours(hour, minute, 0, 0)
        const slotEnd = new Date(date)
        if (minute === 0) {
            slotEnd.setHours(hour, 30, 0, 0)
        } else {
            slotEnd.setHours(hour + 1, 0, 0, 0)
        }

        // Check internal busy slots (all members)
        const hasBusySlot = busySlots.some(slot => {
            const start = new Date(slot.start_time)
            const end = new Date(slot.end_time)
            return start < slotEnd && end > slotStart
        })

        if (hasBusySlot) return true

        // Check current user's Google Calendar events (already fetched for week)
        return localCalendarEvents.some(event => { // Fixed to use localCalendarEvents
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
        for (let hour = startHour; hour < endHour; hour++) {
            totalScore += getScore(date, hour, 0)
            totalScore += getScore(date, hour, 30)
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
        optimisticPracticeEvents.forEach(event => {
            const date = new Date(event.start_time)
            map.set(date.getTime(), event.id)
        })
        return map
    }, [optimisticPracticeEvents])

    const getPracticeEventId = (day: Date, hour: number, minute: number) => {
        const start = new Date(day)
        start.setHours(hour, minute, 0, 0)
        return confirmedSlots.get(start.getTime())
    }

    const handleDragStart = (day: Date, hour: number, minute: number) => {
        if (viewMode !== 'week') return

        setIsDragging(true)
        const practiceId = getPracticeEventId(day, hour, minute)
        const mode = practiceId ? 'remove' : 'add'
        setDragMode(mode)

        const slotId = `${day.toISOString()}-${hour}-${minute}`
        setSelectedDragSlotIds(new Set([slotId]))
    }

    const handleDragEnter = (day: Date, hour: number, minute: number) => {
        if (!isDragging || viewMode !== 'week') return

        const slotId = `${day.toISOString()}-${hour}-${minute}`
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
            const parts = id.split('-')
            const minute = parseInt(parts.pop() || '0')
            const hour = parseInt(parts.pop() || '0')
            const dateStr = parts.join('-')
            const date = new Date(dateStr)

            const start = new Date(date)
            start.setHours(hour, minute, 0, 0)
            const end = new Date(date)
            if (minute === 0) {
                end.setHours(hour, 30, 0, 0)
            } else {
                end.setHours(hour + 1, 0, 0, 0)
            }

            return {
                start: start.toISOString(),
                end: end.toISOString()
            }
        })

        startTransition(async () => {
            // Optimistic update
            if (dragMode === 'add') {
                addOptimisticPracticeEvent({
                    type: 'add',
                    slots: slots
                })
            } else {
                addOptimisticPracticeEvent({
                    type: 'remove',
                    slots: slots
                })
            }

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

    // Native non-passive touchmove listener to prevent scrolling during drag
    const isDraggingRef = useRef(isDragging)
    isDraggingRef.current = isDragging
    useEffect(() => {
        const el = gridRef.current
        if (!el) return
        const handler = (e: TouchEvent) => {
            if (isDraggingRef.current) {
                e.preventDefault()
            }
        }
        el.addEventListener('touchmove', handler, { passive: false })
        return () => el.removeEventListener('touchmove', handler)
    }, [])

    // Get practice events for a specific day
    const getPracticeEventsForDay = (date: Date) => {
        // Filter events that match the year, month, and day
        return optimisticPracticeEvents.filter(event => {
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
    const handleCellClick = (date: Date, hour: number, minute: number) => {
        const practiceId = getPracticeEventId(date, hour, minute)
        const busy = isBusy(date, hour, minute)

        // If not a confirmed practice and is busy, prevent adding new practice
        if (!practiceId && busy) return

        startTransition(async () => {
            try {
                const eventId = getPracticeEventId(date, hour, minute)

                if (eventId) {
                    // Optimistic remove
                    addOptimisticPracticeEvent({
                        type: 'remove',
                        id: eventId
                    });

                    await deletePracticeEvent(eventId, groupId)
                    toast.success('練習予定を取り消しました')
                } else {
                    const start = new Date(date)
                    start.setHours(hour, minute, 0, 0)
                    const end = new Date(start)
                    if (minute === 0) {
                        end.setHours(hour, 30, 0, 0)
                    } else {
                        end.setHours(hour + 1, 0, 0, 0)
                    }

                    // Optimistic add
                    addOptimisticPracticeEvent({
                        type: 'add',
                        slots: [{ start: start.toISOString(), end: end.toISOString() }]
                    });

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
            return optimisticPracticeEvents.filter(e => {
                const eStart = new Date(e.start_time)
                return eStart >= start && eStart < end
            })
        } else {
            const start = calendarDays[0]
            const end = addDays(calendarDays[calendarDays.length - 1], 1)
            return optimisticPracticeEvents.filter(e => {
                const eStart = new Date(e.start_time)
                return eStart >= start && eStart < end
            })
        }
    }, [viewMode, optimisticPracticeEvents, weekDays, calendarDays])

    // Touch support
    const handleTouchStart = (e: React.TouchEvent, day: Date, hour: number, minute: number) => {
        if (viewMode !== 'week' || e.touches.length > 1) return

        const touch = e.touches[0]
        startPosRef.current = { x: touch.clientX, y: touch.clientY }

        const target = e.target as HTMLElement
        // Navigate up to find the cell div if needed
        // We ensure we are targeting the cell or its child

        // Start long press timer
        longPressTimerRef.current = setTimeout(() => {
            setIsDragging(true)
            const practiceId = getPracticeEventId(day, hour, minute)
            const mode = practiceId ? 'remove' : 'add'
            setDragMode(mode)

            const slotId = `${day.toISOString()}-${hour}-${minute}`
            setSelectedDragSlotIds(new Set([slotId]))

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 300)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (viewMode !== 'week') return
        const touch = e.touches[0]

        if (!isDragging) {
            // Check if moved enough to cancel long press
            if (startPosRef.current) {
                const dx = Math.abs(touch.clientX - startPosRef.current.x)
                const dy = Math.abs(touch.clientY - startPosRef.current.y)
                if (dx > 5 || dy > 5) {
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                    }
                }
            }
            return
        }

        // Note: scrolling is prevented by native non-passive touchmove listener on gridRef
        // No need for e.preventDefault() here (React synthetic events are passive)

        const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement
        if (!target) return

        const cell = target.closest('[data-date]') as HTMLElement
        if (!cell) return

        const dateStr = cell.getAttribute('data-date')
        const hourStr = cell.getAttribute('data-hour')
        const minuteStr = cell.getAttribute('data-minute')

        if (dateStr && hourStr && minuteStr) {
            const date = new Date(dateStr)
            const hour = parseInt(hourStr)
            const minute = parseInt(minuteStr)

            const slotId = `${date.toISOString()}-${hour}-${minute}`
            setSelectedDragSlotIds(prev => {
                const newSet = new Set(prev)
                newSet.add(slotId)
                return newSet
            })
        }
    }

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
        handleDragEnd()
    }

    return (
        <div className="space-y-6">
            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader className="space-y-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        {/* Title & View Switcher */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4">
                                <CardTitle className="text-2xl font-bold">
                                    {viewMode === 'week' ? '練習日の決定' : '月間カレンダー'}
                                </CardTitle>
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
                            <CardDescription>
                                {viewMode === 'week'
                                    ? 'クリックして練習可能な時間帯を決定/解除してください。'
                                    : '決定済みの練習予定が表示されます。'
                                }
                            </CardDescription>
                        </div>

                        {/* Status Legend & Sync Status */}
                        <div className="flex flex-col gap-2 items-end">
                            <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border max-w-xs">
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 bg-white border border-gray-200 rounded-sm"></div>
                                    <span>調整中</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 bg-yellow-300 border border-yellow-400 rounded-sm"></div>
                                    <span>△</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 bg-green-500 border border-green-600 rounded-sm"></div>
                                    <span>決定</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 bg-gray-300 border border-gray-400 rounded-sm"></div>
                                    <span>他NG</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px]">
                                {syncStatus.loading ? (
                                    <div className="text-gray-400 animate-pulse">同期中...</div>
                                ) : !syncStatus.hasToken ? (
                                    <div className="text-amber-600 font-medium">Google連携未完了</div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <div className="font-medium text-blue-600">
                                            他メン同期済
                                        </div>
                                        <button
                                            onClick={() => fetchEvents()}
                                            className="text-gray-400 hover:text-blue-600 underline"
                                        >
                                            更新
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Date Navigation (Centered) */}
                    <div className="flex items-center justify-center gap-1">
                        {viewMode === 'week' && (
                            <Button variant="outline" size="icon" onClick={handlePrevMonth} title="1ヶ月前">
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="outline" size="icon" onClick={viewMode === 'week' ? handlePrevWeek : handlePrevMonth} title={viewMode === 'week' ? "1週間前" : "1ヶ月前"}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium whitespace-nowrap min-w-[100px] text-center">
                            {viewMode === 'week'
                                ? `${format(startOfCurrentWeek, 'M月d日', { locale: ja })} - ${format(addDays(startOfCurrentWeek, 6), 'M月d日', { locale: ja })}`
                                : format(currentDate, 'yyyy年 M月', { locale: ja })
                            }
                        </span>
                        <Button variant="outline" size="icon" onClick={viewMode === 'week' ? handleNextWeek : handleNextMonth} title={viewMode === 'week' ? "1週間後" : "1ヶ月後"}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        {viewMode === 'week' && (
                            <Button variant="outline" size="icon" onClick={handleNextMonth} title="1ヶ月後">
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        )}
                        {viewMode === 'week' && (
                            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">
                                今日
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {viewMode === 'week' ? (
                        <div className="w-full overflow-x-auto pb-4">
                            <div ref={gridRef} className="min-w-[600px]" style={isDragging ? { touchAction: 'none' } : undefined}>
                                {/* Header Row */}
                                <div className="grid grid-cols-9 gap-1 mb-2">
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
                                    <div className="p-2 text-center text-gray-500 text-xs font-medium pt-8">
                                        時間
                                    </div>
                                </div>
                                {/* Heatmap Grid */}
                                <div className="space-y-px">
                                    {timeSlots.map(({ hour, minute }) => (
                                        <div key={`${hour}-${minute}`} className="grid grid-cols-9 gap-1">
                                            <div className="p-1 text-right text-[10px] text-gray-400 font-mono -mt-2 pr-2">
                                                {minute === 0 ? `${hour}:00` : `${hour}:30`}
                                            </div>
                                            {weekDays.map((day, dayIndex) => {
                                                const score = getScore(day, hour, minute)
                                                const busy = isBusy(day, hour, minute)
                                                const intensityClass = getIntensityClass(score, busy)
                                                const practiceId = getPracticeEventId(day, hour, minute)
                                                const isPractice = !!practiceId
                                                const slotId = `${day.toISOString()}-${hour}-${minute}`

                                                return (
                                                    <div
                                                        key={dayIndex}
                                                        data-date={day.toISOString()}
                                                        data-hour={hour}
                                                        data-minute={minute}
                                                        onMouseDown={() => handleDragStart(day, hour, minute)}
                                                        onMouseEnter={() => handleDragEnter(day, hour, minute)}
                                                        onTouchStart={(e) => handleTouchStart(e, day, hour, minute)}
                                                        onTouchMove={handleTouchMove}
                                                        onTouchEnd={handleTouchEnd}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        onClick={() => !isDragging && handleCellClick(day, hour, minute)}
                                                        className={cn(
                                                            "h-6 rounded-sm transition-all duration-200 cursor-pointer border-[0.5px] relative group select-none flex items-center justify-center touch-manipulation",
                                                            isPractice ? "bg-green-500 border-green-600 hover:bg-green-600 z-10" : intensityClass,
                                                            (isDragging && dragMode === 'remove' && isPractice && selectedDragSlotIds.has(slotId)) && "opacity-50",
                                                            (isDragging && dragMode === 'add' && !isPractice && selectedDragSlotIds.has(slotId)) && "bg-green-500 border-green-600"
                                                        )}
                                                        title={
                                                            isPractice ? (busy ? "決定済みの練習予定 (競合あり - クリックで解除)" : "決定済みの練習予定 (クリックで解除)") :
                                                                busy ? "予定あり" :
                                                                    `${format(day, 'M/d')} ${hour}:${minute === 0 ? '00' : '30'} - スコア: ${score}`
                                                        }
                                                    >
                                                        {isPractice && (
                                                            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-[8px]">
                                                                決定
                                                            </div>
                                                        )}
                                                        {!isPractice && !busy && score > 0 && (
                                                            <span className="text-[9px] font-bold">{getTriangleCount(day, hour, minute)}</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            <div className="p-1 text-left text-[10px] text-gray-400 font-mono -mt-2 pl-2">
                                                {minute === 0 ? `${hour}:00` : `${hour}:30`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Monthly View */
                        <div className="w-full">
                            <div className="w-full">
                                {/* Calendar Header */}
                                <div className="grid grid-cols-7 gap-px mb-2">
                                    {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
                                        <div key={i} className="text-center py-2 text-sm font-bold text-gray-500">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, i) => {
                                        const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                                        const isToday = isSameDay(day, new Date())
                                        const dayPracticeEvents = getPracticeEventsForDay(day)
                                        const mergedEvents = mergeContinuousEvents(dayPracticeEvents)

                                        return (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "min-h-[80px] p-1.5 rounded-lg border flex flex-col transition-colors cursor-pointer hover:bg-gray-50 overflow-visible",
                                                    isCurrentMonth ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-40",
                                                    isToday && "ring-2 ring-blue-500"
                                                )}
                                                onClick={() => {
                                                    onDateChange(day)
                                                    setViewMode('week')
                                                }}
                                                title={format(day, 'M月d日', { locale: ja })}
                                            >
                                                <div className={cn(
                                                    "text-xs font-medium mb-1",
                                                    isToday ? "text-blue-600" : "text-gray-500"
                                                )}>
                                                    {format(day, 'd')}
                                                </div>
                                                {mergedEvents.length > 0 && (
                                                    <div className="space-y-0.5 flex-1 overflow-visible">
                                                        {mergedEvents.map((event, j) => (
                                                            <div
                                                                key={j}
                                                                className="bg-green-500 text-white text-[8px] leading-tight px-0.5 py-px rounded font-medium whitespace-nowrap overflow-visible z-10 relative"
                                                            >
                                                                {format(event.start, 'H:mm')}-{format(event.end, 'H:mm')}
                                                            </div>
                                                        ))}
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
            <ScheduleList practiceEvents={practiceEvents} groupId={groupId} />
        </div>
    )
}

