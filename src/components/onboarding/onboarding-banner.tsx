"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { safeSessionStorage } from '@/lib/safe-session-storage';
import { useAuth } from '@/hooks/use-auth';
import { getUserData, USER_DATA_UPDATED_EVENT } from '@/lib/api';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safe-storage';

interface OnboardingTask {
  id: string;
  title: string;
  path: string;
  completed: boolean;
}

export function OnboardingBanner() {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [nextTask, setNextTask] = useState<OnboardingTask | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  // The user has completed the "first top-up" step once they have any purchased
  // credits. purchased_credits only increases from real top-ups/purchases (free
  // trial credits land in the allowance instead), so this reliably reflects that
  // the first-top-up offer has already been used — without depending on a
  // localStorage flag that nothing sets after checkout.
  //
  // Read BOTH the auth-context user (React state) and the freshly-persisted
  // localStorage profile: the credits page refreshes the profile and writes it
  // to storage, which can be newer than the in-memory auth state.
  const hasToppedUp =
    Number((user as { purchased_credits?: number } | null)?.purchased_credits ?? 0) > 0 ||
    Number(getUserData()?.purchased_credits ?? 0) > 0;

  // Function to load and check tasks
  const loadTasks = useCallback(() => {
    // Don't show banner for guest users (not authenticated)
    if (!isAuthenticated) {
      setVisible(false);
      return;
    }

    // Check if banner was dismissed this session
    const dismissed = safeSessionStorage.getItem('onboarding_banner_dismissed');
    if (dismissed) {
      setVisible(false);
      return;
    }

    // Check if onboarding is completed
    const completed = safeLocalStorageGet('gatewayz_onboarding_completed');
    if (completed) {
      setVisible(false);
      return;
    }

    // Don't show on onboarding page itself or home page
    if (pathname === '/onboarding' || pathname === '/') {
      setVisible(false);
      return;
    }

    // Load task completion state
    const savedTasks = safeLocalStorageGet('gatewayz_onboarding_tasks');
    const taskState = savedTasks ? JSON.parse(savedTasks) : {};

    // Once the user has actually topped up, durably persist the credits step as
    // complete in the SHARED task storage so every onboarding surface (this
    // banner AND the /onboarding page) stops advertising the first-top-up offer.
    if (hasToppedUp && !taskState.credits) {
      taskState.credits = true;
      safeLocalStorageSet('gatewayz_onboarding_tasks', JSON.stringify(taskState));
    }

    const taskList: OnboardingTask[] = [
      {
        id: 'welcome',
        title: 'Welcome to Gatewayz',
        path: '/onboarding',
        completed: taskState.welcome || true,
      },
      {
        id: 'apikey',
        title: 'Create Your API Key',
        path: '/settings/keys',
        completed: taskState.apikey || false,
      },
      {
        id: 'chat',
        title: 'Start Your First Chat',
        path: '/chat',
        completed: taskState.chat || false,
      },
      {
        id: 'explore',
        title: 'Explore 10,000+ AI Models',
        path: '/models',
        completed: taskState.explore || false,
      },
      {
        id: 'credits',
        title: 'Add $5 or more and get a one-time $5 bonus on your first top up!',
        path: '/settings/credits',
        completed: taskState.credits || hasToppedUp,
      },
    ];

    setTasks(taskList);

    // Find the next incomplete task
    const incomplete = taskList.find(task => !task.completed);
    setNextTask(incomplete || null);

    // Show banner if there are incomplete tasks
    const shouldShow = !!incomplete;
    setVisible(shouldShow);
  }, [pathname, isAuthenticated, hasToppedUp]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle DOM manipulation after visibility changes (only runs on client after hydration)
  useEffect(() => {
    let rafId1: number | null = null;
    let rafId2: number | null = null;

    if (visible) {
      document.documentElement.classList.add('has-onboarding-banner');
      // Measure banner height after render - use requestAnimationFrame to ensure DOM is ready
      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          const bannerElement = document.querySelector('[data-onboarding-banner]');
          if (bannerElement) {
            const bannerHeight = bannerElement.getBoundingClientRect().height;
            const headerTop = 65 + bannerHeight;
            document.documentElement.style.setProperty('--sidebar-top', `${headerTop}px`);
            document.documentElement.style.setProperty('--sidebar-height', `calc(100vh - ${headerTop}px)`);
            document.documentElement.style.setProperty('--models-header-top', `${headerTop}px`);
            document.documentElement.style.setProperty('--onboarding-banner-height', `${bannerHeight}px`);
          } else {
            document.documentElement.style.setProperty('--sidebar-top', '105px');
            document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 105px)');
            document.documentElement.style.setProperty('--models-header-top', '105px');
            document.documentElement.style.setProperty('--onboarding-banner-height', '40px');
          }
        });
      });
    } else {
      document.documentElement.classList.remove('has-onboarding-banner');
      document.documentElement.style.setProperty('--sidebar-top', '65px');
      document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 65px)');
      document.documentElement.style.setProperty('--models-header-top', '65px');
      document.documentElement.style.setProperty('--onboarding-banner-height', '0px');
    }

    // Cleanup function to prevent stale DOM styles and cancel pending animations
    return () => {
      if (rafId1 !== null) {
        cancelAnimationFrame(rafId1);
      }
      if (rafId2 !== null) {
        cancelAnimationFrame(rafId2);
      }
      // Clean up DOM on unmount
      document.documentElement.classList.remove('has-onboarding-banner');
      document.documentElement.style.setProperty('--sidebar-top', '65px');
      document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 65px)');
      document.documentElement.style.setProperty('--models-header-top', '65px');
      document.documentElement.style.setProperty('--onboarding-banner-height', '0px');
    };
  }, [visible]);

  // Listen for localStorage changes (from other components marking tasks complete)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'gatewayz_onboarding_tasks' ||
        e.key === 'gatewayz_onboarding_completed' ||
        e.key === 'gatewayz_user_data'
      ) {
        loadTasks();
      }
    };

    // Also listen for custom events for same-tab updates
    const handleCustomEvent = () => {
      loadTasks();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('onboarding-task-updated', handleCustomEvent);
    // Re-check when the cached profile is updated in this tab (e.g. after a
    // top-up refreshes credits), since the `storage` event won't fire same-tab.
    window.addEventListener(USER_DATA_UPDATED_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('onboarding-task-updated', handleCustomEvent);
      window.removeEventListener(USER_DATA_UPDATED_EVENT, handleCustomEvent);
    };
  }, [loadTasks]);

  const handleDismiss = () => {
    setVisible(false);
    document.documentElement.classList.remove('has-onboarding-banner');
    document.documentElement.style.setProperty('--sidebar-top', '65px');
    document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 65px)');
    document.documentElement.style.setProperty('--models-header-top', '65px');
    document.documentElement.style.setProperty('--onboarding-banner-height', '0px');

    // Update spacer height
    const spacer = document.querySelector('[data-header-spacer]');
    if (spacer) {
      (spacer as HTMLElement).style.height = '65px';
    }

    // Update page content padding for other pages
    const pageContents = document.querySelectorAll('[data-page-content]');
    pageContents.forEach((content) => {
      (content as HTMLElement).style.paddingTop = '128px'; // pt-32
    });

    // Chat will adjust automatically via CSS classes

    // Remember dismissal for this session
    safeSessionStorage.setItem('onboarding_banner_dismissed', 'true');
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  if (!visible || !nextTask) {
    return null;
  }

  return (
    <div data-onboarding-banner className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md fixed top-[65px] left-0 right-0 z-30">
      <div className="px-3 sm:px-4 py-1.5 sm:py-2 w-full">
        {/* Mobile layout: single row on xs/sm screens */}
        <div className="md:hidden flex items-center justify-between gap-2">
          {/* Progress dots and count */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    task.completed ? 'bg-green-300' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-medium whitespace-nowrap">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Next task button - compact */}
          <Link href={nextTask.path} className="flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="!bg-white/20 !text-white hover:!bg-white/30 hover:!text-white font-semibold border border-white/30 text-xs h-7 px-2 w-full justify-start"
            >
              <span className="truncate flex-1 text-left">{nextTask.title}</span>
              <ArrowRight className="ml-1 h-3 w-3 flex-shrink-0" />
            </Button>
          </Link>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop layout: horizontal on md+ screens */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      task.completed ? 'bg-green-300' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium whitespace-nowrap">
                {completedCount}/{totalCount}
              </span>
            </div>

            {/* Next task */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm whitespace-nowrap">Next step:</span>
              <Link href={nextTask.path} className="min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="!bg-white/20 !text-white hover:!bg-white/30 hover:!text-white font-semibold border border-white/30 text-sm truncate max-w-full w-full justify-start"
                >
                  <span className="truncate">{nextTask.title}</span>
                  <ArrowRight className="ml-1 h-4 w-4 flex-shrink-0" />
                </Button>
              </Link>
            </div>

            {/* Back to onboarding link */}
            <Link href="/onboarding" className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="!bg-white/20 !text-white hover:!bg-white/30 hover:!text-white font-semibold border border-white/30"
              >
                View All Tasks
              </Button>
            </Link>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 hover:bg-white/20 rounded-full p-1.5 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
