import { describe, it, expect } from 'vitest';
import { Logger } from './logger';

describe('Mobile Logger Service', () => {
  it('should have the expected logging interface', () => {
    expect(Logger.info).toBeDefined();
    expect(Logger.error).toBeDefined();
    expect(Logger.warn).toBeDefined();
    expect(Logger.debug).toBeDefined();
  });

  it('should log messages without crashing', () => {
    expect(() => Logger.info('Mobile test message')).not.toThrow();
  });

  it('should handle complex objects', () => {
    expect(() => Logger.info({ screen: 'Dashboard', user: '123' }, 'Navigation event')).not.toThrow();
  });

  it('should format errors properly', () => {
    const error = new Error('Mobile crash simulation');
    expect(() => Logger.error(error, 'Error in mobile app')).not.toThrow();
  });
});
