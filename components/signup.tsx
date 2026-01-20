"use client";

import YamyLogo from '@/app/ui/yamy-logo'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/app/lib/actions";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";

const SignUp = () => {
  const [errorMessage, formAction, isPending] = useActionState(
    register,
    undefined,
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/70">
      <div className="relative max-w-sm w-full border rounded-xl px-8 py-8 shadow-lg/5 dark:shadow-xl bg-card overflow-hidden">
        <div
          className="absolute inset-0 z-0 -top-px -left-px"
          style={{
            backgroundImage: `
        linear-gradient(to right, color-mix(in srgb, var(--card-foreground) 8%, transparent) 1px, transparent 1px),
        linear-gradient(to bottom, color-mix(in srgb, var(--card-foreground) 8%, transparent) 1px, transparent 1px)
      `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 0",
            maskImage: `
        repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 70% 50% at 50% 0%, #000 60%, transparent 100%)
      `,
            WebkitMaskImage: `
 repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 70% 50% at 50% 0%, #000 60%, transparent 100%)
      `,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />

        <div className="relative isolate flex flex-col items-center">
          <YamyLogo className="text-black" size={26} />
          <p className="mt-4 text-xl font-semibold tracking-tight">
            Create your account
          </p>


          <div className="my-7 w-full flex items-center justify-center overflow-hidden">
            <Separator />
            <span className="text-sm px-2"></span>
            <Separator />
          </div>

          <form className="w-full space-y-4" action={formAction}>
            <Input
              name="name"
              placeholder="Name"
              className="w-full"
              required
            />
            <Input
              name="email"
              type="email"
              placeholder="Email"
              className="w-full"
              required
            />
            <Input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full"
              minLength={8}
              required
            />
            <Button type="submit" className="mt-4 w-full" aria-disabled={isPending}>
              Create account
            </Button>
          </form>

          {errorMessage && (
            <div className="mt-4 flex w-full items-start gap-2 text-sm text-red-600">
              <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <p className="mt-5 text-sm text-center">
            Already have an account?
            <Link href="/login" className="ml-1 underline text-muted-foreground">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};


export default SignUp;
