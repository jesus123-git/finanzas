// frontend/src/lib/upgradeModalBus.ts
type Listener = (errorCode: string) => void;

const listeners: Listener[] = [];

export const upgradeModalBus = {
  emit(code: string) {
    listeners.forEach(fn => fn(code));
  },
  on(fn: Listener) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  },
};
