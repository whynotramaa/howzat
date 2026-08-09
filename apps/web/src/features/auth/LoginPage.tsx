import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { Button, TextAction } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Wordmark, WordmarkMark } from '@/components/Wordmark';
import { useAuth } from './AuthProvider';

type Step = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

export function LoginPage() {
  const {
    user,
    isLoading,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>('login');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'verify' || step === 'reset') codeInputRef.current?.focus();
  }, [step]);

  if (isLoading) return <FullPageSpinner />;

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/tournaments';
    return <Navigate to={from} replace />;
  }

  function goTo(next: Step) {
    setStep(next);
    setError(null);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await login({ identifier, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_UNVERIFIED') {
        const pendingEmail = (err.details as { email?: string } | undefined)?.email;
        if (pendingEmail) setEmail(pendingEmail);
        setError('Confirm your email to finish setting up this account.');
        setStep('verify');
        await sendAnotherCode(pendingEmail ?? identifier);
      } else {
        setError(messageFor(err));
      }
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await register({ email, username, name, password });
      setDevCode(result.devCode ?? null);
      setStep('verify');
      setResendIn(30);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await verifyEmail(email, code);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(messageFor(err));
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function sendAnotherCode(target: string) {
    try {
      const result =
        step === 'reset' ? await forgotPassword(target) : await resendVerification(target);
      setDevCode(result.devCode ?? null);
      setResendIn(30);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function handleForgot(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await forgotPassword(email);
      setDevCode(result.devCode ?? null);
      setPassword('');
      setCode('');
      setStep('reset');
      setResendIn(30);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setPending(false);
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await resetPassword({ email, code, newPassword: password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(messageFor(err));
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      {step === 'login' ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-7">
          <FormHeading
            eyebrow="Welcome back"
            title="Sign in"
            lead="Use the username you picked when you signed up."
          />

          <div className="flex flex-col gap-5">
            <Input
              label="Username or email"
              autoComplete="username"
              autoFocus
              required
              placeholder="yourname"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />

            <div className="flex flex-col gap-2">
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <TextAction
                className="self-end"
                onClick={() => {
                  if (identifier.includes('@')) setEmail(identifier);
                  goTo('forgot');
                }}
              >
                Forgot your password?
              </TextAction>
            </div>
          </div>

          {error ? <ErrorBanner message={error} /> : null}

          <Button type="submit" size="lg" fullWidth isLoading={pending}>
            Sign in
          </Button>

          <FormFooter
            question="New here?"
            action="Create an account"
            onClick={() => goTo('register')}
          />
        </form>
      ) : step === 'register' ? (
        <form onSubmit={handleRegister} className="flex flex-col gap-7">
          <FormHeading
            eyebrow="Registration"
            title="Create your account"
            lead="Your username is how organizers add you to a squad, so pick one your team will recognise."
          />

          <div className="flex flex-col gap-5">
            <Input
              label="Your name"
              autoComplete="name"
              autoFocus
              required
              placeholder="Rama"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <Input
              label="Username"
              autoComplete="username"
              required
              placeholder="whynotramaa"
              hint="Lowercase letters, numbers and underscores. This is public."
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              }
            />

            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              hint="We send a code once, to confirm the address is yours."
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="At least 8 characters."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <ErrorBanner message={error} /> : null}

          <Button type="submit" size="lg" fullWidth isLoading={pending}>
            Create account
          </Button>

          <FormFooter
            question="Already have an account?"
            action="Sign in"
            onClick={() => goTo('login')}
          />
        </form>
      ) : step === 'forgot' ? (
        <form onSubmit={handleForgot} className="flex flex-col gap-7">
          <FormHeading
            eyebrow="Account recovery"
            title="Reset your password"
            lead="Tell us the email on your account and we'll send a code to set a new password."
          />

          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {error ? <ErrorBanner message={error} /> : null}

          <Button type="submit" size="lg" fullWidth isLoading={pending}>
            Send reset code
          </Button>

          <FormFooter
            question="Remembered it?"
            action="Back to sign in"
            onClick={() => goTo('login')}
          />
        </form>
      ) : step === 'reset' ? (
        <form onSubmit={handleReset} className="flex flex-col gap-7">
          <FormHeading
            eyebrow="Account recovery"
            title="Choose a new password"
            lead={
              <>
                If <span className="text-primary">{email}</span> has an account, a code is on its
                way.
              </>
            }
          />

          {devCode ? <DevCodeBanner code={devCode} /> : null}

          <div className="flex flex-col gap-5">
            <CodeInput inputRef={codeInputRef} value={code} onChange={setCode} />

            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="At least 8 characters. This signs you out everywhere else."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <ErrorBanner message={error} /> : null}

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={pending}
            disabled={code.length !== 6 || password.length < 8}
          >
            Set password and sign in
          </Button>

          <div className="flex items-center justify-between gap-4">
            <TextAction
              onClick={() => {
                setCode('');
                setPassword('');
                goTo('login');
              }}
            >
              Back to sign in
            </TextAction>

            <TextAction
              disabled={resendIn > 0 || pending}
              onClick={() => void sendAnotherCode(email)}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </TextAction>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-7">
          <FormHeading
            eyebrow="One step left"
            title="Confirm your email"
            lead={
              <>
                Sent to <span className="text-primary">{email}</span>. This is the only time we'll
                ask for a code.
              </>
            }
          />

          {devCode ? <DevCodeBanner code={devCode} /> : null}

          <CodeInput inputRef={codeInputRef} value={code} onChange={setCode} />

          {error ? <ErrorBanner message={error} /> : null}

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={pending}
            disabled={code.length !== 6}
          >
            Confirm and continue
          </Button>

          <div className="flex items-center justify-between gap-4">
            <TextAction
              onClick={() => {
                setCode('');
                goTo('login');
              }}
            >
              Back to sign in
            </TextAction>

            <TextAction
              disabled={resendIn > 0 || pending}
              onClick={() => void sendAnotherCode(email)}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </TextAction>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside
        className="auth-editorial-panel relative hidden flex-col justify-between bg-inverse bg-cover bg-center p-12 lg:flex xl:p-16"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(14,12,11,.96) 0%, rgba(14,12,11,.82) 45%, rgba(14,12,11,.3) 100%), url('/login-trophy-backdrop.png')",
        }}
      >
        <Link to="/" className="transition-opacity hover:opacity-70">
          <Wordmark tone="inverse" />
        </Link>

        <div className="max-w-md">
          <p className="eyebrow text-muted-on-inverse">The record</p>
          <h2 className="serif mt-6 text-[2.75rem] text-white">
            Ball-by-ball scoring for tournaments that actually happen.
          </h2>
        </div>

        <p className="text-[0.8125rem] text-white/75">Howzat — local cricket, kept properly.</p>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="lg:invisible">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}

function FormHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="serif mt-4 text-[2.25rem] text-primary">{title}</h1>
      <p className="mt-3 text-secondary">{lead}</p>
    </div>
  );
}

