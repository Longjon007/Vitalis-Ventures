import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreItemsState {
  installedIds: string[];
  install: (id: string) => void;
  uninstall: (id: string) => void;
  isInstalled: (id: string) => boolean;
}

export const useStoreItemsStore = create<StoreItemsState>()(
  persist(
    (set, get) => ({
      installedIds: [],

      install: (id) =>
        set((state) => ({
          installedIds: state.installedIds.includes(id)
            ? state.installedIds
            : [...state.installedIds, id],
        })),

      uninstall: (id) =>
        set((state) => ({
          installedIds: state.installedIds.filter((i) => i !== id),
        })),

      isInstalled: (id) => get().installedIds.includes(id),
    }),
    { name: 'musicforge-store-items' }
  )
);
