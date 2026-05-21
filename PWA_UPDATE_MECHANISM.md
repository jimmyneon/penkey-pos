# PWA Auto-Update Mechanism

## Problem
The PWA was not automatically updating when new versions were deployed. Users had to manually clear data and re-download the app to get updates.

## Root Cause
1. Service worker was configured with `skipWaiting: true` but update detection wasn't properly connected to the UI
2. The `PWAUpdateNotifier` component wasn't receiving notifications when updates were available
3. No proper communication between service worker registration and the update notifier component

## Solution Implemented

### 1. Service Worker Registration (`src/components/service-worker-register.tsx`)
- **Manual registration** with `updateViaCache: "none"` to prevent caching issues
- **Update detection** via `updatefound` event listener
- **State monitoring** of new service worker installation
- **Custom event dispatch** (`swUpdateAvailable`) when update is ready
- **Periodic checks** every 5 minutes for new versions
- **Visibility-based checks** when user returns to the tab

### 2. Update Notifier (`src/components/pwa-update-notifier.tsx`)
- **Listens for custom event** from service worker registration
- **Stores waiting worker** reference for activation
- **Shows update prompt** with "Update" button
- **Sends SKIP_WAITING message** to activate new service worker
- **Auto-reloads** when new service worker takes control

### 3. Custom Service Worker (`worker/index.js`)
- **Handles SKIP_WAITING message** from the app
- **Claims clients immediately** on activation
- **Notifies clients** when new service worker is active
- **Logging** for debugging update flow

### 4. Next.js PWA Config (`next.config.js`)
- **Manual registration** (`register: false`) - handled by our component
- **Manual skipWaiting** (`skipWaiting: false`) - controlled by user action
- **Cache-busting build ID** using timestamp
- **Proper runtime caching** strategies

## Update Flow

1. **New version deployed** → Build generates new service worker with different hash
2. **User visits app** → Service worker registration checks for updates
3. **Update detected** → `updatefound` event fires
4. **New worker installs** → State changes to "installed"
5. **Custom event dispatched** → `swUpdateAvailable` event sent to window
6. **Update prompt shown** → Blue banner appears at top of screen
7. **User clicks "Update"** → SKIP_WAITING message sent to service worker
8. **New worker activates** → Claims all clients
9. **Controller changes** → Page automatically reloads
10. **User sees new version** → Update complete!

## Testing Updates

### In Development
Service worker is disabled in development mode. Test in production build:

```bash
npm run build
npm start
```

### Simulating an Update
1. Build and deploy version 1
2. Make a code change (e.g., update a component)
3. Build version 2 (generates new service worker hash)
4. Deploy version 2
5. Open the PWA (version 1 still running)
6. Wait up to 5 minutes or switch tabs to trigger update check
7. Update prompt should appear
8. Click "Update" to activate new version

### Manual Testing
1. Open DevTools → Application → Service Workers
2. Check "Update on reload" to force updates during testing
3. Monitor console for `[SW]` and `[PWA Update]` logs
4. Verify update flow in Network tab

## Debugging

### Console Logs
- `[SW] Attempting to register service worker...` - Registration started
- `[SW] Service worker registered successfully` - Registration complete
- `[SW] Checking for updates...` - Periodic check running
- `[SW] Service worker update found` - New version detected
- `[SW] New service worker state: installed` - New version ready
- `[PWA Update] Update available event received` - UI notified
- `[PWA Update] Sending SKIP_WAITING message` - User clicked update
- `[PWA Update] Controller changed, reloading page` - Activating new version

### Common Issues

**Update prompt doesn't appear:**
- Check console for `[SW]` logs
- Verify new build has different service worker hash
- Ensure `updateViaCache: "none"` is set
- Check DevTools → Application → Service Workers for waiting worker

**Update doesn't activate:**
- Verify SKIP_WAITING message handler in worker/index.js
- Check that `skipWaiting: false` in next.config.js (manual control)
- Look for errors in service worker console

**Page doesn't reload:**
- Verify `controllerchange` event listener is registered
- Check for JavaScript errors preventing reload
- Ensure service worker properly claims clients

## Configuration Files

- `src/components/service-worker-register.tsx` - Registration and update detection
- `src/components/pwa-update-notifier.tsx` - UI for update prompts
- `worker/index.js` - Custom service worker event handlers
- `next.config.js` - PWA configuration
- `public/manifest.json` - PWA manifest

## Best Practices

1. **Always test updates** before deploying to production
2. **Monitor update logs** in production for issues
3. **Keep update checks reasonable** (5 minutes is good balance)
4. **Don't force updates** - let users choose when to update
5. **Clear messaging** - tell users what's being updated
6. **Handle errors gracefully** - don't break app if update fails

## Future Improvements

- [ ] Add "What's New" changelog in update prompt
- [ ] Track update success/failure metrics
- [ ] Add option to "Update Later" with reminder
- [ ] Show update size/download progress
- [ ] Implement staged rollouts for safety
