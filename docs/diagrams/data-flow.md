# Data Flow

This sequence diagram traces the full lifecycle of a connection and data poll — from the user clicking Connect through to a dashboard component rendering time-averaged data. It covers the connection FSM, polling loop, time-buffer accumulation, and localStorage persistence for config, settings, and theme.

```mermaid
sequenceDiagram
    actor User
    participant Page as page.tsx (Home)
    participant ConnBar as ConnectionBar
    participant API as api.ts
    participant FRM as FRM Mod Server
    participant Hook as useTimeBuffer
    participant Dashboard as Dashboard Tab
    participant LS as localStorage
    participant ThemeProvider as ThemeProvider

    Note over Page,LS: ═══ APP BOOT ═══

    Page->>LS: getItem('frm-config')
    LS-->>Page: FRMConfig (or default)
    Page->>LS: getItem('frm-app-settings')
    LS-->>Page: AppSettings (or default)

    ThemeProvider->>LS: getItem('frm-theme')
    LS-->>ThemeProvider: DashboardTheme (or default)
    ThemeProvider->>ThemeProvider: applyThemeCssVars(theme)
    Note over ThemeProvider: Sets --bg-primary, --accent, etc.<br/>on document.documentElement

    Note over User,FRM: ═══ CONNECTION FSM ═══

    User->>ConnBar: Enter host, port, token
    User->>ConnBar: Click Connect
    ConnBar->>Page: onConnect()
    Page->>API: testConnection(config)
    API->>FRM: GET /getPower (health check)
    alt Connection Success
        FRM-->>API: 200 OK
        API-->>Page: { ok: true }
        Page->>Page: setConnected(true)
        Note over Page: Tab bar renders<br/>Dashboard mounts
    else Connection Failure
        FRM-->>API: Error / Timeout
        API-->>Page: { ok: false, error }
        Page->>Page: setError(error)
        Note over Page: Error banner shown
    end

    Note over User,FRM: ═══ POLLING LOOP (per dashboard tab) ═══

    Dashboard->>API: fetchEndpoint(config, 'getPower')
    API->>API: buildUrl(config, endpoint)
    Note over API: Auto-detects local vs remote<br/>Adds X-FRM-Authorization header<br/>Adds ngrok-skip-browser-warning
    API->>FRM: GET /getPower
    FRM-->>API: JSON response
    API-->>Dashboard: typed data (PowerCircuit[])
    Dashboard->>Hook: setBuffer(prev => [...prev, {timestamp, data}])
    Note over Hook: Pushes snapshot into rolling buffer<br/>Prunes entries older than 1 hour

    Dashboard->>Hook: getWindowData(timeWindow)
    Hook-->>Dashboard: T[] snapshots within window

    alt timeWindow === 0 (Live)
        Dashboard->>Dashboard: Render raw data directly
    else timeWindow > 0 (Averaged)
        Dashboard->>Dashboard: Average values across snapshots
        Note over Dashboard: circuitMap: sum each metric<br/>across snapshots, divide by count
        Dashboard->>Dashboard: Render averaged data
    end

    Note over Dashboard: setInterval fires every 5-10s<br/>(per-component refresh rate)

    Note over User,FRM: ═══ SETTINGS PERSISTENCE ═══

    User->>Page: Change tab
    Page->>LS: setItem('frm-app-settings', {activeTab})
    User->>Page: Change time window
    Page->>LS: setItem('frm-app-settings', {timeWindow})

    User->>ThemeProvider: Change theme color
    ThemeProvider->>LS: setItem('frm-theme', newTheme)
    ThemeProvider->>ThemeProvider: applyThemeCssVars(newTheme)

    Note over User,FRM: ═══ CHAT MESSAGE FLOW ═══

    User->>Dashboard: Type message + Enter
    Dashboard->>Dashboard: Optimistic append<br/>{Name: 'You', Timestamp: now}
    Dashboard->>API: sendChatMessage(config, text)
    API->>FRM: POST /sendChatMessage {message}
    FRM-->>API: 200 OK
    API-->>Dashboard: void (success)
    Note over Dashboard: Next poll cycle will<br/>fetch the confirmed message

    Note over User,FRM: ═══ TEARDOWN ═══

    Dashboard->>Dashboard: clearInterval on unmount
    Note over Dashboard: Component unmounts when<br/>user switches tabs
```
