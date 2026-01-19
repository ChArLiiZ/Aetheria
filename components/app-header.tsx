"use client"

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { LogOut, User as UserIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function AppHeader() {
    const { user, logout } = useAuth();

    const initials = user?.display_name?.charAt(0).toUpperCase() || "U";

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center mx-auto px-4">
                <div className="mr-4 flex items-center">
                    <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
                        <span className="font-bold inline-block">
                            Aetheria
                        </span>
                    </Link>
                    {user && (
                        <nav className="hidden md:flex items-center space-x-1">
                            <Link href="/community">
                                <Button variant="ghost" size="sm">社群</Button>
                            </Link>
                            <Link href="/worlds">
                                <Button variant="ghost" size="sm">世界觀</Button>
                            </Link>
                            <Link href="/characters">
                                <Button variant="ghost" size="sm">角色</Button>
                            </Link>
                            <Link href="/stories">
                                <Button variant="ghost" size="sm">故事</Button>
                            </Link>
                        </nav>
                    )}
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* Search or other items can go here */}
                    </div>
                    <nav className="flex items-center space-x-2">
                        <ModeToggle />
                        {user && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.display_name} />}
                                            <AvatarFallback>{initials}</AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.display_name}</p>
                                            <p className="text-xs leading-none text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={logout}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>登出</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
