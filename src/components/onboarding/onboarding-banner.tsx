"use client"

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
        title: 'Add More Credits',
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
      document.documentElement.style.setProperty('--sidebar-top', '130px');
      document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 130px)');
      console.log('Added has-onboarding-banner class and set sidebar position');
    } else {
      document.documentElement.classList.remove('has-onboarding-banner');
      document.documentElement.style.setProperty('--sidebar-top', '65px');
      document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 65px)');
      console.log('Removed has-onboarding-banner class and reset sidebar position');
    }
  }, [pathname]);

  const handleDismiss = () => {
    setVisible(false);
    document.documentElement.classList.remove('has-onboarding-banner');
    document.documentElement.style.setProperty('--sidebar-top', '65px');
    document.documentElement.style.setProperty('--sidebar-height', 'calc(100vh - 65px)');
    console.log('Removed has-onboarding-banner class (dismissed) and reset sidebar position');
    // Remember dismissal for this session
    sessionStorage.setItem('onboarding_banner_dismissed', 'true');
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  if (!visible || !nextTask) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md sticky top-[65px] z-40">
      <div className="px-4 py-3 max-w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
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
              <span className="text-sm font-medium">
                {completedCount}/{totalCount}
              </span>
            </div>

            {/* Next task */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm">Next step:</span>
              <Link href={nextTask.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="!bg-white/20 !text-white hover:!bg-white/30 hover:!text-white font-semibold border border-white/30"
                >
                  {nextTask.title}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Back to onboarding link */}
            <Link href="/onboarding" className="hidden md:block">
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
            className="shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
