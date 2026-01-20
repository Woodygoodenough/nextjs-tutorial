'use client'

import Link from 'next/link'
import YamyLogo from '@/app/ui/yamy-logo'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const menuItems = [
    { name: 'Features', href: '#' },
    { name: 'About', href: '#' },
]

export default function HeroSectionClient({ demoCta }: { demoCta: React.ReactNode }) {
    return (
        <>
            <header>
                <nav
                    className="fixed z-20 w-full border-b border-dashed bg-white backdrop-blur md:relative dark:bg-zinc-950/50 lg:dark:bg-transparent">
                    <div className="m-auto max-w-5xl px-6">
                        <div className="flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                            <div className="flex w-full justify-between lg:w-auto">
                                <Link
                                    href="/"
                                    aria-label="home"
                                    className="flex items-center space-x-2">
                                    <YamyLogo className="text-black" />
                                </Link>
                            </div>

                            <div className="bg-background mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                                <div className="lg:pr-4">
                                    <ul className="space-y-6 text-base lg:flex lg:gap-8 lg:space-y-0 lg:text-sm">
                                        {menuItems.map((item, index) => (
                                            <li key={index}>
                                                <Link
                                                    href={item.href}
                                                    className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                                    <span>{item.name}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit lg:border-l lg:pl-6">
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm">
                                        <Link href="/login">
                                            <span>Login</span>
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        size="sm"
                                    >
                                        <Link href="/signup">
                                            <span>Sign Up</span>
                                        </Link>
                                    </Button>
                                </div>
                            </div>

                            {/* Mobile menu (no client JS) */}
                            <details className="bg-background lg:hidden w-full rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20">
                                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                                    <span>Menu</span>
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Menu className="size-4" />
                                        <X className="size-4" />
                                    </span>
                                </summary>
                                <div className="mt-6 space-y-8">
                                    <ul className="space-y-6 text-base">
                                        {menuItems.map((item, index) => (
                                            <li key={index}>
                                                <Link
                                                    href={item.href}
                                                    className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                                    <span>{item.name}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex w-full flex-col space-y-3">
                                        <Button asChild variant="outline" size="sm">
                                            <Link href="/login">
                                                <span>Login</span>
                                            </Link>
                                        </Button>
                                        <Button asChild size="sm">
                                            <Link href="/signup">
                                                <span>Sign Up</span>
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                </nav>
            </header>
            <main className="overflow-hidden">
                <section className="relative">
                    <div className="relative py-24 lg:py-28">
                        <div className="mx-auto max-w-7xl px-6 md:px-12">
                            <div className="text-center sm:mx-auto sm:w-10/12 lg:mr-auto lg:mt-0 lg:w-4/5">
                                <Link
                                    href="#"
                                    className="rounded-(--radius) mx-auto flex w-fit items-center gap-2 border p-1 pr-3">
                                    <span className="bg-muted rounded-[calc(var(--radius)-0.25rem)] px-2 py-1 text-xs">New</span>
                                    <span className="text-sm">Introduction of Yamy Edu</span>
                                    <span className="bg-(--color-border) block h-4 w-px"></span>

                                    <ArrowRight className="size-4" />
                                </Link>

                                <h1 className="mt-8 text-4xl font-semibold md:text-5xl xl:text-5xl xl:[line-height:1.125]">
                                    Contextualize English Learning Experience
                                </h1>
                                <p className="mx-auto mt-8 hidden max-w-2xl text-wrap text-lg sm:block">You can continue with the demo account</p>
                                <p className="mx-auto mt-8 hidden max-w-2xl text-wrap text-lg sm:block">Learning data is transient and will be reset regularly.</p>
                                <div className="mt-8">
                                    {demoCta}
                                </div>
                            </div>
                            <div className="x-auto relative mx-auto mt-8 max-w-lg sm:mt-12">
                                <div className="absolute inset-0 -top-8 left-1/2 -z-20 h-56 w-full -translate-x-1/2 [background-image:linear-gradient(to_bottom,transparent_98%,theme(colors.gray.200/75%)_98%),linear-gradient(to_right,transparent_94%,_theme(colors.gray.200/75%)_94%)] [background-size:16px_35px] [mask:radial-gradient(black,transparent_95%)] dark:opacity-10"></div>
                                <div className="absolute inset-x-0 top-12 -z-[1] mx-auto h-1/3 w-2/3 rounded-full bg-blue-300 blur-3xl dark:bg-white/20"></div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}

