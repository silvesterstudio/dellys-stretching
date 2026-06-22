"use client";

// Friendly fallback for any unhandled server/client error in this segment —
// replaces the raw "Application error" white screen with a calm retry card.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="card p-8">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-mauve-100 text-2xl">
          ✦
        </div>
        <h1 className="font-display text-xl font-medium text-mauve-900">
          Ceva nu a mers · Что-то пошло не так
        </h1>
        <p className="mt-2 text-sm text-mauve-500">
          Încearcă din nou într-o clipă. · Попробуйте ещё раз через мгновение.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">
            Reîncearcă · Повторить
          </button>
          <a href="/" className="btn-secondary">
            Acasă · Главная
          </a>
        </div>
      </div>
    </div>
  );
}
