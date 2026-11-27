"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmCardSetup,
  createCardSetupSession,
  getCardStatus,
  removeSavedCard,
  setAutoTopUp,
  type AutoTopUpChange,
  type CardAutoTopUpStatus,
} from './api';
import { isCardAutoTopUpEnabled } from './flag';

const cardStatusKey = ['card-auto-topup'] as const;

/** The saved card and auto top-up settings. Never fetched while the build flag is off. */
export function useCardAutoTopUp() {
  return useQuery({
    queryKey: cardStatusKey,
    queryFn: getCardStatus,
    enabled: isCardAutoTopUpEnabled(),
    staleTime: 60_000,
    retry: false,
  });
}

function useStatusMutation<T>(fn: (arg: T) => Promise<CardAutoTopUpStatus>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (status) => queryClient.setQueryData(cardStatusKey, status),
  });
}

export function useConfirmCardSetup() {
  return useStatusMutation((sessionId: string) => confirmCardSetup(sessionId));
}

export function useRemoveSavedCard() {
  return useStatusMutation((_: void) => removeSavedCard());
}

export function useSetAutoTopUp() {
  return useStatusMutation((change: AutoTopUpChange) => setAutoTopUp(change));
}

export function useStartCardSetup() {
  return useMutation({ mutationFn: createCardSetupSession });
}
