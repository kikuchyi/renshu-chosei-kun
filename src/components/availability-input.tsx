'use client'

import React, { useState, useTransition, useEffect } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, getHours, set } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
    toggleAvailability,
    bulkToggleAvailability,
    updateAvailabilities,
    fetchCalendarEvents
} from '@/app/actions'
import { signInWithGoogle } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Database } from '@/types/supabase'
import type { CalendarEvent } from '@/utils/google-calendar'

type Availability = Database['public']['Tables']['availabilities']['Row']

interface AvailabilityInputProps {
    groupId: string
    userId: string
    availabilities: Availability[]
    groupBusySlots: Database['public']['Tables']['user_busy_slots']['Row'][]
}

// 5:00 to 29:00 (5:00 next day)
const START_HOUR = 5
const END_HOUR = 29

export function AvailabilityInput({
    groupId,
    userId,
    availabilities,
    groupBusySlots,
}: AvailabilityInputProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [isPending, startTransition] = useTransition()
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false)
    const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
    const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())

    // Get start of the current week view
    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday start
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i))
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

    const handlePrevWeek = () => setCurrentDate(prev => subWeeks(prev, 1))
    const handleNextWeek = () => setCurrentDate(prev => addWeeks(prev, 1))

    const fetchEvents = async () => {
        setIsLoadingCalendar(true)
        try {
            const start = weekDays[0].toISOString()
            const end = addDays(weekDays[6], 2).toISOString() // Fetch a bit more to cover late night
            const result: any = await fetchCalendarEvents(start, end)
            const events = result.events || []
            setCalendarEvents(events)
            if (events.length > 0) {
                toast.success('Googleカレンダーの予定を取得しました')
            } else {
                toast.info(result.error || '予定が見つかりませんでした（または連携されていません）')
            }
        } catch (error) {
            console.error(error)
            toast.error('カレンダーの取得に失敗しました')
        } finally {
            setIsLoadingCalendar(false)
        }
    }

    // Fetch on week change
    useEffect(() => {
        fetchEvents()
    }, [currentDate])

    const getPriority = (date: Date, hour: number): number | null => {
        const start = new Date(date)
        start.setHours(hour, 0, 0, 0)

        const availability = availabilities.find(a =>
            a.user_id === userId &&
            new Date(a.start_time).getTime() === start.getTime()
        )
        return availability?.priority ?? null
    }

    const isBusy = (date: Date, hour: number) => {
        const slotStart = new Date(date)
        slotStart.setHours(hour, 0, 0, 0)
        const slotEnd = new Date(date)
        slotEnd.setHours(hour + 1, 0, 0, 0)

        return calendarEvents.some(event => {
            const eventStart = new Date(event.start.dateTime || event.start.date || '')
            const eventEnd = new Date(event.end.dateTime || event.end.date || '')

            // Allow if event ends exactly when slot starts or starts exactly when slot ends
            if (eventEnd.getTime() <= slotStart.getTime()) return false
            if (eventStart.getTime() >= slotEnd.getTime()) return false

            return true
        })
    }

    const isOthersBusy = (date: Date, hour: number) => {
        const slotStart = new Date(date)
        slotStart.setHours(hour, 0, 0, 0)
        const slotEnd = new Date(date)
        slotEnd.setHours(hour + 1, 0, 0, 0)

        // Filter out my own slots from DB-backed busy slots
        const otherMembersSlots = groupBusySlots.filter(slot => slot.user_id !== userId)

        return otherMembersSlots.some(slot => {
            const start = new Date(slot.start_time)
            const end = new Date(slot.end_time)

            // Overlap check
            if (end.getTime() <= slotStart.getTime()) return false
            if (start.getTime() >= slotEnd.getTime()) return false
            return true
        })
    }

    const getAvailabilityCount = (date: Date, hour: number) => {
        const start = new Date(date)
        start.setHours(hour, 0, 0, 0)

        const count = availabilities.filter(a =>
            new Date(a.start_time).getTime() === start.getTime()
        ).length
        return count
    }

    const handleToggle = (date: Date, hour: number) => {
        const currentPriority = getPriority(date, hour)

        // Prevent setting priority if busy, but allow removing existing priority
        if (isBusy(date, hour) && currentPriority === null) {
            toast.error('予定があるため入力できません')
            return
        }

        startTransition(async () => {
            const start = new Date(date)
            start.setHours(hour, 0, 0, 0)
            const end = new Date(date)
            end.setHours(hour + 1, 0, 0, 0)

            const startIso = start.toISOString()
            const endIso = end.toISOString()
            const currentPriority = getPriority(date, hour)

            // Toggle: null -> 1 -> null
            const newPriority = currentPriority === null ? 1 : null

            try {
                await toggleAvailability(groupId, startIso, endIso, newPriority)
            } catch (error) {
                toast.error('更新に失敗しました')
            }
        })
    }

    const handleDragStart = (date: Date, hour: number) => {
        if (isBusy(date, hour)) return

        setIsDragging(true)
        const currentPriority = getPriority(date, hour)
        const mode = currentPriority === null ? 'add' : 'remove'
        setDragMode(mode)

        const slotId = `${date.toISOString()}-${hour}`
        setSelectedSlotIds(new Set([slotId]))
    }

    const handleDragEnter = (date: Date, hour: number) => {
        if (!isDragging || isBusy(date, hour)) return

        const slotId = `${date.toISOString()}-${hour}`
        setSelectedSlotIds(prev => {
            const newSet = new Set(prev)
            newSet.add(slotId)
            return newSet
        })
    }

    const handleDragEnd = () => {
        if (!isDragging || !dragMode || selectedSlotIds.size === 0) {
            setIsDragging(false)
            setDragMode(null)
            setSelectedSlotIds(new Set())
            return
        }

        const slots = Array.from(selectedSlotIds).map(id => {
            // id format: ISOString-hour (Note: ISOString contains hyphens and colons)
            // But wait, `day.toString()` in existing code uses default toString which is messy.
            // Let's check how we generate keys.
            // existing keys use `${day}-${hour}` where day is Date object. This is "[object Date]-hour".
            // My handleDragStart used `date.toISOString()`.
            // We need to parse back or store structured data.
            // Storing structured object in Set doesn't work well for uniqueness.
            // Let's parse string id.
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
                await updateAvailabilities(groupId, dragMode, slots)
            } catch (error) {
                toast.error('更新に失敗しました')
            }
        })

        setIsDragging(false)
        setDragMode(null)
        setSelectedSlotIds(new Set())
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
    }, [isDragging, dragMode, selectedSlotIds]) // Deps needed for closure capture

    const handleBulkToggle = (date: Date, priority: number | null) => {
        startTransition(async () => {
            const dateStr = format(date, 'yyyy-MM-dd')
            try {
                await bulkToggleAvailability(groupId, dateStr, priority)
                if (priority === null) {
                    toast.success('全ての△を削除しました')
                } else {
                    toast.success('全ての時間帯に△を追加しました')
                }
            } catch (error) {
                toast.error('更新に失敗しました')
            }
        })
    }

    return (
        <Card className="w-full">
            <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-baseline gap-2">
                            <span>予定の入力</span>
                            <span className="text-sm font-normal text-gray-500">
                                (Googleカレンダーを連携してください)
                            </span>
                        </CardTitle>
                        <CardDescription>
                            予定はないが、好ましくない時間帯には△を入力してください。
                            <span className="block mt-1 text-[10px] text-gray-500">
                                ※ <span className="inline-block w-2 h-2 bg-gray-800 mr-1 align-middle"></span> 誰か1人でもGoogle予定がある時間帯は濃い灰色で表示されます
                            </span>
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={isLoadingCalendar}>
                            {isLoadingCalendar ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
                            Gカレンダー更新
                        </Button>

                    </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium whitespace-nowrap">
                        {format(startOfCurrentWeek, 'M月d日', { locale: ja })} - {format(addDays(startOfCurrentWeek, 6), 'M月d日', { locale: ja })}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-x-auto pb-4">
                    <div className="min-w-[700px]">
                        <div className="grid grid-cols-8 gap-1 mb-2">
                            <div className="text-xs text-gray-500 text-center pt-2">時間</div>
                            {weekDays.map(day => (
                                <div key={day.toString()} className={cn(
                                    "text-center p-1 rounded-t-md text-sm font-medium flex flex-col gap-1",
                                    isSameDay(day, new Date()) ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-700"
                                )}>
                                    <div>
                                        <div>{format(day, 'M/d', { locale: ja })}</div>
                                        <div className="text-xs">{format(day, 'E', { locale: ja })}</div>
                                    </div>
                                    <div className="flex flex-col gap-1 justify-center mt-1">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 px-1 text-[10px]"
                                            onClick={() => handleBulkToggle(day, 1)}
                                            disabled={isPending}
                                        >
                                            全て△
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 px-1 text-[10px]"
                                            onClick={() => handleBulkToggle(day, null)}
                                            disabled={isPending}
                                        >
                                            削除
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-1">
                            {hours.map(hour => (
                                <div key={hour} className="grid grid-cols-8 gap-1 h-10">
                                    <div className="text-xs text-gray-400 text-center flex items-center justify-center">
                                        {hour}:00
                                    </div>
                                    {weekDays.map(day => {
                                        const priority = getPriority(day, hour)
                                        const count = getAvailabilityCount(day, hour)
                                        const busy = isBusy(day, hour)
                                        const othersBusy = isOthersBusy(day, hour)

                                        const slotId = `${day.toISOString()}-${hour}`
                                        const isSelected = selectedSlotIds.has(slotId)

                                        let displayPriority = priority
                                        if (isDragging && isSelected) {
                                            displayPriority = dragMode === 'add' ? 1 : null
                                        }

                                        return (
                                            <button
                                                key={`${day}-${hour}`}
                                                onMouseDown={() => handleDragStart(day, hour)}
                                                onMouseEnter={() => handleDragEnter(day, hour)}
                                                onClick={() => !isDragging && handleToggle(day, hour)}
                                                disabled={isPending}
                                                className={cn(
                                                    "rounded-md border text-xs flex items-center justify-center transition-colors relative select-none",
                                                    (busy && displayPriority === null) && "cursor-not-allowed",
                                                    displayPriority === 1
                                                        ? "bg-yellow-200 text-yellow-900 border-yellow-300 hover:bg-yellow-300"
                                                        : (busy
                                                            ? "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                                                            : (othersBusy
                                                                ? "bg-gray-800 text-white border-gray-900 hover:bg-gray-900"
                                                                : "bg-white border-gray-100 hover:bg-gray-50")),
                                                    count > 0 && displayPriority === null && !busy && !othersBusy && "bg-blue-50"
                                                )}
                                            >
                                                {displayPriority === 1 && "△"}
                                                {busy && displayPriority === null && "予定"}
                                                {displayPriority === null && !busy && othersBusy && (
                                                    <span className="text-[10px] opacity-70">他予定</span>
                                                )}
                                                {displayPriority === null && !busy && !othersBusy && count > 0 && (
                                                    <span className="text-blue-300 font-bold opacity-50">{count}</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
