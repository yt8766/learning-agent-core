import { Button } from '@/components/ui/button';

export type AdminErrorPageStatus = '401' | '403' | '404' | '500' | '503';

const ADMIN_ERROR_COPY: Record<
  AdminErrorPageStatus,
  {
    title: string;
    description: string;
    actions: 'navigation' | 'learn-more';
  }
> = {
  '401': {
    title: 'Unauthorized Access',
    description: 'Please log in with the appropriate credentials\nto access this resource.',
    actions: 'navigation'
  },
  '403': {
    title: 'Access Forbidden',
    description: "You don't have necessary permission\nto view this resource.",
    actions: 'navigation'
  },
  '404': {
    title: 'Oops! Page Not Found!',
    description: "It seems like the page you're looking for\ndoes not exist or might have been removed.",
    actions: 'navigation'
  },
  '500': {
    title: "Oops! Something went wrong :')",
    description: 'We apologize for the inconvenience.\nPlease try again later.',
    actions: 'navigation'
  },
  '503': {
    title: 'Website is under maintenance!',
    description: "The site is not available at the moment.\nWe'll be back online shortly.",
    actions: 'learn-more'
  }
};

interface AdminErrorPageProps {
  status: AdminErrorPageStatus;
}

export function AdminErrorPage({ status }: AdminErrorPageProps) {
  const copy = ADMIN_ERROR_COPY[status];

  return (
    <main className="h-svh bg-background text-foreground">
      <section className="m-auto flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-[7rem] font-bold leading-tight tracking-normal text-[#030718] max-sm:text-[5.75rem]">
          {status}
        </h1>
        <p className="font-medium text-[#030718]">{copy.title}</p>
        <p className="whitespace-pre-line text-center text-muted-foreground">{copy.description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {copy.actions === 'navigation' ? <ErrorNavigationActions /> : <Button variant="outline">Learn more</Button>}
        </div>
      </section>
    </main>
  );
}

function ErrorNavigationActions() {
  function goBack() {
    globalThis.history?.back();
  }

  function goHome() {
    globalThis.location?.assign('/');
  }

  return (
    <>
      <Button className="rounded-md border-[#e2e8f0] px-7 shadow-sm" variant="outline" onClick={goBack}>
        Go Back
      </Button>
      <Button className="rounded-md bg-[#0f172a] px-7 shadow-sm hover:bg-[#111827]" onClick={goHome}>
        Back to Home
      </Button>
    </>
  );
}
