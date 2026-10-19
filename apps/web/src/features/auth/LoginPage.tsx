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
        setError('Confirm your email first.');
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
        <form onSubmit={handleLogin} className="flex flex-col gap-8">
          <FormHeading
            eyebrow="Welcome back"
            title="Sign in"
            lead="Use the username or email you signed up with."
          />

          <div className="flex flex-col gap-4">
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
                Forgot password?
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
        <form onSubmit={handleRegister} className="flex flex-col gap-8">
          <FormHeading
            eyebrow="Join the club"
            title="Create your account"
            lead="Your username is how organizers add you to a squad."
          />

          <div className="flex flex-col gap-4">
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
              hint="Public. a-z, 0-9 and _"
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="8+ characters."
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
        <form onSubmit={handleForgot} className="flex flex-col gap-8">
          <FormHeading
            eyebrow="Account recovery"
            title="Reset your password"
            lead="Tell us the email on your account and we will send a code."
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
        <form onSubmit={handleReset} className="flex flex-col gap-8">
          <FormHeading
            eyebrow="Account recovery"
            title="Choose a new password"
            lead={
              <>
                Code sent to <span className="text-primary">{email}</span>
              </>
            }
          />

          {devCode ? <DevCodeBanner code={devCode} /> : null}

          <div className="flex flex-col gap-8">
            <CodeInput inputRef={codeInputRef} value={code} onChange={setCode} />

            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="8+ characters. Signs out other devices."
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
            Set password
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
        <form onSubmit={handleVerify} className="flex flex-col gap-8">
          <FormHeading
            eyebrow="One step left"
            title="Confirm your email"
            lead={
              <>
                Code sent to <span className="text-primary">{email}</span>
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
            Continue
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
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[1.05fr_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col self-start p-4 lg:flex">
        <figure className="relative flex-1 overflow-hidden rounded-[var(--radius-lg)]">
          <img
            src="/login-trophy-backdrop.png"
            alt="Players lifting the trophy on the night of the final"
            className="absolute inset-0 size-full object-cover object-[50%_20%]"
          />
        </figure>
        <figcaption className="flex items-baseline justify-between gap-6 px-1 pt-4 text-xs text-muted">
          <span>The final, scored ball by ball.</span>
          <span className="tabular">Every ball, on the record</span>
        </figcaption>
      </aside>

      <main className="flex flex-col px-6 py-7 sm:px-12 lg:px-20">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="Howzat home">
            <Wordmark size="sm" />
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center py-14">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>

        <p className="text-xs text-muted">
          Spectators never need an account. Share the live link instead.
        </p>
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
      <h1 className="serif mt-5 text-[3.75rem] text-primary">{title}</h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-secondary">{lead}</p>
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
    <p className="border-t border-line pt-6 text-sm text-secondary">
      {question}{' '}
      <button
        type="button"
        onClick={onClick}
        className="font-medium text-primary underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-current"
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
      className="serif tabular h-16 text-center text-[2.25rem] tracking-[0.4em] placeholder:text-[var(--line-strong)]"
    />
  );
}

function DevCodeBanner({ code }: { code: string }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong px-4 py-3 text-sm text-secondary">
      Dev code <span className="tabular font-semibold tracking-[0.2em]">{code}</span>
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--alert)]/40 px-4 py-3 text-sm font-medium text-alert"
    >
      {message}
    </p>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div role="status" aria-label="Loading" className="flex flex-col items-center gap-4">
        <WordmarkMark size="lg" />
        <span className="h-px w-14 animate-pulse bg-[var(--text-primary)]" />
      </div>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    const fieldError = Object.values(err.fieldErrors)[0];
    return fieldError ?? err.message;
  }
  return 'Something went wrong. Try again.';
}
