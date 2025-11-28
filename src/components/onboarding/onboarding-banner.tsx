"use client"

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { safeSessionStorage } from '@/lib/safe-session-storage';

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

  useEffect(() => {
    // Check if onboarding is completed
    const completed = localStorage.getItem('gatewayz_onboarding_completed');
    if (completed) {
      setVisible(false);
      document.documentElement.classList.remove('has-onboarding-banner');
      return;
    }

    // Don't show on onboarding page itself or home page
    if (pathname === '/onboarding' || pathname === '/') {
      setVisible(false);
      document.documentElement.classList.remove('has-onboarding-banner');
      return;
    }

    // Load task completion state
    const savedTasks = localStorage.getItem('gatewayz_onboarding_tasks');
    const taskState = savedTasks ? JSON.parse(savedTasks) : {};

    const taskList: OnboardingTask[] = [
      {
        id: 'welcome',
        title: 'Welcome to Gatewayz',
        path: '/onboarding',
        completed: taskState.welcome || true,
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
        title: 'Add $10 and get a bonus $10 in free credits on your first top up!',
        path: '/settings/credits',
        completed: taskState.credits || false,
      },
    ];

    setTasks(taskList);

    // Find the next incomplete task
    const incomplete = taskList.find(task => !task.completed);
    setNextTask(incomplete || null);

    // Show banner if there are incomplete tasks
    const shouldShow = !!incomplete;
    setVisible(shouldShow);

    // Add/remove class to document element for CSS targeting
    if (shouldShow) {
      document.documentElement.classList.add('has-onboarding-banner');
      // Measure banner height after render - use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
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
  }, [pathname]);

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
