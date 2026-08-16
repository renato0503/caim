import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from './auth-service.js';

// S20/J1: recuperação de senha, verificação de email e erros amigáveis de auth.

vi.mock('../firebase/firebase-config.js', () => ({
  isFirebaseConfigured: true,
  getFirebaseApp: vi.fn(async () => ({})),
}));

vi.mock('../db/db-service.js', () => ({ dbService: {} }));

const authMethods = { resetCalls: 0, verifyCalls: 0, emailVerified: false };
vi.mock('firebase/auth', () => ({
  getAuth: () => ({
    currentUser: {
      email: 'u@ex.com',
      get emailVerified() {
        return authMethods.emailVerified;
      },
    },
  }),
  sendPasswordResetEmail: vi.fn(async () => { authMethods.resetCalls += 1; }),
  sendEmailVerification: vi.fn(async () => { authMethods.verifyCalls += 1; }),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

describe('authService — recuperação e verificação (S20)', () => {
  beforeEach(() => {
    authMethods.resetCalls = 0;
    authMethods.verifyCalls = 0;
  });

  it('sendPasswordReset dispara sendPasswordResetEmail', async () => {
    await authService.sendPasswordReset('user@ex.com');
    expect(authMethods.resetCalls).toBe(1);
  });

  it('sendEmailVerification dispara sendEmailVerification quando há usuário', async () => {
    await authService.sendEmailVerification();
    expect(authMethods.verifyCalls).toBe(1);
  });

  it('isEmailVerified reflete o estado do usuário atual', () => {
    authMethods.emailVerified = true;
    expect(authService.isEmailVerified()).toBe(true);
    authMethods.emailVerified = false;
    expect(authService.isEmailVerified()).toBe(false);
  });

  it('friendlyAuthError mapeia códigos conhecidos', () => {
    expect(authService.friendlyAuthError({ code: 'auth/user-token-expired' })).toContain('Sessão expirada');
    expect(authService.friendlyAuthError({ code: 'auth/user-disabled' })).toContain('desativada');
    expect(authService.friendlyAuthError({ code: 'auth/wrong-password' })).toContain('incorretos');
    expect(authService.friendlyAuthError({ code: 'auth/network-request-failed' })).toContain('Sem conexão');
    expect(authService.friendlyAuthError({ message: 'genérico' })).toBe('genérico');
  });
});
