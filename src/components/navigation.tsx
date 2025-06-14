'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { LanguageSwitcher } from './language-switcher';

interface NavigationProps {
  locale: string;
}

export function Navigation({ locale }: NavigationProps) {
  const { data: session } = useSession();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={`/${locale}`} className="text-2xl font-bold text-gray-900">
              Indiek
            </Link>
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              <Link
                href={`/${locale}`}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Home
              </Link>
              <Link
                href={`/${locale}/artists`}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Artists
              </Link>
              <Link
                href={`/${locale}/music`}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Music
              </Link>
              <Link
                href={`/${locale}/community`}
                className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Community
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />

            {session ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href={`/${locale}/auth/signin`}
                  className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href={`/${locale}/auth/signup`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