function FormFooter({
  question,
  action,
  onClick,
}: {
  question: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <p className="border-t border-line pt-6 text-center text-sm text-secondary">
      {question}{' '}
      <button
        type="button"
        onClick={onClick}
        className="font-medium text-accent underline decoration-[var(--accent-line)] underline-offset-4 transition-colors hover:decoration-[var(--accent-strong)]"
      >
        {action}
      </button>
    </p>
  );
}

function CodeInput({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <Input
      ref={inputRef}
      label="6-digit code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      required
      placeholder="000000"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      className="mono h-16 text-center text-[1.75rem] tracking-[0.45em] placeholder:text-[var(--line-strong)]"
    />
  );
}

function DevCodeBanner({ code }: { code: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--warning)]/40 bg-warning-soft px-4 py-3.5">
      <p className="eyebrow text-warning">Development mode</p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-secondary">
        Email sending is off, so the code is{' '}
        <span className="mono font-medium tracking-[0.2em] text-primary">{code}</span>. Set{' '}
        <code className="mono text-primary">RESEND_API_KEY</code> to send real email.
      </p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--alert)] bg-alert-soft px-4 py-3.5 text-sm text-primary"
    >
      {message}
    </p>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div role="status" aria-label="Loading" className="flex flex-col items-center gap-5">
        <WordmarkMark size="lg" />
        <span className="h-px w-16 animate-pulse bg-[var(--accent-strong)]" />
      </div>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    const fieldError = Object.values(err.fieldErrors)[0];
    return fieldError ?? err.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}
