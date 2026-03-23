import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('extracts message from Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns fallback for Error with empty message', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });

  it('returns string errors directly', () => {
    expect(getErrorMessage('direct error')).toBe('direct error');
  });

  it('extracts message from Supabase-style error objects', () => {
    expect(getErrorMessage({ message: 'db error' })).toBe('db error');
  });

  it('extracts error_description from OAuth-style errors', () => {
    expect(getErrorMessage({ error_description: 'token expired' })).toBe('token expired');
  });

  it('combines message and details', () => {
    expect(getErrorMessage({ message: 'failed', details: 'timeout' })).toBe('failed timeout');
  });

  it('does not duplicate details already in message', () => {
    expect(getErrorMessage({ message: 'failed timeout', details: 'timeout' })).toBe('failed timeout');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null, 'oops')).toBe('oops');
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined, 'oops')).toBe('oops');
  });

  it('returns default fallback when none provided', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong');
  });

  it('returns fallback for empty object', () => {
    expect(getErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
