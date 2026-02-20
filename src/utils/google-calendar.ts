export interface CalendarEvent {
    id: string
    summary: string
    start: {
        dateTime?: string
        date?: string
    }
    end: {
        dateTime?: string
        date?: string
    }
}

export interface CalendarInfo {
    id: string
    summary: string
    primary?: boolean
    backgroundColor?: string
    selected?: boolean
}

export async function listCalendars(accessToken: string): Promise<CalendarInfo[]> {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) {
        const error = await response.json()
        console.error('Error fetching calendar list:', error)
        throw new Error('カレンダー一覧の取得に失敗しました')
    }

    const data = await response.json()
    return (data.items || [])
        .filter((cal: any) => !cal.id.includes('#holiday@'))
        .map((cal: any) => ({
            id: cal.id,
            summary: cal.summary,
            primary: cal.primary || false,
            backgroundColor: cal.backgroundColor,
            selected: cal.selected,
        }))
}

export async function listEvents(
    accessToken: string,
    timeMin: string,
    timeMax: string,
    calendarIds?: string[]
): Promise<CalendarEvent[]> {
    // Default to primary if no calendar IDs specified
    const ids = calendarIds && calendarIds.length > 0 ? calendarIds : ['primary']

    // Fetch events from all specified calendars in parallel
    const results = await Promise.allSettled(
        ids.map(async (calendarId) => {
            const params = new URLSearchParams({
                timeMin,
                timeMax,
                singleEvents: 'true',
                orderBy: 'startTime',
            })

            const encodedId = encodeURIComponent(calendarId)
            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            )

            if (!response.ok) {
                const error = await response.json()
                console.error(`Error fetching events from calendar ${calendarId}:`, error)
                return [] as CalendarEvent[]
            }

            const data = await response.json()
            return (data.items || []) as CalendarEvent[]
        })
    )

    // Flatten and deduplicate by event ID
    const allEvents: CalendarEvent[] = []
    const seenIds = new Set<string>()

    for (const result of results) {
        if (result.status === 'fulfilled') {
            for (const event of result.value) {
                if (!seenIds.has(event.id)) {
                    seenIds.add(event.id)
                    allEvents.push(event)
                }
            }
        }
    }

    return allEvents.sort((a, b) => {
        const aTime = a.start.dateTime || a.start.date || ''
        const bTime = b.start.dateTime || b.start.date || ''
        return aTime.localeCompare(bTime)
    })
}
