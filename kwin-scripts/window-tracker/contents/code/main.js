// Desktop Agent - Window Activity Tracker KWin Script
// Tracks window activations and logs process information

console.log("Window Activity Tracker: Initializing...");

// Configuration
const LOG_TO_CONSOLE = true;

// Track previous window to avoid duplicate events
let previousWindow = null;

/**
 * Extract process information from a window
 */
function getWindowInfo(client) {
    if (!client) {
        return null;
    }

    try {
        return {
            timestamp: new Date().toISOString(),
            windowTitle: client.caption || "Unknown",
            resourceClass: client.resourceClass ? client.resourceClass.toString() : "Unknown",
            resourceName: client.resourceName ? client.resourceName.toString() : "Unknown",
            pid: client.pid || -1,
            // Additional useful information
            windowId: client.windowId || 0,
            desktop: client.desktop || -1,
            screen: client.screen || 0,
            activities: client.activities || [],
            geometry: {
                x: client.x || 0,
                y: client.y || 0,
                width: client.width || 0,
                height: client.height || 0
            }
        };
    } catch (error) {
        console.error("Window Activity Tracker: Error extracting window info:", error);
        return null;
    }
}

/**
 * Log window activation event
 */
function logWindowActivation(client) {
    // Skip if same window as before
    if (client === previousWindow) {
        return;
    }
    previousWindow = client;

    const windowInfo = getWindowInfo(client);
    if (!windowInfo) {
        return;
    }

    // Manually construct event data (spread operator not supported in KWin JS)
    const eventData = {
        event_type: "window_activated",
        timestamp: windowInfo.timestamp,
        windowTitle: windowInfo.windowTitle,
        resourceClass: windowInfo.resourceClass,
        resourceName: windowInfo.resourceName,
        pid: windowInfo.pid,
        windowId: windowInfo.windowId,
        desktop: windowInfo.desktop,
        screen: windowInfo.screen,
        activities: windowInfo.activities,
        geometry: windowInfo.geometry
    };

    // Log to console (journal)
    // File output is handled by capture-window-events.sh which reads from the journal
    if (LOG_TO_CONSOLE) {
        console.log("Window Activity Tracker:", JSON.stringify(eventData));
    }
}

/**
 * Initialize window tracking
 */
function init() {
    console.log("Window Activity Tracker: Connecting to workspace signals...");

    // Connect to window activation signal
    workspace.windowActivated.connect(function(client) {
        if (client) {
            logWindowActivation(client);
        }
    });

    // Log currently active window on script start
    const activeClient = workspace.activeWindow;
    if (activeClient) {
        console.log("Window Activity Tracker: Logging current active window...");
        logWindowActivation(activeClient);
    }

    console.log("Window Activity Tracker: Initialized successfully!");
    console.log("Window Activity Tracker: Monitoring window activations...");
}

// Start the script
try {
    init();
} catch (error) {
    console.error("Window Activity Tracker: Initialization failed:", error);
}

