'use client'

import React, { useState, useTransition, useEffect, useOptimistic, useRef } from 'react'
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
    calendarEvents: any[]
    groupBusySlots: { user_id: string; start_time: string; end_time: string }[]
    startHour: number
    endHour: number
    currentDate: Date
    onDateChange: (date: Date | ((prev: Date) => Date)) => void
}

export function AvailabilityInput({
    groupId,
    userId,
    availabilities,
    calendarEvents: initialCalendarEvents, // Renamed to avoid conflict with state
    groupBusySlots,
    startHour,
    endHour,
    currentDate,
    onDateChange,
}: AvailabilityInputProps) {
    // const [currentDate, setCurrentDate] = useState(new Date()) // Lifted up
    const [isPending, startTransition] = useTransition()
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initialCalendarEvents)
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Optimistic UI
    const [optimisticAvailabilities, addOptimisticAvailability] = useOptimistic<Availability[], {
        type: 'add' | 'remove' | 'bulk_remove',
        slots?: { start: string, end: string, priority?: number }[],
        dateStr?: string
    }>(
        availabilities,
        (state, action) => {
            switch (action.type) {
                case 'add': {
                    const newSlots = action.slots || [];
                    const updateStartTimes = new Set(newSlots.map(s => new Date(s.start).getTime()));
                    // Filter out existing items that overlap with new additions (to avoid duplicates if any)
                    const filtered = state.filter(a => !updateStartTimes.has(new Date(a.start_time).getTime()));

                    const newAvailabilities = newSlots.map(slot => ({
                        id: 'optimistic-' + Math.random(),
                        user_id: userId,
                        group_id: groupId,
                        start_time: slot.start,
                        end_time: slot.end,
                        priority: slot.priority || 1,
                        created_at: new Date().toISOString()
                    } as Availability));
                    return [...filtered, ...newAvailabilities];
                }
                case 'remove': {
                    const slotsToRemove = action.slots || [];
                    const removeStartTimes = new Set(slotsToRemove.map(s => new Date(s.start).getTime()));
                    return state.filter(a => !removeStartTimes.has(new Date(a.start_time).getTime()));
                }
                case 'bulk_remove': {
                    // For bulk remove, we might not need this if we handle it via 'remove' type with calculated slots
                    // But if we use dateStr...
                    return state;
                }
            }
            return state;
        }
    );

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false)
    const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
    const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())

    // Long press refs
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const startPosRef = useRef<{ x: number, y: number } | null>(null)

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday start
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i))
    const timeSlots = Array.from({ length: (endHour - startHour) * 2 }, (_, i) => {
        const totalMinutes = i * 30
        const hour = startHour + Math.floor(totalMinutes / 60)
        const minute = totalMinutes % 60
        return { hour, minute }
    })

    const handlePrevWeek = () => onDateChange(prev => subWeeks(prev, 1))
    const handleNextWeek = () => onDateChange(prev => addWeeks(prev, 1))

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

    const getPriority = (date: Date, hour: number, minute: number): number | null => {
        const start = new Date(date)
        start.setHours(hour, minute, 0, 0)

        const availability = optimisticAvailabilities.find(a =>
            a.user_id === userId &&
            new Date(a.start_time).getTime() === start.getTime()
        )
        return availability?.priority ?? null
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

        return calendarEvents.some(event => {
            const eventStart = new Date(event.start.dateTime || event.start.date || '')
            const eventEnd = new Date(event.end.dateTime || event.end.date || '')

            // Allow if event ends exactly when slot starts or starts exactly when slot ends
            if (eventEnd.getTime() <= slotStart.getTime()) return false
            if (eventStart.getTime() >= slotEnd.getTime()) return false

            return true
        })
    }

    const isOthersBusy = (date: Date, hour: number, minute: number) => {
        const slotStart = new Date(date)
        slotStart.setHours(hour, minute, 0, 0)
        const slotEnd = new Date(date)
        if (minute === 0) {
            slotEnd.setHours(hour, 30, 0, 0)
        } else {
            slotEnd.setHours(hour + 1, 0, 0, 0)
        }

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

    const getAvailabilityCount = (date: Date, hour: number, minute: number) => {
        const start = new Date(date)
        start.setHours(hour, minute, 0, 0)

        const count = optimisticAvailabilities.filter(a =>
            new Date(a.start_time).getTime() === start.getTime()
        ).length
        return count
    }

    const handleToggle = (date: Date, hour: number, minute: number) => {
        const currentPriority = getPriority(date, hour, minute)

        // Prevent setting priority if busy, but allow removing existing priority
        if (isBusy(date, hour, minute) && currentPriority === null) {
            toast.error('予定があるため入力できません')
            return
        }

        startTransition(async () => {
            const start = new Date(date)
            start.setHours(hour, minute, 0, 0)
            const end = new Date(date)
            if (minute === 0) {
                end.setHours(hour, 30, 0, 0)
            } else {
                end.setHours(hour + 1, 0, 0, 0)
            }

            const startIso = start.toISOString()
            const endIso = end.toISOString()

            // Toggle: null -> 1 -> null
            const newPriority = currentPriority === null ? 1 : null

            // Optimistic update
            if (newPriority === 1) {
                addOptimisticAvailability({
                    type: 'add',
                    slots: [{ start: startIso, end: endIso, priority: 1 }]
                })
            } else {
                addOptimisticAvailability({
                    type: 'remove',
                    slots: [{ start: startIso, end: endIso }]
                })
            }

            try {
                await toggleAvailability(groupId, startIso, endIso, newPriority)
            } catch (error) {
                toast.error('更新に失敗しました')
            }
        })
    }

    const handleDragStart = (date: Date, hour: number, minute: number) => {
        if (isBusy(date, hour, minute)) return

        setIsDragging(true)
        const currentPriority = getPriority(date, hour, minute)
        const mode = currentPriority === null ? 'add' : 'remove'
        setDragMode(mode)

        const slotId = `${date.toISOString()}-${hour}-${minute}`
        setSelectedSlotIds(new Set([slotId]))
    }

    const handleDragEnter = (date: Date, hour: number, minute: number) => {
        if (!isDragging || isBusy(date, hour, minute)) return

        const slotId = `${date.toISOString()}-${hour}-${minute}`
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
            // id format: ISOString-hour-minute
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
                addOptimisticAvailability({
                    type: 'add',
                    slots: slots.map(s => ({ ...s, priority: 1 }))
                })
            } else {
                addOptimisticAvailability({
                    type: 'remove',
                    slots: slots
                })
            }

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

            // Calculate slots for the whole day to perform optimistic update
            // We need to match the logic of bulkToggleAvailability on server or just generate all slots
            const slots: { start: string, end: string, priority?: number }[] = []
            if (priority === 1) {
                // Add all slots for the day (startHour to endHour)
                for (let h = startHour; h < endHour; h++) {
                    for (let m = 0; m < 60; m += 30) {
                        // Check if busy? Default logic might override? 
                        // Usually bulk set ignores busy? Or server checks it?
                        // Client should check busy to be accurate.
                        if (!isBusy(date, h, m)) {
                            const s = new Date(date); s.setHours(h, m, 0, 0);
                            const e = new Date(date);
                            if (m === 0) e.setHours(h, 30, 0, 0); else e.setHours(h + 1, 0, 0, 0);
                            slots.push({ start: s.toISOString(), end: e.toISOString(), priority: 1 });
                        }
                    }
                }
                addOptimisticAvailability({ type: 'add', slots });
            } else {
                // Remove all slots for the day
                for (let h = startHour; h < endHour; h++) {
                    for (let m = 0; m < 60; m += 30) {
                        const s = new Date(date); s.setHours(h, m, 0, 0);
                        const e = new Date(date);
                        if (m === 0) e.setHours(h, 30, 0, 0); else e.setHours(h + 1, 0, 0, 0);
                        slots.push({ start: s.toISOString(), end: e.toISOString() });
                    }
                }
                addOptimisticAvailability({ type: 'remove', slots });
            }

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

    // Touch support
    const handleTouchStart = (e: React.TouchEvent, date: Date, hour: number, minute: number) => {
        if (e.touches.length > 1) return

        // Don't prevent default here to allow scrolling initially

        const touch = e.touches[0]
        startPosRef.current = { x: touch.clientX, y: touch.clientY }

        const target = e.target as HTMLElement
        const button = target.closest('button')
        if (!button) return

        if (isBusy(date, hour, minute)) return

        // Start long press timer
        longPressTimerRef.current = setTimeout(() => {
            setIsDragging(true)
            const currentPriority = getPriority(date, hour, minute)
            const mode = currentPriority === null ? 'add' : 'remove'
            setDragMode(mode)

            const slotId = `${date.toISOString()}-${hour}-${minute}`
            setSelectedSlotIds(new Set([slotId]))

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50)
            }
        }, 300) // 300ms long press
    }

    const handleTouchMove = (e: React.TouchEvent) => {
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

        // Processing drag selection
        if (e.cancelable) {
            e.preventDefault()
        }

        const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement

        if (!target) return

        const button = target.closest('button')
        if (!button) return

        const dateStr = button.getAttribute('data-date')
        const hourStr = button.getAttribute('data-hour')
        const minuteStr = button.getAttribute('data-minute')

        if (dateStr && hourStr && minuteStr) {
            const date = new Date(dateStr)
            const hour = parseInt(hourStr)
            const minute = parseInt(minuteStr)

            // Re-use logic from drag enter
            if (isBusy(date, hour, minute)) return

            const slotId = `${date.toISOString()}-${hour}-${minute}`
            setSelectedSlotIds(prev => {
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

                        <div className="space-y-px">
                            {timeSlots.map(({ hour, minute }) => (
                                <div key={`${hour}-${minute}`} className="grid grid-cols-8 gap-1 h-7">
                                    <div className="text-[10px] text-gray-400 text-center flex items-center justify-center font-mono">
                                        {minute === 0 ? `${hour}:00` : `${hour}:30`}
                                    </div>
                                    {weekDays.map(day => {
                                        const priority = getPriority(day, hour, minute)
                                        const count = getAvailabilityCount(day, hour, minute)
                                        const busy = isBusy(day, hour, minute)
                                        const othersBusy = isOthersBusy(day, hour, minute)

                                        const slotId = `${day.toISOString()}-${hour}-${minute}`
                                        const isSelected = selectedSlotIds.has(slotId)

                                        let displayPriority = priority
                                        if (isDragging && isSelected) {
                                            displayPriority = dragMode === 'add' ? 1 : null
                                        }

                                        return (
                                            <button
                                                key={`${day}-${hour}-${minute}`}
                                                data-date={day.toISOString()}
                                                data-hour={hour}
                                                data-minute={minute}
                                                onMouseDown={() => handleDragStart(day, hour, minute)}
                                                onMouseEnter={() => handleDragEnter(day, hour, minute)}
                                                onTouchStart={(e) => handleTouchStart(e, day, hour, minute)}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                                onContextMenu={(e) => e.preventDefault()}
                                                onClick={() => !isDragging && handleToggle(day, hour, minute)}
                                                disabled={isPending}
                                                className={cn(
                                                    "rounded-sm border-[0.5px] text-[10px] flex items-center justify-center transition-colors relative select-none touch-manipulation",
                                                    (busy && displayPriority === null) ? "cursor-not-allowed bg-gray-800 border-gray-900" :
                                                        displayPriority === 1 ? "bg-yellow-100 border-yellow-300 text-yellow-800" :
                                                            othersBusy ? "bg-gray-800 border-gray-900" : "bg-white border-gray-200 hover:bg-gray-50",
                                                    isSelected && "ring-1 ring-blue-500 z-10"
                                                )}
                                            >
                                                {displayPriority === 1 ? '△' : (displayPriority === null && !busy && !othersBusy && count > 0 ? (
                                                    <span className="text-blue-300 font-bold opacity-50">{count}</span>
                                                ) : '')}
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
