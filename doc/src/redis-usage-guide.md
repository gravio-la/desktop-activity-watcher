# Redis Client Usage Guide - node-redis v5+

## Official Documentation

- **GitHub**: https://github.com/redis/node-redis
- **Redis.io Docs**: https://redis.io/docs/latest/develop/clients/nodejs/
- **Package**: `redis` v5.9.0+

## Connection Lifecycle

### 1. Create Client

```typescript
import { createClient } from 'redis';

const client = createClient({
  url: 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Max retries exceeded');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});
```

### 2. Error Handling (REQUIRED!)

**IMPORTANT**: Always attach an error handler BEFORE connecting!

```typescript
client.on('error', (err) => {
  console.error('Redis Client Error', err);
});
```

### 3. Connect

```typescript
await client.connect();
```

### 4. Use Client

```typescript
await client.set('key', 'value');
const value = await client.get('key');
```

### 5. Disconnect (Choose One)

#### Option A: `quit()` - Graceful Shutdown (RECOMMENDED)
```typescript
await client.quit();
```
- ✅ Waits for pending commands to complete
- ✅ Sends QUIT command to server
- ✅ Recommended for normal app shutdown
- ⚠️ Can hang if commands are stuck

#### Option B: `disconnect()` - Deprecated in v5
```typescript
// DON'T USE - Deprecated!
await client.disconnect();
```
- ❌ Deprecated in v5.x
- ⚠️ May cause "Socket closed unexpectedly" errors

#### Option C: Force Close (For Stuck Connections)
```typescript
try {
  await client.quit();
} catch (e) {
  // Force close if quit() fails
  client = null;
}
```

## Complete Example

```typescript
import { createClient, RedisClientType } from 'redis';

async function redisExample() {
  let client: RedisClientType | null = null;
  
  try {
    // 1. Create client
    client = createClient({
      url: 'redis://localhost:6379'
    });
    
    // 2. Add error handler FIRST!
    client.on('error', (err) => {
      console.error('Redis Error:', err);
    });
    
    // 3. Connect
    await client.connect();
    console.log('Connected to Redis');
    
    // 4. Use Redis
    await client.set('mykey', 'myvalue');
    const value = await client.get('mykey');
    console.log('Value:', value);
    
    // 5. Close gracefully
    await client.quit();
    console.log('Disconnected from Redis');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    client = null;
  }
}
```

## Best Practices for Desktop Agent

### For Long-Running Daemon

```typescript
export class RedisAdapter {
  private client: RedisClientType | null = null;
  private isClosing: boolean = false;

  async connect() {
    this.client = createClient({ url: config.url });
    
    // Suppress errors during intentional shutdown
    this.client.on('error', (err) => {
      if (!this.isClosing) {
        logger.error('Redis error:', err);
      }
    });
    
    await this.client.connect();
  }

  async writeEvent(event: Event) {
    if (!this.client || !this.client.isOpen) {
      return; // Skip if not connected
    }
    
    try {
      await this.client.set(key, JSON.stringify(event));
    } catch (error) {
      if (this.client && this.client.isOpen) {
        logger.error('Write failed:', error);
      }
    }
  }

  async close() {
    if (this.client && this.client.isOpen) {
      this.isClosing = true;
      
      try {
        await client.quit(); // Graceful shutdown
      } catch (error) {
        // Silent cleanup on error
      } finally {
        this.client = null;
        this.isClosing = false;
      }
    }
  }
}
```

### For Short-Lived CLI Queries

```typescript
async function queryRedis() {
  let client: any = null;
  
  try {
    client = createClient({
      url: config.url,
      socket: {
        reconnectStrategy: false // No reconnect for CLI
      }
    });
    
    // Suppress errors for CLI
    client.on('error', () => {});
    
    await client.connect();
    
    // Query data
    const keys = await client.keys('pattern:*');
    const results = await Promise.all(
      keys.map(key => client.get(key))
    );
    
    return results;
    
  } catch (error) {
    return []; // Return empty on error
  } finally {
    if (client && client.isOpen) {
      try {
        await client.quit();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}
```

## Common Issues & Solutions

### Issue: "Socket closed unexpectedly"

**Cause**: Using deprecated `disconnect()` or closing while commands are pending

**Solution**:
```typescript
// OLD (causes error)
await client.disconnect();

// NEW (proper way)
await client.quit();
```

### Issue: Errors During Shutdown

**Cause**: Error handler logs errors even during intentional shutdown

**Solution**:
```typescript
private isClosing = false;

client.on('error', (err) => {
  if (!this.isClosing) {
    logger.error('Redis error:', err);
  }
});

async close() {
  this.isClosing = true;
  // Remove error handler before closing
  client.off('error', errorHandler);
  await client.quit();
}
```

### Issue: Commands After Disconnect

**Cause**: Async writes executing after connection closed

**Solution**:
```typescript
async writeEvent(event: Event) {
  // Check BEFORE writing
  if (!this.client || !this.client.isOpen) {
    return; // Skip silently
  }
  
  try {
    await this.client.set(key, value);
  } catch (error) {
    // Only log if still connected
    if (this.client && this.client.isOpen) {
      logger.error('Write failed:', error);
    }
  }
}
```

## Configuration Options

```typescript
const client = createClient({
  url: 'redis://localhost:6379',
  
  socket: {
    // Connection timeout
    connectTimeout: 10000, // 10 seconds
    
    // Reconnection strategy
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Max retries');
      return Math.min(retries * 100, 3000);
    },
    
    // Keep alive
    keepAlive: 5000, // 5 seconds
  },
  
  // Disable offline queue (CLI only)
  disableOfflineQueue: true,
  
  // Command timeout
  commandsQueueMaxLength: 1000,
});
```

## Production Checklist

- ✅ Always add error handler before connect
- ✅ Use `quit()` for shutdown, not `disconnect()`  
- ✅ Check `isOpen` before operations
- ✅ Handle errors without crashing
- ✅ Suppress errors during intentional shutdown
- ✅ Use try-catch on all Redis operations
- ✅ Set appropriate timeouts
- ✅ Implement reconnection strategy
- ✅ Monitor connection health

## Key Differences from v4

| Feature | v4 | v5 |
|---------|----|----|
| Disconnect | `disconnect()` | `quit()` (recommended) |
| Error Handling | Optional | Required before connect |
| Promises | Manual | Native async/await |
| TypeScript | External types | Built-in |

## Resources

- Official Docs: https://redis.io/docs/latest/develop/clients/nodejs/
- GitHub: https://github.com/redis/node-redis
- Examples: https://github.com/redis/node-redis/tree/master/examples
- Migration Guide: https://github.com/redis/node-redis/blob/master/docs/v3-to-v4.md

---

**Last Updated**: November 6, 2025  
**Redis Client Version**: 5.9.0  
**Status**: Production-Ready with proper error handling

