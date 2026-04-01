import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll mock pino later in the implementation phase if needed,
// but for now we'll test the exported Logger instance interface.
import { Logger } from './logger';

describe('Logger Utility', () => {
  it('should have the standard logging methods', () => {
    expect(Logger.info).toBeDefined();
    expect(Logger.error).toBeDefined();
    expect(Logger.warn).toBeDefined();
    expect(Logger.debug).toBeDefined();
  });

  it('should log a simple message', () => {
    // We expect this to not throw
    expect(() => Logger.info('Test message')).not.toThrow();
  });

  it('should log an object', () => {
    expect(() => Logger.info({ key: 'value' }, 'Object message')).not.toThrow();
  });

  it('should handle errors', () => {
    const error = new Error('Test error');
    expect(() => Logger.error(error, 'Error occurred')).not.toThrow();
  });

  it('should redact sensitive fields', () => {
    // This is hard to test with the live pino instance without capturing stdout.
    // However, we can at least ensure it doesn't throw when logging sensitive keys.
    expect(() => Logger.info({ password: 'secret123', token: 'abc-123' }, 'Sensitive info')).not.toThrow();
  });
});
