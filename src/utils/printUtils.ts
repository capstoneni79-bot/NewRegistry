export function printDocument(target: string): void {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    throw new Error('Printing is not available in this browser.');
  }

  const previousTarget = document.body.dataset.printTarget;
  const restoreTarget = () => {
    if (previousTarget) {
      document.body.dataset.printTarget = previousTarget;
    } else {
      delete document.body.dataset.printTarget;
    }
  };

  document.body.dataset.printTarget = target;
  window.addEventListener('afterprint', restoreTarget, { once: true });

  // Use setTimeout to ensure DOM and CSS rules for data-print-target apply before print dialog opens
  setTimeout(() => {
    try {
      window.print();
    } catch (error) {
      window.removeEventListener('afterprint', restoreTarget);
      restoreTarget();
      console.error('Print dialog error:', error);
    }
  }, 150);
}
